import { computed, type Ref } from 'vue'
import type { ImageElementFilters } from '@/types/slides'
import { filtersToCss } from '@/macodi/imageEffects'

export default (filters: Ref<ImageElementFilters | undefined>) => {
  // 선명도·색 온도는 SVG 필터(url)로 바꿔 줌 — 변환은 imageEffects.filtersToCss 한 곳
  const filter = computed(() => filtersToCss(filters.value))

  return {
    filter,
  }
}
