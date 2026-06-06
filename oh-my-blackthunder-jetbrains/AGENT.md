# App: oh-my-blackthunder-jetbrains (for agents)

ブラックサンダー風の JetBrains プラグイン。**IntelliJ Platform Gradle Plugin 2.x**
＋ **Kotlin** で実装。このディレクトリは自己完結したアプリで、ルートの monorepo
規約に従う（アプリ固有のコード・ドキュメント・ignore はここに置く）。

## 技術スタック

- Kotlin / JVM toolchain 17
- IntelliJ Platform Gradle Plugin `2.1.0`（`org.jetbrains.intellij.platform`）
- 対象: IntelliJ IDEA Community `2024.2`（`gradle.properties` で変更可）
- ビルド完了監視のため `com.intellij.java` バンドルプラグインに依存

## 主要ファイル

- `gradle.properties` — プラグイン座標・`platformVersion`・`sinceBuild/untilBuild`
- `build.gradle.kts` — 依存とプラグイン設定
- `src/main/resources/META-INF/plugin.xml` — 拡張・リスナー・アクション登録の中心
- `src/main/kotlin/com/yurakuseika/blackthunder/` — 実装本体

## 機能と実装の対応

| 機能 | 実装 |
|---|---|
| ご褒美通知 | `listeners/ThunderCompilationListener`（ビルド）, `listeners/ThunderTestListener`（テスト）→ `core/ThunderNotifier.reward` |
| がんばりカウンター | `core/ThunderStats`（`PersistentStateComponent`）+ `toolwindow/ThunderStatsPanel` |
| ランダム応援／名言 | `core/ThunderQuotes` + `startup/ThunderStartupActivity` + `actions/RandomCheerAction` |
| 見た目テーマ | `resources/theme/BlackThunder.theme.json` + `BlackThunder.xml`（`themeProvider`） |
| ザクザク音 | `core/ThunderSound`（`javax.sound.sampled` で `resources/sounds/crunch.wav` を再生）。保存時は `ThunderSaveTracker` から、手動は `actions/CrunchAction`。ON/OFF は `core/ThunderSettings` + `settings/ThunderConfigurable`。音源は VSCode 版 `media/pixta_138184860.wav` を 16bit/44.1kHz mono PCM に変換したもの |

## よく使うコマンド

```bash
./gradlew runIde        # サンドボックス IDE で動作確認
./gradlew buildPlugin   # 配布 zip を build/distributions/ に生成
./gradlew verifyPlugin  # plugin.xml と互換性の検証
```

## 注意点

- 通知グループ ID は `BlackThunder`（`plugin.xml` の `notificationGroup` と
  `ThunderNotifier` で一致させること）。
- ポイント配分・換算は `ThunderStats.Points` に集約。値を変えるならここ。
- `ThunderStats` はアプリレベルの light service（`@Service(Service.Level.APP)`）。
  plugin.xml への登録は不要。
- 統計の永続化先は `blackThunderStats.xml`（`@State` の storage 名）。
- `JAVA_HOME`/`java` が無いと `./gradlew` は動かない（JDK 17+ が必要）。
