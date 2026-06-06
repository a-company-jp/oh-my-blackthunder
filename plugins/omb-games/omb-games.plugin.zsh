#!/usr/bin/env zsh
# =====================================================================
#  omb-games.plugin.zsh  ―  Oh My Blackthunder のミニゲーム集
#  有効化:  ~/.zshrc の  plugins=(... omb-games)  に追加
#  本体:    plugins/omb-games/games/omb-<game>.py（Python + curses）
#
#  コマンド:  omb            一覧
#             omb <game>     起動（break/pong/snake/dodge/drop/mine）
#             omb-<game>     個別コマンドでも可
# =====================================================================

OMB_GAMES_DIR="${${(%):-%x}:A:h}"            # = plugins/omb-games
OMB_GAMES_PY="$OMB_GAMES_DIR/games"
# リポジトリ(インストール)ルート。OMB が未設定でもプラグイン位置から導出。
OMB_GAMES_ROOT="${OMB:-${OMB_GAMES_DIR:h:h}}"
OMB_GAMES_ASCII="$OMB_GAMES_ROOT/themes/blackthunder_ascii.txt"

# 内部: omb-<game>.py を起動
_omb_run() {
  emulate -L zsh
  local game="$1"; shift
  local py="$OMB_GAMES_PY/omb-$game.py"
  if [[ ! -f "$py" ]]; then
    print -P "%F{red}omb-$game.py が見つかりません%f ($py)"
    return 1
  fi
  if (( ! $+commands[python3] )); then
    print -P "%F{red}python3 が必要です%f（ゲームは Python+curses で動きます）"
    return 1
  fi
  python3 "$py" "$@"
}

# ブロック崩しは AA ファイルを引数で受け取る（テーマの AA を使用）
omb-break() {
  emulate -L zsh
  local art="${OMB_ASCII:-$OMB_GAMES_ASCII}"
  if [[ -f "$art" ]]; then
    _omb_run break "$art" "$@"
  else
    _omb_run break "$@"
  fi
}
alias omb-zaku='omb-break'

omb-pong()  { _omb_run pong  "$@" }
omb-snake() { _omb_run snake "$@" }
omb-dodge() { _omb_run dodge "$@" }
omb-drop()  { _omb_run drop  "$@" }
omb-mine()  { _omb_run mine  "$@" }

_omb_list() {
  print -P "%F{220}⚡ Oh My Blackthunder ゲーム集 ⚡%f"
  print -P "  %F{220}omb break%f   ブロック崩し（ブラックサンダーAAを崩す）"
  print -P "  %F{220}omb pong%f    稲妻ピンポン（CPU対戦）"
  print -P "  %F{220}omb snake%f   ザクザク・スネーク"
  print -P "  %F{220}omb dodge%f   イナズマ回避"
  print -P "  %F{220}omb drop%f    ザクッ・ドロップ（落ちもの）"
  print -P "  %F{220}omb mine%f    マインスイーパー（easy/normal/hard）"
  print -P "  例: %F{cyan}omb mine hard%f  /  個別: %F{cyan}omb-mine%f など"
}

# ディスパッチャ
omb() {
  emulate -L zsh
  local sub="${1:-}"
  (( $# )) && shift
  case "$sub" in
    ""|list|help|-h|--help)         _omb_list ;;
    break)                          omb-break "$@" ;;
    pong|snake|dodge|drop|mine)     _omb_run "$sub" "$@" ;;
    *) print -P "%F{red}不明なゲーム: $sub%f"; _omb_list; return 1 ;;
  esac
}
