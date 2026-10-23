/**
 * 그림 서식(PPT '그림 형식' 대응) — 수정·색·꾸밈 효과 프리셋, 투명한 색 설정, 내보낼 때 효과 굽기
 *  효과는 CSS filter(ImageElementFilters)로 저장 → 화면·PDF 는 그대로, PPTX 는 내보낼 때 그림에 직접 입힘
 */
import { reactive } from 'vue'
import type { ImageElementFilters, PPTImageElement, Slide } from '@/types/slides'

/* ---------- 선명도·색 온도용 SVG 필터(ImageFilterDefs.vue 가 문서에 한 번 깔아 둠) ---------- */
export const SHARP_STEPS = Array.from({ length: 10 }, (_, i) => (i + 1) * 10) // 10~100
export const TEMP_STEPS = Array.from({ length: 21 }, (_, i) => 1500 + i * 500) // 1500~11500
export const sharpId = (s: number) => `mcd-sharp-${s}`
export const tempId = (t: number) => `mcd-temp-${t}`
/** 선명화 커널 — 가운데 강조(세기 k: 0~1) */
export const sharpKernel = (s: number) => {
  const k = s / 100
  return `0 ${-k} 0 ${-k} ${1 + 4 * k} ${-k} 0 ${-k} 0`
}
/** 색 온도 행렬 — 6500K 기준, 높으면 따뜻하게(주황), 낮으면 차갑게(파랑). PPT 온도와 같은 방향 */
export const tempMatrix = (t: number) => {
  const w = (t - 6500) / 5000 // -1 ~ 1
  const r = 1 + 0.22 * w, g = 1 + 0.04 * w, b = 1 - 0.28 * w
  return `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`
}
const nearest = (v: number, steps: number[]) => steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))

export const filtersToCss = (f?: ImageElementFilters) => {
  if (!f) return ''
  const out: string[] = []
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === '') continue
    if (k === 'sharp') {
      const s = parseFloat(v)
      if (s > 0) out.push(`url(#${sharpId(nearest(s, SHARP_STEPS))})`)
    }
    else if (k === 'temp') {
      const t = parseFloat(v)
      if (t && t !== 6500) out.push(`url(#${tempId(nearest(t, TEMP_STEPS))})`)
    }
    else out.push(`${k}(${v})`)
  }
  return out.join(' ')
}

/* ---------- 프리셋 ---------- */
export interface Preset { label: string; values: ImageElementFilters }

// 수정: 밝기 × 대비 (PPT 처럼 5×5)
const STEPS = [-40, -20, 0, 20, 40]
export const correctionPresets: Preset[] = STEPS.flatMap(c => STEPS.map(b => ({
  label: `밝기 ${b > 0 ? '+' : ''}${b}% 대비 ${c > 0 ? '+' : ''}${c}%`,
  values: { brightness: `${100 + b}%`, contrast: `${100 + c}%` },
})))

// 색: 채도
export const saturationPresets: Preset[] = [0, 33, 66, 100, 200, 300, 400].map(s => ({
  label: `채도 ${s}%`, values: { saturate: `${s}%` },
}))

// 색: 다시 칠하기 — 회색조→세피아(약 38°)→색상 회전으로 단색 물들이기(투명 부분은 그대로)
const tint = (hue: number, light = 100): ImageElementFilters => ({
  'grayscale': '100%', 'sepia': '100%', 'hue-rotate': `${hue - 38}deg`, 'saturate': '250%', 'brightness': `${light}%`,
})
const TINTS: [string, number][] = [['파랑', 215], ['빨강', 0], ['초록', 130], ['보라', 275], ['청록', 180], ['주황', 28], ['금색', 48]]
export const recolorPresets: Preset[] = [
  { label: '다시 칠하기 없음', values: {} },
  { label: '회색조', values: { grayscale: '100%' } },
  { label: '세피아', values: { sepia: '100%' } },
  { label: '흑백 75%', values: { grayscale: '100%', contrast: '300%', brightness: '110%' } },
  { label: '워시아웃', values: { brightness: '150%', contrast: '50%', saturate: '50%' } },
  ...TINTS.map(([n, h]) => ({ label: `${n} 어둡게`, values: tint(h, 75) })),
  ...TINTS.map(([n, h]) => ({ label: `${n} 밝게`, values: tint(h, 140) })),
]

// 꾸밈 효과
export const artisticPresets: Preset[] = [
  { label: '없음', values: {} },
  { label: '흐리게', values: { blur: '2px' } },
  { label: '더 흐리게', values: { blur: '5px' } },
  { label: '연필 스케치', values: { grayscale: '100%', contrast: '220%', brightness: '120%' } },
  { label: '빛바램', values: { contrast: '75%', brightness: '115%', saturate: '70%' } },
  { label: '필름', values: { sepia: '40%', contrast: '120%', brightness: '95%' } },
  { label: '강렬하게', values: { contrast: '140%', saturate: '170%' } },
  { label: '포스터', values: { contrast: '300%', saturate: '200%' } },
  { label: '반전', values: { invert: '100%' } },
  { label: '네거티브 흑백', values: { invert: '100%', grayscale: '100%' } },
]

/* ---------- 투명한 색 설정 ---------- */

const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image()
  if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
})

/** 그림의 (nx, ny)(0~1) 픽셀과 비슷한 색을 모두 투명하게 — PNG dataURL */
export const makeColorTransparent = async (src: string, nx: number, ny: number, tolerance = 36) => {
  const img = await loadImg(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, W, H)
  const d = data.data
  const px = Math.min(W - 1, Math.max(0, Math.floor(nx * W)))
  const py = Math.min(H - 1, Math.max(0, Math.floor(ny * H)))
  const o = (py * W + px) * 4
  const [r0, g0, b0] = [d[o], d[o + 1], d[o + 2]]
  const soft = tolerance * 1.5 // 경계는 살짝 부드럽게
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - r0, d[i + 1] - g0, d[i + 2] - b0)
    if (dist <= tolerance) d[i + 3] = 0
    else if (dist < soft) d[i + 3] = Math.min(d[i + 3], Math.round(255 * (dist - tolerance) / (soft - tolerance)))
  }
  g.putImageData(data, 0, 0)
  return c.toDataURL('image/png')
}

/** 투명한 색 고르기 모드(그림 위를 클릭하면 그 색이 투명해짐) */
export const transparentPick = reactive({ active: false, elementId: '' })

/** 화면에서 클릭한 위치 → 원본 그림 좌표(0~1). 자르기·뒤집기 반영 */
export const toImageCoord = (el: PPTImageElement, rx: number, ry: number) => {
  if (el.flipH) rx = 1 - rx
  if (el.flipV) ry = 1 - ry
  if (el.clip) {
    const [[x1, y1], [x2, y2]] = el.clip.range
    rx = (x1 + rx * (x2 - x1)) / 100
    ry = (y1 + ry * (y2 - y1)) / 100
  }
  return [rx, ry] as const
}

/* ---------- PPTX 내보내기: 효과를 그림에 굽기 ---------- */

const hasVisualFilter = (f?: ImageElementFilters) =>
  !!f && Object.entries(f).some(([k, v]) => k !== 'opacity' && v !== undefined && v !== '')

const bakeOne = async (el: PPTImageElement): Promise<PPTImageElement> => {
  try {
    const img = await loadImg(el.src)
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    const f = { ...(el.filters || {}) }
    delete f.opacity
    // 흐림 정도는 화면 크기 기준 → 원본 해상도에 맞춰 키움
    if (f.blur) f.blur = `${parseFloat(f.blur) * (W / Math.max(1, el.width))}px`
    g.filter = filtersToCss(f) || 'none'
    g.drawImage(img, 0, 0)
    g.filter = 'none'
    if (el.colorMask) {
      g.fillStyle = el.colorMask
      g.fillRect(0, 0, W, H)
    }
    const filters = el.filters?.opacity ? { opacity: el.filters.opacity } : undefined
    return { ...el, src: c.toDataURL('image/png'), filters, colorMask: undefined }
  }
  catch {
    return el
  }
}

/** 효과가 있는 그림만 효과를 입힌 그림으로 바꾼 슬라이드 사본 */
export const bakeImageEffects = async (slides: Slide[]): Promise<Slide[]> => {
  const need = slides.some(s => s.elements.some(e => e.type === 'image' && (hasVisualFilter(e.filters) || e.colorMask)))
  if (!need) return slides
  return Promise.all(slides.map(async s => ({
    ...s,
    elements: await Promise.all(s.elements.map(e =>
      e.type === 'image' && (hasVisualFilter(e.filters) || e.colorMask) ? bakeOne(e) : Promise.resolve(e))),
  })))
}
