/* 사이트 조립 — npm run build 끝에 자동 실행(postbuild)
 *
 *  deck.macodi.co.kr/         = 랜딩(landing/ 폴더 그대로)
 *  deck.macodi.co.kr/editor   = 웹 PPT 편집기(vite 빌드 결과, 파일은 editor/assets/)
 *
 *  1) vite 가 만든 dist/index.html(편집기) → dist/editor/index.html 로 옮김
 *  2) landing/ 의 파일을 dist/ 맨 위로 복사(랜딩의 index.html·assets/)
 *  3) 랜딩 index.html 에 '예전 주소 넘겨주기'를 넣음 — 이미 보낸 공유 링크(/?v=…)·시연 주소(/?first)는 편집기로
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const LANDING = path.join(ROOT, 'landing')

const editorHtml = path.join(DIST, 'index.html')
if (!fs.existsSync(editorHtml)) {
  console.log('dist/index.html 이 없습니다(빌드 실패?).')
  process.exit(1)
}

// 1) 편집기 → /editor/
fs.mkdirSync(path.join(DIST, 'editor'), { recursive: true })
fs.renameSync(editorHtml, path.join(DIST, 'editor', 'index.html'))

// 2) 랜딩 → /
const copyDir = (from, to) => {
  for (const name of fs.readdirSync(from)) {
    if (name === 'README.md') continue
    const src = path.join(from, name)
    const dst = path.join(to, name)
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dst, { recursive: true })
      copyDir(src, dst)
    }
    else fs.copyFileSync(src, dst)
  }
}
copyDir(LANDING, DIST)

// 3) 예전 주소 넘겨주기(공유 링크 ?v=, 시연 ?first, 청중 보기 ?mode=)
const REDIRECT = `<script>(function(){var q=new URLSearchParams(location.search);if(q.has('v')||q.has('first')||q.has('mode'))location.replace('/editor'+location.search+location.hash)})()</script>`
const landingHtml = path.join(DIST, 'index.html')
let html = fs.readFileSync(landingHtml, 'utf8')
html = html.replace(/<head>/i, `<head>\n  ${REDIRECT}`)
fs.writeFileSync(landingHtml, html)

console.log('사이트 조립 완료: / = 랜딩, /editor = 편집기')
