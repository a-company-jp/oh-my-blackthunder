#!/usr/bin/env python3
# =====================================================================
#  omb-drop  ―  oh my black のザクッ・ドロップ（落ちもの）
#  チョコ塊を積んで横一列そろえると「ザクッ」と崩れて消える。
#  操作:  ←→ 移動,  ↑/x 回転,  ↓ ソフトドロップ,  space ハードドロップ,
#         r リスタート,  q 終了
# =====================================================================
import curses
import locale
import random

COLS, ROWS = 10, 20      # 盤面（標準）

# 各テトロミノの初期セル（(行, 列)）
SHAPES = {
    "I": [(0, 0), (0, 1), (0, 2), (0, 3)],
    "O": [(0, 0), (0, 1), (1, 0), (1, 1)],
    "T": [(0, 0), (0, 1), (0, 2), (1, 1)],
    "S": [(0, 1), (0, 2), (1, 0), (1, 1)],
    "Z": [(0, 0), (0, 1), (1, 1), (1, 2)],
    "J": [(0, 0), (1, 0), (1, 1), (1, 2)],
    "L": [(0, 2), (1, 0), (1, 1), (1, 2)],
}
COLORS = {"I": 51, "O": 226, "T": 213, "S": 46, "Z": 203, "J": 33, "L": 220}
COLORS8 = {"I": curses.COLOR_CYAN, "O": curses.COLOR_YELLOW, "T": curses.COLOR_MAGENTA,
           "S": curses.COLOR_GREEN, "Z": curses.COLOR_RED, "J": curses.COLOR_BLUE,
           "L": curses.COLOR_YELLOW}


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


def normalize(cells):
    mr = min(r for r, c in cells)
    mc = min(c for r, c in cells)
    return [(r - mr, c - mc) for r, c in cells]


def rotate_cw(cells):
    # (r,c) -> (c, -r) を回転、その後 0 起点に正規化
    return normalize([(c, -r) for r, c in cells])


def play(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(50)
    curses.start_color()
    curses.use_default_colors()
    use256 = curses.COLORS >= 256
    pal = COLORS if use256 else COLORS8
    pair = {}
    for i, k in enumerate(SHAPES, start=1):
        curses.init_pair(i, pal[k], -1)
        pair[k] = curses.color_pair(i) | curses.A_BOLD
    curses.init_pair(8, 220 if use256 else curses.COLOR_YELLOW, -1)
    curses.init_pair(9, 203 if use256 else curses.COLOR_RED, -1)
    GOLD = curses.color_pair(8) | curses.A_BOLD
    RED = curses.color_pair(9) | curses.A_BOLD

    def collides(board, cells, oy, ox):
        for r, c in cells:
            y, x = oy + r, ox + c
            if x < 0 or x >= COLS or y >= ROWS:
                return True
            if y >= 0 and board[y][x]:
                return True
        return False

    def spawn(st):
        if not st["bag"]:
            st["bag"] = list(SHAPES.keys())
            random.shuffle(st["bag"])
        st["cur"] = st["bag"].pop()
        st["cells"] = normalize(SHAPES[st["cur"]])
        st["oy"], st["ox"] = -1, COLS // 2 - 2
        st["fall"] = 0
        if collides(st["board"], st["cells"], st["oy"], st["ox"]):
            st["state"] = "over"

    def lock_and_clear(st):
        for r, c in st["cells"]:
            y, x = st["oy"] + r, st["ox"] + c
            if 0 <= y < ROWS and 0 <= x < COLS:
                st["board"][y][x] = st["cur"]
        # 揃った行を消す
        full = [y for y in range(ROWS) if all(st["board"][y])]
        if full:
            for y in full:
                del st["board"][y]
                st["board"].insert(0, [None] * COLS)
            n = len(full)
            st["lines"] += n
            st["score"] += (0, 40, 100, 300, 1200)[n] * (st["level"] + 1)
            st["level"] = st["lines"] // 10
            st["flash"] = 4
        spawn(st)

    def new_game():
        H, W = stdscr.getmaxyx()
        # 盤面はセルを2文字幅で描く。必要: 幅 COLS*2+余白, 高さ ROWS+余白
        if W < COLS * 2 + 18 or H < ROWS + 3:
            return {"state": "toosmall", "H": H, "W": W}
        st = {
            "H": H, "W": W,
            "boardx": (W - (COLS * 2 + 16)) // 2 + 2,
            "boardy": max(1, (H - ROWS) // 2),
            "board": [[None] * COLS for _ in range(ROWS)],
            "bag": [], "score": 0, "lines": 0, "level": 0,
            "flash": 0, "state": "play",
        }
        spawn(st)
        return st

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
                                   "幅%d × 高さ%d 以上にしてください" % (COLS * 2 + 18, ROWS + 3),
                                   "(q で終了)"]):
                safe_add(stdscr, st["H"] // 2 + i, max(0, (st["W"] - len(m)) // 2),
                         m, RED if i == 0 else GOLD)
            stdscr.refresh()
            continue

        if st["state"] == "play":
            b = st["board"]
            if ch in (curses.KEY_LEFT, ord("a"), ord("h")):
                if not collides(b, st["cells"], st["oy"], st["ox"] - 1):
                    st["ox"] -= 1
            elif ch in (curses.KEY_RIGHT, ord("d"), ord("l")):
                if not collides(b, st["cells"], st["oy"], st["ox"] + 1):
                    st["ox"] += 1
            elif ch in (curses.KEY_UP, ord("x"), ord("k")):
                rc = rotate_cw(st["cells"])
                for kick in (0, -1, 1, -2, 2):       # 簡易ウォールキック
                    if not collides(b, rc, st["oy"], st["ox"] + kick):
                        st["cells"] = rc
                        st["ox"] += kick
                        break
            elif ch in (curses.KEY_DOWN, ord("s"), ord("j")):
                if not collides(b, st["cells"], st["oy"] + 1, st["ox"]):
                    st["oy"] += 1
                    st["score"] += 1
            elif ch == ord(" "):
                while not collides(b, st["cells"], st["oy"] + 1, st["ox"]):
                    st["oy"] += 1
                    st["score"] += 2
                lock_and_clear(st)
        elif ch in (ord("r"), ord("R")) and st["state"] == "over":
            st = new_game()
            continue

        if st["state"] == "play":
            if st["flash"] > 0:
                st["flash"] -= 1
            st["fall"] += 1
            interval = max(2, 12 - st["level"])      # レベルで落下加速
            if st["fall"] >= interval:
                st["fall"] = 0
                if not collides(st["board"], st["cells"], st["oy"] + 1, st["ox"]):
                    st["oy"] += 1
                else:
                    lock_and_clear(st)

        # ---- 描画 ----
        stdscr.erase()
        W, H = st["W"], st["H"]
        bx, by = st["boardx"], st["boardy"]
        safe_add(stdscr, 0, 1,
                 " OMB DROP 🧱   score:%d  lines:%d  Lv:%d   [←→ ↑回転 ↓ space r q]" % (
                     st["score"], st["lines"], st["level"]), GOLD)
        # 枠
        border = GOLD if st["flash"] == 0 else (curses.color_pair(1) | curses.A_BOLD)
        safe_add(stdscr, by - 1, bx - 1, "┌" + "─" * (COLS * 2) + "┐", border)
        safe_add(stdscr, by + ROWS, bx - 1, "└" + "─" * (COLS * 2) + "┘", border)
        for y in range(ROWS):
            safe_add(stdscr, by + y, bx - 1, "│", border)
            safe_add(stdscr, by + y, bx + COLS * 2, "│", border)
        # 積まれたブロック
        for y in range(ROWS):
            for x in range(COLS):
                k = st["board"][y][x]
                if k:
                    safe_add(stdscr, by + y, bx + x * 2, "██", pair[k])
        # 落下中ピース
        if st["state"] != "over":
            for r, c in st["cells"]:
                y, x = st["oy"] + r, st["ox"] + c
                if y >= 0:
                    safe_add(stdscr, by + y, bx + x * 2, "██", pair[st["cur"]])
        if st["state"] == "over":
            for i, m in enumerate([" GAME OVER ", " score: %d " % st["score"],
                                   " r で再挑戦 / q で終了 "]):
                safe_add(stdscr, by + ROWS // 2 + i, bx + COLS - len(m) // 2,
                         m, RED if i == 0 else GOLD)
        stdscr.refresh()


def main():
    setup_locale()
    curses.wrapper(play)


if __name__ == "__main__":
    main()
