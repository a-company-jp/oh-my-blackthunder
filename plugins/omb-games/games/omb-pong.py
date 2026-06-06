#!/usr/bin/env python3
# =====================================================================
#  omb-pong  ―  oh my black の稲妻ピンポン
#  稲妻の玉を打ち合う1人用ピンポン（左:あなた / 右:CPU）。
#  操作:  ↑↓ / w s / k j 移動,  space サーブ,  r リスタート,  q 終了
#  先に WIN_SCORE 点で勝ち。
# =====================================================================
import curses
import locale
import math
import os
import random

WIN_SCORE = 7        # 先取で勝ち
SPEED = 1.0          # 玉の速さ（セル/フレーム）
MAX_BOUNCE = 1.0     # パドル端の最大反射角（rad, 水平基準。約57°）
PADDLE_H = 5         # パドルの高さ
CPU_SPEED = 0.8      # CPU の追従速度（小さいほど弱い＝勝ちやすい）


def setup_locale():
    """ncurses が UTF-8 を描画できるロケールを確定（LANG が空でも UTF-8 を強制）。"""
    for loc in ("en_US.UTF-8", "C.UTF-8", "", "ja_JP.UTF-8", "UTF-8"):
        try:
            locale.setlocale(locale.LC_ALL, loc)
        except locale.Error:
            continue
        if (locale.nl_langinfo(locale.CODESET) or "").upper().replace("-", "") == "UTF8":
            return


def safe_add(scr, y, x, s, attr=0):
    h, w = scr.getmaxyx()
    if y < 0 or y >= h or x < 0 or x >= w:
        return
    s = s[: w - x]
    try:
        scr.addstr(y, x, s, attr)
    except curses.error:
        pass


def play(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(40)
    curses.start_color()
    curses.use_default_colors()
    if curses.COLORS >= 256:
        curses.init_pair(1, 220, -1)   # 金（パドル/枠）
        curses.init_pair(2, 51, -1)    # シアン（玉）
        curses.init_pair(3, 203, -1)   # 赤
    else:
        curses.init_pair(1, curses.COLOR_YELLOW, -1)
        curses.init_pair(2, curses.COLOR_CYAN, -1)
        curses.init_pair(3, curses.COLOR_RED, -1)
    GOLD = curses.color_pair(1) | curses.A_BOLD
    BALL = curses.color_pair(2) | curses.A_BOLD | curses.A_REVERSE
    RED = curses.color_pair(3) | curses.A_BOLD

    PX = 2               # プレイヤー（左）パドルの x
    top = 2              # フィールド上端（HUD の下）

    def new_game():
        H, W = stdscr.getmaxyx()
        if W < 40 or H < 12:
            return {"state": "toosmall", "H": H, "W": W}
        st = {
            "H": H, "W": W, "cpx": W - 3, "top": top, "bottom": H - 2,
            "p_y": (H - PADDLE_H) // 2, "c_y": (H - PADDLE_H) // 2,
            "ps": 0, "cs": 0, "state": "serve",
        }
        serve(st, random.choice([-1, 1]))
        return st

    def serve(st, direction):
        st["fx"] = st["W"] / 2.0
        st["fy"] = (st["top"] + st["bottom"]) / 2.0
        ang = random.uniform(-0.6, 0.6)             # 水平からの角度
        st["vx"] = direction * SPEED * math.cos(ang)
        st["vy"] = SPEED * math.sin(ang)
        st["state"] = "serve"
        st["serve_dir"] = direction

    def hit_paddle(st, paddle_y, py_top):
        """パドル中心からのズレで反射角を決める。"""
        half = PADDLE_H / 2.0
        rel = max(-1.0, min(1.0, (st["fy"] - (py_top + half)) / half))
        ang = rel * MAX_BOUNCE
        vx_dir = 1 if st["vx"] < 0 else -1          # 反対方向へ
        st["vx"] = vx_dir * SPEED * math.cos(ang)
        st["vy"] = SPEED * math.sin(ang)

    st = new_game()

    while True:
        ch = stdscr.getch()
        if ch in (ord("q"), ord("Q")):
            return
        if ch == curses.KEY_RESIZE:
            st = new_game()
            continue
        if st["state"] == "toosmall":
            stdscr.erase()
            for i, m in enumerate(["端末が小さすぎます",
                                   "幅40 × 高さ12 以上にしてください",
                                   "(q で終了)"]):
                safe_add(stdscr, st["H"] // 2 + i, max(0, (st["W"] - len(m)) // 2),
                         m, RED if i == 0 else GOLD)
            stdscr.refresh()
            continue

        # 入力
        if ch in (curses.KEY_UP, ord("w"), ord("k")):
            st["p_y"] = max(st["top"], st["p_y"] - 2)
        elif ch in (curses.KEY_DOWN, ord("s"), ord("j")):
            st["p_y"] = min(st["bottom"] - PADDLE_H, st["p_y"] + 2)
        elif ch == ord(" ") and st["state"] == "serve":
            st["state"] = "play"
        elif ch in (ord("r"), ord("R")) and st["state"] in ("win", "over"):
            st = new_game()

        # CPU 追従（玉を中心で追う。CPU_SPEED で弱体化）
        if st["state"] in ("play", "serve"):
            target = st["fy"] - PADDLE_H / 2.0
            if st["c_y"] + 0.5 < target:
                st["c_y"] = min(st["bottom"] - PADDLE_H, st["c_y"] + CPU_SPEED)
            elif st["c_y"] - 0.5 > target:
                st["c_y"] = max(st["top"], st["c_y"] - CPU_SPEED)

        if st["state"] == "serve":
            # サーブ待ち：玉は中央でホバー
            pass
        elif st["state"] == "play":
            steps = max(1, int(math.ceil(SPEED)))
            dx, dy = st["vx"] / steps, st["vy"] / steps
            for _ in range(steps):
                st["fx"] += dx
                st["fy"] += dy
                # 上下の壁
                if st["fy"] <= st["top"]:
                    st["fy"] = float(st["top"]); st["vy"] = abs(st["vy"]); dy = abs(dy)
                elif st["fy"] >= st["bottom"]:
                    st["fy"] = float(st["bottom"]); st["vy"] = -abs(st["vy"]); dy = -abs(dy)
                bx = int(round(st["fx"]))
                # プレイヤー（左）パドル
                if st["vx"] < 0 and bx <= PX + 1 and \
                        st["p_y"] <= st["fy"] <= st["p_y"] + PADDLE_H:
                    st["fx"] = float(PX + 1)
                    hit_paddle(st, st["fy"], st["p_y"])
                    dx, dy = st["vx"] / steps, st["vy"] / steps
                # CPU（右）パドル
                elif st["vx"] > 0 and bx >= st["cpx"] - 1 and \
                        int(st["c_y"]) <= st["fy"] <= int(st["c_y"]) + PADDLE_H:
                    st["fx"] = float(st["cpx"] - 1)
                    hit_paddle(st, st["fy"], int(st["c_y"]))
                    dx, dy = st["vx"] / steps, st["vy"] / steps
                # 得点
                if st["fx"] < 1:
                    st["cs"] += 1
                    _after_point(st, -1)
                    break
                elif st["fx"] > st["W"] - 2:
                    st["ps"] += 1
                    _after_point(st, 1)
                    break

        # ---- 描画 ----
        stdscr.erase()
        W, H = st["W"], st["H"]
        hud = " OMB PONG ⚡   あなた %d - %d CPU   (先に%d点)   [↑↓/w s  space  q]" % (
            st["ps"], st["cs"], WIN_SCORE)
        safe_add(stdscr, 0, 1, hud, GOLD)
        # センターライン
        for y in range(st["top"], st["bottom"] + 1, 2):
            safe_add(stdscr, y, W // 2, "┊", GOLD)
        # パドル
        for i in range(PADDLE_H):
            safe_add(stdscr, st["p_y"] + i, PX, "█", GOLD)
            safe_add(stdscr, int(st["c_y"]) + i, st["cpx"], "█", GOLD)
        # 玉
        safe_add(stdscr, int(round(st["fy"])), int(round(st["fx"])), "●", BALL)
        if st["state"] == "serve":
            m = "space でサーブ ⚡"
            safe_add(stdscr, H // 2, max(1, (W - len(m)) // 2), m, GOLD)
        elif st["state"] == "win":
            for i, m in enumerate(["", " ⚡ イナズマ級の勝利!! ⚡ ", " r でもう一回 / q で終了 "]):
                safe_add(stdscr, H // 2 - 1 + i, max(1, (W - len(m)) // 2), m, GOLD)
        elif st["state"] == "over":
            for i, m in enumerate(["", " 敗北… しけったか。 ", " r で再戦 / q で終了 "]):
                safe_add(stdscr, H // 2 - 1 + i, max(1, (W - len(m)) // 2), m, RED)
        stdscr.refresh()


def _after_point(st, scorer):
    """得点後：勝敗判定 or サーブへ。scorer=1:プレイヤー / -1:CPU。"""
    if st["ps"] >= WIN_SCORE:
        st["state"] = "win"
    elif st["cs"] >= WIN_SCORE:
        st["state"] = "over"
    else:
        # 失点した側に向けてサーブ
        st["fx"] = st["W"] / 2.0
        st["fy"] = (st["top"] + st["bottom"]) / 2.0
        ang = random.uniform(-0.6, 0.6)
        st["vx"] = scorer * SPEED * math.cos(ang)
        st["vy"] = SPEED * math.sin(ang)
        st["state"] = "serve"


def main():
    setup_locale()
    curses.wrapper(play)


if __name__ == "__main__":
    main()
