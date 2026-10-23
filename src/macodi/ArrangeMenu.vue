<template>
  <!-- PPT '정렬' 메뉴와 같은 구성: 개체 순서 · 개체 그룹 · 맞춤 · 회전 · 선택 창 -->
  <div class="arrange-menu">
    <div class="am-title">개체 순서</div>
    <div class="am-item" :class="{ off: !one }" @click="order(ElementOrderCommands.TOP)"><i-icon-park-outline:bring-to-front class="ic" /> 맨 앞으로 가져오기</div>
    <div class="am-item" :class="{ off: !one }" @click="order(ElementOrderCommands.BOTTOM)"><i-icon-park-outline:send-to-back class="ic" /> 맨 뒤로 보내기</div>
    <div class="am-item" :class="{ off: !one }" @click="order(ElementOrderCommands.UP)"><i-icon-park-outline:bring-forward class="ic" /> 앞으로 가져오기</div>
    <div class="am-item" :class="{ off: !one }" @click="order(ElementOrderCommands.DOWN)"><i-icon-park-outline:send-backward class="ic" /> 뒤로 보내기</div>

    <div class="am-title">개체 그룹</div>
    <div class="am-item" :class="{ off: !canCombine }" @click="canCombine && run(combineElements)"><i-icon-park-outline:group class="ic" /> 그룹 <span class="hk">Ctrl+G</span></div>
    <div class="am-item" :class="{ off: !canUncombine }" @click="canUncombine && run(uncombineElements)"><i-icon-park-outline:ungroup class="ic" /> 그룹 해제 <span class="hk">Ctrl+Shift+G</span></div>
    <div class="am-item" :class="{ off: !canRegroup }" @click="canRegroup && run(regroup)"><i-icon-park-outline:refresh class="ic" /> 재그룹</div>

    <div class="am-title">맞춤</div>
    <div class="am-row">
      <div class="am-item" :class="{ off: !any }" @click="align(ElementAlignCommands.LEFT)"><i-icon-park-outline:align-left class="ic" /> 왼쪽 맞춤</div>
      <div class="am-item" :class="{ off: !any }" @click="align(ElementAlignCommands.TOP)"><i-icon-park-outline:align-top class="ic" /> 위쪽 맞춤</div>
      <div class="am-item" :class="{ off: !any }" @click="align(ElementAlignCommands.HORIZONTAL)"><i-icon-park-outline:align-horizontally class="ic" /> 가운데 맞춤</div>
      <div class="am-item" :class="{ off: !any }" @click="align(ElementAlignCommands.VERTICAL)"><i-icon-park-outline:align-vertically class="ic" /> 중간 맞춤</div>
      <div class="am-item" :class="{ off: !any }" @click="align(ElementAlignCommands.RIGHT)"><i-icon-park-outline:align-right class="ic" /> 오른쪽 맞춤</div>
      <div class="am-item" :class="{ off: !any }" @click="align(ElementAlignCommands.BOTTOM)"><i-icon-park-outline:align-bottom class="ic" /> 아래쪽 맞춤</div>
    </div>
    <div class="am-item" :class="{ off: displayItemCount < 3 }" @click="displayItemCount >= 3 && run(uniformHorizontalDisplay)"><i-icon-park-outline:distribute-horizontal-spacing class="ic" /> 가로 간격을 동일하게</div>
    <div class="am-item" :class="{ off: displayItemCount < 3 }" @click="displayItemCount >= 3 && run(uniformVerticalDisplay)"><i-icon-park-outline:distribute-vertical-spacing class="ic" /> 세로 간격을 동일하게</div>
    <div class="am-item" :class="{ off: !any }" @click="toSlide = true"><span class="chk">{{ alignToSlide ? '✓' : '' }}</span> 슬라이드에 맞춤</div>
    <div class="am-item" :class="{ off: units < 2 }" @click="units >= 2 && (toSlide = false)"><span class="chk">{{ alignToSlide ? '' : '✓' }}</span> 선택한 개체 맞춤</div>

    <div class="am-title">회전</div>
    <div class="am-row">
      <div class="am-item" :class="{ off: !any }" @click="rotate(90)"><i-icon-park-outline:rotate class="ic flip" /> 오른쪽으로 90° 회전</div>
      <div class="am-item" :class="{ off: !any }" @click="rotate(-90)"><i-icon-park-outline:rotate class="ic" /> 왼쪽으로 90° 회전</div>
      <div class="am-item" :class="{ off: !any }" @click="flip('flipV')"><i-icon-park-outline:flip-vertically class="ic" /> 상하 대칭</div>
      <div class="am-item" :class="{ off: !any }" @click="flip('flipH')"><i-icon-park-outline:flip-horizontally class="ic" /> 좌우 대칭</div>
    </div>

    <div class="am-sep"></div>
    <div class="am-item" @click="openSelectPanel"><i-icon-park-outline:layers class="ic" /> 선택 창</div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import { ElementAlignCommands, ElementOrderCommands } from '@/types/edit'
import type { PPTElement } from '@/types/slides'
import { getElementListRange } from '@/utils/element'
import useOrderElement from '@/hooks/useOrderElement'
import useCombineElement, { lastUngroup } from '@/hooks/useCombineElement'
import useAlignActiveElement from '@/hooks/useAlignActiveElement'
import useUniformDisplayElement from '@/hooks/useUniformDisplayElement'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

const emit = defineEmits<{ (e: 'done'): void }>()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { activeElementIdList, activeElementList, handleElement } = storeToRefs(mainStore)
const { currentSlide, viewportSize, viewportRatio } = storeToRefs(slidesStore)
const { orderElement } = useOrderElement()
const { canCombine, canUncombine, combineElements, uncombineElements } = useCombineElement()
const { alignActiveElement } = useAlignActiveElement()
const { displayItemCount, uniformHorizontalDisplay, uniformVerticalDisplay } = useUniformDisplayElement()
const { addHistorySnapshot } = useHistorySnapshot()

const any = computed(() => activeElementIdList.value.length > 0)
const one = computed(() => !!handleElement.value)

// 그룹은 한 덩어리로 센 선택 개수
const units = computed(() => new Set(activeElementList.value.map(el => el.groupId || el.id)).size)
// PPT 와 같음: 한 개만 고르면 슬라이드에 맞춤, 여러 개면 선택한 개체끼리(직접 바꿀 수 있음)
const toSlide = ref<boolean | null>(null)
const alignToSlide = computed(() => toSlide.value ?? units.value < 2)

const run = (fn: () => void) => {
  fn()
  emit('done')
}

const order = (cmd: ElementOrderCommands) => {
  if (!handleElement.value) return
  orderElement(handleElement.value, cmd)
  emit('done')
}

const canRegroup = computed(() => {
  const ids = lastUngroup.ids
  return ids.length > 1 && ids.every(id => currentSlide.value?.elements.some(el => el.id === id))
})
const regroup = () => {
  mainStore.setActiveElementIdList([...lastUngroup.ids])
  combineElements()
  lastUngroup.ids = []
}

/** 슬라이드에 맞춤 — 그룹은 한 덩어리로, 각 덩어리를 슬라이드 가장자리·가운데에 */
const alignEachToSlide = (cmd: ElementAlignCommands) => {
  const W = viewportSize.value, H = viewportSize.value * viewportRatio.value
  const list: PPTElement[] = JSON.parse(JSON.stringify(currentSlide.value.elements))
  const unitsMap = new Map<string, PPTElement[]>()
  for (const el of list) {
    if (!activeElementIdList.value.includes(el.id)) continue
    const k = el.groupId || el.id
    unitsMap.set(k, [...(unitsMap.get(k) || []), el])
  }
  for (const members of unitsMap.values()) {
    const { minX, maxX, minY, maxY } = getElementListRange(members)
    let dx = 0, dy = 0
    if (cmd === ElementAlignCommands.LEFT) dx = -minX
    if (cmd === ElementAlignCommands.RIGHT) dx = W - maxX
    if (cmd === ElementAlignCommands.HORIZONTAL) dx = (W - (maxX - minX)) / 2 - minX
    if (cmd === ElementAlignCommands.TOP) dy = -minY
    if (cmd === ElementAlignCommands.BOTTOM) dy = H - maxY
    if (cmd === ElementAlignCommands.VERTICAL) dy = (H - (maxY - minY)) / 2 - minY
    for (const el of members) {
      el.left += dx
      el.top += dy
    }
  }
  slidesStore.updateSlide({ elements: list })
  addHistorySnapshot()
}

const align = (cmd: ElementAlignCommands) => {
  if (!any.value) return
  if (alignToSlide.value) alignEachToSlide(cmd)
  else alignActiveElement(cmd)
  emit('done')
}

const rotate = (deg: number) => {
  if (!any.value) return
  for (const el of activeElementList.value) {
    if (el.type === 'line') continue
    let r = ((el.rotate || 0) + deg) % 360
    if (r > 180) r -= 360
    if (r <= -180) r += 360
    slidesStore.updateElement({ id: el.id, props: { rotate: r } })
  }
  addHistorySnapshot()
  emit('done')
}

const flip = (key: 'flipH' | 'flipV') => {
  if (!any.value) return
  for (const el of activeElementList.value) {
    if (el.type !== 'image' && el.type !== 'shape') continue
    slidesStore.updateElement({ id: el.id, props: { [key]: !el[key] } })
  }
  addHistorySnapshot()
  emit('done')
}

const openSelectPanel = () => {
  mainStore.setSelectPanelState(true)
  emit('done')
}
</script>

<style lang="scss" scoped>
.arrange-menu {
  width: 300px;
  max-height: 75vh;
  overflow-y: auto;
  padding: 4px 2px;
  font-size: 13px;
  user-select: none;
}
.am-title {
  margin: 8px 6px 4px;
  font-size: 12px;
  font-weight: 700;
  color: #333;
  &:first-child { margin-top: 2px; }
}
.am-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.am-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  color: #222;
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(.off) { background: #EEF2EE; color: $themeColor; }
  &.off { color: #bbb; cursor: default; }
  .ic { font-size: 15px; flex: none; }
  .ic.flip { transform: scaleX(-1); }
  .hk { margin-left: auto; font-size: 11px; color: #aaa; }
  .chk { width: 15px; text-align: center; color: $themeColor; font-weight: 700; }
}
.am-sep {
  height: 1px;
  margin: 6px 0;
  background: $borderColor;
}
</style>
