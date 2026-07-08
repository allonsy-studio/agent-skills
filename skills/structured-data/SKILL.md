---
name: structured-data
description: Inject or generate schema.org structured data (HTML Microdata attributes like itemscope/itemtype/itemprop, or JSON-LD script blocks) into web markup — raw HTML/templates, React/Vue/Web Components, or static-site pipelines (11ty, Astro, Eleventy, Hugo, etc.). Use whenever the user asks to add schema.org markup, structured data, rich snippets, SEO markup, itemprop/itemscope/itemtype attributes, or JSON-LD to a page, component, or site. Also trigger for requests to validate, audit, or fix existing structured data, or to decide between Microdata and JSON-LD for a project. Injection always runs through the pre-compile or server-side scripts bundled here — never via client-side JavaScript — since crawlers may index a page before hydration runs.
---

# Structured Data (Microdata + JSON-LD)

Adds schema.org structured data to markup so search engines can extract rich results (product prices, ratings, recipes, events, etc.) from a page. Covers two output formats — HTML Microdata and JSON-LD — and picks between them based on how the target project is built, not by default preference.

Read this file fully before starting. It routes you to the right reference and script rather than repeating their contents here.

**Flow at a glance:** pick technique (Step 1) → pick format (2) → load the schema-type reference (3) → run the script, review the diff (4) → preview what a parser extracts (5) → validate (6) → offer regression tests for component/11ty targets (7). Steps 5–7 are diagnostics and follow-ups; 1–4 are the core injection path.

## Step 1: Pick the injection technique

The technique depends on where the markup lives, not on the schema type:

| Target | Technique | Why |
|---|---|---|
| Static-site pipeline (11ty, Astro, Eleventy, Hugo, Jekyll) | Build-pipeline transform: write the mapping once in a plugin/config that runs at build time | Zero per-page token or editing cost after setup; scales to the whole site |
| Design-system component (Web Component, React, Vue) | Template-level authoring: embed the `itemprop`/JSON-LD binding directly in the component's template or render function | One-time cost per component; every instance inherits it automatically |
| Existing/bulk HTML files, no build pipeline | `scripts/inject_microdata.js` or `scripts/generate_json_ld.js`, driven by a selector-map config | Claude never has to read/rewrite full file contents in-context — only the small config and a diff |
| A single one-off page | Direct manual `str_replace` annotation | Scripting overhead isn't worth it for one file |

**Web Component caveat:** if the component's structured data lives inside a shadow root, only put it there via **Declarative Shadow DOM** (`<template shadowrootmode="open">`, rendered server-side so the markup is present in the initial HTML response) — never a shadow root attached at runtime via `attachShadow()`, since that content doesn't exist until client-side JS runs, and current guidance is that even where it might get picked up by a fully-rendering crawler, it shouldn't be relied on across tools. For anything you actually want indexed reliably, prefer surfacing the structured data in the light DOM or a page-level `<head>` JSON-LD block rather than burying it in a shadow tree at all — this applies even to non-declarative Microdata inside a component template.

Whichever technique you use, structured data is injected at **build time or server-render time only**. Never add it via a client-side script (`element.setAttribute('itemprop', ...)` after page load, or JS that writes the JSON-LD block into the DOM post-hydration). Search crawlers frequently index a page before JS execution completes, so client-injected structured data is unreliable and sometimes invisible to crawlers entirely. If the only markup you have access to is rendered client-side with no SSR/SSG path, say so and flag the limitation rather than injecting into the client bundle.

## Step 2: Pick the format — Microdata vs JSON-LD

Don't default to one. Read `references/format-decision.md` for the full decision guide with spec citations; the short version:

- **Microdata** (attributes on the visible elements) keeps structured data physically attached to what the user sees, so it can't drift from the rendered content — good when you control the template tightly and want that guarantee (e.g., a design-system component where the visible price and the `itemprop="price"` value are the literal same DOM node).
- **JSON-LD** (a separate `<script type="application/ld+json">` block) decouples the data from the DOM, which is easier to maintain across template/CMS changes but can silently drift out of sync with what's rendered if nobody keeps them aligned.

Both are valid, current schema.org-supported formats. Pick per task using that tradeoff — don't ask the user to pick unless the reference's guidance is genuinely ambiguous for their case.

## Step 3: Load only the relevant schema type reference

Under `references/schema-types/`, one file per common schema.org type: `article.md`, `product.md`, `person.md`, `organization.md`, `recipe.md`, `event.md`. Read only the one(s) the task needs — don't load all of them into context. Each file lists required vs. recommended properties and gives both a Microdata and a JSON-LD example.

If the task needs a schema.org type not covered by one of these files, look it up directly at `https://schema.org/<TypeName>` rather than guessing at property names from memory — schema.org's vocabulary is versioned and property sets do get revised.

## Step 4: Run the script and produce a diff

Both `scripts/inject_microdata.js` and `scripts/generate_json_ld.js` take the same config format (`assets/selector-map-template.json` — copy and fill in per project) so switching formats later doesn't mean re-authoring the mapping. Both scripts **never overwrite files directly** — they print a unified diff to stdout for review. Apply the diff yourself with `patch` (or by hand via `str_replace`) only after the user has looked at it. This keeps the person in the loop on exactly what's being added to their markup, which matters more here than most edits since structured data is publicly visible to any bot that requests the page.

First install the two runtime dependencies (`package.json` in this skill's root lists them):

```bash
npm install
```

Then run whichever script the task needs:

```bash
node scripts/inject_microdata.js --config assets/selector-map.json --target path/to/page.html
node scripts/generate_json_ld.js --config assets/selector-map.json --target path/to/page.html
```

**Hand-authoring JSON-LD instead of generating it?** When you're writing a
JSON-LD block by hand in a TypeScript project (a one-off page, or a component
that emits its own `<script>`), type-check it against the schema.org vocabulary
with Google's `schema-dts` — it catches wrong property names and value shapes
at compile time. See `references/typed-authoring.md`. This is authoring-time
help only; generated output is still validated at runtime in Step 6.

## Step 5: Preview what a parser extracts

Validation (Step 6) answers _"is the markup structurally correct?"_ — but the more common failure is markup that's valid yet says the **wrong thing**: a stale hidden `<meta>`, a currency symbol leaking into a price, or a JSON-LD block that drifted from the visible content. To eyeball the actual **values** a machine reads — and to catch Microdata/JSON-LD disagreement — run the extraction preview:

**When to run it (don't deliberate):**

- **Run it automatically, without asking,** whenever the page carries **both** Microdata and JSON-LD (the drift check is the whole point), or **immediately after generating JSON-LD** from existing markup.
- **Offer it** (one line) for a single-format page the user hand-edited.
- **Skip it** only when there's no structured data to look at.

```bash
node scripts/preview_extraction.js --target path/to/page.html
node scripts/preview_extraction.js --target path/to/page.html --format microdata|json-ld|both
node scripts/preview_extraction.js --target path/to/page.html --base https://your.site/  # resolve relative URLs
node scripts/preview_extraction.js --target path/to/page.html --json                     # machine-readable
```

It prints the extracted Microdata and JSON-LD items and, when a page carries both, a **drift report** flagging where they disagree — the exact risk `references/format-decision.md` warns about. This is a parser's-eye view for the injection loop, **not** a crawler simulation: it doesn't run JS, filter by rich-result requirements, or judge eligibility. Frame it that way to the user and keep deferring eligibility to Google's Rich Results Test. Details and the parser-vs-crawler boundary are in `references/extraction-preview.md`. Reach for this especially after generating JSON-LD, or whenever a page mixes both formats.

## Step 6: Validate

Run `scripts/validate_structured_data.js` against the result before considering the task done. It checks:
- Microdata: every `itemprop` resolves to an ancestor `itemscope` (or a valid `itemref`), no orphaned properties — this mirrors the tree-construction algorithm in the spec, not an approximation of it.
- JSON-LD: runs the block through the **`jsonld` reference processor** (Digital Bazaar's `jsonld.js` — the W3C JSON-LD spec authors' implementation) to catch structural JSON-LD errors, offline; then checks that required properties are present for the declared `@type`. Note the required-property table is **Google Search's rich-results requirements, not schema.org vocabulary** — schema.org has no "required" concept, and no npm package authoritatively publishes Google's list (see the provenance note in `scripts/validate_structured_data.js`).

This is a structural check, not a substitute for Google's Rich Results Test — mention that tool to the user for final confirmation of search-result eligibility, since that also reflects current indexing requirements that shift independently of the schema.org vocabulary itself.

## Step 7: Offer regression tests (component libraries & 11ty projects only)

Step 6 validates the markup *once*. But structured data silently rots — a later template edit, a price refactor, or a component change can invalidate markup that passed, and nobody notices until a rich result quietly disappears. For the two targets where markup is **regenerated on every build** — design-system components and static-site pipelines (11ty, Astro, Hugo, etc.) — offer to wire validation into the project's own test suite so every future build re-checks it.

After the markup is added and Step 6 passes, **ask the consumer**: _"Want me to add structured-data validation tests to your test suite, so this stays valid on every build?"_ Only prompt for component-library or static-site targets. Skip it for a single one-off page — nothing regenerates it, so there's nothing to regress.

If they say yes, run `scripts/scaffold_validation_test.js`, choosing `--type` from the target and `--runner` from the project's existing test runner:

```bash
# static-site pipeline: validate the built HTML output (run after the build)
node scripts/scaffold_validation_test.js --type eleventy --runner node --out tests --site-dir _site

# component library: validate each component's rendered output
node scripts/scaffold_validation_test.js --type component --runner vitest --out tests --render-module ../src/render.js
```

Like the other scripts, it **writes nothing** — it prints three files for review (a vendored validation core, a throwing assert helper, and a runner-appropriate test), which you then add to the project after the consumer looks them over. The generated tests depend only on `cheerio` and `jsonld` as devDependencies — no dependency on this skill staying installed. Full walkthrough, runner variants, and CI wiring are in `references/regression-tests.md`.

## Spec references

- WHATWG HTML Standard, §5 Microdata (the itemscope/itemprop/itemtype/itemid/itemref syntax): https://html.spec.whatwg.org/multipage/microdata.html
- schema.org vocabulary root: https://schema.org/docs/full.html
- JSON-LD 1.1 syntax: https://www.w3.org/TR/json-ld11/

Note on browser support: no current browser implements the old Microdata *DOM API* (`document.getItems()`); only the attribute syntax itself is relevant here, and that's fine since these scripts never rely on the DOM API.
