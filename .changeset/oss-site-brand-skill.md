---
"@allons-y/agent-skills": minor
---

New skill: **oss-site-brand**, for giving an Allons-y Studio open source project a site that looks like itself and carries the studio's credit the same way everywhere.

Point it at a repository and it first reads how the project is built, then suggests a site flavor and documentation tooling and asks you to confirm before it changes anything. Landing is built today, for lightweight single-action tools; Docs and Workspaces are recognized and suggested, and reported as not built yet rather than quietly replaced.

What you get:

- A one-page site on GitHub Pages with PR previews, in light and dark that follow the system, with no theme switcher.
- Your project's own accent, favicon, and optional fonts. Text-safe shades and the text color on buttons are computed from your accent, so a bright yellow works as well as a deep blue.
- A locked studio banner, call to action, and footer credit that no project can edit. One shared monospace font on every site.
- A logo flow that keeps what you have, asks once for a metaphor or visual, offers three simple sketches, and otherwise draws a wordmark favicon with the full icon set and a social image.
- License and links read from your `package.json`, never typed into a template.

A built-in audit keeps every page honest: contrast at 4.5:1 (3:1 for large text) in light and dark with the final colors printed, axe-core accessibility, metadata and icon links, the studio layer unmodified, fonts, license, and no stray contact addresses. A page that breaks the baseline does not ship.

Say anything like "build a landing site for this open source project", "which site flavor fits this repo?", "make a favicon for this package", or "audit this site against the studio brand".
