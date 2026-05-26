# Stock-check mode

Trigger: `/restock [--floor N] [--category name]` with a storage/backpack
screenshot, or "what do I need to gather", "gather list", "restock".

The user shows a storage/backpack screenshot and wants a **gather list**: how
many of each item they need to reach their inventory floor, including items
missing entirely. Source of truth is `references/gatherables.json` (every stackable
gatherable item, grouped by category).

## Step 1 — Read storage and set the floor

- Read each item and its quantity from the screenshot per
  `references/icon-cues.md` (two-pass read, 99-skip, sprite-sheet
  disambiguation, "qty unknown" handling).
- Set the floor: default **50**, or **99** if the user says "max"/"full
  slot", or any number they name. State the floor used.
- **Per-category floors are supported.** Storage caps differ by type
  (ingredients, flowers, gems commonly sit near 50; collectables —
  ores/dust/stone — near 99). If the screenshots show two cap clusters,
  **ask once** which floor structure: one across the board, or a split
  (e.g. 50 for ingredients/flowers/gems, 99 for collectables). The user's
  config may already specify per-category floors; honor those without
  asking.

## Step 2 — Compute deficits against the full catalog

For **every** item in `references/gatherables.json`:

```javascript
deficit = max(0, floor − quantity_on_hand)
```

Items at or above the floor have deficit 0 and are omitted (unless config's
`restock.show_at_floor_items` is on). Items present but below the floor show
their shortfall. Items not in the screenshot at all are treated as quantity
0, so they need the full floor amount. An item the user has but that isn't
in the catalog: include it under its best-fit category and note it's
uncatalogued (unless `restock.include_uncatalogued` is off).

## Step 3 — Present the gather list as a CHECKLIST

Output a **checkable list** (Markdown `- [ ]` checkboxes). Keep it lean —
the user knows the game; don't explain what they already understand.

**Format rules (these are deliberate; do not re-add removed elements):**

1. **Title, then a table-of-contents** linking to each category section. Use
   Markdown anchor links: `- [Shiny gems](#shiny-gems)` etc. The TOC goes at
   the very top so a long list is navigable.
2. **One section per category**, each an `## Heading` the TOC links to.
   Group by `references/gatherables.json` structure: cooking subcategories collapsed
   into one "Cooking ingredients" section is fine; gems split into
   **Shiny gems** and **Regular gems** (separate catalog items). Lead with
   the biggest-deficit category (often shiny gems) so the priority is first.
3. **Each row is item name + count needed only:** `- [ ] Item name — N`. The
   `N` is units needed to reach floor. **Do NOT** include "have X", per-row
   floor numbers, category totals, or a grand total — they're noise. Sort
   within a section by largest deficit first.
4. **No emojis. No icons. No embedded or hot-linked images.** Plain text
   only.
5. **Floor is a single footnote** at the bottom (e.g. a `<sub>` line): state
   which floors applied to which categories, that numbers are units-to-floor,
   and that at-floor items are omitted. Don't repeat per row.
6. **Mark uncertain identifications inline** with `(?)` after the name so the
   user can verify in-game — never fabricate an identity to avoid the flag.
   If a whole sub-group is uncertain, a short italic `_Verify in-game:_`
   subheading is fine.

No summary table, no totals, no preamble explaining the floor concept.
Title → TOC → sections → footnote. Then present the file.

## Edge cases

- **Everything is at/above floor**: say so — nothing to gather. Don't print
  empty category headers.
- **Huge list**: don't refuse it, but offer to narrow — e.g. "want just the
  top-ups, or a specific category like vegetables or gems?" Let the user
  trim scope.
- **One category only** (`--category gems` or "just gems"): restrict before
  computing.
- **Floor differs by category**: per-category floors are supported (see Step
  1). If the user wants e.g. 50 for ingredients/flowers/gems and 99
  for collectables, apply each per category and state both. Only if they
  want a per-item floor inside one category is it unsupported — say so and
  use one floor for that category.
