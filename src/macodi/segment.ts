/**
 * 마술봉식 색 영역 나누기 — 순수 계산(브라우저·Node 공용, DOM 없음)
 *
 *  1) OKLab 으로 바꾸고 살짝 흐리게(질감 잡티 완화)
 *  2) 그래프 분할(Felzenszwalb): 이웃 픽셀 차이가 "영역 안 변화 + 감도/크기" 보다 작으면 합침
 *     → 조명 때문에 서서히 밝아지는 같은 재료는 이어지고, 재료가 바뀌는 뚜렷한 경계에서 끊긴다.
 *     밝기 차이는 색 차이보다 덜 따진다(그림자·하이라이트에 강하게).
 *  3) 너무 작은 조각(줄눈·이음매 등)은 가장 닮은 이웃에 흡수
 *  4) 붙어 있고 평균색이 비슷한 영역끼리 한 번 더 합침(판넬 이음선으로 나뉜 같은 벽 등)
 *  sensitivity 1~10: 클수록 잘게(포토샵 마술봉 허용치를 낮추는 것과 같음)
 */

export interface Segmentation {
  W: number
  H: number
  label: Int32Array       // 픽셀별 영역 번호(0..count-1)
  count: number
  area: Int32Array
  meanRgb: Float64Array   // count*3
}

const srgbToLin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

const L_WEIGHT = 0.45 // 밝기 차이 가중(색 차이 1 대비) — 그림자에 덜 민감하게
const MERGE_L_WEIGHT = 0.2 // 영역 합치기 단계: 같은 색상·채도면 조명 밝기 차이가 커도 같은 재료로

export const segment = (rgba: Uint8ClampedArray | Uint8Array, W: number, H: number, sensitivity = 5): Segmentation => {
  const N = W * H
  // ---- OKLab ----
  const Lc = new Float32Array(N), Ac = new Float32Array(N), Bc = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const lr = srgbToLin(rgba[i * 4]), lg = srgbToLin(rgba[i * 4 + 1]), lb = srgbToLin(rgba[i * 4 + 2])
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
    Lc[i] = 0.2104542553 * l + 0.7936617850 * m - 0.0040720468 * s
    Ac[i] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    Bc[i] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  }
  // ---- 흐리게(가우시안 σ≈1, 5탭) ----
  const K5 = [0.054, 0.244, 0.403, 0.244, 0.054]
  const blur = (src: Float32Array) => {
    const tmp = new Float32Array(N), out = new Float32Array(N)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let k = -2; k <= 2; k++) s += K5[k + 2] * src[y * W + Math.min(W - 1, Math.max(0, x + k))]
        tmp[y * W + x] = s
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let k = -2; k <= 2; k++) s += K5[k + 2] * tmp[Math.min(H - 1, Math.max(0, y + k)) * W + x]
        out[y * W + x] = s
      }
    }
    return out
  }
  const L = blur(Lc), A = blur(Ac), B = blur(Bc)
  const diff = (p: number, q: number) => {
    const dl = (L[p] - L[q]) * L_WEIGHT, da = A[p] - A[q], db = B[p] - B[q]
    return Math.sqrt(dl * dl + da * da + db * db)
  }

  // ---- 이웃 간선(오른쪽·아래·대각 2) ----
  const maxE = N * 4
  const ea = new Int32Array(maxE), eb = new Int32Array(maxE), ew = new Float32Array(maxE)
  let E = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      if (x < W - 1) { ea[E] = p; eb[E] = p + 1; ew[E++] = diff(p, p + 1) }
      if (y < H - 1) { ea[E] = p; eb[E] = p + W; ew[E++] = diff(p, p + W) }
      if (x < W - 1 && y < H - 1) { ea[E] = p; eb[E] = p + W + 1; ew[E++] = diff(p, p + W + 1) * 0.7071 }
      if (x > 0 && y < H - 1) { ea[E] = p; eb[E] = p + W - 1; ew[E++] = diff(p, p + W - 1) * 0.7071 }
    }
  }
  const order = new Uint32Array(E)
  for (let i = 0; i < E; i++) order[i] = i
  order.sort((i, j) => ew[i] - ew[j])

  // ---- 그래프 분할 ----
  const parent = new Int32Array(N), size = new Int32Array(N).fill(1), inner = new Float32Array(N)
  for (let i = 0; i < N; i++) parent[i] = i
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const s = Math.max(1, Math.min(10, sensitivity))
  // 감도 1(크게 묶음) ~ 10(잘게) — 화면 크기와 무관하게 비슷하게 동작하도록 픽셀 수로 정규화
  const k = (N / 60000) * 6 * Math.pow(0.62, s - 1)
  for (let t = 0; t < E; t++) {
    const e = order[t]
    const a = find(ea[e]), b = find(eb[e])
    if (a === b) continue
    const w = ew[e]
    if (w <= Math.min(inner[a] + k / size[a], inner[b] + k / size[b])) {
      const [big, small] = size[a] >= size[b] ? [a, b] : [b, a]
      parent[small] = big
      size[big] += size[small]
      inner[big] = Math.max(inner[big], inner[small], w)
    }
  }
  // ---- 작은 조각 흡수(가장 낮은 간선 순 = 가장 닮은 이웃) ----
  const minSize = Math.max(20, Math.round(N * 0.004))
  for (let t = 0; t < E; t++) {
    const e = order[t]
    const a = find(ea[e]), b = find(eb[e])
    if (a !== b && (size[a] < minSize || size[b] < minSize)) {
      const [big, small] = size[a] >= size[b] ? [a, b] : [b, a]
      parent[small] = big
      size[big] += size[small]
    }
  }

  // ---- 번호 매기기 + 평균색 ----
  const relabel = new Int32Array(N).fill(-1)
  const label = new Int32Array(N)
  let count = 0
  for (let i = 0; i < N; i++) {
    const r = find(i)
    if (relabel[r] < 0) relabel[r] = count++
    label[i] = relabel[r]
  }
  const stats = () => {
    const area = new Int32Array(count), lab = new Float64Array(count * 3), rgb = new Float64Array(count * 3)
    for (let i = 0; i < N; i++) {
      const c = label[i]
      area[c]++
      lab[c * 3] += L[i]; lab[c * 3 + 1] += A[i]; lab[c * 3 + 2] += B[i]
      rgb[c * 3] += rgba[i * 4]; rgb[c * 3 + 1] += rgba[i * 4 + 1]; rgb[c * 3 + 2] += rgba[i * 4 + 2]
    }
    for (let c = 0; c < count; c++) {
      for (let j = 0; j < 3; j++) {
        lab[c * 3 + j] /= area[c] || 1
        rgb[c * 3 + j] /= area[c] || 1
      }
    }
    return { area, lab, rgb }
  }

  // ---- 붙어 있고 평균색이 비슷한 영역 합치기(같은 벽의 판넬 등) ----
  const MERGE = 0.028 * Math.pow(0.8, s - 5) // 감도 높을수록 덜 합침
  {
    const { area, lab } = stats()
    const up = new Int32Array(count)
    for (let c = 0; c < count; c++) up[c] = c
    const f2 = (x: number): number => {
      while (up[x] !== x) {
        up[x] = up[up[x]]
        x = up[x]
      }
      return x
    }
    // 인접 쌍과 경계 길이
    const pairs = new Map<number, number>()
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x, a = label[p]
        if (x < W - 1 && label[p + 1] !== a) {
          const b = label[p + 1], key = a < b ? a * count + b : b * count + a
          pairs.set(key, (pairs.get(key) || 0) + 1)
        }
        if (y < H - 1 && label[p + W] !== a) {
          const b = label[p + W], key = a < b ? a * count + b : b * count + a
          pairs.set(key, (pairs.get(key) || 0) + 1)
        }
      }
    }
    const cand: [number, number, number][] = []
    pairs.forEach((len, key) => {
      const a = Math.floor(key / count), b = key % count
      if (len < 4) return // 점으로만 닿은 건 제외
      const dl = (lab[a * 3] - lab[b * 3]) * MERGE_L_WEIGHT, da = lab[a * 3 + 1] - lab[b * 3 + 1], db = lab[a * 3 + 2] - lab[b * 3 + 2]
      const d = Math.sqrt(dl * dl + da * da + db * db)
      if (d < MERGE) cand.push([d, a, b])
    })
    cand.sort((x, y) => x[0] - y[0])
    for (const [, a, b] of cand) {
      const ra = f2(a), rb = f2(b)
      if (ra !== rb) up[rb] = ra
    }
    const re = new Int32Array(count).fill(-1)
    let n2 = 0
    for (let c = 0; c < count; c++) {
      const r = f2(c)
      if (re[r] < 0) re[r] = n2++
    }
    for (let i = 0; i < N; i++) label[i] = re[f2(label[i])]
    count = n2
    void area
  }
  const { area, rgb } = stats()
  return { W, H, label, count, area, meanRgb: rgb }
}

/** 영역 c 의 경계(바깥+구멍) 고리들 — 격자 꼭짓점 좌표 */
export const regionLoops = (seg: Segmentation, c: number): [number, number][][] => {
  const m = new Uint8Array(seg.W * seg.H)
  for (let i = 0; i < m.length; i++) m[i] = seg.label[i] === c ? 1 : 0
  return maskLoops(m, seg.W, seg.H)
}

/** 임의 마스크(1=선택)의 경계 고리들 — 격자 꼭짓점 좌표 */
export const maskLoops = (mask: Uint8Array, W: number, H: number): [number, number][][] => {
  const inR = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1
  // 방향 있는 경계 간선: 영역을 왼쪽에 두고 도는 방향(시계 반대) — 시작 꼭짓점 → 끝 꼭짓점
  const next = new Map<number, number[]>()
  const V = (x: number, y: number) => y * (W + 1) + x
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = V(x0, y0)
    const arr = next.get(k)
    if (arr) arr.push(V(x1, y1))
    else next.set(k, [V(x1, y1)])
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inR(x, y)) continue
      if (!inR(x, y - 1)) add(x + 1, y, x, y)         // 위 변: 오른→왼
      if (!inR(x - 1, y)) add(x, y, x, y + 1)         // 왼 변: 위→아래
      if (!inR(x, y + 1)) add(x, y + 1, x + 1, y + 1) // 아래 변: 왼→오른
      if (!inR(x + 1, y)) add(x + 1, y + 1, x + 1, y) // 오른 변: 아래→위
    }
  }
  const loops: [number, number][][] = []
  for (const [start, outs] of next) {
    while (outs.length) {
      const loop: [number, number][] = []
      let cur = start
      let nxt = outs.pop()!
      for (let g = 0; g < 1e6; g++) {
        loop.push([cur % (W + 1), Math.floor(cur / (W + 1))])
        cur = nxt
        if (cur === start) break
        const o = next.get(cur)
        if (!o || !o.length) break
        nxt = o.pop()!
      }
      if (loop.length >= 4) loops.push(simplifyLoop(loop))
    }
  }
  return loops
}

// 직선 위 중간 점 제거 후 Douglas-Peucker
const simplifyLoop = (pts: [number, number][], eps = 1.1): [number, number][] => {
  if (pts.length < 5) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const st: [number, number][] = [[0, pts.length - 1]]
  while (st.length) {
    const [a, b] = st.pop()!
    const [ax, ay] = pts[a], [bx, by] = pts[b]
    const len = Math.hypot(bx - ax, by - ay) || 1
    let md = 0, mi = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len
      if (d > md) {
        md = d
        mi = i
      }
    }
    if (md > eps && mi > 0) {
      keep[mi] = 1
      st.push([a, mi], [mi, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

/** 마스크 안에 들어가는 가장 큰 직사각형 — [x0,y0,x1,y1] 0~1 */
export const maskLargestRect = (mask: Uint8Array, W: number, H: number): [number, number, number, number] => {
  const h = new Int32Array(W)
  let best = { area: 0, x0: 0, y0: 0, x1: W, y1: H }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) h[x] = mask[y * W + x] === 1 ? h[x] + 1 : 0
    const st: number[] = []
    for (let x = 0; x <= W; x++) {
      const cur = x < W ? h[x] : 0
      while (st.length && h[st[st.length - 1]] >= cur) {
        const top = st.pop()!
        const height = h[top]
        const left = st.length ? st[st.length - 1] + 1 : 0
        const ar = height * (x - left)
        if (ar > best.area) best = { area: ar, x0: left, y0: y - height + 1, x1: x, y1: y + 1 }
      }
      st.push(x)
    }
  }
  return [best.x0 / W, best.y0 / H, best.x1 / W, best.y1 / H]
}

/**
 * 스마트 올가미 — 손으로 그린 닫힌 선(격자 좌표)을 실제 경계에 붙인 마스크로.
 *  - 선 안에 절반 이상 들어온 조각 = 조각 전체(경계까지 꽉)
 *  - 선이 큰 면의 일부만 둘렀으면 = 선 안쪽 ∩ 그 면(다른 재료로 삐져나간 곳은 실제 경계에서 잘림)
 *  - 선 안에 조금만 걸친 조각 = 제외
 */
export const lassoMask = (seg: Segmentation, inside: Uint8Array): Uint8Array => {
  const { W, H, label, count, area } = seg
  const N = W * H
  const inCnt = new Int32Array(count)
  let lassoArea = 0
  for (let i = 0; i < N; i++) {
    if (inside[i]) {
      inCnt[label[i]]++
      lassoArea++
    }
  }
  const out = new Uint8Array(N)
  if (!lassoArea) return out
  const whole = new Uint8Array(count), part = new Uint8Array(count)
  for (let c = 0; c < count; c++) {
    if (inCnt[c] >= area[c] * 0.5) whole[c] = 1
    else if (inCnt[c] >= lassoArea * 0.15) part[c] = 1
  }
  let n = 0
  for (let i = 0; i < N; i++) {
    const c = label[i]
    if (whole[c] || (part[c] && inside[i])) {
      out[i] = 1
      n++
    }
  }
  if (!n) out.set(inside) // 걸리는 게 없으면 그린 모양 그대로
  return out
}
