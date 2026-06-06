# Black Thunder styled Vim launcher.

function _omb_vim_style_file() {
  local style_file="${TMPDIR:-/tmp}/oh-my-blackthunder-vim-style.vim"

  {
    print -r "if has('termguicolors')"
    print -r "  set termguicolors"
    print -r "endif"
    print -r "set background=dark"
    print -r "syntax enable"
    print -r "set cursorline"
    print -r "set laststatus=2"
    print -r "let &statusline = '⚡ Black Thunder  %f %m%r%=%l:%c'"
    print -r "highlight Normal guifg=#FFFFFF guibg=#050505 ctermfg=15 ctermbg=0"
    print -r "highlight CursorLine guibg=#1A1A1A ctermbg=236"
    print -r "highlight LineNr guifg=#FFD300 guibg=#050505 ctermfg=11 ctermbg=0"
    print -r "highlight CursorLineNr guifg=#FFD300 guibg=#1A1A1A gui=bold ctermfg=11 ctermbg=236 cterm=bold"
    print -r "highlight StatusLine guifg=#050505 guibg=#FFD300 gui=bold ctermfg=0 ctermbg=11 cterm=bold"
    print -r "highlight StatusLineNC guifg=#FFFFFF guibg=#E60012 ctermfg=15 ctermbg=1"
    print -r "highlight VertSplit guifg=#E60012 guibg=#050505 ctermfg=1 ctermbg=0"
    print -r "highlight Search guifg=#050505 guibg=#FFD300 ctermfg=0 ctermbg=11"
    print -r "highlight IncSearch guifg=#FFFFFF guibg=#E60012 ctermfg=15 ctermbg=1"
    print -r "highlight Visual guifg=#FFFFFF guibg=#5A0008 ctermfg=15 ctermbg=52"
    print -r "highlight ErrorMsg guifg=#FFFFFF guibg=#E60012 gui=bold ctermfg=15 ctermbg=1 cterm=bold"
    print -r "highlight WarningMsg guifg=#FFD300 guibg=#050505 gui=bold ctermfg=11 ctermbg=0 cterm=bold"
    print -r "highlight Comment guifg=#FFD300 guibg=#050505 ctermfg=11 ctermbg=0"
    print -r "highlight Constant guifg=#FFD300 ctermfg=11"
    print -r "highlight Statement guifg=#FFD300 gui=bold ctermfg=11 cterm=bold"
    print -r "highlight Identifier guifg=#FFFFFF ctermfg=15"
    print -r "highlight Type guifg=#FFD300 ctermfg=11"
    print -r "highlight PreProc guifg=#E60012 ctermfg=1"
    print -r "highlight Error guifg=#FFFFFF guibg=#E60012 ctermfg=15 ctermbg=1"
  } > "$style_file"

  print -r -- "$style_file"
}

function thunder_vim() {
  emulate -L zsh

  local vim_cmd
  if (( $+commands[vim] )); then
    vim_cmd=vim
  elif (( $+commands[vi] )); then
    vim_cmd=vi
  else
    print -P "%F{red}vim or vi is required%f"
    return 1
  fi

  command "$vim_cmd" -S "$(_omb_vim_style_file)" "$@"
}

alias blackthunder_vim='thunder_vim'
