# 📘 PWA(Progressive Web App) Step-by-Step Hands-on 강의 가이드

일반 웹사이트를 단계별로 **설치 가능하고(Installable) 오프라인에서도 동작하는(Offline-capable) PWA**로 전환하는 실습 교안입니다.

---

## 🧭 전체 강의 커리큘럼 흐름 (6단계)

| 단계 | 실습 주제 | 핵심 결과물 | 참고 사이트 / 도구 |
|---|---|---|---|
| **Step 1** | 기본 웹앱 준비 및 로컬 서버 실행 | `index.html` | Node.js / Live Server |
| **Step 2** | 앱 메타데이터 및 고유 식별자(`id`) 정의 | `manifest.json` | **[web.dev - Manifest](https://web.dev/articles/add-manifest)** |
| **Step 3** | OS별 잘리지 않는 적응형 아이콘 제작 | `icon-192.png`, `icon-512.png` | **[Maskable.app](https://maskable.app/)** |
| **Step 4** | 오프라인 동작 구현 (수동 SW vs 자동화) | `sw.js`, `workbox-config.js` | **[Google Workbox](https://developer.chrome.com/docs/workbox?hl=ko)** |
| **Step 5** | 브라우저 설치 및 오프라인 테스트 | DevTools 검증 | Chrome / Edge DevTools |
| **Step 6** | 호환성 확인 및 앱스토어 패키징 | 크로스 브라우징 / 스토어 패키지 | **[CanIUse](https://caniuse.com/)**, **[PWA Builder](https://www.pwabuilder.com/)**, **[BrowserStack](https://www.browserstack.com/)** |

---

## Step 1. 기본 웹앱 준비 및 로컬 서버 실행 (`index.html`)

### 핵심 개념
- PWA의 핵심 기술인 **Service Worker**는 보안상 **`HTTPS`** 환경 또는 개발용 **`localhost`(`127.0.0.1`)** 에서만 동작합니다.
- 로컬 파일을 더블클릭(`file://`)하여 열면 Service Worker가 등록되지 않으므로 반드시 로컬 웹 서버를 띄워야 합니다.

### 실습 코드 (`public/pwa-sample/index.html` 핵심 발췌)
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#4f46e5" />
  <title>My First PWA</title>
  <!-- Step 2에서 작성할 Manifest 연결 -->
  <link rel="manifest" href="./manifest.json" />
  <link rel="icon" type="image/png" href="./icon-192.png" />
</head>
<body>
  <h1>🚀 PWA Hands-on 샘플</h1>
  <p id="net-status">현재 상태: 온라인</p>

  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('SW 등록 성공:', reg.scope))
          .catch(err => console.error('SW 등록 실패:', err));
      });
    }
  </script>
</body>
</html>
```

### 로컬 실행
```bash
npm start
# 또는 정적 서버 단독 실행: npx serve public -l 3000
```

---

## Step 2. Web App Manifest 작성 (`manifest.json`)
> 🔗 **공식 참고 문서**: **[web.dev - Web App Manifest 추가하기](https://web.dev/articles/add-manifest)** / **[Manifest `id` 속성 설명](https://web.dev/articles/add-manifest#id)**

### 핵심 개념
`manifest.json`은 브라우저에게 **"이 웹사이트를 기기에 설치할 때 어떤 이름, 아이콘, 화면 모드(`display`), 시작 경로(`start_url`)를 사용할지"** 알려주는 설정 파일입니다.

### 💡 왜 Manifest에 `id` 속성을 추가해야 할까요? (`https://web.dev/articles/add-manifest#id`)
`manifest.json`의 **`id`**는 브라우저가 설치된 PWA를 식별하는 **고유 식별자(App Identity)**입니다.

1. **`start_url`이나 파일 위치가 바뀌어도 같은 앱으로 유지**
   - `id`를 생략하면 브라우저는 `start_url`을 기준으로 앱을 구분합니다.
   - `id`를 명시해 두면 추후 `start_url`을 변경(예: `/index.html` → `/app` 또는 `?utm_source=pwa` 파라미터 수정)하더라도 **별개의 새 앱으로 중복 설치되지 않고 기존 설치된 앱의 업데이트로 정상 인식**됩니다.
2. **동일 도메인 내 여러 PWA 구분**
   - 하나의 도메인에서 여러 하위 웹앱을 운영할 때 각 앱에 고유한 Identity를 부여합니다.
3. **DevTools 확인 팁**
   - Chrome DevTools → **Application > Manifest** 탭의 `App ID` 항목에서 브라우저가 계산한 실제 `id` 값을 바로 확인할 수 있습니다.

### 실습 코드 (`public/pwa-sample/manifest.json`)
```json
{
  "id": "./",
  "name": "나만의 첫 번째 PWA 핸즈온 앱",
  "short_name": "MyPWA",
  "description": "Step-by-Step 핸즈온 실습으로 만드는 오프라인 지원 PWA 샘플",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#4f46e5",
  "icons": [
    {
      "src": "./icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

## Step 3. 적응형 아이콘(Maskable Icon) 제작 및 검증
> 🔗 **참고 도구**: **[Maskable.app](https://maskable.app/)** (`https://maskable.app/editor`)

### 왜 필요한가요?
Android 등 모바일 OS는 홈 화면 아이콘을 제조사 테마에 맞춰 **원형(Circle), 스쿼클(Squircle), 둥근 사각형, 물방울 모양**으로 마스킹합니다. 일반 투명 배경 아이콘을 그대로 쓰면 로고가 잘리거나 하얀 원 안에 작게 축소되어 보입니다.

### 실습 순서
1. **[Maskable.app Editor](https://maskable.app/editor)** 에 접속합니다.
2. 아이콘을 업로드하거나 레이어를 추가합니다.
3. 좌측 **Masks** 옵션을 바꿔가며 핵심 로고가 **중앙 80% 안전 영역(Minimum Safe Area)** 원 안에 들어오는지 확인합니다.
4. **Export**로 `192x192`, `512x512` 이미지를 추출하여 `manifest.json`의 `icons` 배열에 `"purpose": "any"`와 `"purpose": "maskable"`로 각각 등록합니다.
   - *(권장)* `"purpose": "any maskable"`로 합치기보다 `"any"`용과 `"maskable"`용 아이콘 항목을 분리하는 것이 W3C 및 Lighthouse/PWA Builder 권장사항입니다.

---

## Step 4. Service Worker 구현 (직접 작성 vs Workbox 자동화)
> 🔗 **공식 참고 문서**: **[Chrome Developers - Workbox 공식 가이드](https://developer.chrome.com/docs/workbox?hl=ko)**

### 4-A. 기본 원리 실습 (`public/pwa-sample/sw.js` 수동 작성)
Service Worker의 3대 생명주기 이벤트(`install` → `activate` → `fetch`)를 직접 작성하며 오프라인 캐시 원리를 체득합니다.

```javascript
const CACHE_NAME = 'my-pwa-handson-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// 1. 설치(Install): 필수 정적 리소스를 캐시에 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 2. 활성화(Activate): 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 3. 요청 가로채기(Fetch): 네트워크 우선 시도 후 오프라인 시 캐시 반환
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
```

### 4-B. Workbox CLI를 활용한 Service Worker 자동 생성
실제 서비스에서는 수백 개의 빌드 파일과 캐시 만료 전략(`StaleWhileRevalidate`, `CacheFirst`, `NetworkFirst`)을 수동으로 관리하기 어렵습니다. Google의 **Workbox**를 사용하면 설정 파일 하나로 자동 생성할 수 있습니다.

```bash
# 1. 대화형 마법사로 설정 생성
npx workbox-cli wizard

# 2. 설정 파일(workbox-config.js) 기반으로 Service Worker 생성
npx workbox-cli generateSW public/pwa-sample/workbox-config.js
```

---

## Step 5. 브라우저 DevTools로 직접 테스트하기

브라우저에서 앱을 열고 **`F12` (개발자 도구) → `Application` 탭**에서 다음 4가지를 순서대로 확인합니다.

1. **Manifest 탭**
   - `App ID`, `Start URL`, `Theme color`, 아이콘 목록 및 `Show only the minimum safe area for maskable icons` 체크박스로 안전 영역 확인
2. **Service Workers 탭**
   - 현재 등록된 `sw.js`가 `activated and is running` 상태인지 확인
   - 개발 중에는 `Update on reload` 체크박스를 켜두면 수정 사항이 즉시 반영됨
3. **Cache Storage 탭**
   - `my-pwa-handson-v1` (또는 `pco-webapp-v2`) 캐시 내부에 HTML, JSON, 아이콘이 실제로 저장되어 있는지 확인
4. **오프라인(Offline) 시뮬레이션 및 앱 설치**
   - `Service Workers` 탭 상단의 **`Offline` 체크박스** 체크 → `F5` 새로고침 → 인터넷 없이도 앱이 열리는지 확인
   - 주소창 우측 **앱 설치(Install)** 아이콘 클릭 → 독립된 데스크톱/모바일 창 실행 확인

---

## Step 6. 크로스 브라우징 확인 및 스토어 배포

### 1. [CanIUse](https://caniuse.com/) — 브라우저별 지원 범위 확인
- 검색 키워드: `Service Workers`, `Web App Manifest`, `Web Push`, `Badging API`
- **강의 포인트**:
  - 기본 오프라인 캐싱과 홈 화면 설치는 Chrome, Edge, Safari, Firefox 등 대부분의 모던 브라우저에서 지원됩니다.
  - 단, iOS/iPadOS Safari의 경우 **홈 화면에 추가된 웹앱(Standalone)** 상태에서만 Web Push(iOS 16.4+)가 동작하거나, `beforeinstallprompt` 자동 배너 대신 Safari 공유 메뉴의 **'홈 화면에 추가'**를 안내해야 하는 차이를 짚어줍니다.

### 2. [PWA Builder](https://www.pwabuilder.com/) — PWA 품질 진단 및 스토어 패키징
- 배포된 HTTPS URL(예: 본 저장소의 GitHub Pages 주소)을 입력합니다.
- **Report Card**에서 Manifest, Service Worker, Security 점수와 개선 항목을 진단받습니다.
- **Package For Stores** 기능으로 **Windows (Microsoft Store `.msix`), Android (Google Play TWA), iOS** 스토어 업로드용 패키지를 즉시 생성할 수 있습니다.

### 3. [BrowserStack](https://www.browserstack.com/) — 실기기 클라우드 테스트
- PC 브라우저 에뮬레이터만으로는 재현하기 어려운 실제 iPhone(Safari), Galaxy(Samsung Internet / Chrome) 단말에서의 설치 UX, 스플래시 스크린, 아이콘 마스킹, 오프라인 전환을 검증할 때 활용합니다.
