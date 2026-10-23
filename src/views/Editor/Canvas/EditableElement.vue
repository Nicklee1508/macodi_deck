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
import emitter, { EmitterEvents } from '@/utils/emitter'
import { FONTS } from '@/configs/font'

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
const { canCombine, canUncombine, combineElements, uncombineElements } = useCombineElement()
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

  // 글자 서식(PPT 우클릭 메뉴처럼) — 글상자 또는 글자가 있는 도형, 하나만 선택했을 때. 편집 중이 아니면 글상자 전체에 적용
  const isText = props.elementInfo.type === 'text' || (props.elementInfo.type === 'shape' && !!props.elementInfo.text?.content)
  const rt = (command: string, value?: string) => () => emitter.emit(EmitterEvents.RICH_TEXT_COMMAND, { action: { command, value } })
  const textMenus: ContextmenuItem[] = isText && !props.isMultiSelect ? [
    { text: '글꼴', children: FONTS.map(f => ({ text: f.label, handler: rt('fontname', f.value) })) },
    { text: '글자 크기', children: ['10', '12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48', '60', '72'].map(s => ({ text: s, handler: rt('fontsize', s + 'px') })) },
    { text: '크게 / 작게', children: [{ text: '글자 크게', handler: rt('fontsize-add') }, { text: '글자 작게', handler: rt('fontsize-reduce') }] },
    { text: '굵게', subText: 'Ctrl + B', handler: rt('bold') },
    { text: '기울임꼴', subText: 'Ctrl + I', handler: rt('em') },
    { text: '밑줄', subText: 'Ctrl + U', handler: rt('underline') },
    { text: '글자 색', children: [
      ['검정', '#1f1f1f'], ['진회색', '#555555'], ['회색', '#8a8a8a'], ['흰색', '#ffffff'], ['moodeck 녹색', '#23443A'], ['머스터드', '#D4A24C'], ['빨강', '#d33b3b'], ['파랑', '#2e6fd9'],
    ].map(([t, c]) => ({ text: t, handler: rt('color', c) })) },
    { text: '정렬', children: [['왼쪽', 'left'], ['가운데', 'center'], ['오른쪽', 'right'], ['양쪽', 'justify'], ['균등 분할', 'distributed']].map(([t, v]) => ({ text: t, handler: rt('align', v) })) },
    { divider: true },
  ] : []

  return [
    ...textMenus,
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
      // 그룹 여러 개를 고르면 '그룹'(그룹 안의 그룹), 한 그룹만 고르면 '그룹 해제'
      text: canCombine.value ? '그룹' : '그룹 해제',
      subText: canCombine.value ? 'Ctrl + G' : 'Ctrl + Shift + G',
      handler: canCombine.value ? combineElements : uncombineElements,
      disable: !canCombine.value && !canUncombine.value,
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