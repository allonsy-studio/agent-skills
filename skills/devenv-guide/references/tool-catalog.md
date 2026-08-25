# Tool catalog

Per-tool source material. Read only the entries for the tools that were selected.

**No version numbers appear in this file, on purpose.** They go stale faster than the
file gets updated, and a wrong version number in a setup guide sends readers to the wrong
download. Fetch the current stable release when you build, and write it into the guide.

Every entry gives: what it is in one line, the steps per platform, the verify command, the
expected output, and the traps. The traps are the valuable part — they are the difference
between a guide and a link to a download page.

## Contents

Layer 0–1: [Xcode CLT](#xcode-command-line-tools) · [Homebrew](#homebrew) · [winget](#winget) · [Scoop](#scoop) · [Linux package managers](#linux-package-managers)
Layer 2–3: [VS Code](#vs-code) · [Git](#git) · [GitHub CLI](#github-cli)
Languages: [uv](#uv) · [Python](#python) · [Go](#go) · [Rust](#rust) · [C++](#c) · [mise](#mise)
Web: [nvm](#nvm) · [Node.js](#nodejs) · [PHP](#php)
Layer 6: [Docker](#docker)
Databases: [Choosing one](#databases) · [PostgreSQL](#postgresql) · [MySQL](#mysql) · [SQLite](#sqlite)

---

## Xcode Command Line Tools

Apple's compiler toolchain. Git ships inside it, and Homebrew requires it.

**macOS only.** Run `xcode-select --install` and click **Install** in the dialog, or just
run `git --version` and let the dialog appear on its own. Several hundred megabytes,
5–10 minutes.

**Verify:** `xcode-select -p` prints a path ending in `CommandLineTools` or `Xcode.app`.

**Traps.** There is no progress detail, so a slow download looks like a hang. Say the size
up front. If it fails partway, `sudo rm -rf /Library/Developer/CommandLineTools` then
re-run.

---

## Homebrew

The package manager most macOS developer tooling assumes.

**macOS and Linux.** Send the reader to **brew.sh** to copy the install command rather
than printing it. It is long, a PDF may break it across lines, and a `curl | bash` line
broken mid-URL is both wrong and alarming.

**Verify:** `brew --version` prints a version.

**Traps.**
- The installer prints a **"Next steps"** block at the end with two or three shellenv
  commands. Skipping it is the single most common Homebrew failure: `brew` is
  "command not found" in every new terminal. Tell the reader to run what their own screen
  prints, not what the guide prints, since the path differs by chip.
- Prefix differs: `/opt/homebrew` on Apple Silicon, `/usr/local` on Intel. Any path you
  print must cover both.
- Prebuilt bottles exist only for recent macOS versions. On an older combination Homebrew
  builds from source, which can take an hour and can fail. Check the formula's bottle list
  for the tools you are documenting and warn the affected readers by name.

---

## winget

Windows' built-in package manager. Present on Windows 11 and current Windows 10.

**Verify:** `winget --version`.

**Traps.** Absent or stale on older Windows 10; the fix is updating **App Installer** from
the Microsoft Store. First run prompts to accept source agreements, which blocks scripted
installs. For `first-time` audiences prefer GUI installers: winget's failures are quiet,
and reading its output is a skill they do not have yet.

---

## Scoop

A per-user Windows package manager needing no administrator rights. Worth documenting
when readers are on locked-down machines. Install command is on **scoop.sh**.

**Verify:** `scoop --version`.

---

## Linux package managers

Always ask which family; the commands are not interchangeable.

| Family | Refresh | Install |
|---|---|---|
| Debian/Ubuntu | `sudo apt update` | `sudo apt install <pkg>` |
| Fedora/RHEL | `sudo dnf check-update` | `sudo dnf install <pkg>` |
| Arch | `sudo pacman -Sy` | `sudo pacman -S <pkg>` |

**Traps.** Distro repositories ship older runtimes than the vendor. If the guide needs a
current Node, Python, or PHP, the distro package is usually wrong and you want a version
manager or a vendor repository instead. Say which you are using and why.

---

## VS Code

The editor. Goes early because Git's Windows installer asks which editor to use.

**Windows.** From **code.visualstudio.com**, the default button gives the **User
Installer**, which needs no administrator rights. On **Select Additional Tasks**, confirm
**"Add to PATH"** is checked.

**macOS.** Download, unzip, drag **Visual Studio Code.app** to **Applications**. Then run
**Shell Command: Install 'code' command in PATH** from the command palette
(Cmd+Shift+P) — without it `code` does not work in a terminal.

**Linux.** `.deb`/`.rpm` from the site, or the Microsoft apt/dnf repository for updates.

**Verify:** `code --version` in a *new* terminal.

**Traps.** The macOS shell-command step is skipped constantly; give it its own numbered
line, not a parenthetical. On Windows, "Add to PATH" is usually pre-checked but not
always, and the failure surfaces much later as `'code' is not recognized`.

**Extensions worth naming:** Python (Microsoft) for Python; ESLint, Prettier for JS;
Intelephense for PHP. Name the publisher — search results are full of near-duplicates.

---

## Git

Version control. Install after the editor, before anything that clones.

**Windows.** Installer from **git-scm.com**, roughly 14 screens. Four need changes; the
rest are correct by default. Present them in the order they appear:

1. **Default editor** — change from Vim to VS Code. The most important screen in the
   installer. Vim traps beginners in a full-screen editor with no visible exit. Always
   pair this with the escape hatch: **Esc**, then `:q!`, then Enter.
2. **Initial branch name** — override to `main` to match GitHub.
3. **PATH environment** — keep the recommended middle option.
4. **Credential helper** — keep Git Credential Manager; it opens a browser to log into
   GitHub instead of asking for a password the reader does not have.

Add a recovery line: clicking past one of the four is fixed by re-running the installer,
which is safe and preserves other settings.

**macOS.** Comes with the Command Line Tools. Running `git --version` triggers the install
dialog. A newer Git via `brew install git` is optional and worth mentioning only for
`experienced` audiences.

**Linux.** Distro package.

**Both platforms afterward:**

```bash
git config --global user.name "Your Full Name"
git config --global user.email "you@example.com"
```

On macOS also set what the Windows installer sets:

```bash
git config --global core.editor "code --wait"
git config --global init.defaultBranch main
```

**Verify:** `git --version`.

**Traps.** The email must match a verified GitHub email or commit attribution silently
breaks. Windows path length: `git config --global core.longpaths true` prevents
`Filename too long` on Node projects.

---

## GitHub CLI

Authentication and repository operations from the terminal.

winget/Homebrew/apt as appropriate, then `gh auth login` and follow the browser flow.

**Verify:** `gh auth status` shows a logged-in account.

---

## nvm

The most widely used Node version manager. Install it instead of installing Node
directly, so a project needing a different Node version is a one-line change rather than
a reinstall.

**The single most important thing to know: "nvm" is two different projects.** The Unix
one is `nvm-sh/nvm`. Windows is served by `coreybutler/nvm-windows`, which is a separate
project by a different author with different command syntax. Any guide covering both
platforms has to say so, because a Windows reader following Unix nvm instructions gets
errors that make no sense.

### macOS and Linux

Send the reader to **github.com/nvm-sh/nvm** to copy the install command from the README.
Do not print it: the URL embeds the nvm version number, so a printed command goes stale
and installs an old nvm.

The installer appends a block to the shell profile. **A new terminal is required
afterward**, or `nvm` is not found.

```bash
nvm install --lts
nvm use --lts
nvm alias default lts/*
```

The `alias default` line is worth including. Without it, a new terminal starts with the
system Node, or none, and the reader concludes nvm did not work.

### Windows

A different tool. From **github.com/coreybutler/nvm-windows/releases**, download
`nvm-setup.exe` and run it.

**Uninstall any existing Node.js first.** The project recommends this explicitly, and
skipping it produces the worst failure mode in this whole catalog: `nvm use` reports
success and the old Node stays active, because the existing install sits earlier on the
PATH. The reader then has a version manager that appears to do nothing.

Note the command syntax differs from Unix nvm. No double dashes:

```bash
nvm install lts
nvm use lts
```

**`nvm use` needs an administrator terminal**, because it works by rewriting a symlink.
Running it in a normal terminal fails in a way that does not obviously say "run me as
admin". Tell readers to right-click their terminal and choose **Run as administrator**
for that command.

### Verify

`nvm --version`, then after `nvm install`, `node --version`.

### Traps

- **Unix: `which nvm` finds nothing.** nvm is a shell function, not a binary. This looks
  like a broken install and is not. `command -v nvm` prints `nvm` when it is working.
- **Unix: editors and non-interactive shells may not load it.** VS Code's integrated
  terminal usually does; a script run by `cron` or a GUI app launched from Finder usually
  does not. If a reader's editor cannot find Node but their terminal can, this is why.
- **Windows: the syntax difference.** `nvm install --lts` fails on nvm-windows. If a guide
  shows one command for both platforms, it is wrong for one of them.
- **Both: no version is selected by default in a fresh terminal** unless a default alias
  is set. Include that line.

### If the guide covers Windows and you have a choice

nvm is the better-known name, and asking for it by name is reasonable. But be aware of
what the Windows split costs: two projects, two syntaxes, an admin requirement, and a
mandatory Node uninstall. **fnm** and **Volta** are single projects that behave the same
on all three platforms and need no elevation. Worth one line in the guide so the reader
knows the alternatives exist, without relitigating a decision already made.

---

## Node.js

The JavaScript runtime. Everything below assumes no version manager was selected; if one
was, the runtime comes from the manager instead and this section shrinks to a verify step.

**All platforms.** From **nodejs.org**, take the **LTS** button on the left, not
**Current** on the right.

**If nvm was selected, skip this entirely.** On Windows it is worse than redundant: an
existing Node install is what stops nvm-windows from working, so installing both leaves
the reader with a version manager that silently does nothing.

- Windows: `.msi`. **Leave "Tools for Native Modules" unchecked.** Checking it launches a
  PowerShell window that downloads Chocolatey, Python and Visual Studio Build Tools —
  twenty minutes or more, frequently fails, rarely needed.
- macOS: `.pkg`, all defaults.
- Linux: NodeSource repository or a version manager. The distro package is usually old.

**Verify:** `node --version` and `npm --version`.

**Traps.**
- **Windows blocks `npm`** until the execution policy changes:
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. Follow with
  `Get-ExecutionPolicy -Scope CurrentUser` to confirm, because on a managed laptop the
  change is silently overridden. The fallback is Command Prompt, where npm works
  unchanged.
- **Never `sudo npm install -g`.** It creates root-owned files in the home directory that
  break later installs confusingly.

---

## uv

A single tool covering Python interpreters, virtual environments and packages. Default
recommendation for `early-career` and `experienced`; consider the plain python.org
installer for `first-time`, where fewer concepts before the first working program matters
more than tooling quality.

Install via the script on **docs.astral.sh/uv**, or winget/Homebrew.

**Verify:** `uv --version`.

**Then:** `uv python install` gets an interpreter, `uv init` starts a project, `uv venv`
makes an environment, `uv add <pkg>` installs into it.

**Traps.** uv's interpreters are not where an editor looks by default. Include the step
that points the editor at the project's `.venv`, or the reader gets code that runs in the
terminal and shows import errors in the editor. Do not also install Python from
python.org — two Pythons is the top cause of "works in the terminal, not in my editor".

---

## Python

**Windows.** From **python.org/downloads**, the large button at the top.
**"Add python.exe to PATH" is at the bottom of the first installer screen and is unchecked
by default.** This is the single most consequential checkbox in any Python guide; give it
its own callout. Recovery: re-run the installer, choose **Modify**, enable PATH. No
uninstall needed.

**macOS.** The `.pkg` from python.org. Afterward, **double-click
`Install Certificates.command`** in the installed folder. Skipping it produces an SSL
error later that is genuinely hard to diagnose.

**Linux.** Usually present. `python3 --version` first; add the deadsnakes PPA or use a
version manager only if the distro version is too old.

**Verify:** `py --version` on Windows, `python3 --version` on macOS and Linux.

**Traps.**
- **Which word to type** deserves its own short section: `py` on Windows, `python3` on
  macOS and Linux. Bare `python` opens the Microsoft Store on Windows and usually does not
  exist on macOS.
- The Microsoft Store stub is fixed permanently under **Settings → Apps → Advanced app
  settings → App execution aliases**, turning off `python.exe` and `python3.exe`.
- If it reports Python 2, they reached a system Python. Use `python3`.

---

## PHP

**Windows.** No installer exists. The reader downloads a zip and configures it by hand,
which makes this the longest section in any guide that includes PHP.

1. Install the Visual C++ Redistributable (`aka.ms/vs/17/release/vc_redist.x64.exe`) or
   PHP fails with a missing `VCRUNTIME140.dll`.
2. From **windows.php.net/download**, take the **Non Thread Safe** box for command-line
   use, and the **Zip** link inside it.
3. Extract to `C:\php` — not Program Files, whose space and permissions cause trouble.
   Confirm `php.exe` sits directly in that folder, not in a nested one.
4. Copy `php.ini-development` to `php.ini`.
5. Uncomment the needed extensions by deleting the leading semicolon. `extension_dir = "ext"`
   is the one to be careful about; a similar `extension_dir = "./"` sits a few lines above.
6. Add `C:\php` to the **user** PATH, not the system PATH.
7. Restart every terminal and the editor. PATH is read at process start.

**macOS.** Apple removed PHP in Monterey. `brew install php`. Nothing to configure —
Homebrew builds it with the common extensions, including PDO SQLite, already enabled.

**Linux.** Distro package, or the ondrej PPA on Ubuntu for current versions.

**Verify:** `php --version`, then `php --ini` to confirm which config file loaded. A
`(none)` there means the config is not being found. Then `php -m` to list enabled
extensions.

**Traps.** Windows and macOS PHP sections are wildly asymmetric in length. Let them be,
and say so in the intro — a Mac reader who sees the Windows column should understand it
does not apply.

---

## Rust

`rustup` from **rustup.rs**, on every platform. Windows also needs the MSVC build tools,
which rustup offers to install.

**Verify:** `rustc --version` and `cargo --version`.

---

## Go

Installer from **go.dev/dl** on macOS and Windows; distro package or the same tarball on
Linux.

**Verify:** `go version`.

**Traps.** Modern Go needs no `GOPATH` setup. Older guides say otherwise; do not copy them.

---

## C++

There is no single thing called C++ to install. You install a compiler, and which one the
reader gets depends entirely on the platform. All three below are standards-compliant and
build the same code, so the guide's job is to be clear about which one they now have.

**macOS.** Comes with the Xcode Command Line Tools: `xcode-select --install`. The result
is **clang++**. `g++` also works but is a shim for clang, not GNU g++, which surprises
people reading GCC-specific documentation.

**Windows.** **Build Tools for Visual Studio**, from the *Tools for Visual Studio* section
of visualstudio.com/downloads. The full IDE is not needed. Select the **Desktop
development with C++** workload. Several gigabytes.

**Linux.** `sudo apt install build-essential`, which is g++ plus make plus the standard
headers. Installing only `g++` leaves a compiler that cannot find `<iostream>`, which
produces a confusing first error.

**Verify:** `g++ --version` on macOS and Linux. `cl` on Windows.

**Traps.**

- **The Windows one catches nearly everyone.** MSVC does not put itself on the ordinary
  PATH. `cl` only works inside the **Developer Command Prompt for VS**, which is a
  separate Start menu entry. A reader in a normal terminal gets "not recognized" from a
  compiler that installed perfectly. Say this in the install step, not only in
  troubleshooting.
- **CMake is a separate decision.** Almost any project past one file uses a build system.
  If the guide's audience will build real projects, add CMake in the same step rather than
  leaving it for later: `brew install cmake`, `sudo apt install cmake`, or the checkbox
  inside the Windows C++ workload.
- **A partial Xcode CLT install** produces missing standard headers with the compiler
  present. Re-running `xcode-select --install` fixes it.

**Editor note.** For VS Code, the **C/C++** extension by Microsoft locates the compiler and
sets up debugging. Worth naming, because the marketplace has several similarly named
alternatives.

---

## mise

A polyglot version manager replacing separate tools for Node, Python, Ruby and more.
Offer it when three or more runtimes are selected.

Install per **mise.jdx.dev**, then add the activation line to the shell profile.

**Verify:** `mise --version`, then `mise use --global node@lts`.

**Traps.** The shell activation line is required and easy to miss. Per-tool documentation
elsewhere assumes you did not use mise, so their instructions will not match. Say that.

---

## Docker

**Docker Desktop** on macOS and Windows from **docker.com**; Docker Engine on Linux.
Windows needs WSL2, which Docker Desktop will install and which requires a restart.

**Verify:** `docker run hello-world` prints a success message.

**Traps.** Large download, wants a restart, so put it late. Licensing requires a paid
subscription for larger companies — worth one line for a work audience. On Apple Silicon,
`x86` images need emulation and run slowly. OrbStack and Podman are lighter alternatives
worth naming for `experienced` readers.

---

---

## Databases

Read this before any of the three below. Most of what goes wrong with a database in a
setup guide is not the install. It is that the reader has a database installed and not
running, or running and not reachable, and a `--version` check cannot tell those apart.

**Every database section needs two checks, not one.** A version check proves the client
program exists. A connection check proves the server is up and accepting connections.
Only the second one means anything, and it is the one guides usually omit.

**Three failure modes worth pre-empting in any database section:**

- **Installed but not started.** Homebrew installs the service and does not start it, and
  the extra `brew services start` line gets skipped constantly. On Linux the equivalent is
  forgetting `systemctl enable --now`.
- **A password set on a screen the reader clicked past.** Both the PostgreSQL and MySQL
  Windows installers ask for a superuser password mid-wizard. There is no recovery path
  later. Tell readers to write it down, in the step, not afterward.
- **A port already in use.** 5432 and 3306 are frequently occupied by an older install or
  a Docker container. The error says the port is busy, not which of those it is.

**If the guide already includes Docker**, mention that running the database in a container
is an alternative worth considering: no service to manage, no port conflict with a system
install, and deleting it is deleting a container. Do not push it on a `first-time`
audience, who do not need two unfamiliar things at once.

---

## PostgreSQL

A client-server relational database. The default choice for most new work.

**macOS.** `brew install postgresql@<major>`, pinning the major version so a later
`brew upgrade` cannot move the data directory out from under the reader. Then start it:

```bash
brew services start postgresql@<major>
```

That second line is a separate step and it is the one people skip.

**Windows.** The installer from **enterprisedb.com**, which bundles pgAdmin. It asks for a
superuser password partway through. **There is no way to recover it later.** Leave the
port at 5432 unless something already has it.

**Linux.** `sudo apt install postgresql`, then `sudo systemctl enable --now postgresql`.
On Debian and Ubuntu the install creates a `postgres` system user, and the first
connection is usually `sudo -u postgres psql` rather than a bare `psql`.

**Verify, both checks:**

```bash
psql --version
psql -d postgres -c "select version();"
```

The first proves the client exists. The second proves the server is running and reachable,
which is the thing the reader actually needs.

**Traps.** `psql` with no arguments tries to connect to a database named after your OS
user, which usually does not exist; the error mentions a missing database rather than a
missing server, which sends people down the wrong path. On macOS, `brew services list`
shows whether it is actually running.

---

## MySQL

A client-server relational database. Choose it when something downstream requires it,
such as a hosting environment or a course specification.

**macOS.** `brew install mysql`, then `brew services start mysql`.

**Homebrew installs MySQL with no root password at all.** The reader can connect with
`mysql -u root` and nothing else. That is convenient and it is not a state to leave a
machine in. Include the hardening step:

```bash
mysql_secure_installation
```

**Windows.** The **MySQL Installer** from **dev.mysql.com**. Two screens matter:

1. **Root password.** Same rule as PostgreSQL: write it down during the step.
2. **Authentication method.** The current default is the stronger one, and it is correct
   for anything new. Older clients and some ORM versions cannot speak it and fail at
   connect time with an authentication-plugin error rather than a wrong-password error.
   If the guide is for a codebase that predates it, say which option to pick and why.

**Linux.** `sudo apt install mysql-server`, then `sudo mysql_secure_installation`. Many
distributions ship MariaDB under the `mysql` command name. If the guide means MySQL
specifically, say so and check what `mysql --version` actually reports.

**Verify, both checks:**

```bash
mysql --version
mysql -u root -p -e "select version();"
```

**Traps.** Port 3306 collides with an existing install or a container. The
authentication-plugin error reads like a credentials problem and is not. On macOS, a
`mysql` that came from a previous install can shadow the Homebrew one; `which mysql`
settles it.

---

## SQLite

A database that is one file on disk. No server, no port, no password, nothing to start.

**Usually there is nothing to install.** SQLite ships inside Python and inside PHP, and
the `sqlite3` command-line tool is already present on macOS and most Linux systems.

**For a guide where SQLite is only reached through a language, do not write an install
step at all.** Write a verification step that proves the language can reach it, which is
the only thing that matters and the only thing that actually breaks:

```bash
python3 -c "import sqlite3; print(sqlite3.sqlite_version)"
```

```bash
php -r "new PDO('sqlite::memory:'); echo 'PDO SQLite OK', PHP_EOL;"
```

A PHP check of that shape is worth more than three separate version checks: it proves the
runtime is installed, on the PATH, loading the right config file, and has the driver
enabled, in one command.

**If the reader needs the standalone `sqlite3` shell:** already present on macOS and most
Linux. On Windows, download the precompiled command-line tools from **sqlite.org** and put
the folder on the PATH, or install it with `winget install SQLite.SQLite`.

**Verify:** `sqlite3 --version`, or the language check above.

**Traps.** Because there is no server, the failure mode is not "cannot connect" but "the
file is not where you think it is". A relative path in a script resolves against the
terminal's current folder, not the script's folder, so the same code appears to work in
one terminal and create an empty database in another. Worth one line in any guide where
students will run scripts from different directories.
