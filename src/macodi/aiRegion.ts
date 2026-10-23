/**
 * 캔버스 안 AI 검색 (PPT 애드인 aisearch 의 웹 PPT 판) — 대상은 "현재 슬라이드 화면 전체"
 *  - [AI 영역 검색] = 마코디 웹 AI 영역 검색과 같은 방식: 손으로 그린 궤적의 바깥 사각형이 라운드 박스가 되고
 *    그 박스 안을 잘라 검색. 박스는 모서리로 크기 조절·안쪽 잡고 이동 → 놓으면 다시 검색.
 *    버튼을 누를 때마다 시범(튜토리얼) 선이 자동으로 그려진다(그리는 중에 직접 그리면 시범은 멈춤).
 *    ([AI 자동 검색]은 사용자 결정으로 제거 — 2026-10-22)
 *  - 슬라이드는 검색할 때마다 한 장으로 찍는다(AiRegionLayer 가 등록한 capturer, 편집 표시 없이 내용만)
 *  - 결과는 마코디 탭에, 카드 클릭 = 스펙 카드 삽입 + 선택 기록(platform 'deck')
 *    ("비슷한 공간에서 실제로 쓰인 자재" 줄은 웹 PPT 에선 쓰지 않음 — 사용자 결정 2026-10-22)
 * 좌표는 모두 "슬라이드 기준 0~1".
 */
import { reactive } from 'vue'
import { AI_URL, type MacodiProduct, toCdn } from './api'
import { demoStroke } from './colorRegions'

export interface SrcBox { x: number; y: number; w: number; h: number } // 슬라이드 기준 0~1

// 현재 슬라이드를 한 장으로 찍는 함수 — AiRegionLayer 가 등록
let capturer: null | (() => Promise<HTMLImageElement>) = null
export const setCapturer = (fn: typeof capturer) => {
  capturer = fn
}
const capture = () => {
  if (!capturer) return Promise.reject(new Error('캔버스가 준비되지 않았어요.'))
  return capturer()
}

const CROP_MAX_OUT = 512 // 웹 drawPreview MAX_OUT
const ITEMS_PER_PAGE = 30

export const ai = reactive({
  active: false,
  demo: null as [number, number][] | null, // 튜토리얼 시범 선(레이어가 그려 보인 뒤 그 박스로 검색)
  img: null as HTMLImageElement | null,
  msg: '',
  box: null as SrcBox | null,
  post: null as null | { rgb_r: number; rgb_g: number; rgb_b: number; cropdata: string },
  results: [] as MacodiProduct[],
  searching: false,
  page: 1,
  hasMore: false,
  /** 키워드가 있을 때, 키워드는 안 맞지만 비슷한 자재(목록 아래쪽에 이어서) */
  others: [] as MacodiProduct[],
  /** 추천 자재를 캔버스에 넣은 뒤 = 캔버스의 영역 표시는 끄고 추천 목록(순서·스크롤)은 그대로 둔 상태 */
  paused: false,
  /** 키워드 칩 — AI 영역 검색 결과도 모든 키워드를 포함한 것만(AND). 패널이 맞춰 줌 */
  keywords: [] as string[],
})

// 키워드 AND — 띄어쓰기 무시(노출콘크리트 = 노출 콘크리트), 대소문자 무시
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
const matchesKeywords = (p: MacodiProduct, kws: string[]) => {
  if (!kws.length) return true
  const hay = norm([p.name, p.brand, p.store, p.companyName, p.category, p.subCategory, p.series].filter(Boolean).join(' '))
  return kws.every(k => hay.includes(norm(k)))
}
const MIN_FILL = 12 // 키워드로 걸러 한 번에 이만큼은 보여 주려고
const MAX_PAGES = 6 // 서버 페이지를 최대 이만큼 더 받아 본다

let reqId = 0

const postJson = <T>(url: string, body: unknown): Promise<T> =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json() as Promise<T>
    })

export const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const im = new Image()
  if (!src.startsWith('data:')) im.crossOrigin = 'anonymous'
  im.onload = () => resolve(im)
  im.onerror = () => reject(new Error('그림을 읽지 못했어요.'))
  im.src = src
})

export const stopAi = () => {
  reqId++
  Object.assign(ai, {
    active: false, img: null, msg: '',
    box: null, post: null, paused: false, others: [], results: [], demo: null, searching: false, page: 1, hasMore: false,
  })
}

/** [AI 영역 검색] — 슬라이드 위 어디든 둘러 그려서 검색. 누를 때마다 시범 선을 보여준다 */
export const startManual = async () => {
  stopAi()
  ai.active = true
  const my = reqId
  try {
    const im = await capture()
    if (!ai.active || my !== reqId) return
    ai.img = im
    const stroke = demoStroke(im)
    if (!stroke) return
    ai.demo = stroke
  }
  catch { /* 시범 생략 */ }
}

/** 손으로 그린 선(슬라이드 기준 0~1) → 그 바깥 사각형(라운드 박스)으로 검색 — 웹 onDrawEnd 와 같음 */
export const searchStroke = async (stroke: [number, number][]) => {
  ai.demo = null
  ai.msg = ''
  let x1 = 1, y1 = 1, x2 = 0, y2 = 0
  for (const [x, y] of stroke) {
    x1 = Math.min(x1, x)
    y1 = Math.min(y1, y)
    x2 = Math.max(x2, x)
    y2 = Math.max(y2, y)
  }
  if (x2 - x1 < 0.01 || y2 - y1 < 0.01) {
    ai.msg = '영역이 너무 작아요. 조금 더 크게 그려주세요.'
    return
  }
  await searchArea({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
}

/** 박스 영역 검색 — 그릴 때·박스를 옮기거나 키운 뒤 놓을 때. 슬라이드는 매번 새로 찍는다(내용이 바뀌었을 수 있음) */
export const searchArea = async (b: SrcBox) => {
  ai.box = b
  const my = ++reqId
  try {
    const im = await capture()
    if (my !== reqId || !ai.active) return
    ai.img = im
    searchBox(b)
  }
  catch {
    if (my === reqId) ai.msg = '슬라이드를 읽지 못했어요. 외부 주소 그림이 있으면 다시 넣어 주세요.'
  }
}

// 웹 getColorFromImage — 64px 다운샘플, 알파 16 미만 제외 평균
const avgColor = (canvas: HTMLCanvasElement) => {
  const w = Math.min(64, canvas.width), h = Math.min(64, canvas.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
    n++
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0]
}

const searchBox = (b: SrcBox) => {
  const im = ai.img
  if (!im) return
  ai.box = b
  const srcW = b.w * im.naturalWidth, srcH = b.h * im.naturalHeight
  const out = Math.min(1, CROP_MAX_OUT / Math.max(srcW, srcH, 1))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(srcW * out))
  c.height = Math.max(1, Math.round(srcH * out))
  try {
    c.getContext('2d')!.drawImage(im, b.x * im.naturalWidth, b.y * im.naturalHeight, srcW, srcH, 0, 0, c.width, c.height)
  }
  catch {
    return
  }
  const rgb = avgColor(c)
  ai.post = {
    rgb_r: rgb[0], rgb_g: rgb[1], rgb_b: rgb[2],
    cropdata: c.toDataURL('image/png'), // ⚠️ AI 서버는 PNG 접두사만 벗긴다
  }
  search(1)
}

const fetchPage = (page: number) => postJson<unknown>(AI_URL + '/productai', {
  rgb_r: ai.post!.rgb_r, rgb_g: ai.post!.rgb_g, rgb_b: ai.post!.rgb_b,
  page, categories: [], companyName: '',
  cropdata: ai.post!.cropdata, txtSearch: '', isRandom: 0, storeName: '',
}).then(raw => {
  const r = raw as { data?: MacodiProduct[]; products?: MacodiProduct[]; results?: MacodiProduct[] } | MacodiProduct[] | null
  return Array.isArray(r) ? r : (r?.data || r?.products || r?.results || [])
})

/** /productai (웹 modalProduct.runImgSearch 와 같은 본문) + 키워드 AND.
 *  키워드를 모두 포함한 자재(results)를 먼저, 나머지 비슷한 자재(others)는 그 아래에 — 결과가 '없음'으로 끝나지 않고
 *  스크롤하면 계속 이어짐. 비슷한 순서는 서버 순서 그대로 */
export const search = async (page: number) => {
  if (!ai.post) return
  const my = ++reqId
  ai.searching = true
  if (page === 1) {
    ai.results = []
    ai.others = []
    ai.msg = ''
  }
  const kws = [...ai.keywords]
  const seen = new Set([...ai.results, ...ai.others].map(p => p.id))
  try {
    let p = page, more = true, added = 0
    // 첫 화면이 비지 않게 — 키워드에 맞는 게 적으면 몇 페이지 더 받아 맞는 것부터 채움
    for (let n = 0; n < (page === 1 && kws.length ? MAX_PAGES : 1) && more; n++, p++) {
      const arr = await fetchPage(p)
      if (my !== reqId) return
      more = arr.length >= ITEMS_PER_PAGE
      const fresh = arr.filter(x => x && typeof x.id === 'number' && !seen.has(x.id) && seen.add(x.id))
      const hit = fresh.filter(x => matchesKeywords(x, kws))
      ai.results = ai.results.concat(hit)
      ai.others = ai.others.concat(fresh.filter(x => !hit.includes(x)))
      added += hit.length
      ai.page = p
      if (added >= MIN_FILL) break
    }
    ai.hasMore = more
  }
  catch {
    if (my !== reqId) return
    ai.hasMore = false
    ai.msg = 'AI 검색에 실패했어요. AI 서버 상태를 확인해 주세요.'
  }
  finally {
    if (my === reqId) ai.searching = false
  }
}

/** 선택 기록 — "이 영역으로 검색해서 이 제품을 넣었다"(특징값만 저장). 실패 무시 */
export const logPick = (productId: number) => {
  const crop = ai.post?.cropdata
  if (!crop || !productId) return
  loadImage(crop).then(im => {
    const sc = Math.min(1, 256 / Math.max(im.naturalWidth, im.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(im.naturalWidth * sc))
    c.height = Math.max(1, Math.round(im.naturalHeight * sc))
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
    return postJson(AI_URL + '/productai/feedback', {
      cropdata: c.toDataURL('image/jpeg', 0.85), productId, purpose: '', platform: 'deck',
    })
  }).catch(() => { /* 무시 */ })
}

export const thumbOf = (p: MacodiProduct) => toCdn(p.flatImg || p.img, 400)
