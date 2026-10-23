<template>
  <template v-if="slides.length">
    <Screen v-if="screening" />
    <Editor v-else-if="_isPC" />
    <Mobile v-else />
  </template>
  <FullscreenSpin tip="데이터를 준비하는 중입니다. 잠시만 기다려 주세요 ..." v-else  loading :mask="false" />
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import api from '@/services'
import { MACODI_API } from '@/macodi/api'

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

if (import.meta.env.MODE !== 'development' && !shareKey) {
  window.onbeforeunload = () => false
}

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
      document.title = `${d.title || '마감재 제안서'} · 마코디`
      screenStore.setScreening(true)
    }
    catch {
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
    const slides = await api.getMockData('slides')
    slidesStore.setSlides(slides)

    await deleteDiscardedDB()
    snapshotStore.initSnapshotDatabase()
  }
})

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