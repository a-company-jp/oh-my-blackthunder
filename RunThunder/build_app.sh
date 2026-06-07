#!/bin/bash
# RunThunder を .app バンドルとしてビルドする。
#
# 使い方:
#   ./build_app.sh                                            # ネイティブ arch
#   VERSION=1.2.3 ./build_app.sh                              # バージョン指定
#   SWIFT_BUILD_FLAGS="--arch arm64 --arch x86_64" ./build_app.sh   # ユニバーサル
#
#   →  ./RunThunder.app が生成される（アドホック署名済み）
#
# メニューバー GUI アプリなので「素のバイナリ」ではなく必ず .app バンドルとして
# 配布する（Resources/Frames や Info.plist / LSUIElement / バンドルID が要る）。
# Apple Silicon では未署名バイナリは起動できないため、最後にアドホック署名する。
set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="RunThunder"
BUILD_CONFIG="release"
BUNDLE_ID="io.local.runthunder"
VERSION="${VERSION:-0.0.0-dev}"
SWIFT_BUILD_FLAGS="${SWIFT_BUILD_FLAGS:-}"

echo "==> swift build ($BUILD_CONFIG) ${SWIFT_BUILD_FLAGS}"
# shellcheck disable=SC2086 # intentional word-splitting for the build flags
swift build -c "$BUILD_CONFIG" ${SWIFT_BUILD_FLAGS}

# shellcheck disable=SC2086
BIN_PATH="$(swift build -c "$BUILD_CONFIG" ${SWIFT_BUILD_FLAGS} --show-bin-path)/$APP_NAME"

APP_DIR="./$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RES_DIR="$CONTENTS/Resources"

echo "==> assembling $APP_DIR (version $VERSION)"
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
    <string>$BUNDLE_ID</string>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# Apple Silicon で起動できるよう（かつ配布物として整合させるため）アドホック署名する。
# 署名証明書 "-" はアドホック署名を意味する（Developer ID / notarization ではない）。
echo "==> ad-hoc codesign"
codesign --force --deep --sign - "$APP_DIR"
codesign --verify --verbose=2 "$APP_DIR" || true

echo "==> done: $APP_DIR"
echo "    起動: open $APP_DIR"
