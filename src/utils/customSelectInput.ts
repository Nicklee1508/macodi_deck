/**
 * 드롭다운에 숫자를 직접 입력(Enter) — 목록에 없는 값도 지정
 *  글자 크기 1px 이상, 줄 간격 0보다 큰 배수, 문단 간격 0px 이상, 자간은 음수(좁게)도 허용
 */
export interface CustomOption { label: string; value: string | number }
type Parser = (text: string) => CustomOption | null

const num = (text: string) => {
  const m = text.trim().replace(/,/g, '.').match(/^-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Math.round(parseFloat(m[0]) * 100) / 100
  return Number.isFinite(n) ? n : null
}

export const customFontSize: Parser = t => {
  const n = num(t)
  return n !== null && n >= 1 ? { label: `${n}px`, value: `${n}px` } : null
}
export const customLineHeight: Parser = t => {
  const n = num(t)
  return n !== null && n > 0 ? { label: `${n}배`, value: n } : null
}
export const customParagraphSpace: Parser = t => {
  const n = num(t)
  return n !== null && n >= 0 ? { label: `${n}px`, value: n } : null
}
export const customWordSpace: Parser = t => {
  const n = num(t)
  return n !== null ? { label: `${n}px`, value: n } : null
}
