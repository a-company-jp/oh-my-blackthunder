# Black Thunder Monorepo

A collection of apps and tools built around the **Black Thunder Style** —
inspired by the popular Japanese chocolate bar from
[有楽製菓株式会社（ユーラク）](https://www.yurakuseika.co.jp).

This repository is a monorepo: each app lives in its own top-level
directory with its own README, runtime, and `.gitignore`. Shared
repository concerns (CI, issue/PR templates, dev container, editor
config) live at the root.

## Apps

| App | Description |
|---|---|
| [`oh-my-blackthunder/`](./oh-my-blackthunder/) | A tiny zsh framework (themes, plugins, games, AI usage meters) inspired by Oh My Zsh. See its [README](./oh-my-blackthunder/README.md). |
| [`blackthunder-chrome/`](./blackthunder-chrome/) | **ThunderCaptcha** — a Chrome (MV3) extension that gates GitHub PR merges behind a Black Thunder "snack verification" captcha, then rains Black Thunders. See its [README](./blackthunder-chrome/README.md). |

> More apps will be added as sibling directories at the repository root.

## Repository Layout

```text
.
├── .devcontainer/       # Shared development container settings (repo-wide)
├── .github/             # Issue / PR templates and workflows (repo-wide)
├── .editorconfig        # Shared editor config (repo-wide)
├── .gitignore           # Repo-wide ignores (OS, compiled, bytecode)
└── oh-my-blackthunder/  # App: zsh framework (self-contained, own .gitignore)
```

## Adding a new app

1. Create a new top-level directory, e.g. `my-app/`.
2. Give it its own `README.md` and, if it produces local runtime output,
   its own `.gitignore` (anchor patterns to that folder, e.g. `/cache/*`).
3. Keep the app self-contained so it can be cloned/used independently.

## Style

- Thunder Yellow: RGB(255,211,0)
- Thunder Red: RGB(230,0,18)
- Normal White: #FFFFFF

## License

See [LICENSE.txt](./LICENSE.txt).
