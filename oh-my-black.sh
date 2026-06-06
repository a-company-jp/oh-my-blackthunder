# Main entry point for Oh My Blackthunder.
#
# Minimal runtime: resolves the install root, then sources the enabled
# plugins (and an optional theme). Kept intentionally small — richer
# features (lib autoloading, completion, update checks) come later.
#
# Usage (see templates/zshrc.zsh-template):
#   export OMB="$HOME/work/oh-my-blackthunder"
#   plugins=(omb-games)
#   OMB_THEME="oh-my-black"      # optional
#   source "$OMB/oh-my-black.sh"

# Resolve install root: honor $OMB, else derive from this file's location.
: ${OMB:="${${(%):-%x}:A:h}"}
export OMB

# Load enabled plugins:  plugins/<name>/<name>.plugin.zsh
# (custom/plugins/<name> overrides the built-in one.)
typeset -ga plugins
local _omb_p _omb_f
for _omb_p in $plugins; do
  for _omb_f in \
    "$OMB/custom/plugins/$_omb_p/$_omb_p.plugin.zsh" \
    "$OMB/plugins/$_omb_p/$_omb_p.plugin.zsh"
  do
    if [[ -r "$_omb_f" ]]; then
      source "$_omb_f"
      break
    fi
  done
done
unset _omb_p _omb_f

# Optional theme:  themes/<OMB_THEME>.zsh-theme
# (custom/themes/<name> overrides the built-in one.)
if [[ -n "${OMB_THEME:-}" ]]; then
  local _omb_t
  for _omb_t in \
    "$OMB/custom/themes/$OMB_THEME.zsh-theme" \
    "$OMB/themes/$OMB_THEME.zsh-theme"
  do
    if [[ -r "$_omb_t" ]]; then
      source "$_omb_t"
      break
    fi
  done
  unset _omb_t
fi
