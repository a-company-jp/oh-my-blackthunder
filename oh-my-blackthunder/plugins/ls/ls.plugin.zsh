# Black Thunder styled ls output.

function _omb_ls_human_size() {
  local size="$1" unit="B"
  local -a units=(B K M G T)
  local idx=1

  while (( size >= 1024 && idx < ${#units[@]} )); do
    size=$(( size / 1024 ))
    (( idx++ ))
  done

  printf '%s%s' "$size" "${units[$idx]}"
}

function _omb_ls_kind() {
  local path="$1"

  if [[ -L "$path" ]]; then
    print -r -- "link"
  elif [[ -d "$path" ]]; then
    print -r -- "dir"
  elif [[ -x "$path" ]]; then
    print -r -- "exec"
  else
    print -r -- "file"
  fi
}

function _omb_ls_name() {
  local path="$1"
  local name="${path:t}"

  if [[ -L "$path" ]]; then
    printf '%s%s@%s' "$_OMB_LS_RED" "$name" "$_OMB_LS_RESET"
  elif [[ -d "$path" ]]; then
    printf '%s%s/%s' "$_OMB_LS_YELLOW" "$name" "$_OMB_LS_RESET"
  elif [[ -x "$path" ]]; then
    printf '%s%s*%s' "$_OMB_LS_RED" "$name" "$_OMB_LS_RESET"
  else
    printf '%s%s%s' "$_OMB_LS_WHITE" "$name" "$_OMB_LS_RESET"
  fi
}

function _omb_ls_print_entry() {
  local path="$1" long="$2"
  local kind size label
  local -A st

  if (( long )); then
    kind="$(_omb_ls_kind "$path")"
    if zstat -H st -- "$path" 2>/dev/null; then
      size="$(_omb_ls_human_size "${st[size]}")"
    else
      size="?"
    fi
    label="$(_omb_ls_name "$path")"
    printf '%s%-5s%s %s%6s%s  %s\n' \
      "$_OMB_LS_YELLOW" "$kind" "$_OMB_LS_RESET" \
      "$_OMB_LS_RED" "$size" "$_OMB_LS_RESET" \
      "$label"
  else
    _omb_ls_name "$path"
    printf '\n'
  fi
}

function _omb_ls_print_target() {
  local target="$1" all="$2" long="$3" show_header="$4"
  local -a entries

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    print -P "%F{red}thunder_ls: cannot access $target%f" >&2
    return 1
  fi

  if [[ ! -d "$target" || -L "$target" ]]; then
    _omb_ls_print_entry "$target" "$long"
    return 0
  fi

  if (( show_header )); then
    printf '%s%s:%s\n' "$_OMB_LS_YELLOW" "$target" "$_OMB_LS_RESET"
  fi

  if (( all )); then
    entries=("$target"/*(ND))
  else
    entries=("$target"/*(N))
  fi
  entries=(${(o)entries})

  if (( long )); then
    printf '%s%-5s %6s  %s%s\n' "$_OMB_LS_RED" "TYPE" "SIZE" "NAME" "$_OMB_LS_RESET"
  fi

  local entry
  for entry in "${entries[@]}"; do
    _omb_ls_print_entry "$entry" "$long"
  done
}

function thunder_ls() {
  emulate -L zsh
  zmodload zsh/stat 2>/dev/null || true

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print "Usage: thunder_ls [-a] [-l] [-1] [path ...]"
    print "Lists files with the Black Thunder palette."
    return 0
  fi

  if [[ ! -t 1 ]]; then
    command ls "$@"
    return $?
  fi

  local all=0 long=0
  local -a targets=()

  while (( $# > 0 )); do
    case "$1" in
      --)
        shift
        targets+=("$@")
        break
        ;;
      -h|--help)
        print "Usage: thunder_ls [-a] [-l] [-1] [path ...]"
        print "Lists files with the Black Thunder palette."
        return 0
        ;;
      --all)
        all=1
        ;;
      --long)
        long=1
        ;;
      -[!-]*)
        local chars="${1#-}" char
        while [[ -n "$chars" ]]; do
          char="${chars[1]}"
          chars="${chars[2,-1]}"
          case "$char" in
            a) all=1 ;;
            l) long=1 ;;
            1) ;;
            h)
              print "Usage: thunder_ls [-a] [-l] [-1] [path ...]"
              print "Lists files with the Black Thunder palette."
              return 0
              ;;
            *)
              print -P "%F{red}thunder_ls: unsupported option -$char%f" >&2
              return 2
              ;;
          esac
        done
        ;;
      *)
        targets+=("$1")
        ;;
    esac
    shift
  done

  (( ${#targets[@]} == 0 )) && targets=(.)

  typeset -g _OMB_LS_RESET=$'\033[0m'
  typeset -g _OMB_LS_RED=$'\033[38;2;230;0;18m'
  typeset -g _OMB_LS_YELLOW=$'\033[38;2;255;211;0m'
  typeset -g _OMB_LS_WHITE=$'\033[38;2;255;255;255m'

  local target exit_status=0 show_header=0
  (( ${#targets[@]} > 1 )) && show_header=1

  for target in "${targets[@]}"; do
    _omb_ls_print_target "$target" "$all" "$long" "$show_header" || exit_status=1
    (( show_header )) && printf '\n'
  done

  return "$exit_status"
}

alias blackthunder_ls='thunder_ls'
alias thunder_ll='thunder_ls -l'
alias thunder_la='thunder_ls -a'
alias ls='thunder_ls'
alias ll='thunder_ls -l'
alias la='thunder_ls -a'
