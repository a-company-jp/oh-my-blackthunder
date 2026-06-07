# 開発ガイド（ThunderCaptcha / Black Thunder CI）

この Chrome 拡張の開発・内部設定に関するメモです。ユーザー向けの概要・使い方・
インストールは [README.md](./README.md) を参照してください。

## 開発

ビルド不要・依存ゼロのプレーン JS（Manifest V3）です。`chrome://extensions` で
「パッケージ化されていない拡張機能」として読み込んだあと、コードを変更したら同画面で
この拡張の **再読み込み** を押してください。

### 純粋関数のテスト

```bash
node blackthunder-chrome/test/pure.test.mjs
```

`getPrKeyFromPathname` / `isMergeButtonText` / `buildVerificationStorageKey` /
`isVerificationFresh` を依存ゼロで検証します。

## LAUNCHER_ENDPOINT の設定方法

認証後に物理 Launcher へ POST したい場合に設定します。**未設定（空文字）なら何も
しません。** POST は content script からではなく background(service worker) 経由で
行います（`src/background/service-worker.js`）。

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

## リーダーボードのベース URL の設定

既定は `https://blackathon.run.app`（プレースホルダ）。本番 URL に合わせて変更します。

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
