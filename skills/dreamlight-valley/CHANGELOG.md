# Changelog

## 1.3.0

### Minor Changes

- [#44](https://github.com/allonsy-studio/agent-skills/pull/44) [`1a32da9`](https://github.com/allonsy-studio/agent-skills/commit/1a32da9739ae59659ec1c6e666dcb54de0565462) - Skill detail pages now show a folder-structure tree of the skill's source directory, rendered as a file tree with branch lines and file-type icons right above the full `SKILL.md` instructions. See the shape of a skill — its scripts, references, and the tests and evals that back it — at a glance before reading the prose.

## 1.2.0

### Minor Changes

- [#32](https://github.com/allonsy-studio/agent-skills/pull/32) [`02cda21`](https://github.com/allonsy-studio/agent-skills/commit/02cda21a75c93b0c39d1631d80b8b1c592f7cc66) Thanks [@castastrophe](https://github.com/castastrophe)! - Add a **structured-data** skill for adding schema.org markup (HTML Microdata or JSON-LD) to web pages, then validating it.
    - Picks the right format for your project and injects markup at build or server-render time only, emitting a reviewable diff instead of overwriting your source files.
    - Generates JSON-LD with typed authoring (schema-dts) and validates it against the reference JSON-LD processor, so broken or unknown types surface before they ship.
    - Includes an extraction **preview** that shows exactly what a search-engine parser reads from your page, plus a `/preview-structured-data` command.
    - Offers to wire structured-data regression tests into your project's existing suite so markup can't silently drift.

    Say things like "add JSON-LD to this page", "add schema.org / rich-snippet markup", "validate my structured data", or "should I use Microdata or JSON-LD?" and Claude will know what to do.

- [#39](https://github.com/allonsy-studio/agent-skills/pull/39) [`7738d8f`](https://github.com/allonsy-studio/agent-skills/commit/7738d8f4c9ecc8217408a8af8bb340e9bf300a4c) Thanks [@castastrophe](https://github.com/castastrophe)! - - Point every repository, homepage, and issues URL at the renamed `allonsy-studio` GitHub org so links and `npm` metadata resolve correctly.
    - Add a `docs/skill-architecture.md` guide plus a stronger "New skill" issue template that walks contributors through the decisions that make a skill trigger reliably.
    - Refresh the marketplace landing site.
    - **dreamlight-valley:** fix the catalog preview page so its Eleventy build succeeds, and split the sprite-coordinate helpers into a tested `sprite-coords.js` module.
    - Report per-skill test coverage correctly in CI.

### Patch Changes

- [#32](https://github.com/allonsy-studio/agent-skills/pull/32) [`02cda21`](https://github.com/allonsy-studio/agent-skills/commit/02cda21a75c93b0c39d1631d80b8b1c592f7cc66) Thanks [@castastrophe](https://github.com/castastrophe)! - Polish the marketplace site and stop skill pages from overflowing on narrow screens:
    - The featured skill card is now a single link straight to its page (no more separate buttons), the "Featured"/"Recommended" badges sit centered on the card's top edge with consistent padding, and the quality/feature cards get larger centered icons and headings.
    - Card body copy uses balanced text wrapping with a tighter line height.
    - The landing headline breaks cleanly at the slash (`@allons-y/` / `agent-skills`) instead of mid-word at a hyphen.
    - Long link URLs and inline code such as file paths now wrap instead of pushing past the screen, the prose column is capped to its container width, and code blocks get a small inset so text no longer sits flush against their accent border.

- [#35](https://github.com/allonsy-studio/agent-skills/pull/35) [`aad7389`](https://github.com/allonsy-studio/agent-skills/commit/aad7389f0aadbd8189a20f59f558eec8309956bc) Thanks [@castastrophe](https://github.com/castastrophe)! - The install script was pointing to an old marketplace name and has now been fixed to "allonsy-studio/agent-skills"

    `/plugin marketplace add allonsy-studio/agent-skills`

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.1.0](https://github.com/Allons-y-Studio/agent-skills/compare/v1.0.3...v1.1.0) (2026-05-27)

### ✨ Features

- **dreamlight-valley:**new skill for cooking, gathering, and inventory management ([#21](https://github.com/Allons-y-Studio/agent-skills/issues/21)) ([440e59c]())

## Summary

Adds a brand-new `dreamlight-valley` skill that gives Claude a complete
Disney Dreamlight Valley catalog and three focused modes — identify a
dish, recommend what to cook, generate a gather checklist — all from a
single prompt or slash command.

## What it does

- **`/recipe`** — Identify a dish from a typed name or a cookbook
  screenshot and return its ingredients. Fuzzy-matches misread or accented
  names; handles multi-dish screenshots one block at a time; optionally
  surfaces star rating, energy, and sell price.
- **`/cook`** — Recommend the best recipes to cook from the ingredients
  on hand, ranked by value per ingredient consumed. Reads quantities from
  a backpack screenshot or accepts them as text. Supports `--profit` /
  `--energy` objectives, per-course filtering, and an inventory floor so a
  recommendation never wipes out a stockpile.
- **`/restock`** — Read a storage screenshot, compare against the full
  catalog, and output a categorized Markdown gather checklist. Includes a
  99-skip shortcut, per-category floors (cooking at 50, materials at 99),
  and uncertainty flagging.

Say anything like "what's in Ratatouille?", "what should I cook right
now?", "/cook --profit lemon, garlic, herring", or upload a screenshot
of a cookbook / backpack / storage screen — the skill routes correctly.

## Bundled data (current to Wishblossom Mountains)

- 472 recipes with star rating, course, energy, sale price, and
  ingredient slots (fixed or category-typed)
- 386-item catalog: 142 ingredients · 86 flowers · 62 forageables · 50
  gems · 45 fish — each with method, locations, sale price, energy, etc.
- 13 labeled sprite sheets (one per category) + `sprite-coords.json`
  sidecar mapping every catalog item to its exact pixel position for
  direct lookup
- Reference docs split by mode (`identify.md`, `recommend.md`,
  `stock-check.md`) plus icon-reading cues and ingredient-category notes
- Plain-text `dreamlight-valley.md` config file users can drop in `./`
  or `~/.config/` for per-player defaults

## Local catalog preview

`yarn workspace @allons-y/skill-dreamlight-valley preview` boots a local
browser at http://localhost:8765 — search/filter/sort the entire
catalog, styled to match the in-game palette (Josefin Sans, gold
gradients on a burgundy/indigo background). Each recipe ingredient links
to its catalog entry; sprites render inline via the coords sidecar;
keyboard accessible (WAI-ARIA tabs with arrow-key navigation, native
datalist autocomplete on search inputs).

## Infrastructure

- New `scripts/build-sprites.js` (Node + sharp): regenerates
  `sprite-coords.json` from `gatherables.json` deterministically; rebuilds
  sprite sheets when source PNGs are present in
  `references/images/<category>/*.png`
- `scripts/run-evals.js` generalised to auto-register `commands/*.md`
  files as evaluable tools (was previously hardcoded for Python scripts
  and the gh-notifications CLI)
- `c8` declared as a devDependency on this skill (needed for `yarn
coverage` to find the binary in yarn workspaces)

## Test plan

- [x] `yarn workspace @allons-y/skill-dreamlight-valley test` — 20
      data-integrity tests pass (gatherables schema/duplicates/enums, recipes
      schema/cross-references, sprite-coords layout consistency)
- [x] `yarn workspace @allons-y/skill-dreamlight-valley lint` — clean
- [x] `yarn workspace @allons-y/skill-dreamlight-valley coverage` — runs
      (skill is data-only so 0% coverage is expected)
- [x] `yarn workspace @allons-y/skill-dreamlight-valley build:sprites` —
      regenerates coords + any sheets whose source images exist
- [x] `yarn workspace @allons-y/skill-dreamlight-valley preview` — local
      catalog browser runs on http://localhost:8765
- [ ] 17 LLM evals under `evals/evals.json` (run with
      `ANTHROPIC_API_KEY` set) — cover routing for `/recipe`, `/cook`,
      `/restock` plus four negative cases

### 📚 Documentation

\*GitHub Pages site, MPL-2.0 relicense, Renovate refresh ([#19](https://github.com/Allons-y-Studio/agent-skills/issues/19)) ([c3677d9]())

## Summary

- **New docs site** at `/docs` — single-page, brand-aligned with
  Allons-y Studio (Roboto + Dancing Script + EB Garamond + PT Mono,
  magenta-red accent, warm neutral surfaces, `--theme--*` token system
  mirroring the main site). Ready to publish via **Settings → Pages →
  Deploy from a branch → `main` / `/docs`**.
- **Relicense Apache-2.0 → MPL-2.0** in `LICENSE`, `package.json`
  (SPDX), and the README license section. File-level copyleft fits
  skill-style code better.
- **Renovate refresh** — moved to `config:best-practices` with grouped
  updates for the commitlint, jest, eslint, and semantic-release
  ecosystems. New updater workflow added.
- README license blurb updated; rest of the README validated as current.

## [1.0.3](https://github.com/castastrophe/agent-skills/compare/v1.0.2...v1.0.3) (2026-05-15)

### 🐛 Bug Fixes

- **deps:**update dependency @octokit/rest to v22 ([#13](https://github.com/castastrophe/agent-skills/issues/13)) ([81e1e52]())

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

## [1.0.2](https://github.com/castastrophe/agent-skills/compare/v1.0.1...v1.0.2) (2026-05-15)

### 🐛 Bug Fixes

- **deps:**update dependency dotenv to v17 ([#15](https://github.com/castastrophe/agent-skills/issues/15)) ([1c648bb]())

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

### 📚 Documentation

- **design-system:**add skill to README, rename to match directory, document reference-only flavor ([#17](https://github.com/castastrophe/agent-skills/issues/17)) ([4e67e49]())

* Add design-system to the Available Skills table and getSkills() example
* Rename the skill's frontmatter `name` from `design-system-patterns` to `design-system` so it matches the directory and package name (required by the loader)
* Update the stale `skill_name` in evals.json after the rename
* Regenerate .claude-plugin/marketplace.json and plugin.json
* Document the "reference-only skill" flavor (no `scripts/` required) in CLAUDE.md and CONTRIBUTING.md so contributors know it's a supported pattern
* Fix the broken coverage badge in the README (envoy -> agent-skills)

## [1.0.1](https://github.com/castastrophe/agent-skills/compare/v1.0.0...v1.0.1) (2026-05-15)

### 🐛 Bug Fixes

- **tooling:**unify linting under eslint-plugin-jsonc and clear all config warnings ([#16](https://github.com/castastrophe/agent-skills/issues/16)) ([ad21087]())

Swap out prettier-package-json for eslint-plugin-jsonc so that package.json key
ordering, JSON sort-keys, and CSS baseline rules all run through a single yarn lint
pass — no more separate format-check step in CI. Removes lint-staged.config.js (config
moves inline to package.json) and cleans up the downstream warnings it exposed: bare
code fences in design-system reference docs, [AA]/[AAA] label escaping, taxonomy heading
levels, and dead caching imports in gh-notification-summary.

## 1.0.0 (2026-05-15)

### ⚠ BREAKING CHANGES

- This release ships substantial API and packaging changes
  that break consumers of the previous Python-based skill and the old
  marketplace layout.
- `gh-notification-summary` skill rewritten from Python to Node.js. The
  Python implementation (`scripts/gh_notifications.py`, `pyproject.toml`,
  `requirements.txt`, `uv.lock`, pytest tests) is removed. Anyone vendoring
  the Python sources must migrate to the Node.js modules
  (`scripts/{caching,github,server}.js`, `bin/cli.js`).
- CLI invocation changed. Use the `gh-notifications` binary (declared in
  the skill's `package.json#bin`), not
  `node <skill-path>/scripts/gh-notifications.js`. The `--repo` flag is
  now required for `done <issue>` and `unsub <issue>` (or set
  `GITHUB_REPO` in the environment).
- `Cache` class contract changed:
    - Constructor: `Cache(ttl, persistPath?, opts?)` → `Cache(ttl, maxEntries, persistPath?)`.
    - `set(key, value)` → `set(key, labels, comments)`.
    - `get(key)` now returns `{ labels, comments }` (deep-cloned) or `null`,
      not the raw stored value.
    - Disk writes are now asynchronous and debounced; callers needing
      synchronous durability must call `cache.flush()`.
- `Notifications` class API rewritten. Removed: `initialize()`,
  `markAsDone(id)`, `markAllAsDone()`, `findItemById()`, and the
  `NotificationItem` class with `.unsubscribe()`. Notification mutations
  are now standalone functions: `performUnsub(octokit, repo, issue)`,
  `markIssueNotificationDone(octokit, repo, issue)`,
  `markAllNotificationsDone(octokit)`. New `awaitPromises()` method waits
  on fixture loading in testMode.
- `createHandler` signature changed from `createHandler(html, instance)`
  to `createHandler(html, { createOctokit, performUnsub })` — dependencies
  are now injected.
- `performUnsub` rejects fractional and zero issue numbers; previously
  accepted any finite number through `Number(...)` parsing.
- Marketplace manifest paths changed. `agent.yaml` and the root
  `marketplace.json` are removed. The canonical Claude Code marketplace
  catalog is `.claude-plugin/marketplace.json` with one entry per skill
  (no aggregate "All Skills" plugin). External tooling reading the old
  paths will break.
- Dashboard template moved from
  `<skill-path>/scripts/templates/dashboard.html` to
  `<skill-path>/templates/dashboard.html`.
- Skills must declare `skill.runtime` in their `package.json` (currently
  only `"node"` is supported). The test runner validates this and throws
  on unsupported values.
- Zip-based skill distribution is deprecated. `bin/install.js` now copies
  skill directories verbatim, excluding `tests/`, `evals/`,
  `node_modules/`, and coverage dirs. Legacy zip extraction emits a
  deprecation warning and will be removed in the next major. The
  `bundle.js` script and `bundle` step in `prepublishOnly` were removed.
- `design-system` skill frontmatter triggers tightened. Bare "HTML",
  "CSS", "markup", and "component API" no longer trigger the skill.
  Users relying on those broad triggers should switch to domain-specific
  phrasing ("ARIA pattern", "accessible component", "design tokens",
  "design system audit").
- Python toolchain removed from the entire repo. `pyproject.toml`,
  `requirements.txt`, `uv.lock`, pytest, ruff, mypy, and bandit are gone.
  CI workflows no longer set up `uv`. The `py:*` scripts in root
  `package.json` are removed.

### ✨ Features

- **gh-notification-summary:**add GitHub notification management skill ([#1](https://github.com/castastrophe/agent-skills/issues/1)) ([321d678](https://github.com/castastrophe/agent-skills/commit/321d6780575a1e52af4e4bf9f38587a4da6632ba))

Stop letting your GitHub notification inbox become a graveyard. This skill
gives Claude the ability to fetch, display, and act on your unread GitHub
notifications — all from a single prompt.

What it does:

- Opens an interactive local dashboard at <http://localhost:8000> showing each
  unread notification as a card, complete with labels, latest comments, and
  ready-to-paste action commands
- Unsubscribes you from noisy threads (/unsub 4821) without requiring you to
  navigate GitHub
- Marks individual notifications or your entire inbox as done in one shot
- Works with any repo — pass a repo explicitly or set GITHUB_REPO as your default

Say anything like "check my GitHub notifications", "what's in my GitHub
inbox?", "get me off that w3c thread", or "mark all done" — Claude will
know what to do.

Pairs well with a morning routine prompt — ask Claude to open your dashboard,
summarize what needs attention, and clear the rest.

\*rebuild the skills platform on Node.js with GitHub-notification and design-system skills ([a9825fa](https://github.com/castastrophe/agent-skills/commit/a9825fae9e23f12c2b22bb3cfe7b6fea1a7fa633))

The agent-skills monorepo is now a pure Node.js platform, ready to drop into Claude Code via the native plugin marketplace or vendor into any other agent harness. Two flagship skills ship with this release.

**GitHub notification reviewer**
Stop letting your GitHub inbox become a graveyard. Say "check my GitHub notifications", "what's in my inbox?", "/unsub 4821", or "mark all done" and Claude will:

- Open an interactive dashboard at <http://localhost:8000> with every unread thread as a card — labels, latest comments, and suggested actions in one view
- Unsubscribe you from noisy threads without making you click through GitHub
- Mark individual issues or your entire inbox as done in one shot
- Work against any repo (pass `--repo` or set `GITHUB_REPO` once)
  Under the hood, issue details and comments fetch in parallel, enrichment-cache writes are debounced, and dashboard assets are pre-formatted at boot for a snappy first paint.

**Design-system patterns**
A new skill that turns Claude into a design-system architect. Say "help me build a date picker", "what should I call this component", "audit my component library", or "is this accessible?" and Claude walks you through the right path:

- Identifies the pattern from a taxonomy spanning Material, Spectrum, Carbon, Lightning, Atlassian, Primer, Polaris, GOV.UK, and USWDS
- Proposes names with trade-off notes
- Designs the public API — props, slots, events, CSS custom properties, design tokens
- Specifies WAI-ARIA + WCAG 2.2 AA accessibility and full keyboard contracts
- Writes production-quality vanilla HTML and Web Component code
  Reference files are structured so the model loads only what each task needs — no token bloat.

**Install it anywhere**
In Claude Code:
/plugin marketplace add castastrophe/agent-skills
/plugin install gh-notification-summary@agent-skills
In Cursor, OpenCode, Aider, or your own SDK harness:
npx @allons-y/agent-skills gh-notification-summary --dir <your-agent-skills-dir>

**Under the hood**

- Python toolchain (uv, pytest, ruff, mypy, bandit) replaced with Node.js + Yarn 4 workspaces
- Each skill declares a `skill.runtime` field; tests run via `node --test` + c8
- SKILL.md files tuned for agent consumption: tighter trigger phrases, structured command tables, reference content moved into discoverable `references/` files
- 94 tests across the repo, 100% line coverage on the GitHub-notification skill's core modules
