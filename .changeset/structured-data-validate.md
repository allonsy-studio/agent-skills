---
"@allons-y/skill-structured-data": patch
---

structured-data now validates pasted markup and audits through its validator, which also flags durations that are not ISO 8601 (`"45 minutes"` instead of `PT45M`) and a Recipe `recipeIngredient` given as one string. Template and static-site targets get JSON-LD built from the same data that renders the page.
