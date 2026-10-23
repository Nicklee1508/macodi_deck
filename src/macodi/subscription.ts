/**
 * moodeck 구독 — 로그인 없이 결제, 활성화 키(PC 1대).
 *  '새 프로젝트 생성'·'마코디 자재를 캔버스에 담기'는 구독 중인 PC에서만. 아니면 구독 팝업.
 *
 *  - 이 PC 고유번호(deviceId)와 활성화 키를 브라우저에 보관
 *  - 상태는 서버(macodi_back /deck-billing)가 정함: 다른 PC에서 같은 키를 입력하면 이 PC는 REPLACED → 즉시 비활성화
 *  - 확인 시점: 처음 열 때 · 30초마다(화면 보일 때) · 창으로 돌아올 때 · 담기/새 프로젝트 직전
 */
import { reactive } from 'vue'
import { MACODI_API } from './api'

const KEY_STORE = 'moodeck.subKey'
const DEVICE_STORE = 'moodeck.deviceId'

const read = (k: string) => {
  try {
    return localStorage.getItem(k) || ''
  }
  catch {
    return ''
  }
}
const write = (k: string, v: string) => {
  try {
    if (v) localStorage.setItem(k, v)
    else localStorage.removeItem(k)
  }
  catch { /* 저장 불가 = 매번 키 입력 */ }
}
const uuid = () => {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** 이 PC 고유번호 — 한 번 만들면 계속 같음 */
export const deviceId = (() => {
  let id = read(DEVICE_STORE)
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = uuid()
    write(DEVICE_STORE, id)
  }
  return id
})()

export type DialogMode = '' | 'plan' | 'form' | 'success' | 'activate' | 'manage' | 'failed'

export const subscribeState = reactive({
  /** 열린 화면(''=닫힘) */
  mode: '' as DialogMode,
  /** 구독 팝업을 띄운 동작 — 'new'(새 프로젝트) · 'insert'(자재 담기) · ''(메뉴에서 직접) */
  reason: '' as '' | 'new' | 'insert',
  key: read(KEY_STORE),
  active: false,
  status: '',
  nextBillingAt: '' as string,
  email: '',
  card: '',
  amount: 4900,
  /** 결제 직후 안내창용 — 이메일로 보낸 키 */
  issuedKey: '',
  mailed: false,
  /** 안내 문구(예: 다른 PC에서 활성화돼 이 PC는 꺼졌어요) */
  notice: '',
  /** 카드 등록·첫 결제 실패 안내창(mode 'failed')의 제목·내용 */
  failTitle: '',
  failMsg: '',
  /** 무료 체험 1개를 방금 썼음 → 패널이 안내 */
  freeUsedNotice: false,
})

// ⚠️ 개발 전용 테스트 키 — npm run dev 에서만(운영 빌드엔 들어가지 않음). 서버·결제 없이 구독 상태를 흉내
const DEV_TEST_KEY = 'MOOD-7K3P-Q9XA-2M4D'
const devTest = (path: string, body: unknown) => {
  if (!import.meta.env.DEV) return null
  const b = (body || {}) as { key?: string }
  const k = String(b.key || '').toUpperCase().replace(/\s/g, '')
  if (k !== DEV_TEST_KEY || !['activate', 'status', 'cancel', 'cancel/undo'].includes(path)) return null
  const next = new Date(Date.now() + 30 * 864e5).toISOString()
  const st = path === 'cancel' ? 'CANCEL_SCHEDULED' : path === 'cancel/undo' ? 'ACTIVE' : (localStorage.getItem('moodeck.devStatus') || 'ACTIVE')
  try {
    localStorage.setItem('moodeck.devStatus', st)
  }
  catch { /* 무시 */ }
  return { active: true, reason: 'OK', status: st, nextBillingAt: next, email: 'te***@test.net', card: '테스트 카드', amount: 4900 }
}

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const dev = devTest(path, body)
  if (dev) return dev as T
  const r = await fetch(`${MACODI_API}/deck-billing/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d && (Array.isArray(d.message) ? d.message[0] : d.message)) || '요청을 처리하지 못했어요.')
  return d as T
}

interface Summary { active: boolean; reason: string; status?: string; nextBillingAt?: string; email?: string; card?: string; amount?: number }

// 자동결제가 안 되는 카드 — 토스가 알기 어려운 문구로 내려옴 → 쉬운 안내로
const CARD_ISSUE = /서브몰|안심클릭|ISP|지원하지\s*않는|지원되지\s*않는|사용할\s*수\s*없|등록되지\s*않은|카드사|NOT_SUPPORTED|ISSUER/i
/** 결제 실패 → 확인 버튼이 있는 안내창(토스 창에서 돌아온 뒤) */
const showFail = (raw: string, fallback: string) => {
  const card = CARD_ISSUE.test(raw)
  subscribeState.failTitle = card ? '이 카드는 자동결제(구독)에 쓸 수 없어요' : '구독을 시작하지 못했어요'
  subscribeState.failMsg = card
    ? '카드사 사정으로 자동결제(정기결제)가 지원되지 않는 카드일 수 있어요. 다른 카드로 다시 시도해 주세요.'
    : (raw || fallback)
  subscribeState.mode = 'failed'
}

const apply = (s: Summary) => {
  const wasActive = subscribeState.active
  subscribeState.active = !!s.active
  subscribeState.status = s.status || ''
  subscribeState.nextBillingAt = s.nextBillingAt || ''
  subscribeState.email = s.email || ''
  subscribeState.card = s.card || ''
  if (s.amount) subscribeState.amount = s.amount
  if (s.reason === 'REPLACED') {
    // 다른 PC가 이 키를 가져감 → 이 PC는 즉시 비활성화(키도 지움)
    subscribeState.key = ''
    write(KEY_STORE, '')
    if (wasActive) subscribeState.notice = '다른 PC에서 활성화 키를 입력해 이 PC의 구독이 비활성화되었어요.'
  }
  if (s.reason === 'NOT_FOUND' || s.reason === 'ENDED') {
    if (s.reason === 'ENDED' && wasActive) subscribeState.notice = '구독 기간이 끝났어요.'
  }
}

/** 서버에 지금 상태 확인 */
export const refreshStatus = async () => {
  if (!subscribeState.key) {
    subscribeState.active = false
    return false
  }
  try {
    apply(await post<Summary>('status', { key: subscribeState.key, deviceId }))
  }
  catch { /* 연결 실패 = 마지막 상태 유지 */ }
  return subscribeState.active
}

/** 구독 없이 마감재 담기 무료 체험 — 이 브라우저에서 1개까지 */
const FREE_INSERT_STORE = 'moodeck.freeInserts'
export const FREE_INSERT_LIMIT = 1
export const freeInsertsLeft = () => Math.max(0, FREE_INSERT_LIMIT - (Number(read(FREE_INSERT_STORE)) || 0))
const useFreeInsert = () => write(FREE_INSERT_STORE, String((Number(read(FREE_INSERT_STORE)) || 0) + 1))

/** 담기·새 프로젝트 직전 — 서버로 바로 확인하고, 아니면 구독 팝업(담기는 무료 1개까지 먼저 허용) */
export const ensureSubscribed = async (reason: 'new' | 'insert') => {
  if (subscribeState.key && await refreshStatus()) return true
  if (reason === 'insert' && freeInsertsLeft() > 0) {
    useFreeInsert()
    subscribeState.notice = ''
    subscribeState.freeUsedNotice = true
    return true
  }
  subscribeState.reason = reason
  subscribeState.mode = 'plan'
  return false
}

/** 다른 PC에서 키 입력 → 이 PC 활성화(예전 PC는 즉시 꺼짐) */
export const activateKey = async (key: string) => {
  const s = await post<Summary>('activate', { key, deviceId })
  subscribeState.key = key.trim().toUpperCase()
  write(KEY_STORE, subscribeState.key)
  apply(s)
  return s
}

/** 1) 이메일·동의 → 결제 준비 → 토스 카드 등록창(리다이렉트) */
export const startBilling = async (email: string) => {
  const clientKey = import.meta.env.VITE_TOSS_BILLING_CLIENT_KEY as string | undefined
  if (!clientKey) throw new Error('결제 설정(VITE_TOSS_BILLING_CLIENT_KEY)이 없어요.')
  const prep = await post<{ customerKey: string; email: string }>('prepare', { email, agreeAuto: true, agreeTerms: true })
  await loadToss()
  const toss = (window as unknown as { TossPayments: (k: string) => { payment: (o: { customerKey: string }) => { requestBillingAuth: (o: Record<string, string>) => Promise<void> } } }).TossPayments(clientKey)
  const base = `${location.origin}${location.pathname}`
  await toss.payment({ customerKey: prep.customerKey }).requestBillingAuth({
    method: 'CARD',
    successUrl: `${base}?billing=success`,
    failUrl: `${base}?billing=fail`,
    customerEmail: prep.email,
  })
}

/** 2) 카드 등록 후 돌아왔을 때(?billing=success&customerKey&authKey) → 첫 결제 + 키 → 안내창 */
export const handleBillingReturn = async () => {
  const q = new URLSearchParams(location.search)
  const flag = q.get('billing')
  if (!flag) return false
  history.replaceState(null, '', location.pathname)
  if (flag === 'fail') {
    if (!/USER_CANCEL|PAY_PROCESS_CANCELED/i.test(q.get('code') || '')) showFail(`${q.get('code') || ''} ${q.get('message') || ''}`.trim(), '카드 등록에 실패했어요.')
    return true
  }
  const customerKey = q.get('customerKey') || ''
  const authKey = q.get('authKey') || ''
  try {
    const r = await post<Summary & { key: string; mailed: boolean }>('confirm', { customerKey, authKey, deviceId })
    subscribeState.key = r.key
    write(KEY_STORE, r.key)
    apply(r)
    subscribeState.issuedKey = r.key
    subscribeState.mailed = r.mailed
    subscribeState.mode = 'success'
  }
  catch (e) {
    showFail((e as Error).message || '', '결제를 완료하지 못했어요.')
  }
  return true
}

export const cancelSubscription = async (undo = false) =>
  apply(await post<Summary>(undo ? 'cancel/undo' : 'cancel', { key: subscribeState.key, deviceId }))

export const resendKey = (email: string) => post<{ ok: boolean }>('resend-key', { email })

let tossLoading: Promise<void> | null = null
const loadToss = () => {
  if ((window as unknown as { TossPayments?: unknown }).TossPayments) return Promise.resolve()
  tossLoading ||= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.tosspayments.com/v2/standard'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('결제 모듈을 불러오지 못했어요.'))
    document.head.appendChild(s)
  })
  return tossLoading
}

/** 앱 시작 시 1번 — 상태 확인 + 30초마다·창으로 돌아올 때 다시 확인 */
export const startSubscriptionWatch = () => {
  void refreshStatus()
  setInterval(() => {
    if (document.visibilityState === 'visible' && subscribeState.key) void refreshStatus()
  }, 30_000)
  const again = () => {
    if (document.visibilityState === 'visible' && subscribeState.key) void refreshStatus()
  }
  document.addEventListener('visibilitychange', again)
  window.addEventListener('focus', again)
}
