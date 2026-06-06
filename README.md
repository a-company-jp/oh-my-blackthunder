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
