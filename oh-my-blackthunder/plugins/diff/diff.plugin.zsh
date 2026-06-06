# Black Thunder styled diff output.

function _omb_diff_colorize() {
  local line
  local reset=$'\033[0m'
  local add_color=$'\033[38;2;255;211;0m'
  local remove_color=$'\033[38;2;230;0;18m'
  local normal_color=$'\033[38;2;255;255;255m'

  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      "+++"*|"---"*)
        printf '%s%s%s\n' "$normal_color" "$line" "$reset"
        ;;
      "+"*|"> "*)
        printf '%s%s%s\n' "$add_color" "$line" "$reset"
        ;;
      "-"*|"< "*)
        printf '%s%s%s\n' "$remove_color" "$line" "$reset"
        ;;
      *)
        printf '%s%s%s\n' "$normal_color" "$line" "$reset"
        ;;
    esac
  done
}

function thunder_diff() {
  if [[ -t 1 ]]; then
    command diff "$@" | _omb_diff_colorize
    return ${pipestatus[1]}
  fi

  command diff "$@"
}

alias diff='thunder_diff'
