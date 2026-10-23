<template>
  <div 
    class="editable-element"
    ref="elementRef"
    :id="`editable-element-${elementInfo.id}`"
    :style="{
      zIndex: elementIndex,
    }"
  >
    <component
      :is="currentElementComponent"
      :elementInfo="elementInfo"
      :selectElement="selectElement"
      :contextmenus="contextmenus"
    ></component>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { ElementTypes, type PPTElement } from '@/types/slides'
import type { ContextmenuItem } from '@/components/Contextmenu/types'

import useLockElement from '@/hooks/useLockElement'
import useDeleteElement from '@/hooks/useDeleteElement'
import useCombineElement from '@/hooks/useCombineElement'
import useOrderElement from '@/hooks/useOrderElement'
import useAlignElementToCanvas from '@/hooks/useAlignElementToCanvas'
import useCopyAndPasteElement from '@/hooks/useCopyAndPasteElement'
import useSelectElement from '@/hooks/useSelectElement'

import { ElementOrderCommands, ElementAlignCommands } from '@/types/edit'

import ImageElement from '@/views/components/element/ImageElement/index.vue'
import TextElement from '@/views/components/element/TextElement/index.vue'
import ShapeElement from '@/views/components/element/ShapeElement/index.vue'
import LineElement from '@/views/components/element/LineElement/index.vue'
import ChartElement from '@/views/components/element/ChartElement/index.vue'
import TableElement from '@/views/components/element/TableElement/index.vue'
import LatexElement from '@/views/components/element/LatexElement/index.vue'
import VideoElement from '@/views/components/element/VideoElement/index.vue'
import AudioElement from '@/views/components/element/AudioElement/index.vue'

const props = defineProps<{
  elementInfo: PPTElement
  elementIndex: number
  isMultiSelect: boolean
  selectElement: (e: MouseEvent | TouchEvent, element: PPTElement, canMove?: boolean) => void
  openLinkDialog: () => void
}>()

const currentElementComponent = computed<unknown>(() => {
  const elementTypeMap = {
    [ElementTypes.IMAGE]: ImageElement,
    [ElementTypes.TEXT]: TextElement,
    [ElementTypes.SHAPE]: ShapeElement,
    [ElementTypes.LINE]: LineElement,
    [ElementTypes.CHART]: ChartElement,
    [ElementTypes.TABLE]: TableElement,
    [ElementTypes.LATEX]: LatexElement,
    [ElementTypes.VIDEO]: VideoElement,
    [ElementTypes.AUDIO]: AudioElement,
  }
  return elementTypeMap[props.elementInfo.type] || null
})

const { orderElement } = useOrderElement()
const { alignElementToCanvas } = useAlignElementToCanvas()
const { combineElements, uncombineElements } = useCombineElement()
const { deleteElement } = useDeleteElement()
const { lockElement, unlockElement } = useLockElement()
const { copyElement, pasteElement, cutElement } = useCopyAndPasteElement()
const { selectAllElements } = useSelectElement()

const contextmenus = (): ContextmenuItem[] => {
  if (props.elementInfo.lock) {
    return [{
      text: '잠금 해제', 
      handler: () => unlockElement(props.elementInfo),
    }]
  }

  return [
    {
      text: '잘라내기',
      subText: 'Ctrl + X',
      handler: cutElement,
    },
    {
      text: '복사',
      subText: 'Ctrl + C',
      handler: copyElement,
    },
    {
      text: '붙여넣기',
      subText: 'Ctrl + V',
      handler: pasteElement,
    },
    { divider: true },
    {
      text: '가로 가운데 맞춤',
      handler: () => alignElementToCanvas(ElementAlignCommands.HORIZONTAL),
      children: [
        { text: '가로·세로 가운데 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.CENTER), },
        { text: '가로 가운데 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.HORIZONTAL) },
        { text: '왼쪽 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.LEFT) },
        { text: '오른쪽 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.RIGHT) },
      ],
    },
    {
      text: '세로 가운데 맞춤',
      handler: () => alignElementToCanvas(ElementAlignCommands.VERTICAL),
      children: [
        { text: '가로·세로 가운데 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.CENTER) },
        { text: '세로 가운데 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.VERTICAL) },
        { text: '위쪽 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.TOP) },
        { text: '아래쪽 맞춤', handler: () => alignElementToCanvas(ElementAlignCommands.BOTTOM) },
      ],
    },
    { divider: true },
    {
      text: '맨 앞으로 가져오기',
      disable: props.isMultiSelect && !props.elementInfo.groupId,
      handler: () => orderElement(props.elementInfo, ElementOrderCommands.TOP),
      children: [
        { text: '맨 앞으로 가져오기', handler: () => orderElement(props.elementInfo, ElementOrderCommands.TOP) },
        { text: '앞으로 가져오기', handler: () => orderElement(props.elementInfo, ElementOrderCommands.UP) },
      ],
    },
    {
      text: '맨 뒤로 보내기',
      disable: props.isMultiSelect && !props.elementInfo.groupId,
      handler: () => orderElement(props.elementInfo, ElementOrderCommands.BOTTOM),
      children: [
        { text: '맨 뒤로 보내기', handler: () => orderElement(props.elementInfo, ElementOrderCommands.BOTTOM) },
        { text: '뒤로 보내기', handler: () => orderElement(props.elementInfo, ElementOrderCommands.DOWN) },
      ],
    },
    { divider: true },
    {
      text: '링크 설정',
      handler: props.openLinkDialog,
    },
    {
      text: props.elementInfo.groupId ? '그룹 해제' : '그룹',
      subText: 'Ctrl + G',
      handler: props.elementInfo.groupId ? uncombineElements : combineElements,
      hide: !props.isMultiSelect,
    },
    {
      text: '모두 선택',
      subText: 'Ctrl + A',
      handler: selectAllElements,
    },
    {
      text: '잠금',
      subText: 'Ctrl + L',
      handler: lockElement,
    },
    {
      text: '삭제',
      subText: 'Delete',
      handler: deleteElement,
    },
  ]
}
</script>