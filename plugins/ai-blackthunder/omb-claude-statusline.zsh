#!/usr/bin/env zsh

function _omb_claude_statusline_main() {
  emulate -L zsh

  local script_dir root input fields cost_usd input_tokens output_tokens
  local price_jpy usd_jpy fallback_tokens bars timestamp cache_dir cache_file tmp_file

  script_dir="${${(%):-%x}:A:h}"
  root="${script_dir:h:h}"

  input="$(cat)"
  (( $+commands[jq] )) || return 0

  fields="$(
    print -r -- "$input" | jq -r '
      [
        (.cost.total_cost_usd // .cost.total_cost // 0),
        (
          (.context_window.total_input_tokens // null)
          // (
            (.context_window.current_usage.input_tokens // 0)
            + (.context_window.current_usage.cache_creation_input_tokens // 0)
            + (.context_window.current_usage.cache_read_input_tokens // 0)
          )
        ),
        (
          (.context_window.total_output_tokens // null)
          // (.context_window.current_usage.output_tokens // 0)
        )
      ] | @tsv
    ' 2>/dev/null
  )" || return 0

  IFS=$'\t' read -r cost_usd input_tokens output_tokens <<< "$fields"

  price_jpy="${OMB_BLACKTHUNDER_PRICE_JPY:-43}"
  usd_jpy="${OMB_USD_JPY:-160}"
  fallback_tokens="${OMB_BLACKTHUNDER_TOKENS_PER_BAR:-90000}"

  bars="$(
    awk \
      -v cost="$cost_usd" \
      -v input="$input_tokens" \
      -v output="$output_tokens" \
      -v price="$price_jpy" \
      -v usd="$usd_jpy" \
      -v fallback="$fallback_tokens" '
        function format_bars(value) {
          if (value > 0 && value < 0.05) {
            return "0.1"
          }
          if (value >= 10) {
            return sprintf("%.0f", value)
          }
          return sprintf("%.1f", value)
        }

        BEGIN {
          cost += 0
          input += 0
          output += 0
          price += 0
          usd += 0
          fallback += 0

          if (cost > 0 && price > 0 && usd > 0) {
            bars = cost * usd / price
          } else if (fallback > 0) {
            bars = (input + output * 5) / fallback
          } else {
            bars = 0
          }

          print format_bars(bars)
        }
      '
  )"

  [[ -n "$bars" ]] || return 0

  timestamp="$(date +%s 2>/dev/null)" || return 0
  cache_dir="${OMB_AI_BLACKTHUNDER_CACHE_DIR:-${OMB_CACHE_DIR:-$root/cache}/ai-blackthunder}"
  cache_file="${OMB_AI_BLACKTHUNDER_CACHE_FILE:-$cache_dir/last.tsv}"

  if mkdir -p "$cache_dir" 2>/dev/null; then
    tmp_file="$cache_file.$$"
    if print -r -- "${timestamp}	Claude	${bars}" > "$tmp_file" 2>/dev/null; then
      mv -f "$tmp_file" "$cache_file" 2>/dev/null || true
    else
      rm -f "$tmp_file" 2>/dev/null || true
    fi
  fi

  print -r -- "⚡${bars}本 (Claude)"
}

_omb_claude_statusline_main "$@"
