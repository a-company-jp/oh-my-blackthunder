# README の画像・デモ素材

ルート README は、プロジェクトの実際の録画・画面と、既存の BTDD ステッカーを使用しています。

| ファイル | 内容・出典 |
| --- | --- |
| `thundercaptcha-demo.gif` | [リポジトリ内の録画](../../github-chrome-extension-demo.mp4)の1.5秒から末尾まで。マージボタン、認証、チョコが降る演出を収録。 |
| `github-chrome-extension-demo.jpg` | 同じ録画の5秒地点を幅960pxで切り出した静止画。 |
| `runthunder-dashboard.png` | [RunThunder の README](../../RunThunder/README.md) に掲載済みの[スクリーンショット](https://github.com/user-attachments/assets/9f8f7efc-52e0-4459-a16a-989af8d60df6)。元画像を変更せず保存。 |
| `vscode-commits.png` | [VS Code の README](../../blackthunder-vscode/README.md) に掲載済みの[スクリーンショット](https://github.com/user-attachments/assets/88991114-290f-44b1-84d5-d9fddf407edd)。元画像を変更せず保存。 |
| `terminal-ai-usage.png` | [Zsh の README](../../oh-my-blackthunder/README.md) に掲載済みの[使用量表示](https://github.com/user-attachments/assets/65c53e12-dbc8-4b57-8107-cd1079fbbeab)。元画像を変更せず保存。 |

冒頭の BTDD ステッカーは [`web/public/assets/sticker/btdd.png`](../../web/public/assets/sticker/btdd.png) を直接参照しています。
RunThunder のバナーモックは実画面と区別するため掲載していません。

## GIF の再生成

リポジトリのルートで実行します。FFmpeg が必要です。
既存の出力ファイルがある場合は、FFmpeg が上書きするか確認します。

```sh
ffmpeg -hide_banner -loglevel error \
  -ss 1.5 -t 8.65 -i github-chrome-extension-demo.mp4 \
  -filter_complex '[0:v]fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle' \
  -loop 0 docs/images/thundercaptcha-demo.gif
```

約8.6秒・幅960px・12fps・128色のループ GIF です。約854 KiBに抑え、元のMP4は高画質版として残しています。
音声は GIF には含まれません。
