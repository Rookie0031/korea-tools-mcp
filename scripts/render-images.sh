#!/bin/sh
# design/*.html을 public/ PNG로 찍는다(headless Chrome). 썸네일 1024², 프로덕트 2400×1260, og 1200×630
set -e
cd "$(dirname "$0")/.."
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
shot() { "$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor="$4" --window-size="$2" --screenshot="$3" "file://$PWD/design/$1" >/dev/null 2>&1; }
shot thumb.html 1024,1024 public/thumb.png 1
shot product.html 1200,630 public/product.png 2
shot product.html 1200,630 public/og.png 1
sips -Z 180 public/thumb.png --out public/apple-touch-icon.png >/dev/null
