# Architecture

One skill, three site flavors, one shared core. Each project keeps its own identity (accent, favicon, type); the studio layer adds only a locked banner, a call to action, and a footer credit.

## Contents

- [Layers](#layers)
- [Core contents](#core-contents)
- [Studio layer](#studio-layer)
- [Contacts](#contacts)
- [Licensing](#licensing)
- [Template layout](#template-layout)

## Layers

| Layer | Owner | Contents | Project can change it? |
| --- | --- | --- | --- |
| Core | Skill | CSS, JS, WebC components, Eleventy templates, token scaffold, shared mono font, test suite, base layout, accessibility baseline, Eleventy config, Pages deploy and PR previews | Extend only |
| Studio | Skill (locked) | Slim banner, call to action to `contact@allons-y.studio`, footer credit lockup | No |
| Flavor | Skill | Page templates for Docs, Landing, or Workspaces, suggested from the repo and confirmed by the maintainer | Pick one |
| Project | Maintainer | Accent, favicon and logo, optional font families, copy, features, license (read from `package.json`) | Yes |

All projects should use opx for linting and dashly for template skills.

## Core contents

| Part | Contents | Notes |
| --- | --- | --- |
| CSS | Reset, token scaffold (`--accent`, text-safe shades, `--font-*`), layout, base components (button, card, chip, code block, table), light and dark via `light-dark()` | A project overrides tokens only |
| JS | Small modules with no dependencies: code copy button today; in-page nav highlight and a search hook arrive with Docs | Progressive enhancement: every page works without it |
| WebC components | Locked: `<studio-banner>`, `<studio-cta>`, `<studio-footer>`. Shared: `<feature-grid>`, `<code-sample>`, `<package-index>`, `<project-card>`. Page chrome: `<site-head>`, `<site-header>`, `<site-footer>` | Locked components render from site data; props only |
| Eleventy templates | Base layout, flavor layouts, head partial (meta, Open Graph, icon links), site data derived from `package.json`, plugin config (HtmlBasePlugin, Prism, WebC), Pages workflow | Flavor layouts extend the base |

## Studio layer

Locked files (hash-checked by `tests/studio.lock.json`):

- `src/_components/studio-banner.webc`, `studio-cta.webc`, `studio-footer.webc`
- `src/_data/studio.js`
- `src/assets/css/studio.css`
- `src/assets/img/studio/*.svg`

Rules the audit enforces:

- The banner comes before `main`; the call to action and the footer credit sit inside the footer.
- `contact@allons-y.studio` appears only in the call to action.
- The studio styles read only `--studio-*` tokens, so a project accent never changes how the studio appears.

After a studio file changes in this skill, run `yarn workspace @allons-y/skill-oss-site-brand lock` to refresh the hashes.

## Contacts

| Address | Used for |
| --- | --- |
| `contact@allons-y.studio` | The sales call to action. Only in the locked footer block |
| `report@allons-y.studio` | Code of conduct reports |
| `security@allons-y.studio` | Vulnerability reports (`SECURITY.md`) |

Never used: the defunct hey address, any personal Gmail or iCloud address, the `.llc` domain, `twitter:card`. The audit scans the built site and the site sources for all of them.

## Licensing

| Project | License |
| --- | --- |
| opx, envoy | Apache-2.0 |
| All others | MPL-2.0 (org default). High-value projects may opt into Apache to protect against clones |

Sites never hard-code a license. The footer and hero read it from `package.json`, so a change cannot leave a stale line behind. The audit fails on a hard-coded SPDX identifier in any site source, and reports (without failing) when a license differs from the studio default.

## Template layout

`templates/core/` and `templates/flavors/<flavor>/` mirror the site directory one to one, so a file lands at the same relative path (`templates/core/src/assets/css/tokens.css` becomes `docs/src/assets/css/tokens.css`). The Pages workflow lives in `templates/workflows/pages.yml` and lands in `.github/workflows/`.
