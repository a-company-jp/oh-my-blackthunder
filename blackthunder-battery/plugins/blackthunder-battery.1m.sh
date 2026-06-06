#!/bin/bash
# <xbar.title>Black Thunder Battery</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>yamadahayato</xbar.author>
# <xbar.desc>ブラックサンダーの板チョコでバッテリー残量を表示。減るとチョコが食べられていく。</xbar.desc>
# <xbar.dependencies>python3,Pillow</xbar.dependencies>
#
# SwiftBar 用プラグイン。ファイル名の .1m が更新間隔(1分)。

ASSETS="/Users/yamadahayato/blackthunder-battery"
PY="$ASSETS/venv/bin/python"

batt="$(pmset -g batt)"
pct="$(printf '%s' "$batt" | grep -Eo '[0-9]+%' | head -1 | tr -d '%')"
[ -z "$pct" ] && pct=0
state="$(printf '%s' "$batt" | grep -Eo 'charging|discharging|charged|AC attached|finishing charge' | head -1)"
timeleft="$(printf '%s' "$batt" | grep -Eo '[0-9]+:[0-9]+ remaining' | head -1)"

charging=0
case "$state" in charging|charged|"finishing charge"|"AC attached") charging=1 ;; esac

# メニューバー用のチョコ画像(base64)を生成
img="$("$PY" "$ASSETS/render.py" "$pct" "$charging")"

bolt=""
[ "$charging" = "1" ] && bolt="⚡"

# ── メニューバー表示 ──
echo "${pct}%${bolt} | image=${img} font=Menlo size=11"

# ── ドロップダウン ──
echo "---"
echo "🍫 ブラックサンダー バッテリー | size=13"
echo "残量: ${pct}%"
case "$charging" in
  1) echo "状態: 充電中 ⚡" ;;
  *) echo "状態: 放電中" ;;
esac
[ -n "$timeleft" ] && echo "残り: ${timeleft% remaining}"
echo "---"
echo "今すぐ更新 | refresh=true"
echo "素材フォルダを開く | bash=/usr/bin/open param1=\"$ASSETS\" terminal=false"
