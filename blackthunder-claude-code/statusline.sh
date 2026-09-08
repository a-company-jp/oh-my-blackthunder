#!/usr/bin/env bash
# Black Thunder statusline for Claude Code.
#
# Concept: an output that makes you *crave* a certain ザクザク雷チョコ — without
# ever naming it. We lean on その食感・糖分・カカオ・義理・30円 で攻める。
#
# Claude Code feeds this script a JSON object on stdin and shows the FIRST line
# of stdout as the bottom status line. We render:
#
#   ⚡ Black Thunder ⚡ 〈model〉 ・ 📁 〈dir〉 ・ 🍫 〈時間帯で変わる食べたくなるtip〉
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

# --- pick a random element of an array --------------------------------------
pick() {
  # $@ = list items; echoes one at random
  local n=$#
  [ "$n" -eq 0 ] && return
  eval "printf '%s' \"\${$(( (RANDOM % n) + 1 ))}\""
}

# --- 時間帯で変化: bucket the current hour -----------------------------------
# Each bucket has its own emoji + a craving-themed pool. ブラックサンダーは直接
# 出さず、食感(ザクザク)・糖分・カカオ・義理・30円 で「食べたくなる」を誘う。
hour="$(date +%H)"; hour="${hour#0}"; [ -z "$hour" ] && hour=0

if   [ "$hour" -ge 5 ] && [ "$hour" -lt 11 ]; then
  # 朝: 目覚めの一撃
  icon="🌅"
  tips=(
    "朝イチに雷を一発"
    "目覚めはザクザクから"
    "今日の糖分、まだゼロ"
    "コーヒーの相棒が欲しい頃"
    "朝の脳にカカオを"
  )
elif [ "$hour" -ge 11 ] && [ "$hour" -lt 14 ]; then
  # 昼: ランチ後の口さみしさ
  icon="🍽️"
  tips=(
    "ランチの〆に何か甘いの"
    "食後のザクザクを所望"
    "口がカカオを欲してる"
    "デザートは雷味で"
    "もう一口、何か欲しい"
  )
elif [ "$hour" -ge 14 ] && [ "$hour" -lt 17 ]; then
  # おやつ時(15時): 黄金タイム
  icon="🫖"
  tips=(
    "15時、おやつの時間です"
    "ザクザク補給のゴールデンタイム"
    "30円の幸せ、いかが？"
    "そろそろ歯で雷を鳴らしたい"
    "ティータイムにクランチを"
    "糖分が今、呼んでいる"
  )
elif [ "$hour" -ge 17 ] && [ "$hour" -lt 21 ]; then
  # 夕方: 仕事終わりのご褒美
  icon="🌇"
  tips=(
    "お疲れ自分にザクザクを"
    "夕方の糖分タンク、残量わずか"
    "ご褒美はバキバキ系で"
    "義理じゃなく本命の一個を"
    "今日の頑張りにカカオを"
  )
else
  # 深夜/早朝: 罪悪感ゼロの背徳タイム
  icon="🌙"
  tips=(
    "深夜の糖分は格別らしい"
    "今食べれば罪悪感は明日の自分が"
    "夜更けにザクザク、背徳の音"
    "誰も見てない、雷を一口"
    "コードと夜食、相性は雷級"
    "残業のお供にカカオ砲"
  )
fi

# --- いつでも刺さる「食べたくなる」汎用tip(時間帯プールに混ぜる) ----------
universal=(
  "ザクザク食べたくなってきた"
  "あのクランチ食感が恋しい"
  "今すぐ袋を破りたい衝動"
  "歯ごたえが脳裏をよぎる"
  "カカオ不足を感知"
  "口の中で雷を鳴らしたい"
  "義理だけど、つい本気で食べる"
  "30円で買える多幸感"
  "準チョコだけど本気の旨さ"
  "コンビニ寄り道センサー作動"
)

# merge bucket tips + a couple of universal ones, then pick
tips+=("${universal[@]}")
tip="$(pick "${tips[@]}")"

# --- 見た目の刷新: subtle color when the terminal supports it ----------------
# Disabled automatically when stdout isn't a TTY or NO_COLOR is set.
if [ -z "$NO_COLOR" ] && { [ -t 1 ] || [ "$CLICOLOR_FORCE" = "1" ]; }; then
  Y=$'\033[33m'   # 雷(黄)
  D=$'\033[90m'   # 区切り(薄灰)
  C=$'\033[36m'   # model(シアン)
  R=$'\033[0m'    # reset
  B=$'\033[1m'    # bold
else
  Y=""; D=""; C=""; R=""; B=""
fi

sep="${D} ⚡ ${R}"

# --- print (first line is what Claude Code shows) ---------------------------
printf '%b%b⚡ Black Thunder ⚡%b %b%s%b%b%b📁 %s%b%b🍫 %s %s%b\n' \
  "$B" "$Y" "$R" \
  "$C" "$model" "$R" \
  "$sep" "$D" "$base" "$R" \
  "$sep" "$tip" "$icon" "$R"
