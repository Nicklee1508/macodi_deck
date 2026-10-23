<template>
  <div class="toolbar">
    <Tabs 
      :tabs="currentTabs" 
      :value="toolbarState" 
      card 
      @update:value="key => setToolbarState(key as ToolbarStates)"
    />
    <div class="content" :class="{ 'macodi-content': toolbarState === ToolbarStates.MACODI }">
      <component :is="currentPanelComponent"></component>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import { ToolbarStates } from '@/types/toolbar'

import ElementStylePanel from './ElementStylePanel/index.vue'
import ElementPositionPanel from './ElementPositionPanel.vue'
import ElementAnimationPanel from './ElementAnimationPanel.vue'
import SlideDesignPanel from './SlideDesignPanel/index.vue'
import MultiPositionPanel from './MultiPositionPanel.vue'
import MultiStylePanel from './MultiStylePanel.vue'
import Tabs from '@/components/Tabs.vue'
import MacodiPanel from '@/macodi/MacodiPanel.vue'
import macodiLogo from '@/assets/macodi-logo.svg'

const mainStore = useMainStore()
const { activeElementIdList, activeElementList, activeGroupElementId, toolbarState } = storeToRefs(mainStore)

// 마코디 탭 — 모든 탭 묶음 끝에 붙여, 요소를 선택해도 마코디 탭이 유지되게
const macodiTab = { label: '마코디', key: ToolbarStates.MACODI, img: macodiLogo }

// 마코디 탭은 맨 앞, 원래 맨 앞 탭은 맨 뒤로(자리 바꿈)
const elementTabs = [
  macodiTab,
  { label: '위치', key: ToolbarStates.EL_POSITION },
  { label: '애니메이션', key: ToolbarStates.EL_ANIMATION },
  { label: '스타일', key: ToolbarStates.EL_STYLE },
]
const slideTabs = [
  macodiTab,
  { label: '애니메이션', key: ToolbarStates.EL_ANIMATION },
  { label: '디자인', key: ToolbarStates.SLIDE_DESIGN },
]
const multiSelectTabs = [
  macodiTab,
  { label: '위치(여러 개)', key: ToolbarStates.MULTI_POSITION },
  { label: '스타일(여러 개)', key: ToolbarStates.MULTI_STYLE },
]

const setToolbarState = (value: ToolbarStates) => {
  mainStore.setToolbarState(value)
}

const currentTabs = computed(() => {
  if (!activeElementIdList.value.length) return slideTabs
  else if (activeElementIdList.value.length > 1) {
    if (!activeGroupElementId.value) return multiSelectTabs

    const activeGroupElement = activeElementList.value.find(item => item.id === activeGroupElementId.value)
    if (activeGroupElement) return elementTabs
    return multiSelectTabs
  }
  return elementTabs
})

watch(currentTabs, () => {
  const currentTabsValue: ToolbarStates[] = currentTabs.value.map(tab => tab.key)
  if (!currentTabsValue.includes(toolbarState.value)) {
    // 맨 앞이 마코디라, 다른 탭에 있다가 선택이 바뀌면 원래 첫 탭(맨 뒤: 样式/设计)으로
    mainStore.setToolbarState(currentTabsValue[currentTabsValue.length - 1])
  }
})

const currentPanelComponent = computed(() => {
  const panelMap = {
    [ToolbarStates.EL_STYLE]: ElementStylePanel,
    [ToolbarStates.EL_POSITION]: ElementPositionPanel,
    [ToolbarStates.EL_ANIMATION]: ElementAnimationPanel,
    [ToolbarStates.SLIDE_DESIGN]: SlideDesignPanel,
    [ToolbarStates.MULTI_STYLE]: MultiStylePanel,
    [ToolbarStates.MULTI_POSITION]: MultiPositionPanel,
    [ToolbarStates.MACODI]: MacodiPanel,
  }
  return panelMap[toolbarState.value] || null
})
</script>

<style lang="scss" scoped>
.toolbar {
  border-left: solid 1px $borderColor;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}
.content {
  padding: 12px;
  font-size: 13px;

  @include overflow-overlay();

  &.macodi-content {
    flex: 1;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
}
</style>