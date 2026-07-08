---
description: "Preview what a structured-data parser extracts from a page (Microdata + JSON-LD), with a drift check between the two formats."
argument-hint: "the page's HTML file path, plus optional flags --format, --base, --json"
---

# /preview-structured-data — show what a parser extracts

Enter the `structured-data` skill at **Step 5 (Preview extraction)**. Read
`references/extraction-preview.md` for the parser-vs-crawler boundary, then run
the preview against the target and report the result.

Parse `$ARGUMENTS`:

- The first non-flag token is the **target HTML file** (required). If none is
  given, ask the user which file (or which built page) to preview.
- Pass through any of these flags to the script:
  - `--format microdata|json-ld|both` (default `both`)
  - `--base <url>` — real site origin, so relative `img/src` / `a/href` resolve
  - `--json` — machine-readable output

Run:

```bash
node scripts/preview_extraction.js --target <file> [flags]
```

Then summarize for the user:

- the extracted Microdata and/or JSON-LD items (types and key values);
- **any drift** the report flags between the two formats — call this out
  prominently, since valid-but-mismatched data is the main risk;
- the standing caveat: this is a **parser's-eye view, not a crawler
  simulation**. It does not judge search eligibility — point them to Google's
  Rich Results Test for that.

If the page is client-rendered (no structured data in the static HTML), say so
plainly: a crawler indexing before JS runs would see nothing either, which is
the problem to fix — not a gap in the preview.
