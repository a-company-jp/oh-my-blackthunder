# 開発ガイド（Oh My Black Thunder for JetBrains）

このプラグインの開発・ビルドに関するメモです。ユーザー向けの概要・使い方・
インストールは [README.md](./README.md) を参照してください。

## 前提

JDK 17 以上が必要です。Gradle Wrapper を同梱しているので、Gradle 本体の
インストールは不要です。

## よく使うコマンド

```bash
# サンドボックス IDE を起動してプラグインを試す
./gradlew runIde

# プラグイン zip をビルド（build/distributions/ に出力）
./gradlew buildPlugin

# plugin.xml / 互換性の検証
./gradlew verifyPlugin
```

ビルドした `build/distributions/*.zip` は、IDE の
`Settings → Plugins → ⚙ → Install Plugin from Disk...` から手動インストールできます。
