# Macodi Deck 랜딩페이지

> **이 폴더(`landing/`)는 Deck 앱과 분리되어 있습니다.**
> - Deck 빌드(`vite build`)는 루트 `index.html`·`src/`·`public/`만 사용하고, 타입 검사는 `src/`만 합니다. 그래서 이 폴더는 **Deck 빌드·배포 결과물에 포함되지 않습니다.**
> - `landing/.eslintrc.cjs`가 이 폴더를 루트 `npm run lint` 대상에서 제외합니다.
> - Deck 쪽 파일은 하나도 수정하지 않았습니다. 필요 없어지면 이 폴더만 지우면 됩니다.

Macodi Deck(https://deck.macodi.co.kr/) 홍보용 랜딩페이지입니다. 서비스 주소 뒤의 `/home/`에서 열리도록 만들었습니다.

- 빌드 과정 없는 정적 사이트입니다(HTML · CSS · JS).
- Deck 프로그램(`macodi_deck`)과는 완전히 분리되어 있습니다. **Deck 코드는 수정하지 않습니다.**

## 구조

```
index.html            페이지 본문
assets/css/style.css  디자인
assets/js/main.js     주소 설정(CONFIG) + 화면 동작
assets/img/           로고, Deck 화면 캡처, 마감재 썸네일
```

## 주소 바꾸기

버튼이 연결되는 주소는 `assets/js/main.js` 맨 위 `CONFIG`에서 바꿉니다.

| 항목 | 용도 |
|---|---|
| `appUrl` | '무료로 시작하기' 등 Deck으로 가는 버튼 |
| `macodiUrl` | 마코디 홈페이지, 이용약관, 개인정보처리방침 |

공유 미리보기 주소(`og:url`, `og:image`, `canonical`)는 `index.html`의 `<head>`에 직접 적혀 있으므로 함께 바꿉니다.

이미지와 CSS는 모두 상대경로라서, 어느 경로에 올려도 그대로 동작합니다.

## 로컬에서 보기

```powershell
npx serve .        # 또는 index.html 을 브라우저로 직접 열기
```

## 배포: deck.macodi.co.kr/home/

Deck은 S3 버킷 `deck.macodi.co.kr`과 CloudFront로 서비스되고 있습니다.

> ⚠️ **같은 버킷에 올리면 안 됩니다.** Deck 배포 스크립트(`macodi_deck/scripts/deploy-s3.cjs`)가 `s3 sync --delete`를 실행하므로, Deck을 배포할 때마다 `/home/` 파일이 지워집니다.

Deck 코드를 건드리지 않는 방법은 아래와 같습니다. 모두 AWS 콘솔 작업이므로 Deck 담당자, AWS 권한자와 먼저 협의해야 합니다.

1. **랜딩 전용 S3 버킷을 만듭니다.** 예: `deck-home.macodi.co.kr`
   - 파일은 버킷의 `home/` 폴더 아래에 올립니다(예: `home/index.html`, `home/assets/...`). CloudFront가 경로를 그대로 넘기기 때문입니다.
2. **Deck CloudFront 배포에 Origin을 추가합니다.** 위 버킷을 Origin으로 추가하고, 비공개 버킷이라면 OAC를 설정합니다.
3. **Behavior를 추가합니다.** 경로 패턴 `/home*`를 새 Origin으로 연결하고, 기존 기본 Behavior(`*`)보다 우선순위를 높게 둡니다.
4. **CloudFront Function(viewer request)을 붙입니다.** `/home*` Behavior에 연결하며, 다음 두 가지를 처리합니다.
   - `/home` → `/home/` 301 리다이렉트. 슬래시가 없으면 상대경로가 깨집니다.
   - `/home/` → `/home/index.html`

   ```js
   function handler(event) {
     var r = event.request;
     if (r.uri === '/home') {
       return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: '/home/' } } };
     }
     if (r.uri.endsWith('/')) r.uri += 'index.html';
     return r;
   }
   ```

5. **업로드합니다.**

   ```powershell
   aws s3 sync . s3://<랜딩버킷>/home/ --exclude ".git/*" --exclude "README.md" --delete
   aws cloudfront create-invalidation --distribution-id <배포ID> --paths "/home*"
   ```

`index.html`에도 `/home` → `/home/` 보정 스크립트가 들어 있지만, 이는 보조 수단입니다. 기본 처리는 CloudFront에서 합니다.

## 시안 상태

- 화면 이미지: `deck.macodi.co.kr`을 2026-10-23에 직접 캡처한 이미지입니다. 정식 자료를 받으면 교체합니다.
- 히어로 2번째 장면의 공간 사진 `space-lounge.jpg`는 스페이스시프트 레이카운티 프로젝트 이미지입니다(출처: `macodi_next_front/public/images/portfolio/raycounty.jpg`). 공간 장면의 자재 4종은 `main.js`의 `SPACE_MATS`에 있습니다.
- 예시 자재 6종은 실제 마코디 등록 제품입니다(2026-10-23 검색 API 조회 기준). 브랜드·제품명·종류·사이즈는 `assets/js/main.js`의 `MATS`와 `index.html` 편집 카드에 있습니다.
- 요금: 마감재 검색의 무료 범위와 구독 범위, 가격이 확정되지 않아 '요금 안내 예정'으로 두었습니다.
- AI 영역 검색 그림은 마감재 이미지로 구성한 예시 공간입니다.
