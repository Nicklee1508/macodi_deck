/**
 * 한/영 전환 실수 바로잡기 — 한글 입력기가 꺼진 채 친 글자(예: vpdlsxm)를 두벌식 자판대로 한글(페인트)로
 *  - 입력기 상태는 운영체제가 쥐고 있어 웹에서 강제로 켤 수 없음 → 친 결과를 바로잡는 쪽으로 해결
 *  - 바꾼 결과가 "완성된 한글 글자만"일 때만 바꿈. tile·stone·LVT·SPC 같은 실제 영어/약어는
 *    중간에 홀자모가 남아(샤ㅣㄷ, 네ㅐㅜㄷ…) 그대로 둔다.
 */
const KEY: Record<string, string> = {
  q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
  Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ',
}
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const V2: Record<string, string> = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' }
const F2: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
}
const F2_SPLIT: Record<string, [string, string]> = Object.fromEntries(Object.entries(F2).map(([k, v]) => [v, [k[0], k[1]]]))
const isVowel = (j: string) => JUNG.includes(j)

/** 두벌식 자모 → 한글 조합 */
const compose = (jamo: string[]) => {
  let out = ''
  let c = '', v = '', f = ''
  const flush = () => {
    if (c && v) out += String.fromCharCode(0xAC00 + (CHO.indexOf(c) * 21 + JUNG.indexOf(v)) * 28 + JONG.indexOf(f))
    else out += c + v + f
    c = v = f = ''
  }
  for (const j of jamo) {
    if (!isVowel(j)) {
      if (c && v && !f && JONG.includes(j)) f = j
      else if (c && v && f && F2[f + j]) f = F2[f + j]
      else {
        flush()
        c = j
      }
    }
    else if (c && !v) v = j
    else if (v && !f && V2[v + j]) v = V2[v + j]
    else if (c && v && f) { // 받침이 다음 글자의 첫소리로
      const [keep, move] = F2_SPLIT[f] || ['', f]
      f = keep
      flush()
      c = move
      v = j
    }
    else {
      flush()
      v = j
    }
  }
  flush()
  return out
}

/** 영문 자판으로 친 한글이면 한글로 바꾼 값, 아니면 null */
export const fixKoreanTypo = (word: string): string | null => {
  if (!/^[a-zA-Z]+$/.test(word)) return null
  if (word.length > 1 && word === word.toUpperCase()) return null // LVT·SPC 같은 대문자 약어는 그대로
  const jamo = [...word].map(ch => KEY[ch] || KEY[ch.toLowerCase()])
  if (jamo.some(j => !j)) return null
  const ko = compose(jamo)
  // 완성된 한글 2글자 이상일 때만(한 글자짜리는 영어 약어와 헷갈려서 제외)
  return /^[가-힣]{2,}$/.test(ko) ? ko : null
}
