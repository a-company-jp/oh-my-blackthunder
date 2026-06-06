# Project Overview
This project began from the hackathon hosted by 有楽製菓株式会社（ユーラク） which is the company that produce Black Thunder chocolate bar.
We're developing a Zsh extension that enhances your terminal experience by providing beautiful themes and useful custom tools.
The main difference between this project and Oh My Zsh is the style.
We use custom style which called "Black Thunder Style" to make the terminal looks more modern and elegant.
Black Thunder style is inspired by the popular japanese chocolate bar.

# Company and product information
有楽製菓株式会社（ユーラク）: https://www.yurakuseika.co.jp
Black Thunder chocolate bar: https://www.yurakuseika.co.jp/product/265/

# Style
- Thunder Yellow: RGB(255,211,0)
- Thunder Red: RGB(230,0,18)
- Normal White: #FFFFFF


# Features and core functionality
- Terminal Themes: We offer a Black Thunder style theme that transforms your terminal's appearance, making it visually appealing and enjoyable to use.
- Useful Custom Tools: Our extension includes a variety of custom tools that enhance your terminal experience, such as productivity boosters, system monitoring utilities, and more.

# Repo layout and important directories
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

# How to run the project
Already setup the terminal by .zshrc, so you can just open the new terminal.

# Build, test, and lint commands
N/A for now

# What done means and how to verify work
Done when you think the implementation is done.
