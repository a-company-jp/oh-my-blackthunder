# ThunderCaptcha ⚡🍫 — Black Thunder CI (Chrome 拡張)

**No Thunder, No Merge.** GitHub の Pull Request で Merge 系ボタンを押すと、
普通には Merge させず「ブラックサンダー摂取認証（ThunderCaptcha）」モーダルを挟む、
おやつ系 Chrome 拡張です。

> レビュー、テスト、CI、そしてブラックサンダー。
> Merge 前の糖分認証を済ませてからデプロイしましょう。

> ※ 非公式のファン作品です。「ブラックサンダー」は有楽製菓株式会社の商品・商標です。
> 本拡張は同社とは関係ありません。

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

## Chrome 拡張の開発 / 読み込み方法

ビルド不要・依存ゼロのプレーン JS（Manifest V3）です。

1. Chrome で `chrome://extensions` を開く。
2. 右上の **デベロッパーモード** を ON。
3. **「パッケージ化されていない拡張機能を読み込む」** をクリック。
4. この `blackthunder-chrome/` ディレクトリを選択。
5. GitHub の PR ページを開いて動作確認。

コードを変更したら `chrome://extensions` でこの拡張の **再読み込み** を押してください。

### 純粋関数のテスト

```bash
node blackthunder-chrome/test/pure.test.mjs
```

`getPrKeyFromPathname` / `isMergeButtonText` / `buildVerificationStorageKey` /
`isVerificationFresh` を依存ゼロで検証します。

## LAUNCHER_ENDPOINT の設定方法

認証後に物理 Launcher へ POST したい場合に設定します。**未設定（空文字）なら何もしません。**

POST は content script からではなく background(service worker) 経由で行います
(`src/background/service-worker.js`)。

設定方法は 2 通り:

- **コードで指定**: `src/background/service-worker.js` の
  `const LAUNCHER_ENDPOINT = "";` を書き換える。
- **storage で指定**（再ビルド不要）: 拡張の Service Worker コンソールで
  ```js
  chrome.storage.local.set({ launcherEndpoint: "http://raspberrypi.local:8080/fire" })
  ```

POST 内容:

```json
{ "reason": "github_merge", "pr": "owner/repo#123", "source": "black-thunder-ci" }
```

`host_permissions` には `raspberrypi.local` / `127.0.0.1` / `localhost` を許可済みです。
POST が失敗しても **Merge 操作・画面演出は止まりません**（`console.warn` のみ）。

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

### ベース URL の設定

既定は `https://blackathon.run.app`（プレースホルダ）。本番 URL に合わせて変更してください。

```js
// 拡張の Service Worker コンソールで
chrome.storage.local.set({ leaderboardBaseUrl: "https://<your-app>.run.app" })
```

`host_permissions` に `https://*.run.app/*` を許可済み。別ドメインを使う場合は
`manifest.json` の `host_permissions` にも追加してください。`identity` 権限と
`chrome.identity.getRedirectURL()`（`https://<extension-id>.chromiumapp.org/`）を
`/connect` の `redirect_uri` として使います。

## デモ用チェックリスト

- [ ] GitHub PR ページを開く
- [ ] Merge ボタン横に `⚡ Thunder Protected` が出る
- [ ] Merge ボタンを押すと ThunderCaptcha が出る
- [ ] reCAPTCHA v2 風のチェックボックス・ウィジェットが出る（右にブラックサンダーのロゴ）
- [ ] チェックボックスをクリックすると `🍫 ザクザク確認中...`（グルグル）→ `✅ Thunder Verified`
- [ ] 元の Merge 操作が再実行される（無限ループしない）
- [ ] ブラックサンダーが画面に降る
- [ ] `⚡ MERGED! BLACK THUNDER DEPLOYED ⚡` トーストが表示される
- [ ] `LAUNCHER_ENDPOINT` 設定時は POST が飛ぶ／空ならスキップ
- [ ] ポップアップから「接続する」→ GitHub 認証で連携できる
- [ ] 連携済みなら認証後に `🍫 ブラックサンダーカウント +1` トーストが出る
- [ ] 未連携でも ThunderCaptcha / Merge 演出は止まらない

## ディレクトリ構成

```text
blackthunder-chrome/
├── manifest.json                 # MV3 設定
├── src/
│   ├── content/
│   │   ├── pr-key.js             # getPrKeyFromPathname（純粋）
│   │   ├── merge-detect.js       # isMergeButtonText 等（純粋）+ DOM 判定
│   │   ├── verification.js       # 認証済み sessionStorage 管理（純粋 + ラッパ）
│   │   ├── launcher.js           # background への sendMessage（物理 Launcher）
│   │   ├── leaderboard.js        # background への "bt-ci:eat" ブリッジ + トースト
│   │   ├── modal.js              # ThunderCaptcha モーダル
│   │   ├── effects.js            # 降下演出 + トースト
│   │   └── main.js               # capture listener + MutationObserver + 制御
│   ├── background/
│   │   ├── service-worker.js     # メッセージルータ（Launcher / eat / 接続管理）
│   │   └── leaderboard.js        # APP TOKEN 取得（/connect）+ /api/ingest 送信
│   ├── popup/
│   │   ├── popup.html            # リーダーボード接続 / 解除 UI
│   │   └── popup.js              # service worker へ接続メッセージ
│   ├── styles/
│   │   └── thundercaptcha.css    # bt-ci- prefix のスタイル
│   └── assets/
│       ├── logo.png              # 公式ロゴ（battery から複製）
│       ├── chocolate.png         # チョコ画像（battery から複製）
│       └── black-thunder.svg     # フォールバック用 SVG
└── test/
    └── pure.test.mjs             # 純粋関数の依存ゼロテスト
```

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
