# @allons-y/agent-skills

[![CI][workflow-image]][workflow-url]
[![npm][npm-image]][npm-url]
[![npm downloads](https://img.shields.io/npm/dw/@allons-y/agent-skills?logo=npm)](https://www.npmjs.com/package/@allons-y/agent-skills)
[![Coverage][coverage-image]][coverage-url]
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen?logo=node.js)](https://nodejs.org)
[![Conventional Commits][conventional-commits-image]][conventional-commits-url]

**Specialized agent skills that streamline common developer workflows and reduce token usage.**

Each skill is a self-contained directory with a `SKILL.md`, Node.js implementation scripts, and a test suite. Claude Code installs natively via the plugin marketplace; other agent harnesses can vendor any skill directory via `npx`.

## Quick Start

### Claude Code (recommended)

Register this repository as a marketplace, then install individual skills through the `/plugin` UI:

```sh
/plugin marketplace add Allons-y-Studio/agent-skills
/plugin install gh-notification-summary@agent-skills
```

Claude Code clones the repo, mounts each skill directory, and surfaces them under `/plugin` for enable/disable.

### Other agent harnesses (Cursor, OpenCode, Aider, custom SDK)

Use the `npx` installer to vendor a skill directory into any agent's skill folder. The installed payload is a plain directory with `SKILL.md` + scripts — no Claude-specific wiring.

```sh
# List available skills
npx @allons-y/agent-skills

# Install a skill to the default location (~/.claude/skills/)
npx @allons-y/agent-skills gh-notification-summary

# Install to your agent's skill directory
npx @allons-y/agent-skills gh-notification-summary --dir ~/.config/cursor/skills

# Install all skills
npx @allons-y/agent-skills --all
```

For Node-runtime skills with dependencies, run `npm install` in the installed directory once it's vendored.

> **Note:** `.zip`-based distribution is deprecated and will be removed in the next major version. The installer now copies the skill directory directly.

## Available Skills

| Skill                                                                | Description                                                                                                                  | Trigger                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`gh-notification-summary`](skills/gh-notification-summary/SKILL.md) | Review, summarize, and manage GitHub notifications via an interactive local dashboard                                        | "check my GitHub notifications", `/unsub <number>`, "mark all done"                      |
| [`design-system`](skills/design-system/SKILL.md)                     | Build, name, document, and audit UI components with expert ARIA, accessibility, design token, typography, and i18n guidance  | "design system", "component library", "ARIA pattern", "what should I call this component", "review my component library" |
| [`dreamlight-valley`](skills/dreamlight-valley/SKILL.md)             | Navigate, search, and browse the Dreamlight Valley catalog of items, recipes, and gatherables                           | "Dreamlight Valley", "Dreamlight Valley catalog", "Dreamlight Valley recipes", "Dreamlight Valley gatherables" |

## Programmatic Usage

The package exposes a `getSkills()` helper for tool builders who want to list or load skills dynamically:

```js
import { getSkills } from "@allons-y/agent-skills";

const skills = getSkills();
// returns =>
// [
//   {
//     name: 'gh-notification-summary',
//     path: '/path/to/skills/gh-notification-summary',
//     description: 'Review, summarize, and manage GitHub notifications...',
//     mdPath: '/path/to/skills/gh-notification-summary/SKILL.md'
//   },
//   {
//     name: 'design-system',
//     path: '/path/to/skills/design-system',
//     description: 'Build, name, document, and audit UI components...',
//     mdPath: '/path/to/skills/design-system/SKILL.md'
//   }
// ]
```

## Development

### Prerequisites

- Node.js (v24), supports `nvm use`
- Yarn 4 (via Corepack)

### Installation

```sh
yarn install
```

### Workspace commands

This is a Yarn workspaces monorepo — each skill under `skills/` is its own workspace. Target a specific skill with `yarn workspace`:

```sh
yarn workspace @allons-y/skill-gh-notification-summary test
yarn workspace @allons-y/skill-gh-notification-summary lint
```

Or run across all skills at once:

```sh
yarn workspaces foreach -A run test
```

For full setup instructions — running tests, linting, evals, and publishing — see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## Project Structure

```sh
agent-skills/                         # Root workspace (publishes to npm)
├── package.json                      # workspaces: ["skills/*"]
├── index.js                          # Exports getSkills()
├── bin/install.js                    # npx installer CLI
├── .claude-plugin/
│   ├── marketplace.json              # Auto-generated Claude Code marketplace
│   └── plugin.json                   # Auto-generated plugin manifest
├── scripts/                          # Root orchestration scripts
│   ├── run-tests.js                  # Parallel Node test runner
│   └── generate-plugin-manifest.js   # Generates .claude-plugin/*.json
├── skills/                           # Yarn workspace members
│   └── <skill-name>/                 # Each skill is a workspace
│       ├── package.json              # private: true; declares `skill.runtime`
│       ├── SKILL.md                  # Metadata and usage docs
│       ├── scripts/                  # Node.js implementation
│       ├── tests/                    # `node --test` suite
│       └── evals/                    # Eval prompts (evals.json)
└── .github/
    └── workflows/                    # CI and release automation
```

## FAQ

<details>
<summary><b>How do I install a skill for use with Claude Code?</b></summary>

```sh
/plugin marketplace add Allons-y-Studio/agent-skills
/plugin install gh-notification-summary@agent-skills
```

Claude Code clones the repo, reads `.claude-plugin/marketplace.json`, and mounts each skill directory.

</details>

<details>
<summary><b>Can I use these skills with agents other than Claude Code?</b></summary>

Yes. Each skill is a plain directory with a `SKILL.md` (frontmatter: `name`, `description`) and a `scripts/` implementation. Use the `npx` installer to vendor a skill into any agent harness's skill folder:

```sh
npx @allons-y/agent-skills gh-notification-summary --dir <your-agent-skills-dir>
```

Or call `getSkills()` from the package to enumerate skills programmatically.

</details>

<details>
<summary><b>How do I add a new skill or run tests?</b></summary>

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for the full guide: environment setup, running tests, linting, evals format, and PR checklist.

</details>

## Contributing

Contributions are welcome — new skills, improvements to existing ones, bug fixes, and documentation. See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines.

**Ideas for new skills:**

- GitHub PR review summarizer
- Linear / Jira issue triage
- Slack digest summarizer
- Daily standup generator from git log
- Accessibility audit runner (paired with `design-system`)

## License

[MPL-2.0](LICENSE) — use freely, modify as needed; changes to MPL-licensed files should be shared back under the same license.

---

Built and maintained by [Allons-y Studio](https://allons-y.studio) · Cassondra Roberts.

[workflow-image]: https://github.com/Allons-y-Studio/agent-skills/actions/workflows/test.yml/badge.svg?branch=main
[workflow-url]: https://github.com/Allons-y-Studio/agent-skills/actions/workflows/test.yml/badge.svg
[npm-image]: https://img.shields.io/npm/v/@allons-y/agent-skills?logo=npm
[npm-url]: https://www.npmjs.com/package/@allons-y/agent-skills
[conventional-commits-image]: https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg
[conventional-commits-url]: https://conventionalcommits.org/
[coverage-image]: https://img.shields.io/nycrc/Allons-y-Studio/agent-skills
[coverage-url]: https://github.com/Allons-y-Studio/agent-skills/blob/main/.nycrc
