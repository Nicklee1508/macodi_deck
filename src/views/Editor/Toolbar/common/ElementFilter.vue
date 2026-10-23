<template>
  <div class="element-filter">
    <div class="row">
      <div style="flex: 2;">필터 사용:</div>
      <div class="switch-wrapper" style="flex: 3;">
        <Switch 
          :value="hasFilters" 
          @update:value="value => toggleFilters(value)" 
        />
      </div>
    </div>
    <template v-if="hasFilters">
      <div class="presets">
        <div class="preset-item" v-for="(item, index) in presetFilters" :key="index" @click="applyPresetFilters(item.values)">
          <img :src="handleImageElement.src" alt="" :style="{ filter: filters2Style(item.values) }">
          <span class="preset-label">{{ item.label }}</span>
        </div>
      </div>
      <div class="filter">
        <div class="filter-item" v-for="filter in filterOptions" :key="filter.key">
          <div class="name">{{filter.label}}</div>
          <Slider
            class="filter-slider"
            :max="filter.max"
            :min="0"
            :step="filter.step"
            :value="filter.value"
            @update:value="value => updateFilter(filter, value as number)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import type { ImageElementFilterKeys, ImageElementFilters, PPTImageElement } from '@/types/slides'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'

import Switch from '@/components/Switch.vue'
import Slider from '@/components/Slider.vue'

interface FilterOption {
  label: string
  key: ImageElementFilterKeys
  default: number
  value: number
  unit: string
  max: number
  step: number
}

const defaultFilters: FilterOption[] = [
  { label: '흐리게', key: 'blur', default: 0, value: 0, unit: 'px', max: 10, step: 1 },
  { label: '밝기', key: 'brightness', default: 100, value: 100, unit: '%', max: 200, step: 5 },
  { label: '대비', key: 'contrast', default: 100, value: 100, unit: '%', max: 200, step: 5 },
  { label: '흑백(회색조)', key: 'grayscale', default: 0, value: 0, unit: '%', max: 100, step: 5 },
  { label: '채도', key: 'saturate', default: 100, value: 100, unit: '%', max: 200, step: 5 },
  { label: '색조', key: 'hue-rotate', default: 0, value: 0, unit: 'deg', max: 360, step: 10 },
  { label: '세피아', key: 'sepia', default: 0, value: 0, unit: '%', max: 100, step: 5 },
  { label: '반전', key: 'invert', default: 0, value: 0, unit: '%', max: 100, step: 5 },
  { label: '불투명도', key: 'opacity', default: 100, value: 100, unit: '%', max: 100, step: 5 },
]

const presetFilters: {
  label: string
  values: ImageElementFilters
}[] = [
  { label: '흑백', values: { 'grayscale': '100%' } },
  { label: '레트로', values: { 'sepia': '50%', 'contrast': '110%', 'brightness': '90%' } },
  { label: '선명하게', values: { 'contrast': '150%' } },
  { label: '부드럽게', values: { 'brightness': '110%', 'contrast': '90%' } },
  { label: '따뜻하게', values: { 'sepia': '30%', 'saturate': '135%' } },
  { label: '밝게', values: { 'brightness': '110%', 'contrast': '110%' } },
  { label: '선명한 색', values: { 'saturate': '200%' } },
  { label: '흐리게', values: { 'blur': '2px' } },
  { label: '반전', values: { 'invert': '100%' } },
]

const slidesStore = useSlidesStore()
const { handleElement, handleElementId } = storeToRefs(useMainStore())

const handleImageElement = handleElement as Ref<PPTImageElement>

const filterOptions = ref<FilterOption[]>(JSON.parse(JSON.stringify(defaultFilters)))
const hasFilters = ref(false)

const { addHistorySnapshot } = useHistorySnapshot()

watch(handleElement, () => {
  if (!handleElement.value || handleElement.value.type !== 'image') return
  
  const filters = handleElement.value.filters
  if (filters) {
    filterOptions.value = defaultFilters.map(item => {
      const filterItem = filters[item.key]
      if (filterItem) return { ...item, value: parseInt(filterItem) }
      return item
    })
    hasFilters.value = true
  }
  else {
    filterOptions.value = JSON.parse(JSON.stringify(defaultFilters))
    hasFilters.value = false
  }
}, { deep: true, immediate: true })

// 将滤镜配置转为css
const filters2Style = (filters: ImageElementFilters) => {
  let filter = ''
  const keys = Object.keys(filters) as ImageElementFilterKeys[]
  for (const key of keys) {
    filter += `${key}(${filters[key]}) `
  }
  return filter
}

// 设置滤镜
const updateFilter = (filter: FilterOption, value: number) => {
  const _handleElement = handleElement.value as PPTImageElement
  
  const originFilters = _handleElement.filters || {}
  const filters = { ...originFilters, [filter.key]: `${value}${filter.unit}` }
  slidesStore.updateElement({ id: handleElementId.value, props: { filters } })
  addHistorySnapshot()
}

const toggleFilters = (checked: boolean) => {
  if (!handleElement.value) return
  if (checked) {
    slidesStore.updateElement({ id: handleElement.value.id, props: { filters: {} } })
  }
  else {
    slidesStore.removeElementProps({ id: handleElement.value.id, propName: 'filters' })
  }
  addHistorySnapshot()
}

const applyPresetFilters = (filters: ImageElementFilters) => {
  slidesStore.updateElement({ id: handleElementId.value, props: { filters } })
  addHistorySnapshot()
}
</script>

<style lang="scss" scoped>
.row {
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.switch-wrapper {
  text-align: right;
}
.filter {
  font-size: 12px;
}
.filter-item {
  padding: 6px 0;
  display: flex;
  justify-content: center;
  align-items: center;

  .name {
    width: 60px;
  }
  .filter-slider {
    flex: 1;
    margin: 0 6px;
  }
}
.presets {
  margin-bottom: 5px;
  @include flex-grid-layout();
}
.preset-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  @include flex-grid-layout-children(3, 31%);

  img {
    max-width: 100%;
    max-height: 120px;
  }
  .preset-label {
    font-size: 12px;
    color: #888;
  }
}
</style>