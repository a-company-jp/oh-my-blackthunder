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

## Install The Theme

For Oh My Zsh, copy or symlink the theme files into your custom themes
directory:

```zsh
mkdir -p ~/.oh-my-zsh/custom/themes
ln -sf "$PWD/themes/oh-my-black.zsh-theme" ~/.oh-my-zsh/custom/themes/oh-my-black.zsh-theme
ln -sf "$PWD/themes/blackthunder_ascii.txt" ~/.oh-my-zsh/custom/themes/blackthunder_ascii.txt
ln -sf "$PWD/themes/blackthunder_ascii_118.txt" ~/.oh-my-zsh/custom/themes/blackthunder_ascii_118.txt
ln -sf "$PWD/themes/blackthunder_ascii_79.txt" ~/.oh-my-zsh/custom/themes/blackthunder_ascii_79.txt
ln -sf "$PWD/themes/blackthunder_ascii_59.txt" ~/.oh-my-zsh/custom/themes/blackthunder_ascii_59.txt
```

Then set this in `~/.zshrc`:

```zsh
ZSH_THEME="oh-my-black"
```

## Minimal Runtime

`oh-my-black.sh` now resolves the install root and sources the enabled
plugins (and an optional theme). Wire it up from `~/.zshrc`:

```zsh
export OMB="$HOME/work/oh-my-blackthunder"   # path to this repo
plugins=(omb-games)
# OMB_THEME="oh-my-black"                     # optional prompt theme
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
└── games/                 # omb-break / pong / snake / dodge / drop / mine (.py)
```

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
