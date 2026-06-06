# AI usage module for Oh My Blackthunder.
#
# The Claude Code statusLine command writes a tiny cache entry:
#   <unix timestamp>\t<provider>\t<blackthunder bars>
#
# No prompts, transcripts, session IDs, or command output are stored.

_omb_ai_blackthunder_plugin_dir="${${(%):-%x}:A:h}"
_omb_ai_blackthunder_plugin_root="${_omb_ai_blackthunder_plugin_dir:h:h}"

if [[ -r "$_omb_ai_blackthunder_plugin_root/lib/ai-blackthunder.zsh" ]]; then
  source "$_omb_ai_blackthunder_plugin_root/lib/ai-blackthunder.zsh"
fi

unset _omb_ai_blackthunder_plugin_dir _omb_ai_blackthunder_plugin_root
