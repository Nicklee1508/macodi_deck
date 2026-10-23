<template>
  <!-- 캔버스 안 AI 검색 레이어
       · [AI 영역 검색] 스마트 올가미: 손으로 둘러 그리면(레인보우 글로우 궤적) 실제 경계에 붙은 다각형 면으로 선택.
         처음 한 번은 시범 선이 자동으로 그려진다(튜토리얼).
       선택 영역 밖은 반투명 검정(0.28), 선택 윤곽은 파란 실선. -->
  <div v-if="ai.active" class="ai-layer">
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
        <mask v-if="activePoly" id="deck-sel-mask">
          <rect width="100%" height="100%" fill="white" />
          <path :d="activePoly" fill="black" fill-rule="evenodd" />
        </mask>
      </defs>
      <!-- 선택 영역 밖 반투명 검정 -->
      <rect v-if="activePoly && !points.length" width="100%" height="100%" fill="rgba(0,0,0,0.28)" mask="url(#deck-sel-mask)" />
      <!-- 영역 윤곽(채움 없음) — 선택은 파란 실선 -->
      <path
        v-for="r in ai.regions"
        v-show="!points.length"
        :key="r.label"
        :d="polyPx(r)"
        fill="none"
        fill-rule="evenodd"
        :stroke="r.label === ai.activeLabel ? '#2E90FA' : 'rgba(255,255,255,0.85)'"
        :stroke-width="r.label === ai.activeLabel ? 3 : 1.5"
        :stroke-dasharray="r.label === ai.activeLabel ? undefined : '6 4'"
        :style="r.label === ai.activeLabel ? 'filter: drop-shadow(0 0 4px rgba(46,144,250,.8))' : undefined"
      />
      <!-- 그리는 중(또는 시범): 레인보우 글로우 궤적 -->
      <template v-if="pathD">
        <path :d="pathD" stroke="url(#deck-rainbow)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.55" style="filter: blur(8px)" />
        <path :d="pathD" stroke="url(#deck-rainbow)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85" style="filter: blur(3px)" />
        <path :d="pathD" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </template>
    </svg>

    <div class="ai-bar" @pointerdown.stop @mousedown.stop>
      <span class="ai-tag">{{ tagText }}</span>
      <button type="button" class="ai-chip ai-end" title="끝내기 (Esc)" @click="stopAi">✕</button>
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
import { ai, loadImage, searchLasso, setCapturer, stopAi, type AiRegion } from './aiRegion'

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

// 윤곽 고리들(바깥+구멍) → SVG path(evenodd 로 구멍 제외)
const polyPx = (r: AiRegion) => r.loops
  .map(loop => 'M' + loop.map(([x, y]) => `${(x * W.value).toFixed(1)},${(y * H.value).toFixed(1)}`).join('L') + 'Z')
  .join('')
const activePoly = computed(() => {
  const r = ai.regions.find(x => x.label === ai.activeLabel)
  return r && W.value ? polyPx(r) : ''
})

const tagText = computed(() => {
  if (ai.demo) return '이렇게 둘러 그려보세요'
  return ai.regions.length ? 'AI 영역 검색' : 'AI 영역 검색 · 찾을 곳을 둘러 그리세요'
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
  searchLasso(stroke)
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
        if (ai.demo === stroke) searchLasso(stroke)
      }, 250)
    }
  }
  demoRaf = requestAnimationFrame(step)
})
onBeforeUnmount(() => cancelAnimationFrame(demoRaf))

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && ai.active) stopAi()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
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
  cursor: crosshair;
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
.ai-chip {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: 999px;
  background: rgba(255, 255, 255, .88);
  color: #111;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  &.ai-end { border-color: transparent; background: rgba(17, 17, 17, .6); color: #fff; }
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
