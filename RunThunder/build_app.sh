#!/bin/bash
# RunThunder を .app バンドルとしてビルドする。
# 使い方: ./build_app.sh   →  ./RunThunder.app が生成される
set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="RunThunder"
BUILD_CONFIG="release"

echo "==> swift build ($BUILD_CONFIG)"
swift build -c "$BUILD_CONFIG"

BIN_PATH="$(swift build -c "$BUILD_CONFIG" --show-bin-path)/$APP_NAME"

APP_DIR="./$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RES_DIR="$CONTENTS/Resources"

echo "==> assembling $APP_DIR"
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RES_DIR/Frames"

cp "$BIN_PATH" "$MACOS_DIR/$APP_NAME"

# 本番のコマ画像があればバンドルへコピー（Resources/Frames/*.png）。
if compgen -G "./Resources/Frames/*.png" > /dev/null; then
  cp ./Resources/Frames/*.png "$RES_DIR/Frames/"
  echo "    copied frame images"
else
  echo "    no frame images found — placeholder frames will be used at runtime"
fi

cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>RunThunder</string>
    <key>CFBundleIdentifier</key>
    <string>io.local.runthunder</string>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

echo "==> done: $APP_DIR"
echo "    起動: open $APP_DIR"
