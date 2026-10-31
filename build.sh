#!/bin/sh
# 정적 호스팅용 빌드: arcade/index.html은 Claude 아티팩트용이라 <!doctype>, charset, viewport가 없다.
# 그 문서 틀과 설치형 앱(PWA) 태그를 앞에 붙여 dist/에 내보낸다. (Cloudflare Pages: 빌드 명령 `sh build.sh`, 출력 디렉터리 `dist`)
set -e
# 사용법: sh build.sh          웹사이트(Cloudflare Pages)
#         sh build.sh app      안드로이드 앱, 구글 테스트 광고
#         sh build.sh release  안드로이드 앱, 실제 광고 (출시용)
case "$1" in
  app) APP=1 ;;
  release) APP=1; RELEASE=1 ;;
esac
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
  if [ -n "$APP" ]; then
    printf '%s\n' '<script src="capacitor.js"></script>'
    printf '%s\n' '<script src="ads-config.js"></script>'
  else
    printf '%s\n' '<script src="pwa.js" defer></script>'
  fi
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

# 안드로이드 앱 빌드(APP=1): 광고 설정을 넣고 웹 전용 파일(서비스 워커, 설치 배너, 도메인 인증)은 뺀다
if [ -n "$APP" ]; then
  # RELEASE=1 이면 실제 광고, 아니면 구글 테스트 광고
  if [ -n "$RELEASE" ]; then
    sed 's/testing: true/testing: false/' app/ads-config.js > dist/ads-config.js
  else
    cp app/ads-config.js dist/ads-config.js
  fi
  cp node_modules/@capacitor/core/dist/capacitor.js dist/capacitor.js
  rm -f dist/sw.js dist/pwa.js dist/_headers dist/manifest.webmanifest
  rm -rf dist/.well-known
fi

echo "built dist/ ($VERSION${APP:+, app})"
