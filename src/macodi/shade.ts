/**
 * 그늘 보정 대표색 + 줄눈 피하기 — AI 영역 검색 정확도 보강(마코디 웹 features/search/utils/shade.ts 와 같은 코드)
 *
 * 그늘 보정: 렌더 속 면은 조명·그늘 때문에 카탈로그 사진보다 어둡게 나온다 — 단, 이미 밝게 찍힌 면은 그대로다.
 *   실측(2026-10-26, 정렬 ok 씬 60쌍): 렌더 밝기(OKLab L) 0.8 미만은 카탈로그보다 0.19~0.33 어둡고, 0.8 이상은 차이 없음(+0.005).
 *   → 대표색 = 영역 중앙값 색에 밝기 max(0, 0.86 − L) × 1.2 (최대 0.3)만큼 더함. 밝은 면(0.86↑)은 손대지 않는다.
 *   시험: 한솔 클레이포그(그늘진 벽) 104위 → 2위 / 동신포리마 CH-6202(밝은 바닥)는 보정 안 함(밝기 0.86).
 *   (예전 '밝은 쪽 10% + 0.04' 는 이미 밝은 바닥을 더 밝게 만들어 폐기)
 * 줄눈 피하기: 판넬 사이 곧은 줄눈(세로·가로)이 박스에 들어가면 줄눈 있는 타일이 추천에 섞인다 →
 *   자동으로 잡는 박스는 줄눈 사이 가장 넓은 칸으로 줄인다(사용자가 그린 박스는 그대로).
 */

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toOklab = (r: number, g: number, b: number) => {
  const R = lin(r), G = lin(g), B = lin(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
const fromOklab = (L: number, a: number, b: number) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return rgb.map(v => {
    const c = Math.min(1, Math.max(0, v))
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255)
  })
}

const BRIGHT = 0.86 // 이 밝기 이상이면 보정 안 함(실측: 렌더가 이미 카탈로그만큼 밝음)
const GAIN = 1.2
const MAX_LIFT = 0.3

/** 크롭 캔버스 → 그늘 보정 대표색 [r,g,b] 와 6자리 hex */
export const shadeColor = (canvas: HTMLCanvasElement): { rgb: number[]; hex: string } => {
  const k = Math.min(1, 96 / Math.max(canvas.width, canvas.height))
  const w = Math.max(1, Math.round(canvas.width * k)), h = Math.max(1, Math.round(canvas.height * k))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(canvas, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  const R: number[] = [], G: number[] = [], B: number[] = []
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue
    R.push(d[i])
    G.push(d[i + 1])
    B.push(d[i + 2])
  }
  if (!R.length) return { rgb: [0, 0, 0], hex: '000000' }
  const med = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y)
    return s[Math.floor(s.length / 2)]
  }
  const [L, A, Bb] = toOklab(med(R), med(G), med(B))
  const lift = Math.min(MAX_LIFT, Math.max(0, BRIGHT - L) * GAIN)
  const rgb = fromOklab(Math.min(0.97, L + lift), A, Bb)
  return { rgb, hex: rgb.map(v => v.toString(16).padStart(2, '0')).join('') }
}

type Box = { x: number; y: number; w: number; h: number }

/** 줄눈 피하기 — 그림(img) 속 box(0~1) 안의 곧은 세로·가로 줄눈을 찾아 그 사이 가장 넓은 칸(0~1). 줄눈 없거나 칸이 작으면 box 그대로.
 *  고른 칸 안에서 한 번 더 찾는다 — 한쪽 판넬에만 있는 줄눈(박스 전체를 가로지르지 않는 선)까지 피하려고 */
export const avoidJoints = (img: HTMLImageElement, box: Box): Box => {
  const once = jointCell(img, box)
  if (once === box) return box
  const twice = jointCell(img, once)
  return twice
}

const jointCell = (img: HTMLImageElement, box: Box): Box => {
  const sw = box.w * img.naturalWidth, sh = box.h * img.naturalHeight
  const k = Math.min(1, 240 / Math.max(sw, sh))
  const W = Math.max(8, Math.round(sw * k)), H = Math.max(8, Math.round(sh * k))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  try {
    g.drawImage(img, box.x * img.naturalWidth, box.y * img.naturalHeight, sw, sh, 0, 0, W, H)
  }
  catch {
    return box
  }
  const d = g.getImageData(0, 0, W, H).data
  const Y = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) Y[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  // 줄눈 = 박스 높이(폭) 대부분을 곧게 지나는 어두운/밝은 선 → 열(행)마다 '양옆과 다른' 칸 비율
  const lines = (n: number, len: number, at: (i: number, j: number) => number) => {
    const out: number[] = []
    for (let i = 4; i < n - 4; i++) { // 박스 가장자리 몇 픽셀은 제외(테두리를 줄눈으로 오인)
      let hit = 0
      for (let j = 0; j < len; j++) {
        const v = at(i, j), a = (at(i - 2, j) + at(i + 2, j)) / 2
        if (Math.abs(v - a) > 10) hit++
      }
      if (hit / len >= 0.6) out.push(i)
    }
    // 붙은 열은 하나로
    return out.filter((v, i) => i === 0 || v - out[i - 1] > 2)
  }
  const vx = lines(W, H, (x, y) => Y[y * W + x])
  const hy = lines(H, W, (y, x) => Y[y * W + x])
  if (!vx.length && !hy.length) return box
  const cuts = (arr: number[], n: number) => [0, ...arr, n]
  const xs = cuts(vx, W), ys = cuts(hy, H)
  let best: [number, number, number, number] | null = null, bestA = 0
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const a = (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
      if (a > bestA) {
        bestA = a
        best = [xs[i], ys[j], xs[i + 1], ys[j + 1]]
      }
    }
  }
  if (!best || bestA < 0.25 * W * H) return box // 칸이 너무 작으면(촘촘한 타일 등) 그대로
  const pad = 0.06 // 줄눈에서 살짝 안쪽
  const [x0, y0, x1, y1] = best
  const iw = x1 - x0, ih = y1 - y0
  const nx = x0 + iw * pad, ny = y0 + ih * pad, nw = iw * (1 - 2 * pad), nh = ih * (1 - 2 * pad)
  if (nw < 16 || nh < 16) return box
  return { x: box.x + (nx / W) * box.w, y: box.y + (ny / H) * box.h, w: (nw / W) * box.w, h: (nh / H) * box.h }
}

/** 박스(0~1)를 손으로 둘러 그린 듯한 둥근 사각 선으로(시범 선) */
export const boxStroke = (b: { x: number; y: number; w: number; h: number }): [number, number][] => {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2
  const out: [number, number][] = []
  const N = 90
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(t), s = Math.sin(t)
    const wob = 1 + Math.sin(k * 0.5) * 0.015
    out.push([cx + Math.sign(c) * Math.abs(c) ** 0.4 * rx * wob, cy + Math.sign(s) * Math.abs(s) ** 0.4 * ry * wob])
  }
  return out
}
