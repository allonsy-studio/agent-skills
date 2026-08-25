# Dependency rules and install order

Two tools "depend" on each other here if installing them in the wrong order costs the
reader real time — a re-run of an installer, a hunt through settings, or an error whose
cause is three steps back. That is a lower bar than a strict package dependency, and it
is the right bar for a setup guide.

## The layer model

Resolve the selected tools into these layers and emit them in this order. Within a layer,
order does not matter; use the order the reader chose.

| Layer | Contents | Why it sits here |
|---|---|---|
| 0 | Platform prerequisites: Xcode Command Line Tools, Windows build tools, `apt update` | Everything below assumes these exist |
| 1 | System package managers: Homebrew, winget, Scoop, Chocolatey, apt/dnf/pacman | They install most of what follows |
| 2 | Editor: VS Code, Zed, Cursor, Neovim | Git's Windows installer asks you to pick one, and config files get edited later |
| 3 | Version control: Git, GitHub CLI | Later steps clone repositories |
| 4 | Version managers: nvm, fnm, Volta, uv, pyenv, rustup, SDKMAN, mise, asdf | They install the runtime, so they precede it |
| 5 | Runtimes: Node, Python, PHP, Ruby, Go, Java | The bulk of most guides |
| 6 | Services: Docker, PostgreSQL, MySQL, Redis | Often installed via layer 1 or 5 |
| 7 | Global CLIs: anything via `npm -g`, `pipx`, `cargo install`, `go install` | Needs its runtime present |

## Hard edges

These orderings are not negotiable. Violating them produces a guide that fails.

- **Homebrew before anything installed with `brew`.** On macOS this covers PHP,
  PostgreSQL, MySQL, Redis, and often the version managers.
- **Xcode Command Line Tools before Homebrew.** Homebrew installs them itself, but naming
  the step sets expectations about a long download rather than a hung terminal.
- **Editor before Git**, on any guide including Windows. The Git installer's editor screen
  defaults to Vim, and a reader who accepts that default gets trapped in an editor with no
  visible exit. Choosing VS Code there requires VS Code to already exist.
- **A version manager before its runtime.** If the reader picked nvm, the Node section is
  `nvm install --lts`, not a download from nodejs.org. Do not emit both. On Windows this is
  not merely redundant: an existing Node install is exactly what stops nvm-windows from
  working, so a guide that emits both leaves the reader with a version manager that
  silently does nothing.
- **Runtime before its global CLIs.** `npm install -g` needs Node.
- **Git before any step that clones.** Including "clone the starter repo" in a later step.

## Soft edges

Worth following, cheap to break.

- Docker Desktop late. It is large, it wants a restart, and it is not needed to verify
  anything before it.
- Databases after the runtime that will connect to them, so the connection test in the
  database step can use that runtime.
- GitHub CLI right after Git, so authentication happens once.
- On Windows, the PowerShell execution policy change belongs with Node, since `npm` is the
  first thing it blocks.

## Version managers, grouped with what they manage

When a reader selects a runtime, ask how they want to manage its versions and default to
the first option. Emit the manager as its own numbered step immediately before the runtime.

| Runtime | Default | Alternatives | Note |
|---|---|---|---|
| Node.js | **nvm** | fnm, Volta, mise, direct installer | On macOS and Linux this is `nvm-sh/nvm`. On Windows it is `coreybutler/nvm-windows`, a separate project with different syntax (`nvm install lts`, no double dash), an administrator requirement for `nvm use`, and a hard requirement to uninstall Node first. Emit both, clearly labeled. fnm and Volta avoid the split if the choice is still open. |
| Python | **uv** | pyenv, mise, python.org installer | uv manages interpreters and virtual environments in one tool. For `first-time` audiences a plain python.org install is often kinder: fewer concepts before the first program runs. |
| Ruby | **mise** | rbenv, rvm, chruby | The system Ruby on macOS should not be used for projects. Say so. |
| Java | **SDKMAN** | Temurin installer, mise | SDKMAN is shell-based and needs extra work on Windows; prefer the Temurin installer there. |
| Rust | **rustup** | — | rustup is the official path. There is no decision to make. |
| PHP | **Homebrew** (macOS), **windows.php.net** (Windows), **distro package or ondrej PPA** (Linux) | — | PHP has no cross-platform version manager worth teaching a beginner. |
| Several at once | **mise** | asdf | If the reader picked three or more runtimes, offer mise as a single replacement for three version-manager steps, and say what they give up: one more tool to learn, and per-tool docs that assume you did not use it. |

## uv changes the Python section

If the reader picked uv, the Python step is not "install Python". uv installs interpreters
on demand. The step becomes: install uv, then `uv python install`, then create a project
with `uv init` and a virtual environment with `uv venv`. Do not also send them to
python.org — two Pythons on one machine is the most common source of "it works in the
terminal but not in my editor".

Say which Python the editor should point at, explicitly, because uv's interpreters live
somewhere the editor will not guess.

## Resolution algorithm

1. Expand each selection into its implied prerequisites (a `brew`-installed tool implies
   Homebrew, which implies Xcode CLT on macOS).
2. Deduplicate. Homebrew appears once no matter how many things need it.
3. Sort by layer, then by the reader's stated order within a layer.
4. Number the steps. Number the guide, not the layers — a guide with no editor still
   starts at step 1.
5. Where a prerequisite was added rather than chosen, say so in one line at that step, so
   the reader knows why they are installing something they did not ask for.

`scripts/order-tools.js` implements this. Use it rather than sorting by hand when more
than four tools are selected.
