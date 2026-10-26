<template>
  <!-- 모바일 머티리얼 탭 — 데스크탑 '머티리얼' 탭의 AI 영역 검색과 같음.
       들어오면 지금 슬라이드에 시범 선이 자동으로 그려지고 → 그 영역으로 검색 → 아래에 추천 자재.
       손가락으로 다른 곳을 둘러 그리거나 박스를 옮기면 다시 검색. 자재를 누르면 이 슬라이드에 스펙 카드로 담김. -->
  <div class="mobile-material" ref="rootRef">
    <div class="mm-top">
      <button type="button" class="nav" :disabled="slideIndex <= 0" @click="go(-1)">‹</button>
      <span class="page">{{ slideIndex + 1 }} / {{ slides.length }}</span>
      <button type="button" class="nav" :disabled="slideIndex >= slides.length - 1" @click="go(1)">›</button>
      <!-- 편집 화면의 '편집 끝내기'와 같은 모양 — 누르면 AI 영역 검색을 끝내고 슬라이드 목록으로 -->
      <div class="back" @click="changeMode('preview')"><i-icon-park-outline:logout /> AI 영역 검색 끝내기</div>
    </div>

    <div class="mm-body" ref="listRef" @scroll="onScroll">
      <div class="mm-slide" @click="!ai.active || ai.paused ? restart() : null" :style="{ width: slideW + 'px', height: slideW * viewportRatio + 'px' }">
        <ThumbnailSlide v-if="currentSlide && slideW" :slide="currentSlide" :size="slideW" />
        <AiRegionLayer />
      </div>

      <div class="mm-status" :class="{ err: isErr }">{{ status }}</div>
      <div class="mm-sec">{{ secTitle }}</div>
      <div class="mm-grid">
        <button v-for="p in ai.results" :key="'r' + p.id" type="button" class="mm-card" @click="pick(p)">
          <span class="thumb" :style="{ backgroundImage: `url('${thumbOf(p)}')` }"></span>
          <span class="name">{{ p.name || '자재' }}</span>
          <span class="brand">{{ [p.category, p.subCategory].filter(Boolean).join(' / ') }}</span>
        </button>
        <button v-for="p in ai.others" :key="'o' + p.id" type="button" class="mm-card" @click="pick(p)">
          <span class="thumb" :style="{ backgroundImage: `url('${thumbOf(p)}')` }"></span>
          <span class="name">{{ p.name || '자재' }}</span>
          <span class="brand">{{ [p.category, p.subCategory].filter(Boolean).join(' / ') }}</span>
        </button>
        <div v-if="ai.searching && (ai.results.length || ai.others.length)" class="mm-more">불러오는 중…</div>
      </div>
    </div>

    <div class="menu">
      <div class="menu-item active"><i-icon-park-outline:texture-two class="icon" /> 머티리얼</div>
      <Divider type="vertical" style="height: 30px;" />
      <div class="menu-item" @click="changeMode('editor')"><i-icon-park-outline:edit class="icon" /> 편집</div>
      <Divider type="vertical" style="height: 30px;" />
      <div class="menu-item" @click="changeMode('player')"><i-icon-park-outline:full-screen-play class="icon" /> 재생</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { Mode } from '@/types/mobile'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import Divider from '@/components/Divider.vue'
import AiRegionLayer from '@/macodi/AiRegionLayer.vue'
import { ai, logPick, search as aiSearch, startManual, stopAi, thumbOf } from '@/macodi/aiRegion'
import type { MacodiProduct } from '@/macodi/api'
import useInsertSpecCard from '@/macodi/useInsertSpecCard'
import { ensureSubscribed, freeMsg, subscribeState } from '@/macodi/subscription'
import { fileState } from '@/macodi/autosave'

defineProps<{
  changeMode: (mode: Mode) => void
}>()

const slidesStore = useSlidesStore()
const { slides, slideIndex, currentSlide, viewportRatio } = storeToRefs(slidesStore)

const rootRef = ref<HTMLElement>()
const slideW = ref(0)

const status = ref('')
const isErr = ref(false)
const setStatus = (t: string, err = false) => {
  status.value = t
  isErr.value = err
}

const secTitle = computed(() => {
  if (ai.results.length || ai.others.length) return 'AI 추천 자재'
  if (ai.searching || ai.demo || ai.post) return 'AI 추천 검색 중…'
  return '슬라이드 위에서 찾을 곳을 손가락으로 둘러 그려 주세요'
})

// 들어올 때·슬라이드를 바꿀 때 = 시범 선 자동 그리기 → 그 영역으로 검색
let timer = 0
const restart = () => {
  clearTimeout(timer)
  setStatus('')
  stopAi()
  timer = window.setTimeout(() => startManual(), 400) // 슬라이드 그림이 그려진 뒤
}
const go = (d: number) => {
  const i = slideIndex.value + d
  if (i < 0 || i >= slides.value.length) return
  slidesStore.updateSlideIndex(i)
}
watch(() => currentSlide.value?.id, () => restart())

onMounted(async () => {
  await nextTick()
  if (rootRef.value) slideW.value = rootRef.value.clientWidth - 20
  // 샘플 제안서(아직 내 파일로 저장 안 한 것)는 늘 마지막 페이지에서 시작
  if (fileState.sample && !fileState.id && slides.value.length) slidesStore.updateSlideIndex(slides.value.length - 1)
  restart()
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  stopAi()
})

// 추천 목록 무한 스크롤
const listRef = ref<HTMLElement>()
const onScroll = () => {
  const el = listRef.value
  if (el && ai.hasMore && !ai.searching && el.scrollTop + el.clientHeight > el.scrollHeight - 600) aiSearch(ai.page + 1)
}
watch(() => [ai.results.length, ai.others.length, ai.searching], () => nextTick(onScroll))

// 자재 누르기 = 이 슬라이드에 스펙 카드로 담기(구독 기능 — 무료 3개 체험 후 구독 팝업)
const { insertSpecCard } = useInsertSpecCard()
const pick = async (p: MacodiProduct) => {
  if (!(await ensureSubscribed('insert'))) return
  const free = subscribeState.freeUsedNotice
  subscribeState.freeUsedNotice = false
  ai.paused = true // 슬라이드의 영역 표시는 끄고 추천 목록은 그대로
  logPick(p.id)
  setStatus(`"${p.name || '자재'}" 담는 중…`)
  insertSpecCard(p)
    .then(() => {
      setStatus(free ? freeMsg() : `슬라이드에 담았어요: ${p.name || '자재'} · 슬라이드를 누르면 다시 찾아요`)
      listRef.value?.scrollTo({ top: 0, behavior: 'smooth' }) // 담긴 카드가 보이게
    })
    .catch(e => setStatus((e && e.message) || '담지 못했어요.', true))
}
</script>

<style lang="scss" scoped>
.mobile-material {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f9f9f9;
  font-family: 'Pretendard', 'Malgun Gothic', sans-serif;
}
.mm-top {
  flex: none;
  height: 44px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border-bottom: 1px solid #e7e7ee;
  .nav {
    width: 32px;
    height: 32px;
    border: 1px solid #e7e7ee;
    border-radius: 8px;
    background: #fff;
    font-size: 20px;
    line-height: 1;
    color: #333;
    &:disabled { opacity: .35; }
  }
  .page {
    min-width: 54px;
    text-align: center;
    font-size: 13px;
    color: #555;
  }
  .back {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
  }
}
.mm-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}
.mm-slide {
  position: relative;
  margin: 0 auto;
  box-shadow: 0 0 15px 0 rgba(0, 0, 0, 0.1);
  background: #fff;
  // 좁은 화면 — 안내 문구가 영역 박스를 가리지 않게 아래로, 글자 작게
  :deep(.ai-bar) { top: auto; bottom: 6px; left: 6px; }
  :deep(.ai-tag) { padding: 4px 10px; font-size: 10px; }
  :deep(.ai-msg) { bottom: 34px; }
}
.mm-status {
  padding: 8px 2px 0;
  font-size: 12px;
  color: #888;
  &:empty { display: none; }
  &.err { color: #d33; }
}
.mm-sec {
  padding: 12px 2px 8px;
  font-size: 13px;
  font-weight: 700;
  color: #333;
}
.mm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.mm-card {
  display: flex;
  flex-direction: column;
  padding: 0 0 6px;
  background: #fff;
  border: 1px solid #e7e7ee;
  border-radius: 10px;
  overflow: hidden;
  text-align: left;
  font: inherit;
  min-width: 0;
  .thumb {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #eee center / cover no-repeat;
  }
  .name {
    padding: 5px 6px 0;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
  }
  .brand {
    padding: 2px 6px 0;
    font-size: 10px;
    color: #999;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.mm-more {
  grid-column: 1 / -1;
  padding: 10px;
  text-align: center;
  font-size: 12px;
  color: #999;
}
.menu {
  flex: none;
  height: 50px;
  box-shadow: 0 -2px 4px 0 rgba($color: #333, $alpha: 0.05);
  background: #fff;
  display: flex;
  justify-content: center;
  align-items: center;

  .menu-item {
    flex: 1;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 13px;

    &.active {
      color: #23443A;
      font-weight: 700;
    }
    .icon {
      margin-right: 8px;
      font-size: 18px;
    }
  }
}
</style>
