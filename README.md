# 🚀 파코(파이썬 코치) PWA WebApp & PWA Step-by-Step Hands-on 가이드

본 저장소는 두 가지 실습 및 프로젝트를 함께 제공합니다:

1. **📘 [PWA Step-by-Step Hands-on 강의 가이드 (`PWA-HANDSON-GUIDE.md`)](./PWA-HANDSON-GUIDE.md)** 및 **독립 실습 샘플 (`public/pwa-sample/`)**
2. **🐍 파코(파이썬 코치) PWA WebApp (`public/`)** — Google Sites(`https://sites.google.com/dge.go.kr/pco`)의 모든 하위 페이지에서 맞춤 삽입 원본 HTML(`data-code`)을 추출하여 독립 실행 가능한 PWA 웹앱으로 복원한 프로젝트

---

## 🌐 배포 및 실행 방법

### 1. 온라인 배포 주소 (GitHub Pages)
- **파코(파이썬 코치) 메인 PWA**: [https://marklim91.github.io/pwa-handson-guide/](https://marklim91.github.io/pwa-handson-guide/)
- **PWA Step-by-Step 핸즈온 실습 샘플**: [https://marklim91.github.io/pwa-handson-guide/pwa-sample/](https://marklim91.github.io/pwa-handson-guide/pwa-sample/)

### 2. 로컬에서 실행하기

```bash
npm start
```

브라우저에서 아래 주소로 접속합니다:
- **파코(파이썬 코치) 메인 PWA**: `http://localhost:3000`
- **PWA Step-by-Step 핸즈온 실습 샘플**: `http://localhost:3000/pwa-sample/`

---

## 📂 디렉터리 및 페이지 구조

- **[`PWA-HANDSON-GUIDE.md`](./PWA-HANDSON-GUIDE.md)** — **PWA 강의용 6단계 Step-by-Step Hands-on 가이드**
  - Step 1: 기본 웹앱 및 HTTPS/`localhost` 환경 구성
  - Step 2: `manifest.json` 작성 및 고유 식별자(`id`) 속성 활용 ([web.dev Manifest](https://web.dev/articles/add-manifest#id))
  - Step 3: 적응형 아이콘 안전 영역 검증 ([Maskable.app](https://maskable.app/))
  - Step 4: Service Worker 수동 구현 vs 자동 생성 ([Google Workbox](https://developer.chrome.com/docs/workbox?hl=ko))
  - Step 5: Chrome/Edge DevTools(`Application` 탭) 설치 및 오프라인 디버깅
  - Step 6: 크로스 브라우징([CanIUse](https://caniuse.com/), [BrowserStack](https://www.browserstack.com/)) 및 스토어 패키징([PWA Builder](https://www.pwabuilder.com/))
- `public/` — 정적 배포(GitHub Pages) 및 로컬 실행 가능한 PWA 리소스
  - `/index.html` (`/파코v3`): 파코 v3 통합 메인 페이지 (홈 + AI 코치 + 레벨 로드맵)
  - `/dashboard.html` (`/대시보드`): 파이썬 학습 코치 검토 대시보드 (10회차 학생 코드 분석 및 Chart.js 시각화)
  - `/v3_4/index.html` (`/파코v3_4`): 파코 v3.4 분리형 홈
  - `/v3_4/coach.html` (`/파코v3_4/ai코치`): 파코 v3.4 AI 코치 전용 채팅 페이지
  - `/v3_4/roadmap.html` (`/파코v3_4/레벨-로드맵`): 파코 v3.4 레벨 로드맵 페이지
  - `/v2.html` (`/파코v2`): 파코 v2 구버전 페이지
  - `/pwa-sample/` — **강의 실습용 최소 기능 PWA 샘플** (`index.html`, `manifest.json`, `sw.js`, `workbox-config.js`, Maskable 아이콘)
- `original/` — Google Sites에서 추출한 무수정 원본 HTML 6종 보관

---

## 🤖 AI 에이전트 연동 구조 (파코 WebApp)

```text
웹앱 내 AI 코치 페이지
  → Copilot Studio WebChat iframe 삽입
  → Power Platform Direct Line 토큰 발급
  → Direct Line 대화 생성 및 activities 교환
  → 봇 응답을 실시간 채팅 화면에 표시
```

- **v3 / v3.4 에이전트**: `https://copilotstudio.microsoft.com/environments/9324e73a-cd4e-e049-b7ba-177af6165e9c/bots/crbf2_newcoachv3_YEkNfz/webchat?__version__=2&enableFileAttachment=false&cliAgent=true`
- **v2 에이전트**: `https://copilotstudio.microsoft.com/environments/9324e73a-cd4e-e049-b7ba-177af6165e9c/bots/crbf2_newcoach_s_FJsw/webchat?__version__=2&enableFileAttachment=false&cliAgent=true`

