---
name: oss-site-brand
description: "Scaffold, brand, and audit a project site for an Allons-y Studio open source repository: one shared core, a flavor (Landing built; Docs and Workspaces recognized), the project's own accent, favicon, and fonts, and a locked studio banner, call to action, and footer credit. Use whenever the user asks to build, brand, or audit a site, landing page, or GitHub Pages docs for an allonsy-studio project, picks or asks which site flavor fits a repo, needs a favicon, logo, or wordmark for a package, or wants the studio brand, contrast, or accessibility baseline checked. Do not trigger for general web design, other brands, or sites that are not Allons-y Studio open source projects."
---

# OSS site brand

Builds a project site from one shared core. Each project keeps its own accent, favicon, and type. The studio layer is locked: a banner, a call to action, and a footer credit, identical everywhere.

Run scripts from this skill's directory (`<skill-path>`). Needs Node 24+ and `yarn install` at the repository root.

## Phase 1 scope

| Flavor | Status |
| --- | --- |
| Landing | Built: one page for a single-action project |
| Docs, Workspaces | Recognized and suggested, but not yet built: report it and stop |

## Workflow

Copy this checklist and tick it off:

```text
- [ ] 1. Suggest a flavor and tooling, then confirm
- [ ] 2. Scaffold the core and the flavor
- [ ] 3. Fill the project layer
- [ ] 4. Resolve the logo and favicon
- [ ] 5. Wire package.json
- [ ] 6. Build, test, audit
- [ ] 7. Report
```

1. **Suggest, then confirm.** Run `node scripts/suggest.js --repo <repo-root>`. It prints a suggestion and never applies it. Ask the maintainer to confirm or pick another flavor, then rerun with `--choose <flavor>`. With nobody to ask, rerun with `--unattended`: the suggestion is applied and must be listed in the report. If the suggestion rests on a judgment call (nested docs pages, single action), read the README and pass `--nested-docs yes|no` or `--single-action yes|no`. Detail: `references/flavors.md`.
2. **Scaffold.** `node scripts/scaffold.js --target docs --flavor landing`. Safe to rerun: it reports drift, never overwrites the project layer, and flags any edit to a studio file as a locked-file edit. Fix a locked-file edit by rerunning with `--update`; never keep it. Layer rules: `references/architecture.md`.
3. **Project layer.** Edit `docs/src/_data/project.json`: `accent`, `lede`, `install`, `usage`, `features`, optional `fonts`. Ask for the accent if the project has no brand color yet. Fields: `references/project-layer.md`. Color and font rules: `references/typography-and-color.md`.
4. **Logo and favicon.** `node scripts/mark.js inspect --site docs` returns `keep`, `ask`, `propose`, or `wordmark`. Existing assets always win. Ask the one question once, offer three simple SVG sketches if there is a concept, otherwise `node scripts/mark.js wordmark --site docs`. Never block on this. Detail: `references/logo-and-favicon.md`.
5. **Wire package.json.** Add the devDependencies and scripts the scaffold prints. Never write a license, license URL, or contact address into a template: the license is read from `package.json`.
6. **Build, test, audit.** `yarn docs:build`, then `yarn docs:test`, then `node scripts/audit.js --site docs`. Fix every failure. Do not weaken a check or edit a locked file to pass. Checks: `references/testing.md`.
7. **Report.** State the flavor and whether it was confirmed or applied unattended, the tooling suggestions (typedoc for TypeScript, jsdoc for JavaScript), whether a wordmark was used, any drift or locked-file edits, and the audit result with the contrast hex values.

## Hard rules

- Contacts: sales `contact@allons-y.studio` (only in the footer call to action), conduct `report@allons-y.studio`, security `security@allons-y.studio`. Never a personal, hey, Gmail, or iCloud address, never the `.llc` domain, never a `twitter:card` tag.
- Licenses: opx and envoy are Apache-2.0; everything else defaults to MPL-2.0. Always read from `package.json`.
- Theme follows the system (light and dark). No theme switcher.
- Monospace is locked: PT Mono, then the `ui-monospace` stack. Projects may override sans and display only.
- Text-safe accent shades and the on-accent color are computed from the accent. Never assume white text on the accent.

## Reference

| Need | Read |
| --- | --- |
| Layers, core contents, studio rules, contacts, licensing | `references/architecture.md` |
| Flavor and tooling suggestion rules, unattended runs | `references/flavors.md` |
| `project.json` fields | `references/project-layer.md` |
| Logo, favicon, wordmark, icon files | `references/logo-and-favicon.md` |
| Fonts, accent, contrast | `references/typography-and-color.md` |
| The test suite, running it, extending it | `references/testing.md` |
