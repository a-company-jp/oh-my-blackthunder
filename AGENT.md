# Monorepo Overview (for agents)

This repository is a **monorepo** for Black Thunder–themed apps and tools.
It began from a hackathon hosted by 有楽製菓株式会社（ユーラク）, the company
that produces the Black Thunder chocolate bar.

Each app lives in its own top-level directory and is **self-contained**:
it has its own README, runtime entry point, and (when it generates local
output) its own `.gitignore`. Repository-wide concerns live at the root.

## Where things live

```text
.
├── .devcontainer/       # Shared dev container (repo-wide)
├── .github/             # Issue / PR templates, workflows (repo-wide)
├── .editorconfig        # Shared editor config (repo-wide)
├── .gitignore           # Repo-wide ignores only (OS, *.zwc, __pycache__)
└── oh-my-blackthunder/  # App: zsh framework — see oh-my-blackthunder/AGENT.md
```

## Rules of thumb for agents

- **Work inside the relevant app directory.** App-specific code, docs, and
  ignore rules belong to that app, not the repo root.
- Each app's own `AGENT.md` / `README.md` is the source of truth for that
  app's layout and conventions.
- Put a new app at the repository root as its own directory; do **not**
  scatter app files into the root.
- Anchor app-level `.gitignore` patterns to the app folder (leading `/`),
  so runtime output like `cache/`, `log/`, `custom/` is ignored correctly
  now that apps are nested.
- Keep the root `.gitignore` to repo-wide concerns only.

## Style

- Thunder Yellow: RGB(255,211,0)
- Thunder Red: RGB(230,0,18)
- Normal White: #FFFFFF

## Company and product

- 有楽製菓株式会社（ユーラク）: https://www.yurakuseika.co.jp
- Black Thunder chocolate bar: https://www.yurakuseika.co.jp/product/265/
