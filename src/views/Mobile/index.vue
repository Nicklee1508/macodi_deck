<template>
  <div class="mobile">
    <component 
      :is="currentComponent" 
      :changeMode="changeMode"
    ></component>
    <!-- 머티리얼 탭에서 자재 담기 = 구독 기능 → 구독 안내·결제 결과 창 -->
    <SubscribeDialog />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { Mode } from '@/types/mobile'

import MobileEditor from './MobileEditor/index.vue'
import MobilePlayer from './MobilePlayer.vue'
import MobilePreview from './MobilePreview.vue'
import MobileMaterial from './MobileMaterial.vue'
import SubscribeDialog from '@/macodi/SubscribeDialog.vue'

const mode = ref<Mode>('preview')
    
const changeMode = (_mode: Mode) => mode.value = _mode

const currentComponent = computed(() => {
  const componentMap = {
    'editor': MobileEditor,
    'player': MobilePlayer,
    'preview': MobilePreview,
    'material': MobileMaterial,
  }
  return componentMap[mode.value] || null
})
</script>

<style lang="scss" scoped>
.mobile {
  height: 100%;
}
</style>