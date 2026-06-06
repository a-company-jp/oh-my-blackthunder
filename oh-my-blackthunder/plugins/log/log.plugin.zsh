# Black Thunder styled log colorizer.

function _omb_log_colorize() {
  local line kind
  local reset=$'\033[0m'
  local red=$'\033[38;2;230;0;18m'
  local yellow=$'\033[38;2;255;211;0m'
  local white=$'\033[38;2;255;255;255m'
  local dim=$'\033[2m'

  while IFS= read -r line || [[ -n "$line" ]]; do
    kind="${line:l}"
    case "$kind" in
      *fatal*|*panic*|*critical*|*error*|*err:*)
        printf '%s%s%s\n' "$red" "$line" "$reset"
        ;;
      *warn*|*warning*|*timeout*|*retry*|*slow*)
        printf '%s%s%s\n' "$yellow" "$line" "$reset"
        ;;
      *debug*|*trace*)
        printf '%s%s%s%s\n' "$dim" "$white" "$line" "$reset"
        ;;
      *info*|*notice*|*started*|*listening*|*ready*)
        printf '%s%s%s\n' "$white" "$line" "$reset"
        ;;
      *)
        printf '%s%s%s\n' "$white" "$line" "$reset"
        ;;
    esac
  done
}

function thunder_log() {
  emulate -L zsh

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print "Usage: thunder_log [file ...]"
    print "Colorizes log lines with the Black Thunder palette."
    print "Reads stdin when no file is given, or when file is '-'."
    return 0
  fi

  if [[ ! -t 1 ]]; then
    command cat "$@"
    return $?
  fi

  if (( $# == 0 )); then
    _omb_log_colorize
    return 0
  fi

  local file exit_status=0
  for file in "$@"; do
    if [[ "$file" == "-" ]]; then
      _omb_log_colorize
      continue
    fi

    if [[ ! -r "$file" ]]; then
      print -P "%F{red}thunder_log: cannot read $file%f" >&2
      exit_status=1
      continue
    fi

    _omb_log_colorize < "$file"
  done

  return "$exit_status"
}

alias blackthunder_log='thunder_log'
alias log='thunder_log'
