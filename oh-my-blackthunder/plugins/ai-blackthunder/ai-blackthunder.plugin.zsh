# AI usage module for Oh My Blackthunder.
#
# Providers write only tiny usage entries:
#   providers/Claude/<id>.tsv: <unix timestamp>\t<blackthunder bars>  (one per session, summed)
#   events/Codex.tsv:          <unix timestamp>\t<blackthunder bars>
#
# Claude reports each session's cumulative cost, so snapshots are kept per
# session and summed over the active window to accumulate across terminals.
# Codex session files are scanned for token_count events only. No prompts,
# transcripts, session IDs, or command output are stored.

_omb_ai_blackthunder_plugin_dir="${${(%):-%x}:A:h}"
_omb_ai_blackthunder_plugin_root="${_omb_ai_blackthunder_plugin_dir:h:h}"

if [[ -r "$_omb_ai_blackthunder_plugin_root/lib/ai-blackthunder.zsh" ]]; then
  source "$_omb_ai_blackthunder_plugin_root/lib/ai-blackthunder.zsh"
fi

function omb-codex-session() {
  "$_OMB_AI_BLACKTHUNDER_ROOT/plugins/ai-blackthunder/omb-codex-session.zsh" "$@"
}

function _omb_ai_blackthunder_codex_precmd() {
  [[ "${OMB_CODEX_SESSION_AUTO_SCAN:-1}" == "0" ]] && return

  local now interval
  now="${EPOCHSECONDS:-$(date +%s 2>/dev/null)}"
  [[ "$now" == <-> ]] || return

  interval="${OMB_CODEX_SESSION_PROMPT_SCAN_SECONDS:-30}"
  [[ "$interval" == <-> ]] || interval=30

  if [[ "${_OMB_AI_BLACKTHUNDER_CODEX_LAST_SCAN:-}" == <-> ]] \
    && (( now - _OMB_AI_BLACKTHUNDER_CODEX_LAST_SCAN < interval )); then
    return
  fi

  _OMB_AI_BLACKTHUNDER_CODEX_LAST_SCAN="$now"
  "$_OMB_AI_BLACKTHUNDER_ROOT/plugins/ai-blackthunder/omb-codex-session.zsh" scan --quiet 2>/dev/null || true
}

if [[ -o interactive ]] \
  && [[ -x "$_omb_ai_blackthunder_plugin_root/plugins/ai-blackthunder/omb-codex-session.zsh" ]]; then
  autoload -Uz add-zsh-hook 2>/dev/null || true
  if (( $+functions[add-zsh-hook] )); then
    add-zsh-hook precmd _omb_ai_blackthunder_codex_precmd
  elif [[ ${precmd_functions[(Ie)_omb_ai_blackthunder_codex_precmd]} -eq 0 ]]; then
    precmd_functions+=(_omb_ai_blackthunder_codex_precmd)
  fi
fi

unset _omb_ai_blackthunder_plugin_dir _omb_ai_blackthunder_plugin_root
