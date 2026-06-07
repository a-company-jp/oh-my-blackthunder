# 開発ガイド（ブラックサンダー VSCode 拡張）

この拡張の開発・ビルドに関するメモです。ユーザー向けの概要・使い方・
インストールは [README.md](./README.md) を参照してください。

## 開発・実行

```bash
npm install
npm run watch        # 別ターミナルで watch ビルド
```

VSCode でこのフォルダを開き、`F5`（Run Extension）で拡張機能ホストを起動して
動作確認できます。

## パッケージ化（.vsix の作成）

```bash
npm install -g @vscode/vsce
vsce package
```

> `package.json` の `publisher` を自分の Publisher ID に書き換えてからパッケージ化して
> ください。マーケットプレイスのアイコン `media/icon.png` は仮のものなので、必要に
> 応じて差し替えてください。
