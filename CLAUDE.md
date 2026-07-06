# @allons-y/agent-skills

A Yarn workspaces monorepo of agent skills. Each skill under `skills/` is a workspace member with its own `package.json` (`private: true`), `SKILL.md`, implementation scripts, and test suite. All skills are **Node.js** (`node --test`, ESLint/Prettier). The package is consumable by any agent harness that supports SKILL.md directories; Claude Code installs natively via `.claude-plugin/marketplace.json`, and other agents can vendor skills via the `npx` installer.

## Repository layout

```sh
package.json                    # Root workspace — workspaces: ["skills/*"]
index.js                        # Node.js entry point — exports getSkills()
bin/install.js                  # npx installer CLI
scripts/
  run-tests.js                  # Runs each skill's `yarn workspace … test` (node --test + c8)
  run-evals.js                  # LLM eval runner (Anthropic API)
  generate-plugin-manifest.js   # Regenerates .claude-plugin/marketplace.json + plugin.json
skills/                         # Yarn workspace members
  <skill-name>/
    package.json                # private: true — skill-level scripts (test, lint, etc.); declares `skill.runtime`
    SKILL.md                    # YAML frontmatter (name, description) + usage docs
    scripts/                    # Implementation (Node.js)
    tests/                      # `node --test` suite
    evals/                      # Eval prompts (evals.json)
.claude-plugin/
  marketplace.json              # Auto-generated marketplace manifest (do not edit by hand)
  plugin.json                   # Auto-generated plugin manifest (do not edit by hand)
```

## Common commands

```bash
yarn test                       # Run all skill test suites (parallel)
yarn test <skill-name>          # Run tests for a single skill
yarn evals                      # Run LLM evals for all skills
yarn generate:marketplace       # Regenerate .claude-plugin/marketplace.json and plugin.json
yarn release                    # Cut a release via semantic-release
```

## Workspace commands

Target a single skill without `cd`-ing into it:

```bash
yarn workspace @allons-y/skill-gh-notification-summary test
yarn workspace @allons-y/skill-gh-notification-summary lint
```

Run across all workspaces:

```bash
yarn workspaces foreach -A run test
yarn workspaces foreach -A run lint
```

## Designing a skill

**[`docs/skill-architecture.md`](docs/skill-architecture.md) is the source of truth for how to architect a skill** — read it before creating or substantially changing one. It is the canonical reference for the decisions that determine whether a skill works; the index below is just a signpost, not a substitute:

- **The triggering `description`** — the highest-leverage field (what it does + when to use it).
- **Progressive disclosure** — a lean `SKILL.md` body; depth in `references/`.
- **Instructions vs. scripts** — degrees of freedom; deterministic work belongs in scripts.
- **Discriminating evals** — positive triggers plus tempting negatives.

The same criteria are encoded in the [New Skill Proposal issue template](.github/ISSUE_TEMPLATE/new_skill.yml) and the [pull request template](.github/pull_request_template.md), and gathered as a pre-PR checklist at the end of the guide.

## Adding a new skill

The steps below are the mechanical setup — see [Designing a skill](#designing-a-skill) above for the design decisions.

1. Create a directory under `skills/<skill-name>/`.
2. Add a `package.json` with `"private": true` and a `skill` block. The `skill.*` shape is validated against `schemas/skill.schema.json`:
    ```json
    {
    	"name": "@allons-y/skill-<skill-name>",
    	"version": "0.0.0",
    	"private": true,
    	"description": "One-sentence description",
    	"type": "module",
    	"skill": {
    		"runtime": "node",
    		"category": "Design",
    		"triggers": ["example trigger phrase"]
    	},
    	"scripts": {
    		"test": "node --test \"tests/**/*.test.js\"",
    		"coverage": "c8 yarn test",
    		"ci:test": "yarn coverage",
    		"lint": "eslint .",
    		"format": "prettier --write ."
    	}
    }
    ```
3. Add a `SKILL.md` with YAML frontmatter:
    ```yaml
    ---
    name: skill-name
    description: "One-sentence description. Include trigger phrases here."
    ---
    ```
4. Add implementation scripts under `scripts/` (Node.js, ESM). _Skip for reference-only skills (see below)._
5. Write a full test suite under `tests/` using `node --test`. Tests must not require live credentials — mock all external API calls.
6. Run `yarn install` to register the new workspace, then `yarn test` to verify.
7. Run `yarn constraints` and the contract tests (`yarn workspace @allons-y/docs test`) to validate the skill against the metadata contract (see below). `yarn constraints --fix` auto-corrects the package.json-field issues.

### The metadata contract

Two gates enforce it, split by what they can see. Both run in CI (wired into `ci:test`) and keep the catalog consistent as it scales.

**`yarn constraints`** (Yarn's workspace engine, `yarn.config.cjs`) owns package.json-field invariants across every skill workspace: `private: true` and the canonical `@allons-y/skill-<dir>` package name. `yarn constraints --fix` rewrites offending manifests in place, with correct key order.

**The JSON Schema + contract tests** (`schemas/skill.schema.json`, exercised by `docs/tests/skill-contract.test.js`) own the semantic invariants that live inside `SKILL.md` / `skill.*` — things constraints structurally can't reach: a `skill.category` and `skill.runtime` from the controlled enums, at least one `skill.trigger`, a `SKILL.md` frontmatter `name` matching the directory, and `tests/` + `evals/` suites that back the site's "tested" and "eval-backed" claims.

- The allowed categories and runtimes are the `enum`s in `schemas/skill.schema.json`. Adding one is a deliberate one-line edit there — that's what stops `GitHub` / `Github` / `git` from forking.
- `additionalProperties: false` means an unrecognized `skill.*` key fails the schema, so typos surface immediately.

### Skill flavors

- **Implementation skills** ship runnable Node.js under `scripts/` (optionally with `bin/`, `templates/`). Example: `gh-notification-summary`.
- **Reference-only skills** are pure prompt + reference material — `SKILL.md` walks the agent through curated `references/*.md` files. No `scripts/` directory is required. Tests validate that SKILL.md frontmatter is well-formed and that linked references resolve. Example: `design-system`.

## Skill naming

Use lowercase hyphenated names that match the directory name (e.g., `gh-notification-summary`). The `name` field in `SKILL.md` frontmatter must match the directory name exactly.

## Languages and tooling

- **Node.js ≥ 24** (use `nvm use` — version pinned in `.nvmrc`)
- **Yarn 4** (workspaces monorepo, version pinned in `packageManager` field)
- **`node --test`** for skill test suites
- **c8** for coverage
- **ESLint + Prettier** for linting and formatting
- **Conventional Commits** enforced by commitlint + husky

Each skill declares its runtime via `skill.runtime` in its `package.json`. Today only `"node"` is supported. Adding another runtime (e.g. `"bun"`, `"deno"`) requires extending the dispatch in `scripts/run-tests.js` and documenting the toolchain here.

## Commits

Commit messages will populate the changelog so it's important that their description be clear and succinct as well as written in a customer-focused way. If a pull request has multiple commits, they must be squashed before merging into `main` to ensure a clean release message.

### Do

```sh
feat(gh-notification-summary): creates a new skill for summarizing new notifications

Stop letting your GitHub notification inbox become a graveyard. This skill gives Claude the ability to fetch, display, and act on your unread GitHub notifications — all from a single prompt.

What it does:

- Opens an interactive local dashboard at http://localhost:8000 showing each unread notification as a card, complete with labels, latest comments, and ready-to-paste action commands
- Unsubscribes you from noisy threads (/unsub 4821) without requiring you to navigate GitHub
- Marks individual notifications or your entire inbox as done in one shot
Works with any repo — pass a repo explicitly or set GITHUB_REPO as your default

Say anything like "check my GitHub notifications", "what's in my GitHub inbox?", "get me off that thread", or "mark all done" — Claude will know what to do.

Pairs well with a morning routine prompt — ask Claude to open your dashboard, summarize what needs attention, and clear the rest.
```

## Don't

- `wip`
- `fix stuff`
- `feat: updates`

## Release process

Releases are fully automated via `semantic-release`. Merging to `main` triggers:

1. Version bumps based on commit messages
2. `prepublishOnly`: dynamic assets (`.claude-plugin/marketplace.json`, `plugin.json`) are regenerated
3. Changelog update, npm publish, and a `chore(release):` commit back to `main`

Do not manually update `package.json` version or `CHANGELOG.md`.

## What NOT to do

- Do not edit `.claude-plugin/marketplace.json` or `.claude-plugin/plugin.json` by hand — both are auto-generated during publish and committed by semantic-release.
- Do not add secrets or real credentials to tests — mock all external API calls.
