import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'

// 로컬(npm run dev · npm run preview)도 운영과 같은 주소로: / = 랜딩(landing/), /editor = 편집기
//  - 예전 공유 링크(/?v=…)·시연(/?first)은 편집기로 넘김(운영은 scripts/build-site.cjs 가 같은 일을 함)
const LANDING_REDIRECT = `<script>(function(){var q=new URLSearchParams(location.search);if(q.has('v')||q.has('first')||q.has('mode'))location.replace('/editor'+location.search+location.hash)})()</script>`
const MIME: Record<string, string> = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
type Req = { url?: string }
type Res = { setHeader: (k: string, v: string) => void, end: (b: string | Buffer) => void }
const siteRoutes = {
  name: 'macodi-site-routes',
  // npm run dev
  configureServer(server: { middlewares: { use: (fn: (req: Req, res: Res, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const [pathname, query = ''] = (req.url || '/').split('?')
      const qs = query ? '?' + query : ''
      if (pathname === '/' || pathname === '/index.html') { // 랜딩
        const html = readFileSync('landing/index.html', 'utf8').replace(/<head>/i, `<head>
  ${LANDING_REDIRECT}`)
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.end(html)
      }
      if (pathname.startsWith('/assets/')) { // 랜딩 그림·스크립트
        const file = join('landing', decodeURIComponent(pathname))
        if (existsSync(file) && statSync(file).isFile()) {
          res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream')
          return res.end(readFileSync(file))
        }
      }
      // 편집기 — 첫 번째 미들웨어(여기)는 지나갔으니 vite 가 원래 index.html(편집기)을 처리
      if (pathname === '/editor' || pathname === '/editor/') req.url = '/index.html' + qs
      next()
    })
  },
  // npm run preview — /editor(끝 / 없이)도 편집기로
  configurePreviewServer(server: { middlewares: { use: (fn: (req: Req, res: Res, next: () => void) => void) => void } }) {
    server.middlewares.use((req, _res, next) => {
      const [pathname, query] = (req.url || '/').split('?')
      if (pathname === '/editor') req.url = '/editor/index.html' + (query ? '?' + query : '')
      next()
    })
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  // 사이트 = / 랜딩 + /editor 편집기 → 편집기 파일은 editor/assets/ 에, 주소는 사이트 맨 위 기준
  //  (조립은 scripts/build-site.cjs — npm run build 끝에 자동)
  base: '/',
  build: {
    assetsDir: 'editor/assets',
  },
  plugins: [
    vue(),
    siteRoutes,
    Components({
      dirs: [],
      resolvers: [
        IconsResolver({
          prefix: 'i',
          customCollections: ['custom'],
        }),
      ],
    }),
    Icons({
      compiler: 'vue3',
      autoInstall: false, 
      customCollections: {
        custom: FileSystemIconLoader('src/assets/icons'),
      },
      scale: 1,
      defaultClass: 'i-icon',
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // 마코디 백엔드(로컬 dev). 운영 빌드는 api2.macodi.co.kr 직접 호출(src/macodi/api.ts).
      '/macodi-api': {
        target: process.env.MACODI_API_TARGET || 'http://localhost:8008',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/macodi-api/, ''),
        // 백엔드 CORS 허용목록에 dev 주소가 없어 Origin 을 보내면 400 → 같은 출처 호출로 보이게 제거(dev 전용)
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import '@/assets/styles/variable.scss';
          @import '@/assets/styles/mixin.scss';
        `
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
