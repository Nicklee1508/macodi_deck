<template>
  <!-- 캔버스 안 AI 검색 레이어 — 마코디 웹 AI 영역 검색과 같은 모양
       · 손으로 그리면 레인보우 글로우 궤적 → 놓으면 궤적 바깥 사각형이 라운드 박스(흰 모서리 브래킷)로.
       · 박스 밖은 반투명 검정(0.28). 모서리 = 크기 조절, 안쪽 잡고 끌기 = 이동 → 놓으면 다시 검색.
       · 버튼을 누를 때마다 시범 선이 자동으로 그려진다(튜토리얼). -->
  <div v-if="ai.active && !ai.paused" class="ai-layer">
    <div
      ref="hitRef"
      class="ai-hit"
      @pointerdown.stop.prevent="onDrawStart"
      @pointermove="onDrawMove"
      @pointerup="onDrawEnd"
      @pointercancel="onDrawEnd"
      @mousedown.stop
      @dblclick.stop
      @contextmenu.stop.prevent
    ></div>

    <svg v-if="W" class="ai-svg" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`">
      <defs>
        <linearGradient id="deck-rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4f7cff" />
          <stop offset="20%" stop-color="#8a5cf6" />
          <stop offset="40%" stop-color="#ec4899" />
          <stop offset="60%" stop-color="#f97316" />
          <stop offset="80%" stop-color="#facc15" />
          <stop offset="100%" stop-color="#4ade80" />
        </linearGradient>
        <mask v-if="boxPx" id="deck-box-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect :x="boxPx.x" :y="boxPx.y" :width="boxPx.w" :height="boxPx.h" rx="10" ry="10" fill="black" />
        </mask>
      </defs>
      <!-- 박스 밖 반투명 검정 -->
      <rect v-if="boxPx && !points.length" width="100%" height="100%" fill="rgba(0,0,0,0.28)" mask="url(#deck-box-mask)" />
      <!-- 그리는 중(또는 시범): 레인보우 글로우 궤적 -->
      <template v-if="pathD">
        <path :d="pathD" stroke="url(#deck-rainbow)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.55" style="filter: blur(8px)" />
        <path :d="pathD" stroke="url(#deck-rainbow)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85" style="filter: blur(3px)" />
        <path :d="pathD" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </template>
    </svg>

    <!-- 라운드 박스 + 흰 모서리 브래킷(웹 BoxFrame) -->
    <div
      v-if="boxPx && !points.length"
      :key="boxKey"
      class="ai-box"
      :style="{ left: boxPx.x + 'px', top: boxPx.y + 'px', width: boxPx.w + 'px', height: boxPx.h + 'px' }"
    >
      <div
        class="ai-box-body"
        @pointerdown.stop.prevent="e => dragStart(e, 'move')"
        @pointermove="dragMove"
        @pointerup="dragEnd"
        @pointercancel="dragEnd"
        @mousedown.stop
      ></div>
      <span
        v-for="c in CORNERS"
        :key="c"
        class="bracket"
        :class="c"
        @pointerdown.stop.prevent="e => dragStart(e, c)"
        @pointermove="dragMove"
        @pointerup="dragEnd"
        @pointercancel="dragEnd"
        @mousedown.stop
      ></span>
    </div>

    <div class="ai-bar" @pointerdown.stop @mousedown.stop>
      <span class="ai-tag">{{ tagText }}</span>
    </div>
    <div v-if="ai.msg" class="ai-msg">{{ ai.msg }}</div>
  </div>

  <!-- 슬라이드 촬영용(화면 밖) — 편집 표시 없이 내용만 큰 해상도로 -->
  <div v-if="capturing && currentSlide" class="ai-capture">
    <div ref="capRef">
      <ThumbnailSlide :slide="currentSlide" :size="CAPTURE_W" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toJpeg } from 'html-to-image'
import { useSlidesStore } from '@/store'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import { type SrcBox, ai, loadImage, searchArea, searchStroke, setCapturer, stopAi } from './aiRegion'

const CAPTURE_W = 1600
const { currentSlide } = storeToRefs(useSlidesStore())

/* ---- 슬라이드 촬영 ---- */
const capturing = ref(false)
const capRef = ref<HTMLElement>()
const waitImages = (root: HTMLElement) => Promise.all(
  Array.from(root.querySelectorAll('img')).map(img => (img.complete ? Promise.resolve() : new Promise<void>(res => {
    img.onload = () => res()
    img.onerror = () => res()
  }))),
)
const captureSlide = async (): Promise<HTMLImageElement> => {
  capturing.value = true
  try {
    await nextTick()
    const el = capRef.value
    if (!el) throw new Error('캔버스가 준비되지 않았어요.')
    el.querySelectorAll('foreignObject [xmlns]').forEach(n => n.removeAttribute('xmlns')) // PPTist 내보내기와 동일 처리
    await waitImages(el)
    const url = await toJpeg(el.firstElementChild as HTMLElement, { quality: 0.92, fontEmbedCSS: '', pixelRatio: 1 })
    return await loadImage(url)
  }
  finally {
    capturing.value = false
  }
}
onMounted(() => setCapturer(captureSlide))
onBeforeUnmount(() => setCapturer(null))

/* ---- 레이어 크기(px) — 확대/축소·패널 너비 변경에 따라 ---- */
const hitRef = ref<HTMLElement>()
const W = ref(0)
const H = ref(0)
let ro: ResizeObserver | null = null
watch(hitRef, el => {
  ro?.disconnect()
  if (!el) {
    W.value = 0
    H.value = 0
    return
  }
  const sync = () => {
    W.value = el.clientWidth
    H.value = el.clientHeight
  }
  sync()
  ro = new ResizeObserver(sync)
  ro.observe(el)
})
onBeforeUnmount(() => ro?.disconnect())

/* ---- 박스(슬라이드 기준 0~1) — 끄는 중엔 화면 박스만 바꾸고, 놓을 때 검색 ---- */
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const
type Corner = typeof CORNERS[number]
const dragBox = ref<SrcBox | null>(null)
const shown = computed(() => dragBox.value || ai.box)
const boxPx = computed(() => {
  const b = shown.value
  return b && W.value ? { x: b.x * W.value, y: b.y * H.value, w: b.w * W.value, h: b.h * H.value } : null
})
const boxKey = computed(() => (ai.box ? `${ai.box.x}:${ai.box.y}:${ai.box.w}` : '')) // 새 박스마다 등장 애니메이션
let drag: { mode: Corner | 'move'; sx: number; sy: number; start: SrcBox } | null = null
const dragStart = (e: PointerEvent, mode: Corner | 'move') => {
  if (!ai.box) return
  drag = { mode, sx: e.clientX, sy: e.clientY, start: { ...ai.box } }
  dragBox.value = { ...ai.box }
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  catch { /* 무시 */ }
}
const dragMove = (e: PointerEvent) => {
  if (!drag || !W.value) return
  const dx = (e.clientX - drag.sx) / W.value, dy = (e.clientY - drag.sy) / H.value
  const s = drag.start
  const MINW = 30 / W.value, MINH = 30 / H.value
  if (drag.mode === 'move') {
    dragBox.value = { ...s, x: Math.min(1 - s.w, Math.max(0, s.x + dx)), y: Math.min(1 - s.h, Math.max(0, s.y + dy)) }
    return
  }
  let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h
  if (drag.mode === 'tl' || drag.mode === 'bl') x1 = Math.max(0, Math.min(x2 - MINW, x1 + dx))
  else x2 = Math.min(1, Math.max(x1 + MINW, x2 + dx))
  if (drag.mode === 'tl' || drag.mode === 'tr') y1 = Math.max(0, Math.min(y2 - MINH, y1 + dy))
  else y2 = Math.min(1, Math.max(y1 + MINH, y2 + dy))
  dragBox.value = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}
const dragEnd = () => {
  if (!drag) return
  drag = null
  const b = dragBox.value
  if (b) searchArea(b) // ai.box 를 먼저 바꾼 뒤 끌던 박스를 지워 깜빡임 없게
  dragBox.value = null
}

const tagText = computed(() => {
  if (ai.demo) return '이렇게 그려보세요'
  return ai.box ? 'AI 영역 검색 · 모서리로 크기 조절, 안쪽을 끌어 이동' : 'AI 영역 검색 · 찾을 곳을 그리세요'
})

/* ---- 그리기(스마트 올가미) ---- */
const points = ref<{ x: number; y: number }[]>([])
let drawing = false
const local = (e: PointerEvent) => {
  const r = hitRef.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
const pathD = computed(() => (points.value.length > 1 ? 'M ' + points.value.map(p => `${p.x},${p.y}`).join(' L ') : ''))
const onDrawStart = (e: PointerEvent) => {
  if (ai.demo) { // 시범 중에 직접 그리기 시작 = 시범 멈춤
    ai.demo = null
    cancelAnimationFrame(demoRaf)
  }
  drawing = true
  points.value = [local(e)]
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  catch { /* 무시 */ }
}
const onDrawMove = (e: PointerEvent) => {
  if (drawing) points.value = [...points.value, local(e)]
}
const onDrawEnd = () => {
  if (!drawing) return
  drawing = false
  const pts = points.value
  if (pts.length < 5 || !W.value) { // 클릭만 = 무시
    points.value = []
    return
  }
  const stroke = pts.map(p => [Math.min(1, Math.max(0, p.x / W.value)), Math.min(1, Math.max(0, p.y / H.value))] as [number, number])
  points.value = []
  searchStroke(stroke)
}

/* ---- 튜토리얼: 시범 선을 손으로 그리듯 1.4초에 걸쳐 그린 뒤 그 선으로 검색 ---- */
let demoRaf = 0
watch(() => ai.demo, stroke => {
  cancelAnimationFrame(demoRaf)
  if (!stroke || !stroke.length) return
  const start = performance.now(), DUR = 1400
  const step = (t: number) => {
    if (ai.demo !== stroke || !W.value) {
      points.value = []
      return
    }
    const k = Math.min(1, (t - start) / DUR)
    const n = Math.max(2, Math.round(stroke.length * k))
    points.value = stroke.slice(0, n).map(([x, y]) => ({ x: x * W.value, y: y * H.value }))
    if (k < 1) demoRaf = requestAnimationFrame(step)
    else {
      setTimeout(() => {
        points.value = []
        if (ai.demo === stroke) searchStroke(stroke)
      }, 250)
    }
  }
  demoRaf = requestAnimationFrame(step)
})
onBeforeUnmount(() => cancelAnimationFrame(demoRaf))

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && ai.active && !ai.paused) stopAi()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// 켜진 상태에서 캔버스의 영역 잡기·마코디 패널(키워드·추천 결과·AI 버튼) 말고 다른 곳을 누르면 끔
const onOutsideDown = (e: PointerEvent) => {
  if (!ai.active || ai.paused) return
  const t = e.target as Element | null
  if (t && t.closest && t.closest('.ai-layer, .macodi-panel, .mobile-material')) return
  stopAi()
}
onMounted(() => window.addEventListener('pointerdown', onOutsideDown, true))
onBeforeUnmount(() => window.removeEventListener('pointerdown', onOutsideDown, true))
</script>

<style lang="scss" scoped>
.ai-layer {
  position: absolute;
  inset: 0;
  z-index: 100;
}
.ai-hit {
  position: absolute;
  inset: 0;
  // 펜 모양 포인터(펜 끝 = 왼쪽 아래가 찍히는 점)
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24'%3E%3Cpath d='M3 21l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L7.6 19.8z' fill='%23ffffff' stroke='%23222222' stroke-width='1.6' stroke-linejoin='round'/%3E%3Cpath d='M14.8 5.8l3.4 3.4' stroke='%23222222' stroke-width='1.6'/%3E%3Cpath d='M3 21l1.2-4.6 3.4 3.4z' fill='%23D4A24C'/%3E%3C/svg%3E") 2 24, crosshair;
  touch-action: none;
  outline: 2px dashed rgba(46, 144, 250, .7); // 색 채움 없음 — 마감재 색이 달라 보이지 않게
}
.ai-svg {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  overflow: visible;
}

@keyframes ai-frame {
  0% { opacity: 0; transform: scale(.88); }
  60% { opacity: 1; transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ai-bracket {
  0% { opacity: 0; transform: scale(.4); }
  100% { opacity: 1; transform: scale(1); }
}
// 웹 BoxFrame/BoxBody 와 같은 모양
.ai-box {
  position: absolute;
  z-index: 1;
  border-radius: 12px;
  pointer-events: none;
  animation: ai-frame .34s cubic-bezier(.2, .8, .2, 1) both;
}
.ai-box-body {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: auto;
  touch-action: none;
  cursor: move;
}
.bracket {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 0 solid #fff;
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, .85));
  animation: ai-bracket .3s cubic-bezier(.2, .8, .2, 1) .08s both;
  &:active { cursor: grabbing; }
  &::before { // 잡기 쉬운 넓은 손잡이
    content: '';
    position: absolute;
    inset: -10px;
  }
  &.tl { top: -2px; left: -2px; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 12px; }
  &.tr { top: -2px; right: -2px; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 12px; }
  &.bl { bottom: -2px; left: -2px; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 12px; }
  &.br { bottom: -2px; right: -2px; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 12px; }
}

.ai-bar {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(100% - 16px);
  font-family: 'Pretendard', 'Malgun Gothic', sans-serif;
}
// 웹 AI 창 AutoBtn 과 같은 모양
.ai-tag {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(17, 17, 17, .78);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.ai-msg {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 2;
  max-width: calc(100% - 16px);
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(200, 40, 40, .85);
  color: #fff;
  font-size: 12px;
  font-family: 'Pretendard', 'Malgun Gothic', sans-serif;
  pointer-events: none;
}
.ai-capture {
  position: fixed;
  left: -100000px;
  top: 0;
  pointer-events: none;
}
</style>
