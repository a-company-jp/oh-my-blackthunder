# ⚡ Black Thunder Web (`web/`)

[oh-my-blackthunder](../) モノレポの **Web サービス**です。1つの Next.js アプリが
**(1) プロダクトのランディングページ** と **(2) AIザクザク度 / ブラックサンダー
カウントの公開リーダーボード** を兼ねます。データはリアルタイムに（`onSnapshot`）
更新されます。

| 指標 | フィールド | 何を測る？ | データ元（唯一） |
| --- | --- | --- | --- |
| **AIザクザク度** | `zakuzakuScore` | AI利用で「消費」したブラックサンダーの本数（cumulative bars） | **RunThunder のみ**。デバイスごとの**1日累積メーター**として `/api/ingest` に push |
| **ブラックサンダーカウント** | `blackThunderCount` | 「ブラックサンダーを食べた」と宣言した回数 | **Chrome拡張のチェックボックス**（`source: "chrome"`）＋ **Web の「食べた！」ボタン**（`source: "web"`） |

> [!NOTE]
> **これは "for fun" の企画です。** スコアは厳密なアンチチート設計ではありません。
> 数字を盛ろうと思えば盛れます。ゆるく楽しむためのリーダーボードです。

---

## What it is

ハッカソン発のお遊びプロジェクトです。開発中に AI（Claude / Codex）をどれだけ
「ザクザク」使ったか（= ブラックサンダー何本ぶん）と、実際にブラックサンダーを
何回食べたかを集計して、公開リーダーボードに並べます。

### 2つの指標と、その唯一のデータ元

- **AIザクザク度（`zakuzakuScore`）** は **RunThunder だけ**が push します。RunThunder は
  各マシン（デバイス）ごとに、その日の累積本数を**1日累積メーター**として送ります:
  - `eventId = "bars:<deviceId>:<yyyymmdd>"`、`provider: "Claude"`、
    `cumulativeBars = そのデバイス＋その日の累計`。
  - サーバは `delta = max(incoming - stored, 0)` だけ加算します（単調再送は差分のみ、
    古い/小さい再送は 0）。これによりデバイス×日ごとに冪等な累積メーターになります。
  - 集計はデバイス単位で `users/{uid}/devices/{deviceId}`（`DeviceDoc`）に保持され、
    `UserDoc.deviceCount` が貢献デバイス数を表します。
  - `zakuzakuScore` の値は
    [`lib/shared/score.ts`](./lib/shared/score.ts) の `computeZakuzakuScore()` が
    唯一の真実（v1では `zakuzakuScore === totalBars`）。
- **ブラックサンダーカウント（`blackThunderCount`）** は「食べた」宣言（eat-event）の
  合計です。宣言の出どころは**2つだけ**:
  - **Chrome拡張のチェックボックス**「私はブラックサンダーを食べました」（`source: "chrome"`、
    `/api/ingest` 経由）
  - **Web の「食べた！」ボタン**（`source: "web"`、`/api/eat` 経由）

> 旧クライアント由来の `EatSource`（`vscode` / `jetbrains` / `zsh`）は型としては
> 残っていますが、現行のプロダクト導線でカウントを増やすのは Chrome と Web の2つだけです。

### 主要ページ

| パス | 役割 |
| --- | --- |
| `/` | プロダクト **ランディングページ**（プロダクト紹介＋トップランカーのハイライト） |
| `/leaderboard` | **公開リーダーボード**（`zakuzakuScore` 降順、リアルタイム更新） |
| `/u/[login]` | ユーザー**プロフィール**（RunThunder ダッシュボード風。デバイス別メーター・プロバイダ内訳・デイリー活動） |
| `/teams` | **チーム**一覧／作成／参加、招待（invite）管理 |
| `/connect` | クライアント連携の**ブローカー**ページ（GitHub サインイン → Authorize → アプリトークン発行） |
| `/me` | サインイン中ユーザー自身のダッシュボード／設定（トークン管理など） |

---

## Stack

- **Next.js 15**（App Router, TypeScript strict, React 19）
- **Tailwind CSS v3** — Black Thunder のデザイントークンは
  [`tailwind.config.ts`](./tailwind.config.ts) と
  [`app/globals.css`](./app/globals.css)（`thunder.*` / `choco.*` カラー、
  `animate-zakuzaku` などのアニメーション、`bt-panel` / `bt-button` などの
  コンポーネントクラス）。
- **Firebase Auth**（GitHub provider）でブラウザログイン。
- **Firestore** をブラウザ側 `onSnapshot` で購読し、リアルタイム更新。
- **firebase-admin** が唯一の書き込み経路（Route Handlers / `nodejs` runtime）。

公式アセット（ロゴ・ステッカー・商品画像など）は
[`public/assets`](./public/assets) にあります。

---

## Auth model（website-brokered）

ログイン経路は **2つ**あり、書き込み API はどちらの bearer かで使い分けます。

### 1) ブラウザ（Firebase ID トークン）

`eat` / `teams` / `tokens` / `me` などの **ブラウザ発の API** は、
`Authorization: Bearer <FirebaseIdToken>` を受け取ります。サーバは
`adminAuth().verifyIdToken()` で検証し、GitHub 数値 id を
`decoded.firebase.identities["github.com"][0]` から取り出して
`uid = uidForGithubId(その id)` を解決します。

### 2) クライアントアプリ（website-brokered のアプリトークン）

RunThunder / Chrome 拡張などのクライアントは **GitHub OAuth を自前で実装しません**。
代わりに Web の **`/connect`** フローを開きます:

1. クライアントが `/connect?app=<ClientApp>&redirect_uri=<...>&state=<...>` を開く。
2. ユーザーが GitHub でサインインし **Authorize**。
3. サーバが **不透明なアプリトークン**（ランダム 32 バイトの hex）を発行し、
   ハッシュ化して `apiTokens/{sha256(token)}`（`ApiTokenDoc`）に保存。
4. `redirect_uri?token=...&state=...` にリダイレクトして返す。

`/connect` の `redirect_uri` は厳格に検証します。許可するのは **デスクトップの
ループバック**（`http://127.0.0.1[:port][/path]` / `http://localhost[:port]`）と
**Chrome 拡張**（`https://*.chromiumapp.org/*`）のみで、それ以外は拒否します。

`/api/ingest` は `Authorization: Bearer <appToken>` を受け取り、bearer を
sha256 してから `apiTokens/{hash}` を引いて `uid` を解決します（**GitHub への
往復なし、完全に失効可能**）。トークンは発行時の1回しか平文では返らず、保存は
常にハッシュのみです。

---

## Teams（チーム）

チームは「社会的な単位」です。仕様:

- **誰でも作成できます**（作成者が `owner` メンバーになり、`UserDoc.teamIds` に
  チーム id が追加され、チーム合計は作成者の現在の totals でシードされます）。
- 参加は **招待コード（`inviteCode`）** か **ユーザー名（login）招待** のどちらでも可:
  - コードで参加（`POST /api/teams/join`）すると、参加者の現在の totals がチーム合計に
    加算され、`TeamMemberDoc` がスナップショットとして作られます。
  - login 招待（`POST /api/teams/[id]/invite`）は `teams/{id}/invites/{loginLower}` を
    `pending` で作成。被招待者は `GET /api/me/invites` で確認し、
    `POST /api/teams/[id]/accept` で参加します（join と同じ効果）。
- 脱退（`POST /api/teams/[id]/leave`）はメンバー doc を削除し、チーム合計から本人の
  貢献分を差し引き、`UserDoc.teamIds` から外します。
  - **オーナーが脱退する場合**: 他メンバーが居れば所有権を移譲し、本人だけのチームなら
    脱退をブロックします（先にチームを畳む運用）。
- チーム合計は**非正規化の increment** で常にライブ更新されます。ingest トランザクションは
  メンバーの bar/eat の delta を、その人の `teamIds` にある全チーム（チーム doc と
  メンバー doc）へ fan-out します。**不変条件: `team.totalBars == Σ member.bars`**
  （`totalBlackThunderCount` も同様）。クライアントは `teams` / `members` を**読むだけ**で、
  すべての変更は admin-only の API ルートを通します。

---

## API（すべて JSON / すべて `export const runtime = "nodejs";`）

| メソッド / パス | 認証 | リクエスト | レスポンス（要点） |
| --- | --- | --- | --- |
| `POST /api/ingest` | アプリトークン | `IngestRequest {client, events:[IngestBarEvent\|IngestEatEvent]}` | `IngestResponse`（RunThunder の bars / Chrome の eat） |
| `POST /api/eat` | Firebase | `{login?, displayName?, avatarUrl?}` | `{ok, uid, login, blackThunderCount}`（Web ボタン、`source:"web"`） |
| `GET /api/health` | なし | — | `{ok:true}` |
| `POST /api/tokens` | Firebase | `{app:ClientApp, label?}` | `{token:<平文1回限り>, app, label}`（発行＋ハッシュ保存） |
| `GET /api/tokens` | Firebase | — | `{tokens:[{app,label,createdAtMs,lastUsedAtMs,revoked}]}`（平文は返さない） |
| `DELETE /api/tokens` | Firebase | `{tokenId}`（sha256 / doc id） | `{ok}`（失効） |
| `POST /api/teams` | Firebase | `{name, emoji?, description?}` | `{team:TeamDoc}`（作成者が owner、合計を作成者の totals でシード） |
| `POST /api/teams/join` | Firebase | `{code}` | `{team}`（inviteCode で参加、合計に参加者 totals を加算） |
| `POST /api/teams/[id]/invite` | Firebase（メンバー） | `{login}` | `{ok}`（`invites/{loginLower}` を pending 作成） |
| `POST /api/teams/[id]/accept` | Firebase | — | 自分宛の pending 招待を承認して参加 |
| `POST /api/teams/[id]/leave` | Firebase | — | 脱退（合計から本人貢献を減算、メンバー doc 削除、`teamIds` から除去） |
| `GET /api/me/invites` | Firebase | — | `{invites:[TeamInviteDoc]}`（自分の login 宛の pending） |
| `GET /connect`（ページ） | GitHub サインイン | query `app, redirect_uri, state` | サインイン＋Authorize 後にトークンを発行し `redirect_uri?token=...&state=...` へ |

ワイヤ型・キャップ・整形関数は [`lib/shared/schema.ts`](./lib/shared/schema.ts)
（`IngestRequest` / `IngestResponse` / `IngestEvent`、`UserDoc` / `DeviceDoc` /
`TeamDoc` / `ApiTokenDoc` …、`MAX_*`、`formatBars`、`uidForGithubId`）と
[`lib/shared/score.ts`](./lib/shared/score.ts)（`computeZakuzakuScore`）が
**唯一の真実**です。再定義せず import します。

---

## Local development (pnpm)

パッケージマネージャは **pnpm** です（`packageManager` 参照）。

```bash
# 0) 依存をインストール
pnpm install

# 1) 環境変数を用意（.env.local が build/runtime に読まれる）
cp .env.example .env.local
```

ローカルでは Firebase エミュレータを使います。**端末を2つ**開いてください。

```bash
# Terminal 1 — Auth + Firestore エミュレータを起動（Firestore は :8080）
#   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 が export されます
pnpm run emulators

# Terminal 2 — サンプルデータ投入 → 開発サーバ
pnpm run seed
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1 pnpm run dev
```

- `pnpm run seed` は **エミュレータ専用**です。`FIRESTORE_EMULATOR_HOST` が
  未設定だと安全のため即終了します（本番DBには絶対に書き込みません）。投入されるのは
  ユーザー（`UserDoc`、`deviceCount` / `teamIds` 込み）、`devices`、`daily`、そして
  **2つのサンプルチーム**（`teams` / `members`、チーム合計はメンバー貢献の合計）です。
  投入後、端末にリーダーボード＋チーム＋デバイス数のプレビューが表示されます。
- `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` を付けると、ブラウザ SDK が本番ではなく
  ローカルエミュレータを向きます。
- エミュレータ UI: <http://localhost:4000/firestore> / アプリ: <http://localhost:3000>

その他のスクリプト:

| script | 説明 |
| --- | --- |
| `pnpm run dev` | 開発サーバ（Next.js） |
| `pnpm run build` / `pnpm run start` | 本番ビルド / 起動 |
| `pnpm run lint` | ESLint |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run emulators` | Auth + Firestore エミュレータ |
| `pnpm run seed` | エミュレータにサンプルデータ投入（users / devices / daily / teams / members） |

---

## Architecture

- **UID スキーム:** Firestore のドキュメントキー `uid` は **常に GitHub の数値 id**
  を使った `gh_<githubNumericId>`（[`uidForGithubId`](./lib/shared/schema.ts)）。
  Firebase Auth の uid は**セッション専用**で、ドキュメントキーには絶対に使いません。
  これにより Web ログインとクライアント（RunThunder / Chrome）が**同じドキュメント**に
  収束します。
- **書き込みは admin のみ:** すべての書き込みは Route Handler 内の firebase-admin を
  通します。ブラウザ/クライアントは**読み取り専用**で、
  [`firestore.rules`](./firestore.rules) がクライアント書き込みを拒否します。
  これが `zakuzakuScore` / `blackThunderCount` の偽装を防ぎます。
- **冪等な取り込み:** 重複防止は `users/{uid}/events/{eventId}` のドキュメント存在
  チェックで行います（存在 == 既にカウント済み）。RunThunder の bars メーターは
  `eventId = "bars:<deviceId>:<yyyymmdd>"` で、サーバは
  `delta = max(incoming - stored, 0)` だけ加算します。
- **コレクション**（[`schema.ts`](./lib/shared/schema.ts) の `COLLECTIONS`）:
  - `users/{uid}` — GitHub アイデンティティごとの集計ドキュメント（`UserDoc`、
    `deviceCount` / `teamIds` 含む）
  - `users/{uid}/events/{eventId}` — 冪等性のための非公開 ledger（`EventDoc`）
  - `users/{uid}/daily/{yyyymmdd}` — 公開デイリーロールアップ（`DailyDoc`）
  - `users/{uid}/devices/{deviceId}` — RunThunder のデバイス別メーター（`DeviceDoc`）
  - `teams/{teamId}` — 公開チーム集計（`TeamDoc`）
  - `teams/{teamId}/members/{uid}` — 公開メンバーシップ（`TeamMemberDoc`）
  - `teams/{teamId}/invites/{loginLower}` — 招待（非公開、API 経由・`TeamInviteDoc`）
  - `apiTokens/{sha256(token)}` — website-brokered のアプリトークン（非公開・`ApiTokenDoc`）
- **共有コントラクト:** ワイヤ型・キャップ・整形関数は
  [`lib/shared/schema.ts`](./lib/shared/schema.ts) と
  [`lib/shared/score.ts`](./lib/shared/score.ts) が唯一の真実です。再定義せず import します。
- **Runtime:** firebase-admin に触れる Route Handler は必ず
  `export const runtime = "nodejs";` を宣言します。コンテナのポートはどこでも **8080** です。

---

## Environment variables

`.env.example` が唯一の真実です。`NEXT_PUBLIC_*` だけがブラウザバンドルに焼き込まれ
（ビルド時）、それ以外はサーバ（Route Handler）専用です。

### Public（`NEXT_PUBLIC_*` — ブラウザに露出, build時に確定）

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web 設定 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web 設定 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase プロジェクト id（既定 `blackathon`） |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase web 設定 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase web 設定 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web 設定 |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATOR` | `1` でブラウザ SDK をローカルエミュレータに向ける |
| `NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID` | ブラウザの GitHub サインイン用 OAuth App の public client id |

### Server-only（ブラウザに露出しない）

| 変数 | 用途 |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | サーバ側でも使える同 client id |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub provider 用。本番は Secret Manager → Cloud Run の secret-env。**イメージに焼かない** |
| `GOOGLE_CLOUD_PROJECT` | firebase-admin のプロジェクト。Cloud Run では自動設定。ローカルはエミュレータ未使用時のみ設定 |
| `FIRESTORE_EMULATOR_HOST` | ローカル: admin SDK をエミュレータに向ける（`pnpm run emulators` が設定） |
| `FIREBASE_AUTH_EMULATOR_HOST` | ローカル: Auth エミュレータ向け |

> 本番（Cloud Run）では firebase-admin は **Application Default Credentials**
> （`applicationDefault()` / アタッチされたランタイムサービスアカウント）を使い、
> **JSON キーは不要**です。ローカルで本番 Firestore に向ける場合のみ
> `gcloud auth application-default login`（キーレス、推奨）を使います。

---

## Deployment

本番は **Google Cloud Run** にデプロイします（コンテナポート **8080**）。インフラは
**Terraform** 管理、CI/CD は **GitHub Actions の OIDC**（JSON キーなしのキーレス認証）。
手順・変数・初期化は **[`terraform/README.md`](./terraform/README.md)** を参照してください。

---

## Privacy

> **参加（ログイン / 同期 / 連携）は公開リーダーボードへの掲載を意味します。**
>
> GitHub でログインする、または RunThunder / Chrome 拡張からデータを同期すると、
> あなたの GitHub ログイン名・アバター・`zakuzakuScore`・`blackThunderCount`・
> 所属チームなどの集計値が **公開**のリーダーボード・プロフィール・チームページに
> 表示されます。掲載されたくない場合は参加（連携・同期）しないでください。

---

> [!IMPORTANT]
> 繰り返しますが **"for fun" の企画**です。スコアは厳密なアンチチート設計では
> なく、本気の競技指標ではありません。ゆるく楽しんでください。
