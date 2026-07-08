# Recipe

Full vocabulary: https://schema.org/Recipe

## Properties

| Property | Typically required for rich results | Notes |
|---|---|---|
| `name` | Yes | |
| `image` | Yes | |
| `author` | Recommended | Nested `Person` or `Organization` |
| `datePublished` | Recommended | |
| `description` | Recommended | |
| `prepTime` / `cookTime` / `totalTime` | Recommended | ISO 8601 duration format, e.g. `PT20M` for 20 minutes |
| `recipeYield` | Recommended | e.g. `"4 servings"` |
| `recipeIngredient` | Yes | Array, one string per ingredient |
| `recipeInstructions` | Yes | Array of `HowToStep` objects, or a single string for simple recipes |
| `nutrition` | Optional | Nested `NutritionInformation` |
| `aggregateRating` | Optional | Only include with real rating data |
| `video` | Optional | Nested `VideoObject` if a cooking video exists |

## Microdata example

```html
<div itemscope itemtype="https://schema.org/Recipe">
  <h1 itemprop="name">Weeknight Sheet-Pan Salmon</h1>
  <img itemprop="image" src="/img/salmon.jpg" alt="">
  <span itemprop="prepTime" content="PT10M">10 min prep</span>
  <span itemprop="cookTime" content="PT20M">20 min cook</span>
  <ul>
    <li itemprop="recipeIngredient">1 lb salmon fillet</li>
    <li itemprop="recipeIngredient">2 tbsp olive oil</li>
  </ul>
</div>
```

## JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Weeknight Sheet-Pan Salmon",
  "image": "https://example.com/img/salmon.jpg",
  "prepTime": "PT10M",
  "cookTime": "PT20M",
  "recipeIngredient": ["1 lb salmon fillet", "2 tbsp olive oil"],
  "recipeInstructions": [
    { "@type": "HowToStep", "text": "Preheat oven to 425°F." },
    { "@type": "HowToStep", "text": "Arrange salmon and vegetables on a sheet pan, drizzle with oil." }
  ]
}
```
