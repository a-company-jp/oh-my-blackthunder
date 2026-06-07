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

## Install via Homebrew (Cask)

GUI のメニューバーアプリなので **Homebrew Cask**（`.app` バンドル）として配布します。

```bash
# tap を追加してからインストール
brew tap a-company-jp/tap && brew install --cask runthunder

# もしくは 1 行で（tap を明示）
brew install --cask a-company-jp/tap/runthunder
```

インストールすると `RunThunder.app` が `/Applications` に入ります。起動（メニューバー常駐・Dock アイコンなし）:

```bash
open -a RunThunder
```

> メモ
>
> - `brew tap a-company-jp/tap` は `a-company-jp/homebrew-tap` リポジトリを参照します。
> - **リリース（GitHub Release の publish）が CI ワークフローを起動**します
>   （[`.github/workflows/runthunder-release.yml`](../.github/workflows/runthunder-release.yml)）。
>   ワークフローは [`build_app.sh`](build_app.sh) で **`RunThunder.app`（ユニバーサル・アドホック署名）** をビルド →
>   `ditto` で zip 化して Release に添付 → tap の `Casks/runthunder.rb`（url + sha256）を自動更新します。
> - tap への push には `HOMEBREW_TAP_TOKEN`（tap リポジトリへの `repo` スコープ PAT）の
>   シークレット設定が必要です。未設定でも Release には `RunThunder-<version>-macos.zip` が添付されるので、
>   展開して `/Applications` に置けば手動インストールできます。
> - **未署名（アドホック署名）アプリ**のため、Gatekeeper が初回起動をブロックする場合があります。
>   Cask の `postflight` が quarantine 属性を自動除去しますが、手動なら
>   `xattr -dr com.apple.quarantine /Applications/RunThunder.app` を実行するか、
>   Finder で右クリック →「開く」を選んでください。
> - Cask 版は本番のコマ画像をバンドルに含むため、メニューバーのキャラは本番フレームで動作します。

## 注意点

- **ログイン時に起動 / 通知** は、アプリが安定した場所にあること・コード署名が前提になる場合があります。
  ad-hoc ビルドでは動作しないことがあります（その場合はメニューのチェックが入らない／通知が出ない）。
  確実に使うなら `RunThunder.app` を `/Applications` に置く、もしくは署名してください。

---

ソースからのビルド・アプリアイコン/コマ画像の差し替え・内部実装メモは
[CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。
