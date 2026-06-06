# Black Thunder styled cat output.

function _omb_cat_repeat() {
  local char="$1" count="$2" out=""
  while (( count-- > 0 )); do
    out+="$char"
  done
  print -r -- "$out"
}

function _omb_cat_print_rule() {
  local joint="$1"
  local width="${OMB_CAT_WIDTH:-80}"
  local content_width=$(( width - 8 ))
  (( content_width < 8 )) && content_width=8

  printf '%s%s%s%s%s%s\n' \
    "$_OMB_CAT_BORDER" "$(_omb_cat_repeat "─" 7)" "$joint" \
    "$(_omb_cat_repeat "─" "$content_width")" "$_OMB_CAT_RESET"
}

function _omb_cat_print_header() {
  local label="$1"
  printf '%s       %s│%s File:%s %s%s\n' \
    "$_OMB_CAT_ACCENT" "$_OMB_CAT_BORDER" "$_OMB_CAT_ACCENT" \
    "$_OMB_CAT_NORMAL" "$label" "$_OMB_CAT_RESET"
}

function _omb_cat_print_line() {
  local number="$1" line="$2"
  printf '%s%4d   %s│%s %s%s\n' \
    "$_OMB_CAT_ACCENT" "$number" "$_OMB_CAT_BORDER" \
    "$_OMB_CAT_NORMAL" "$line" "$_OMB_CAT_RESET"
}

function _omb_cat_print_stream() {
  local label="$1"
  local line number=1

  _omb_cat_print_rule "┬" ""
  _omb_cat_print_header "$label"
  _omb_cat_print_rule "┼" ""

  while IFS= read -r line || [[ -n "$line" ]]; do
    _omb_cat_print_line "$number" "$line"
    (( number++ ))
  done

  _omb_cat_print_rule "┴" ""
}

function thunder_cat() {
  emulate -L zsh

  if [[ ! -t 1 ]]; then
    command cat "$@"
    return $?
  fi

  typeset -g _OMB_CAT_RESET=$'\033[0m'
  typeset -g _OMB_CAT_BORDER=$'\033[38;2;230;0;18m'
  typeset -g _OMB_CAT_ACCENT=$'\033[38;2;255;211;0m'
  typeset -g _OMB_CAT_NORMAL=$'\033[38;2;255;255;255m'

  if (( $# == 0 )); then
    _omb_cat_print_stream "STDIN"
    return 0
  fi

  local file exit_status=0
  for file in "$@"; do
    if [[ "$file" == "-" ]]; then
      _omb_cat_print_stream "STDIN"
      continue
    fi

    if [[ ! -r "$file" ]]; then
      print -P "%F{red}thunder_cat: cannot read $file%f" >&2
      exit_status=1
      continue
    fi

    _omb_cat_print_stream "$file" < "$file"
  done

  return "$exit_status"
}

alias blackthunder_cat='thunder_cat'
