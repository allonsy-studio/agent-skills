# Project layer

Everything a maintainer owns about their site lives in `docs/src/_data/project.json` plus the icon files. The scaffold creates the file once and never overwrites it.

| Field | Type | Notes |
| --- | --- | --- |
| `flavor` | `landing`, `docs`, `workspaces` | Written by the scaffold; selects the flavor checks |
| `accent` | hex color | Required. Text-safe shades and the on-accent color are computed from it |
| `tagline` | string | Defaults to the first sentence of the `package.json` description |
| `lede` | string | Hero paragraph; defaults to the description |
| `install` | string | Defaults to `npm install <package name>` |
| `usage` | `{ language, code, caption? }` | A code sample shown under Usage |
| `features` | `{ title, body }[]` | Feature cards |
| `packages` | `{ name, description, href? }[]` | Optional package index |
| `logo` | file name in `src/assets/img/` | Optional; without it the header shows the favicon and the name |
| `url` | string | Overrides the default `https://projects.allons-y.studio/<repo>/` |
| `fonts` | `{ sans?, display? }` | Each `{ family, weights? }`. `mono` is locked and rejected |

Validation reports every problem at once. Name, license, repository, node range, and links are never written here: they are derived from `package.json`.

Copy guidance: lead with what the project does for the reader, keep `features` to three to six items, and keep `usage` to a single copy-pasteable command or snippet.
