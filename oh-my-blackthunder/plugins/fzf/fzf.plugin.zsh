# Black Thunder styled fzf wrapper.

function thunder_fzf() {
  emulate -L zsh

  if (( ! $+commands[fzf] )); then
    print -P "%F{red}fzf is required%f"
    print -P "%F{red}Please install fzf and try again.%f"
    print -P "%F{red}ref: https://github.com/junegunn/fzf/tree/master#installation%f"
    return 1
  fi

  local -a _omb_fzf_opts
  _omb_fzf_opts=(
    --ansi
    "--height=${OMB_FZF_HEIGHT:-40%}"
    "--layout=${OMB_FZF_LAYOUT:-reverse}"
    "--border=${OMB_FZF_BORDER:-rounded}"
    "--border-label=${OMB_FZF_BORDER_LABEL:- ⚡ Black Thunder ⚡ }"
    "--prompt=${OMB_FZF_PROMPT:-⚡ }"
    "--pointer=${OMB_FZF_POINTER:-⚡}"
    "--marker=${OMB_FZF_MARKER:-◆}"
    "--info=${OMB_FZF_INFO:-inline-right}"
    --highlight-line
    --color='fg:#FFFFFF,bg:#000000,hl:#FFD300,fg+:#FFFFFF,bg+:#1A1A1A,hl:#FFD300,hl+:#FFD300,pointer:#FFD300,marker:#E60012,prompt:#FFD300,spinner:#E60012,info:#FFFFFF,header:#FFD300,border:#E60012,label:#FFD300,gutter:#000000,query:#FFFFFF'
  )

  command fzf "${_omb_fzf_opts[@]}" "$@"
}

alias blackthunder_fzf='thunder_fzf'
