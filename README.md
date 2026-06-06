# Oh My Blackthunder

Oh My Blackthunder is a tiny zsh framework scaffold inspired by the
directory layout of [Oh My Zsh](https://github.com/ohmyzsh/ohmyzsh).

This repository is intentionally minimal for collaborative development.
The first goal is to agree on where code, plugins, themes, templates, and
tools should live before implementing the framework itself.

## Repository Layout

```text
.
├── .devcontainer/       # Optional shared development container settings
├── .github/             # GitHub issue and pull request workflow files
├── cache/               # Runtime cache directory; contents are ignored
├── custom/              # User or project overrides
│   ├── plugins/         # Custom plugin overrides
│   └── themes/          # Custom theme overrides
├── lib/                 # Core framework libraries
├── log/                 # Runtime logs; contents are ignored
├── plugins/             # Built-in plugins
├── templates/           # Generated user-facing config templates
├── themes/              # Built-in prompt themes
├── tools/               # Installer, doctor, upgrade, and maintenance tools
└── oh-my-black.sh       # Main framework entry point
```

## Development Rule Of Thumb

- Put framework behavior in `lib/`.
- Put optional user-facing features in `plugins/<name>/<name>.plugin.zsh`.
- Put prompts in `themes/<name>.zsh-theme`.
- Put generated config examples in `templates/`.
- Put scripts that operate on the repository or installation in `tools/`.
- Keep `custom/`, `cache/`, and `log/` safe for local-only files.

## Status

The first shared theme is available at `themes/oh-my-black.zsh-theme`.
The `ai-blackthunder` module can show recent AI usage as Black Thunder bars,
for example `⚡0.7本 (Claude)`.

## Install

Clone the repo **anywhere** (the path is not hardcoded — the installer
and runtime resolve it automatically), then run the installer:

```zsh
git clone git@github.com:a-company-jp/oh-my-blackthunder.git ~/.oh-my-blackthunder
~/.oh-my-blackthunder/tools/install.sh
```

The installer auto-detects your setup and wires everything up:

- **Oh My Zsh users** → symlinks `omb-games` and the theme into
  `$ZSH_CUSTOM`. Then add `omb-games` to `plugins=(...)` (and optionally
  `ZSH_THEME="oh-my-black"`) in `~/.zshrc`.
- **No Oh My Zsh** → appends a managed block to `~/.zshrc` that sets
  `OMB` to your clone path and sources the minimal runtime.

Re-running is safe (idempotent). Use `tools/install.sh --print` to see
the exact steps without changing anything. Reload with `exec zsh`, then
run `omb` to play.

> Games need `python3` (the installer warns if it is missing).

### Manual setup

If you would rather not run the installer:

**Oh My Zsh** — symlink the plugin and theme into your custom dir, then
enable them in `~/.zshrc`:

```zsh
ln -sfn "$PWD/plugins/omb-games" ~/.oh-my-zsh/custom/plugins/omb-games
ln -sf  "$PWD/themes/oh-my-black.zsh-theme" ~/.oh-my-zsh/custom/themes/oh-my-black.zsh-theme
for f in "$PWD"/themes/blackthunder_ascii*.txt; do
  ln -sf "$f" ~/.oh-my-zsh/custom/themes/"${f:t}"
done
# ~/.zshrc:  plugins=(... omb-games)   ZSH_THEME="oh-my-black"
```

**Standalone runtime** — `oh-my-black.sh` resolves its own install root
and sources the enabled plugins (and an optional theme):

## Claude Code Status Line

Claude Code can send status-line JSON to a local command. Oh My Blackthunder
uses that metadata to calculate how many Black Thunder bars the current Claude
session has used, then stores only a small cache entry for the prompt.

```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/oh-my-blackthunder/plugins/ai-blackthunder/omb-claude-statusline.zsh",
    "padding": 0
  }
}
```

The module stores only timestamp, provider, and calculated bar count in
`cache/ai-blackthunder/last.tsv`. It does not store prompts, transcripts,
session IDs, or command output.

Defaults:

```zsh
OMB_BLACKTHUNDER_PRICE_JPY=43
OMB_USD_JPY=160
OMB_AI_BLACKTHUNDER_TTL=600
```

## Minimal Runtime

`oh-my-black.sh` now resolves the install root and sources the enabled
plugins (and an optional theme). Wire it up from `~/.zshrc`:

```zsh
export OMB="$HOME/.oh-my-blackthunder"   # ← your actual clone path
plugins=(omb-games)
# OMB_THEME="oh-my-black"                 # optional prompt theme
source "$OMB/oh-my-black.sh"
```

Each entry in `plugins=(...)` loads `plugins/<name>/<name>.plugin.zsh`
(overridable via `custom/plugins/<name>/`).

## Plugins

### omb-games

Terminal mini-games with a Black Thunder motif (Python + `curses`).

```text
plugins/omb-games/
├── omb-games.plugin.zsh   # launcher: `omb` dispatcher + omb-<game> commands
└── games/
    ├── omb-break / pong / snake / dodge / drop / mine (.py)
    └── blackthunder_ascii.txt   # bundled art so the dir is self-contained
```

The plugin is self-contained: it works as a standalone plugin **and** as
an Oh My Zsh plugin, and `omb break` finds its art even when the folder
is copied somewhere else (no `OMB` required).

After enabling the plugin, run `omb` for the menu:

| Command | Game |
|---|---|
| `omb break` | ブロック崩し（ブラックサンダー AA を崩す） |
| `omb pong`  | 稲妻ピンポン（CPU 対戦） |
| `omb snake` | ザクザク・スネーク |
| `omb dodge` | イナズマ回避 |
| `omb drop`  | ザクッ・ドロップ（落ちもの） |
| `omb mine`  | マインスイーパー（`easy` / `normal` / `hard`） |

Requires `python3`. `omb break` uses `themes/blackthunder_ascii.txt`.
