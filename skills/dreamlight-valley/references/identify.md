# Identify mode

Trigger: `/recipe <dish name>`, "what's in <dish>", or any uploaded recipe
card / cookbook screenshot.

Works for a single dish **or a screenshot listing several dishes** (e.g. a
cookbook/menu view). If the image shows multiple recipe names, identify and
return ingredients for **every** named dish, not just the first.

## Steps

1. **Get the dish name(s).** Read from the uploaded image. In-game screenshots
   show the dish name as a clear text label (top of the recipe card or cookbook
   entry; a cookbook/menu list shows one name per row). Phone photos of a
   TV/monitor are messier but names are normally still legible. If no image was
   provided, use the dish name(s) the user typed. When several dishes are
   present, process each one.

2. **Look it up in `references/recipes.json`.** Try the `name` field as-is
   first. For slightly-misread names (OCR or blurry photos), normalize both
   sides — lowercase, strip punctuation, spaces, and accents — and match on
   the closest result.

3. **Return just the ingredient list** by default. Star rating, energy, sell
   price, and sourcing only if they ask or the user's config opts them in via
   `recipe.extra_fields`.

## Output format

```markdown
**[Dish Name]** ([N]-star [course])

- ingredient 1
- ingredient 2
- ingredient 3 — *any <category>*
```

For **category slots** (`category: true` in the JSON), append "— *any
<category>*". Only expand the category into specific options if the user asks
or the category is non-obvious — `references/categories.md` has the full
lists, with a sprite sheet per category for visual confirmation. If a dish has
duplicate ingredients, show quantity: "oats ×2".

**Multiple dishes in one image:** repeat the block above for each dish, in
the order they appear. Keep each block compact so a list of 5–10 dishes stays
scannable. If one name in the batch is unreadable or not in the dataset,
handle just that one as an edge case (say so) and still return the rest.

## Edge cases

- **Ambiguous read.** If you genuinely can't tell which of two dishes it is,
  show both and ask — don't guess silently.
- **Photo shows a finished plate, not a recipe card.** Many dishes look alike
  cooked. With no name text visible, tell the user you need the dish *name*
  (recipe card or cookbook entry), not just the plated food.
- **Not in the dataset.** Bundled data is current to the Wishblossom
  Mountains update. If a dish isn't found, it may be newer. Say so plainly,
  then offer to look it up on the wiki (dreamlightvalleywiki.com) if web
  access is available. Do not invent ingredients, energy, or sell prices.

(Schema reference: SKILL.md's "Bundled data" section covers recipe shape and
the category-slot pattern.)
