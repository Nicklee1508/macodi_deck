<template>
  <div class="export-url-dialog">
    <div class="configs">
      <div class="lead">
        지금 제안서를 <b>링크 하나</b>로 보내세요. 받는 분은 로그인 없이 브라우저에서 슬라이드를 넘겨 보고,
        스펙 카드의 마코디 제품 링크도 열어볼 수 있어요.
      </div>

      <template v-if="link">
        <div class="row">
          <input class="link" :value="link" readonly @focus="e => (e.target as HTMLInputElement).select()" />
          <Button class="copy" type="primary" @click="copy">{{ copied ? '복사됨' : '복사' }}</Button>
        </div>
        <div class="meta">
          열람 {{ stats.viewCount }}회<template v-if="stats.lastViewedAt"> · 마지막 열람 {{ fmt(stats.lastViewedAt) }}</template>
          · <a :href="link" target="_blank" rel="noopener">새 탭에서 보기</a>
        </div>
        <div class="tip">내용을 고친 뒤 <b>[링크 갱신]</b>을 누르면 같은 주소가 최신 내용으로 바뀌어요. 다른 고객용으로 따로 보내려면 <b>[새 링크 만들기]</b>를 누르세요.</div>
      </template>
      <div v-else class="tip">아직 만든 링크가 없어요. 아래 버튼을 누르면 링크가 만들어지고 바로 복사돼요.</div>

      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <div class="btns">
      <Button class="btn export" type="primary" :disabled="busy" @click="share(false)">
        <i-icon-park-outline:link-one /> {{ busy ? '만드는 중…' : link ? '링크 갱신' : '링크 만들기' }}
      </Button>
      <Button v-if="link" class="btn new" :disabled="busy" @click="share(true)">새 링크 만들기</Button>
      <Button class="btn close" @click="emit('close')">닫기</Button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import { MACODI_API } from '@/macodi/api'
import Button from '@/components/Button.vue'

const emit = defineEmits<{ (event: 'close'): void }>()
const { slides, title, theme, viewportRatio } = storeToRefs(useSlidesStore())

// 이 브라우저에서 만든 마지막 링크(수정 키 포함) — 같은 링크 갱신용
const KEY = 'macodi.deck.share'
const readSaved = (): { shareKey: string; editKey: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  }
  catch {
    return null
  }
}
const saved = ref(readSaved())
const linkOf = (k: string) => `${window.location.origin}/?v=${k}`
const link = ref(saved.value ? linkOf(saved.value.shareKey) : '')
const stats = reactive({ viewCount: 0, lastViewedAt: null as string | null })
const busy = ref(false)
const copied = ref(false)
const error = ref('')

const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const loadStats = () => {
  if (!saved.value) return
  fetch(`${MACODI_API}/deck-share/${saved.value.shareKey}/stats?editKey=${encodeURIComponent(saved.value.editKey)}`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d) return
      stats.viewCount = d.viewCount || 0
      stats.lastViewedAt = d.lastViewedAt || null
    })
    .catch(() => { /* 무시 */ })
}

const copy = () => {
  if (!link.value) return
  navigator.clipboard?.writeText(link.value).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }).catch(() => { /* 직접 선택해서 복사 */ })
}

const share = async (fresh: boolean) => {
  busy.value = true
  error.value = ''
  try {
    const body = {
      title: title.value,
      slides: slides.value,
      theme: theme.value,
      viewportRatio: viewportRatio.value,
      ...(!fresh && saved.value ? saved.value : {}),
    }
    const r = await fetch(`${MACODI_API}/deck-share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d?.message || '링크를 만들지 못했어요.')
    saved.value = { shareKey: d.shareKey, editKey: d.editKey }
    try {
      localStorage.setItem(KEY, JSON.stringify(saved.value))
    }
    catch { /* 저장 불가 = 매번 새 링크 */ }
    link.value = linkOf(d.shareKey)
    stats.viewCount = d.viewCount || 0
    stats.lastViewedAt = d.lastViewedAt || null
    copy()
  }
  catch (e) {
    error.value = (e as Error)?.message || '링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
  }
  finally {
    busy.value = false
  }
}

onMounted(loadStats)
</script>

<style lang="scss" scoped>
.export-url-dialog {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}
.configs {
  width: 520px;
  height: calc(100% - 80px);
  display: flex;
  flex-direction: column;
  justify-content: center;

  .lead {
    font-size: 13px;
    color: #333;
    line-height: 1.7;
    margin-bottom: 22px;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .link {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0 10px;
    border: 1px solid $borderColor;
    border-radius: $borderRadius;
    font: inherit;
    font-size: 13px;
    color: #333;
    outline: none;
    &:focus { border-color: $themeColor; }
  }
  .copy { width: 80px; }
  .meta {
    margin-top: 10px;
    font-size: 12px;
    color: #666;
    a { color: $themeColor; }
  }
  .tip {
    margin-top: 14px;
    font-size: 12px;
    color: #999;
    line-height: 1.7;
  }
  .error {
    margin-top: 12px;
    font-size: 12px;
    color: #d33;
  }
}
.btns {
  width: 520px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;

  .export { flex: 1; }
  .new { width: 130px; }
  .close { width: 110px; }
}
</style>
