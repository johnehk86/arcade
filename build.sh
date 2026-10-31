#!/bin/sh
# 정적 호스팅용 빌드: arcade/index.html은 Claude 아티팩트용이라 <!doctype>, charset, viewport가 없다.
# 그 문서 틀을 앞에 붙여 dist/에 내보낸다. (Cloudflare Pages: 빌드 명령 `sh build.sh`, 출력 디렉터리 `dist`)
set -e
rm -rf dist
mkdir -p dist
cp arcade/*.js dist/
{
  printf '%s\n' '<!doctype html>'
  printf '%s\n' '<html lang="ko">'
  printf '%s\n' '<head>'
  printf '%s\n' '<meta charset="utf-8">'
  printf '%s\n' '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '%s\n' '<meta name="theme-color" content="#130f1b">'
  printf '%s\n' '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>'
  printf '%s\n' '</head>'
  printf '%s\n' '<body>'
  cat arcade/index.html
  printf '%s\n' '</body>'
  printf '%s\n' '</html>'
} > dist/index.html
echo "built dist/"
