# Oh My Blackthunder ⚡🍫

ターミナルにブラックサンダーを。[Oh My Zsh](https://github.com/ohmyzsh/ohmyzsh)
の構成にインスパイアされた小さな **zsh フレームワーク**です。AI コーディングで
消費した「AIザクザク度」をブラックサンダーの本数として計測し、シェルから
ミニゲームで遊んだりプロンプトを彩ったりできます。

> ※ 非公式のファン作品です。「ブラックサンダー」は有楽製菓株式会社の商品・商標です。

## 概要

- **AIザクザク度メーター（`ai-blackthunder`）** — **Claude** と **Codex** の
  ローカル使用ログを読み、最近の AI 使用量をブラックサンダーの本数として表示します。
  例: `⚡1.4本 (Claude 0.9 / Codex 0.5)`。保存するのはタイムスタンプ・プロバイダ名・
  換算した本数だけで、プロンプトやトランスクリプトは保存しません。
- **ターミナル ミニゲーム（`omb-games`）** — ブロック崩し・ピンポン・スネークなど、
  ブラックサンダーモチーフのミニゲームを `omb` から起動できます（Python + `curses`）。
- **プロンプトテーマ（`oh-my-black`）** — 黒×サンダーイエローのプロンプトテーマ。

## インストール方法

任意の場所にクローン（パスはハードコードされておらず、インストーラと実行時に
自動解決されます）し、インストーラを実行します。

```zsh
git clone git@github.com:a-company-jp/oh-my-blackthunder.git ~/.oh-my-blackthunder
~/.oh-my-blackthunder/tools/install.sh
```

インストーラが環境を自動判別して設定します。

- **Oh My Zsh ユーザー** → `omb-games` とテーマを `$ZSH_CUSTOM` にシンボリックリンク
  します。あとは `~/.zshrc` の `plugins=(...)` に `omb-games` を追加（必要なら
  `ZSH_THEME="oh-my-black"` も）してください。
- **Oh My Zsh なし** → `~/.zshrc` に管理ブロックを追記し、クローンパスを `OMB` に
  設定して最小ランタイムを読み込みます。

再実行は安全（冪等）です。`tools/install.sh --print` で、変更せずに実行内容だけ
確認できます。`exec zsh` で再読み込みし、`omb` を実行すると遊べます。

> ミニゲームには `python3` が必要です（未導入ならインストーラが警告します）。

手動セットアップや最小ランタイムの組み込み方は [CONTRIBUTING.md](./CONTRIBUTING.md)
を参照してください。

## 使い方

### AIザクザク度メーター（`ai-blackthunder`）

`~/.zshrc` の `plugins=(...)` に `ai-blackthunder` を加えると、プロンプトに最近の
AI 使用量がブラックサンダーの本数で出ます。

- **Claude Code** — Claude Code のステータスライン JSON を本プラグインの
  コマンドに渡すと、そのセッションの使用量を本数に換算します。`settings` に
  次のように設定してください。

  ```json
  {
    "statusLine": {
      "type": "command",
      "command": "/path/to/oh-my-blackthunder/plugins/ai-blackthunder/omb-claude-statusline.zsh",
      "padding": 0
    }
  }
  ```

- **Codex** — `~/.codex/sessions/` のローカルセッションログを、対話シェルで
  スロットリングしながら読み取ります。Codex 側の設定は不要です。

いずれも保存するのはタイムスタンプ・プロバイダ名・換算した本数だけで、プロンプトや
トランスクリプト・セッション ID・コマンド出力は保存しません。

主な設定（`~/.zshrc` で上書き可）:

```zsh
OMB_BLACKTHUNDER_PRICE_JPY=43           # ブラックサンダー 1 本の価格（円）
OMB_USD_JPY=160                         # 為替レート
OMB_AI_BLACKTHUNDER_WINDOW_SECONDS=18000 # 集計ウィンドウ（既定 5 時間）
OMB_CODEX_DEFAULT_MODEL=gpt-5.5         # Codex の既定モデル
OMB_CODEX_SESSION_AUTO_SCAN=0           # プロンプト時の Codex スキャンを無効化
```

価格テーブルや内部の挙動（キャッシュ構造・重複排除など）の詳細は
[CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## 画像
### AA 
<img width="827" height="306" alt="CleanShot 2026-06-07 at 13 54 50@2x" src="https://github.com/user-attachments/assets/0289b8e6-a097-447b-84e6-4857871a6f83" />

### AI使用量 ブラックサンダー個数カウント
<img width="360" height="28" alt="CleanShot 2026-06-07 at 13 54 39@2x" src="https://github.com/user-attachments/assets/441d2d6e-309b-401e-9b8f-a4e4f67d075c" />
<img width="560" height="36" alt="CleanShot 2026-06-07 at 13 54 34@2x" src="https://github.com/user-attachments/assets/65c53e12-dbc8-4b57-8107-cd1079fbbeab" />

### ターミナル ミニゲーム（`omb-games`）

プラグインを有効化したら `omb` でメニューを表示できます。

| コマンド | ゲーム |
|---|---|
| `omb break` | ブロック崩し（ブラックサンダー AA を崩す） |
| `omb pong`  | 稲妻ピンポン（CPU 対戦） |
| `omb snake` | ザクザク・スネーク |
| `omb dodge` | イナズマ回避 |
| `omb drop`  | ザクッ・ドロップ（落ちもの） |
| `omb mine`  | マインスイーパー（`easy` / `normal` / `hard`） |

`python3` が必要です。プラグインは自己完結しており、単体プラグインとしても
Oh My Zsh プラグインとしても動作します。

## ライセンス

リポジトリルートの [LICENSE.txt](../LICENSE.txt) を参照してください。
