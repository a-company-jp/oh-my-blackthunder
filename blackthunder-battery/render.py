#!/usr/bin/env python3
"""ブラックサンダーのチョコ画像を、バッテリー残量に応じて描画する。
残量ぶんだけ左にチョコが残り、消費したぶん(右側)は食べられて薄くなる。
出力: メニューバー用 PNG の base64 文字列(1行)。

usage: render.py <percent 0-100> <charging 0|1>
"""
import sys
import io
import base64
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CHOCOLATE = os.path.join(HERE, "chocolate.png")

# メニューバー表示サイズ(高さpx)。低すぎると潰れるので少し大きめに。
BAR_H = 22


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def main():
    pct = clamp(int(sys.argv[1]) if len(sys.argv) > 1 else 100, 0, 100)
    charging = len(sys.argv) > 2 and sys.argv[2] == "1"

    src = Image.open(CHOCOLATE).convert("RGBA")
    w = round(src.width * BAR_H / src.height)
    bar = src.resize((w, BAR_H), Image.LANCZOS)

    fill = round(w * pct / 100)  # 残っているチョコの幅

    canvas = Image.new("RGBA", (w, BAR_H), (0, 0, 0, 0))

    # 残っている部分(左): そのまま
    if fill > 0:
        canvas.paste(bar.crop((0, 0, fill, BAR_H)), (0, 0))

    # 食べられた部分(右): グレースケール化 + 半透明で「空き」を表現
    if fill < w:
        eaten = bar.crop((fill, 0, w, BAR_H))
        gray = eaten.convert("L").convert("RGBA")
        a = eaten.split()[3].point(lambda x: int(x * 0.22))
        gray.putalpha(a)
        canvas.alpha_composite(gray, (fill, 0))

    # 残量が少ないと食べかけの境界に赤いラインを出して警告感
    if pct <= 20 and 0 < fill < w:
        d = ImageDraw.Draw(canvas)
        d.line([(fill, 0), (fill, BAR_H)], fill=(230, 40, 40, 255), width=1)

    # 充電中は黄色い稲妻(サンダー)を中央に重ねる
    if charging:
        d = ImageDraw.Draw(canvas)
        cx = w // 2
        bolt = [
            (cx + 2, 2), (cx - 4, BAR_H // 2 + 1), (cx, BAR_H // 2 + 1),
            (cx - 2, BAR_H - 2), (cx + 5, BAR_H // 2 - 2), (cx + 1, BAR_H // 2 - 2),
        ]
        d.polygon(bolt, fill=(255, 214, 10, 255), outline=(40, 40, 40, 255))

    buf = io.BytesIO()
    canvas.save(buf, "PNG")
    sys.stdout.write(base64.b64encode(buf.getvalue()).decode())


if __name__ == "__main__":
    main()
