# Shared helpers for AI usage display in Oh My Blackthunder prompts.
[[ -n "${_OMB_AI_BLACKTHUNDER_LIB_LOADED:-}" ]] && return
_OMB_AI_BLACKTHUNDER_LIB_LOADED=1

: ${OMB_AI_BLACKTHUNDER:=1}
: ${OMB_AI_BLACKTHUNDER_TTL:=600}
: ${OMB_AI_BLACKTHUNDER_WINDOW_SECONDS:=18000}
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

function _omb_ai_blackthunder_provider_file() {
  local provider="$1"
  print -r -- "$(_omb_ai_blackthunder_cache_dir)/providers/$provider.tsv"
}

function _omb_ai_blackthunder_events_file() {
  local provider="$1"
  print -r -- "$(_omb_ai_blackthunder_cache_dir)/events/$provider.tsv"
}

function _omb_ai_blackthunder_claude_statusline_command() {
  print -r -- "$_OMB_AI_BLACKTHUNDER_ROOT/plugins/ai-blackthunder/omb-claude-statusline.zsh"
}

function _omb_ai_blackthunder_codex_session_command() {
  print -r -- "$_OMB_AI_BLACKTHUNDER_ROOT/plugins/ai-blackthunder/omb-codex-session.zsh"
}

function _omb_ai_blackthunder_format_bars() {
  awk -v value="$1" '
    BEGIN {
      value += 0
      if (value > 0 && value < 0.05) {
        print "0.1"
      } else if (value >= 10) {
        printf "%.0f\n", value
      } else {
        printf "%.1f\n", value
      }
    }
  '
}

function _omb_ai_blackthunder_snapshot_bars() {
  local provider="$1"
  local now="$2"
  local window="$3"
  local file="$(_omb_ai_blackthunder_provider_file "$provider")"

  [[ -r "$file" ]] || return

  awk -F '\t' -v now="$now" -v window="$window" '
    NF >= 2 && $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+(\.[0-9]+)?$/ {
      age = now - $1
      if (age >= 0 && age <= window) {
        value = $2 + 0
      }
    }
    END {
      if (value > 0) {
        print value
      }
    }
  ' "$file"
}

# Sum the latest snapshot of every session bucket within the window. Each Claude
# session reports its own cumulative cost into providers/<provider>/<id>.tsv, so
# summing the per-session snapshots gives the rolling total across all terminals
# without double counting a single session's repeated reports.
function _omb_ai_blackthunder_session_sum_bars() {
  local provider="$1"
  local now="$2"
  local window="$3"
  local dir="$(_omb_ai_blackthunder_cache_dir)/providers/$provider"

  [[ -d "$dir" ]] || return

  # Keep glob qualifiers working and silent regardless of the user's options.
  setopt local_options bare_glob_qual null_glob no_nomatch

  local f line ts bars
  local -a vals
  for f in "$dir"/*.tsv(N.); do
    [[ -r "$f" ]] || continue
    line="$(< "$f")" 2>/dev/null || continue
    # If a file ever holds multiple lines, the last one is the latest snapshot.
    line="${line##*$'\n'}"
    IFS=$'\t' read -r ts bars <<< "$line"
    [[ "$ts" == <-> ]] || continue
    case "$bars" in
      (''|*[!0-9.]*|*.*.*) continue ;;
    esac
    (( now - ts >= 0 && now - ts <= window )) || continue
    vals+="$bars"
  done

  (( ${#vals} )) || return

  print -r -- "${vals[@]}" | awk '{
    sum = 0
    for (i = 1; i <= NF; i++) sum += $i
    if (sum > 0) print sum
  }'
}

function _omb_ai_blackthunder_event_bars() {
  local provider="$1"
  local now="$2"
  local window="$3"
  local file="$(_omb_ai_blackthunder_events_file "$provider")"

  [[ -r "$file" ]] || return

  awk -F '\t' -v now="$now" -v window="$window" '
    NF >= 2 && $1 ~ /^[0-9]+$/ && $2 ~ /^[0-9]+(\.[0-9]+)?$/ {
      age = now - $1
      if (age >= 0 && age <= window) {
        if (NF >= 3 && $3 != "") {
          if (seen[$3]++) {
            next
          }
        }
        sum += $2
      }
    }
    END {
      if (sum > 0) {
        print sum
      }
    }
  ' "$file"
}

function _omb_ai_blackthunder_legacy_prompt() {
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

  print -r -- "$provider	$bars"
}

function _omb_ai_blackthunder_prompt() {
  [[ "${OMB_AI_BLACKTHUNDER:-1}" == "0" ]] && return

  local now window claude_bars codex_bars formatted fields total label
  now="${EPOCHSECONDS:-$(date +%s 2>/dev/null)}"
  [[ "$now" == <-> ]] || return

  window="${OMB_AI_BLACKTHUNDER_WINDOW_SECONDS:-18000}"
  [[ "$window" == <-> ]] || window=18000

  claude_bars="$(_omb_ai_blackthunder_session_sum_bars Claude "$now" "$window")"
  # Fall back to the single-file snapshot for caches written before per-session
  # accumulation existed.
  [[ -n "$claude_bars" ]] || claude_bars="$(_omb_ai_blackthunder_snapshot_bars Claude "$now" "$window")"
  codex_bars="$(_omb_ai_blackthunder_event_bars Codex "$now" "$window")"

  if [[ -n "$claude_bars" || -n "$codex_bars" ]]; then
    fields="$(
      awk -v claude="${claude_bars:-0}" -v codex="${codex_bars:-0}" '
        function fmt(value) {
          value += 0
          if (value > 0 && value < 0.05) {
            return "0.1"
          }
          if (value >= 10) {
            return sprintf("%.0f", value)
          }
          return sprintf("%.1f", value)
        }

        BEGIN {
          claude += 0
          codex += 0
          total = claude + codex

          if (total <= 0) {
            exit
          }

          if (claude > 0 && codex > 0) {
            printf "%s\tClaude %s / Codex %s\n", fmt(total), fmt(claude), fmt(codex)
          } else if (claude > 0) {
            printf "%s\tClaude\n", fmt(claude)
          } else {
            printf "%s\tCodex\n", fmt(codex)
          }
        }
      '
    )"
  else
    fields="$(_omb_ai_blackthunder_legacy_prompt)"
    if [[ -n "$fields" ]]; then
      local legacy_provider legacy_bars
      IFS=$'\t' read -r legacy_provider legacy_bars <<< "$fields"
      fields="${legacy_bars}	${legacy_provider}"
    fi
  fi

  [[ -n "$fields" ]] || return
  IFS=$'\t' read -r total label <<< "$fields"
  [[ -n "$total" && -n "$label" ]] || return

  local gold="${OMB_GOLD:-}"
  local white="${OMB_WHITE:-}"
  local dim="${OMB_DIM:-}"

  [[ -n "$gold" ]] || gold='%F{#FFD300}'
  [[ -n "$white" ]] || white='%F{#FFFFFF}'
  [[ -n "$dim" ]] || dim='%F{#6A6A6A}'

  print -r -n -- "${gold}⚡${white}${total}本 ${dim}(${label})%f"
}
