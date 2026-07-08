# Extraction preview — what a parser reads from your HTML

`scripts/preview_extraction.js` parses a page's **static HTML** and shows the
structured data a spec-compliant parser extracts: the Microdata items, the
JSON-LD items, and — when both are present — a **drift report** of where they
disagree. It's a diagnostic for the injection loop: eyeball the actual values a
machine reads, and catch the two formats falling out of sync.

## Parser, not crawler — the boundary that matters

This is deliberately a **parser's-eye view, not a simulation of Google's
crawler.** It reports what the microdata/JSON-LD extraction algorithms pull out
of the HTML as-shipped. It does **not**:

- render JavaScript (it sees the pre-JS HTML — which is exactly what a crawler
  indexing before hydration sees, and why this skill injects at build time);
- filter properties by Google's rich-result requirements;
- map types to Google's entity model, dedupe, or apply visible-content
  penalties;
- judge **search eligibility**.

Present it to the user in those terms. For eligibility, defer to Google's Rich
Results Test — the same deferral Step 6 (validation) makes. The value here is
seeing the *values* and the *drift*, offline and pre-publish, not a verdict.

## What it shows

```text
▸ Microdata (1 item)
  Product
    name            "Widget Pro"
    image           "https://example.com/img/widget-pro.jpg"
    offers →
      Offer
        price           "49.99"

▸ JSON-LD (1 item)
  Product
    name            "Widget Pro"
    image           "/img/widget-pro.jpg"
    offers →
      Offer
        price           "49.99"

▸ Drift check: Microdata and JSON-LD agree ✓
```

The **drift check** is the headline capability — no free tool gives you a
side-by-side of the two formats extracted from the same page. It compares the
primary item of each format on a flattened property map (`offers.price`,
`offers.priceCurrency`, …) and reports properties present in only one format or
whose values differ.

## Flags

| Flag | Effect |
|---|---|
| `--target <path>` | HTML file to preview (required). |
| `--format both\|microdata\|json-ld` | Which formats to show (default `both`; drift check only runs in `both`). |
| `--base <url>` | Base URL for resolving relative URL properties (`img/src`, `a/href`). Defaults to a placeholder; pass the real site origin for accurate absolute URLs. |
| `--json` | Emit `{ microdata, jsonld, drift }` as JSON instead of the text view — for piping or snapshotting. |

## Implementation notes

- **Microdata extraction** uses [`microdata-node`](https://www.npmjs.com/package/microdata-node),
  which implements the WHATWG microdata-to-JSON algorithm (per-element value
  rules for `meta`/`content`, `a`/`href`, `img`/`src`, `time`/`datetime`,
  `data`/`value`, nested items, `itemid`, multi-token `itemprop`). Relative URL
  properties are resolved against `--base`.
- **JSON-LD extraction** reads each `<script type="application/ld+json">` block
  (handling a single node, an array, or an `@graph`) and normalizes it to the
  same item shape. A malformed block is skipped here — reporting invalid JSON is
  the validator's job (Step 6), not the preview's.
- Extraction lives in `scripts/structured-data-extract.js`, **separate from**
  `scripts/structured-data-core.js`. The core is vendored into consumer test
  suites for validation and must stay limited to `cheerio` + `jsonld`; the
  extraction preview's `microdata-node` dependency is skill-only.
- URL values are normalized (relative resolved against `--base`) on **both**
  sides before the drift comparison, so a relative path and its absolute form
  don't read as a false mismatch.

## Deferred optimization (#9): the double parse

The preview parses the HTML twice — once inside `microdata-node` (which takes
an HTML string and parses internally, so it can't share a DOM) and once via
`cheerio.load` to find the JSON-LD `<script>` blocks. A true single-parse would
mean forking `microdata-node`'s DOM walk; the only parse we control is the
JSON-LD one, and cheapening it (an `htmlparser2` streaming parser scoped to
`ld+json` scripts, adding `htmlparser2` as a direct dependency) is a modest win.

It's deliberately **not** done: the double-parse is confined to the interactive,
one-file preview, while the site-wide validator (`structured-data-core.js`)
already single-parses. **Trigger to revisit:** if `preview_extraction.js` grows
a batch mode over a directory of files, the streaming rewrite becomes worth it.
See the `DEFERRED OPTIMIZATION (#9)` comment in `scripts/structured-data-extract.js`.
