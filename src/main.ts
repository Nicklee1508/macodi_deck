import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { track } from '@/macodi/analytics'
import { subscribeState } from '@/macodi/subscription'

import 'prosemirror-view/style/prosemirror.css'
import 'animate.css'
import '@/assets/styles/prosemirror.scss'
import '@/assets/styles/global.scss'
import '@/assets/styles/font.scss'

import Directive from '@/directive'

// 주소에 ?first 를 붙이면 '처음 온 사람' 화면을 다시 봄(샘플 첫 화면 + AI 튜토리얼). 테스트·시연용.
//  지금 하던 작업은 지워지지 않고 내 파일에 '이전 작업 (자동 보관)'으로 옮겨짐. 주소의 ?first 는 바로 지움.
if (new URLSearchParams(location.search).has('first')) {
  try {
    localStorage.removeItem('macodi.deck.sampleShown')
    localStorage.removeItem('macodi.deck.aiTipSeen')
  }
  catch { /* 무시 */ }
  history.replaceState(null, '', location.pathname)
}

const app = createApp(App)
app.use(Directive)
app.use(createPinia())
app.mount('#app')

// ── 무드덱 퍼널 계측(전용 GA4) ── 에디터 진입 + 유료벽/구독 단계. 방문자별 깊이·전환 측정용.
track('editor_open')
watch(
  () => subscribeState.mode,
  (m) => {
    if (m === 'plan') track('paywall_view', { reason: subscribeState.reason }) // 무료 소진→구독 유료벽 노출
    else if (m === 'form') track('subscribe_start') // '구독하고 시작하기' 클릭
    else if (m === 'success') track('subscribe_paid', { amount: subscribeState.amount }) // 결제 완료
  },
)
