---
name: devenv-guide
description: Generate a printable, platform-split developer environment setup guide as a PDF (and optionally an interactive HTML page) covering tools like Git, Node, Python, PHP, Docker, databases, and their version managers. Use this whenever someone asks for install instructions, onboarding docs, a setup guide, a "getting started on a new laptop" document, a dev environment doc, machine setup steps, or wants to document how to install a toolchain for students, new hires, workshop attendees, or a team. Also use it when someone asks to add a tool to an existing setup guide, or to rewrite install steps for a different skill level or a different operating system. Trigger on phrases like "setup guide", "install instructions", "onboarding doc", "how do I document installing X", "environment setup", "new machine checklist", "get the team set up", or a bare list of tools plus an operating system.
---

# Dev Environment Setup Guide Builder

Produces setup guides that a real person can follow alone, at 11pm, without you. The
output is a PDF with each platform's steps side by side, a verification step after every
install, and a troubleshooting section keyed to actual error messages.

The thing that makes these guides work is not completeness. It is that **every step ends
with a check that tells the reader whether it worked**, and that the troubleshooting
section is indexed by the error text the reader is staring at rather than by topic. Keep
that property no matter what else you change.

## Workflow

1. **Gather the four inputs** (below). Ask for anything missing before building.
2. **Resolve the tool list into install order** with
   `node scripts/order-tools.js <tools...> --os <platform>`, which is the graph in
   `references/dependency-rules.md` made executable. It adds the prerequisites a reader
   did not ask for and warns about combinations that produce a contradictory guide.
3. **Verify current versions.** The catalog deliberately hardcodes no version numbers.
   Fetch the current stable release for every selected tool before writing steps.
4. **Write the guide** following `references/house-style.md`, pulling per-tool content
   from `references/tool-catalog.md`.
5. **Build the PDF** with `scripts/build-guide.js`.
6. **Verify the output** using the checklist at the end of this file. Do not skip this;
   it catches the failure modes that make a guide actively harmful.

## The four inputs

Ask for all four. Use `AskUserQuestion` when the interface supports it. Never guess at
the audience — it changes more of the document than anything else.

### 1. Tools

Offer this menu, grouped so that the dependency structure is visible in the question
itself. Let them pick freely and add anything not listed.

| Group | Options |
|---|---|
| Editor | VS Code, Zed, Cursor, Neovim |
| Version control | Git (+ GitHub CLI) |
| Programming languages | Python (via **uv**, pyenv, or a direct installer), Go, Rust (rustup), C++ (platform compiler toolchain), Ruby (mise/rbenv), Java (SDKMAN/Temurin) |
| Web technologies | Node.js (via **nvm**, fnm, Volta, or a direct installer), PHP (via Homebrew, windows.php.net, or a distro package) |
| Containers | Docker Desktop, Podman, OrbStack |
| Databases | PostgreSQL, MySQL, SQLite, Redis. These share a section in the catalog because the same three things go wrong with all of them |
| Polyglot | mise or asdf, to manage several runtimes at once |

Group the menu this way rather than by layer. A reader picking tools thinks in terms of
"what am I building with", not "what depends on what". The dependency structure still
decides the install order; it just does not have to decide the question's shape.

**Always mention the version manager alongside its runtime**, and default to the bold
one. "Install Node" and "install Node through nvm" are different documents, and the
second one is the one that survives a reader needing a different Node version later.

**nvm needs care on a cross-platform guide.** On macOS and Linux it is `nvm-sh/nvm`. On
Windows it is `coreybutler/nvm-windows`, a separate project: different command syntax,
`nvm use` requires an administrator terminal, and any existing Node install has to be
removed first or the version manager silently does nothing. Write the Windows column from
that project's documentation, not from nvm-sh's.

Databases are their own group for a reason: a version check proves the client exists, not
that the server is running, so every database step needs two checks. `references/tool-catalog.md`
has the shared guidance under **Databases** before the individual entries.

Some selections imply others. `references/dependency-rules.md` has the full graph, but
the shape of it is: a package manager comes before anything it installs, an editor comes
before Git (Git's Windows installer asks which editor to use), Git comes before anything
that clones, and a version manager comes before the runtime it manages.

### 2. Environments

Default to **macOS, Windows, and Linux** unless told otherwise. Confirm rather than
assume — a Windows-only shop does not want two thirds of the page taken up by columns
they will never read.

For Linux, ask which family (Debian/Ubuntu, Fedora/RHEL, Arch). Package names and
commands differ enough that "Linux" alone produces instructions that fail.

### 3. Experience level

This decides vocabulary, how much gets explained, and how long the guide is.

| Level | Who | What changes |
|---|---|---|
| `first-time` | Never installed developer tools. Students, career changers. | Define terminal, PATH, shell, command. Spell out every click. Explain what silence means. Include a glossary. Expect 12–16 pages for four tools. |
| `early-career` | Has installed things, has used a terminal, may not know why PATH breaks. **Default for the web guide.** | Assume terminal fluency. Still name the specific traps. Skip the glossary. 6–10 pages. |
| `experienced` | Sets up machines regularly, wants the specifics not the concepts. | Commands and gotchas only. Tables over prose. Link out for anything standard. 3–5 pages. |

When unsure, ask. Writing a `first-time` guide for an `experienced` audience reads as
condescending; the reverse strands people.

### 4. Where it is going

A printed handout, an internal wiki, a public page, a repo README. This affects whether
you include contact details, a version stamp, and links that assume network access.

## Version policy

**Write steps only for versions that are current or one major release behind.** Those are
the versions whose installers, screens, and error messages you can describe accurately.

If someone asks for a version **two or more major releases behind current**, do not write
install steps from memory. They will be subtly wrong in ways that waste hours. Instead:

- Name the version and say plainly that it is old enough that the steps have drifted.
- Link to that version's own official documentation or archived downloads page.
- Say what breaks going forward, in one line, if you know it.
- Offer the current-version steps alongside, in case the constraint is softer than stated.

`references/version-policy.md` has the per-tool cadence and the archive URLs, because
"two majors" means something different for Node (a year) than for Python (two years).

## Building the PDF

`scripts/build-guide.js` turns an HTML file into the PDF, applying `assets/guide.css`:

```bash
node scripts/build-guide.js input.html output.pdf --title "Setup Guide" --accent "#1e40af"
```

Write the HTML **body content only** using the classes documented in
`references/house-style.md`. The script supplies the stylesheet, page furniture, and
footer. Pass `--accent` to distinguish guides that will be held side by side.

After building, the script prints a verification report. Read it. It checks the things
that silently ruin a printed guide.

Rendering is delegated to whatever is installed. Prefer **WeasyPrint**
(`pipx install weasyprint`): the stylesheet uses CSS margin boxes for the running footer
and page numbers, and headless Chrome — the fallback — drops them silently. If no
renderer is present, pass `--html-only`: the assembled HTML and the full verification
report still come out, and the reader can print from a browser.

## The interactive web guide

When the target is a web page rather than print, build a single self-contained HTML file
where the reader checks the tools they want and the page assembles the steps in dependency
order. `references/web-guide.md` covers the structure, the data shape, and the ordering
logic. Default that page to the `early-career` voice.

## Verification checklist

Run through this before handing anything over. Each item exists because skipping it
produced a broken guide at least once.

1. **Every command extracts as one unbroken line.** Long commands that wrap inside a
   narrow column become two broken commands when a reader copies them out of a PDF.
   `build-guide.js` checks this and names the offenders. Move them to full width or
   send the reader to the vendor's page to copy from.
2. **Every install step ends with a check.** A "Done when:" line naming observable
   output. Not "it should work" — the actual string that appears.
3. **Every troubleshooting entry is titled with the error text**, not the topic. Readers
   search for what is on their screen.
4. **No unresolved placeholders** unless you flagged them explicitly in your handoff
   message.
5. **Cross-references point at steps that exist.** If two platform columns both number
   their substeps `4a`, say which platform every reference means.
6. **Callouts hold under about 10% of the words.** A page of colored boxes is a page
   nobody reads. Long content belongs under a heading, as ordinary prose.
7. **Claims about install behavior are verified, not remembered.** If you say a checkbox
   is unchecked by default or a package ships with a feature enabled, you checked. Say
   in your handoff what you verified and what you could not.

## Reference files

- `references/tool-catalog.md` — per-tool, per-OS steps, verify commands, known traps.
  Read the entries for the selected tools only.
- `references/dependency-rules.md` — the ordering graph and how to resolve it.
- `references/house-style.md` — voice, structure, punctuation rules, HTML classes.
- `references/version-policy.md` — how old is too old, and where to link instead.
- `references/web-guide.md` — the interactive checkbox page.

## Scripts

- `scripts/order-tools.js` — resolve a selection into install order. `--list` prints the
  known tool keys.
- `scripts/build-guide.js` — assemble the PDF and print the verification report.
  `--html-only` runs the checks with no renderer installed.
