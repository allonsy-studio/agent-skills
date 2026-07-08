# Regression tests for structured data

Structured data passes validation the day you add it and then quietly breaks
later — a template tweak drops an `itemscope`, a price refactor moves the
number outside its `itemprop`, a component prop rename orphans a field. Nothing
in the page looks wrong; the rich result just stops appearing. The fix is to
validate structured data as part of the project's normal test run, so a broken
insertion fails CI instead of shipping.

This applies to the two targets where markup is **regenerated on every build**:

- **Static-site pipelines** (11ty, Astro, Hugo, Jekyll) — validate the built
  HTML output.
- **Design-system components** — validate each component's rendered output.

A single hand-edited page doesn't need this: nothing regenerates it, so there's
nothing to regress. `SKILL.md` Step 7 only prompts for the two cases above.

## What the scaffold generates

`scripts/scaffold_validation_test.js` prints three files (it never writes them —
review, then add under the project's test dir):

| File | Role |
|---|---|
| `structured-data-core.js` | The **exact** validator this skill uses (`scripts/structured-data-core.js`, copied verbatim). Single source of truth — no forked copy to drift. |
| `structured-data-assert.js` | A throwing wrapper: `assertStructuredDataValid(html, { allowWarnings, label })`. Throws on structural problems, no-ops when a page has no structured data. |
| `structured-data.<type>.test.js` | A runner-appropriate test that feeds HTML to the assert helper. |

The generated tests depend only on **`cheerio`** and **`jsonld`** as
devDependencies. They do **not** import anything from this skill, so they keep
working after the skill is uninstalled.

```bash
npm install --save-dev cheerio jsonld
```

## Runner support

The assert helper throws on failure, and a thrown error fails a test in every
common runner — so the test body is identical across them and only the `test`
import differs. Pass `--runner`:

| `--runner` | import emitted |
|---|---|
| `node` (default) | `import { test } from "node:test";` |
| `vitest` | `import { test } from "vitest";` |
| `jest` | `import { test } from "@jest/globals";` (needs jest's ESM mode) |

## 11ty / static-site pipelines

```bash
node scripts/scaffold_validation_test.js --type eleventy --runner node --out tests --site-dir _site
```

The generated test walks `--site-dir` (default `_site`) for `.html` files and
asserts each one is valid. It reads **built** output, so it must run **after**
the build — wire CI as build-then-test:

```jsonc
// package.json
{
	"scripts": {
		"build": "eleventy",
		"test": "eleventy && node --test tests/structured-data.eleventy.test.js"
	}
}
```

If the build directory isn't `_site`, pass the real one via `--site-dir`.

## Component libraries

```bash
node scripts/scaffold_validation_test.js --type component --runner vitest --out tests --render-module ../src/render.js
```

The generated test has one `CASES` entry per component (or variant) that
carries structured data. Each case renders the component to an **HTML string**
— the markup a crawler receives — and asserts it's valid. Until you populate
`CASES`, the generated test **fails on purpose** (a validation test that
validates nothing shouldn't report green) — filling in your components clears
it. Fill in `CASES` and point the `renderComponent` import at your render entry:

- **React**: `renderToStaticMarkup(<ProductCard price="49.99" />)`
- **Vue**: `renderToString(app)` from `@vue/server-renderer`
- **Web Components**: the **Declarative Shadow DOM** SSR output. Do not test a
  runtime `attachShadow()` root — it isn't reliably crawlable (see the Web
  Component caveat in `SKILL.md`), so validating it would give false confidence.

Client-only rendering can't be validated here — and wouldn't be crawlable
anyway, so surface the structured data in server-rendered/light-DOM markup
first (that's the Step 1–2 decision), then test that.

## What this does and doesn't catch

It catches the same class of problems as Step 6: orphaned `itemprop`s,
non-absolute `itemtype`s, malformed JSON-LD (via the `jsonld` reference
processor), and missing Google-required properties for known `@type`s. It does
**not** confirm search-result eligibility — that's Google's Rich Results Test,
which reflects requirements that shift independently of the schema.org
vocabulary. Keep the CI test as the fast regression guard and the Rich Results
Test as the periodic manual confirmation.
