# Flavors and tooling

The skill reads the repository's architecture and tooling and suggests. It never applies a flavor or a tool on a guess. The maintainer confirms or picks another. In an unattended run the suggestion is applied and listed in the report.

## Contents

- [Rules](#rules)
- [How facts are read](#how-facts-are-read)
- [Known projects](#known-projects)
- [Confirming](#confirming)
- [Not yet built](#not-yet-built)

## Rules

Evaluated in order; first match wins:

1. Nested docs pages: each workspace is surfaced as its own product, a page each. Flavor: **workspaces**.
2. Slim and focused on a single action. Flavor: **landing**.
3. Everything else. Flavor: **docs** (the default).

Tooling suggestions run beside the flavor suggestion:

- TypeScript source: suggest **typedoc** to generate the API reference.
- JavaScript resources: suggest **jsdoc**.

Both can apply to one repository. Landing grows into Docs without a rewrite: same core.

## How facts are read

| Fact | Reading |
| --- | --- |
| TypeScript | A `tsconfig.json`, or `.ts` sources (not `.d.ts`) |
| JavaScript resources | `.js` or `.mjs` sources, outside tests, scripts, docs, config files, and build output |
| Nested docs pages | At least two workspaces, each with its own page source (`SKILL.md` or a `docs/` folder of markdown). A single table of contents documenting functions of several plugins (opx) is not nested |
| Single action | No workspaces, one command or one export, a short README (200 lines or fewer), and at most three docs files |

The last two are judgment calls. `scripts/suggest.js` prints its `signals`; when they look wrong, read the README and override with `--nested-docs yes|no` or `--single-action yes|no`. Overrides are listed in the output.

## Known projects

| Project | Flavor | Why |
| --- | --- | --- |
| agent-skills | Workspaces | Docs nest under workspaces: each skill gets its own page |
| opx | Docs | One product, many packages, eslint-style: default Docs plus a package index. TypeScript, so typedoc is suggested |
| dashly | Docs | Stays a docs site (confirmed). JavaScript, so jsdoc is suggested |
| envoy, glob-concat-cli, markdown-it-anchor-sections | Landing | Lightweight utilities, one page (confirmed as candidates) |

## Confirming

```text
node scripts/suggest.js --repo .                      # status: needs-confirmation, with the question to ask
node scripts/suggest.js --repo . --choose landing     # the maintainer's answer
node scripts/suggest.js --repo . --unattended         # applied, listedInReport: true
```

Ask in one message: the suggested flavor, the reason, and the tooling. Accept a yes or another flavor name.

## Not yet built

Phase 1 ships the core and Landing. For a Docs or Workspaces result, `built` is `false` and the output carries a `report` line: tell the maintainer the flavor is not yet built and stop. Do not substitute Landing. `scripts/scaffold.js` refuses these flavors.
