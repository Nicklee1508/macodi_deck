<template>
  <div class="macodi-panel">
    <form class="mp-search" @submit.prevent="submitSearch">
      <!-- AI 영역 검색 — 컬러 필터와 같은 크기 정사각형(회색 점선). 켜진 상태에서 다시 누르면 끝내기 -->
      <button
        type="button"
        class="ai-sq"
        :class="{ on: ai.active }"
        :title="ai.active ? 'AI 영역 검색 끝내기' : 'AI 영역 검색 — 슬라이드 위에서 찾을 곳을 둘러 그리기'"
        @click="toggle"
      >AI</button>
      <!-- 컬러 필터 — 색과 검색어를 함께 적용 -->
      <ColorFilter v-model="color" />
      <!-- 키워드 칩: 입력 후 Enter/검색 = 칩으로 고정(우상단 × 로 삭제), 여러 개면 모두 만족하는 자재(AND) -->
      <div class="kw-box" @click="kwInputRef?.focus()">
        <span v-for="(k, i) in keywords" :key="k" class="kw-chip">
          {{ k }}<span class="kw-x" title="키워드 삭제" @click.stop="removeKeyword(i)">×</span>
        </span>
        <input
          ref="kwInputRef"
          v-model="q"
          type="text"
          :placeholder="keywords.length ? '키워드 추가' : '자재명·브랜드 검색 (예: 대리석)'"
          autocomplete="off"
          @keydown.backspace="onKwBackspace"
          @keydown.enter.prevent="submitSearch"
        />
      </div>
    </form>
    <div class="mp-status" :class="{ err: isErr }">{{ status }}</div>

    <!-- AI 영역 검색 결과 (캔버스의 그림 위에서 영역을 고르면 여기 표시) -->
    <div v-if="ai.active" class="mp-ai">
      <div class="mp-sec">
        {{ ai.searching && !ai.results.length ? 'AI 추천 검색 중…' : ai.results.length ? 'AI 추천 자재' : ai.post ? '추천 결과가 없어요' : '슬라이드 위에서 찾을 곳을 둘러 그려주세요' }}
      </div>
      <div class="mp-grid">
        <button v-for="p in ai.results" :key="'ai' + p.id" type="button" class="mp-card" :title="p.name" @click="insertAi(p)">
          <span class="thumb" :style="{ backgroundImage: `url('${thumbOf(p)}')` }"></span>
          <span class="name">{{ p.name || '자재' }}</span>
          <span class="brand">{{ [p.category, p.subCategory].filter(Boolean).join(' / ') }}</span>
          <span v-if="sizeWxL(p.size)" class="size">{{ sizeWxL(p.size) }}</span>
        </button>
        <button v-if="ai.hasMore && !ai.searching" type="button" class="mp-more" @click="search(ai.page + 1)">더 보기</button>
      </div>
    </div>

    <div v-show="!ai.active" ref="gridRef" class="mp-grid" @scroll="onGridScroll">
      <button
        v-for="p in products"
        :key="p.id"
        type="button"
        class="mp-card"
        :title="p.name"
        @click="insert(p)"
      >
        <span class="thumb" :style="{ backgroundImage: `url('${toCdn(p.flatImg || p.img, 400)}')` }"></span>
        <span class="name">{{ p.name || '자재' }}</span>
        <!-- 대분류(구분) / 소분류(종류) · 가로×세로(mm) -->
        <span class="brand">{{ [p.category, p.subCategory].filter(Boolean).join(' / ') }}</span>
        <span v-if="sizeWxL(p.size)" class="size">{{ sizeWxL(p.size) }}</span>
      </button>
      <div v-if="loadingMore" class="mp-more-msg">불러오는 중…</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import { type MacodiProduct, colorSearchProducts, searchProducts, toCdn } from './api'
import useInsertSpecCard from './useInsertSpecCard'
import ColorFilter from './ColorFilter.vue'
import { sizeWxL } from './sizeFormat'
import { ai, logPick, search, startManual, stopAi, thumbOf } from './aiRegion'

const q = ref('') // 입력 중인 글자
const keywords = ref<string[]>([]) // 고정된 키워드 칩
const kwInputRef = ref<HTMLInputElement>()
const color = ref<string | null>(null) // '#' 없는 6자리 hex
const products = ref<MacodiProduct[]>([])
const status = ref('')
const isErr = ref(false)
let req = 0

const setStatus = (t: string, err = false) => {
  status.value = t
  isErr.value = err
}

// 페이지 단위로 이어 불러오기(스크롤 끝에 닿으면 다음 페이지) — 전체 자재(약 1.9만 개)를 다 볼 수 있게
let page = 1
let seed: number | undefined
const hasMore = ref(false)
const loadingMore = ref(false)
const fetchPage = (pg: number) => {
  const txt = keywords.value.join(' ') // 띄어쓰기로 이으면 모두 만족(AND) 검색
  return color.value ? colorSearchProducts(color.value, txt, pg, pg === 1 ? 0 : products.value.length) : searchProducts(txt, pg, pg === 1 ? undefined : seed)
}
const load = () => {
  const my = ++req
  page = 1
  seed = undefined
  hasMore.value = false
  setStatus('불러오는 중…')
  fetchPage(1)
    .then(r => {
      if (my !== req) return
      products.value = r.list.filter(p => p && p.img)
      hasMore.value = r.hasMore
      seed = r.randSeed
      setStatus(products.value.length ? '' : '검색 결과가 없습니다.')
    })
    .catch(() => {
      if (my !== req) return
      setStatus('자재를 불러오지 못했습니다. 네트워크를 확인하세요.', true)
    })
}
const loadMore = () => {
  if (!hasMore.value || loadingMore.value) return
  const my = req
  loadingMore.value = true
  fetchPage(page + 1)
    .then(r => {
      if (my !== req) return
      page++
      const seen = new Set(products.value.map(p => p.id))
      products.value = products.value.concat(r.list.filter(p => p && p.img && !seen.has(p.id)))
      hasMore.value = r.hasMore
    })
    .catch(() => { /* 다음 스크롤 때 다시 시도 */ })
    .finally(() => {
      if (my === req) loadingMore.value = false
    })
}
const gridRef = ref<HTMLElement>()
const nearEnd = (el: HTMLElement) => el.scrollTop + el.clientHeight > el.scrollHeight - 600
const onGridScroll = () => {
  if (gridRef.value && nearEnd(gridRef.value)) loadMore()
}
// 패널이 넓어 첫 페이지가 화면을 다 못 채우면(스크롤이 안 생기면) 이어서 불러오기
watch([products, loadingMore], () => nextTick(() => {
  if (!loadingMore.value) onGridScroll()
}))

const { insertSpecCard } = useInsertSpecCard()
const insert = (p: MacodiProduct) => {
  setStatus(`"${p.name || '자재'}" 삽입 중…`)
  insertSpecCard(p)
    .then(() => setStatus(`삽입 완료: ${p.name || '자재'}`))
    .catch(e => setStatus((e && e.message) || '삽입하지 못했습니다.', true))
}

// AI 검색 대상 = 현재 슬라이드 화면 전체
const { currentSlide } = storeToRefs(useSlidesStore())
const toggle = () => {
  if (ai.active) {
    stopAi()
    return
  }
  setStatus('')
  color.value = null // 영역 검색 시작 = 컬러 필터 해제
  startManual()
}
// 슬라이드를 바꾸면 AI 모드 종료(대상 화면이 바뀜)
watch(() => currentSlide.value?.id, () => {
  if (ai.active) stopAi()
})

const insertAi = (p: MacodiProduct) => {
  insert(p)
  logPick(p.id)
}

// 색을 고르거나 해제하면 검색어와 함께 바로 다시 검색. 색을 고르면 영역 검색은 끝냄(둘은 서로 리셋)
watch(color, v => {
  if (v && ai.active) stopAi()
  load()
})
// 텍스트 검색도 일반 목록으로 — 영역 검색 중이면 끝냄
const submitSearch = () => {
  if (ai.active) stopAi()
  // 입력한 글자를 칩으로 고정(띄어쓴 단어는 각각 칩), 중복 제외
  const add = q.value.trim().split(/\s+/).filter(w => w && !keywords.value.includes(w))
  keywords.value = [...keywords.value, ...add]
  q.value = ''
  load()
}
const removeKeyword = (i: number) => {
  keywords.value = keywords.value.filter((_, j) => j !== i)
  if (ai.active) stopAi()
  load()
}
// 빈 입력칸에서 Backspace = 마지막 칩 삭제
const onKwBackspace = () => {
  if (!q.value && keywords.value.length) removeKeyword(keywords.value.length - 1)
}
onMounted(load)
</script>

<style lang="scss" scoped>
.macodi-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f7fa;
  font-family: 'Pretendard', 'Malgun Gothic', sans-serif;
  font-size: 13px;
  color: #222;
}
.mp-search .ai-sq {
  flex: none;
  width: 36px;
  min-height: 34px;
  padding: 0;
  border: 1.5px dashed #b5b5bd;
  border-radius: 8px;
  background: #fff;
  color: #6c6c76;
  font: inherit;
  font-size: 19.5px; // 13px × 1.5
  font-weight: 800;
  letter-spacing: -0.5px;
  cursor: pointer;
  &:hover { border-color: #6c2bd9; color: #6c2bd9; }
  &.on { border-style: solid; border-color: #6c2bd9; background: #6c2bd9; color: #fff; }
}
.mp-ai {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  .mp-grid { flex: none; overflow: visible; }
}
.mp-sec {
  padding: 8px 12px 6px;
  font-size: 12px;
  font-weight: 700;
  color: #333;
}
.mp-more-msg {
  grid-column: 1 / -1;
  padding: 10px;
  text-align: center;
  font-size: 12px;
  color: #999;
}
.mp-more {
  grid-column: 1 / -1;
  padding: 8px;
  border: 1px solid #e7e7ee;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  cursor: pointer;
}
.mp-search {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #e7e7ee;

  .kw-box {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border: 1px solid #e7e7ee;
    border-radius: 8px;
    cursor: text;
    &:focus-within { border-color: #6c2bd9; }
    input {
      flex: 1;
      min-width: 60px;
      padding: 3px 2px;
      border: none;
      outline: none;
      font: inherit;
      background: transparent;
    }
  }
  // 칩 — 글자 외곽 박스 + 우상단 동그라미 ×(컬러 필터와 같은 모양)
  .kw-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 3px 13px 3px 9px; // 오른쪽은 × 자리만큼 넉넉히
    margin-right: 4px;
    border: 1px solid #cfcfd8;
    border-radius: 6px;
    background: #f6f5fb;
    font-size: 12px;
    font-weight: 600;
    color: #333;
    white-space: nowrap;
  }
  .kw-x {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #333;
    color: #fff;
    font-size: 11px;
    line-height: 16px;
    text-align: center;
    cursor: pointer;
    &:hover { background: #6c2bd9; }
  }
  button {
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: #6c2bd9;
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
}
.mp-status {
  padding: 6px 12px;
  &:empty { display: none; }
  font-size: 12px;
  color: #888;
  &.err { color: #d33; }
}
.mp-grid {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); // 패널을 넓히면 열 수가 늘어남
  grid-auto-rows: max-content; // 그리드가 스크롤 영역이라 줄이 남은 높이에 맞춰 눌리지 않게(카드 overflow:hidden → 최소 높이 0)
  gap: 10px;
  align-content: start;
}
.mp-card {
  display: flex;
  flex-direction: column;
  padding: 0 0 7px;
  background: #fff;
  border: 1px solid #e7e7ee;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  font: inherit;
  &:hover { box-shadow: 0 4px 14px rgba(108, 43, 217, .18); }

  .thumb {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #eee center / cover no-repeat;
  }
  .name {
    padding: 6px 8px 0;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    // PPT 애드인 카드와 같이 두 줄까지
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
  }
  .brand {
    padding: 2px 8px 0;
    font-size: 11px;
    color: #999;
    @include ellipsis-oneline();
  }
  .size {
    padding: 1px 8px 0;
    font-size: 11px;
    color: #6c6c76;
    @include ellipsis-oneline();
  }
}
</style>
