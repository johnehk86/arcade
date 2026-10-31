#!/bin/sh
# 정적 호스팅용 빌드: arcade/index.html은 Claude 아티팩트용이라 <!doctype>, charset, viewport가 없다.
# 그 문서 틀과 설치형 앱(PWA) 태그를 앞에 붙여 dist/에 내보낸다. (Cloudflare Pages: 빌드 명령 `sh build.sh`, 출력 디렉터리 `dist`)
set -e
rm -rf dist
mkdir -p dist
cp -R arcade/. dist/

VERSION="${CF_PAGES_COMMIT_SHA:-$(date +%s)}"
sed "s/__VERSION__/$VERSION/" arcade/sw.js > dist/sw.js

{
  printf '%s\n' '<!doctype html>'
  printf '%s\n' '<html lang="ko">'
  printf '%s\n' '<head>'
  printf '%s\n' '<meta charset="utf-8">'
  printf '%s\n' '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '%s\n' '<meta name="theme-color" content="#fff6fb">'
  printf '%s\n' '<meta name="description" content="손가락 하나로 즐기는 귀여운 원터치 게임 12종. 매일 바뀌는 오늘의 도전과 미션이 있어요.">'
  printf '%s\n' '<link rel="manifest" href="manifest.webmanifest">'
  printf '%s\n' '<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">'
  printf '%s\n' '<link rel="apple-touch-icon" href="icons/icon-180.png">'
  printf '%s\n' '<script src="pwa.js" defer></script>'
  printf '%s\n' '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>'
  printf '%s\n' '</head>'
  printf '%s\n' '<body>'
  cat arcade/index.html
  printf '%s\n' '</body>'
  printf '%s\n' '</html>'
} > dist/index.html

# 서비스 워커와 앱 설정 파일은 항상 새로 받게 한다
cat > dist/_headers <<'EOF'
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
  Content-Type: application/manifest+json
/*.js
  Content-Type: application/javascript; charset=utf-8
/.well-known/assetlinks.json
  Content-Type: application/json
  Access-Control-Allow-Origin: *
EOF

echo "built dist/ ($VERSION)"
