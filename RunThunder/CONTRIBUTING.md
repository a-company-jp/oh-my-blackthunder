# 開発ガイド（RunThunder）

RunThunder の開発・カスタマイズ・内部実装に関するメモです。ユーザー向けの概要・
使い方・インストールは [README.md](./README.md) を参照してください。

## ビルド & 起動

```bash
# .app を生成
./build_app.sh

# 起動（メニューバーに常駐。Dock アイコンは出ません）
open RunThunder.app
```

開発中にサッと動かすだけなら:

```bash
swift run
```

## アプリアイコンを差し替える

`Resources/AppIcon.png`（正方形・1024×1024 推奨）を置き換えて `./build_app.sh` を実行する
だけ。ビルド時に `sips` + `iconutil` で `AppIcon.icns`（全サイズ）を生成し、バンドルに
埋め込みます（Finder / Launchpad / About で表示。メニューバーのキャラは別途下記の `Frames`）。

## 本番のコマ画像に差し替える

`Resources/Frames/` に PNG を入れて `./build_app.sh` を実行するだけ。

- ファイル名の **昇順** がアニメの再生順（例: `frame_00.png`, `frame_01.png`, …）
- メニューバー高さ（18pt）に自動リサイズ（高解像度ビットマップは保持するので Retina でも鮮明）。横幅は元画像の比率を維持
- 背景は透過 PNG 推奨
- 画像が 1 枚も無い場合は、コードで生成する仮フレーム（黒いチョコバー＋稲妻）で動作します

### パッケージ1枚絵からコマを自動生成する

ブラックサンダーのパッケージ画像 1 枚から「上下バウンド＋傾き」のコマ送りを生成できます。

```bash
python3 tools/make_frames.py ~/Downloads/blackthunder_package.png
# → Resources/Frames/frame_00.png 〜 frame_07.png を生成（白背景は透過化）
./build_app.sh
```

- 白背景は四隅からの flood fill で透過化（ロゴ内部の白は残す）
- コマ数・揺れ角・バウンド量は `tools/make_frames.py` 冒頭の調整パラメータで変更可
- 別の走る連番画像が用意できたら、このツールを使わず直接 `Resources/Frames/` に置けば OK

## 仕組みメモ

- `Stats.swift` … 各モニタの計測値構造体と `SystemSnapshot`、バイト/速度の整形
- `CPUMonitor.swift` … `host_statistics` の tick 差分から total/user/system/idle を算出
- `MemoryMonitor.swift` … `host_statistics64` の VM 統計から使用率/App/Wired/Compressed/pressure(近似)
- `StorageMonitor.swift` … `statfs` で起動ボリュームの使用量/総量
- `BatteryMonitor.swift` … IOKit (`IOPS*` + AppleSmartBattery) で残量/電源/容量/サイクル/温度
- `NetworkMonitor.swift` … `getifaddrs` で上り下り速度、`SystemConfiguration` で主要IFとローカルIP
- `ClaudeUsageMonitor.swift` … `npx ccusage --json` でトークン数を取得
- `DashboardView.swift` … スパークライン / 使用率バーの自作ビュー
- `DashboardViewController.swift` … ポップオーバーの中身（各セクション + 右側ボタン）
- `AnimationLoader.swift` … バンドル内 `Frames/*.png` を読み込み（無ければ仮フレーム生成）
- `Preferences.swift` … 設定を `UserDefaults` に永続化
- `LoginItem.swift` … `SMAppService` でログイン時自動起動を ON/OFF
- `HighUsageNotifier.swift` … しきい値超えが継続したら `UNUserNotificationCenter` で通知
- `AppDelegate.swift` … `NSStatusItem`、左クリック=ポップオーバー / 右クリック=設定メニュー、
  毎 2 秒のスナップショット収集・アニメ制御
  - アニメ間隔: 0% で 0.30s 〜 100% で 0.04s（`AppDelegate` 内で調整可）

### メモ
- メモリ Pressure は公開 API が無いため `(wired + compressed) / total` で近似（Activity Monitor とは厳密一致しません）
- ストレージ/バッテリーは変化が遅いので 10 秒ごとに更新
