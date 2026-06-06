#!/bin/bash
# BlackThunderBattery.app をビルドする
set -e
cd "$(dirname "$0")"

APP_NAME="BlackThunderBattery"
BUILD_DIR="build"
APP="$BUILD_DIR/$APP_NAME.app"
CONTENTS="$APP/Contents"

rm -rf "$BUILD_DIR"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"

echo "▸ コンパイル中…"
swiftc -O Sources/main.swift -o "$CONTENTS/MacOS/$APP_NAME" \
    -framework Cocoa -framework IOKit

echo "▸ リソース配置…"
cp ../chocolate.png "$CONTENTS/Resources/chocolate.png"

echo "▸ Info.plist 作成…"
cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>$APP_NAME</string>
    <key>CFBundleDisplayName</key><string>ブラックサンダー バッテリー</string>
    <key>CFBundleIdentifier</key><string>com.yamadahayato.blackthunderbattery</string>
    <key>CFBundleVersion</key><string>1.0</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleExecutable</key><string>$APP_NAME</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>LSUIElement</key><true/>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

echo "▸ 署名（ad-hoc）…"
codesign --force --deep --sign - "$APP" 2>/dev/null || echo "  (署名スキップ)"

echo "✅ 完成: $APP"
