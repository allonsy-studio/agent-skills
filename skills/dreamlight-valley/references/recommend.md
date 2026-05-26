# Recommend mode

Trigger: `/cook [--energy|--profit] [--floor N] [ingredients]`, "what should I
cook with…", "most profitable recipe", "best recipe for energy", etc.

The user tells you what ingredients they have. You find recipes they can cook
and rank them by their chosen objective.

## Step 1 — Gather inputs

You need three things. Ask for any that are missing (one short batched
question):

1. **Ingredients on hand** — names with quantities. Most often this comes
   from a backpack/storage screenshot. **Read it per `references/icon-cues.md`**
   — same two-pass procedure as Stock-check, just filtered to cooking
   ingredients. If the user types ingredients instead of uploading an image,
   use those; if they give names without counts, treat each as unlimited and
   say you did so.
2. **Objective** — `energy` or `profit`. Use the config default if set;
   otherwise ask. If they say "best" or "most worth it" without specifying,
   default to **profit** and say so.
3. **Inventory floor** (see Step 2) — only prompt if quantities are known;
   if they aren't, the floor can't bind, so skip it.

## Step 2 — Apply the inventory floor

The user can set a **minimum number of each item to keep in inventory at all
times** so a recommendation never wipes out a stockpile. Rules:

- **Default floor is 50, configurable.** If the user names a number, use it.
  If they say "max" or "a full slot", use **99**. Otherwise use the config's
  `floors.default` (or per-category floor), falling back to 50. Always state
  the floor you used.
- **The floor applies to every ingredient.** Keep at least `floor` of each
  item; only the surplus above it is available to cook with.
- An ingredient is **available to cook with** only if
  `quantity_on_hand − floor ≥ 1`. You may only spend down to the floor, never
  below. If a recipe needs 2 of an item, you need `floor + 2` on hand.
- If quantities are unknown (Step 1 fell back to "unlimited"), the floor
  cannot bind — note that recommendations don't account for a floor because
  counts weren't provided.

## Step 3 — Find cookable recipes

A recipe is cookable if **every** ingredient slot can be satisfied:

- **Fixed slot** (`{"name": "..."}` with no `category` key): the user must
  have that exact ingredient, respecting the floor.
- **Category slot** (`category: true`): the user must have at least one
  ingredient from that category (`references/categories.md`), respecting the
  floor. Record which specific item you'd spend.
- **Multiple category slots of the same category** (e.g. two "any vegetable"
  slots): prefer filling them with *distinct* items — in-game these slots
  generally expect different ingredients. Only repeat the same item across
  slots if the user truly has just one qualifying item with enough quantity
  (count − floor ≥ number of slots), and flag that assumption.
- **Duplicate fixed ingredient** (e.g. needs 2× oats): the user needs
  `floor + 2` of it.

Skip recipes that can't be fully satisfied. Don't partially recommend.

## Step 4 — Rank by objective (efficiency first)

The user is cooking to convert **surplus** (ingredients above their floor)
into value, so the primary ranking is **efficiency: value per ingredient
consumed**. Compute it from the actual plan:

- Let **`items_used`** = total ingredient units the recipe consumes in the
  plan from Step 3 (every fixed unit, every duplicate, every category slot
  you filled). A 5-slot recipe with no duplicates uses 5.
- **Objective = profit** → primary score = `sale_price / items_used`.
- **Objective = energy** → primary score = `energy / items_used`.
- Sort cookable recipes by that score, descending.

**Secondary view (when `cook.show_secondary_view` is on):** also note the
ranking by *total* `sale_price` (or `energy`) — the single highest-value dish
regardless of how many ingredients it eats. Surface as a brief one-liner so
the user can choose between "most efficient use of my surplus" (primary) and
"biggest single payout" (secondary). Don't bury the primary efficiency
ranking under it.

**Batches** — because the point is using surplus, compute how many times each
top recipe can be cooked before any of its ingredients hits the floor:
`batches = min over each used ingredient of floor_division((on_hand − floor) / units_needed_per_cook)`.
Report it for the top pick(s) as a short add-on (e.g. "× 3 before hitting
floor"). Skip batches if quantities are unknown.

**Important caveat to surface:** `energy` and `sale_price` are for the **base
recipe**. DDV lets you drop extra ingredients into open category slots, and
doing so **raises both energy and sell price** (and uses more surplus). So
the bundled numbers are a floor on value, not a ceiling. Mention this when
it's decision-relevant — especially that a recipe with spare category slots
both pumps value and burns more of your surplus.

## Step 5 — Present the top results

Show the top N by efficiency (`cook.top_n` from config, default 5; more only
if asked). Keep it scannable:

```markdown
Optimizing for **[energy|profit]** per ingredient · floor: **[N]**

Most efficient use of your surplus:
1. **[Dish Name]** — [value]/ingredient · [total] [coins|energy] total · uses [k] items
   Uses: ingredient, ingredient, [category→ chosen item]   · can cook ×[batches]
2. ...

Highest single payout: **[Dish]** ([total] [coins|energy], uses [k] items)
```

After the list, optionally add ONE short line of insight — e.g. the single
most limiting ingredient across the top picks, or which recipe has spare
category slots to pump value further. Don't pad it.

**A note on `star_rating`:** for the original ~413 recipes it follows the DDV
"stars = base ingredient count" convention; for recipes sourced from the wiki
it is the dish's displayed in-game star rating. These usually agree but can
differ for a few dishes. Don't over-index on it for ranking — rank on
`energy` / `sale_price`, the figures that actually drive the decision.
(Schema reference: SKILL.md's "Bundled data" section.)

## Edge cases

- **Nothing is cookable** (often because the floor is too high or a key
  ingredient is short): say so plainly, name the closest misses, and tell the
  user exactly what they're short on (e.g. "1 more cheese above your floor
  would unlock Souffle"). Don't silently return an empty list.
- **Both energy and profit asked**: run the efficiency ranking twice (once
  per objective) and show two short lists. Each still leads with efficiency
  and notes its highest-total-value alternate.
- **Course restriction** ("only desserts", "just appetizers"): filter on
  `course` before ranking. If they ask for an expansion-specific list ("only
  Eternity Isle"), note that `references/recipes.json` doesn't tag expansion
  — fall back to filtering by ingredient origin where reasonable, or say
  it's unsupported.
