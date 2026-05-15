# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
