# Shared helpers for AI usage display in Oh My Blackthunder prompts.
[[ -n "${_OMB_AI_BLACKTHUNDER_LIB_LOADED:-}" ]] && return
_OMB_AI_BLACKTHUNDER_LIB_LOADED=1

: ${OMB_AI_BLACKTHUNDER:=1}
: ${OMB_AI_BLACKTHUNDER_TTL:=600}
: ${OMB_BLACKTHUNDER_PRICE_JPY:=43}
: ${OMB_USD_JPY:=160}
: ${OMB_BLACKTHUNDER_TOKENS_PER_BAR:=90000}

zmodload zsh/datetime 2>/dev/null || true

_OMB_AI_BLACKTHUNDER_ROOT="${OMB:-${${(%):-%x}:A:h:h}}"

function _omb_ai_blackthunder_cache_dir() {
  print -r -- "${OMB_AI_BLACKTHUNDER_CACHE_DIR:-${OMB_CACHE_DIR:-$_OMB_AI_BLACKTHUNDER_ROOT/cache}/ai-blackthunder}"
}

function _omb_ai_blackthunder_cache_file() {
  print -r -- "${OMB_AI_BLACKTHUNDER_CACHE_FILE:-$(_omb_ai_blackthunder_cache_dir)/last.tsv}"
}

function _omb_ai_blackthunder_claude_statusline_command() {
  print -r -- "$_OMB_AI_BLACKTHUNDER_ROOT/plugins/ai-blackthunder/omb-claude-statusline.zsh"
}

function _omb_ai_blackthunder_prompt() {
  [[ "${OMB_AI_BLACKTHUNDER:-1}" == "0" ]] && return

  local file="$(_omb_ai_blackthunder_cache_file)"
  [[ -r "$file" ]] || return

  local line updated_at provider bars now ttl age
  line="$(< "$file")" 2>/dev/null || return
  IFS=$'\t' read -r updated_at provider bars <<< "$line"

  [[ "$updated_at" == <-> ]] || return
  case "$bars" in
    (''|*[!0-9.]*|*.*.*) return ;;
  esac

  now="${EPOCHSECONDS:-$(date +%s 2>/dev/null)}"
  [[ "$now" == <-> ]] || return

  ttl="${OMB_AI_BLACKTHUNDER_TTL:-600}"
  [[ "$ttl" == <-> ]] || ttl=600
  age=$(( now - updated_at ))
  (( age >= 0 && age <= ttl )) || return

  provider="${provider//$'\t'/ }"
  provider="${provider//$'\n'/ }"
  provider="${provider//[^A-Za-z0-9 _-]/}"
  provider="${provider:-AI}"

  local gold="${OMB_GOLD:-}"
  local white="${OMB_WHITE:-}"
  local dim="${OMB_DIM:-}"

  [[ -n "$gold" ]] || gold='%F{#FFD300}'
  [[ -n "$white" ]] || white='%F{#FFFFFF}'
  [[ -n "$dim" ]] || dim='%F{#6A6A6A}'

  print -r -n -- "${gold}⚡${white}${bars}本 ${dim}(${provider})%f"
}
