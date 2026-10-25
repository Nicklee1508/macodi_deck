<template>
  <!-- 구독 창 — 크기는 '내 파일 열기'와 같게(760).
       plan(요금 안내) → form(이메일·동의) → 토스 카드 등록 → success(키 메일 안내) / activate(키 입력) / manage(구독 관리) -->
  <Modal :visible="!!subscribeState.mode" :width="760" @closed="close">
    <!-- 요금 안내(무료 · 구독) + 이메일·동의 — 랜딩 요금 안내와 같은 구성 -->
    <div v-if="subscribeState.mode === 'plan' || subscribeState.mode === 'form'" class="sp">
      <div class="sp-head">
        <h3 class="sd-title center">{{ headTitle }}</h3>
        <p class="sd-desc center">PPT는 무료, 마감재로 제안서를 더 빠르게 만들고 싶을 때 구독하세요.</p>
      </div>

      <div class="sp-cards">
        <!-- 무료 -->
        <div class="sp-card free">
          <p class="sp-name">무료</p>
          <p class="sp-price">0<span class="unit">원</span></p>
          <p class="sp-sub">누구나 바로 사용하는 온라인 PPT</p>
          <ul class="sp-checks muted">
            <li>슬라이드 편집 기능 전체</li>
            <li>제안서 템플릿</li>
            <li>.pptx 불러오기 · 내보내기</li>
            <li>PDF · 이미지 내보내기</li>
            <li>슬라이드 쇼 · 발표자 모드</li>
            <li>마감재 이미지 배치 1개 체험</li>
          </ul>
          <button type="button" class="sp-btn ghost" @click="close">무료로 계속 쓰기</button>
        </div>

        <!-- 구독(추천) -->
        <div class="sp-card pro">
          <span class="sp-badge">추천</span>
          <p class="sp-name">구독</p>
          <p class="sp-price">4,900<span class="unit">원</span><span class="per">/ 월</span></p>
          <p class="sp-sub">무료 기능에 제안서 작업을 더 빠르게</p>

          <template v-if="subscribeState.mode === 'plan'">
            <ul class="sp-checks">
              <li>무료 기능 모두 포함</li>
              <li><b>새 프레젠테이션 추가 제작</b></li>
              <li><b>원클릭 마감재 이미지 슬라이드 배치</b></li>
              <li>제품 상세 페이지 링크 자동 연결</li>
            </ul>
            <button type="button" class="sp-btn" @click="subscribeState.mode = 'form'">구독하고 시작하기</button>
            <p class="sp-note">VAT 포함 · 매월 자동결제 · 언제든 해지</p>
          </template>

          <template v-else>
            <input v-model.trim="email" class="sd-input" type="email" placeholder="영수증·활성화 키를 받을 이메일" @keydown.stop @keydown.enter="pay" />
            <label class="sd-agree"><input v-model="agreeAuto" type="checkbox" /> 매월 4,900원 자동결제에 동의합니다</label>
            <label class="sd-agree"><input v-model="agreeTerms" type="checkbox" /> <span><a href="https://macodi.co.kr/terms" target="_blank" rel="noopener">이용약관·해지·환불 규정</a>에 동의합니다</span></label>
            <button type="button" class="sp-btn" :disabled="!canPay || busy" @click="pay">{{ busy ? '결제창 여는 중…' : '카드 등록하고 구독 시작' }}</button>
            <p class="sp-note">다음 결제일 {{ nextDate }} · 해지해도 그날까지 이용</p>
          </template>
          <div v-if="error" class="sd-error">{{ error }}</div>
        </div>
      </div>

      <button type="button" class="sd-link" @click="goActivate">이미 활성화 키가 있어요</button>
    </div>

    <!-- 결제 완료 — 키를 메일로 보냈다는 안내 -->
    <div v-else-if="subscribeState.mode === 'success'" class="sd-one">
      <div class="sd-ok">✓</div>
      <h3 class="sd-title center">구독이 시작되었어요</h3>
      <p class="sd-desc center">
        <template v-if="subscribeState.mailed"><b>{{ subscribeState.email }}</b>로 영수증과 <b>활성화 키</b>를 보내 드렸어요.</template>
        <template v-else>메일 발송이 늦어지고 있어요. 아래 활성화 키를 꼭 따로 적어 두세요.</template>
      </p>
      <div class="sd-key">
        <span>{{ subscribeState.issuedKey }}</span>
        <button type="button" @click="copyKey">{{ copied ? '복사됨' : '복사' }}</button>
      </div>
      <p class="sd-small center">이 PC는 바로 활성화되었어요. 다른 PC에서는 ☰ 메뉴 → [활성화 키 입력]에 키를 넣으면 되고,<br />키는 PC 1대에서만 쓸 수 있어 다른 PC에서 입력하면 이 PC는 비활성화돼요.</p>
      <button type="button" class="sd-btn narrow" @click="close">시작하기</button>
    </div>

    <!-- 카드 등록·첫 결제 실패(토스 창에서 돌아온 뒤) -->
    <div v-else-if="subscribeState.mode === 'failed'" class="sd-one">
      <div class="sd-ok fail">!</div>
      <h3 class="sd-title center">{{ subscribeState.failTitle }}</h3>
      <p class="sd-desc center">{{ subscribeState.failMsg }}<br /><b>결제는 되지 않았어요.</b></p>
      <div class="sd-two">
        <button type="button" class="sd-keep" @click="subscribeState.mode = 'form'">다른 카드로 다시 시도</button>
        <button type="button" class="sd-ghost" @click="close">닫기</button>
      </div>
    </div>

    <!-- 다른 PC에서 키 입력 -->
    <div v-else-if="subscribeState.mode === 'activate'" class="sd-one">
      <button type="button" class="sd-back" title="뒤로" @click="goBack"><i-icon-park-outline:left /> 뒤로</button>
      <h3 class="sd-title center">활성화 키 입력</h3>
      <p class="sd-desc center">구독할 때 메일로 받은 키를 넣어 주세요. 키는 PC 1대에서만 쓸 수 있어,<br />여기서 활성화하면 지금 쓰고 있는 다른 PC는 바로 비활성화돼요.</p>
      <input v-model.trim="keyInput" class="sd-input key" placeholder="MOOD-XXXX-XXXX-XXXX" maxlength="19" @keydown.stop @keydown.enter="doActivate" />
      <button type="button" class="sd-btn narrow" :disabled="busy || keyInput.length < 16" @click="doActivate">{{ busy ? '확인 중…' : '이 PC에서 활성화' }}</button>
      <div v-if="error" class="sd-error center">{{ error }}</div>
      <div class="sd-resend">
        키를 잃어버렸나요?
        <input v-model.trim="resendEmail" type="email" placeholder="구독한 이메일" @keydown.stop />
        <button type="button" :disabled="!resendEmail" @click="doResend">키 다시 받기</button>
        <p v-if="resent" class="ok">구독한 이메일이 맞다면 몇 분 안에 메일이 도착해요.<br />오지 않으면 이메일 주소를 다시 확인해 주세요.</p>
        
      </div>
    </div>

    <!-- 구독 관리 -->
    <div v-else-if="subscribeState.mode === 'manage'" class="sd-one">
      <h3 class="sd-title center">구독 관리</h3>
      <template v-if="subscribeState.active">
        <div class="sd-rows">
          <div><span>상태</span><b>{{ statusText }}</b></div>
          <div><span>요금</span><b>월 {{ subscribeState.amount.toLocaleString('ko-KR') }}원 (VAT 포함)</b></div>
          <div><span>{{ subscribeState.status === 'CANCEL_SCHEDULED' ? '이용 종료일' : '다음 결제일' }}</span><b>{{ fmt(subscribeState.nextBillingAt) }}</b></div>
          <div v-if="subscribeState.card"><span>결제 카드</span><b>{{ subscribeState.card }}</b></div>
          <div><span>이메일</span><b>{{ subscribeState.email }}</b></div>
          <div><span>활성화 키</span><b>{{ maskedKey }}</b></div>
        </div>
        <div class="sd-actions">
          <button v-if="subscribeState.status === 'CANCEL_SCHEDULED'" type="button" class="sd-btn narrow" :disabled="busy" @click="doCancel(true)">해지 취소</button>
          <template v-else-if="!confirmCancel">
            <button type="button" class="sd-ghost" @click="confirmCancel = true">구독 해지</button>
          </template>
          <template v-else>
            <p class="sd-small center">해지하면 {{ fmt(subscribeState.nextBillingAt) }}까지 이용하고 이후 결제되지 않아요.</p>
            <div class="sd-two">
              <button type="button" class="sd-danger" :disabled="busy" @click="doCancel(false)">해지하기</button>
              <button type="button" class="sd-keep" @click="confirmCancel = false">유지하기</button>
            </div>
          </template>
        </div>
      </template>
      <template v-else>
        <p class="sd-desc center">이 PC는 구독이 활성화되어 있지 않아요.</p>
        <div class="sd-two">
          <button type="button" class="sd-keep" @click="subscribeState.mode = 'plan'">구독 신청</button>
          <button type="button" class="sd-keep" @click="goActivate">활성화 키 입력</button>
        </div>
      </template>
      <div v-if="error" class="sd-error center">{{ error }}</div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'
import message from '@/utils/message'
import { activateKey, cancelSubscription, resendKey, startBilling, subscribeState } from './subscription'

const email = ref('')
const agreeAuto = ref(false)
const agreeTerms = ref(false)
const busy = ref(false)
const error = ref('')
const keyInput = ref('')
const resendEmail = ref('')
const resent = ref(false)
const copied = ref(false)
const confirmCancel = ref(false)

watch(() => subscribeState.mode, () => {
  error.value = ''
  busy.value = false
  confirmCancel.value = false
  resent.value = false
})

// '다른 PC에서 활성화돼 이 PC는 꺼짐' 같은 안내 → 화면 위 알림
watch(() => subscribeState.notice, n => {
  if (!n) return
  message.warning(n, { duration: 6000 })
  subscribeState.notice = ''
})

const close = () => {
  subscribeState.mode = ''
  subscribeState.reason = ''
}

const headTitle = computed(() => (
  subscribeState.reason === 'new' ? '새 프로젝트를 만들려면 구독이 필요해요'
    : subscribeState.reason === 'insert' ? '무료 체험(마감재 1개)을 모두 썼어요'
      : 'moodeck 요금 안내'
))
const canPay = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value) && agreeAuto.value && agreeTerms.value)
const nextDate = computed(() => {
  const d = new Date()
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()))
  return fmt(t.toISOString())
})
const fmt = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}
const statusText = computed(() => ({ ACTIVE: '이용 중', CANCEL_SCHEDULED: '해지 예정', PAST_DUE: '결제 재시도 중' } as Record<string, string>)[subscribeState.status] || subscribeState.status)
const maskedKey = computed(() => subscribeState.key.replace(/^(MOOD-\w{4})-.*$/, '$1-****-****'))

// 키 입력 화면으로 — 들어온 화면을 기억해 '뒤로'로 돌아감(메뉴에서 바로 열었으면 닫기)
const backTo = ref<'' | 'plan' | 'form' | 'manage'>('')
const goActivate = () => {
  keyInput.value = ''
  const m = subscribeState.mode
  backTo.value = m === 'plan' || m === 'form' || m === 'manage' ? m : ''
  subscribeState.mode = 'activate'
}
watch(() => subscribeState.mode, (m, prev) => {
  if (m === 'activate' && !prev) backTo.value = '' // 메뉴에서 바로 연 경우
})
const goBack = () => {
  if (backTo.value) subscribeState.mode = backTo.value
  else close()
}

/** 토스 카드 등록창으로(돌아오면 handleBillingReturn 이 첫 결제·키 발급) */
const pay = async () => {
  if (!canPay.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await startBilling(email.value)
  }
  catch (e) {
    const msg = (e as Error)?.message || ''
    if (!/USER_CANCEL|취소/i.test(msg)) error.value = msg || '결제창을 열지 못했어요.'
    busy.value = false
  }
}

const doActivate = async () => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await activateKey(keyInput.value)
    subscribeState.mode = 'manage'
  }
  catch (e) {
    error.value = (e as Error).message
  }
  busy.value = false
}

const doResend = async () => {
  try {
    await resendKey(resendEmail.value)
    resent.value = true
  }
  catch (e) {
    error.value = (e as Error).message
  }
}

const doCancel = async (undo: boolean) => {
  busy.value = true
  error.value = ''
  try {
    await cancelSubscription(undo)
    confirmCancel.value = false
  }
  catch (e) {
    error.value = (e as Error).message
  }
  busy.value = false
}

const copyKey = () => {
  navigator.clipboard?.writeText(subscribeState.issuedKey).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }).catch(() => { /* 직접 선택해서 복사 */ })
}
</script>

<style lang="scss" scoped>
$ink: #1d1b2b;
$sub: #8a8798;
$navy: #23443A;

.sd-back {
  position: absolute;
  top: 18px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px 6px 6px;
  border: 0;
  border-radius: 8px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: #5b6660;
  cursor: pointer;
  &:hover { background: #EEF2EE; color: #23443A; }
}
.sd-one {
  max-width: 480px;
  margin: 0 auto;
  padding: 18px 10px 12px;
  text-align: center;
}
.center { text-align: center; }
.sd-title {
  margin: 14px 0 8px;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.4;
  color: $ink;
  letter-spacing: -0.3px;
}
.sd-desc {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: $sub;
  b { color: $ink; }
}
.sd-link {
  margin-top: 18px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 12px;
  color: #23443A;
  text-decoration: underline;
  cursor: pointer;
}
.sd-btn {
  width: 100%;
  height: 50px;
  border: 0;
  border-radius: 12px;
  background: $navy;
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s;
  &:hover:not(:disabled) { background: #1A342C; }
  &:disabled { opacity: .45; cursor: default; }
  &.narrow { max-width: 320px; margin-top: 6px; }
}
.sd-input {
  box-sizing: border-box;
  width: 100%;
  height: 42px;
  margin-bottom: 10px;
  padding: 0 12px;
  border: 1px solid #d9d6e4;
  border-radius: 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
  &:focus { border-color: #23443A; }
  &.key { max-width: 320px; text-align: center; font-size: 16px; letter-spacing: 1px; text-transform: uppercase; }
}
.sd-agree {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #444;
  text-align: left;
  cursor: pointer;
  input { margin-top: 2px; accent-color: #23443A; }
  a { color: #23443A; }
}
.sd-small {
  margin: 10px 0 0;
  font-size: 11.5px;
  line-height: 1.7;
  color: $sub;
}
.sd-error {
  margin-top: 10px;
  font-size: 12px;
  color: #d33;
}
.sd-ok {
  width: 54px;
  height: 54px;
  margin: 0 auto 4px;
  border-radius: 50%;
  background: #EEF2EE;
  color: #23443A;
  font-size: 28px;
  font-weight: 800;
  line-height: 54px;
}
.sd-ok.fail { background: #fbeaea; color: #d33; }
.sd-key {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 4px auto 0;
  padding: 14px 16px;
  border: 1px dashed #CFD9D3;
  border-radius: 12px;
  background: #F6F8F6;
  span { font-size: 20px; font-weight: 800; letter-spacing: 1.5px; color: $ink; }
  button {
    padding: 5px 12px;
    border: 1px solid #CFD9D3;
    border-radius: 8px;
    background: #fff;
    font: inherit;
    font-size: 12px;
    color: #23443A;
    cursor: pointer;
  }
}
.sd-resend {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid #eee;
  font-size: 12px;
  color: $sub;
  input {
    width: 170px;
    height: 30px;
    margin: 0 6px;
    padding: 0 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font: inherit;
    font-size: 12px;
  }
  button {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .ok { margin: 10px 0 0; line-height: 1.6; color: #23443A; }
}
.sd-rows {
  margin: 4px 0 18px;
  border: 1px solid #eee;
  border-radius: 12px;
  text-align: left;
  div {
    display: flex;
    justify-content: space-between;
    padding: 11px 16px;
    font-size: 13px;
    span { color: $sub; }
    b { color: $ink; font-weight: 600; }
    & + div { border-top: 1px solid #f1f1f4; }
  }
}
.sd-actions { margin-top: 4px; }
.sd-two {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
}
// 해지 확인 — [해지하기][유지하기] 같은 크기(다크패턴 금지, 마코디와 동일 원칙)
.sd-danger, .sd-keep, .sd-ghost {
  width: 150px;
  height: 42px;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.sd-danger { border: 0; background: #d33; color: #fff; }
.sd-keep { border: 0; background: $navy; color: #fff; }
.sd-ghost { border: 1px solid #ddd; background: #fff; color: #555; font-weight: 600; }

// 요금 안내 — 무료 카드 + 구독(추천) 카드
.sp { padding: 12px 6px 6px; text-align: center; }
.sp-head .sd-title { margin-top: 4px; }
.sp-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  text-align: left;
}
.sp-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 26px 24px 20px;
  border: 1px solid #e3e8e3;
  border-radius: 18px;
  background: #fff;
  &.pro { border: 2px solid #23443A; }
}
// 휴대폰 — 카드를 위아래로(구독 카드 먼저)
@media (max-width: 600px) {
  .sp-cards { grid-template-columns: 1fr; gap: 22px; margin-top: 8px; }
  .sp-card { padding: 22px 20px 18px; }
  .sp-card.pro { order: -1; }
}
.sp-badge {
  position: absolute;
  top: -12px;
  left: 22px;
  padding: 3px 12px;
  border-radius: 999px;
  background: #D4A24C;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.sp-name { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #3a3a3a; }
.sp-price {
  margin: 0;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -1px;
  color: #1c2a25;
  line-height: 1.1;
  .unit { font-size: 30px; margin-left: 1px; }
  .per { margin-left: 4px; font-size: 14px; font-weight: 600; letter-spacing: 0; color: #8c958f; }
}
.sp-sub { margin: 8px 0 16px; font-size: 12.5px; color: #8c958f; }
.sp-checks {
  flex: 1;
  margin: 0 0 18px;
  padding: 0;
  list-style: none;
  li {
    position: relative;
    padding: 6px 0 6px 28px;
    font-size: 13.5px;
    color: #3a3a3a;
    b { font-weight: 700; color: #1c2a25; }
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 6px;
      width: 19px;
      height: 19px;
      border-radius: 50%;
      background: #EEF2EE url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' fill='none' stroke='%23D4A24C' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 12px no-repeat;
    }
  }
  &.muted li::before { filter: grayscale(1); opacity: .7; }
}
.sp-btn {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 12px;
  background: #23443A;
  color: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(35, 68, 58, .18);
  &:hover:not(:disabled) { background: #1A342C; }
  &:disabled { opacity: .45; cursor: default; box-shadow: none; }
  &.ghost { background: #fff; color: #23443A; border: 1px solid #cfd9d3; box-shadow: none; font-weight: 600; }
  &.ghost:hover { background: #F6F8F6; }
}
.sp-note { margin: 10px 0 0; font-size: 11.5px; color: #8c958f; text-align: center; }
.sp .sd-link { margin-top: 14px; }
</style>
