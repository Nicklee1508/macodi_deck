/**
 * 슬라이드 속 큰 그림(dataURL)을 화면에 필요한 크기로 줄이기 — 브라우저 안에서만(추가 비용 없음)
 *  PPT 원본 그림(수십 MB)이 그대로 들어가면 임시 저장·실행 취소 기록이 매번 통째로 복사돼 편집이 느려짐.
 *  - 그림: 슬라이드에 보이는 크기 × 1920/1000(전체 화면) × 2(선명) — 최대 1920px
 *  - 투명한 부분이 있으면 PNG, 아니면 JPEG(품질 0.85). 줄인 게 더 클 땐 원본 유지
 */
import type { Slide } from '@/types/slides'

const MAX = 1920
const SCREEN = 1920 / 1000 // 편집기 기준 폭 1000 → 전체 화면 1920
const SMALL = 200 * 1024 // 이보다 작고 크기도 넘지 않으면 그대로

const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
})

const cache = new Map<string, Promise<string>>()

export const shrinkDataUrl = (src: string, targetPx: number): Promise<string> => {
  if (!/^data:image\/(png|jpe?g|webp|bmp)/i.test(src)) return Promise.resolve(src)
  const key = targetPx + ':' + src.length + ':' + src.slice(-64)
  if (!cache.has(key)) cache.set(key, (async () => {
    try {
      const img = await loadImg(src)
      const w = img.naturalWidth, h = img.naturalHeight
      const t = Math.min(MAX, Math.max(600, Math.round(targetPx)))
      const k = Math.min(1, t / Math.max(w, h))
      if (k === 1 && src.length < SMALL) return src
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * k))
      c.height = Math.max(1, Math.round(h * k))
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, 0, 0, c.width, c.height)
      // 투명 픽셀이 있는지(PNG 만 확인)
      let alpha = false
      if (/^data:image\/(png|webp)/i.test(src)) {
        const d = g.getImageData(0, 0, c.width, c.height).data
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] < 255) {
            alpha = true
            break
          }
        }
      }
      const out = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85)
      return out.length < src.length ? out : src
    }
    catch {
      return src
    }
  })())
  return cache.get(key)!
}

/** 슬라이드 전체의 그림·배경 그림을 줄인 새 슬라이드 목록(바뀐 게 없으면 changed=false) */
export const shrinkSlides = async (slides: Slide[]): Promise<{ slides: Slide[]; changed: boolean }> => {
  let changed = false
  const out: Slide[] = JSON.parse(JSON.stringify(slides))
  const jobs: Promise<void>[] = []
  for (const slide of out) {
    const bg = slide.background
    if (bg?.type === 'image' && bg.image?.src) {
      const image = bg.image
      jobs.push(shrinkDataUrl(image.src, MAX).then(s => {
        if (s !== image.src) {
          image.src = s
          changed = true
        }
      }))
    }
    for (const el of slide.elements) {
      if (el.type !== 'image') continue
      jobs.push(shrinkDataUrl(el.src, Math.max(el.width, el.height) * SCREEN * 2).then(s => {
        if (s !== el.src) {
          el.src = s
          changed = true
        }
      }))
    }
  }
  await Promise.all(jobs)
  return { slides: changed ? out : slides, changed }
}
