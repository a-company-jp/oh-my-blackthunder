#!/usr/bin/env zsh
# =====================================================================
#  Oh My Blackthunder インストーラ
#
#  リポジトリを clone した後に実行すると、環境に合わせて自動配線する:
#
#    * Oh My Zsh あり … plugins/themes を $ZSH_CUSTOM に symlink。
#                       あとは ~/.zshrc の plugins=(... omb-games cat diff log ls tree vim fzf) と
#                       （任意で）ZSH_THEME="oh-my-black" を有効化するだけ。
#    * Oh My Zsh なし … ~/.zshrc に最小ランタイムの読み込みブロックを
#                       追記（OMB はこのリポジトリの実パスを自動設定）。
#
#  どちらの場合も「他のマシンに clone した場所」を自動で解決するので、
#  パスのハードコードは不要。何度実行しても安全（冪等）。
#
#  使い方:
#    git clone git@github.com:a-company-jp/oh-my-blackthunder.git ~/.oh-my-blackthunder
#    ~/.oh-my-blackthunder/tools/install.sh
#
#  オプション:
#    --print   変更を加えず、必要な手順だけ表示する
#
#  依存関係:
#    fzf が未導入で Homebrew が使える場合は、自動で brew install する。
# =====================================================================
emulate -L zsh
set -u

# このスクリプトの位置からリポジトリ(インストール)ルートを解決（symlink も :A で実体化）
SELF="${${(%):-%x}:A}"
OMB_ROOT="${SELF:h:h}"

PRINT_ONLY=0
[[ "${1:-}" == "--print" ]] && PRINT_ONLY=1

# ---- 小物 ----------------------------------------------------------
_say()  { print -P "%F{220}⚡%f $*" }
_ok()   { print -P "  %F{green}✓%f $*" }
_warn() { print -P "  %F{yellow}!%f $*" }
_run_or_print() {
  if (( PRINT_ONLY )); then
    print "  $*"
  else
    "$@"
  fi
}
_ensure_brew_package() {
  local cmd="$1" package="$2" label="$3"

  if command -v "$cmd" >/dev/null 2>&1; then
    _ok "$label 検出: $(command -v "$cmd")"
    return 0
  fi

  if command -v brew >/dev/null 2>&1; then
    _say "$label が見つかりません。Homebrew でインストールします。"
    if _run_or_print brew install "$package"; then
      if (( PRINT_ONLY )); then
        _ok "$label は brew install $package で導入されます"
        return 0
      fi
      if command -v "$cmd" >/dev/null 2>&1; then
        _ok "$label インストール完了: $(command -v "$cmd")"
        return 0
      fi
      _warn "brew install $package は完了しましたが PATH 上に $label が見つかりません。新しいシェルで再確認してください。"
      return 0
    fi
    _warn "$label の自動インストールに失敗しました。手動で 'brew install $package' を実行してください。"
    return 1
  fi

  _warn "$label が見つかりません。Homebrew などで手動インストールしてください。"
  return 1
}
_link() {
  # _link <src> <dst>  … dst が既に正しい symlink なら何もしない
  local src="$1" dst="$2"
  if [[ -L "$dst" && "${dst:A}" == "${src:A}" ]]; then
    _ok "既にリンク済み: ${dst/#$HOME/~}"
    return
  fi
  if [[ -e "$dst" && ! -L "$dst" ]]; then
    _warn "既存ファイルがあるためスキップ: ${dst/#$HOME/~}（手動で確認してください）"
    return
  fi
  if (( PRINT_ONLY )); then
    print "  ln -sfn '$src' '$dst'"
  else
    ln -sfn "$src" "$dst" && _ok "リンク作成: ${dst/#$HOME/~} → ${src/#$HOME/~}"
  fi
}

_say "Oh My Blackthunder インストーラ"
_say "リポジトリ: ${OMB_ROOT/#$HOME/~}"

# ---- python3 チェック（ゲームの必須要件）---------------------------
if command -v python3 >/dev/null 2>&1; then
  _ok "python3 検出: $(command -v python3)"
else
  _warn "python3 が見つかりません。ゲーム（omb <game>）には python3 が必要です。"
fi

# ---- CLI ラッパーの依存関係 ---------------------------------------
OMB_FZF_READY=0
_ensure_brew_package fzf fzf fzf && OMB_FZF_READY=1

OMB_DEFAULT_PLUGINS=(omb-games)
[[ -d "$OMB_ROOT/plugins/cat" ]] && OMB_DEFAULT_PLUGINS+=(cat)
OMB_DEFAULT_PLUGINS+=(diff)
[[ -d "$OMB_ROOT/plugins/log" ]] && OMB_DEFAULT_PLUGINS+=(log)
[[ -d "$OMB_ROOT/plugins/ls" ]] && OMB_DEFAULT_PLUGINS+=(ls)
[[ -d "$OMB_ROOT/plugins/tree" ]] && OMB_DEFAULT_PLUGINS+=(tree)
[[ -d "$OMB_ROOT/plugins/vim" ]] && OMB_DEFAULT_PLUGINS+=(vim)
(( OMB_FZF_READY )) && [[ -d "$OMB_ROOT/plugins/fzf" ]] && OMB_DEFAULT_PLUGINS+=(fzf)
OMB_DEFAULT_PLUGINS_TEXT="${(j: :)OMB_DEFAULT_PLUGINS}"

# ---- Oh My Zsh の検出 ----------------------------------------------
OMZ_DIR="${ZSH:-$HOME/.oh-my-zsh}"
if [[ -d "$OMZ_DIR" ]]; then
  # ============================ Oh My Zsh モード ====================
  ZSH_CUSTOM="${ZSH_CUSTOM:-$OMZ_DIR/custom}"
  _say "Oh My Zsh を検出: ${OMZ_DIR/#$HOME/~}（プラグイン/テーマを symlink します）"

  (( PRINT_ONLY )) || mkdir -p "$ZSH_CUSTOM/plugins" "$ZSH_CUSTOM/themes"

  # プラグイン一式
  _link "$OMB_ROOT/plugins/omb-games" "$ZSH_CUSTOM/plugins/omb-games"
  _link "$OMB_ROOT/plugins/cat" "$ZSH_CUSTOM/plugins/cat"
  _link "$OMB_ROOT/plugins/diff" "$ZSH_CUSTOM/plugins/diff"
  _link "$OMB_ROOT/plugins/log" "$ZSH_CUSTOM/plugins/log"
  _link "$OMB_ROOT/plugins/ls" "$ZSH_CUSTOM/plugins/ls"
  _link "$OMB_ROOT/plugins/tree" "$ZSH_CUSTOM/plugins/tree"
  _link "$OMB_ROOT/plugins/vim" "$ZSH_CUSTOM/plugins/vim"
  [[ -d "$OMB_ROOT/plugins/fzf" ]] && _link "$OMB_ROOT/plugins/fzf" "$ZSH_CUSTOM/plugins/fzf"

  # テーマ + AA ファイル
  _link "$OMB_ROOT/themes/oh-my-black.zsh-theme" "$ZSH_CUSTOM/themes/oh-my-black.zsh-theme"
  local _aa
  for _aa in "$OMB_ROOT"/themes/blackthunder_ascii*.txt; do
    [[ -f "$_aa" ]] && _link "$_aa" "$ZSH_CUSTOM/themes/${_aa:t}"
  done

  print
  _say "あと一歩。~/.zshrc を次のように編集してください:"
  print "    plugins=(... $OMB_DEFAULT_PLUGINS_TEXT) # ← 使いたいプラグインを追加"
  print "    ZSH_THEME=\"oh-my-black\"        # ← 任意（黒×金の稲妻プロンプト）"
  (( OMB_FZF_READY )) || print "    # fzf を導入後に fzf プラグインを追加できます"
  print
  _say "反映:  exec zsh   （または新しいターミナルを開く）"
  _say "遊ぶ:  omb        （ゲーム一覧）"

else
  # ============================ 単体ランタイムモード ================
  _say "Oh My Zsh は未検出。単体ランタイムとして ~/.zshrc に配線します。"
  local ZRC="$HOME/.zshrc"
  local MARK_BEGIN="# >>> oh-my-blackthunder >>>"
  local MARK_END="# <<< oh-my-blackthunder <<<"

  local block
  block="$MARK_BEGIN
# Oh My Blackthunder（このブロックは install.sh が管理。手動編集可）
export OMB=\"$OMB_ROOT\"
plugins=($OMB_DEFAULT_PLUGINS_TEXT)
# OMB_THEME=\"oh-my-black\"   # 任意のプロンプトテーマ
[ -r \"\$OMB/oh-my-black.sh\" ] && source \"\$OMB/oh-my-black.sh\"
$MARK_END"

  if (( PRINT_ONLY )); then
    _say "~/.zshrc に次を追記してください:"
    print -- "$block"
  elif [[ -f "$ZRC" ]] && grep -qF "$MARK_BEGIN" "$ZRC"; then
    # 既存ブロックを最新の OMB パスで置き換え（冪等）
    local TMP="${ZRC}.omb.tmp"
    awk -v b="$MARK_BEGIN" -v e="$MARK_END" '
      $0==b {skip=1}
      skip==0 {print}
      $0==e {skip=0}
    ' "$ZRC" > "$TMP"
    printf '%s\n' "$block" >> "$TMP"
    mv "$TMP" "$ZRC"
    _ok "~/.zshrc の既存ブロックを更新しました（OMB=$OMB_ROOT）"
  else
    printf '\n%s\n' "$block" >> "$ZRC"
    _ok "~/.zshrc にブロックを追記しました（OMB=$OMB_ROOT）"
  fi

  print
  _say "反映:  exec zsh   （または新しいターミナルを開く）"
  _say "遊ぶ:  omb        （ゲーム一覧）"
fi
