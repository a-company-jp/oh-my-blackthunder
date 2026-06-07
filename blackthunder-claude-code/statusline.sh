#!/usr/bin/env bash
# Black Thunder statusline for Claude Code.
#
# Claude Code feeds this script a JSON object on stdin and shows the FIRST line
# of stdout as the bottom status line. We render a ⚡ザクザク themed line:
#
#   ⚡ Black Thunder ⚡ 〈model〉 ・ 📁 〈dir〉 ・ 🍫 〈zakuzaku tip〉
#
# stdin JSON (Claude Code statusLine contract):
#   { "model": { "display_name": "Claude Opus 4.8" },
#     "workspace": { "current_dir": "/abs/path", "project_dir": "/abs/path" } }
#
# No external deps required: uses jq when available, else a tiny grep/sed fallback.

input="$(cat)"

# --- extract fields (jq preferred, grep fallback) ---------------------------
json_get() {
  # $1 = jq filter, $2 = grep key (for fallback)
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null
  else
    # naive fallback: first "key": "value" match
    printf '%s' "$input" \
      | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
      | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'
  fi
}

model="$(json_get '.model.display_name' 'display_name')"
dir="$(json_get '.workspace.current_dir' 'current_dir')"

[ -z "$model" ] && model="Claude"
[ -z "$dir" ]   && dir="$PWD"
base="$(basename "$dir")"

# --- a random ザクザク tip (changes each render) -----------------------------
tips=(
  "ザクザク稼働中"
  "おいしさイナズマ級"
  "一目で義理とわかるコード"
  "準チョコ品質で実装中"
  "雷を込めてビルド中"
  "ココアクッキー級の歯ごたえ"
  "バキバキにキメていけ"
  "30円の本気"
)
tip="${tips[$((RANDOM % ${#tips[@]}))]}"

# --- print (first line is what Claude Code shows) ---------------------------
printf '⚡ Black Thunder ⚡ %s ・ 📁 %s ・ 🍫 %s\n' "$model" "$base" "$tip"
