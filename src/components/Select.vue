<template>
  <div class="select-wrap" v-if="disabled">
    <div class="select disabled" ref="selectRef">
      <div class="selector">{{ value }}</div>
      <div class="icon">
        <slot name="icon">
          <i-icon-park-outline:down />
        </slot>
      </div>
    </div>
  </div>
  <Popover 
    class="select-wrap"
    trigger="click" 
    v-model:value="popoverVisible" 
    placement="bottom"
    :contentStyle="{
      padding: 0,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
    }"
    v-else
  >
    <template #content>
      <template v-if="search || customInput">
        <Input ref="searchInputRef" simple :placeholder="customInput ? '직접 입력 후 Enter' : searchLabel" v-model:value="searchKey" :style="{ width: width + 2 + 'px' }" @enter="handleEnter" />
        <Divider :margin="0" />
      </template>
      <div class="options" ref="optionsRef" :style="{ width: width + 2 + 'px' }">
        <!-- 직접 입력한 값(목록에 없을 때) -->
        <div v-if="customOption" class="option custom" @click="handleSelect(customOption)">{{ customOption.label }} 적용</div>
        <div class="option" 
          :class="{
            'disabled': option.disabled,
            'selected': option.value === value,
          }"
          v-for="option in showOptions" 
          :key="option.value"
          @click="handleSelect(option)"
        >{{ option.label }}</div>
      </div>
    </template>
    <div class="select" ref="selectRef">
      <div class="selector">{{ showLabel }}</div>
      <div class="icon">
        <slot name="icon">
          <i-icon-park-outline:down />
        </slot>
      </div>
    </div>
  </Popover>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick, onBeforeUnmount, useTemplateRef } from 'vue'
import Popover from './Popover.vue'
import Input from './Input.vue'
import Divider from './Divider.vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  value: string | number
  options: SelectOption[]
  disabled?: boolean
  autofocus?: boolean
  defaultLabel?: string
  search?: boolean
  searchLabel?: string
  /** 숫자 직접 입력 — 입력값을 옵션으로 바꿔 줌(안 되면 null) */
  customInput?: (text: string) => SelectOption | null
}>(), {
  disabled: false,
  autofocus: false,
  defaultLabel: '',
  search: false,
  searchLabel: '검색',
})

const emit = defineEmits<{
  (event: 'update:value', payload: string | number): void
}>()

const popoverVisible = ref(false)
const width = ref(0)
const searchKey = ref('')
const selectRef = useTemplateRef<HTMLElement>('selectRef')
const optionsRef = useTemplateRef<HTMLElement>('optionsRef')
const searchInputRef = useTemplateRef<InstanceType<typeof Input>>('searchInputRef')

const showLabel = computed(() => {
  return props.options.find(item => item.value === props.value)?.label || props.customInput?.(String(props.value))?.label || props.defaultLabel || props.value
})

// 입력한 값이 목록에 없으면 '직접 입력' 줄로 보여 줌
const customOption = computed(() => {
  if (!props.customInput || !searchKey.value.trim()) return null
  const o = props.customInput(searchKey.value)
  if (!o || props.options.some(item => item.value === o.value)) return null
  return o
})

const showOptions = computed(() => {
  if (!props.search && !props.customInput) return props.options
  if (!searchKey.value.trim()) return props.options
  const opts = props.options.filter(item => {
    return item.label.toLowerCase().indexOf(searchKey.value.toLowerCase()) !== -1
  })
  return opts.length ? opts : props.options
})

watch(popoverVisible, () => {
  if (popoverVisible.value) {
    nextTick(() => {
      if (searchInputRef.value) searchInputRef.value.focus()
      if (props.autofocus && optionsRef.value) {
        optionsRef.value.querySelector('.option.selected')?.scrollIntoView({ block: 'center' })
      }
    })
  }
  else searchKey.value = ''
})
onBeforeUnmount(() => {
  searchKey.value = ''
})

const updateWidth = () => {
  if (!selectRef.value) return
  width.value = selectRef.value.clientWidth
}
const resizeObserver = new ResizeObserver(updateWidth)
onMounted(() => {
  if (!selectRef.value) return
  resizeObserver.observe(selectRef.value)
})
onUnmounted(() => {
  if (!selectRef.value) return
  resizeObserver.unobserve(selectRef.value)
})

// Enter = 입력한 숫자 적용(목록에 같은 값이 있으면 그것).
//  Enter 는 여기서 끝냄 — 안 막으면 목록이 닫히며 글상자로 돌아간 입력 위치에 Enter(줄바꿈)가 들어가 선택한 글자가 지워졌음
const handleEnter = (e?: Event) => {
  e?.preventDefault()
  e?.stopPropagation()
  if (!props.customInput) return
  const o = props.customInput(searchKey.value)
  if (!o) return
  handleSelect(props.options.find(item => item.value === o.value) || o)
}

const handleSelect = (option: SelectOption) => {
  if (option.disabled) return

  emit('update:value', option.value)
  popoverVisible.value = false
}
</script>

<style lang="scss" scoped>
.select {
  width: 100%;
  height: 32px;
  padding-right: 32px;
  border-radius: $borderRadius;
  transition: border-color .25s;
  font-size: 13px;
  user-select: none;
  background-color: #fff;
  border: 1px solid #d9d9d9;
  position: relative;
  cursor: pointer;

  &:not(.disabled):hover {
    border-color: $themeColor;
  }

  &.disabled {
    background-color: #f5f5f5;
    border-color: #dcdcdc;
    color: #b7b7b7;
    cursor: default;
  }

  .selector {
    min-width: 50px;
    height: 30px;
    line-height: 30px;
    padding-left: 10px;
    @include ellipsis-oneline();
  }
}
.options {
  max-height: 260px;
  padding: 5px;
  overflow: auto;
  text-align: left;
  font-size: 13px;
  user-select: none;
}
.option {
  height: 32px;
  line-height: 32px;
  padding: 0 5px;
  border-radius: $borderRadius;
  @include ellipsis-oneline();

  &.disabled {
    color: #b7b7b7;
  }
  &:not(.disabled, .selected):hover {
    background-color: rgba($color: $themeColor, $alpha: .05);
    cursor: pointer;
  }

  &.selected {
    color: $themeColor;
    font-weight: 700;
  }
  &.custom {
    color: $themeColor;
    font-weight: 600;
  }
}
.icon {
  width: 32px;
  height: 30px;
  color: #bfbfbf;
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>