# Black Thunder Monorepo ⚡🍫

**ブラックサンダースタイル**でまとめた、アプリ・ツールのコレクションです。
[有楽製菓株式会社（ユーラク）](https://www.yurakuseika.co.jp) の人気チョコバー
「ブラックサンダー」にインスパイアされています。

> ※ 非公式のファン作品です。「ブラックサンダー」は有楽製菓株式会社の商品・商標です。

このリポジトリは monorepo です。各アプリはトップレベルのディレクトリに、それぞれの
README・ランタイム・`.gitignore` を持って配置されています。CI / Issue・PR テンプレート /
dev container / エディタ設定など、リポジトリ全体に関わる設定はルートに置いています。

## アプリ一覧

| アプリ | 概要 |
|---|---|
| [`oh-my-blackthunder/`](./oh-my-blackthunder/) | Oh My Zsh ライクな小さな **zsh フレームワーク**。テーマ・ミニゲームに加え、**Claude / Codex** の使用量をブラックサンダーの本数で計測します。→ [README](./oh-my-blackthunder/README.md) |
| [`oh-my-blackthunder-jetbrains/`](./oh-my-blackthunder-jetbrains/) | **JetBrains / IntelliJ Platform プラグイン**（Kotlin）。ご褒美通知・がんばりカウンター・ランダム応援・黒×黄×赤のダーク UI テーマ・保存時のザクザク音。→ [README](./oh-my-blackthunder-jetbrains/README.md) |
| [`blackthunder-chrome/`](./blackthunder-chrome/) | **ThunderCaptcha** — GitHub PR の Merge をブラックサンダー摂取認証で挟む **Chrome 拡張**（MV3）。認証するとブラックサンダーが降ります。→ [README](./blackthunder-chrome/README.md) |
| [`blackthunder-vscode/`](./blackthunder-vscode/) | 保存・テスト成功でご褒美をくれる **VS Code 拡張**。ガチャ・ステータスバーのカウント・週間グラフ付き。→ [README](./blackthunder-vscode/README.md) |
| [`RunThunder/`](./RunThunder/) | 走るブラックサンダーがメニューバーで動く **macOS メニューバーアプリ**（RunCat 風）。システムダッシュボード・Claude 使用量の本数表示に加え、**板チョコでバッテリー残量を表示**（旧 blackthunder-battery を統合）。→ [README](./RunThunder/README.md) |
| [`web/`](./web/) | ランディング + リーダーボードの **Web アプリ**（Next.js）。AIザクザク度 / ブラックサンダーカウントのランキングとチーム機能。→ [README](./web/README.md) |
| [`blackthunder-claude-code/`](./blackthunder-claude-code/) | **Claude Code** をブラックサンダー風に。入力欄の上のスピナー動詞を「準チョコ精製中…」等の日本語ネタに置換し、ステータスラインも ⚡ザクザク表示に。クローンして中で `claude` を開くだけ。→ [README](./blackthunder-claude-code/README.md) |

## 新しいアプリを追加するには

1. トップレベルに新しいディレクトリ（例: `my-app/`）を作成します。
2. 専用の `README.md` を用意し、ローカル実行で生成物が出る場合は専用の `.gitignore`
   も置きます（パターンはそのフォルダに限定。例: `/cache/*`）。
3. クローン / 単体利用ができるよう、アプリは自己完結させます。

## スタイル

- Thunder Yellow: RGB(255,211,0)
- Thunder Red: RGB(230,0,18)
- Normal White: #FFFFFF

## ライセンス

[LICENSE.txt](./LICENSE.txt) を参照してください。
