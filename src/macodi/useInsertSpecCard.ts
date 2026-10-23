import { nanoid } from 'nanoid'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import type { PPTImageElement, PPTTextElement } from '@/types/slides'
import { type MacodiProduct, enrichForCard, toCdn, toDataUrl } from './api'
import { sizeWxL } from './sizeFormat'

// 마코디 제품 페이지(SEO 정적 페이지 → 사람은 마코디 상세로 이동). 마이텍(음수 id) = mt-번호
const productUrl = (id: number) => `https://macodi.co.kr/product/${id > 0 ? id : 'mt-' + Math.abs(id)}/`

// 링크 버튼 그림 — 마코디 웹 제품 상세의 링크 버튼과 같은 모양
//  (반투명 흰 사각형 rgba(255,255,255,.7)·모서리 8px + 진회색 '새 창' 아이콘 = macodi_next_front public/images/board/link.svg)
//  pptx 에도 그대로 들어가게 PNG 로 한 번 만들어 둔다
const LINK_SVG_PATH = 'M15.5058 9.19713V15.8046C15.5076 16.0563 15.4592 16.3058 15.3634 16.5385C15.2675 16.7712 15.1262 16.9824 14.9477 17.1598C14.7692 17.3372 14.5571 17.4772 14.3239 17.5716C14.0906 17.6661 13.8408 17.713 13.5892 17.7096H4.20833C3.95577 17.7129 3.70511 17.6655 3.47115 17.5703C3.23719 17.4752 3.02466 17.3341 2.84609 17.1554C2.66753 16.9768 2.52655 16.7642 2.43147 16.5302C2.33639 16.2962 2.28914 16.0455 2.2925 15.793V6.41213C2.28948 6.1596 2.33699 5.90901 2.43225 5.6751C2.5275 5.4412 2.66857 5.22871 2.84715 5.05012C3.02573 4.87154 3.23823 4.73047 3.47213 4.63522C3.70603 4.53997 3.95662 4.49245 4.20916 4.49547H10.8158M17.7083 2.29297L8.89916 11.1021M17.7083 2.29297H13.3033M17.7083 2.29297V6.69797'
let linkIcon = ''
const linkIconPng = () => {
  if (linkIcon) return linkIcon
  const S = 120 // 40px 버튼의 3배 해상도
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.beginPath()
  g.roundRect(0, 0, S, S, 24)
  g.fill()
  // 아이콘 22px(20 그리드) 을 40px 버튼 가운데 → 3배
  const k = (22 / 20) * 3
  g.translate((S - 20 * k) / 2, (S - 20 * k) / 2)
  g.scale(k, k)
  g.strokeStyle = '#333333'
  g.lineWidth = 1.5
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.stroke(new Path2D(LINK_SVG_PATH))
  linkIcon = c.toDataURL('image/png')
  return linkIcon
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 카드 글자(위→아래): 브랜드 / 제품명 / 구분·종류 / 사이즈 — 모두 '제목 값' 같은 모양 */
const infoRows = (p: MacodiProduct): [string, string][] => {
  const brand = p.brand || p.store || p.companyName || ''
  const kind = [p.category, p.subCategory].filter(Boolean).join('/')
  const size = sizeWxL(p.size).replace(/×/g, '*')
  return ([
    ['브랜드', brand],
    ['제품명', p.name || '자재'],
    ['구분/종류', kind],
    ['사이즈', size],
  ] as [string, string][]).filter(r => r[1].trim())
}

/**
 * 스펙 카드(이미지 + 제품명·정보 텍스트)를 현재 슬라이드에 그룹으로 삽입.
 * 이미지는 dataURL 로 넣어 pptx 내보내기·오프라인에서도 깨지지 않게 한다.
 */
export default () => {
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { theme, viewportRatio, viewportSize, currentSlide } = storeToRefs(slidesStore)
  const { addHistorySnapshot } = useHistorySnapshot()

  const insertSpecCard = async (product: MacodiProduct) => {
    const p = await enrichForCard(product)
    const src = await toDataUrl(toCdn(p.flatImg || p.img, 1200, 'jpeg')).catch(() => p.flatImg || p.img || '')
    if (!src) throw new Error('이미지를 불러오지 못했어요.')

    const IMG = 220
    const TEXT_H = infoRows(p).length * 20 + 6
    const count = currentSlide.value?.elements.length || 0
    const offset = (count % 6) * 16 // 연속 삽입 시 계단식으로 겹침 방지
    const left = (viewportSize.value - IMG) / 2 + offset
    const top = Math.max(10, (viewportSize.value * viewportRatio.value - IMG - TEXT_H) / 2) + offset
    const groupId = nanoid(10)

    const image: PPTImageElement = {
      type: 'image', id: nanoid(10), groupId,
      src, left, top, width: IMG, height: IMG, fixedRatio: true, rotate: 0,
    }
    const html =
      infoRows(p).map(([k, v]) => `<p><span style="font-size: 12px; color: #666666;">${k}</span><span style="font-size: 12px;">   ${esc(v)}</span></p>`).join('')
    const text: PPTTextElement = {
      type: 'text', id: nanoid(10), groupId,
      left, top: top + IMG + 6, width: IMG, height: TEXT_H, rotate: 0,
      content: html,
      defaultFontName: theme.value.fontName,
      defaultColor: theme.value.fontColor,
    }
    // 썸네일 안쪽 오른쪽 아래 링크 버튼 — 누르면(슬라이드 쇼·내보낸 pptx) 마코디 제품 페이지로
    const BTN = 24, GAP = 8
    const elements: (PPTImageElement | PPTTextElement)[] = [image, text]
    if (p.id) {
      elements.push({
        type: 'image', id: nanoid(10), groupId,
        src: linkIconPng(), left: left + IMG - BTN - GAP, top: top + IMG - BTN - GAP, width: BTN, height: BTN, fixedRatio: true, rotate: 0,
        link: { type: 'web', target: productUrl(p.id) },
      })
    }
    slidesStore.addElement(elements)
    mainStore.setActiveElementIdList(elements.map(e => e.id))
    addHistorySnapshot()
  }

  return { insertSpecCard }
}
