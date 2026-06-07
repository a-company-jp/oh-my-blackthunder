# Oh My Black Thunder (JetBrains プラグイン) ⚡🍫

ブラックサンダー（[有楽製菓株式会社（ユーラク）](https://www.yurakuseika.co.jp)）に
インスパイアされた、開発をちょっと楽しくする JetBrains IDE 向けプラグインです。
IntelliJ IDEA / PyCharm / WebStorm など IntelliJ Platform ベースの IDE で動きます。

## 機能

| 機能 | 内容 |
|---|---|
| **ご褒美通知** | ビルド成功・テスト全グリーンで「ブラックサンダーをどうぞ🍫」と通知します。 |
| **がんばりカウンター** | 保存・ビルド成功・テスト成功の回数をポイント化し、「ブラックサンダー何個分がんばったか」を右側のツールウィンドウで可視化します。 |
| **ランダム応援／名言** | プロジェクトを開いたとき、または `Tools → ブラックサンダーの一言⚡` からランダムな応援メッセージを表示します。 |
| **見た目テーマ** | 黒背景＋サンダーイエロー(255,211,0)／レッド(230,0,18) のダーク UI テーマ「Black Thunder」を追加します。`Settings → Appearance & Behavior → Appearance → Theme` から選べます。 |
| **ザクザク音** | ファイル保存時に「ザクザク」音（`pixta_138184860.wav` 由来）を鳴らします。`Settings → Tools → ブラックサンダー⚡` で ON/OFF 切替、`Tools → ザクッと味見⚡` でその場で試せます。VSCode 版と同じ音源です。 |

### ポイント配分

- ファイル保存: +1 pt
- ビルド成功: +5 pt
- テスト全グリーン: +10 pt
- **30 pt = ブラックサンダー 1 個分**（1個30円にちなんで）

## インストール方法

ビルド済みのプラグイン zip を、お使いの JetBrains IDE に手動インストールします。

1. プラグイン zip をビルドします（JDK 17 以上が必要。Gradle Wrapper 同梱なので
   Gradle 本体のインストールは不要です）。

   ```bash
   ./gradlew buildPlugin   # build/distributions/*.zip に出力
   ```

2. IDE で `Settings → Plugins → ⚙（歯車）→ Install Plugin from Disk...` を開き、
   生成された `build/distributions/*.zip` を選びます。
3. IDE を再起動すると有効になります。`Settings → Appearance & Behavior →
   Appearance → Theme` から「Black Thunder」テーマを選べます。

開発時の実行・検証方法は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

リポジトリルートの [LICENSE.txt](../LICENSE.txt) を参照してください。
