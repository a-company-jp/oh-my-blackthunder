# Black Thunder Battery ⚡🍫🔋

メニューバーに**ブラックサンダーの板チョコ**でバッテリー残量を表示する macOS 用の
おまけガジェットです。残量が減るとチョコが右から食べられていき、充電中は ⚡ が点きます。

> ※ 非公式のファン作品です。「ブラックサンダー」は有楽製菓株式会社の商品・商標です。
> 本プロジェクトは同社とは関係ありません。

> 🍫 **このチョコ・バッテリー表示は [RunThunder](../RunThunder/) に統合されました。**
> RunThunder を使えば、走るブラックサンダーの隣に同じチョコのバッテリーが2つ目の
> メニューバーアイコンとして並びます（設定でON/OFF可）。アプリを1つ起動するだけで
> 済むので、**通常は RunThunder の利用をおすすめします**。
> このディレクトリは、単体で動かしたい場合の **スタンドアロン Swift アプリ** と、
> **SwiftBar / xbar プラグイン**版を残しています。

## 概要

- **板チョコ＝バッテリー**: 残量ぶんだけ左にチョコが残り、消費したぶん（右側）は
  食べられて薄くなります。残量はチョコの「かじり具合」で一目でわかります。
- **充電表示**: 電源に挿している間は残量の横に ⚡ を表示します。
- **動かし方**: [RunThunder](../RunThunder/) に統合済み（おすすめ）。単体で使いたい場合は
  **スタンドアロン Swift アプリ**、または [SwiftBar](https://github.com/swiftbar/SwiftBar) /
  [xbar](https://github.com/matryer/xbar) 用の **プラグイン**（Python で画像生成）を使えます。

## 起動イメージ
<img width="454" height="366" alt="CleanShot 2026-06-07 at 14 03 19@2x" src="https://github.com/user-attachments/assets/c4d9630a-5bda-456d-94c4-43b663fa1633" />


## 使い方

### A. RunThunder に統合された表示（おすすめ）

[RunThunder](../RunThunder/) をインストールして起動すると、走るキャラの隣にこのチョコの
バッテリーが2つ目のメニューバーアイコンとして表示されます。右クリックの設定メニューの
**「🔋 チョコでバッテリーを表示」** でON/OFFできます。詳しくは
[RunThunder の README](../RunThunder/README.md) を参照してください。

### B. スタンドアロン Swift アプリ

単体で動かしたい場合。ビルドして起動するだけで、メニューバーに常駐します
（Dock アイコンは出ません = `LSUIElement`）。

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

### C. SwiftBar / xbar プラグイン

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
