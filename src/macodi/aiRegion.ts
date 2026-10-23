/**
 * 캔버스 안 AI 검색 (PPT 애드인 aisearch 의 웹 PPT 판) — 대상은 "현재 슬라이드 화면 전체"
 *  - [AI 영역 검색] = 슬라이드 어디든 손으로 둘러 그리면(스마트 올가미) 실제 경계에 붙은 다각형 영역으로 검색.
 *    버튼을 누를 때마다 시범(튜토리얼) 선이 자동으로 그려진다(그리는 중에 직접 그리면 시범은 멈춤).
 *    ([AI 자동 검색]은 사용자 결정으로 제거 — 2026-10-22)
 *  - 슬라이드는 검색할 때마다 한 장으로 찍는다(AiRegionLayer 가 등록한 capturer, 편집 표시 없이 내용만)
 *  - 결과는 마코디 탭에, 카드 클릭 = 스펙 카드 삽입 + 선택 기록(platform 'deck')
 *    ("비슷한 공간에서 실제로 쓰인 자재" 줄은 웹 PPT 에선 쓰지 않음 — 사용자 결정 2026-10-22)
 * 좌표는 모두 "슬라이드 기준 0~1".
 */
import { reactive } from 'vue'
import { AI_URL, type MacodiProduct, toCdn } from './api'
import { demoStroke, lassoRegion } from './colorRegions'

export interface AiRegion {
  label: string
  purpose?: string
  hex?: string
  box: [number, number, number, number]   // 슬라이드 기준 0~1 — 검색에 쓰는 영역 안 가장 큰 사각형
  loops: [number, number][][]             // 슬라이드 기준 0~1 — 윤곽(바깥+구멍)
}
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
  demo: null as [number, number][] | null, // 튜토리얼 시범 선(레이어가 그려 보인 뒤 searchLasso)
  img: null as HTMLImageElement | null,
  msg: '',
  regions: [] as AiRegion[],
  activeLabel: null as string | null,
  box: null as SrcBox | null,
  meta: null as { purpose?: string; hex?: string } | null,
  post: null as null | { rgb_r: number; rgb_g: number; rgb_b: number; cropdata: string; purpose?: string; hex?: string },
  results: [] as MacodiProduct[],
  searching: false,
  page: 1,
  hasMore: false,
})

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
    active: false, img: null, msg: '', regions: [], activeLabel: null,
    box: null, meta: null, post: null, results: [], demo: null, searching: false, page: 1, hasMore: false,
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

/** 스마트 올가미 — 손으로 그린 선(슬라이드 기준 0~1) → 실제 경계에 붙은 다각형 영역으로 검색 */
export const searchLasso = async (stroke: [number, number][]) => {
  ai.demo = null
  ai.msg = ''
  const my = ++reqId
  try {
    const im = await capture()
    if (my !== reqId || !ai.active) return
    ai.img = im
    const r = lassoRegion(im, stroke)
    if (!r) {
      ai.msg = '영역을 잡지 못했어요. 조금 더 크게 둘러 그려주세요.'
      return
    }
    ai.regions = [r]
    pickRegion(r)
  }
  catch {
    if (my === reqId) ai.msg = '슬라이드를 읽지 못했어요. 외부 주소 그림이 있으면 다시 넣어 주세요.'
  }
}

/** 영역 선택 = 그 영역 안 가장 큰 사각형을 잘라 그 영역 색과 함께 검색 */
const pickRegion = (r: AiRegion) => {
  ai.activeLabel = r.label
  ai.meta = { purpose: r.purpose, hex: r.hex }
  searchBox({ x: r.box[0], y: r.box[1], w: r.box[2] - r.box[0], h: r.box[3] - r.box[1] }, true)
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

const searchBox = (b: SrcBox, fromRegion: boolean) => {
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
    purpose: fromRegion ? ai.meta?.purpose : undefined,
    hex: fromRegion ? ai.meta?.hex : undefined,
  }
  search(1)
}

/** /productai (웹 modalProduct.runImgSearch 와 같은 본문) */
export const search = (page: number) => {
  if (!ai.post) return
  const my = ++reqId
  ai.searching = true
  ai.page = page
  if (page === 1) ai.results = []
  postJson<unknown>(AI_URL + '/productai', {
    rgb_r: ai.post.rgb_r, rgb_g: ai.post.rgb_g, rgb_b: ai.post.rgb_b,
    page, categories: [], companyName: '',
    cropdata: ai.post.cropdata, txtSearch: '', isRandom: 0, storeName: '',
    purpose: ai.post.purpose || undefined, hex: ai.post.hex || undefined,
  })
    .then(raw => {
      if (my !== reqId) return
      const r = raw as { data?: MacodiProduct[]; products?: MacodiProduct[]; results?: MacodiProduct[] } | MacodiProduct[] | null
      const arr: MacodiProduct[] = Array.isArray(r) ? r : (r?.data || r?.products || r?.results || [])
      const seen = new Set(ai.results.map(p => p.id))
      const list = arr.filter(p => p && typeof p.id === 'number' && !seen.has(p.id) && seen.add(p.id))
      ai.results = page === 1 ? list : ai.results.concat(list)
      ai.hasMore = arr.length >= ITEMS_PER_PAGE
    })
    .catch(() => {
      if (my !== reqId) return
      ai.hasMore = false
      ai.msg = 'AI 검색에 실패했어요. AI 서버 상태를 확인해 주세요.'
    })
    .finally(() => {
      if (my === reqId) ai.searching = false
    })
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
      cropdata: c.toDataURL('image/jpeg', 0.85), productId, purpose: ai.post?.purpose || '', platform: 'deck',
    })
  }).catch(() => { /* 무시 */ })
}

export const thumbOf = (p: MacodiProduct) => toCdn(p.flatImg || p.img, 400)
