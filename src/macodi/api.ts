// 마코디 백엔드 호출 — dev 는 vite 프록시(/macodi-api → localhost:8008), 운영은 api2 직접.
export const MACODI_API = import.meta.env.DEV ? '/macodi-api' : 'https://api2.macodi.co.kr:8000'
// AI 검색은 정식 AI 서버. 로컬 테스트만 .env 의 VITE_AI_URL(예: http://127.0.0.1:8006)로 바꿀 수 있음
//  ⚠️ npm run dev 에서만 적용 — 운영 빌드에 localhost 가 박히지 않게
export const AI_URL = (import.meta.env.DEV && (import.meta.env.VITE_AI_URL as string | undefined)) || 'https://apiai.macodi.co.kr:8016'
// 이미지 리사이즈 CDN(CORS 허용) — 삽입 이미지는 JPEG 로 받아 dataURL 로 넣는다(pptx 내보내기 안전).
export const IMG_CDN = 'https://d3fa4re4p86i6s.cloudfront.net'

export interface MacodiProduct {
  id: number
  name?: string
  img?: string
  flatImg?: string | null
  brand?: string
  store?: string
  companyName?: string
  category?: string
  subCategory?: string
  series?: string
  size?: string | null // 규격(mm) "가로*세로*두께" — /product 결과에만 있음
}

const postJson = <T>(path: string, body: unknown): Promise<T> =>
  fetch(MACODI_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json() as Promise<T>
  })

export interface ProductPage { list: MacodiProduct[]; hasMore: boolean; randSeed?: number }

/** 자재 목록/텍스트 검색 — /product 페이지 단위. 무작위 순서라 첫 페이지의 randSeed 를 다음 페이지에도 넘겨야 중복 없이 이어진다 */
export const searchProducts = (txt: string, page = 1, randSeed?: number): Promise<ProductPage> => {
  const body: Record<string, unknown> = { page }
  if (txt) body.txtSearch = txt
  if (randSeed) body.randSeed = randSeed
  return postJson<{ products?: MacodiProduct[]; next?: number | null; randSeed?: number } | MacodiProduct[]>('/product', body)
    .then(d => {
      if (Array.isArray(d)) return { list: d, hasMore: false }
      const list = d.products || []
      return { list, hasMore: !!d.next && list.length > 0, randSeed: d.randSeed }
    })
}

/** 색 유사도 검색(+검색어 함께) — 웹 홈 컬러 필터와 같은 /filters/color-search. 결과엔 브랜드가 없어 meta-map 으로 채움(조회수 안 올림) */
export const colorSearchProducts = (hex: string, txt: string, page = 1, loaded = 0): Promise<ProductPage> => {
  const body: Record<string, unknown> = { page, color: hex }
  if (txt) body.txtSearch = txt
  return postJson<{ data?: MacodiProduct[]; total?: number }>('/filters/color-search', body).then(d => {
    const list = Array.isArray(d?.data) ? d.data : []
    const hasMore = list.length > 0 && loaded + list.length < (d?.total || 0)
    const ids = list.map(x => x.id).filter(Boolean)
    if (!ids.length) return { list, hasMore }
    return postJson<Record<string, { b?: string }>>('/product/meta-map', { ids })
      .then(m => {
        list.forEach(x => {
          const v = m && m[x.id]
          if (v && !x.brand) x.brand = v.b
        })
        return { list, hasMore }
      })
      .catch(() => ({ list, hasMore }))
  })
}

/** 스펙 카드용 보강 — 색·AI 검색 결과엔 브랜드·사이즈가 없어 채운다.
 *  브랜드 = /product/meta-map(조회수 안 올림), 사이즈 = /product/detail 의 ProductOption(실제 삽입 = 실사용이라 조회 1회 기록됨) */
export const enrichForCard = async (p: MacodiProduct): Promise<MacodiProduct> => {
  const out = { ...p }
  if (!(out.brand || out.store || out.companyName) && out.id) {
    await postJson<Record<string, { b?: string }>>('/product/meta-map', { ids: [out.id] })
      .then(m => { out.brand = m?.[out.id]?.b || '' })
      .catch(() => { /* 없으면 생략 */ })
  }
  if (!out.size && out.id > 0) {
    await postJson<{ ProductOption?: { size?: string | null }[] }>('/product/detail', { productId: out.id })
      .then(d => { out.size = d?.ProductOption?.find(o => o.size)?.size || null })
      .catch(() => { /* 없으면 생략 */ })
  }
  return out
}

const isMacodiS3 = (host: string) => /(^|\.)backend-snl\.s3([.-][^/]*)?\.amazonaws\.com$/i.test(host)

/** 썸네일/삽입용 CDN 주소. format 은 webp(썸네일) 또는 jpeg(삽입 — pptx 는 webp 미지원) */
export const toCdn = (url: string | undefined | null, width: number, format: 'webp' | 'jpeg' = 'webp'): string => {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (!isMacodiS3(u.hostname) && u.hostname !== new URL(IMG_CDN).hostname) return url
    const out = new URL(IMG_CDN + u.pathname)
    out.searchParams.set('width', String(width))
    out.searchParams.set('format', format)
    out.searchParams.set('quality', format === 'jpeg' ? '88' : '75')
    return out.toString()
  }
  catch {
    return url
  }
}

/** 이미지 → dataURL(JPEG). 실패하면 원본 주소 그대로 */
export const toDataUrl = (url: string): Promise<string> =>
  fetch(url, { mode: 'cors' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.blob()
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const rd = new FileReader()
      rd.onload = () => resolve(String(rd.result))
      rd.onerror = reject
      rd.readAsDataURL(blob)
    }))
