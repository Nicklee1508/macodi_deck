/* 마코디 웹 PPT 배포 — dist/ → S3(deck.macodi.co.kr) + CloudFront 무효화
 *
 * 사용: npm run build  →  npm run deploy:check (미리보기)  →  npm run deploy (실행)
 * 환경변수: DECK_CF_DISTRIBUTION = CloudFront 배포 ID (없으면 무효화 생략)
 *
 * 마코디 프론트 배포(deploy-s3.cjs)에서 겪은 문제를 미리 막는다.
 *  - Windows 의 aws s3 sync 가 .js 를 text/plain 으로 올림 → 확장자별 content-type 지정
 *  - 캐시: editor/assets/ 는 파일명에 해시가 있어 영구 캐시, html·mocks·랜딩은 매번 새로
 *  - 빌드에서 사라진 파일은 --delete 로 정리
 *
 * 주소: / = 랜딩(dist/index.html), /editor = 편집기(dist/editor/index.html)
 *  CloudFront 는 / 에만 index.html 을 붙여 주므로 편집기 html 을 'editor'·'editor/' 키에도 올림
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DRY = process.argv.includes('--dry')
const BUCKET = process.env.DECK_BUCKET || 'deck.macodi.co.kr'
const DIST = path.join(__dirname, '..', 'dist')
const CF = process.env.DECK_CF_DISTRIBUTION || ''
const IMMUTABLE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'

function aws(args) {
  const full = DRY && args[0] === 's3' ? [...args, '--dryrun'] : args
  console.log('> aws ' + full.join(' '))
  const r = spawnSync('aws', full, { encoding: 'utf8', stdio: 'inherit' })
  if (r.error) throw new Error(`aws 실행 실패: ${r.error.message} (AWS CLI 설치·로그인 확인)`)
  if (r.status !== 0) process.exit(r.status || 1)
}

if (!fs.existsSync(path.join(DIST, 'index.html')) || !fs.existsSync(path.join(DIST, 'editor', 'index.html'))) {
  console.log('dist/ 빌드 결과가 없습니다. 먼저 npm run build 를 실행하세요.')
  process.exit(1)
}

const dest = `s3://${BUCKET}`
const sync = (extra) => aws(['s3', 'sync', DIST, dest, '--no-progress', ...extra])

// 1) 해시 파일(assets/) — 확장자별 타입 + 영구 캐시
const TYPES = [
  ['*.js', 'application/javascript; charset=utf-8'],
  ['*.css', 'text/css; charset=utf-8'],
  ['*.svg', 'image/svg+xml'],
  ['*.woff2', 'font/woff2'],
  ['*.woff', 'font/woff'],
  ['*.png', 'image/png'],
  ['*.jpg', 'image/jpeg'],
  ['*.webp', 'image/webp'],
]
for (const [glob, type] of TYPES) {
  sync(['--exclude', '*', '--include', `editor/assets/${glob}`, '--content-type', type, '--cache-control', IMMUTABLE])
}
// 2) 템플릿·예시 데이터, 그 밖의 정적 파일 — 매번 새로(내용이 바뀌어도 이름이 같음)
sync(['--exclude', '*', '--include', 'mocks/*.json', '--content-type', 'application/json; charset=utf-8', '--cache-control', NO_CACHE])
sync(['--exclude', 'editor/assets/*', '--exclude', 'mocks/*', '--exclude', 'index.html', '--exclude', 'editor/index.html', '--cache-control', NO_CACHE])
// 3) html 은 마지막에(새 파일이 다 올라간 뒤 바꿔야 빈 화면이 안 생김)
const HTML = ['--content-type', 'text/html; charset=utf-8', '--cache-control', NO_CACHE]
const editorHtml = path.join(DIST, 'editor', 'index.html')
aws(['s3', 'cp', editorHtml, `${dest}/editor/index.html`, ...HTML, ...(DRY ? ['--dryrun'] : [])])
aws(['s3', 'cp', editorHtml, `${dest}/editor`, ...HTML, ...(DRY ? ['--dryrun'] : [])]) // 주소 /editor
if (!DRY) aws(['s3api', 'put-object', '--bucket', BUCKET, '--key', 'editor/', '--body', editorHtml, '--content-type', 'text/html; charset=utf-8', '--cache-control', NO_CACHE]) // 주소 /editor/
aws(['s3', 'cp', path.join(DIST, 'index.html'), `${dest}/index.html`, ...HTML, ...(DRY ? ['--dryrun'] : [])]) // 랜딩
// 4) 빌드에서 사라진 파일 정리(위에서 따로 올린 html 키는 남김)
sync(['--delete', '--exclude', 'index.html', '--exclude', 'editor/index.html', '--exclude', 'editor', '--exclude', 'editor/'])

if (CF && !DRY) aws(['cloudfront', 'create-invalidation', '--distribution-id', CF, '--paths', '/*'])
else if (!CF) console.log('※ DECK_CF_DISTRIBUTION 이 없어 CloudFront 무효화는 건너뜀')
console.log(DRY ? '미리보기 끝(아무것도 바뀌지 않음)' : '배포 완료')
