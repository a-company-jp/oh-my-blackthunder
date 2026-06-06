#!/usr/bin/env zsh
# =====================================================================
#  oh-my-black.zsh-theme  ―  黒 × 金の稲妻。起動イナズマ級！
#  Oh My Zsh 互換テーマ（git_prompt_info を借りているのでそのまま動く）
#
#  置き場所:  ~/.oh-my-zsh/custom/themes/oh-my-black.zsh-theme
#  有効化:    ~/.zshrc に  ZSH_THEME="oh-my-black"  → source ~/.zshrc
# =====================================================================

# --- パレット（ブラックサンダー：黒地に金の稲妻）------------------
#  truecolor 対応端末向け。金が出ない端末なら #F5C518 → 220 に置換。
OMB_GOLD='%F{#FFD300}'      # イナズマイエロー RGB(255,211,0)
OMB_GOLD_HOT='%F{#FFE45C}'  # 明るい金（プロンプト記号用）
OMB_WHITE='%F{#FFFFFF}'
OMB_RED='%F{#E60012}'       # サンダーレッド RGB(230,0,18)
OMB_GREEN='%F{#27C93F}'
OMB_DIM='%F{#6A6A6A}'

# --- git セグメント ------------------------------------------------
#  OMZ の lib/git.zsh が提供する git_prompt_info をそのまま利用
ZSH_THEME_GIT_PROMPT_PREFIX="${OMB_GOLD} %F{#FFD300}⎇ "
ZSH_THEME_GIT_PROMPT_SUFFIX="%f"
ZSH_THEME_GIT_PROMPT_DIRTY=" ${OMB_RED}✗%f"
ZSH_THEME_GIT_PROMPT_CLEAN=" ${OMB_GREEN}●%f"

# --- プロンプト本体 -------------------------------------------------
#  ⚡ : 直前のコマンドが成功なら金、失敗なら赤  （%(?.成功.失敗)）
#  ◢◣ : Powerline の代わりのギザギザ区切り＝ザクザク
#  ❯  : 入力位置。成功=明るい金 / 失敗=赤
PROMPT='%(?.${OMB_GOLD}⚡.${OMB_RED}⚡)%f '
PROMPT+='%B${OMB_WHITE}%~%f%b '
PROMPT+='${OMB_GOLD}◢◣%f'
PROMPT+='$(git_prompt_info) '
PROMPT+='%(?.${OMB_GOLD_HOT}.${OMB_RED})❯%f '

# 右側に時刻をうっすら（派手にしたいなら ⚡%* に変えてもOK）
RPROMPT='${OMB_DIM}%*%f'

# --- 起動バナー（うるさく派手に。OMB_QUIET=1 で黙る）--------------
OMB_THEME_DIR="${${(%):-%x}:A:h}"
OMB_ASCII_FILE="${OMB_ASCII_FILE:-$OMB_THEME_DIR/blackthunder_ascii.txt}"
OMB_ASCII_118_FILE="${OMB_ASCII_118_FILE:-$OMB_THEME_DIR/blackthunder_ascii_118.txt}"
OMB_ASCII_79_FILE="${OMB_ASCII_79_FILE:-$OMB_THEME_DIR/blackthunder_ascii_79.txt}"
OMB_ASCII_59_FILE="${OMB_ASCII_59_FILE:-$OMB_THEME_DIR/blackthunder_ascii_59.txt}"

function _omb_ascii_for_width() {
  case "$OMB_ASCII_SIZE" in
    full) print -r -- "$OMB_ASCII_FILE"; return ;;
    half|medium) print -r -- "$OMB_ASCII_118_FILE"; return ;;
    narrow) print -r -- "$OMB_ASCII_79_FILE"; return ;;
    tiny) print -r -- "$OMB_ASCII_59_FILE"; return ;;
    compact) return 1 ;;
  esac

  local cols="${COLUMNS:-80}"
  [[ "$cols" == <-> ]] || cols=80

  if (( cols >= 236 )); then
    print -r -- "$OMB_ASCII_FILE"
  elif (( cols >= 118 )); then
    print -r -- "$OMB_ASCII_118_FILE"
  elif (( cols >= 79 )); then
    print -r -- "$OMB_ASCII_79_FILE"
  elif (( cols >= 59 )); then
    print -r -- "$OMB_ASCII_59_FILE"
  else
    return 1
  fi
}

function _omb_print_ascii_file() {
  local file="$1"
  local line

  [[ -r "$file" ]] || return 1

  while IFS= read -r line || [[ -n "$line" ]]; do
    print -P -r -- "$line"
  done < "$file"
  print -P "%f%k"
}

function _omb_print_banner() {
  local ascii_file

  if [[ -z "$OMB_COMPACT" ]]; then
    ascii_file="$(_omb_ascii_for_width)"
    if [[ -n "$ascii_file" ]] && _omb_print_ascii_file "$ascii_file"; then
      return
    fi
  fi

  print -P "%K{#050505}${OMB_GOLD}######################%f%k"
}

if [[ -z "$OMB_QUIET" ]]; then
  _omb_print_banner
fi
