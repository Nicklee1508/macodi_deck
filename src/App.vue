<template>
  <template v-if="slides.length">
    <Screen v-if="screening" />
    <Editor v-else-if="_isPC" />
    <Mobile v-else />
  </template>
  <FullscreenSpin tip="데이터를 준비하는 중입니다. 잠시만 기다려 주세요 ..." v-else  loading :mask="false" />
  <!-- 그림 서식(선명도·색 온도) SVG 필터 정의 -->
  <ImageFilterDefs />
</template>

<script lang="ts" setup>
import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import { MACODI_API } from '@/macodi/api'
import { clearDraft, draftState, fileState, getFile, loadDraft, putFile, saveDraft } from '@/macodi/autosave'
import { shrinkSlides } from '@/macodi/shrinkImages'
import ImageFilterDefs from '@/macodi/ImageFilterDefs.vue'
import { isFirstVisit, loadSampleDeck, upgradeSampleImages } from '@/macodi/sampleDeck'
import { handleBillingReturn, startSubscriptionWatch, subscribeState } from '@/macodi/subscription'

import Editor from './views/Editor/index.vue'
import Screen from './views/Screen/index.vue'
import Mobile from './views/Mobile/index.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'

const _isPC = isPC()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const screenStore = useScreenStore()
const { databaseId } = storeToRefs(mainStore)
const { slides } = storeToRefs(slidesStore)
const { screening } = storeToRefs(screenStore)

const isAudienceMode = new URLSearchParams(window.location.search).get('mode') === 'audience'
// URL 링크 공유로 들어온 사람(?v=공유키) — 로그인 없이 보기
const shareKey = new URLSearchParams(window.location.search).get('v')

// (원본의 '나가시겠습니까?' 확인창은 제거 — 작업이 이 브라우저에 자동 임시 저장되므로)

onMounted(async () => {
  if (isAudienceMode) {
    slidesStore.setSlides([{
      id: nanoid(10),
      elements: [],
    }])
    screenStore.setScreening(true)
  }
  else if (shareKey) {
    try {
      const r = await fetch(`${MACODI_API}/deck-share/${encodeURIComponent(shareKey)}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.title) slidesStore.setTitle(d.title)
      if (d.theme) slidesStore.setTheme(d.theme)
      if (d.viewportRatio) slidesStore.setViewportRatio(d.viewportRatio)
      slidesStore.setSlides(d.slides)
      document.title = `${d.title || '마감재 제안서'} · moodeck`
      screenStore.setScreening(true)
    }
    catch {
      screenStore.setScreening(true)
      slidesStore.setSlides([{ id: nanoid(10), elements: [{
        type: 'text', id: nanoid(10), left: 200, top: 240, width: 600, height: 60, rotate: 0,
        content: '<p style="text-align: center;"><span style="font-size: 22px;">링크가 없거나 삭제된 제안서입니다.</span></p>',
        defaultFontName: 'Pretendard', defaultColor: '#333',
      }] }])
    }
    await deleteDiscardedDB()
    snapshotStore.initSnapshotDatabase()
  }
  else {
    // /editor 로 들어오면 첫 화면 = 내 파일 열기(지금 열린 프로젝트가 '선택됨'으로 강조).
    //  슬라이드를 불러오기 전에 열어 둬야 첫 방문 AI 튜토리얼이 이 창을 닫은 뒤에 시작됨
    const fromBilling = new URLSearchParams(location.search).has('billing')
    // 랜딩 요금 안내의 구독 버튼 = /editor?subscribe → 들어오자마자 구독 창
    const wantSubscribe = new URLSearchParams(location.search).has('subscribe')
    if (!fromBilling && !wantSubscribe) fileState.dialog = 'open'
    // 이 브라우저에 임시 저장된 작업이 있으면 이어서, 없거나 처음 온 사람이면 샘플 제안서
    const draft = await loadDraft()
    const first = isFirstVisit()
    // 처음 보는 브라우저인데 임시 작업이 남아 있으면(테스트 등) 지우지 않고 내 파일에 보관
    if (draft && first) {
      await putFile({ id: nanoid(10), name: `이전 작업 (자동 보관) ${new Date(draft.savedAt).toLocaleDateString('ko-KR')}`, title: draft.title, theme: draft.theme, viewportRatio: draft.viewportRatio, slides: draft.slides }).catch(() => undefined)
      await clearDraft() // 보관했으니 임시 저장은 비움 → 다음 접속도 샘플(편집하면 다시 임시 저장)
    }
    if (draft && !first) {
      if (draft.title) slidesStore.setTitle(draft.title)
      if (draft.theme) slidesStore.setTheme(draft.theme as never)
      if (draft.viewportRatio) slidesStore.setViewportRatio(draft.viewportRatio)
      // 예전에 원본 크기로 들어간 큰 그림은 열 때 한 번 줄임(편집 지연 방지)
      const { slides: light } = await shrinkSlides(draft.slides as never)
      // 임시 저장된 샘플이면 페이지 그림만 최신 샘플 그림으로(고친 내용은 그대로)
      slidesStore.setSlides((draft.sample && !draft.fileId && await upgradeSampleImages(light)) || light)
      draftState.savedAt = draft.savedAt
      fileState.sample = !!draft.sample
      // 열려 있던 내 파일 이어서(Ctrl+S 가 같은 파일로)
      const file = draft.fileId ? await getFile(draft.fileId) : undefined
      if (file) {
        fileState.id = file.id
        fileState.name = file.name
        fileState.savedAt = file.savedAt
        // 저장 뒤에 더 고친 게 있으면 '변경됨'
        fileState.dirty = file.title !== draft.title || JSON.stringify(file.slides) !== JSON.stringify(draft.slides)
      }
    }
    else {
      // 처음 온 사람 = 마코디 샘플 제안서(LOBBY 화면부터)
      await loadSampleDeck()
    }

    await deleteDiscardedDB()
    snapshotStore.initSnapshotDatabase()
    startAutosave()
    // 구독: 결제창에서 돌아왔으면 첫 결제·키 발급 → 안내창, 그리고 이 PC 구독 상태 수시 확인
    if (fromBilling) await handleBillingReturn()
    else if (wantSubscribe) {
      history.replaceState(null, '', location.pathname)
      subscribeState.mode = 'plan'
    }
    startSubscriptionWatch()
  }
})

// 로그인 없이 임시 저장 — 편집이 멈추고 1초 뒤 이 브라우저(IndexedDB)에 저장
let saveTimer: ReturnType<typeof setTimeout> | null = null
const startAutosave = () => {
  const { title, theme, viewportRatio } = storeToRefs(slidesStore)
  // 편집하면 '변경됨'(파일 열기·새 제안서처럼 통째로 바꾼 직후 한 번은 제외)
  watch([slides, title, theme, viewportRatio], () => {
    if (fileState.suppressDirty) fileState.suppressDirty = false
    else fileState.dirty = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveDraft({ title: title.value, theme: theme.value, viewportRatio: viewportRatio.value, slides: slides.value, fileId: fileState.id, fileName: fileState.name, sample: fileState.sample })
        .then(t => {
          draftState.savedAt = t
          draftState.error = false
        })
        .catch(() => (draftState.error = true))
    }, 1000)
  }, { deep: true })
}

// 应用注销时向 localStorage 中记录下本次 indexedDB 的数据库ID，用于之后清除数据库
window.addEventListener('beforeunload', () => {
  const discardedDB = localStorage.getItem(LOCALSTORAGE_KEY_DISCARDED_DB)
  const discardedDBList: string[] = discardedDB ? JSON.parse(discardedDB) : []

  discardedDBList.push(databaseId.value)

  const newDiscardedDB = JSON.stringify(discardedDBList)
  localStorage.setItem(LOCALSTORAGE_KEY_DISCARDED_DB, newDiscardedDB)
})
</script>

<style lang="scss">
#app {
  height: 100%;
}
</style>