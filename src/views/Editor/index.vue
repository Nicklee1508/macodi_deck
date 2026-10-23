<template>
  <div class="pptist-editor">
    <EditorHeader class="layout-header" />
    <div class="layout-content">
      <Thumbnails class="layout-content-left" />
      <div class="layout-content-center" :style="{ width: `calc(100% - 160px - ${rightWidth}px)` }">
        <CanvasTool class="center-top" />
        <Canvas class="center-body" :style="{ height: `calc(100% - ${remarkHeight + 40}px)` }" />
        <Remark
          class="center-bottom" 
          v-model:height="remarkHeight" 
          :style="{ height: `${remarkHeight}px` }"
        />
      </div>
      <!-- 오른쪽 패널(마코디·디자인·전환·애니메이션) 너비 조절 — 경계선을 잡고 좌우로 끌기, 너비 기억 -->
      <div class="right-resizer" :class="{ dragging: resizing }" title="끌어서 패널 너비 조절" @mousedown.prevent="startResize"></div>
      <Toolbar class="layout-content-right" :style="{ width: rightWidth + 'px' }" />
    </div>
  </div>

  <SelectPanel v-if="showSelectPanel" />
  <SearchPanel v-if="showSearchPanel" />
  <NotesPanel v-if="showNotesPanel" />
  <ChartDataEditorDialog />
  <LatexEditorDialog />

  <Modal
    :visible="!!dialogForExport" 
    :width="680"
    @closed="closeExportDialog()"
  >
    <ExportDialog />
  </Modal>
  <!-- 내 파일: 저장(다른 이름으로) / 열기 -->
  <FilesDialog />

</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import useGlobalHotkey from '@/hooks/useGlobalHotkey'
import usePasteEvent from '@/hooks/usePasteEvent'

import EditorHeader from './EditorHeader/index.vue'
import Canvas from './Canvas/index.vue'
import CanvasTool from './CanvasTool/index.vue'
import Thumbnails from './Thumbnails/index.vue'
import Toolbar from './Toolbar/index.vue'
import Remark from './Remark/index.vue'
import ChartDataEditorDialog from './ChartDataEditorDialog.vue'
import LatexEditorDialog from './LatexEditorDialog.vue'
import ExportDialog from './ExportDialog/index.vue'
import FilesDialog from '@/macodi/FilesDialog.vue'
import SelectPanel from './SelectPanel.vue'
import SearchPanel from './SearchPanel.vue'
import NotesPanel from './NotesPanel.vue'
import Modal from '@/components/Modal.vue'

const mainStore = useMainStore()
const {
  dialogForExport,
  showSelectPanel,
  showSearchPanel,
  showNotesPanel,
} = storeToRefs(mainStore)

const closeExportDialog = () => mainStore.setDialogForExport('')

const remarkHeight = ref(40)

// 오른쪽 패널 너비 — 기본 340, 260 ~ 화면의 60% 사이, 브라우저에 기억
const RIGHT_KEY = 'macodi.deck.rightWidth'
const RIGHT_MIN = 260
const rightMax = () => Math.max(RIGHT_MIN, Math.round(window.innerWidth * 0.6))
const clampRight = (w: number) => Math.min(rightMax(), Math.max(RIGHT_MIN, Math.round(w)))
const readRight = () => {
  try {
    const v = Number(localStorage.getItem(RIGHT_KEY))
    return v ? clampRight(v) : 340
  }
  catch {
    return 340
  }
}
const rightWidth = ref(readRight())
const resizing = ref(false)
const startResize = (e: MouseEvent) => {
  const startX = e.clientX, startW = rightWidth.value
  resizing.value = true
  const move = (ev: MouseEvent) => {
    rightWidth.value = clampRight(startW + (startX - ev.clientX)) // 왼쪽으로 끌수록 넓어짐
  }
  const up = () => {
    resizing.value = false
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    try {
      localStorage.setItem(RIGHT_KEY, String(rightWidth.value))
    }
    catch { /* 저장 불가 환경 무시 */ }
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

useGlobalHotkey()
usePasteEvent()
</script>

<style lang="scss" scoped>
.pptist-editor {
  height: 100%;
}
.layout-header {
  height: 40px;
}
.layout-content {
  height: calc(100% - 40px);
  display: flex;
}
.layout-content-left {
  width: 160px;
  height: 100%;
  flex-shrink: 0;
}
.layout-content-center {

  .center-top {
    height: 40px;
  }
}
.layout-content-right {
  height: 100%;
  flex-shrink: 0;
}
.right-resizer {
  position: relative;
  z-index: 10;
  width: 6px;
  margin: 0 -3px;
  height: 100%;
  flex-shrink: 0;
  cursor: col-resize;
  &:hover, &.dragging { background: rgba(108, 43, 217, .35); }
}
</style>
