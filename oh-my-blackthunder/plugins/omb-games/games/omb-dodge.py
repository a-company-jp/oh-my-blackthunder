#!/usr/bin/env python3
# =====================================================================
#  omb-dodge  ―  oh my black のイナズマ・ダッシュ
#  上から降る稲妻 ⚡ をバー(ブラックサンダー)で避ける。チョコ ◆ は取ると加点。
#  操作:  ←→ / a d / h l 移動,  r リスタート,  q 終了
#  生き延びるほどスコアUP。被弾でライフ-1、ライフ0で終了。
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


PW = 7  # バーの幅


def play(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.timeout(55)
    curses.start_color()
    curses.use_default_colors()
    if curses.COLORS >= 256:
        curses.init_pair(1, 220, -1)   # 金（バー/枠）
        curses.init_pair(2, 51, -1)    # シアン（チョコ）
        curses.init_pair(3, 203, -1)   # 赤（被弾）
        curses.init_pair(4, 226, -1)   # 黄白（稲妻）
    else:
        curses.init_pair(1, curses.COLOR_YELLOW, -1)
        curses.init_pair(2, curses.COLOR_CYAN, -1)
        curses.init_pair(3, curses.COLOR_RED, -1)
        curses.init_pair(4, curses.COLOR_YELLOW, -1)
    GOLD = curses.color_pair(1) | curses.A_BOLD
    CHOC = curses.color_pair(2) | curses.A_BOLD
    RED = curses.color_pair(3) | curses.A_BOLD
    BOLT = curses.color_pair(4) | curses.A_BOLD

    top = 2

    def new_game():
        H, W = stdscr.getmaxyx()
        if W < 24 or H < 12:
            return {"state": "toosmall", "H": H, "W": W}
        return {
            "H": H, "W": W, "top": top, "prow": H - 2,
            "px": (W - PW) // 2, "objs": [],     # objs: [y, x, kind] kind:"bolt"/"choc"
            "score": 0, "lives": 3, "tick": 0, "flash": 0,
            "state": "play",
        }

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
                                   "幅24 × 高さ12 以上にしてください", "(q で終了)"]):
                safe_add(stdscr, st["H"] // 2 + i, max(0, (st["W"] - len(m)) // 2),
                         m, RED if i == 0 else GOLD)
            stdscr.refresh()
            continue

        if ch in (curses.KEY_LEFT, ord("a"), ord("h")):
            st["px"] = max(1, st["px"] - 3)
        elif ch in (curses.KEY_RIGHT, ord("d"), ord("l")):
            st["px"] = min(st["W"] - PW - 1, st["px"] + 3)
        elif ch in (ord("r"), ord("R")) and st["state"] == "over":
            st = new_game()
            continue

        if st["state"] == "play":
            st["tick"] += 1
            st["score"] += 1
            if st["flash"] > 0:
                st["flash"] -= 1
            # 難度: 進むほど落下頻度UP
            spawn_p = min(0.55, 0.12 + st["tick"] / 1400.0)
            if random.random() < spawn_p:
                x = random.randint(1, st["W"] - 2)
                kind = "choc" if random.random() < 0.18 else "bolt"
                st["objs"].append([st["top"], x, kind])
            # 落下（2tickに1回だけ下げてスピード調整）
            fall = (st["tick"] % 2 == 0)
            alive = []
            for o in st["objs"]:
                if fall:
                    o[0] += 1
                hit_row = (o[0] >= st["prow"])
                on_bar = (st["px"] <= o[1] < st["px"] + PW)
                if hit_row and on_bar:
                    if o[2] == "choc":
                        st["score"] += 30
                    else:
                        st["lives"] -= 1
                        st["flash"] = 6
                        if st["lives"] <= 0:
                            st["state"] = "over"
                    continue  # 消費
                if o[0] <= st["prow"]:
                    alive.append(o)
            st["objs"] = alive

        # ---- 描画 ----
        stdscr.erase()
        W, H = st["W"], st["H"]
        hud = " OMB DODGE ⚡   score:%d   lives:%s   [←→/a d  r  q]" % (
            st["score"], "♥" * st["lives"] if st["lives"] > 0 else "-")
        safe_add(stdscr, 0, 1, hud, GOLD)
        for o in st["objs"]:
            if o[2] == "choc":
                safe_add(stdscr, o[0], o[1], "◆", CHOC)
            else:
                safe_add(stdscr, o[0], o[1], "⚡", BOLT)
        bar_attr = RED if st["flash"] > 0 else GOLD
        safe_add(stdscr, st["prow"], st["px"], "▀" * PW, bar_attr)
        if st["state"] == "over":
            for i, m in enumerate(["", " 被弾… しけったか。 ",
                                   " score: %d " % st["score"],
                                   " r で再挑戦 / q で終了 "]):
                safe_add(stdscr, H // 2 - 1 + i, max(1, (W - len(m)) // 2), m,
                         RED if i == 1 else GOLD)
        stdscr.refresh()


def main():
    setup_locale()
    curses.wrapper(play)


if __name__ == "__main__":
    main()
