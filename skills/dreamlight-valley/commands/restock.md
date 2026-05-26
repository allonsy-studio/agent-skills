---
description: "Generate a gather checklist from a storage screenshot."
argument-hint: "optional --floor N or --category name (storage screenshot required)"
---

# /restock — Stock-check gather list

Enter the `dreamlight-valley` skill in **Stock-check mode**. Read
`references/stock-check.md` for the full Steps 1–3 and format rules, then
apply them to:

- one or more attached storage/backpack screenshots (required — ask if
  absent)
- `$ARGUMENTS` — optional flags:
  - `--floor N` → override the default floor
  - `--category <name>` → restrict to one category (`gems`, `flowers`,
    `collectables`, `ingredients`). To narrow further, follow up with an
    ingredient sub-category (`vegetable`, `fruit`, `fish`, etc.).

Load the user's config per SKILL.md's "Configuration" section first — apply
per-category floors from the config if present. Use the sprite sheets in
`references/sprites/*.png` and the cues in `references/icon-cues.md` to
disambiguate any below-floor tile before adding it to the gather list. Skip
99-tile identifications entirely.
