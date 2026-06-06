# RunThunder ⚡️

[RunCat](https://kyome.io/runcat/) と同じ仕組みの macOS メニューバー常駐アプリ。
走るキャラ＆デザインを **ブラックサンダー** モチーフにしたもの。

- メニューバーにキャラを表示し、コマ送りでアニメーション
- **使用率が高いほどアニメが速くなる**
- **クリックでダッシュボード（ポップオーバー）**: RunCat 風に CPU / メモリ / ストレージ / バッテリー / ネットワークを一覧
  - CPU: 使用率 + System/User/Idle 内訳 + スパークライン（履歴グラフ）
  - メモリ: 使用率 + Pressure(近似)/App/Wired/Compressed
  - ストレージ: 使用率 + 使用量/総量 + 進捗バー
  - バッテリー: 残量 + 電源/最大容量/充放電回数/温度（ノートのみ。非搭載なら自動で隠す）
  - ネットワーク: インターフェース名 + ローカルIP + 上り/下り速度
  - 右側ボタン: アクティビティモニタを開く / 終了
- **右クリックで設定メニュー**: 下記のトグル類はこちらに集約
- **アニメ速度の対象を切り替え**: CPU 使用率 / メモリ使用率 / **ネットワーク速度**
- **使用率を数値表示**: メニューバーのキャラ横に値を表示（CPU/MEM は `%`、NET は速度）
- **🍫 Claude 使用量をブラックサンダー個数で表示**: `ccusage` のトークン数を
  **90,000 トークン = 1 個** で換算。今日 / 累計を切り替え可
- **ライト/ダーク自動対応**: 「メニューバーの色に追従」でキャラを単色（テンプレート）描画し明暗に追従
- **高負荷を通知**: しきい値（既定 85%）を一定時間超えたら通知（ON/OFF）
- **ログイン時に起動**: 自動起動の ON/OFF（`SMAppService`）
- 設定は次回起動時も保持（`UserDefaults`）
- メニューから現在の使用率・Claude 使用量を確認 / 終了

### 🍫 Claude 使用量について

- `npx ccusage@latest --json` を実行し、`totals.totalTokens`（累計）と当日の `daily[].totalTokens` を取得
- 換算: `個数 = トークン数 ÷ 90,000`（`ClaudeUsageMonitor.tokensPerBar` で変更可）
- 取得は重いのでバックグラウンドで実行し、起動時 + 15 分ごと + メニューの「🍫 使用量を更新」で更新
- 前提: `node` / `npx` が使えること（Homebrew 等）。アプリはログインシェル `zsh -lc` 経由で `npx` を解決

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

### 注意点

- **ログイン時に起動 / 通知** は、アプリが安定した場所にあること・コード署名が前提になる場合があります。
  ad-hoc ビルドでは動作しないことがあります（その場合はメニューのチェックが入らない／通知が出ない）。
  確実に使うなら `RunThunder.app` を `/Applications` に置く、もしくは署名してください。
