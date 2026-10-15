// Workbox CLI 자동 생성 설정 예시
// 실행 명령어: npx workbox-cli generateSW workbox-config.js
module.exports = {
  globDirectory: './',
  globPatterns: [
    '**/*.{html,json,js,css,png,svg}'
  ],
  swDest: './sw-workbox.js',
  ignoreURLParametersMatching: [
    /^utm_/,
    /^fbclid$/
  ],
  skipWaiting: true,
  clientsClaim: true
};
