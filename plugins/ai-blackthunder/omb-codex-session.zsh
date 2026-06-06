#!/usr/bin/env zsh

function _omb_codex_session_main() {
  emulate -L zsh

  local command="${1:-start}"
  shift 2>/dev/null || true

  local script_dir root cache_dir pid_file log_file collector node_bin pid
  script_dir="${${(%):-%x}:A:h}"
  root="${script_dir:h:h}"
  cache_dir="${OMB_AI_BLACKTHUNDER_CACHE_DIR:-${OMB_CACHE_DIR:-$root/cache}/ai-blackthunder}"
  pid_file="${OMB_CODEX_SESSION_PID_FILE:-$cache_dir/codex-session.pid}"
  log_file="${OMB_CODEX_SESSION_LOG_FILE:-$cache_dir/codex-session.log}"
  collector="$script_dir/omb-codex-session-collector.js"
  node_bin="${OMB_CODEX_SESSION_NODE:-${commands[node]:-}}"

  case "$command" in
    start)
      if [[ -r "$pid_file" ]]; then
        pid="$(< "$pid_file")"
        if [[ "$pid" == <-> ]] && kill -0 "$pid" 2>/dev/null; then
          [[ "${1:-}" == "--quiet" ]] || print -r -- "omb-codex-session already running: $pid"
          return 0
        fi
      fi

      if [[ -z "$node_bin" ]]; then
        [[ "${1:-}" == "--quiet" ]] || print -r -- "node not found"
        return 1
      fi

      mkdir -p "$cache_dir" || return 1
      OMB_AI_BLACKTHUNDER_CACHE_DIR="$cache_dir" \
      "$node_bin" "$collector" --scan-once >/dev/null 2>> "$log_file" || true

      unsetopt bg_nice 2>/dev/null || true
      if (( $+commands[nohup] )); then
        OMB_AI_BLACKTHUNDER_CACHE_DIR="$cache_dir" \
        nohup "$node_bin" "$collector" >> "$log_file" 2>&1 &
      else
        (
          trap '' HUP
          OMB_AI_BLACKTHUNDER_CACHE_DIR="$cache_dir" \
          "$node_bin" "$collector"
        ) >> "$log_file" 2>&1 &
      fi
      pid=$!
      disown "$pid" 2>/dev/null || disown 2>/dev/null || true
      print -r -- "$pid" > "$pid_file"
      [[ "${1:-}" == "--quiet" ]] || print -r -- "omb-codex-session started: $pid"
      ;;
    stop)
      [[ -r "$pid_file" ]] || return 0
      pid="$(< "$pid_file")"
      if [[ "$pid" == <-> ]] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pid_file"
      ;;
    status)
      if [[ -r "$pid_file" ]]; then
        pid="$(< "$pid_file")"
        if [[ "$pid" == <-> ]] && kill -0 "$pid" 2>/dev/null; then
          print -r -- "running $pid"
          return 0
        fi
      fi
      print -r -- "stopped"
      return 1
      ;;
    scan)
      if [[ -z "$node_bin" ]]; then
        print -r -- "node not found"
        return 1
      fi

      local quiet=0
      if [[ "${1:-}" == "--quiet" ]]; then
        quiet=1
        shift
      fi

      mkdir -p "$cache_dir" || return 1
      if (( quiet )); then
        OMB_AI_BLACKTHUNDER_CACHE_DIR="$cache_dir" \
        "$node_bin" "$collector" --scan-once "$@" >/dev/null
      else
        OMB_AI_BLACKTHUNDER_CACHE_DIR="$cache_dir" \
        "$node_bin" "$collector" --scan-once "$@"
      fi
      ;;
    *)
      print -r -- "usage: omb-codex-session {start|stop|status|scan}"
      return 2
      ;;
  esac
}

_omb_codex_session_main "$@"
