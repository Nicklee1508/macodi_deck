<template>
  <Modal :visible="!!fileState.dialog" :width="fileState.dialog === 'open' ? 760 : 420" @closed="fileState.dialog = ''">
    <!-- 다른 이름으로 저장 -->
    <div v-if="fileState.dialog === 'saveAs'" class="fd-save">
      <div class="fd-title">{{ fileState.id ? '다른 이름으로 저장' : '저장' }}</div>
      <input
        ref="nameRef"
        v-model="name"
        class="fd-input"
        placeholder="파일 이름 (예: OO 오피스 마감재 제안서)"
        maxlength="80"
        @keydown.enter.prevent="doSaveAs"
        @keydown.stop
      />
      <div class="fd-note">이 브라우저에 저장돼요. 다른 PC·브라우저에서는 보이지 않아요.</div>
      <div class="fd-btns">
        <Button type="primary" class="fd-ok" @click="doSaveAs">저장</Button>
        <Button @click="fileState.dialog = ''">취소</Button>
      </div>
    </div>

    <!-- 열기 -->
    <div v-else-if="fileState.dialog === 'open'" class="fd-open">
      <div class="fd-title">내 파일 열기</div>
      <div class="fd-grid">
        <!-- 새 프로젝트 — 맨 앞, 빈 캔버스로 시작 -->
        <div class="fd-card fd-new" @click="doOpenBlank">
          <div class="fd-thumb fd-new-box">
            <span class="fd-plus">+</span>
          </div>
          <div class="fd-name">새 프로젝트 생성</div>
          <div class="fd-meta">빈 캔버스로 시작</div>
        </div>
        <!-- 샘플 제안서 — 새 프로젝트 다음(삭제 불가). 열면 새 문서로 시작 -->
        <div class="fd-card sample" :class="{ cur: fileState.sample && !fileState.id }" @click="doOpenSample">
          <div class="fd-thumb">
            <ThumbnailSlide v-if="sampleThumb" :slide="sampleThumb" :size="216" />
          </div>
          <div class="fd-name">샘플 제안서</div>
          <div class="fd-meta">moodeck 예시 · {{ sampleCount }}장</div>
          <span class="fd-badge">샘플</span>
        </div>
        <div
          v-for="f in files"
          :key="f.id"
          class="fd-card"
          :class="{ cur: f.id === fileState.id }"
          @click="doOpen(f)"
        >
          <div class="fd-thumb">
            <ThumbnailSlide v-if="f.slides.length" :slide="(f.slides[0] as Slide)" :size="216" />
          </div>
          <div class="fd-name" :title="f.name">{{ f.name }}</div>
          <div class="fd-meta">
            {{ fmt(f.savedAt) }} · {{ f.slides.length }}장<template v-if="f.id === fileState.id"> · 지금 연 파일</template>
          </div>
          <span class="fd-del" title="삭제" @click.stop="doDelete(f)">×</span>
        </div>
      </div>
      <div v-if="!files.length" class="fd-empty">아직 저장한 파일이 없어요. 작업 중에 <b>Ctrl+S</b> 를 누르면 이름을 붙여 저장돼요.</div>
      <div class="fd-note">이 브라우저에 저장된 파일이에요. 브라우저의 사이트 데이터를 지우면 함께 지워지니, 중요한 제안서는 PPTX 로도 내려받아 두세요.</div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { Slide } from '@/types/slides'
import Modal from '@/components/Modal.vue'
import Button from '@/components/Button.vue'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import { type DeckFile, deleteFile, fileState, listFiles } from './autosave'
import useDeckFiles from './useDeckFiles'
import { fetchSampleDeck } from './sampleDeck'
import { ensureSubscribed } from './subscription'

const { title } = storeToRefs(useSlidesStore())
const { saveFileAs, openFile, openSample, openBlank } = useDeckFiles()

// 샘플 제안서 미리보기(첫 화면 슬라이드)
const sampleThumb = ref<Slide | null>(null)
const sampleCount = ref(0)
const loadSampleThumb = () => fetchSampleDeck().then(d => {
  sampleThumb.value = d.slides[d.startIndex] || d.slides[0] || null
  sampleCount.value = d.slides.length
}).catch(() => undefined)
const doOpenBlank = async () => {
  if (!(await ensureSubscribed('new'))) return // 새 프로젝트 = 구독 기능(서버로 바로 확인)
  if (openBlank()) fileState.dialog = ''
}
const doOpenSample = async () => {
  // 지금 열려 있는 게 샘플이면 그대로 이어서(고친 내용 유지)
  if (fileState.sample && !fileState.id) {
    fileState.dialog = ''
    return
  }
  if (await openSample()) fileState.dialog = ''
}

const name = ref('')
const nameRef = useTemplateRef<HTMLInputElement>('nameRef')
const files = ref<DeckFile[]>([])

const refresh = () => listFiles().then(l => (files.value = l)).catch(() => (files.value = []))

watch(() => fileState.dialog, d => {
  if (d === 'saveAs') {
    name.value = fileState.id ? `${fileState.name} 사본` : title.value
    nextTick(() => {
      nameRef.value?.focus()
      nameRef.value?.select()
    })
  }
  if (d === 'open') {
    refresh()
    loadSampleThumb()
  }
}, { immediate: true }) // 첫 화면으로 이미 열린 채 시작할 때도

const doSaveAs = async () => {
  await saveFileAs(name.value)
  fileState.dialog = ''
}

const doOpen = async (f: DeckFile) => {
  if (await openFile(f)) fileState.dialog = ''
}

const doDelete = async (f: DeckFile) => {
  if (!window.confirm(`'${f.name}' 파일을 삭제할까요? 되돌릴 수 없어요.`)) return
  await deleteFile(f.id)
  // 지금 연 파일을 지우면 연결만 끊고 작업 내용은 그대로(다음 Ctrl+S 는 이름부터)
  if (f.id === fileState.id) {
    fileState.id = ''
    fileState.name = ''
    fileState.dirty = true
  }
  refresh()
}

const fmt = (t: number) => new Date(t).toLocaleString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<style lang="scss" scoped>
.fd-title {
  font-size: 15px;
  font-weight: 700;
  color: #222;
  margin-bottom: 14px;
}
.fd-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid $borderColor;
  border-radius: $borderRadius;
  font: inherit;
  font-size: 13px;
  outline: none;
  &:focus { border-color: $themeColor; }
}
.fd-note {
  margin-top: 10px;
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}
.fd-btns {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  .fd-ok { width: 90px; }
}
.fd-new {
  border-style: dashed;
  &:hover .fd-new-box { border-color: $themeColor; color: $themeColor; }
}
.fd-new-box {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #d5d5dc;
  background: #fafafc;
  color: #b0b0ba;
  outline: none;
}
.fd-plus {
  width: 42px;
  height: 42px;
  border: 2px solid currentColor;
  border-radius: 50%;
  font-size: 28px;
  line-height: 36px;
  text-align: center;
  font-weight: 300;
}
.fd-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 1px 7px;
  border-radius: 999px;
  background: $themeColor;
  color: #fff;
  font-size: 11px;
}
.fd-empty {
  padding: 12px 0 0;
  text-align: center;
  font-size: 13px;
  color: #888;
  line-height: 1.8;
}
.fd-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 6px;
}
.fd-card {
  position: relative;
  padding: 8px;
  border: 1px solid $borderColor;
  border-radius: 8px;
  cursor: pointer;
  &:hover { border-color: $themeColor; }
  &.cur { border-color: $themeColor; box-shadow: 0 0 0 1px $themeColor; }
}
.fd-thumb {
  overflow: hidden;
  border-radius: 4px;
  background: #f5f5f5;
  outline: 1px solid #eee;
}
.fd-name {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fd-meta {
  margin-top: 2px;
  font-size: 11px;
  color: #999;
}
.fd-del {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #333;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  display: none;
}
.fd-card:hover .fd-del { display: block; }
</style>
