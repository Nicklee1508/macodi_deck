/**
 * 내 파일 — 로그인 없이 이 브라우저에 이름 붙여 저장/열기
 *  Ctrl+S = 지금 파일에 저장(처음이면 이름 묻기), Ctrl+Shift+S = 다른 이름으로 저장, Ctrl+O = 열기
 */
import { nanoid } from 'nanoid'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import message from '@/utils/message'
import { type DeckFile, fileState, putFile } from './autosave'
import { shrinkSlides } from './shrinkImages'
import { loadSampleDeck } from './sampleDeck'

export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { slides, title, theme, viewportRatio } = storeToRefs(slidesStore)

  const write = async (id: string, name: string) => {
    try {
      const savedAt = await putFile({ id, name, title: title.value, theme: theme.value, viewportRatio: viewportRatio.value, slides: slides.value })
      fileState.id = id
      fileState.name = name
      fileState.savedAt = savedAt
      fileState.dirty = false
      message.success(`'${name}' 저장했어요`)
    }
    catch {
      message.error('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.')
    }
  }

  /** Ctrl+S */
  const saveFile = () => {
    if (fileState.id) return write(fileState.id, fileState.name)
    fileState.dialog = 'saveAs'
  }

  /** 다른 이름으로 저장 — 새 파일. 제안서 제목도 그 이름으로 */
  const saveFileAs = (name: string) => {
    const n = name.trim() || title.value || '마감재 제안서'
    if (n !== title.value) slidesStore.setTitle(n)
    return write(nanoid(10), n)
  }

  /** 저장 안 한 변경이 있으면 확인 */
  const confirmDiscard = () => !fileState.dirty || window.confirm('저장하지 않은 변경 내용이 있어요. 그래도 계속할까요?')

  const openFile = async (f: DeckFile) => {
    if (f.id !== fileState.id && !confirmDiscard()) return false
    const { slides: light } = await shrinkSlides(f.slides as never)
    fileState.suppressDirty = true
    if (f.title) slidesStore.setTitle(f.title)
    if (f.theme) slidesStore.setTheme(f.theme as never)
    if (f.viewportRatio) slidesStore.setViewportRatio(f.viewportRatio)
    slidesStore.updateSlideIndex(0)
    mainStore.setActiveElementIdList([])
    slidesStore.setSlides(light)
    fileState.id = f.id
    fileState.name = f.name
    fileState.savedAt = f.savedAt
    fileState.dirty = false
    return true
  }

  /** 새 제안서 — 지금 파일과 연결을 끊음(다음 Ctrl+S 는 이름부터) */
  const detachFile = () => {
    fileState.suppressDirty = true
    fileState.id = ''
    fileState.name = ''
    fileState.savedAt = 0
    fileState.dirty = false
  }

  /** 샘플 제안서 열기 — 새 문서로(저장하면 내 파일에 새로 생김) */
  const openSample = async () => {
    if (!confirmDiscard()) return false
    detachFile()
    mainStore.setActiveElementIdList([])
    await loadSampleDeck()
    return true
  }

  /** 새 프로젝트 — 빈 슬라이드 1장짜리 새 캔버스(16:9). 저장하면 내 파일에 새로 생김 */
  const openBlank = () => {
    if (!confirmDiscard()) return false
    detachFile()
    mainStore.setActiveElementIdList([])
    slidesStore.setTitle('새 제안서')
    slidesStore.setViewportRatio(0.5625)
    slidesStore.setSlides([{ id: nanoid(10), elements: [], background: { type: 'solid', color: '#ffffff' } }])
    slidesStore.updateSlideIndex(0)
    return true
  }

  return { saveFile, saveFileAs, openFile, openSample, openBlank, detachFile, confirmDiscard }
}
