# Test suite

The brand and accessibility baseline ships as a `node --test` suite, the same convention as every skill in agent-skills. It runs against the built site in CI and on a maintainer's machine, so a page that breaks the baseline cannot ship.

## Contents

- [What it asserts](#what-it-asserts)
- [Running it](#running-it)
- [In a project](#in-a-project)
- [The skill's own tests](#the-skills-own-tests)
- [Adding a check](#adding-a-check)

## What it asserts

| Area | Asserts |
| --- | --- |
| Contrast | Every text and on-accent pair meets 4.5:1 in light and dark (3:1 for large text and UI). Prints the final hex values |
| Accessibility | axe-core reports no violations on each page; one `main`, `lang` set, skip link first, headings in order, visible focus, reduced motion honored |
| Metadata | Title, description, canonical, `og:image` (1200 by 630), `theme-color` present; every icon and manifest link resolves |
| Studio layer | Locked files match their hashes; banner, call to action, and footer credit present, in place; `contact@` only in the call to action |
| Typography | `--font-mono` is the shared mono, declared once; fonts load with `swap`; no loaded family goes unused |
| License and contacts | License on the page matches `package.json`; no hard-coded license; no hey, Gmail, iCloud, `.llc`, personal address, or `twitter:card` |
| Flavor | Landing: a single page with an `#install` section and no sidebar or search. Docs and Workspaces: skipped as not yet built |

axe's color-contrast rule needs a layout engine, so contrast is measured from the tokens instead.

## Running it

```text
yarn docs:build
yarn docs:test                              # node --test docs/tests/
node scripts/audit.js --site docs           # same checks, readable report, exit 1 on failure
node scripts/audit.js --site docs --json
```

Set `SITE_BASE` (or pass `--base`) to the path the build was served from, for example `/my-project/` or a PR preview path. Without it links are resolved against `/`.

## In a project

The scaffold copies `tests/brand.test.js`, the checks in `tests/lib/`, and `tests/studio.lock.json` into `docs/tests/`. The Pages workflow runs `yarn docs:test` after the build and before the deploy. The project needs `axe-core` and `jsdom` as devDependencies (the scaffold prints them).

## The skill's own tests

`yarn test oss-site-brand` runs the suite against two real Eleventy builds of the fixture project (default, and an Apache-2.0 project with a yellow accent and project fonts), then breaks copies of the build to prove each check fails when it should. It also covers the flavor rules against repositories shaped like the known projects, the logo and favicon decisions, the scaffold, and the skill's own structure.

## Adding a check

Add a pure function to `templates/core/tests/lib/checks.js` returning `{ id, title, ok, problems, notes }`, register it in `runChecks` and `suite.js`, and add a passing and a failing case to `tests/site-build.test.js`. Never loosen a threshold to make a page pass.
