# @allons-y/skill-dreamlight-valley

Cooking, gathering, and inventory management for Disney Dreamlight Valley. Gives Claude a complete catalog and three focused modes — identify a dish, recommend what to cook, generate a gather checklist — from a single prompt or slash command.

## What it does

Three slash commands, each backed by a full procedure in `references/`:

- **`/recipe [dish]`** — Identify a dish from a typed name or a cookbook screenshot and return its ingredients. Fuzzy-matches misread names, handles multi-dish screenshots one block at a time.
- **`/cook [--energy|--profit] [--floor N] [ingredients]`** — Recommend the best recipes from on-hand ingredients, ranked by value per ingredient consumed.
- **`/restock [--floor N] [--category name]`** — Read a storage screenshot and output a categorized gather checklist.

See [`SKILL.md`](./SKILL.md) for the full user-facing description and routing logic.

## Bundled data

| File | What it is |
| --- | --- |
| [`references/recipes.json`](./references/recipes.json) | 472 recipes — `name`, `course`, `star_rating`, `energy`, `sale_price`, `ingredients` (fixed or category slots) |
| [`references/gatherables.json`](./references/gatherables.json) | 386-item catalog under `categories.{ingredients, flowers, collectables, gems}` — fish live in `ingredients` with `category: "fish"` |
| [`references/sprites/*.png`](./references/sprites) | 14 labeled sprite sheets — 13 per-category gatherable sheets plus a full-catalog `recipes.png` (472 dishes, 8-col alphabetical grid with captions) |
| [`references/sprite-coords.json`](./references/sprite-coords.json) | Companion index: every catalog item AND every recipe → its `(sheet, row, col, x, y, w, h)` plus the shared grid layout |
| [`references/identify.md`](./references/identify.md), [`recommend.md`](./references/recommend.md), [`stock-check.md`](./references/stock-check.md) | Full mode procedures (steps, output formats, edge cases) |
| [`references/categories.md`](./references/categories.md) | Cooking-category quirks the JSON can't express |
| [`references/icon-cues.md`](./references/icon-cues.md) | Reading storage screenshots, sprite-sheet usage, color-family pitfalls |

All data is current to the Wishblossom Mountains update.

## Configuration

Users can drop a plain-text preferences file at the first existing path of:

1. `./dreamlight-valley.md`
2. `~/.config/dreamlight-valley.md`

See [`config.example.md`](./config.example.md) for a copyable starter. Read at the start of each mode and interpreted as prose — express things like default floor (single or per-category), `/cook` objective, top-N, and `/restock` toggles.

## Development

### Prerequisites

- Node.js ≥ 24 (`nvm use` honours `.nvmrc`)
- Yarn 4 (via Corepack)

### Scripts

```sh
# Run the data-integrity test suite (20 tests against gatherables/recipes/sprite-coords)
yarn test
yarn coverage          # same, with c8 coverage report

# Lint + format
yarn lint
yarn format

# Regenerate sprite-coords.json (and sprite sheets, if source images are present)
yarn build:sprites

# Boot a local catalog preview at http://localhost:8765 — searchable,
# filterable, sortable browser styled to match the in-game palette
yarn preview
```

From the repo root, prefix any script with `yarn workspace @allons-y/skill-dreamlight-valley`.

### `build:sprites` — two modes

The script regenerates one or two artefacts depending on what's available:

1. **Coords-only (always)** — derives every item's grid position from `references/gatherables.json` plus every recipe from `references/recipes.json`, and writes `references/sprite-coords.json`. Fast, deterministic, no native deps. Run this every time `gatherables.json` or `recipes.json` changes so the coords stay in sync.
2. **Full rebuild (when source images exist)** — if `references/images/<category>/*.png` (and/or `references/images/recipes/*.png`) is populated, regenerates each sprite sheet via `sharp` + an SVG label overlay. Layout: 8-column alphabetical grid, 120-px icons, 32-px label strip, transparent background. Run this after adding new items/recipes (and after re-scraping the matching source PNGs from the wiki) so the sheets stay aligned with the coords. Missing source PNGs render as blank cells — they're flagged in the build output as `missing source: <name>.png` so you know what to re-scrape.

If the source images aren't present, the script prints `skipped (no source folder at …)` for each sheet — coords still regenerate. Source PNGs can be re-scraped from the Dreamlight Valley Wiki via its MediaWiki API; the existing build script logs the skipped folders so you know which categories need fresh art.

### `preview` — local catalog browser

A single-file HTML app served by a tiny Node static server (`scripts/preview.js`). Loads `recipes.json`, `gatherables.json`, and `sprite-coords.json`; renders cards for every catalog item with sprite thumbnails (cropped from the sprite sheets via CSS `background-position`).

Features:

- Tabs per category with WAI-ARIA `tablist` markup and arrow-key navigation
- Name search + ingredient search (recipes only), with native `<datalist>` autocomplete
- Filter chips: course (recipes), category (ingredients), method (collectables), availability (flowers)
- Star-rating filter chips + sort dropdown on recipes
- Event filter chips + "Hide events" checkbox (covers items with explicit `event` field + flowers without `availability`)
- Recipe-ingredient links jump straight to the matching catalog entry with the right tab/filter pre-applied

Override the port with `PORT=NNNN yarn preview`. The default is `8765`.

## Project structure

```sh
skills/dreamlight-valley/
├── SKILL.md                              # User-facing skill description (routing + bundled data)
├── README.md                             # You are here
├── package.json                          # Workspace manifest + scripts
├── eslint.config.js                      # JSON sort-key rules for gatherables/recipes
├── config.example.md                     # Copyable user preferences template
├── commands/                             # Slash-command entry points
│   ├── recipe.md
│   ├── cook.md
│   └── restock.md
├── references/                           # Authoritative data + procedure docs
│   ├── recipes.json
│   ├── gatherables.json
│   ├── sprite-coords.json                # Item → (sheet, row, col, pixel box) index
│   ├── categories.md
│   ├── icon-cues.md
│   ├── identify.md
│   ├── recommend.md
│   ├── stock-check.md
│   ├── sprites/
│   │   ├── *.png                         # 13 labeled per-category sprite sheets
│   └── images/<category>/*.png           # Optional: per-item source art for full rebuilds
├── preview/
│   ├── index.html                        # Local catalog browser
│   └── assets/                           # star-coin.png, thorn.svg, etc.
├── scripts/
│   ├── build-sprites.js                  # Coords + sheet generator (sharp + SVG)
│   └── preview.js                        # Tiny static server for preview/
├── tests/                                # node --test data-integrity suites
│   ├── gatherables.test.js
│   ├── recipes.test.js
│   └── sprite-coords.test.js
└── evals/
    └── evals.json                        # LLM eval prompts (run with run-evals.js)
```

## License

[MPL-2.0](../../LICENSE)
