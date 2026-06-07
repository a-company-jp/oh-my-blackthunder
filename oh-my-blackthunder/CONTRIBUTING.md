# 開発ガイド（Oh My Blackthunder）

Oh My Blackthunder の開発・手動セットアップ・内部仕様に関するメモです。
ユーザー向けの概要・使い方・インストールは [README.md](./README.md) を参照してください。

## ディレクトリの役割

- シェルのコア挙動 → `lib/`
- 組み込みプラグイン → `plugins/<name>/<name>.plugin.zsh`
- 組み込みテーマ → `themes/<name>.zsh-theme`
- インストール・メンテナンス用スクリプト → `tools/`
- 設定例 → `templates/`
- `custom/` / `cache/` / `log/` はローカル専用（コミットしない）

## 手動セットアップ

インストーラ（`tools/install.sh`）を使わない場合の手順です。

**Oh My Zsh** — プラグインとテーマを custom ディレクトリにシンボリックリンクし、
`~/.zshrc` で有効化します。

```zsh
ln -sfn "$PWD/plugins/omb-games" ~/.oh-my-zsh/custom/plugins/omb-games
ln -sf  "$PWD/themes/oh-my-black.zsh-theme" ~/.oh-my-zsh/custom/themes/oh-my-black.zsh-theme
for f in "$PWD"/themes/blackthunder_ascii*.txt; do
  ln -sf "$f" ~/.oh-my-zsh/custom/themes/"${f:t}"
done
# ~/.zshrc:  plugins=(... omb-games)   ZSH_THEME="oh-my-black"
```

**最小ランタイム** — `oh-my-black.sh` はインストールルートを自動解決し、有効な
プラグイン（と任意のテーマ）を読み込みます。`~/.zshrc` から次のように組み込みます。

```zsh
export OMB="$HOME/.oh-my-blackthunder"   # ← 実際のクローンパス
plugins=(ai-blackthunder omb-games)
# OMB_THEME="oh-my-black"                 # 任意のプロンプトテーマ
source "$OMB/oh-my-black.sh"
```

`plugins=(...)` の各エントリは `plugins/<name>/<name>.plugin.zsh` を読み込みます
（`custom/plugins/<name>/` で上書き可能）。

## ai-blackthunder の内部仕様

### Claude 使用量

Claude Code は同一セッションのステータスラインコマンドを繰り返し呼び、その
セッションの *累計* コストを報告します。そこで各セッション ID ごとに 1 つの
スナップショットを `cache/ai-blackthunder/providers/Claude/<id>.tsv` に上書き保存し、
プロンプトは `OMB_AI_BLACKTHUNDER_WINDOW_SECONDS`（既定 5 時間）内のスナップショットを
合算します。これにより、新しいセッションが始まっても本数が 0 に戻らず、ターミナルを
またいで積み上がります。保持ウィンドウより古いスナップショットは次回ティックで削除します。

### Codex 使用量

対話シェルで `ai-blackthunder` がスロットリング付きのプロンプトスキャンを行い、
`~/.codex/sessions/` の `token_count` イベントと最小限のモデルメタデータだけを読み、
Black Thunder の本数を見積もります。イベント行は `cache/ai-blackthunder/events/Codex.tsv`
に保存します。

各イベント行には決定論的なイベント ID が付くため、スキャンがイベントを書いた後に
ファイルオフセット保存前で終了しても、次のスキャンが同じ `token_count` 行を二重計上
せずにリトライできます。プロンプト側の読み取りも合算前にイベント ID で重複排除するため、
ファイルシステムの競合で重複行が残っても無害です。

スキャンはキャッシュ配下の小さなロックディレクトリで直列化し、複数ターミナルが同じ
状態ファイルを同時更新しないようにしています。モニタの状態はハッシュ化したセッション
パスとファイルオフセットで持ち、プロンプト・トランスクリプト・セッション ID・コマンド
出力は保存しません。

### 価格テーブルと環境変数

Codex の価格は `plugins/ai-blackthunder/pricing/codex.tsv` に分離してあり、パーサを
触らずに更新できます。挙動は以下の環境変数で調整できます。

```zsh
OMB_BLACKTHUNDER_PRICE_JPY=43
OMB_USD_JPY=160
OMB_AI_BLACKTHUNDER_TTL=600
OMB_CODEX_PRICING_FILE=/path/to/codex.tsv
OMB_CODEX_DEFAULT_MODEL=gpt-5.5
OMB_CODEX_HOME=$HOME/.codex
OMB_CODEX_SESSION_DIR=$HOME/.codex/sessions
OMB_AI_BLACKTHUNDER_WINDOW_SECONDS=18000
OMB_AI_BLACKTHUNDER_EVENT_RETENTION_SECONDS=18000
OMB_CODEX_SESSION_PROMPT_SCAN_SECONDS=30
OMB_CODEX_SESSION_LOCK_WAIT_MS=2000
OMB_CODEX_SESSION_LOCK_STALE_MS=300000
OMB_CODEX_SESSION_LOCK_TOUCH_INTERVAL_MS=1000
OMB_CODEX_SESSION_AUTO_SCAN=0   # プロンプト時の Codex スキャンを無効化
```

## プルリクエストの前に

変更は小さくまとめ、以下を説明してください。

1. 何を変えたか。
2. なぜそのディレクトリに置くのか。
3. どう動作確認したか。

マシンローカルのキャッシュ・ログ・個人設定はコミットしないでください。
