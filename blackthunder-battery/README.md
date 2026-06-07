# Black Thunder Battery ⚡🍫🔋

メニューバーに**ブラックサンダーの板チョコ**でバッテリー残量を表示する macOS 用の
おまけガジェットです。残量が減るとチョコが右から食べられていき、充電中は ⚡ が点きます。

> ※ 非公式のファン作品です。「ブラックサンダー」は有楽製菓株式会社の商品・商標です。
> 本プロジェクトは同社とは関係ありません。

## 概要

- **板チョコ＝バッテリー**: 残量ぶんだけ左にチョコが残り、消費したぶん（右側）は
  食べられて薄くなります。残量はチョコの「かじり具合」で一目でわかります。
- **充電表示**: 電源に挿している間は残量の横に ⚡ を表示します。
- **2 つの動かし方**: 単体で動く **ネイティブ Swift アプリ**（メニューバー常駐）と、
  [SwiftBar](https://github.com/swiftbar/SwiftBar) / [xbar](https://github.com/matryer/xbar)
  用の **プラグイン**（Python で画像生成）の両方を同梱しています。お好みの方を使えます。

## 使い方

### A. ネイティブ Swift アプリ（おすすめ）

ビルドして起動するだけ。メニューバーに常駐し、Dock アイコンは出ません（`LSUIElement`）。

```bash
cd BlackThunderBattery
./build.sh            # build/BlackThunderBattery.app を生成（ad-hoc 署名）
open build/BlackThunderBattery.app
```

- メニューバーのチョコがバッテリー残量に追従します（自動更新）。
- 終了はメニューバーのアイコンから行います。

> 未署名（ad-hoc）のため、Gatekeeper が初回起動をブロックする場合があります。
> Finder で `BlackThunderBattery.app` を右クリック →「開く」を選ぶか、
> `xattr -dr com.apple.quarantine build/BlackThunderBattery.app` を実行してください。

### B. SwiftBar / xbar プラグイン

メニューバーアプリの [SwiftBar](https://github.com/swiftbar/SwiftBar) か
[xbar](https://github.com/matryer/xbar) を使う場合は、Python で板チョコ画像を生成する
プラグインを利用できます。チョコ画像の描画ロジックは [`render.py`](./render.py) にあります。

## インストール方法

### ネイティブ Swift アプリ

ビルドには **Xcode Command Line Tools**（`swiftc`）が必要です。未導入なら:

```bash
xcode-select --install
```

あとは上記「使い方 A」の `./build.sh` を実行するだけです。生成された
`build/BlackThunderBattery.app` は `/Applications` に移動して常用できます。

### SwiftBar / xbar プラグイン

1. **SwiftBar**（または xbar）をインストールします。

   ```bash
   brew install --cask swiftbar
   ```

2. Python と画像ライブラリ **Pillow** を用意します（仮想環境推奨）。

   ```bash
   python3 -m venv venv
   ./venv/bin/pip install Pillow
   ```

3. [`plugins/blackthunder-battery.1m.sh`](./plugins/blackthunder-battery.1m.sh) を
   SwiftBar / xbar のプラグインフォルダにコピー（またはシンボリックリンク）します。
   ファイル名の `.1m` が更新間隔（1 分）です。

   ```bash
   ln -s "$PWD/plugins/blackthunder-battery.1m.sh" \
     "$HOME/Library/Application Support/SwiftBar/blackthunder-battery.1m.sh"
   ```

4. プラグイン冒頭の `ASSETS`（このディレクトリの絶対パス）と `PY`（venv の Python パス）を
   自分の環境に合わせて書き換え、実行権限を付けて SwiftBar を再読み込みします。

   ```bash
   chmod +x plugins/blackthunder-battery.1m.sh
   ```

## ライセンス

リポジトリルートの [LICENSE.txt](../LICENSE.txt) を参照してください。
