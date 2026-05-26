# Icon identification cues (internal aid)

This file helps **read storage screenshots accurately**. It is NOT shown to the
user and never embedded in the checklist — the checklist is plain text. Use this
to turn a blurry thumbnail into a confident name, and to know when to stop and ask.

## How to read a storage grid

The inventory is a grid of item tiles; each tile shows the item's icon and a
small **quantity number** (usually a bottom corner). A tile with no visible
number = 1.

1. **Two passes, never mixed.** First pass: record every tile as
   `(row, col) → count`, reading the number only. Second pass: identify
   icons. Counting and naming at once is where misreads happen.
2. **Grids are ordered.** In-game *collection* screens are alphabetical;
   *storage* is filled in acquisition order but still a clean 8-column grid.
   When the grid is a known collection (gems, fish, flowers), map it against
   the catalog's sorted order and **validate against one anchor tile** the
   user confirms before trusting the whole map. If the anchor doesn't line
   up, the order is wrong — re-derive.
3. **Skip 99s.** Any tile at/above the highest floor in use has deficit 0 —
   never spend effort identifying it. Only below-floor tiles need a name.
4. **Batch the questions.** Collect every below-floor ambiguous tile across
   all screenshots, then ask in one or two grouped rounds (multi-select), not
   one-at-a-time. Minimizes round-trips and identification drift.
5. **Filter by mode.** For `/cook`, only cooking ingredients matter — ignore
   tools, furniture, motifs, crafting mats, and clothing if they appear in
   the same grid. For `/restock`, every item in `references/gatherables.json`
   counts.
6. **Unreadable counts.** If a count is genuinely unreadable, mark that item
   "qty unknown" and treat it as unlimited **for that item only** — don't let
   one blurry tile void the whole floor calculation.

## Sprite sheets — your primary identification tool

`references/sprites/*.png` are labeled canonical-art reference sheets, one per
catalog category, covering **every** item in `references/gatherables.json`. Layout is
identical across all sheets: **8-column grid, alphabetical, dark background,
each cell shows a 120-px icon with the item's name captioned underneath**. The
caption is the source of truth — read it to confirm an identification rather
than guessing from color/shape.

| Sheet | Items | Use when reading… |
| --- | --- | --- |
| `recipes.png` | 472 | a cookbook / recipe-card screenshot when the dish name is hard to read |
| `gems.png` | 50 | the gems row of storage |
| `flowers.png` | 86 | the flowers row |
| `collectables.png` | 62 | the materials row (ores, dust, wood, dig spots, event items) |
| `ingredients-fish.png` | 45 | the fish row of storage |
| `ingredients-vegetable.png` | 34 | cooking-ingredient vegetables |
| `ingredients-fruit.png` | 33 | cooking-ingredient fruit |
| `ingredients-spice.png` | 20 | spices & herbs |
| `ingredients-dairy.png` | 19 | dairy & oil |
| `ingredients-seafood.png` | 17 | seafood ingredients |
| `ingredients-grain.png` | 8 | grain |
| `ingredients-sweet.png` | 8 | sweets |
| `ingredients-meat.png` | 3 | meat |
| `ingredients-ice.png` | 1 | ice (Slush Ice only) |

**How to use a sheet:** open it side-by-side with the storage screenshot, scan
alphabetically for the closest visual match, and read the caption to confirm.
This is faster and more accurate than describing icons in words.

### Fast-path: `sprite-coords.json`

`references/sprite-coords.json` is a sidecar that maps every catalog
item to its exact position on its sheet — `(sheet_file, row, col, x, y, w, h)`
plus the layout constants (8 columns, 132×164 cells, 120-px icons, 52-px
title bar). Use it instead of visually scanning the sheet when you already
know an item's name.

Two scenarios where this is the right tool:

1. **You're identifying an unknown thumbnail and have one or two candidates.**
   Look up each candidate's pixel box in the JSON, crop those regions from
   the sheet, and compare them to the storage thumbnail — much cheaper than
   loading the whole sheet to find the match.
2. **The user's storage is on an alphabetical Collection screen.** Then row N
   col M of storage maps directly to row N col M of the sprite sheet (modulo
   items the user is missing). Use `sprite-coords.json` to label tiles by
   position without any visual matching.

The JSON also doubles as the **catalog index** for verifying that any item
you're about to name actually exists in the data. If a name isn't in
`sprite-coords.json`'s `sheets.*.items` keys, it's not in our catalog.

### Gems: regular vs. shiny

Every gem on the sheet has both a regular and shiny variant captured under
distinct names (e.g. "Amethyst" vs "Shiny Amethyst"). Shiny variants have heavy
sparkle/starburst particles and a bright halo; regulars are cleaner. Read the
captioned name to disambiguate.

**Catalog quirks** — these gems have no shiny variant; don't assign one:

- **Onyx** — black/dark faceted gem.
- **Vitalys Crystal** — teal/blue raw shard. Classed by the wiki as a Mineral,
  but this skill keeps it in the gems category for floor purposes.

### Color families that still need care (DON'T guess silently)

Even with the labeled sheet, hue can mislead at thumbnail size. These groups
overlap visually — confirm by cut and label when matching:

- **Red:** Ruby (emerald-cut), Garnet (deeper red, oval/cut), Spinel
  (red/magenta oval), Jasper (red, often banded).
- **Orange/gold:** Citrine (orange oval), Evergem (starburst/pinwheel),
  Bumblestone (nugget cluster), Pyrite (gold metallic chunk), Magma (dark fiery).
- **Blue/purple:** Sapphire, Blue Zircon, Aquamarine (cyan), Amethyst,
  Star Sapphire (purple, star glint), Pure Ice (icy blue cluster).
- **Green:** Emerald (emerald-cut), Peridot (light-green oval), Jade (rounded
  nugget).

When a thumbnail lands in one of these families and the cut isn't sharp enough
to read, ask the user — don't pick the first plausible name.

### Regenerating the sprite sheets

If a new expansion adds items, fetch the new PNGs via the wiki MediaWiki API
(`action=query&titles=File:<Name>.png&prop=imageinfo&iiprop=url%7Ctimestamp`,
requires a browser User-Agent and the timestamp query param appended to the
image URL) into `references/images/<category>/`, then rerun the sprite builder
to regenerate the sheets in `references/sprites/`.

## Confirmed tile identifications (verified by user against wiki)

These were resolved from real storage screenshots + wiki cross-check. Use them to
recognize the same icons next time instead of flagging `(?)`.

### Buttons (collectables — all sell 50, colored disc/button shapes)

- **Blue Button** — blue disc. Fishing @ Peaceful Meadow, Dazzle Beach.
- **Purple Button** — purple disc. Crafting.
- **Red Button** — red disc. Foraging @ Dreamlight Valley (near villagers' houses).
- **Green Button** — green disc. Event quests.
- **Flower Button** — flower-shaped button. Peaceful Meadow & Plaza. (now in catalog)

### Other collectables

- **Dream Shard** — pale/glowing shard (rare; Night Thorns + critters).
- **Three-Leaf Clover** — green clover, sells 25. Foraging @ Dreamlight Valley.
- **Springy Bamboo** — Springtime Floating Festival event item. (now in catalog)
- **Clay** — earthy brown lump, from digging.
- **Copter Seeds** — winged/helicopter seed shape.
- **Dark Wood** — dark log/wood bundle.
- **Gold Nugget** — gold metallic lump (minerals).
- **Gravel** — small grey stone pile.
- **Marble** — white/veined block (minerals).
- **Posidonia** — green seagrass strands.
- **Red Algae** — red/crimson seaweed strands.
- **Goose Feathers** — feather, fishing open water @ Pixie Acres (Wishblossom).
  (now in catalog, forageable)
- **Scales** — fishing open water @ The Oasis, Glittering Dunes. (now in catalog,
  forageable)

### Flowers

- **Green Silk Flower** — sells 73. Runway River, Paisley Park, Modish Marsh, Haute Plateau.
- **Yellow Lily of the Valley** — yellow bell flowers, sells 88. Sundae Shores,
  Pixie Flats, Hunny Falls, Hundred-Acre Fields.

### Fish

- **Balloon Fish** — round pufferfish/balloon shape, sells 60. Pixie Acres.
  (catalogued under ingredients with `category: "fish"`)

### NOT gatherables — exclude from gather lists (CRAFTED)

- **Fabric** — crafted from 5× Cotton. Not foraged.
- **Glass** — crafted from 5× Sand + Coal. Not foraged.
These appear in storage but must never go on a *gather* checklist — the user crafts
them. If seen, note they're crafted and point to inputs (cotton; sand+coal) which
ARE gatherable.

## Event & digging collectibles (not all are gatherables)

**Floor convention for event items:** Buttons, Three-Leaf Clover, Springy Bamboo,
Festive Wrapping Paper and similar event collectibles are technically collectables,
but in practice they cap and behave like the 50-floor items (cooking/flowers/gems),
not like bulk 99-floor materials. Default them to the **cooking/flower floor (50)**
unless the user says otherwise. (Plain digging/foraging *materials* — Night Shard,
Dream Shard, Clay, Gravel, Dark Wood, etc. — stay at the materials floor, 99.)

Storage mixes these in. ARE catalog gatherables (count toward floor):
`Egg-cellent Fruit`, `Wild Spring Egg`, `Spring V-EGG-etable`, `Shovel Bird Eggs`
(cooking:dairy); `Night Shard`, `Dream Shard`, `Pixel Shard`,
`Festive Wrapping Paper`, `Three-Leaf Clover`, `Sequin Strands`,
`Rainbow Rose Bouquet` (collectables). The recurring **black spike/shard tiles** are
**Night Shards**. NOT gatherables (exclude): memory shards, treasure clues, key
fragments, companion/critter/decor eggs, furniture.
