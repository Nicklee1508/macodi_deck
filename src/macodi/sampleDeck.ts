/**
 * 기본 양식 = 마코디 샘플 제안서(public/mocks/sample-deck.json, 그림은 mocks/sample/ 에 줄여서 둠)
 *  첫 진입·'새 제안서'에서 사용. startIndex = 처음 보여 줄 슬라이드(3D SIMULATION · LOBBY)
 */
import api from '@/services'
import { useSlidesStore } from '@/store'
import type { Slide, SlideTheme } from '@/types/slides'
import { fileState } from './autosave'

interface SampleDeck {
  title: string
  viewportRatio: number
  theme: Partial<SlideTheme>
  startIndex: number
  slides: Slide[]
}

let cached: Promise<SampleDeck> | null = null
export const fetchSampleDeck = () => (cached ||= api.getMockData('sample-deck') as Promise<SampleDeck>)

/** 처음 온 사람인지(이 브라우저에서 샘플을 아직 안 보여 줌) */
const SEEN_KEY = 'macodi.deck.sampleShown'
export const isFirstVisit = () => {
  try {
    return !localStorage.getItem(SEEN_KEY)
  }
  catch {
    return false
  }
}
export const markSampleShown = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  }
  catch { /* 무시 */ }
}

/** 예전 샘플 페이지 그림 → 지금 샘플의 같은 페이지 그림으로(고친 내용·넣은 자재는 그대로).
 *  예: (SAMPLE) 글자를 넣은 새 그림으로 바뀐 뒤에도, 이미 열어 둔(임시 저장된) 샘플이 새 그림을 보이게.
 *  바꿀 게 없으면 null */
const PAGE_RE = /\/mocks\/sample\/page-(\d+)-[^/]+$/
export const upgradeSampleImages = async (slides: Slide[]): Promise<Slide[] | null> => {
  const d = await fetchSampleDeck().catch(() => null)
  if (!d) return null
  const latest = new Map<string, string>()
  for (const s of d.slides) {
    for (const el of s.elements) {
      if (el.type !== 'image') continue
      const m = PAGE_RE.exec(el.src)
      if (m) latest.set(m[1], el.src)
    }
  }
  let changed = false
  const next = slides.map(s => ({
    ...s,
    elements: s.elements.map(el => {
      const m = el.type === 'image' ? PAGE_RE.exec(el.src) : null
      const src = m && latest.get(m[1])
      if (!src || el.type !== 'image' || src === el.src) return el
      changed = true
      return { ...el, src }
    }),
  }))
  return changed ? next : null
}

export const loadSampleDeck = async () => {
  const slidesStore = useSlidesStore()
  const d = await fetchSampleDeck()
  markSampleShown()
  slidesStore.setTitle(d.title || '샘플 제안서')
  if (d.theme) slidesStore.setTheme(d.theme)
  if (d.viewportRatio) slidesStore.setViewportRatio(d.viewportRatio)
  slidesStore.setSlides(d.slides)
  slidesStore.updateSlideIndex(Math.min(d.startIndex || 0, d.slides.length - 1))
  fileState.sample = true
}
