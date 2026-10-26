/**
 * 무드덱(moodeck) 계측 — GA4 + MA 1st-party(우리 엔드포인트) 병행.
 *  ⚠️ 기존 마코디 GTM/GA와 완전 분리: GA4 측정ID는 index.html / landing/index.html 의 '전용 속성' 스니펫에만.
 *  퍼널 연결키 = subscription.ts 의 deviceId(기기 UUID) → 비회원도 방문자별 유입→깊이→전환을 이을 수 있다.
 *  - GA4: window.gtag('event', ...)
 *  - MA : POST ${VITE_DECK_EVENTS_URL} (analytics_back /events/deck) — 설정 없으면 생략(GA4만 동작).
 *  둘 다 실패해도 서비스엔 영향 없다.
 */
import { deviceId } from './subscription'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

// 우리 MA 수집 엔드포인트(.../events/deck). 미설정 시 MA 비콘은 생략(GA4만).
const BEACON = ((import.meta as any).env?.VITE_DECK_EVENTS_URL as string | undefined) || ''

/** UTM 소스 — 랜딩 유입 시 저장(localStorage), 에디터에서도 첨부(랜딩→에디터 세션 연결). */
function getSource(): Record<string, string> {
  try {
    const p = new URLSearchParams(location.search)
    const cur: Record<string, string> = {}
    const src = p.get('utm_source')
    if (src) cur.source = src
    const med = p.get('utm_medium')
    if (med) cur.medium = med
    const cmp = p.get('utm_campaign')
    if (cmp) cur.campaign = cmp
    if (cur.source) {
      localStorage.setItem('moodeck.src', JSON.stringify(cur))
      return cur
    }
    const saved = localStorage.getItem('moodeck.src')
    if (saved) return JSON.parse(saved)
  }
  catch { /* 무시 */ }
  return {}
}

/** 관리자(내부) 기기 표식 — ?s=internal 로 한 번 각인하면 이후 비콘에 internal:1(MA 집계서 기본 제외). */
function internalFlag(): Record<string, number> {
  if (import.meta.env.DEV) return { internal: 1 } // 로컬 개발(npm run dev) 기록은 항상 사내
  try { return localStorage.getItem('moodeck.internal') === '1' ? { internal: 1 } : {} }
  catch { return {} }
}

export function track(event: string, params: Record<string, any> = {}): void {
  try {
    window.gtag?.('event', event, { device_id: deviceId, ...params })
  }
  catch { /* GA4 실패 무시 */ }
  if (BEACON) {
    try {
      fetch(BEACON, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ deviceId, event, page: 'editor', ...getSource(), ...internalFlag(), ...params }),
      }).catch(() => {})
    }
    catch { /* MA 비콘 실패 무시 */ }
  }
}
