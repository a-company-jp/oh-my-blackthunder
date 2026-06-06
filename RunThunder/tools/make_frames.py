#!/usr/bin/env python3
"""ブラックサンダーのパッケージ1枚絵から、メニューバー用の
「上下バウンド＋傾き」コマ送りアニメPNGを生成する。

使い方:
    python3 tools/make_frames.py <元画像> [出力ディレクトリ]
既定の出力先は Resources/Frames/
"""
import sys
import math
from pathlib import Path
from PIL import Image

# ---- 調整パラメータ ----
WORK_HEIGHT = 220        # 処理時の高さ(px)。元画像は巨大なので縮小してから処理
FRAME_COUNT = 12         # 生成するコマ数（多いほど波が滑らか）
MAX_ROTATE_DEG = 11.0    # 揺れの最大角度
BOB_RATIO = 0.16         # スプライト高さに対する上下バウンド量
WHITE_THRESHOLD = 236    # これ以上明るい(=白背景)を透過対象にする


def load_and_shrink(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    scale = WORK_HEIGHT / h
    return img.resize((max(1, round(w * scale)), WORK_HEIGHT), Image.LANCZOS)


def is_white(px) -> bool:
    r, g, b, a = px
    return a > 0 and r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD


def remove_background(img: Image.Image) -> Image.Image:
    """四隅から繋がった白だけを透過。ロゴ内部の白は残す（縁からの flood fill）。"""
    w, h = img.size
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    stack = []

    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        if not is_white(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)  # 透過
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return img


def autocrop(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def build_frames(sprite: Image.Image):
    w, h = sprite.size
    rad = math.radians(MAX_ROTATE_DEG)
    bob = max(1, round(h * BOB_RATIO))

    # 全コマで一定サイズになるキャンバスを確保（回転のはみ出し＋バウンド分）
    canvas_w = math.ceil(w * math.cos(rad) + h * math.sin(rad)) + 2
    canvas_h = math.ceil(w * math.sin(rad) + h * math.cos(rad)) + bob * 2 + 2

    frames = []
    for i in range(FRAME_COUNT):
        phase = 2 * math.pi * i / FRAME_COUNT
        angle = MAX_ROTATE_DEG * math.sin(phase)
        y_off = round(bob * math.sin(phase))

        rotated = sprite.rotate(angle, expand=True, resample=Image.BICUBIC)
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        x = (canvas_w - rotated.width) // 2
        y = (canvas_h - rotated.height) // 2 - y_off
        canvas.paste(rotated, (x, y), rotated)
        frames.append(canvas)
    return frames


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1]).expanduser()
    out_dir = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 \
        else Path(__file__).resolve().parent.parent / "Resources" / "Frames"
    out_dir.mkdir(parents=True, exist_ok=True)

    img = load_and_shrink(src)
    img = remove_background(img)
    sprite = autocrop(img)
    frames = build_frames(sprite)

    # 既存フレームを掃除
    for old in out_dir.glob("frame_*.png"):
        old.unlink()

    for i, frame in enumerate(frames):
        frame.save(out_dir / f"frame_{i:02d}.png")

    print(f"wrote {len(frames)} frames to {out_dir} (sprite {sprite.size}, canvas {frames[0].size})")


if __name__ == "__main__":
    main()
