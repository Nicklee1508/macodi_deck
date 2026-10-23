<template>
  <div class="rich-text-base">
    <SelectGroup class="row">
      <Select
        style="width: 60%;"
        :value="richTextAttrs.fontname"
        search
        searchLabel="글꼴 검색"
        autofocus
        @update:value="value => emitRichTextCommand('fontname', value as string)"
        :options="FONTS"
      >
        <template #icon>
          <i-icon-park-outline:font-size />
        </template>
      </Select>
      <Select
        style="width: 40%;"
        :value="richTextAttrs.fontsize"
        search
        searchLabel="글자 크기 검색"
    :customInput="customFontSize"
        autofocus
        @update:value="value => emitRichTextCommand('fontsize', value as string)"
        :options="fontSizeOptions.map(item => ({
          label: item, value: item
        }))"
      >
        <template #icon>
          <i-icon-park-outline:add-text />
        </template>
      </Select>
    </SelectGroup>

    <ButtonGroup class="row" passive>
      <Popover trigger="click" style="width: 30%;">
        <template #content>
          <ColorPicker
            :modelValue="richTextAttrs.color"
            @update:modelValue="value => emitRichTextCommand('color', value)"
          />
        </template>
        <TextColorButton first v-tooltip="'글자 색'" :color="richTextAttrs.color">
          <i-icon-park-outline:text />
        </TextColorButton>
      </Popover>
      <Popover trigger="click" style="width: 30%;">
        <template #content>
          <ColorPicker
            :modelValue="richTextAttrs.backcolor"
            @update:modelValue="value => emitRichTextCommand('backcolor', value)"
          />
        </template>
        <TextColorButton v-tooltip="'형광펜'" :color="richTextAttrs.backcolor">
          <i-icon-park-outline:high-light />
        </TextColorButton>
      </Popover>
      <Button 
        class="font-size-btn"
        style="width: 20%;"
        v-tooltip="'글자 크게'"
        @click="emitRichTextCommand('fontsize-add')"
      ><i-icon-park-outline:font-size />+</Button>
      <Button
        last
        class="font-size-btn"
        style="width: 20%;"
        v-tooltip="'글자 작게'"
        @click="emitRichTextCommand('fontsize-reduce')"
      ><i-icon-park-outline:font-size />-</Button>
    </ButtonGroup>

    <ButtonGroup class="row">
      <CheckboxButton 
        style="flex: 1;"
        :checked="richTextAttrs.bold"
        v-tooltip="'굵게'"
        @click="emitRichTextCommand('bold')"
      ><i-icon-park-outline:text-bold /></CheckboxButton>
      <CheckboxButton 
        style="flex: 1;"
        :checked="richTextAttrs.em"
        v-tooltip="'기울임꼴'"
        @click="emitRichTextCommand('em')"
      ><i-icon-park-outline:text-italic /></CheckboxButton>
      <CheckboxButton 
        style="flex: 1;"
        :checked="richTextAttrs.underline"
        v-tooltip="'밑줄'"
        @click="emitRichTextCommand('underline')"
      ><i-icon-park-outline:text-underline /></CheckboxButton>
      <CheckboxButton 
        style="flex: 1;"
        :checked="richTextAttrs.strikethrough"
        v-tooltip="'취소선'"
        @click="emitRichTextCommand('strikethrough')"
      ><i-icon-park-outline:strikethrough /></CheckboxButton>
    </ButtonGroup>

    <ButtonGroup class="row">
      <CheckboxButton
        style="flex: 1;"
        :checked="richTextAttrs.superscript"
        v-tooltip="'위 첨자'"
        @click="emitRichTextCommand('superscript')"
      >A²</CheckboxButton>
      <CheckboxButton
        style="flex: 1;"
        :checked="richTextAttrs.subscript"
        v-tooltip="'아래 첨자'"
        @click="emitRichTextCommand('subscript')"
      >A₂</CheckboxButton>
      <CheckboxButton
        style="flex: 1;"
        :checked="richTextAttrs.code"
        v-tooltip="'인라인 코드'"
        @click="emitRichTextCommand('code')"
      ><i-icon-park-outline:code /></CheckboxButton>
      <CheckboxButton
        style="flex: 1;"
        :checked="richTextAttrs.blockquote"
        v-tooltip="'인용'"
        @click="emitRichTextCommand('blockquote')"
      ><i-icon-park-outline:quote /></CheckboxButton>
    </ButtonGroup>

    <ButtonGroup class="row" passive>
      <CheckboxButton
        first
        style="flex: 1;"
        v-tooltip="'서식 지우기'"
        @click="emitRichTextCommand('clear')"
      ><i-icon-park-outline:format /></CheckboxButton>
      <CheckboxButton
        style="flex: 1;"
        :checked="!!textFormatPainter"
        v-tooltip="'서식 복사(더블클릭하면 계속 사용)'"
        @click="toggleTextFormatPainter()"
        @dblclick="toggleTextFormatPainter(true)"
      ><i-icon-park-outline:format-brush /></CheckboxButton>
      <Popover placement="bottom-end" trigger="click" v-model:value="linkPopoverVisible" style="width: 25%;">
        <template #content>
          <div class="link-popover">
            <Input v-model:value="link" placeholder="하이퍼링크를 입력하세요" />
            <div class="btns">
              <Button size="small" :disabled="!richTextAttrs.link" @click="removeLink()" style="margin-right: 5px;">제거</Button>
              <Button size="small" type="primary" @click="updateLink(link)">확인</Button>
            </div>
          </div>
        </template>
        <CheckboxButton
          last
          style="width: 100%;"
          :checked="!!richTextAttrs.link"
          v-tooltip="'하이퍼링크'"
          @click="openLinkPopover()"
        ><i-icon-park-outline:link-one /></CheckboxButton>
      </Popover>
    </ButtonGroup>
    <Divider />

    <RadioGroup 
      class="row" 
      button-style="solid" 
      :value="richTextAttrs.align"
      @update:value="value => emitRichTextCommand('align', value)"
    >
      <RadioButton value="left" v-tooltip="'왼쪽 맞춤'" style="flex: 1;"><i-icon-park-outline:align-text-left /></RadioButton>
      <RadioButton value="center" v-tooltip="'가운데 맞춤'" style="flex: 1;"><i-icon-park-outline:align-text-center /></RadioButton>
      <RadioButton value="right" v-tooltip="'오른쪽 맞춤'" style="flex: 1;"><i-icon-park-outline:align-text-right /></RadioButton>
      <RadioButton value="justify" v-tooltip="'양쪽 맞춤'" style="flex: 1;"><i-icon-park-outline:align-text-both /></RadioButton>
      <RadioButton value="distributed" v-tooltip="'균등 분할'" style="flex: 1;"><i-icon-park-outline:distribute-horizontal-spacing /></RadioButton>
    </RadioGroup>

    <div class="row" passive>
      <ButtonGroup style="flex: 1;">
        <Button
          first
          :type="richTextAttrs.bulletList ? 'primary' : 'default'"
          style="flex: 1;"
          v-tooltip="'글머리 기호'"
          @click="emitRichTextCommand('bulletList')"
        ><i-icon-park-outline:list /></Button>
        <Popover trigger="click" v-model:value="bulletListPanelVisible">
          <template #content>
            <div class="list-wrap">
              <ul class="list" 
                v-for="item in bulletListStyleTypeOption" 
                :key="item" 
                :style="{ listStyleType: item }"
                @click="emitRichTextCommand('bulletList', item)"
              >
                <li class="list-item" v-for="key in 3" :key="key"><span></span></li>
              </ul>
            </div>
          </template>
          <Button last class="popover-btn"><i-icon-park-outline:down /></Button>
        </Popover>
      </ButtonGroup>
      <div style="width: 10px;"></div>
      <ButtonGroup style="flex: 1;" passive>
        <Button
          first
          :type="richTextAttrs.orderedList ? 'primary' : 'default'"
          style="flex: 1;"
          v-tooltip="'번호 매기기'"
          @click="emitRichTextCommand('orderedList')"
        ><i-icon-park-outline:ordered-list /></Button>
        <Popover trigger="click" v-model:value="orderedListPanelVisible">
          <template #content>
            <div class="list-wrap">
              <ul class="list" 
                v-for="item in orderedListStyleTypeOption" 
                :key="item" 
                :style="{ listStyleType: item }"
                @click="emitRichTextCommand('orderedList', item)"
              >
                <li class="list-item" v-for="key in 3" :key="key"><span></span></li>
              </ul>
            </div>
          </template>
          <Button last class="popover-btn"><i-icon-park-outline:down /></Button>
        </Popover>
      </ButtonGroup>
    </div>

    <div class="row">
      <ButtonGroup style="flex: 1;" passive>
        <Button first style="flex: 1;" v-tooltip="'문단 들여쓰기 줄이기'" @click="emitRichTextCommand('indent', '-1')"><i-icon-park-outline:indent-left /></Button>
        <Popover trigger="click" v-model:value="indentLeftPanelVisible">
          <template #content>
            <PopoverMenuItem center @click="emitRichTextCommand('textIndent', '-1')">첫 줄 들여쓰기 줄이기</PopoverMenuItem>
          </template>
          <Button last class="popover-btn"><i-icon-park-outline:down /></Button>
        </Popover>
      </ButtonGroup>
      <div style="width: 10px;"></div>
      <ButtonGroup style="flex: 1;" passive>
        <Button first style="flex: 1;" v-tooltip="'문단 들여쓰기 늘리기'" @click="emitRichTextCommand('indent', '+1')"><i-icon-park-outline:indent-right /></Button>
        <Popover trigger="click" v-model:value="indentRightPanelVisible">
          <template #content>
            <PopoverMenuItem center @click="emitRichTextCommand('textIndent', '+1')">첫 줄 들여쓰기 늘리기</PopoverMenuItem>
          </template>
          <Button last class="popover-btn"><i-icon-park-outline:down /></Button>
        </Popover>
      </ButtonGroup>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import emitter, { EmitterEvents } from '@/utils/emitter'
import { FONTS } from '@/configs/font'
import useTextFormatPainter from '@/hooks/useTextFormatPainter'
import message from '@/utils/message'

import TextColorButton from '@/components/TextColorButton.vue'
import CheckboxButton from '@/components/CheckboxButton.vue'
import ColorPicker from '@/components/ColorPicker/index.vue'
import Input from '@/components/Input.vue'
import Button from '@/components/Button.vue'
import ButtonGroup from '@/components/ButtonGroup.vue'
import { customFontSize } from '@/utils/customSelectInput'
import Select from '@/components/Select.vue'
import SelectGroup from '@/components/SelectGroup.vue'
import Divider from '@/components/Divider.vue'
import Popover from '@/components/Popover.vue'
import RadioButton from '@/components/RadioButton.vue'
import RadioGroup from '@/components/RadioGroup.vue'
import PopoverMenuItem from '@/components/PopoverMenuItem.vue'

const { richTextAttrs, textFormatPainter } = storeToRefs(useMainStore())

const { toggleTextFormatPainter } = useTextFormatPainter()

const fontSizeOptions = [
  '12px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '32px',
  '36px', '40px', '44px', '48px', '54px', '60px', '66px', '72px', '76px',
  '80px', '88px', '96px', '104px', '112px', '120px',
]

const emitRichTextCommand = (command: string, value?: string) => {
  emitter.emit(EmitterEvents.RICH_TEXT_COMMAND, { action: { command, value } })
}

const bulletListPanelVisible = ref(false)
const orderedListPanelVisible = ref(false)
const indentLeftPanelVisible = ref(false)
const indentRightPanelVisible = ref(false)

const bulletListStyleTypeOption = ref(['disc', 'circle', 'square'])
const orderedListStyleTypeOption = ref(['decimal', 'lower-roman', 'upper-roman', 'lower-alpha', 'upper-alpha', 'lower-greek'])

const link = ref('')
const linkPopoverVisible = ref(false)

watch(richTextAttrs, () => linkPopoverVisible.value = false)

const openLinkPopover = () => {
  link.value = richTextAttrs.value.link
}
const updateLink = (link?: string) => {
  const linkRegExp = /^(https?):\/\/[\w\-]+(\.[\w\-]+)+([\w\-.,@?^=%&:\/~+#]*[\w\-@?^=%&\/~+#])?$/
  if (!link || !linkRegExp.test(link)) return message.error('올바른 웹 주소가 아닙니다')

  emitRichTextCommand('link', link)
  linkPopoverVisible.value = false
}

const removeLink = () => {
  emitRichTextCommand('link')
  linkPopoverVisible.value = false
}
</script>

<style lang="scss" scoped>
.rich-text-base {
  user-select: none;

  ::v-deep(.ai-loading) {
    width: 16px;
    height: 16px;
    display: inline-block;
    margin-top: 8px;
    border: 1px solid $themeColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spinner .8s linear infinite;
  }
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.font-size-btn {
  padding: 0;
}
.link-popover {
  width: 240px;

  .btns {
    margin-top: 10px;
    text-align: right;
  }
}
.list-wrap {
  width: 176px;
  color: #666;
  padding: 8px;
  margin: -12px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
}
.list {
  background-color: $lightGray;
  padding: 4px 4px 4px 20px;
  cursor: pointer;

  &:not(:nth-child(3n)) {
    margin-right: 8px;
  }

  &:nth-child(4),
  &:nth-child(5),
  &:nth-child(6) {
    margin-top: 8px;
  }

  &:hover {
    color: $themeColor;

    span {
      background-color: $themeColor;
    }
  }
}
.list-item {
  width: 24px;
  height: 12px;
  position: relative;
  font-size: 10px;
  top: -2px;

  span {
    width: 100%;
    height: 2px;
    display: inline-block;
    position: absolute;
    top: 8px;
    background-color: #666;
  }
}
.popover-btn {
  padding: 0 3px;
}

@keyframes spinner {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>