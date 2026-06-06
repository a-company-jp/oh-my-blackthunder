#!/usr/bin/env python3
# =====================================================================
#  omb-mine  ―  oh my black のイナズマ・マインスイーパー
#  盤面に隠れた「雷(地雷)」を旗で避けつつ、安全マスを全部開ければ勝ち。
#  数字 = 周囲8マスの雷の数。最初に開くマスは必ず安全。
#
#  操作:  ↑↓←→ / w a s d / h j k l  カーソル移動
#         space / Enter  開く,   f  旗,   c  周囲一括開け(数字一致時)
#         r  リスタート,   q  終了
#  難易度:  omb-mine [easy|normal|hard]   （既定 normal）
# =====================================================================
import curses
import locale
import random
import sys
import time

LEVELS = {
    "easy":   (9, 9, 10),
    "normal": (16, 16, 40),
    "hard":   (16, 30, 99),
}


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


def play(stdscr, level):
    curses.curs_set(0)
    stdscr.timeout(250)            # 入力待ち。-1 でも時計更新のため再描画
    curses.start_color()
    curses.use_default_colors()
    c256 = curses.COLORS >= 256

    def mk(n, c8, c2):
        curses.init_pair(n, (c2 if c256 else c8), -1)
        return curses.color_pair(n) | curses.A_BOLD
    GOLD = mk(1, curses.COLOR_YELLOW, 220)
    RED = mk(2, curses.COLOR_RED, 203)
    CUR = mk(3, curses.COLOR_CYAN, 51)
    DIM = curses.color_pair(4)
    curses.init_pair(4, (244 if c256 else curses.COLOR_WHITE), -1)
    # 数字 1..8 の色
    numcol = {}
    spec = {1: 33, 2: 46, 3: 203, 4: 27, 5: 130, 6: 51, 7: 250, 8: 244}
    spec8 = {1: curses.COLOR_BLUE, 2: curses.COLOR_GREEN, 3: curses.COLOR_RED,
             4: curses.COLOR_BLUE, 5: curses.COLOR_RED, 6: curses.COLOR_CYAN,
             7: curses.COLOR_WHITE, 8: curses.COLOR_WHITE}
    for n in range(1, 9):
        curses.init_pair(10 + n, (spec[n] if c256 else spec8[n]), -1)
        numcol[n] = curses.color_pair(10 + n) | curses.A_BOLD

    ROWS, COLS, MINES = level

    def new_game():
        H, W = stdscr.getmaxyx()
        if W < COLS * 2 + 4 or H < ROWS + 4:
            return {"state": "toosmall", "H": H, "W": W,
                    "need_w": COLS * 2 + 4, "need_h": ROWS + 4}
        return {
            "H": H, "W": W,
            "bx": max(2, (W - COLS * 2) // 2), "by": max(2, (H - ROWS) // 2),
            "mine": [[False] * COLS for _ in range(ROWS)],
            "adj": [[0] * COLS for _ in range(ROWS)],
            "open": [[False] * COLS for _ in range(ROWS)],
            "flag": [[False] * COLS for _ in range(ROWS)],
            "cr": ROWS // 2, "cc": COLS // 2,
            "placed": False, "t0": 0.0, "elapsed": 0,
            "state": "play",
        }

    def neighbors(r, c):
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr or dc:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < ROWS and 0 <= nc < COLS:
                        yield nr, nc

    def place_mines(st, safe_r, safe_c):
        forbidden = {(safe_r, safe_c)} | set(neighbors(safe_r, safe_c))
        cells = [(r, c) for r in range(ROWS) for c in range(COLS)
                 if (r, c) not in forbidden]
        for (r, c) in random.sample(cells, min(MINES, len(cells))):
            st["mine"][r][c] = True
        for r in range(ROWS):
            for c in range(COLS):
                st["adj"][r][c] = sum(1 for nr, nc in neighbors(r, c) if st["mine"][nr][nc])
        st["placed"] = True
        st["t0"] = time.monotonic()

    def reveal(st, r, c):
        if st["open"][r][c] or st["flag"][r][c]:
            return
        if not st["placed"]:
            place_mines(st, r, c)
        if st["mine"][r][c]:
            st["open"][r][c] = True
            st["state"] = "over"
            return
        # フラッドフィル（0 の周囲を連鎖開放）
        stack = [(r, c)]
        while stack:
            cr, cc = stack.pop()
            if st["open"][cr][cc] or st["flag"][cr][cc]:
                continue
            st["open"][cr][cc] = True
            if st["adj"][cr][cc] == 0:
                for nr, nc in neighbors(cr, cc):
                    if not st["open"][nr][nc] and not st["mine"][nr][nc]:
                        stack.append((nr, nc))
        check_win(st)

    def chord(st, r, c):
        # 数字マスで、周囲の旗数がその数字と一致したら未開放マスを一括で開く
        if not st["open"][r][c] or st["adj"][r][c] == 0:
            return
        flags = sum(1 for nr, nc in neighbors(r, c) if st["flag"][nr][nc])
        if flags == st["adj"][r][c]:
            for nr, nc in neighbors(r, c):
                if not st["open"][nr][nc] and not st["flag"][nr][nc]:
                    reveal(st, nr, nc)
                    if st["state"] == "over":
                        return

    def check_win(st):
        for r in range(ROWS):
            for c in range(COLS):
                if not st["mine"][r][c] and not st["open"][r][c]:
                    return
        st["state"] = "win"

    def flags_used(st):
        return sum(r.count(True) for r in st["flag"])

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
                                   "幅%d × 高さ%d 以上にしてください" % (st["need_w"], st["need_h"]),
                                   "(q で終了)"]):
                safe_add(stdscr, st["H"] // 2 + i, max(0, (st["W"] - len(m)) // 2),
                         m, RED if i == 0 else GOLD)
            stdscr.refresh()
            continue

        if ch in (ord("r"), ord("R")):
            st = new_game()
            continue

        if st["state"] == "play":
            if ch in (curses.KEY_UP, ord("w"), ord("k")):
                st["cr"] = (st["cr"] - 1) % ROWS
            elif ch in (curses.KEY_DOWN, ord("s"), ord("j")):
                st["cr"] = (st["cr"] + 1) % ROWS
            elif ch in (curses.KEY_LEFT, ord("a"), ord("h")):
                st["cc"] = (st["cc"] - 1) % COLS
            elif ch in (curses.KEY_RIGHT, ord("d"), ord("l")):
                st["cc"] = (st["cc"] + 1) % COLS
            elif ch in (ord(" "), curses.KEY_ENTER, 10, 13):
                reveal(st, st["cr"], st["cc"])
            elif ch in (ord("f"), ord("F")):
                if not st["open"][st["cr"]][st["cc"]]:
                    st["flag"][st["cr"]][st["cc"]] ^= True
            elif ch in (ord("c"), ord("C")):
                chord(st, st["cr"], st["cc"])
            if st["placed"] and st["state"] == "play":
                st["elapsed"] = int(time.monotonic() - st["t0"])

        # ---- 描画 ----
        stdscr.erase()
        W, H = st["W"], st["H"]
        bx, by = st["bx"], st["by"]
        remain = MINES - flags_used(st)
        hud = " OMB MINE ⚡  残り雷:%d  時間:%d秒  [移動 space:開 f:旗 c:一括 r q]" % (
            remain, st["elapsed"])
        safe_add(stdscr, 0, 1, hud, GOLD)
        # 枠
        safe_add(stdscr, by - 1, bx - 1, "┌" + "─" * (COLS * 2) + "┐", GOLD)
        safe_add(stdscr, by + ROWS, bx - 1, "└" + "─" * (COLS * 2) + "┘", GOLD)
        for r in range(ROWS):
            safe_add(stdscr, by + r, bx - 1, "│", GOLD)
            safe_add(stdscr, by + r, bx + COLS * 2, "│", GOLD)
        # マス（1セル=2文字幅）
        over = st["state"] == "over"
        for r in range(ROWS):
            for c in range(COLS):
                opened = st["open"][r][c]
                if opened:
                    if st["mine"][r][c]:
                        txt, at = " *", RED
                    elif st["adj"][r][c] > 0:
                        n = st["adj"][r][c]
                        txt, at = " %d" % n, numcol[n]
                    else:
                        txt, at = "  ", DIM
                elif st["flag"][r][c]:
                    txt, at = " ▶", RED
                elif over and st["mine"][r][c]:
                    txt, at = " *", RED          # 負けたら雷を全表示
                else:
                    txt, at = "▓▓", DIM
                if r == st["cr"] and c == st["cc"] and st["state"] == "play":
                    at = CUR | curses.A_REVERSE
                safe_add(stdscr, by + r, bx + c * 2, txt, at)
        # 結果
        if st["state"] in ("win", "over"):
            msg = " ⚡ 全クリ!! イナズマ級!! ⚡ " if st["state"] == "win" else " 雷を踏んだ… GAME OVER "
            sub = " %d秒  /  r で再挑戦  q で終了 " % st["elapsed"]
            attr = GOLD if st["state"] == "win" else RED
            safe_add(stdscr, by + ROWS + 2, max(1, (W - len(msg)) // 2), msg, attr)
            safe_add(stdscr, by + ROWS + 3, max(1, (W - len(sub)) // 2), sub, GOLD)
        stdscr.refresh()


def main():
    setup_locale()
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else "normal"
    level = LEVELS.get(arg, LEVELS["normal"])
    curses.wrapper(play, level)


if __name__ == "__main__":
    main()
