/**
 * 슬라이드 이미지 → AI 영역 검색 튜토리얼 시범 선 (segment.ts 분할 사용)
 *  좌표는 모두 이미지 기준 0~1.
 */
import { regionLoops, segment } from './segment'

const GRID = 320          // 분석 격자 긴 변(px)

const grid = (img: HTMLImageElement) => {
  const sc = GRID / Math.max(img.naturalWidth, img.naturalHeight)
  const W = Math.max(8, Math.round(img.naturalWidth * sc)), H = Math.max(8, Math.round(img.naturalHeight * sc))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, W, H)
  return { rgba: ctx.getImageData(0, 0, W, H).data, W, H }
}

/** 튜토리얼 시범용 — 화면 가운데 가까운 적당한 크기 영역의 외곽을 손으로 그린 듯한 선으로(0~1) */
export const demoStroke = (img: HTMLImageElement): [number, number][] | null => {
  const { rgba, W, H } = grid(img)
  const seg = segment(rgba, W, H, 8)
  const N = W * H
  // 슬라이드 바탕(가장 큰 면)은 빼고 — 사진이 없어도 배경 박스·도형·글자 덩어리가 시범 대상
  let bg = 0
  for (let c = 1; c < seg.count; c++) if (seg.area[c] > seg.area[bg]) bg = c
  let best = -1, bestScore = -Infinity
  for (let c = 0; c < seg.count; c++) {
    const ar = seg.area[c] / N
    if (c === bg || ar < 0.01 || ar > 0.7) continue
    let sx = 0, sy = 0
    for (let i = 0; i < N; i++) {
      if (seg.label[i] === c) {
        sx += i % W
        sy += (i / W) | 0
      }
    }
    const cx = sx / seg.area[c] / W, cy = sy / seg.area[c] / H
    // 반듯함(둘레 대비 면적, 원=1) — 지그재그 덩어리 말고 기둥·판넬처럼 깔끔한 면을 시범으로
    let per = 0
    for (let i = 0; i < N; i++) {
      if (seg.label[i] !== c) continue
      const x = i % W, y = (i / W) | 0
      if (x === 0 || seg.label[i - 1] !== c) per++
      if (x === W - 1 || seg.label[i + 1] !== c) per++
      if (y === 0 || seg.label[i - W] !== c) per++
      if (y === H - 1 || seg.label[i + W] !== c) per++
    }
    const compact = (4 * Math.PI * seg.area[c]) / (per * per || 1)
    const score = compact * 3 + ar * 2 - Math.hypot(cx - 0.6, cy - 0.5) // 반듯하고, 너무 작지 않고, 가운데쯤
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  const loops = best < 0 ? [] : regionLoops(seg, best).sort((p, q) => q.length - p.length)
  const outer = loops[0]
  if (!outer || outer.length < 3) return ellipseStroke() // 알맞은 면이 없어도 시범은 항상 보여준다
  // 고르게 다시 찍고, 살짝 안쪽 + 손떨림
  let len = 0
  const seglen: number[] = []
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    seglen.push(l)
    len += l
  }
  const STEPS = 90
  let mx = 0, my = 0
  outer.forEach(([x, y]) => {
    mx += x
    my += y
  })
  mx /= outer.length
  my /= outer.length
  const out: [number, number][] = []
  let i = 0, acc = 0
  for (let k = 0; k < STEPS; k++) {
    const target = (k / STEPS) * len
    while (acc + seglen[i] < target && i < outer.length - 1) {
      acc += seglen[i]
      i++
    }
    const a = outer[i], b = outer[(i + 1) % outer.length]
    const t = seglen[i] ? (target - acc) / seglen[i] : 0
    let x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t
    x += (mx - x) * 0.06 + Math.sin(k * 0.7) * 0.6 // 안쪽으로 6% + 손떨림
    y += (my - y) * 0.06 + Math.cos(k * 0.9) * 0.6
    out.push([x / W, y / H])
  }
  return out
}

/** 시범용 기본 선 — 화면 가운데를 손으로 둘러 그린 듯한 타원(0~1) */
const ellipseStroke = (): [number, number][] => {
  const out: [number, number][] = []
  const N = 90
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 - Math.PI / 2
    const wob = 1 + Math.sin(k * 0.45) * 0.04
    out.push([0.5 + Math.cos(a) * 0.17 * wob, 0.5 + Math.sin(a) * 0.24 * wob])
  }
  return out
}
