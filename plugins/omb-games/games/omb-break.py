#!/usr/bin/env python3
# =====================================================================
#  omb-break  ―  oh my black のブロック崩し
#  ブラックサンダーのAAを端末サイズに縮小し、1セル=1ブロックで砕く。
#  使い方:  python3 omb-break.py [path/to/ascii.txt]
#  操作:    ← → / a d 移動,  space リスタート,  q 終了
# =====================================================================
import curses
import locale
import math
import os
import sys
import random
import unicodedata

DEFAULT_ART = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "blackthunder_ascii.txt"
)

SPEED = 1.0          # ボール速度（セル/フレーム）
MAX_BOUNCE = 1.05    # パドル端で反射する最大角（rad, 真上基準。約60°）
LAUNCH_ANGLE = (0.61, 0.96)  # 発射角の範囲（rad, 真上基準。約35°〜55°）。左右はランダム


def setup_locale():
    """ncurses が UTF-8（█ ● ▀ や日本語）を正しく描画できるロケールを選ぶ。
    LANG が空/C の環境でも UTF-8 を強制する。曖昧幅文字を1セルにするため
    非CJKのUTF-8ロケールを優先（ボールやブロックの桁ずれ防止）。"""
    for loc in ("en_US.UTF-8", "C.UTF-8", "", "ja_JP.UTF-8", "UTF-8"):
        try:
            locale.setlocale(locale.LC_ALL, loc)
        except locale.Error:
            continue
        codeset = (locale.nl_langinfo(locale.CODESET) or "").upper().replace("-", "")
        if codeset == "UTF8":
            return True
    return False


def disp_width(s):
    """端末上の表示桁数（全角=2, 半角=1）。"""
    w = 0
    for ch in s:
        w += 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
    return w


def clip_to_width(s, max_w):
    """表示幅が max_w を超えないように切り詰める。"""
    if max_w <= 0:
        return ""
    out, used = [], 0
    for ch in s:
        cw = 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
        if used + cw > max_w:
            break
        out.append(ch)
        used += cw
    return "".join(out)


def load_art(path):
    with open(path, encoding="utf-8") as fh:
        lines = [ln.rstrip("\n") for ln in fh]
    # 上下の空行を除去
    while lines and not lines[-1].strip():
        lines.pop()
    while lines and not lines[0].strip():
        lines.pop(0)
    if not lines:
        return [""], 1, 1
    # 左右の共通余白を除去して「絵の実寸(bbox)」に切り詰める
    left = min(len(ln) - len(ln.lstrip(" ")) for ln in lines if ln.strip())
    right = max(len(ln.rstrip(" ")) for ln in lines)
    lines = [ln[left:right] for ln in lines]
    w = max((len(ln) for ln in lines), default=0)
    return [ln.ljust(w) for ln in lines], w, len(lines)


def scale_art(lines, sw, sh, tw, th):
    """AA を tw×th に縮小した文字グリッドを返す。
    各セルは元領域の代表文字（最頻の非空白）。█ の塊ではなく元の文字で描くので
    縮小しても絵が分かる。tw==sw,th==sh のときは原寸そのまま。"""
    tw = max(1, min(tw, sw))
    th = max(1, min(th, sh))
    grid = [[" "] * tw for _ in range(th)]
    for ty in range(th):
        y0 = ty * sh // th
        y1 = max(y0 + 1, (ty + 1) * sh // th)
        for tx in range(tw):
            x0 = tx * sw // tw
            x1 = max(x0 + 1, (tx + 1) * sw // tw)
            counts = {}
            for sy in range(y0, y1):
                row = lines[sy]
                for sx in range(x0, min(x1, len(row))):
                    c = row[sx]
                    if c != " ":
                        counts[c] = counts.get(c, 0) + 1
            if counts:
                grid[ty][tx] = max(counts, key=counts.get)
    return grid


def safe_add(scr, y, x, s, attr=0):
    h, w = scr.getmaxyx()
    if y < 0 or y >= h:
        return
    if x < 0:
        s = s[-x:]
        x = 0
    if x >= w:
        return
    s = clip_to_width(s, w - x)
    try:
        scr.addstr(y, x, s, attr)
    except curses.error:
        pass


def play(stdscr, art_path):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(45)
    curses.start_color()
    curses.use_default_colors()
    if curses.COLORS >= 256:
        curses.init_pair(1, 220, -1)   # 金（ブロック=AA）
        curses.init_pair(2, 51, -1)    # 明るいシアン（ボール／金のAAと被らない）
        curses.init_pair(3, 178, -1)   # 渋い金（パドル）
        curses.init_pair(4, 203, -1)   # 赤
    else:
        curses.init_pair(1, curses.COLOR_YELLOW, -1)
        curses.init_pair(2, curses.COLOR_CYAN, -1)
        curses.init_pair(3, curses.COLOR_YELLOW, -1)
        curses.init_pair(4, curses.COLOR_RED, -1)
    GOLD = curses.color_pair(1) | curses.A_BOLD
    BALL = curses.color_pair(2) | curses.A_BOLD | curses.A_REVERSE  # 反転でどんな背景でも見える
    PAD = curses.color_pair(3) | curses.A_BOLD
    RED = curses.color_pair(4) | curses.A_BOLD

    lines, sw, sh = load_art(art_path)

    def new_game():
        H, W = stdscr.getmaxyx()
        offy = 2  # HUD の下から AA を配置
        if W < 20 or H < 12:   # さすがに無理なサイズだけ案内
            return {"state": "toosmall", "H": H, "W": W,
                    "need_w": 20, "need_h": 12}
        # 端末に収まる最大サイズへ一様縮小（縦横比維持・拡大はしない＝最大で原寸）
        avail_w = max(1, W - 2)
        avail_h = max(1, H - offy - 4)   # HUD と 下部パドル/ボール領域を確保
        factor = min(1.0, avail_w / sw, avail_h / sh)
        tw = max(1, min(sw, round(sw * factor)))
        th = max(1, min(sh, round(sh * factor)))
        bricks = scale_art(lines, sw, sh, tw, th)
        bw, bh = len(bricks[0]), len(bricks)
        offx = max(1, (W - bw) // 2)       # 横中央に配置
        total = sum(1 for r in bricks for c in r if c != " ")
        pw = max(6, min(W // 9, bw))
        st = {
            "H": H, "W": W, "offx": offx, "offy": offy,
            "bricks": bricks, "bw": bw, "bh": bh,
            "remaining": total, "total": total, "score": 0, "lives": 3,
            "pw": pw, "px": (W - pw) // 2, "py": H - 2,
            "state": "play",
        }
        reset_ball(st)
        return st

    def reset_ball(st):
        st["fx"] = float(st["px"] + st["pw"] // 2)
        st["fy"] = float(st["py"] - 1)
        # 最初から斜めに発射（左右ランダム＋指定範囲の角度）
        ang = random.choice([-1, 1]) * random.uniform(*LAUNCH_ANGLE)
        st["vx"] = SPEED * math.sin(ang)
        st["vy"] = -SPEED * math.cos(ang)
        st["bx"] = int(round(st["fx"]))
        st["by"] = int(round(st["fy"]))
        st["launched"] = False

    def brick_at(st, col, row):
        bi = row - st["offy"]
        bj = col - st["offx"]
        if 0 <= bi < st["bh"] and 0 <= bj < st["bw"] and st["bricks"][bi][bj] != " ":
            return bi, bj
        return None

    def destroy(st, bi, bj):
        st["bricks"][bi][bj] = " "
        st["remaining"] -= 1
        st["score"] += 10

    st = new_game()

    while True:
        ch = stdscr.getch()
        if ch in (ord("q"), ord("Q")):
            return
        if ch == curses.KEY_RESIZE:
            st = new_game()          # 端末リサイズで作り直し（収まれば自動復帰）
        elif st["state"] == "toosmall":
            pass                     # 案内表示のみ。リサイズ待ち。
        elif ch in (curses.KEY_LEFT, ord("a"), ord("h")):
            st["px"] = max(1, st["px"] - 3)
        elif ch in (curses.KEY_RIGHT, ord("d"), ord("l")):
            st["px"] = min(st["W"] - st["pw"] - 1, st["px"] + 3)
        elif ch == ord(" "):
            if st["state"] in ("win", "over"):
                st = new_game()
            else:
                st["launched"] = True

        if st["state"] == "play":
            if not st["launched"]:
                # 発射前はパドルの上に乗せて追従
                st["fx"] = float(st["px"] + st["pw"] // 2)
                st["fy"] = float(st["py"] - 1)
                st["bx"] = int(round(st["fx"]))
                st["by"] = int(round(st["fy"]))
            else:
                # 1セル以下ずつ進めてトンネリングを防ぐ（X軸→Y軸を別々に判定）
                steps = max(1, int(math.ceil(SPEED)))
                dx, dy = st["vx"] / steps, st["vy"] / steps
                for _ in range(steps):
                    # --- X軸 ---
                    oldcx = int(round(st["fx"]))
                    st["fx"] += dx
                    ncx = int(round(st["fx"]))
                    cy = int(round(st["fy"]))
                    if ncx < 1:                       # 左の壁
                        st["fx"] = 1.0
                        st["vx"] = abs(st["vx"]); dx = abs(dx)
                    elif ncx > st["W"] - 2:           # 右の壁
                        st["fx"] = float(st["W"] - 2)
                        st["vx"] = -abs(st["vx"]); dx = -abs(dx)
                    elif ncx != oldcx:                # ブロック（横方向）
                        hit = brick_at(st, ncx, cy)
                        if hit:
                            destroy(st, *hit)
                            st["fx"] = float(oldcx)
                            st["vx"] = -st["vx"]; dx = -dx
                    # --- Y軸 ---
                    oldcy = int(round(st["fy"]))
                    st["fy"] += dy
                    ncy = int(round(st["fy"]))
                    cx = int(round(st["fx"]))
                    if ncy < 1:                       # 上の壁
                        st["fy"] = 1.0
                        st["vy"] = abs(st["vy"]); dy = abs(dy)
                    elif ncy != oldcy:                # ブロック（縦方向）
                        hit = brick_at(st, cx, ncy)
                        if hit:
                            destroy(st, *hit)
                            st["fy"] = float(oldcy)
                            st["vy"] = -st["vy"]; dy = -dy

                # --- パドル反射（当たった位置で角度が変わる）---
                cx, cy = int(round(st["fx"])), int(round(st["fy"]))
                if st["vy"] > 0 and cy >= st["py"] - 1 and \
                        st["px"] <= cx < st["px"] + st["pw"]:
                    half = max(1.0, st["pw"] / 2.0)
                    rel = max(-1.0, min(1.0, (cx - (st["px"] + half)) / half))
                    ang = rel * MAX_BOUNCE            # 端ほど浅く、中央ほど真上
                    st["vx"] = SPEED * math.sin(ang)
                    st["vy"] = -SPEED * math.cos(ang)
                    st["fy"] = float(st["py"] - 1)

                # --- 落下（ミス）---
                if int(round(st["fy"])) > st["py"]:
                    st["lives"] -= 1
                    if st["lives"] <= 0:
                        st["state"] = "over"
                    else:
                        reset_ball(st)

                st["bx"] = int(round(st["fx"]))
                st["by"] = int(round(st["fy"]))
            if st["remaining"] <= 0:
                st["state"] = "win"

        # ---- 描画 ----
        stdscr.erase()
        W = st["W"]
        if st["state"] == "toosmall":
            msgs = [
                "端末が小さすぎて AA が潰れてしまいます",
                "必要サイズ:  幅 %d 桁 × 高さ %d 行" % (st["need_w"], st["need_h"]),
                "現在サイズ:  幅 %d 桁 × 高さ %d 行" % (st["W"], st["H"]),
                "ウィンドウを広げる / フォントを小さくしてください",
                "(自動で再開します。  q で終了)",
            ]
            top = max(0, st["H"] // 2 - len(msgs) // 2)
            for i, m in enumerate(msgs):
                safe_add(stdscr, top + i, max(0, (W - disp_width(m)) // 2),
                         m, RED if i == 0 else GOLD)
            stdscr.refresh()
            continue
        hud = " OMB BREAKER   score:%d   bricks:%d/%d   lives:%d   [<- ->/a d  space  q]" % (
            st["score"], st["remaining"], st["total"], st["lives"],
        )
        safe_add(stdscr, 0, 1, hud[: W - 2], GOLD)
        # AA をそのまま描画（残っている文字＝まだ壊れていないブロック）
        for bi in range(st["bh"]):
            row = "".join(st["bricks"][bi]).rstrip()
            if row:
                safe_add(stdscr, st["offy"] + bi, st["offx"], row, GOLD)
        safe_add(stdscr, st["py"], st["px"], "▀" * st["pw"], PAD)
        if st["state"] in ("play",):
            safe_add(stdscr, st["by"], st["bx"], "●", BALL)
            if not st["launched"]:
                msg = "space で発射 ⚡"
                safe_add(stdscr, st["py"] - 2, max(1, (W - disp_width(msg)) // 2), msg, GOLD)
        elif st["state"] == "win":
            for i, m in enumerate(["", "  ザクッ!!  完 全 崩 壊 !!  ", "  起動イナズマ級のクリア。space でもう一回 ", ""]):
                safe_add(stdscr, st["H"] // 2 - 1 + i, max(1, (W - disp_width(m)) // 2), m, GOLD)
        elif st["state"] == "over":
            for i, m in enumerate(["", "  GAME OVER  ", "  しけったか…。space で再挑戦 ", ""]):
                safe_add(stdscr, st["H"] // 2 - 1 + i, max(1, (W - disp_width(m)) // 2), m, RED)
        stdscr.refresh()


def main():
    # curses(ncurses) を初期化する前に UTF-8 ロケールを確定させる。
    # これを忘れると █ ● ▀ や日本語がバイト分割されて潰れ・消失する。
    setup_locale()
    art = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ART
    if not os.path.exists(art):
        sys.exit("AAファイルが見つかりません: %s" % art)
    curses.wrapper(play, art)


if __name__ == "__main__":
    main()
