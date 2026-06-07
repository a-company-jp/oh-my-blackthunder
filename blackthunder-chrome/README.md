# ThunderCaptcha ⚡🍫 — Black Thunder CI (Chrome 拡張)

**No Thunder, No Merge.** GitHub の Pull Request で Merge 系ボタンを押すと、
普通には Merge させず「ブラックサンダー摂取認証（ThunderCaptcha）」モーダルを挟む、
おやつ系 Chrome 拡張です。

> レビュー、テスト、CI、そしてブラックサンダー。
> Merge 前の糖分認証を済ませてからデプロイしましょう。

> ※ 非公式のファン作品です。「ブラックサンダー」は有楽製菓株式会社の商品・商標です。
> 本拡張は同社とは関係ありません。

## 画像
<img width="705" height="414" alt="CleanShot 2026-06-07 at 14 05 14@2x" src="https://github.com/user-attachments/assets/4e1b5006-1a75-4fa6-ad76-98a77b39ecf9" />


## ThunderCaptcha とは

- GitHub PR ページの **Merge / Squash / Rebase / Confirm 系ボタン** を捕捉し、
  reCAPTCHA v2 の「私はロボットではありません」ウィジェットに寄せた
  パロディ認証 UI を表示します（配色はブラックサンダーの黒×金×赤）。
- チェックボックス「私はブラックサンダーを食べました」をクリックすると、
  グルグル（確認中）→ ✅ Thunder Verified のあと、元の Merge 操作が再実行されます。
- 認証後はブラックサンダーが画面に降り、`⚡ MERGED! BLACK THUNDER DEPLOYED ⚡`
  のトーストが出ます。
- （オプション）認証後に Raspberry Pi 等の **物理 Launcher** へ HTTP POST できます。

本物の reCAPTCHA ではなく、見た目だけのパロディ UI です。

## GitHub PR ページでの使い方

1. 拡張を読み込んだ状態で `https://github.com/<owner>/<repo>/pull/<番号>` を開く。
2. Merge ボタンの横に **`⚡ Thunder Protected`** バッジが付きます。
3. Merge / Squash / Rebase などのボタンを押すと **ThunderCaptcha** が表示されます。
4. チェックボックスをクリックすると認証が走ります（Esc で中断）。
5. 認証が通ると元の Merge 操作が再実行され、ブラックサンダーが降ってトーストが出ます。

一度認証すると、同じ PR は **30 秒間** モーダルをスキップして Merge 操作を通します
(`Confirm merge` などの二段階操作で毎回出さないため)。

## インストール方法

ビルド不要・依存ゼロのプレーン JS（Manifest V3）です。マーケットプレイス未公開の
ため、「パッケージ化されていない拡張機能」として読み込みます。

1. Chrome で `chrome://extensions` を開く。
2. 右上の **デベロッパーモード** を ON。
3. **「パッケージ化されていない拡張機能を読み込む」** をクリック。
4. この `blackthunder-chrome/` ディレクトリを選択。
5. GitHub の PR ページを開いて動作確認。

開発（コード変更後の再読み込み・テスト）や、物理 Launcher（`LAUNCHER_ENDPOINT`）など
内部設定の詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## リーダーボード連携（ブラックサンダーカウント）

ThunderCaptcha 認証を通すたびに、Web サービスの **ブラックサンダーカウント** へ
「ブラックサンダーを食べた」eat イベントを 1 件記録できます。GitHub アカウントへ
紐づくので、リーダーボードに自分の摂取数が積み上がります。

- **接続方法**: ツールバーの拡張アイコン（ポップアップ）を開き、「接続する」を押します。
  Web 側の `/connect` フローが開き、GitHub 認証 → 認可すると不透明な APP TOKEN が
  発行され、`chrome.storage.local` に保存されます（拡張は GitHub OAuth を自前で持ちません）。
- **記録タイミング**: 認証成功（`✅ Thunder Verified`）の直後に、background 経由で
  `<base>/api/ingest` へ `eat` イベントを 1 件 POST します。eventId は毎回新しい
  UUID（`chrome:<uuid>`）なので、認証 1 回につき 1 カウントです。
- **best-effort**: 未接続・通信失敗でも **ThunderCaptcha / Merge 演出は止まりません**。
  成功 / 失敗は画面右上の小さなトーストと console に出るだけです。
- **解除**: ポップアップの「連携を解除」でトークンを破棄します。

> リーダーボードのベース URL は既定で `https://blackathon.run.app`（プレースホルダ）です。
> 本番 URL への変更方法は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## 既知の制約・注意点

- 判定は GitHub の class 名ではなく **ボタンのテキスト / value** に基づきます。
  文言が大きく変わると追従調整が必要です。
- `Merge pull request` → `Confirm merge` のように GitHub は二段階クリックを要求する
  ことがあります。30 秒の認証スキップで両段階を 1 度の認証で通せます。
- GitHub 側の Merge が権限や PR 状態で実行できなくても、
  ThunderCaptcha と降下演出は動きます（演出は「認証した」ことに対する反応です）。
- 画像は外部 CDN を使わず拡張内 `assets/` のみ。読み込み失敗時は絵文字 `🍫⚡` に
  フォールバックします。
- ビルドステップはありません（プレーン JS / Manifest V3）。
