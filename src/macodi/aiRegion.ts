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
import { avoidJoints, boxStroke, shadeColor } from './shade'

const SHADE_FIX = false // 그늘 보정 대표색 사용 여부(정답지 평균 비교 전까지 끔)

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
  post: null as null | { rgb_r: number; rgb_g: number; rgb_b: number; cropdata: string; purpose: string; hex: string },
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
  prefetch = null
  Object.assign(ai, {
    active: false, img: null, msg: '',
    box: null, post: null, paused: false, others: [], results: [], demo: null, searching: false, page: 1, hasMore: false,
  })
}

/* ---- 공간 인식(화면엔 안 보임) — AI 서버 /productai/regions 가 슬라이드를 바닥·벽·천장으로 나눔.
 *  ① 시범 선은 창·하늘·가구가 아니라 바닥·벽·천장 면 위에 그린다
 *  ② 사용자가 잡은 박스가 주로 어느 면인지 보고 그 용도(purpose)로 추천을 좁힌다
 *  서버가 없거나 실패하면 예전 방식(색 덩어리 시범 + 용도 없이 검색) 그대로. */
interface SceneRegion { purpose: string; area: number; polygon: [number, number][]; box: [number, number, number, number]; flat?: boolean }
const PURPOSES = ['floor', 'wall', 'ceiling']
let regionCache: { key: string; list: Promise<SceneRegion[]> } | null = null
const imgKey = (im: HTMLImageElement) => `${im.src.length}:${im.src.slice(300, 400)}:${im.src.slice(-120)}`
// AI 서버는 518px 로 줄여 분석 → 640px 면 충분(전송·처리 빨라짐, 결과 같음)
const toJpegData = (im: HTMLImageElement, max = 640) => {
  const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(im.naturalWidth * k))
  c.height = Math.max(1, Math.round(im.naturalHeight * k))
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.88)
}
const analyzeRegions = (im: HTMLImageElement): Promise<SceneRegion[]> => {
  const key = imgKey(im)
  if (regionCache?.key === key) return regionCache.list
  const call = postJson<{ regions?: SceneRegion[] } & SceneCues>(AI_URL + '/productai/regions', { image: toJpegData(im) })
    .then(r => {
      const regs = (r.regions || []).filter(x => PURPOSES.includes(x.purpose) && x.box && x.polygon?.length > 2)
      return isScene(regs, r) ? regs : [] // 자재 사진·아이소메트릭·평면도·보드 등 = 공간 인식 안 씀(예전 방식)
    })
  const timeout = new Promise<SceneRegion[]>(res => setTimeout(() => res([]), 8000))
  const list = Promise.race([call, timeout]).catch(() => [] as SceneRegion[])
  regionCache = { key, list }
  return list
}

/** 눈높이 투시도인지 — 분할 모델은 눈높이 사진으로 배워서 그 밖(자재 사진·아이소메트릭·평면도·보드)에선
 *  면을 '찍어서' 판단해 틀린다(천장 무늬 → 벽, 아이소메트릭 검은 배경 → 벽 등). 그때는 쓰지 않는다.
 *   · 실내: 천장 10% 이상 + 바닥·벽·천장 중 두 가지 이상이 각각 10% 이상
 *   · 외관: 건물 외벽 30% 이상 + 하늘 5% 이상 또는 바닥(보도) 10% 이상
 *  (2026-10-25 샘플 12쪽: 실내 3·5~9쪽·외관 11·12쪽 통과 / 아이소메트릭 4·보드 10·목차 1·항공지도 2쪽·자재 사진 제외) */
interface SceneCues { sky?: number; ceiling?: number; building?: number; frame?: number }
const isScene = (regs: SceneRegion[], c: SceneCues) => {
  // 둘레가 단색 배경(콜라주·보드·아이소메트릭 슬라이드) — 슬라이드 배경을 천장·바닥으로 잘못 봄 → 예전 방식
  if ((c.frame || 0) >= 0.6) return false
  const share: Record<string, number> = {}
  for (const r of regs) share[r.purpose] = (share[r.purpose] || 0) + r.area
  const n10 = Object.values(share).filter(v => v >= 0.1).length
  const interior = (c.ceiling || 0) >= 0.1 && n10 >= 2
  const exterior = (c.building || 0) >= 0.3 && ((c.sky || 0) >= 0.05 || (share.floor || 0) >= 0.1)
  return interior || exterior
}

// 시범 후보 제한 — 바닥·벽·천장 영역(다각형)을 W×H 격자에 칠한 마스크(1 = 마감 면). 창·하늘·가구·겹친 그림은 0
const finishMask = (regs: SceneRegion[]) => (W: number, H: number) => {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#000'
  for (const r of regs) {
    g.beginPath()
    r.polygon.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)))
    g.closePath()
    g.fill()
  }
  const d = g.getImageData(0, 0, W, H).data
  const m = new Uint8Array(W * H)
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 0 ? 1 : 0
  return m
}
// 박스 안을 가장 많이 차지하는 면(바닥/벽/천장) — 35% 이상일 때만 그 용도로 좁힘
const purposeOf = (regs: SceneRegion[], b: SrcBox) => {
  if (!regs.length) return ''
  const G = 200
  const c = document.createElement('canvas')
  c.width = G
  c.height = G
  const g = c.getContext('2d', { willReadFrequently: true })!
  const bx = Math.max(0, Math.floor(b.x * G)), by = Math.max(0, Math.floor(b.y * G))
  const bw = Math.max(1, Math.min(G - bx, Math.ceil(b.w * G))), bh = Math.max(1, Math.min(G - by, Math.ceil(b.h * G)))
  let best = '', bestFrac = 0
  for (const part of PURPOSES) {
    const polys = regs.filter(r => r.purpose === part)
    if (!polys.length) continue
    g.clearRect(0, 0, G, G)
    g.fillStyle = '#000'
    for (const r of polys) {
      g.beginPath()
      r.polygon.forEach(([x, y], i) => (i ? g.lineTo(x * G, y * G) : g.moveTo(x * G, y * G)))
      g.closePath()
      g.fill()
    }
    const d = g.getImageData(bx, by, bw, bh).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
    const frac = n / (bw * bh)
    if (frac > bestFrac) {
      bestFrac = frac
      best = part
    }
  }
  return bestFrac >= 0.35 ? best : ''
}

/** 미리 준비 — AI 버튼에 마우스를 올리면 슬라이드 캡처·영역 분석을 먼저 시작(클릭할 때 기다림 줄이기). 실패는 무시 */
export const prewarm = () => {
  if (ai.active && !ai.paused) return
  capture().then(im => analyzeRegions(im)).catch(() => undefined)
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
    // 시범 = 예전 색 덩어리 방식(면 하나를 깔끔하게 잡음) + 공간 사진이면 바닥·벽·천장 위 덩어리만 후보
    const regs = await analyzeRegions(im)
    if (!ai.active || my !== reqId) return
    let stroke = (regs.length && demoStroke(im, finishMask(regs))) || demoStroke(im)
    if (!stroke) return
    // 줄눈 피하기 — 시범 박스 안에 곧은 줄눈이 있으면 줄눈 사이 가장 넓은 칸으로 줄임(shade.ts)
    let x1 = 1, y1 = 1, x2 = 0, y2 = 0
    for (const [x, y] of stroke) {
      x1 = Math.min(x1, x)
      y1 = Math.min(y1, y)
      x2 = Math.max(x2, x)
      y2 = Math.max(y2, y)
    }
    const b0 = { x: Math.max(0, x1), y: Math.max(0, y1), w: Math.min(1, x2) - Math.max(0, x1), h: Math.min(1, y2) - Math.max(0, y1) }
    const jb = b0.w > 0 && b0.h > 0 ? avoidJoints(im, b0) : b0
    if (jb !== b0) stroke = boxStroke(jb)
    ai.demo = stroke
    // 시범 선을 그리는 동안 추천 검색을 미리 시작(방금 찍은 슬라이드 그대로) — 선이 끝나면 결과가 이미 와 있게
    const pb = strokeBox(stroke)
    if (pb) {
      prefetch = { box: pb, at: Date.now() }
      searchBox(pb, purposeOf(regs, pb), false)
    }
  }
  catch { /* 시범 생략 */ }
}

// 선 → 바깥 사각형(0~1). 너무 작으면 null
const strokeBox = (stroke: [number, number][]): SrcBox | null => {
  let x1 = 1, y1 = 1, x2 = 0, y2 = 0
  for (const [x, y] of stroke) {
    x1 = Math.min(x1, x)
    y1 = Math.min(y1, y)
    x2 = Math.max(x2, x)
    y2 = Math.max(y2, y)
  }
  return x2 - x1 < 0.01 || y2 - y1 < 0.01 ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
// 시범 중 미리 시작한 검색 — 선이 끝나 같은 박스로 검색을 부르면 다시 찍거나 다시 검색하지 않음
let prefetch: { box: SrcBox; at: number } | null = null

/** 손으로 그린 선(슬라이드 기준 0~1) → 그 바깥 사각형(라운드 박스)으로 검색 — 웹 onDrawEnd 와 같음 */
export const searchStroke = async (stroke: [number, number][]) => {
  ai.demo = null
  ai.msg = ''
  const b = strokeBox(stroke)
  if (!b) {
    ai.msg = '영역이 너무 작아요. 조금 더 크게 그려주세요.'
    return
  }
  await searchArea(b)
}

/** 박스 영역 검색 — 그릴 때·박스를 옮기거나 키운 뒤 놓을 때. 슬라이드는 매번 새로 찍는다(내용이 바뀌었을 수 있음) */
export const searchArea = async (b: SrcBox) => {
  const p = prefetch
  prefetch = null
  if (p && Date.now() - p.at < 10000 && ['x', 'y', 'w', 'h'].every(k => Math.abs(p.box[k as keyof SrcBox] - b[k as keyof SrcBox]) < 1e-9)) {
    ai.box = b // 시범 박스 — 검색은 이미 진행 중
    return
  }
  ai.box = b
  const my = ++reqId
  try {
    const im = await capture()
    if (my !== reqId || !ai.active) return
    ai.img = im
    const regs = await analyzeRegions(im)
    if (my !== reqId || !ai.active) return
    searchBox(b, purposeOf(regs, b))
  }
  catch {
    if (my === reqId) ai.msg = '슬라이드를 읽지 못했어요. 외부 주소 그림이 있으면 다시 넣어 주세요.'
  }
}

const searchBox = (b: SrcBox, purpose = '', show = true) => {
  const im = ai.img
  if (!im) return
  if (show) ai.box = b // 시범 미리 검색이면 박스는 선이 끝난 뒤에 보임
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
  // 대표색 = 그늘 보정색(렌더는 카탈로그보다 어둡게 나옴 — shade.ts 실측) → AI 서버 색 재정렬에 그대로 사용.
  //  ⚠️ SHADE_FIX=false 동안은 hex 를 보내지 않음 = 그전 방식(AI 서버가 크롭에서 직접 대표색 측정). 평균 비교 끝나면 결정
  const { rgb, hex } = shadeColor(c)
  ai.post = {
    rgb_r: rgb[0], rgb_g: rgb[1], rgb_b: rgb[2],
    cropdata: c.toDataURL('image/png'), // ⚠️ AI 서버는 PNG 접두사만 벗긴다
    purpose, // floor|wall|ceiling — 그 용도 자재로 좁힘('' = 전체)
    hex: SHADE_FIX ? hex : '',
  }
  search(1)
}

const fetchPage = (page: number) => postJson<unknown>(AI_URL + '/productai', {
  rgb_r: ai.post!.rgb_r, rgb_g: ai.post!.rgb_g, rgb_b: ai.post!.rgb_b,
  page, categories: [], companyName: '',
  cropdata: ai.post!.cropdata, txtSearch: '', isRandom: 0, storeName: '',
  purpose: ai.post!.purpose,
  hex: ai.post!.hex,
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
