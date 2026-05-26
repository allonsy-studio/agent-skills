# Ingredient categories

When a recipe slot has `"category": true`, it accepts **any one ingredient**
from that category. To list the actual members of a category, **read
`references/gatherables.json`** and filter `categories.ingredients` by the
matching `category` field. The data is the source of truth; this file only
captures the gameplay quirks that aren't in the JSON.

## Picking an ingredient for a category slot

- A category pick only fills that slot if the specific ingredient you pick
  **doesn't accidentally trigger a different recipe**. When in doubt, the
  safest category picks are the plainest ones (e.g. onion for vegetable,
  apple for fruit).
- The categories used by the **cooking pot** differ from the Collection
  screen's groupings — use the cooking-pot categories (the ones the recipe
  data tags). Recipe data uses lowercase singular names: `vegetable`,
  `fruit`, `grain`, `dairy`, `fish`, `seafood`, `spice`, `sweet`, `meat`,
  `ice`.

## Per-category quirks

- **`dairy`** is also called "dairy/oil" in-game. The game counts some
  unexpected items here — legumes (Beans, Ruby Lentils), oilseeds (Soya,
  Canola, Peanut, Chia Seeds), egg-like items (Egg-cellent Fruit, Wild
  Spring Egg, Shovel Bird Eggs, Spring V-EGG-etable), and desert critters
  (Sand Worm, Scorpion). The "dairy" name is misleading — trust the JSON's
  `category` field, not the English meaning.
- **`meat`** is a DLC category (Eternity Isle, Storybook Vale,
  Wishblossom Mountains recipes). If a recipe wants a meat slot, any of the
  qualifying items satisfies it.
- **`ice`** has exactly one member: Slush Ice. If a slot says "ice", that's
  the pick.
- **`fish` vs. `seafood`** are separate categories — both live in
  `categories.ingredients`, distinguished only by their `category` field.
  Fish (anglerfish, bass, etc.) is `category: "fish"`; seafood (clams,
  oysters, crab, etc.) is `category: "seafood"`. A recipe slot of `fish`
  only accepts items tagged `fish`, not seafood (and vice versa).

## Slot → sprite sheet mapping

When confirming what the user has on hand for a given slot, open the
matching sheet in `references/sprites/`:

| Slot category | Sprite sheet |
| --- | --- |
| vegetable | `ingredients-vegetable.png` |
| fruit | `ingredients-fruit.png` |
| grain | `ingredients-grain.png` |
| dairy | `ingredients-dairy.png` |
| spice | `ingredients-spice.png` |
| sweet | `ingredients-sweet.png` |
| seafood | `ingredients-seafood.png` |
| meat | `ingredients-meat.png` |
| ice | `ingredients-ice.png` |
| fish | `ingredients-fish.png` |
