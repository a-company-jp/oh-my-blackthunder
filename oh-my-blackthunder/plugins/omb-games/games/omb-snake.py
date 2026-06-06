#!/usr/bin/env python3
# =====================================================================
#  omb-snake  ―  oh my black のザクザク・スネーク
#  ザク(チョコ)を食べて伸びる。たまに出る ⚡ はボーナス＋加速。
#  操作:  ↑↓←→ / w a s d / h j k l 移動,  r リスタート,  q 終了
#  壁・自分にぶつかると終了。
# =====================================================================
import curses
import locale
import random


def setup_locale():
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
    curses.start_color()
    curses.use_default_colors()
    if curses.COLORS >= 256:
        curses.init_pair(1, 220, -1)   # 金（体/枠）
        curses.init_pair(2, 51, -1)    # シアン（ザク）
        curses.init_pair(3, 203, -1)   # 赤
        curses.init_pair(4, 213, -1)   # 桃（⚡ボーナス）
    else:
        curses.init_pair(1, curses.COLOR_YELLOW, -1)
        curses.init_pair(2, curses.COLOR_CYAN, -1)
        curses.init_pair(3, curses.COLOR_RED, -1)
        curses.init_pair(4, curses.COLOR_MAGENTA, -1)
    GOLD = curses.color_pair(1) | curses.A_BOLD
    ZAKU = curses.color_pair(2) | curses.A_BOLD
    RED = curses.color_pair(3) | curses.A_BOLD
    BONUS = curses.color_pair(4) | curses.A_BOLD | curses.A_BOLD

    top, left = 2, 1

    def base_delay(st):
        # 食べるほど速く（120ms → 最速55ms）。⚡中はさらに加速。
        d = max(55, 120 - st["score"] // 2)
        return max(40, d - 30) if st["boost"] > 0 else d

    def place_food(st, bonus=False):
        cells = st["snake_set"]
        free = [(y, x)
                for y in range(top, st["bottom"] + 1)
                for x in range(left, st["right"] + 1)
                if (y, x) not in cells]
        if not free:
            st["state"] = "win"
            return
        st["food"] = random.choice(free)
        st["food_bonus"] = bonus

    def new_game():
        H, W = stdscr.getmaxyx()
        if W < 30 or H < 12:
            return {"state": "toosmall", "H": H, "W": W}
        bottom, right = H - 2, W - 2
        cy, cx = (top + bottom) // 2, (left + right) // 2
        snake = [(cy, cx - i) for i in range(3)]   # 頭が先頭
        st = {
            "H": H, "W": W, "top": top, "left": left,
            "bottom": bottom, "right": right,
            "snake": snake, "snake_set": set(snake),
            "dir": (0, 1), "pending": (0, 1),
            "score": 0, "boost": 0, "eaten": 0,
            "state": "play",
        }
        place_food(st)
        return st

    st = new_game()
    stdscr.timeout(120)

    while True:
        ch = stdscr.getch()
        if ch in (ord("q"), ord("Q")):
            return
        if ch == curses.KEY_RESIZE:
            st = new_game()
            stdscr.timeout(120)
            continue
        if st["state"] == "toosmall":
            stdscr.erase()
            for i, m in enumerate(["端末が小さすぎます",
                                   "幅30 × 高さ12 以上にしてください", "(q で終了)"]):
                safe_add(stdscr, st["H"] // 2 + i, max(0, (st["W"] - len(m)) // 2),
                         m, RED if i == 0 else GOLD)
            stdscr.refresh()
            continue

        dy, dx = st["dir"]
        if ch in (curses.KEY_UP, ord("w"), ord("k")) and dy == 0:
            st["pending"] = (-1, 0)
        elif ch in (curses.KEY_DOWN, ord("s"), ord("j")) and dy == 0:
            st["pending"] = (1, 0)
        elif ch in (curses.KEY_LEFT, ord("a"), ord("h")) and dx == 0:
            st["pending"] = (0, -1)
        elif ch in (curses.KEY_RIGHT, ord("d"), ord("l")) and dx == 0:
            st["pending"] = (0, 1)
        elif ch in (ord("r"), ord("R")) and st["state"] in ("over", "win"):
            st = new_game()
            stdscr.timeout(120)
            continue

        if st["state"] == "play":
            st["dir"] = st["pending"]
            dy, dx = st["dir"]
            hy, hx = st["snake"][0]
            ny, nx = hy + dy, hx + dx
            # 壁・自己衝突（尻尾は次に空くが簡単のため衝突扱い）
            if (ny < top or ny > st["bottom"] or nx < left or nx > st["right"]
                    or (ny, nx) in st["snake_set"]):
                st["state"] = "over"
            else:
                st["snake"].insert(0, (ny, nx))
                st["snake_set"].add((ny, nx))
                if (ny, nx) == st["food"]:
                    bonus = st.get("food_bonus", False)
                    st["score"] += 5 if bonus else 1
                    st["eaten"] += 1
                    if bonus:
                        st["boost"] = 40          # ⚡加速フレーム数
                    # 5個ごとに次はボーナス(⚡)
                    place_food(st, bonus=(st["eaten"] % 5 == 4))
                else:
                    tail = st["snake"].pop()
                    st["snake_set"].discard(tail)
            if st["boost"] > 0:
                st["boost"] -= 1
            stdscr.timeout(base_delay(st))

        # ---- 描画 ----
        stdscr.erase()
        W, H = st["W"], st["H"]
        hud = " OMB SNAKE 🍫   score:%d   長さ:%d   %s   [↑↓←→/wasd  r  q]" % (
            st["score"], len(st["snake"]), "⚡BOOST!" if st["boost"] > 0 else "")
        safe_add(stdscr, 0, 1, hud, GOLD)
        # 枠
        safe_add(stdscr, top - 1, left, "┌" + "─" * (st["right"] - left) + "┐", GOLD)
        safe_add(stdscr, st["bottom"] + 1, left, "└" + "─" * (st["right"] - left) + "┘", GOLD)
        for y in range(top, st["bottom"] + 1):
            safe_add(stdscr, y, left, "│", GOLD)
            safe_add(stdscr, y, st["right"] + 1, "│", GOLD)
        # ザク（エサ）
        fy, fx = st["food"]
        if st.get("food_bonus"):
            safe_add(stdscr, fy, fx, "⚡", BONUS)
        else:
            safe_add(stdscr, fy, fx, "◆", ZAKU)
        # スネーク
        for i, (y, x) in enumerate(st["snake"]):
            safe_add(stdscr, y, x, "◉" if i == 0 else "█", GOLD)
        if st["state"] == "over":
            for i, m in enumerate(["", " しけったか… GAME OVER ", " r で再挑戦 / q で終了 "]):
                safe_add(stdscr, H // 2 - 1 + i, max(1, (W - len(m)) // 2), m, RED)
        elif st["state"] == "win":
            for i, m in enumerate(["", " ⚡ 完全制覇!! イナズマ級!! ⚡ ", " r でもう一回 / q で終了 "]):
                safe_add(stdscr, H // 2 - 1 + i, max(1, (W - len(m)) // 2), m, GOLD)
        stdscr.refresh()


def main():
    setup_locale()
    curses.wrapper(play)


if __name__ == "__main__":
    main()
