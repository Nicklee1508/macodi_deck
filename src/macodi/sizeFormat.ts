/**
 * 사이즈 → "가로×세로" 표시 — 마코디 웹 utils/sizeFormat.ts(parseSizeAxes) 와 같은 판정 규칙.
 *  - 3개(W*L*T): W, L
 *  - 2개(W*L): 뒤가 소수이거나 60 미만이면 두께로 보고 버림 (914*0.8 → 914)
 *  - 1개: 100 이상이면 폭(W)만, 미만이면 두께라 표시 안 함
 *  - 여러 사이즈("600*600,600*1200")는 첫 번째 + "외"
 *  - 숫자 없는 값(해당없음·별도문의)은 표시 안 함
 */
export const sizeWxL = (raw?: string | null): string => {
  const all = String(raw ?? '').split(',').map(t => t.trim()).filter(Boolean)
  if (!all.length) return ''
  const toks = all[0].split('*').map(t => t.trim()).filter(Boolean)
  if (!toks.some(t => /\d/.test(t))) return ''
  const n = toks.length
  let W: string | null = null, L: string | null = null
  toks.forEach((tok, i) => {
    const val = tok.replace(/T$/i, '')
    if (/T$/i.test(tok) || !/\d/.test(val)) return
    const num = parseFloat(val)
    if (n === 1) {
      if (!isNaN(num) && num >= 100) W = val
    }
    else if (n === 2) {
      if (i === 0) W = val
      else if (!(val.includes('.') || (!isNaN(num) && num < 60))) L = val
    }
    else if (i === 0) W = val
    else if (i === 1) L = val
  })
  const s = W && L ? `${W}×${L}` : W || ''
  return s ? s + (all.length > 1 ? ' 외' : '') : ''
}
