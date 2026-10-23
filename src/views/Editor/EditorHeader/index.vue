<template>
  <div class="editor-header">
    <div class="left">
      <Popover trigger="click" placement="bottom-start" v-model:value="mainMenuVisible">
        <template #content>
          <div class="import-section">
            <div class="import-label">파일 가져오기</div>
            <div class="import-grid">
              <FileInput class="import-block" accept="application/vnd.openxmlformats-officedocument.presentationml.presentation" @change="files => {
                importPPTXFile(files)
                mainMenuVisible = false
              }">
                <span class="icon"><i-custom:file-ppt /></span>
                <span class="label">PowerPoint</span>
                <span class="sub-label">(.pptx)</span>
              </FileInput>
              <FileInput class="import-block" accept=".pptist" @change="files => {
                importSpecificFile(files)
                mainMenuVisible = false
              }">
                <span class="icon"><i-custom:file-pptist /></span>
                <span class="label">작업 파일</span>
                <span class="sub-label">(이 편집기 저장본)</span>
              </FileInput>
            </div>
          </div>
          <Divider :margin="10" />
          <!-- 내 파일(로그인 없이 이 브라우저에 저장) -->
          <PopoverMenuItem class="popover-menu-item" @click="fileState.dialog = 'open'; mainMenuVisible = false"><i-icon-park-outline:folder-open class="icon" /> 내 파일 열기 <span class="hk">Ctrl+O</span></PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="saveFile(); mainMenuVisible = false"><i-icon-park-outline:save class="icon" /> 저장 <span class="hk">Ctrl+S</span></PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="fileState.dialog = 'saveAs'; mainMenuVisible = false"><i-icon-park-outline:save-one class="icon" /> 다른 이름으로 저장 <span class="hk">Ctrl+Shift+S</span></PopoverMenuItem>
          <Divider :margin="10" />
          <PopoverMenuItem class="popover-menu-item" @click="setDialogForExport('pptx')"><i-icon-park-outline:download class="icon" /> 파일 내보내기</PopoverMenuItem>
          <Divider :margin="10" />
          <!-- 구독(로그인 없음·활성화 키) -->
          <PopoverMenuItem class="popover-menu-item" @click="openSub('manage')"><i-icon-park-outline:vip-one class="icon" /> 구독 관리 <span class="hk">{{ subscribeState.active ? '이용 중' : '' }}</span></PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="openSub('activate')"><i-icon-park-outline:key class="icon" /> 활성화 키 입력</PopoverMenuItem>
          <Divider :margin="10" />
          <!-- 개발 전용: 지금 제안서를 기본 샘플 원본으로 저장(운영 빌드엔 안 보임) -->
          <PopoverMenuItem v-if="isDev" class="popover-menu-item" @click="saveAsSample(); mainMenuVisible = false"><i-icon-park-outline:upload-one class="icon" /> (개발) 지금 제안서를 기본 샘플로</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="startNewDeck(); mainMenuVisible = false"><i-icon-park-outline:file-addition class="icon" /> 새 제안서 (기본 양식)</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="resetSlides(); mainMenuVisible = false"><i-icon-park-outline:refresh class="icon" /> 슬라이드 초기화</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="mainMenuVisible = false; hotkeyDrawerVisible = true"><i-icon-park-outline:command class="icon" /> 단축키</PopoverMenuItem>
          <!-- 의견 보내기 = 마코디 카카오톡 채널 문의 -->
          <PopoverMenuItem class="popover-menu-item" @click="goLink('https://pf.kakao.com/_xapljG'); mainMenuVisible = false"><i-icon-park-outline:comment class="icon" /> 의견 보내기 (카카오톡 문의)</PopoverMenuItem>
        </template>
        <div class="menu-item"><i-icon-park-outline:hamburger-button class="icon" /></div>
      </Popover>

      <!-- moodeck 로고 — 누르면 랜딩(사이트 첫 화면) -->
      <a class="brand" href="/" title="moodeck 홈"><img :src="moodeckMark" alt="" /><span>moodeck</span></a>

      <div class="title">
        <Input 
          class="title-input" 
          ref="titleInputRef"
          v-model:value="titleValue" 
          @blur="handleUpdateTitle()" 
          v-if="editingTitle" 
        ></Input>
        <div 
          class="title-text"
          @click="startEditTitle()"
          :title="title"
          v-else
        >{{ title }}</div>
      </div>
      <!-- 로그인 없이 이 브라우저에 임시 저장 -->
      <div class="draft-state" :class="{ err: draftState.error }" v-tooltip="'Ctrl+S 로 이 브라우저에 저장하고, ☰ 메뉴 → 내 파일 열기에서 다시 열 수 있어요. 저장 전 작업도 자동 임시 저장돼요.'">
        {{ draftState.error ? '임시 저장 실패' : stateText }}
      </div>
    </div>

    <div class="right">
      <div class="group-menu-item">
        <div class="menu-item" v-tooltip="'슬라이드 쇼(F5)'" @click="enterScreening()">
          <i-icon-park-outline:ppt class="icon" />
        </div>
        <Popover trigger="click" center>
          <template #content>
            <PopoverMenuItem class="popover-menu-item" @click="enterScreeningFromStart()"><i-icon-park-outline:slide-two class="icon" /> 처음부터</PopoverMenuItem>
            <PopoverMenuItem class="popover-menu-item" @click="enterScreening()"><i-icon-park-outline:ppt class="icon" /> 현재 페이지부터</PopoverMenuItem>
          </template>
          <div class="arrow-btn"><i-icon-park-outline:down class="arrow" /></div>
        </Popover>
      </div>
      <div class="menu-item" v-tooltip="'내보내기'" @click="setDialogForExport('pptx')">
        <i-icon-park-outline:download class="icon" />
      </div>
    </div>

    <Drawer
      :width="320"
      v-model:visible="hotkeyDrawerVisible"
      placement="right"
    >
      <HotkeyDoc />
      <template v-slot:title>단축키</template>
    </Drawer>

    <FullscreenSpin :loading="exporting" tip="가져오는 중..." />
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { loadSampleDeck } from '@/macodi/sampleDeck'
import { draftState, fileState } from '@/macodi/autosave'
import useDeckFiles from '@/macodi/useDeckFiles'
import { ensureSubscribed, subscribeState } from '@/macodi/subscription'
import moodeckMark from '@/assets/moodeck-mark.svg'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import useScreening from '@/hooks/useScreening'
import useImport from '@/hooks/useImport'
import useSlideHandler from '@/hooks/useSlideHandler'
import type { DialogForExportTypes } from '@/types/export'

import HotkeyDoc from './HotkeyDoc.vue'
import FileInput from '@/components/FileInput.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import Drawer from '@/components/Drawer.vue'
import Input from '@/components/Input.vue'
import Popover from '@/components/Popover.vue'
import PopoverMenuItem from '@/components/PopoverMenuItem.vue'
import Divider from '@/components/Divider.vue'

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { title } = storeToRefs(slidesStore)
const { enterScreening, enterScreeningFromStart } = useScreening()
const { importSpecificFile, importPPTXFile, exporting } = useImport()
const { resetSlides } = useSlideHandler()

const mainMenuVisible = ref(false)

// 임시 저장 표시 — 30초마다 '몇 분 전' 갱신
const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 30000)
const savedAgo = computed(() => {
  const sec = Math.max(0, Math.round((now.value - draftState.savedAt) / 1000))
  if (sec < 60) return '방금'
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
  return new Date(draftState.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
})
watch(() => draftState.savedAt, () => (now.value = Date.now()))

const { saveFile, detachFile, confirmDiscard } = useDeckFiles()
// 내 파일로 저장했으면 저장 상태, 아니면 임시 저장 상태
const stateText = computed(() => {
  if (fileState.id) return fileState.dirty ? '변경됨 · Ctrl+S 로 저장' : '저장됨'
  return draftState.savedAt ? `임시 저장됨 · ${savedAgo.value}` : ''
})

// 새 제안서 — 기본 양식으로 다시 시작(지금 작업은 덮어씀, 확인 후)
const startNewDeck = async () => {
  mainMenuVisible.value = false
  if (!(await ensureSubscribed('new'))) return // 새 제안서 = 구독 기능(새 프로젝트 생성과 같음)
  if (fileState.dirty ? !confirmDiscard() : !window.confirm('기본 양식으로 새로 시작할까요?' + (fileState.id ? ' (저장한 파일은 내 파일에 그대로 있어요)' : ' 지금 작업은 지워져요.'))) return
  detachFile()
  mainStore.setActiveElementIdList([])
  await loadSampleDeck()
}
const isDev = import.meta.env.DEV
const openSub = (mode: 'manage' | 'activate') => {
  subscribeState.reason = ''
  subscribeState.mode = mode
  mainMenuVisible.value = false
}
const saveAsSample = async () => {
  const { slides, viewportRatio, theme } = slidesStore
  const body = JSON.stringify({ title: '샘플 제안서', viewportRatio, theme, startIndex: 11, slides })
  const r = await fetch('/__save-sample', { method: 'POST', body }).catch(() => null)
  window.alert(r?.ok ? '저장했어요. 개발자가 그림을 정리해 기본 샘플로 반영합니다.' : '저장 실패(개발 서버에서만 됩니다)')
}
const hotkeyDrawerVisible = ref(false)
const editingTitle = ref(false)
const titleValue = ref('')
const titleInputRef = useTemplateRef<InstanceType<typeof Input>>('titleInputRef')

const startEditTitle = () => {
  titleValue.value = title.value
  editingTitle.value = true
  nextTick(() => titleInputRef.value?.focus())
}

const handleUpdateTitle = () => {
  slidesStore.setTitle(titleValue.value)
  editingTitle.value = false
}

const goLink = (url: string) => {
  window.open(url)
  mainMenuVisible.value = false
}

const setDialogForExport = (type: DialogForExportTypes) => {
  mainStore.setDialogForExport(type)
  mainMenuVisible.value = false
}

</script>

<style lang="scss" scoped>
.editor-header {
  background-color: #fff;
  user-select: none;
  border-bottom: 1px solid $borderColor;
  display: flex;
  justify-content: space-between;
  padding: 0 5px;
}
.left, .right {
  display: flex;
  justify-content: center;
  align-items: center;
}
.menu-item {
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  padding: 0 10px;
  border-radius: $borderRadius;
  cursor: pointer;

  .icon {
    font-size: 18px;
    color: #666;
  }
  .text {
    width: 18px;
    text-align: center;
    font-size: 17px;
  }
  .ai {
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    font-weight: 700;
  }

  &:hover {
    background-color: #f1f1f1;
  }
}
.brand {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 10px 0 4px;
  padding-right: 12px;
  border-right: 1px solid $borderColor;
  text-decoration: none;
  img { width: 24px; height: 21px; }
  span {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.4px;
    color: #23443A;
  }
}
.popover-menu-item {
  display: flex;
  padding: 8px 10px;

  .hk {
    margin-left: auto;
    padding-left: 16px;
    font-size: 12px;
    color: #aaa;
  }

  .icon {
    font-size: 18px;
    margin-right: 10px;
  }
}
.statement {
  font-size: 12px;
  color: #999;
  padding: 8px 10px;
  font-style: italic;
}
.main-menu {
  width: 300px;
}
.ai-menu {
  background: linear-gradient(270deg, #f8edff, #d4f1ff);
  color: $themeColor;
  border-radius: $borderRadius;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  cursor: pointer;

  .icon {
    font-size: 22px;
    margin-right: 16px;
  }
  .aippt-content {
    display: flex;
    flex-direction: column;
  }
  .aippt {
    font-weight: 700;
    font-size: 16px;

    span {
      background: linear-gradient(270deg, #d897fd, #33bcfc);
      background-clip: text;
      color: transparent;
    }
  }
  .aippt-subtitle {
    font-size: 12px;
    color: #777;
    margin-top: 5px;
  }
}

.import-section {
  padding: 5px 0;

  .import-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 6px;
  }
  .import-grid {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  .import-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    border-radius: $borderRadius;
    border: 1px solid $borderColor;
    transition: background-color .2s;
    cursor: pointer;
  
    &:hover {
      background-color: #f1f1f1;
    }
    .icon {
      font-size: 24px;
      margin-bottom: 2px;
    }
    .label {
      font-size: 12px;
      text-align: center;
    }
    .sub-label {
      font-size: 10px;
      color: #999;
    }
  }
}

.group-menu-item {
  height: 30px;
  display: flex;
  margin: 0 8px;
  padding: 0 2px;
  border-radius: $borderRadius;

  &:hover {
    background-color: #f1f1f1;
  }

  .menu-item {
    padding: 0 3px;
  }
  .arrow-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
}
.title {
  height: 30px;
  margin-left: 2px;
  font-size: 13px;

  .title-input {
    width: 200px;
    height: 100%;
    padding-left: 0;
    padding-right: 0;

    ::v-deep(input) {
      height: 28px;
      line-height: 28px;
    }
  }
  .title-text {
    min-width: 20px;
    max-width: 400px;
    line-height: 30px;
    padding: 0 6px;
    border-radius: $borderRadius;
    cursor: pointer;

    @include ellipsis-oneline();

    &:hover {
      background-color: #f1f1f1;
    }
  }
}
.draft-state {
  margin-left: 6px;
  font-size: 13px; // 제목(마감재 제안서)과 같은 크기
  color: #9a9aa3;
  white-space: nowrap;
  &.err { color: #d33; }
}
.github-link {
  display: inline-block;
  height: 30px;
}
</style>