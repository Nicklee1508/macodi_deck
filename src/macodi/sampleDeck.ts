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
