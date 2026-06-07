# blackthunder-claude-code ⚡🍫

Make [Claude Code](https://claude.com/claude-code) wear a **Black Thunder** coat.

Two things get themed, both via plain `settings.json` — **no patching, no rebuild,
survives Claude Code auto-updates**:

1. **Spinner verbs** — the animated word that flashes just above the input box
   while Claude is working (normally "Considering…", "Consolidating…"). We replace
   it with ~45 Japanese Black Thunder one-liners like **「準チョコ精製中…」「ザクザク採掘中…」「一目で義理判定…」**.
2. **Status line** — the bottom line of the TUI shows
   **`⚡ Black Thunder ⚡ <model> ・ 📁 <dir> ・ 🍫 <ザクザク tip>`**.

> The trailing `…` on spinner verbs is added by Claude Code automatically, so the
> configured strings don't include it.

![concept](#) <!-- placeholder: drop a screenshot here -->

## ⚡ Quick try (clone & open)

The settings live in this repo's **root `.claude/settings.json`** (project-scoped
settings), so you just clone and start Claude Code *inside the repo*:

```sh
git clone https://github.com/a-company-jp/oh-my-blackthunder
cd oh-my-blackthunder
claude            # ← spinner + status line are already Black Thunder
```

On first launch Claude Code asks you to **trust the workspace** — accept it so the
status-line script is allowed to run. The spinner verbs work with or without trust.

## How it works

It's two official Claude Code settings keys, both in the repo-root
[`.claude/settings.json`](../.claude/settings.json):

```jsonc
{
  "spinnerVerbs": {
    "mode": "replace",          // "replace" = only ours; "append" = ours + the stock ~179
    "verbs": ["準チョコ精製中", "ザクザク採掘中", "一目で義理判定", /* … 45 total */]
  },
  "statusLine": {
    "type": "command",
    "command": "bash \"$CLAUDE_PROJECT_DIR/blackthunder-claude-code/statusline.sh\"",
    "padding": 0
  }
}
```

- `spinnerVerbs` — officially supported since recent Claude Code. `mode: "replace"`
  shows **only** the Black Thunder verbs; switch to `"append"` to keep the stock
  vocabulary and just add ours.
- `statusLine` runs [`statusline.sh`](./statusline.sh) on every render and shows its
  first stdout line. `$CLAUDE_PROJECT_DIR` is provided by Claude Code and points at
  the repo root, so the path resolves no matter which subdirectory you're in.

[`statusline.sh`](./statusline.sh) reads the JSON Claude Code pipes in
(`{ model: { display_name }, workspace: { current_dir, project_dir } }`), uses `jq`
when present (with a dependency-free grep/sed fallback), and prints the themed line
with a random ザクザク tip.

## Use it in your own project

Copy the two keys into **your** project's `.claude/settings.json` (or your personal
`~/.claude/settings.json` for every project), and copy `statusline.sh` somewhere your
`command` path can reach. Settings precedence (high → low):

| Scope | File | Committed? |
|---|---|---|
| Personal, this project | `.claude/settings.local.json` | gitignored |
| **Shared, this project** | **`.claude/settings.json`** | **committed** ← used here |
| You, everywhere | `~/.claude/settings.json` | — |

A project `.claude/settings.json` **overrides** the user `~/.claude/settings.json`
for the same key, so this repo's theme wins while you're working inside it.

### Just the spinner, no status line

Drop the `statusLine` block and keep only `spinnerVerbs` — no script needed.

## Customizing the verbs

Edit the `verbs` array in [`.claude/settings.json`](../.claude/settings.json). Tips:

- Keep them short (~3–12 chars) and **don't** add a trailing `…` (Claude Code adds it).
- Japanese, multibyte, any length — all fine (this is config, not a binary patch).
- `mode: "append"` if you want the stock verbs mixed in.

## Notes

- This does **not** modify the Claude Code binary and is **not** lost on auto-update.
- Requires a Claude Code version new enough to support `spinnerVerbs` (verified on
  2.1.x). If your version doesn't know the key, it's simply ignored — the status line
  still works.
