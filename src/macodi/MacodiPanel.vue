<template>
  <div class="macodi-panel">
    <form class="mp-search" @submit.prevent="submitSearch">
      <!-- AI 영역 검색 — 컬러 필터와 같은 크기 정사각형(회색 점선). 켜진 상태에서 다시 누르면 끝내기 -->
      <!-- 처음 온 사람: AI 버튼 강조 + 안내 말풍선(한 번 누르거나 닫으면 다시 안 뜸) -->
      <div v-if="aiTip" class="ai-tip" @click.stop>
        <template v-if="ai.active && !ai.paused"><b>AI 영역 검색</b> — 슬라이드 위 찾고 싶은 마감재를 펜으로 그려 보세요. 비슷한 실제 제품을 오른쪽에 찾아 드려요.</template>
        <template v-else><b>AI 영역 검색</b> — 눌러서 슬라이드 속 마감재를 그려 보세요. 비슷한 실제 제품을 찾아 드려요.</template>
        <span class="ai-tip-x" title="닫기" @click="closeAiTip">×</span>
      </div>
      <button
        type="button"
        class="ai-sq"
        :class="{ on: ai.active && !ai.paused, pulse: aiTip }"
        :title="ai.active && !ai.paused ? 'AI 영역 검색 끝내기' : 'AI 영역 검색 — 슬라이드 위에서 찾을 곳을 둘러 그리기'"
        @click="toggle"
      >AI<span v-if="ai.active && !ai.paused" class="clr" title="AI 영역 검색 끝내기" @click.stop="stopAi">×</span></button>
      <!-- 컬러 필터 — 색과 검색어를 함께 적용. 버튼을 누르는 순간 AI 영역 검색은 꺼짐 -->
      <ColorFilter v-model="color" @open="onColorOpen" />
      <!-- 키워드 칩: 입력 후 Enter/검색 = 칩으로 고정(우상단 × 로 삭제), 여러 개면 모두 만족하는 자재(AND) -->
      <div class="kw-box" @click="kwInputRef?.focus()">
        <span v-for="(k, i) in keywords" :key="k" class="kw-chip">
          {{ k }}<span class="kw-x" title="키워드 삭제" @click.stop="removeKeyword(i)">×</span>
        </span>
        <input
          ref="kwInputRef"
          :value="q"
          type="text"
          :placeholder="keywords.length ? '키워드 추가' : '자재명·브랜드 검색 (예: 대리석)'"
          autocomplete="off"
          @input="e => (q = (e.target as HTMLInputElement).value)"
          @keydown.backspace="onKwBackspace"
          @keydown.enter.prevent="onKwEnter"
          @compositionend="onKwCompositionEnd"
        />
      </div>
    </form>
    <div class="mp-status" :class="{ err: isErr }">{{ status }}</div>

    <!-- AI 영역 검색 결과 (캔버스의 그림 위에서 영역을 고르면 여기 표시) -->
    <div v-if="ai.active" ref="aiListRef" class="mp-ai" @scroll="onAiScroll">
      <div class="mp-sec">
        {{ ai.results.length || ai.others.length ? 'AI 추천 자재' : ai.post || ai.searching ? 'AI 추천 검색 중…' : '슬라이드 위에서 찾을 곳을 둘러 그려주세요' }}
      </div>
      <div class="mp-grid">
        <button v-for="p in ai.results" :key="'ai' + p.id" type="button" class="mp-card" :title="p.name" @click="insertAi(p)">
          <span class="thumb" :style="{ backgroundImage: `url('${thumbOf(p)}')` }"></span>
          <span class="name">{{ p.name || '자재' }}</span>
          <span class="brand">{{ [p.category, p.subCategory].filter(Boolean).join(' / ') }}</span>
          <span v-if="sizeWxL(p.size)" class="size">{{ sizeWxL(p.size) }}</span>
        </button>
        <!-- 키워드는 안 맞지만 비슷한 자재 — 맞는 자재 아래에 이어서(무한 스크롤) -->
        <div v-if="ai.others.length" class="mp-loose">{{ ai.results.length ? '그 밖의 비슷한 자재' : `‘${ai.keywords.join(' ')}’이(가) 들어간 자재가 없어 가장 비슷한 자재를 보여 드려요` }}</div>
        <button v-for="p in ai.others" :key="'ao' + p.id" type="button" class="mp-card" :title="p.name" @click="insertAi(p)">
          <span class="thumb" :style="{ backgroundImage: `url('${thumbOf(p)}')` }"></span>
          <span class="name">{{ p.name || '자재' }}</span>
          <span class="brand">{{ [p.category, p.subCategory].filter(Boolean).join(' / ') }}</span>
          <span v-if="sizeWxL(p.size)" class="size">{{ sizeWxL(p.size) }}</span>
        </button>
        <div v-if="ai.searching && (ai.results.length || ai.others.length)" class="mp-more-msg">불러오는 중…</div>
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
import { ai, logPick, search as aiSearch, startManual, stopAi, thumbOf } from './aiRegion'
import { fixKoreanTypo } from './hangulFix'
import { ensureSubscribed, freeMsg, subscribeState } from './subscription'
import { fileState } from './autosave'

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
// AI 추천도 무한 스크롤 — 끝에 가까우면 다음 결과를 이어 붙임(화면이 덜 차도 자동으로)
const aiListRef = ref<HTMLElement>()
const onAiScroll = () => {
  const el = aiListRef.value
  if (el && ai.hasMore && !ai.searching && nearEnd(el)) aiSearch(ai.page + 1)
}
watch(() => [ai.results.length, ai.others.length, ai.searching], () => nextTick(onAiScroll))
const onGridScroll = () => {
  if (gridRef.value && nearEnd(gridRef.value)) loadMore()
}
// 패널이 넓어 첫 페이지가 화면을 다 못 채우면(스크롤이 안 생기면) 이어서 불러오기
watch([products, loadingMore], () => nextTick(() => {
  if (!loadingMore.value) onGridScroll()
}))

const { insertSpecCard } = useInsertSpecCard()
const insert = async (p: MacodiProduct, checked = false) => {
  if (!checked && !(await ensureSubscribed('insert'))) return // 자재 담기 = 구독 기능(무료 3개 체험 후엔 구독 팝업)
  const free = subscribeState.freeUsedNotice
  subscribeState.freeUsedNotice = false
  setStatus(`"${p.name || '자재'}" 삽입 중…`)
  insertSpecCard(p)
    .then(() => setStatus(free
      ? freeMsg()
      : `삽입 완료: ${p.name || '자재'}`))
    .catch(e => setStatus((e && e.message) || '삽입하지 못했습니다.', true))
}

// AI 검색 대상 = 현재 슬라이드 화면 전체
const { currentSlide } = storeToRefs(useSlidesStore())
// 첫 방문 안내 — 이 브라우저에서 한 번만
const AI_TIP_KEY = 'macodi.deck.aiTipSeen'
const aiTip = ref((() => {
  try {
    return !localStorage.getItem(AI_TIP_KEY)
  }
  catch {
    return false
  }
})())
const closeAiTip = () => {
  aiTip.value = false
  try {
    localStorage.setItem(AI_TIP_KEY, '1')
  }
  catch { /* 저장 불가 = 다음에 또 보임 */ }
}

const toggle = () => {
  if (aiTip.value) closeAiTip()
  if (ai.active && !ai.paused) { // 켜져 있으면 끄기(쉬는 중이면 새 영역 검색 시작)
    stopAi()
    return
  }
  setStatus('')
  color.value = null // 영역 검색 시작 = 컬러 필터 해제
  startManual()
}
// 슬라이드를 바꾸면 AI 모드 종료(대상 화면이 바뀜)
watch(() => currentSlide.value?.id, () => {
  if (ai.active && !ai.paused) stopAi() // 쉬는 중(자재 넣은 뒤)이면 추천 목록은 그대로
})

const onColorOpen = () => {
  if (ai.active && !ai.paused) stopAi() // 쉬는 중이면 색을 실제로 고를 때(watch color) 새로 검색
}

// AI 추천 자재를 넣으면: 캔버스의 영역 검색은 끄고(넣은 카드가 보이게) 추천 목록은 순서·스크롤 그대로 둠.
//  이후 컬러 선택·새 AI 영역·키워드 입력이 들어오면 그때 새로 검색
const insertAi = async (p: MacodiProduct) => {
  if (!(await ensureSubscribed('insert'))) return
  ai.paused = true
  insert(p, true) // 위에서 이미 확인함(두 번 확인하면 무료 체험이 두 번 깎임)
  logPick(p.id)
}

// 색을 고르거나 해제하면 검색어와 함께 바로 다시 검색. 색을 고르면 영역 검색은 끝냄(둘은 서로 리셋)
watch(color, v => {
  gridStale = false // 아래 load() 가 새로 검색하므로 AI 끔 처리에서 또 하지 않음
  if (v && ai.active) stopAi()
  load()
})
// 키워드 칩은 일반 목록과 AI 영역 검색 결과에 모두 AND 로 걸림 — AI 영역 검색 중이면 끄지 않고 그 결과를 다시 거름
let gridStale = false // AI 중에 키워드가 바뀌어 일반 목록이 예전 것인지
watch(keywords, k => {
  ai.keywords = [...k]
  // 자재를 넣고 쉬는 중이면 → AI 추천은 끝내고 일반 키워드 검색으로 새로
  if (ai.active && ai.paused) {
    stopAi()
    load()
  }
  else if (ai.active) {
    gridStale = true // 아래 일반 목록은 AI 를 끌 때 이 키워드로 다시 검색
    if (ai.post) aiSearch(1)
  }
}, { immediate: true })
// AI 영역 검색 중에 키워드가 바뀌었으면, AI 를 끄는 순간 일반 목록을 그 키워드로 다시 검색
watch(() => ai.active, on => {
  if (on || !gridStale) return
  gridStale = false
  load()
})
const submitSearch = () => {
  // 입력한 글자를 칩으로 고정(띄어쓴 단어는 각각 칩), 중복 제외.
  // 한글 입력기가 꺼진 채 친 단어(vpdlsxm)는 한글(페인트)로 바로잡음
  const fixed: string[] = []
  const words = q.value.trim().split(/\s+/).filter(Boolean).map(w => {
    const ko = fixKoreanTypo(w)
    if (ko) fixed.push(`${w} → ${ko}`)
    return ko || w
  })
  const add = words.filter((w, i) => !keywords.value.includes(w) && words.indexOf(w) === i)
  q.value = ''
  if (fixed.length) setStatus(`한/영 전환을 바로잡아 검색했어요: ${fixed.join(', ')}`)
  if (!add.length) return
  keywords.value = [...keywords.value, ...add]
  if (!ai.active) load()
}
const removeKeyword = (i: number) => {
  keywords.value = keywords.value.filter((_, j) => j !== i)
  if (!ai.active) load()
}
// 빈 입력칸에서 Backspace = 마지막 칩 삭제 (한글 조합 중인 글자 지우기는 제외)
const onKwBackspace = (e: KeyboardEvent) => {
  if (e.isComposing) return
  if (!q.value && keywords.value.length) removeKeyword(keywords.value.length - 1)
}
// 한글 조합 중 Enter = 마지막 글자가 확정된 뒤에 칩으로(안 그러면 '타일'이 '타'로 잘림)
let submitAfterCompose = false
const onKwEnter = (e: KeyboardEvent) => {
  if (e.isComposing) {
    submitAfterCompose = true
    return
  }
  submitSearch()
}
const onKwCompositionEnd = (e: CompositionEvent) => {
  q.value = (e.target as HTMLInputElement).value
  if (!submitAfterCompose) return
  submitAfterCompose = false
  setTimeout(submitSearch) // 조합 확정이 입력칸에 반영된 다음
}
onMounted(load)

// 처음 온 사람: 첫 화면(샘플 제안서)이 뜨면 AI 영역 검색 튜토리얼을 자동으로 한 번 보여 줌(시범 선 → 박스 → 추천)
if (aiTip.value) {
  let started = false
  watch(() => [currentSlide.value?.elements.length || 0, fileState.dialog, subscribeState.mode] as const, ([n, dialog, sub]) => {
    if (!n || dialog || sub || started) return // 첫 화면(내 파일 열기)·구독 안내창을 닫은 뒤에
    started = true
    setTimeout(() => {
      if (!ai.active && aiTip.value) {
        color.value = null
        startManual()
      }
    }, 800) // 슬라이드 그림이 그려진 뒤
  }, { immediate: true })
}
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
  position: relative;
  &.pulse {
    border-style: solid;
    border-color: #23443A;
    color: #23443A;
    animation: ai-pulse 1.4s ease-out infinite;
  }
  &:hover { border-color: #23443A; color: #23443A; }
  &.on { border-style: solid; border-color: #23443A; background: #23443A; color: #fff; }
  // 끄기 × — 컬러 필터의 색상 해제 × 와 같은 모양·위치
  .clr {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #333;
    color: #fff;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 16px;
    text-align: center;
  }
}
.mp-ai {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  .mp-grid { flex: none; overflow: visible; }
}
.mp-loose {
  grid-column: 1 / -1;
  margin: 4px 0 2px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #EEF2EE;
  color: #23443A;
  font-size: 11px;
  line-height: 1.5;
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
    &:focus-within { border-color: #23443A; }
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
    &:hover { background: #23443A; }
  }
  button {
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    background: #23443A;
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
  &:hover { box-shadow: 0 4px 14px rgba(35, 68, 58, .18); }

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
@keyframes ai-pulse {
  0% { box-shadow: 0 0 0 0 rgba(35, 68, 58, .55); }
  70% { box-shadow: 0 0 0 10px rgba(35, 68, 58, 0); }
  100% { box-shadow: 0 0 0 0 rgba(35, 68, 58, 0); }
}
.mp-search { position: relative; }
.ai-tip {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  z-index: 50;
  width: 250px;
  padding: 10px 26px 10px 12px;
  border-radius: 8px;
  background: #23443A;
  color: #fff;
  font-size: 12px;
  line-height: 1.6;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
  &::before { // 말풍선 꼬리 → AI 버튼
    content: '';
    position: absolute;
    left: 14px;
    top: -6px;
    border: 6px solid transparent;
    border-top: 0;
    border-bottom-color: #23443A;
  }
  .ai-tip-x {
    position: absolute;
    top: 4px;
    right: 8px;
    font-size: 15px;
    cursor: pointer;
    opacity: .85;
    &:hover { opacity: 1; }
  }
}
</style>
