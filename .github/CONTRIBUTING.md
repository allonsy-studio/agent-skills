# Contributing to @allons-y/agent-skills

Allons-y — let's go! Contributions of all kinds are welcome: bug fixes, new features, documentation improvements, and test coverage. If you're unsure whether your idea fits the project, open an issue first and we'll figure it out together.

## Before you start

1. **Search existing issues** before opening a new one — your bug or idea may already be in progress.
2. **Open an issue** to discuss non-trivial changes before writing code. This saves everyone time and avoids PRs that can't be merged.
3. **Fork the repository** and clone your fork locally:
    ```sh
    git clone https://github.com/<your-username>/agent-skills.git
    cd agent-skills
    yarn install
    ```

## Development workflow

### Branching

Create a branch from `main` that describes your change:

```sh
git checkout -b fix/gh-notif-truncation
git checkout -b feat/new-useful-skill
```

### Adding a New Skill

> **Designing the skill:** Before writing code, read [How to architect a skill](../docs/skill-architecture.md). It covers the decisions that make or break a skill — the triggering `description`, progressive disclosure, instructions vs. scripts, and evals — and ends with a pre-PR checklist. The [New Skill Proposal](../../issues/new?template=new_skill.yml) issue template walks through the same decisions.

Each skill lives in its own directory under `skills/`. A standard skill should include:

1. **`SKILL.md`**: Documentation following the required format (including YAML frontmatter with `name` and `description`). The `name` field must match the directory name exactly.
2. **`package.json`**: Workspace manifest with `"private": true` and a `skill.runtime` declaration.
3. **`scripts/`**: The Node.js implementation (ESM). _Optional for reference-only skills — see below._
4. **`tests/`**: A `node --test` suite.
5. **`evals/evals.json`**: Eval prompts validating skill triggering behavior (see [Evals](#evals) below).

#### Skill flavors

- **Implementation skills** ship runnable Node.js code under `scripts/` (and optionally `bin/`, `templates/`). Example: `gh-notification-summary`.
- **Reference-only skills** are pure prompt + reference material — the SKILL.md guides the agent through reading curated `references/*.md` files. No `scripts/` directory is required. Tests should still validate that SKILL.md frontmatter is well-formed and that every linked reference file resolves. Example: `design-system`.

### Workspace structure

This repo is a Yarn workspaces monorepo — each skill under `skills/` is a workspace member with its own `package.json`. To list all workspaces:

```sh
yarn workspaces list
```

Each skill's `package.json`:

```json
{
	"name": "@allons-y/skill-<skill-name>",
	"version": "0.0.0",
	"private": true,
	"description": "One-sentence description",
	"type": "module",
	"skill": {
		"runtime": "node"
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

Run `yarn install` after adding a new skill so Yarn registers the new workspace.

### Running commands per workspace

Use `yarn workspace` to run a script inside a specific skill without `cd`-ing into it:

```sh
yarn workspace @allons-y/skill-gh-notification-summary test
yarn workspace @allons-y/skill-gh-notification-summary lint
```

To run a command across all workspaces at once:

```sh
yarn workspaces foreach -A run test
yarn workspaces foreach -A run lint
```

The root `yarn test` and `yarn evals` scripts continue to orchestrate everything — the workspace commands are useful when you want to target a single skill quickly.

### Running tests

```sh
yarn test                      # all skills, in parallel
yarn test <skill-name>         # single skill
```

Skills are tested with the built-in `node --test` runner. Coverage is collected via [`c8`](https://github.com/bcoe/c8) when running `yarn workspace <skill> coverage`.

### Linting and formatting

```sh
yarn workspace @allons-y/skill-<skill-name> lint
yarn workspace @allons-y/skill-<skill-name> format
```

Or, across the entire repo:

```sh
yarn lint
yarn format
```

### Evals

Each skill must include an `evals/evals.json` file that validates the skill triggers (and doesn't trigger) on realistic prompts.

**Running evals locally** requires an Anthropic API key. The runner sends each prompt to Claude with the skill's `SKILL.md` as a system prompt and the skill's scripts registered as callable tools, then asserts that the correct tool was (or wasn't) called:

```sh
export ANTHROPIC_API_KEY=sk-ant-...

yarn evals                        # all skills
yarn evals gh-notification-summary  # single skill

# Use a different model (default: claude-haiku-4-5)
ANTHROPIC_MODEL=claude-opus-4-5 yarn evals
```

Evals also run on demand in CI via the [Evals workflow](../../actions/workflows/evals.yml) (`Actions → Evals → Run workflow`).

**The format is:**

```json
{
	"skill_name": "<skill-name>",
	"evals": [
		{
			"id": 1,
			"prompt": "natural-language prompt that should trigger this skill",
			"expected_output": "description of what the agent should do",
			"files": []
		},
		{
			"id": 2,
			"prompt": "prompt that should NOT trigger this skill",
			"expected_output": "Does NOT trigger this skill. Reason why.",
			"files": [],
			"should_trigger": false
		}
	]
}
```

Include at least two positive triggers and two negative (false-positive) cases. See [`skills/gh-notification-summary/evals/evals.json`](skills/gh-notification-summary/evals/evals.json) for a complete example.

### Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). The format is:

```md
<type>(<optional scope>): <short description>

[optional body]

[optional footer(s)]
```

Common types:

| Type       | When to use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | A new feature (triggers a minor release)    |
| `fix`      | A bug fix (triggers a patch release)        |
| `docs`     | Documentation changes only                  |
| `test`     | Adding or updating tests                    |
| `refactor` | Code restructuring without behaviour change |
| `chore`    | Tooling, config, dependency updates         |

### Pull requests

- Keep PRs focused — one logical change per PR.
- Every new skill or changed behavior **must** include tests and evals.
- PR titles should follow Conventional Commits.
- Fill out the PR description — explain the "why", not just the "what".

## Project structure

```md
agent-skills/ # Root workspace (publishes to npm)
├── package.json # Root — workspaces: ["skills/*"]
├── index.js # Exports getSkills()
├── bin/install.js # npx installer CLI
├── .claude-plugin/
│ ├── marketplace.json # Auto-generated Claude Code marketplace catalog
│ └── plugin.json # Auto-generated plugin manifest
├── scripts/ # Root orchestration scripts
│ ├── run-tests.js # Parallel Node test runner
│ ├── run-evals.js # LLM eval runner
│ └── generate-plugin-manifest.js # Generates .claude-plugin/\*.json
├── skills/ # Yarn workspace members
│ └── <skill-name>/ # Each skill is a workspace
│ ├── package.json # private: true; declares skill.runtime
│ ├── SKILL.md # Skill documentation and metadata
│ ├── scripts/ # Node.js implementation
│ ├── tests/ # node --test suite
│ └── evals/ # Eval prompts (evals.json)
└── .github/
└── workflows/ # CI automation
```

## Release process

When publishing to npm, a `prepublishOnly` hook regenerates `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` from the current state of `skills/`. Semantic-release commits the regenerated files back to `main`.

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. By participating you agree to uphold a welcoming and respectful environment for everyone.

If you experience or witness unacceptable behaviour, please report it by opening a private issue or emailing [castastrophe@users.noreply.github.com](mailto:castastrophe@users.noreply.github.com).
