<template>
  <!-- PPT '그림 형식'의 수정 · 색 · 꾸밈 효과 -->
  <div class="img-format">
    <Popover trigger="click" placement="bottom-start" v-model:value="open.fix" style="flex: 1;">
      <template #content>
        <div class="if-pop">
          <div class="if-title">밝기/대비</div>
          <div class="if-grid g5">
            <div v-for="p in correctionPresets" :key="p.label" class="if-item" :class="{ on: isOn(p, ['brightness', 'contrast']) }" :title="p.label" @click="apply(p, ['brightness', 'contrast'])">
              <img :src="src" alt="" :style="{ filter: css(p, ['brightness', 'contrast']) }" />
            </div>
          </div>
        </div>
      </template>
      <button type="button" class="if-btn"><i-icon-park-outline:sun-one class="ic" /><span>수정</span></button>
    </Popover>

    <Popover trigger="click" placement="bottom-start" v-model:value="open.color" style="flex: 1;">
      <template #content>
        <div class="if-pop">
          <div class="if-title">채도</div>
          <div class="if-grid g7">
            <div v-for="p in saturationPresets" :key="p.label" class="if-item" :class="{ on: isOn(p, ['saturate']) }" :title="p.label" @click="apply(p, ['saturate'])">
              <img :src="src" alt="" :style="{ filter: css(p, ['saturate']) }" />
            </div>
          </div>
          <div class="if-title">다시 칠하기</div>
          <div class="if-grid g7">
            <div v-for="p in recolorPresets" :key="p.label" class="if-item" :class="{ on: isOn(p, RECOLOR_KEYS) }" :title="p.label" @click="apply(p, RECOLOR_KEYS)">
              <img :src="src" alt="" :style="{ filter: css(p, RECOLOR_KEYS) }" />
            </div>
          </div>
          <div class="if-divider"></div>
          <div class="if-menu" @click="startTransparentPick"><i-icon-park-outline:magic-wand class="ic" /> 투명한 색 설정</div>
        </div>
      </template>
      <button type="button" class="if-btn"><i-icon-park-outline:color-filter class="ic" /><span>색</span></button>
    </Popover>

    <Popover trigger="click" placement="bottom-start" v-model:value="open.art" style="flex: 1;">
      <template #content>
        <div class="if-pop">
          <div class="if-title">꾸밈 효과</div>
          <div class="if-grid g5">
            <div v-for="p in artisticPresets" :key="p.label" class="if-item lbl" :class="{ on: isOn(p, ART_KEYS) }" :title="p.label" @click="apply(p, ART_KEYS)">
              <img :src="src" alt="" :style="{ filter: css(p, ART_KEYS) }" />
              <span>{{ p.label }}</span>
            </div>
          </div>
        </div>
      </template>
      <button type="button" class="if-btn"><i-icon-park-outline:magic class="ic" /><span>꾸밈 효과</span></button>
    </Popover>
  </div>
  <!-- PPT '그림 서식'처럼 직접 조절: 그림 수정 · 그림 색 · 그림 투명도 -->
  <div class="img-adjust">
    <div class="ia-sec">
      <div class="ia-title">그림 수정 <span class="ia-reset" @click="resetAdj(['sharp', 'bright', 'contrast'])">원래대로</span></div>
        <div class="ia-row">
          <span class="ia-label">선명도</span>
          <Slider class="ia-slider" :min="-100" :max="100" :step="1" :value="adj.sharp" @update:value="v => setAdj('sharp', v as number)" />
          <span class="ia-num"><input type="number" :min="-100" :max="100" :value="adj.sharp" @change="e => setAdj('sharp', +(e.target as HTMLInputElement).value)" @keydown.stop />%</span>
        </div>
        <div class="ia-row">
          <span class="ia-label">밝기</span>
          <Slider class="ia-slider" :min="-100" :max="100" :step="1" :value="adj.bright" @update:value="v => setAdj('bright', v as number)" />
          <span class="ia-num"><input type="number" :min="-100" :max="100" :value="adj.bright" @change="e => setAdj('bright', +(e.target as HTMLInputElement).value)" @keydown.stop />%</span>
        </div>
        <div class="ia-row">
          <span class="ia-label">대비</span>
          <Slider class="ia-slider" :min="-100" :max="100" :step="1" :value="adj.contrast" @update:value="v => setAdj('contrast', v as number)" />
          <span class="ia-num"><input type="number" :min="-100" :max="100" :value="adj.contrast" @change="e => setAdj('contrast', +(e.target as HTMLInputElement).value)" @keydown.stop />%</span>
        </div>
    </div>
    <div class="ia-sec">
      <div class="ia-title">그림 색 <span class="ia-reset" @click="resetAdj(['sat', 'temp'])">원래대로</span></div>
        <div class="ia-row">
          <span class="ia-label">채도</span>
          <Slider class="ia-slider" :min="0" :max="400" :step="1" :value="adj.sat" @update:value="v => setAdj('sat', v as number)" />
          <span class="ia-num"><input type="number" :min="0" :max="400" :value="adj.sat" @change="e => setAdj('sat', +(e.target as HTMLInputElement).value)" @keydown.stop />%</span>
        </div>
        <div class="ia-row">
          <span class="ia-label">온도</span>
          <Slider class="ia-slider" :min="1500" :max="11500" :step="1" :value="adj.temp" @update:value="v => setAdj('temp', v as number)" />
          <span class="ia-num"><input type="number" :min="1500" :max="11500" :value="adj.temp" @change="e => setAdj('temp', +(e.target as HTMLInputElement).value)" @keydown.stop /></span>
        </div>
    </div>
    <div class="ia-sec">
      <div class="ia-title">그림 투명도</div>
        <div class="ia-row">
          <span class="ia-label">투명도</span>
          <Slider class="ia-slider" :min="0" :max="100" :step="1" :value="adj.transp" @update:value="v => setAdj('transp', v as number)" />
          <span class="ia-num"><input type="number" :min="0" :max="100" :value="adj.transp" @change="e => setAdj('transp', +(e.target as HTMLInputElement).value)" @keydown.stop />%</span>
        </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, reactive, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useMainStore, useSlidesStore } from '@/store'
import type { ImageElementFilterKeys, ImageElementFilters, PPTImageElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import message from '@/utils/message'
import Popover from '@/components/Popover.vue'
import Slider from '@/components/Slider.vue'
import {
  type Preset, artisticPresets, correctionPresets, filtersToCss, makeColorTransparent,
  recolorPresets, saturationPresets, toImageCoord, transparentPick,
} from './imageEffects'

// 같은 묶음 안에서는 서로 바꿔 끼움(예: 다시 칠하기를 고르면 이전 다시 칠하기는 빠짐)
const RECOLOR_KEYS: ImageElementFilterKeys[] = ['grayscale', 'sepia', 'hue-rotate', 'saturate', 'brightness', 'contrast', 'invert']
const ART_KEYS: ImageElementFilterKeys[] = ['blur', 'grayscale', 'sepia', 'contrast', 'brightness', 'saturate', 'invert']

const slidesStore = useSlidesStore()
const { handleElement } = storeToRefs(useMainStore())
const el = handleElement as Ref<PPTImageElement>
const src = computed(() => el.value?.src || '')
const { addHistorySnapshot } = useHistorySnapshot()

const open = reactive({ fix: false, color: false, art: false })

/* ---- 그림 서식 직접 조절(PPT 와 같은 범위·단위) — 필터 값과 1:1 로 오감 ----
 *  선명도 -100~100(음수 = 흐리게 blur, 양수 = 선명하게 sharp) · 밝기/대비 -100~100 · 채도 0~400 · 온도 1500~11500 · 투명도 0~100 */
type AdjKey = 'sharp' | 'bright' | 'contrast' | 'sat' | 'temp' | 'transp'
const num = (v: string | undefined, d: number) => (v === undefined || v === '' ? d : parseFloat(v))
const adj = computed(() => {
  const f = el.value?.filters || {}
  const blur = num(f.blur, 0)
  return {
    sharp: blur > 0 ? -Math.round(Math.min(100, blur / 4 * 100)) : Math.round(num(f.sharp, 0)),
    bright: Math.round(num(f.brightness, 100) - 100),
    contrast: Math.round(num(f.contrast, 100) - 100),
    sat: Math.round(num(f.saturate, 100)),
    temp: Math.round(num(f.temp, 6500)),
    transp: Math.round(100 - num(f.opacity, 100)),
  }
})
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, isFinite(v) ? v : 0))
const setAdj = (key: AdjKey, raw: number) => {
  if (!el.value) return
  const f: ImageElementFilters = { ...(el.value.filters || {}) }
  const put = (k: ImageElementFilterKeys, v: string | null) => {
    if (v === null) delete f[k]
    else f[k] = v
  }
  if (key === 'sharp') {
    const v = clamp(raw, -100, 100)
    put('blur', v < 0 ? `${+(-v / 100 * 4).toFixed(2)}px` : null)
    put('sharp', v > 0 ? `${v}` : null)
  }
  if (key === 'bright') {
    const v = clamp(raw, -100, 100)
    put('brightness', v ? `${100 + v}%` : null)
  }
  if (key === 'contrast') {
    const v = clamp(raw, -100, 100)
    put('contrast', v ? `${100 + v}%` : null)
  }
  if (key === 'sat') {
    const v = clamp(raw, 0, 400)
    put('saturate', v !== 100 ? `${v}%` : null)
  }
  if (key === 'temp') {
    const v = clamp(raw, 1500, 11500)
    put('temp', v !== 6500 ? `${v}` : null)
  }
  if (key === 'transp') {
    const v = clamp(raw, 0, 100)
    put('opacity', v ? `${100 - v}%` : null)
  }
  slidesStore.updateElement({ id: el.value.id, props: { filters: f } })
  addHistorySnapshot()
}
const resetAdj = (keys: AdjKey[]) => {
  if (!el.value) return
  const f: ImageElementFilters = { ...(el.value.filters || {}) }
  const map: Record<AdjKey, ImageElementFilterKeys[]> = {
    sharp: ['sharp', 'blur'], bright: ['brightness'], contrast: ['contrast'], sat: ['saturate'], temp: ['temp'], transp: ['opacity'],
  }
  for (const k of keys) for (const fk of map[k]) delete f[fk]
  slidesStore.updateElement({ id: el.value.id, props: { filters: f } })
  addHistorySnapshot()
}

/** 지금 필터에서 group 키를 빼고 프리셋 값을 앞에 놓은 결과(프리셋 효과가 먼저 적용되게) */
const merged = (p: Preset, group: ImageElementFilterKeys[]): ImageElementFilters => {
  const rest = { ...(el.value?.filters || {}) }
  for (const k of group) delete rest[k]
  return { ...p.values, ...rest }
}
const css = (p: Preset, group: ImageElementFilterKeys[]) => filtersToCss(merged(p, group))
const isOn = (p: Preset, group: ImageElementFilterKeys[]) => {
  const cur = el.value?.filters || {}
  return group.every(k => (cur[k] || '') === (p.values[k] || '')) &&
    // '없음'류(빈 프리셋)는 해당 묶음 키가 하나도 없을 때만
    (Object.keys(p.values).length > 0 || group.every(k => !cur[k]))
}

const apply = (p: Preset, group: ImageElementFilterKeys[]) => {
  if (!el.value) return
  slidesStore.updateElement({ id: el.value.id, props: { filters: merged(p, group) } })
  addHistorySnapshot()
}

/* ---- 투명한 색 설정: 그림 위를 클릭 → 그 색이 투명 ---- */
const stopPick = () => {
  transparentPick.active = false
  transparentPick.elementId = ''
  document.body.classList.remove('mcd-pick-transparent')
  window.removeEventListener('mousedown', onPickDown, true)
  window.removeEventListener('keydown', onPickKey, true)
}
const onPickKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') stopPick()
}
const onPickDown = async (e: MouseEvent) => {
  const id = transparentPick.elementId
  const box = document.querySelector(`#editable-element-${id} .element-content`) as HTMLElement | null
  const target = slidesStore.currentSlide?.elements.find(x => x.id === id) as PPTImageElement | undefined
  if (!box || !target) return stopPick()
  const r = box.getBoundingClientRect()
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  if (!inside) return stopPick() // 그림 밖을 누르면 취소
  // 그림 이동·선택이 시작되지 않게 막음
  e.preventDefault()
  e.stopPropagation()
  const [nx, ny] = toImageCoord(target, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  stopPick()
  try {
    const out = await makeColorTransparent(target.src, nx, ny)
    slidesStore.updateElement({ id, props: { src: out } })
    addHistorySnapshot()
  }
  catch {
    message.error('이 그림에는 투명한 색을 설정할 수 없어요.')
  }
}
const startTransparentPick = () => {
  if (!el.value) return
  open.color = false
  transparentPick.active = true
  transparentPick.elementId = el.value.id
  document.body.classList.add('mcd-pick-transparent')
  window.addEventListener('mousedown', onPickDown, true)
  window.addEventListener('keydown', onPickKey, true)
  message.info('그림에서 투명하게 만들 색을 클릭하세요 (Esc 취소, 되돌리기 Ctrl+Z)')
}
onBeforeUnmount(stopPick)
</script>

<style lang="scss" scoped>
.img-format {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.if-btn {
  width: 100%;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid $borderColor;
  border-radius: $borderRadius;
  background: #fff;
  font: inherit;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  .ic { font-size: 18px; }
  &:hover { border-color: $themeColor; color: $themeColor; }
}
.if-pop {
  width: 360px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 4px;
}
.if-title {
  margin: 6px 0;
  font-size: 12px;
  font-weight: 700;
  color: #333;
}
.if-grid {
  display: grid;
  gap: 6px;
  &.g5 { grid-template-columns: repeat(5, 1fr); }
  &.g7 { grid-template-columns: repeat(7, 1fr); }
}
.if-item {
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 10px 10px; // 투명 부분 표시
  &:hover { border-color: #c9b8ef; }
  &.on { border-color: $themeColor; }
  img {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }
  &.lbl {
    background-color: #fff;
    span {
      display: block;
      padding: 2px 0;
      font-size: 10px;
      text-align: center;
      color: #555;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
.if-divider {
  height: 1px;
  margin: 10px 0 4px;
  background: $borderColor;
}
.if-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  &:hover { background: #f3effc; color: $themeColor; }
  .ic { font-size: 16px; }
}

.img-adjust {
  margin: 4px 0 6px;
}
.ia-sec {
  padding: 8px 0 4px;
  border-top: 1px solid $borderColor;
}
.ia-title {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #333;
}
.ia-reset {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: $themeColor;
  cursor: pointer;
}
.ia-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  font-size: 12px;
}
.ia-label {
  width: 44px;
  flex: none;
  color: #555;
}
.ia-slider {
  flex: 1;
  min-width: 0;
}
.ia-num {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  color: #777;
  input {
    width: 54px;
    height: 24px;
    padding: 0 4px;
    border: 1px solid $borderColor;
    border-radius: 4px;
    font: inherit;
    text-align: right;
    outline: none;
    &:focus { border-color: $themeColor; }
  }
}
</style>

<style lang="scss">
// 투명한 색 고르는 중 = 스포이드 대신 십자 커서
body.mcd-pick-transparent,
body.mcd-pick-transparent * {
  cursor: crosshair !important;
}
</style>
