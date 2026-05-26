---
description: "Recommend the best recipes to cook from the ingredients you have on hand."
argument-hint: "optional flags --energy or --profit, --floor N, plus ingredients on hand"
---

# /cook — Recommend recipes from on-hand ingredients

Enter the `dreamlight-valley` skill in **Recommend mode**. Read
`references/recommend.md` for the full Steps 1–5, then apply them to:

- `$ARGUMENTS` — may include flags and/or ingredients:
  - `--energy` → lock objective to **energy**
  - `--profit` → lock objective to **profit**
  - `--floor N` → override the inventory floor
  - anything else → ingredients on hand (free-text or comma-separated)
- any attached backpack/storage screenshot

Load the user's config per SKILL.md's "Configuration" section before
computing — apply config defaults for objective, floor (per-category if
present), and top-N unless the user overrode them. Command-line flags always
win over the config.
