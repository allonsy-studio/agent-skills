---
"@allons-y/agent-skills": minor
---

Add a **structured-data** skill for adding schema.org markup (HTML Microdata or JSON-LD) to web pages, then validating it.

- Picks the right format for your project and injects markup at build or server-render time only, emitting a reviewable diff instead of overwriting your source files.
- Generates JSON-LD with typed authoring (schema-dts) and validates it against the reference JSON-LD processor, so broken or unknown types surface before they ship.
- Includes an extraction **preview** that shows exactly what a search-engine parser reads from your page, plus a `/preview-structured-data` command.
- Offers to wire structured-data regression tests into your project's existing suite so markup can't silently drift.

Say things like "add JSON-LD to this page", "add schema.org / rich-snippet markup", "validate my structured data", or "should I use Microdata or JSON-LD?" and Claude will know what to do.
