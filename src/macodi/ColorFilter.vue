<template>
  <div class="color-filter" ref="rootRef">
    <button
      type="button"
      class="colorbtn"
      :class="{ on: !!modelValue }"
      :style="modelValue ? { background: '#' + modelValue } : undefined"
      :title="modelValue ? `컬러 필터 #${modelValue.toUpperCase()}` : '컬러 필터'"
      @click="toggleOpen"
    >
      <span v-if="modelValue" class="clr" title="색상 해제" @click.stop="clear">×</span>
    </button>

    <!-- 웹 filter/components/colorChart 이식 + 스포이드 -->
    <div v-if="open" class="colorpop">
      <button type="button" class="cc-eye" title="스포이드 — 화면 어디서든 색 가져오기" @click="eyedrop">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
      </button>
      <canvas
        ref="wheelRef"
        class="wheel"
        :width="SIZE"
        :height="SIZE"
        @mousemove="hover = wheelAt($event)"
        @mouseleave="hover = null"
        @click="pickWheel"
      ></canvas>
      <div class="cc-row">
        <span class="cc-label">색상 코드</span>
        <input
          v-model="hexInput"
          class="cc-hex"
          placeholder="#FFE997"
          maxlength="7"
          spellcheck="false"
          @focus="editing = true"
          @blur="editing = false; commitHex()"
          @keydown.enter.prevent="commitHex"
        />
        <div class="cc-preview" :style="{ background: shown ? '#' + shown : '#fff' }"></div>
      </div>
      <div class="cc-row">
        <span class="cc-label">밝&nbsp;&nbsp;기</span>
        <input v-model.number="valuePct" class="cc-slider" type="range" min="0" max="100" :style="{ background: sliderBg(valuePct) }" />
        <label class="cc-pastel"><input v-model="pastel" type="checkbox" />파스텔 톤</label>
      </div>
      <div class="cc-divider"></div>
      <div class="cc-row">
        <span class="cc-label">무채색</span>
        <div
          class="cc-gray"
          :style="{ background: grayGradient }"
          @mousemove="hover = grayAt($event)"
          @mouseleave="hover = null"
          @click="select(grayAt($event))"
        ></div>
      </div>
      <div class="cc-row">
        <span class="cc-label">색온도</span>
        <input v-model.number="warmPct" class="cc-slider" type="range" min="-100" max="100" :style="{ background: sliderBg((warmPct + 100) / 2) }" />
      </div>
      <div v-if="msg" class="cc-msg">{{ msg }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void; (e: 'open'): void }>()

const SIZE = 240
const PASTEL_MAX_SAT = 0.5

const open = ref(false)
// 팝업을 여는 순간 알림(패널이 AI 영역 검색을 끔)
const toggleOpen = () => {
  open.value = !open.value
  if (open.value) emit('open')
}
const rootRef = ref<HTMLElement>()
const wheelRef = ref<HTMLCanvasElement>()
const valuePct = ref(100)
const pastel = ref(false)
const warmPct = ref(0)
const hover = ref<string | null>(null)
const hexInput = ref('')
const editing = ref(false)
const msg = ref('')

const shown = computed(() => hover.value || props.modelValue)
watch(shown, v => {
  if (!editing.value) hexInput.value = v ? '#' + v.toUpperCase() : ''
}, { immediate: true })

const hsvToRgb = (h: number, s: number, v: number) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}
const toHex = (r: number, g: number, b: number) => [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
const grayHex = (L: number) => {
  const a = (warmPct.value / 100) * 22
  return toHex(clamp(L + a), clamp(L + a * 0.5), clamp(L - a))
}
const normalize = (input: string): string | null => {
  const v = String(input || '').trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^[0-9a-fA-F]{3}$/.test(v)) return v.split('').map(c => c + c).join('').toLowerCase()
  return null
}
const wheelColor = (angle: number, ratio: number) => {
  const value = valuePct.value / 100
  const s = pastel.value ? ratio * PASTEL_MAX_SAT : ratio
  const v = pastel.value ? 0.85 + value * 0.15 : value
  return hsvToRgb(angle, s, v)
}
const sliderBg = (pct: number) =>
  `linear-gradient(to right, #6864d0 0%, #6864d0 ${pct}%, #e6e4f5 ${pct}%, #e6e4f5 100%)`
const grayGradient = computed(() => `linear-gradient(to right, #${grayHex(0)}, #${grayHex(128)} 50%, #${grayHex(255)})`)

const drawWheel = () => {
  const ctx = wheelRef.value?.getContext('2d')
  if (!ctx) return
  const R = SIZE / 2, img = ctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - R, dy = y - R, d = Math.sqrt(dx * dx + dy * dy), i = (y * SIZE + x) * 4
      if (d > R) {
        img.data[i + 3] = 0
        continue
      }
      let a = Math.atan2(dy, dx) * 180 / Math.PI
      if (a < 0) a += 360
      const c = wheelColor(a, Math.min(d / R, 1))
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}
watch([valuePct, pastel], drawWheel)
watch(open, v => {
  msg.value = ''
  if (v) nextTick(drawWheel)
})

const wheelAt = (e: MouseEvent): string | null => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), R = SIZE / 2
  const dx = (e.clientX - r.left) / r.width * SIZE - R, dy = (e.clientY - r.top) / r.height * SIZE - R
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d > R) return null
  let a = Math.atan2(dy, dx) * 180 / Math.PI
  if (a < 0) a += 360
  const c = wheelColor(a, Math.min(d / R, 1))
  return toHex(c[0], c[1], c[2])
}
const grayAt = (e: MouseEvent) => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return grayHex(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 255)
}

const select = (hex: string) => {
  hover.value = null
  emit('update:modelValue', hex)
}
const pickWheel = (e: MouseEvent) => {
  const h = wheelAt(e)
  if (h) select(h)
}
const commitHex = () => {
  const n = normalize(hexInput.value)
  if (n && n !== props.modelValue) select(n)
  else if (!n) hexInput.value = shown.value ? '#' + shown.value.toUpperCase() : ''
}
const clear = () => {
  open.value = false
  emit('update:modelValue', null)
}

// 스포이드 — 일반 브라우저(Chrome·Edge)의 EyeDropper: 슬라이드 등 화면 어디서든 클릭한 색
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }
const eyedrop = () => {
  msg.value = ''
  const ED = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
  if (!ED) {
    msg.value = '이 브라우저는 스포이드를 지원하지 않아요. Chrome 또는 Edge 에서 사용해 주세요.'
    return
  }
  open.value = false // 스포이드로 화면을 찍는 동안 팝업이 가리지 않게 닫음
  new ED().open()
    .then(r => {
      const n = normalize(r?.sRGBHex)
      if (n) select(n)
    })
    .catch(() => { /* Esc 취소 */ })
}

// 바깥 클릭 시 닫기
const onDocDown = (e: PointerEvent) => {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocDown))
</script>

<style lang="scss" scoped>
.color-filter {
  position: relative;
  flex: none;
}
.colorbtn {
  position: relative;
  width: 36px;
  height: 100%;
  min-height: 34px;
  padding: 0;
  border: 1px solid #e7e7ee;
  border-radius: 8px;
  cursor: pointer;
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);

  &.on { border-color: #23443A; box-shadow: 0 0 0 2px #fff inset; }
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
    line-height: 16px;
    text-align: center;
  }
}
.colorpop {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 50;
  width: 272px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e7e7ee;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .14);
}
.cc-eye {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 2;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid #e0e0e0;
  border-radius: 50%;
  background: #fff;
  color: #444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .12);
  &:hover { border-color: #6864d0; color: #6864d0; background: #f1effc; }
}
.wheel {
  display: block;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  cursor: crosshair;
}
.cc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.cc-label {
  flex: none;
  width: 52px;
  font-size: 13px;
  color: #333;
  white-space: nowrap;
}
.cc-hex {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #333;
  outline: none;
  text-transform: uppercase;
  &:focus { border-color: #6864d0; }
}
.cc-preview {
  flex: none;
  width: 46px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}
.cc-slider {
  flex: 1;
  min-width: 0;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #6864d0;
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
    cursor: pointer;
  }
}
.cc-pastel {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #444;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.cc-divider {
  height: 1px;
  background: #ececec;
  margin-top: 14px;
}
.cc-gray {
  flex: 1;
  min-width: 0;
  height: 22px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  cursor: crosshair;
}
.cc-msg {
  margin-top: 10px;
  font-size: 12px;
  color: #d33;
  line-height: 1.4;
}
</style>
