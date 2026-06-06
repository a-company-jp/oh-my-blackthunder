# Black Thunder styled tree output.

function _omb_tree_name() {
  local path="$1"
  local name="${path:t}"

  if [[ -L "$path" ]]; then
    printf '%s%s@%s' "$_OMB_TREE_RED" "$name" "$_OMB_TREE_RESET"
  elif [[ -d "$path" ]]; then
    printf '%s%s/%s' "$_OMB_TREE_YELLOW" "$name" "$_OMB_TREE_RESET"
  elif [[ -x "$path" ]]; then
    printf '%s%s*%s' "$_OMB_TREE_RED" "$name" "$_OMB_TREE_RESET"
  else
    printf '%s%s%s' "$_OMB_TREE_WHITE" "$name" "$_OMB_TREE_RESET"
  fi
}

function _omb_tree_print_children() {
  local dir="$1" prefix="$2" depth="$3" max_depth="$4" all="$5" dirs_only="$6"
  local entry connector next_prefix i total
  local -a entries=()

  if (( max_depth >= 0 && depth >= max_depth )); then
    return
  fi

  if (( all )); then
    entries=("$dir"/*(ND))
  else
    entries=("$dir"/*(N))
  fi

  if (( dirs_only )); then
    local -a dirs=()
    for entry in "${entries[@]}"; do
      [[ -d "$entry" && ! -L "$entry" ]] && dirs+=("$entry")
    done
    entries=("${dirs[@]}")
  fi

  entries=(${(o)entries})
  total=${#entries[@]}

  for (( i = 1; i <= total; i++ )); do
    entry="${entries[$i]}"
    if (( i == total )); then
      connector="└──"
      next_prefix="${prefix}   "
    else
      connector="├──"
      next_prefix="${prefix}│  "
    fi

    if [[ -n "$prefix" ]]; then
      printf '%s%s%s' "$_OMB_TREE_GUIDE" "$prefix" "$_OMB_TREE_RESET"
    fi
    printf '%s%s ' "$_OMB_TREE_RED" "$connector"
    _omb_tree_name "$entry"
    printf '\n'

    if [[ -d "$entry" && ! -L "$entry" ]]; then
      _omb_tree_print_children "$entry" "$next_prefix" $(( depth + 1 )) "$max_depth" "$all" "$dirs_only"
    fi
  done
}

function _omb_tree_print_target() {
  local target="$1" max_depth="$2" all="$3" dirs_only="$4"

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    print -P "%F{red}thunder_tree: cannot access $target%f" >&2
    return 1
  fi

  _omb_tree_name "$target"
  printf '\n'

  if [[ -d "$target" && ! -L "$target" ]]; then
    _omb_tree_print_children "$target" "" 0 "$max_depth" "$all" "$dirs_only"
  fi
}

function thunder_tree() {
  emulate -L zsh

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print "Usage: thunder_tree [-a] [-d] [-L depth] [path ...]"
    print "Prints a Black Thunder styled directory tree."
    return 0
  fi

  local all=0 dirs_only=0 max_depth=-1
  local -a targets=()

  while (( $# > 0 )); do
    case "$1" in
      --)
        shift
        targets+=("$@")
        break
        ;;
      -h|--help)
        print "Usage: thunder_tree [-a] [-d] [-L depth] [path ...]"
        print "Prints a Black Thunder styled directory tree."
        return 0
        ;;
      -a|--all)
        all=1
        ;;
      -d|--dirs-only)
        dirs_only=1
        ;;
      -L)
        shift
        if [[ -z "${1:-}" || ! "$1" == <-> ]]; then
          print -P "%F{red}thunder_tree: -L requires a numeric depth%f" >&2
          return 2
        fi
        max_depth="$1"
        ;;
      --level=*)
        max_depth="${1#--level=}"
        if [[ ! "$max_depth" == <-> ]]; then
          print -P "%F{red}thunder_tree: --level requires a numeric depth%f" >&2
          return 2
        fi
        ;;
      *)
        targets+=("$1")
        ;;
    esac
    shift
  done

  (( ${#targets[@]} == 0 )) && targets=(.)

  if [[ -t 1 ]]; then
    typeset -g _OMB_TREE_RESET=$'\033[0m'
    typeset -g _OMB_TREE_RED=$'\033[38;2;230;0;18m'
    typeset -g _OMB_TREE_YELLOW=$'\033[38;2;255;211;0m'
    typeset -g _OMB_TREE_WHITE=$'\033[38;2;255;255;255m'
    typeset -g _OMB_TREE_GUIDE=$'\033[38;2;130;130;130m'
  else
    typeset -g _OMB_TREE_RESET=""
    typeset -g _OMB_TREE_RED=""
    typeset -g _OMB_TREE_YELLOW=""
    typeset -g _OMB_TREE_WHITE=""
    typeset -g _OMB_TREE_GUIDE=""
  fi

  local target exit_status=0
  for target in "${targets[@]}"; do
    _omb_tree_print_target "$target" "$max_depth" "$all" "$dirs_only" || exit_status=1
    (( ${#targets[@]} > 1 )) && printf '\n'
  done

  return "$exit_status"
}

alias blackthunder_tree='thunder_tree'
