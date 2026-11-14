#!/bin/sh
# design/*.html을 public/ PNG로 찍는다(headless Chrome). 썸네일 1024², 프로덕트 2400×1260, og 1200×630
set -e
cd "$(dirname "$0")/.."
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# 평소 쓰는 Chrome이 켜져 있으면 같은 프로필로는 안 찍힌다. 임시 프로필을 쓰고, 끝날 때 나는 종료 코드는 무시한다(파일이 생겼는지로 본다)
P="$(mktemp -d)"; trap 'rm -rf "$P"' EXIT
shot() { rm -f "$3"; "$C" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$P" --force-device-scale-factor="$4" --window-size="$2" --screenshot="$3" "file://$PWD/design/$1" >/dev/null 2>&1 || true; [ -s "$3" ] || { echo "failed: $3" >&2; exit 1; }; }
shot thumb.html 1024,1024 public/thumb.png 1
shot product.html 1200,630 public/product.png 2
shot product.html 1200,630 public/og.png 1
sips -Z 180 public/thumb.png --out public/apple-touch-icon.png >/dev/null
