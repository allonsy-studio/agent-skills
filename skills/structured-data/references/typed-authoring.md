# Type-checked JSON-LD authoring with `schema-dts`

When JSON-LD is authored **by hand** (a one-off page, or a design-system
component that emits a `<script type="application/ld+json">` block), the most
reliable way to catch a wrong property name or a wrong value shape is to let
the compiler check it against the schema.org vocabulary — before it ever
reaches a crawler or the validator.

[`schema-dts`](https://github.com/google/schema-dts) is the tool for that. It
is **published by Google** (`google-wombot` on npm, `github.com/google/schema-dts`,
Apache-2.0) and its type definitions are **regenerated from schema.org's own
canonical `.nt` vocabulary release** via its sibling `schema-dts-gen`. So the
property names and value types it enforces track the real vocabulary rather
than a hand-copied snapshot. It ships in this skill as a `devDependency`.

## What it is — and isn't

- It is **type-only**: as of v1.0 the package emits no runtime `.js`, only
  `.d.ts`. It costs nothing in your shipped bundle and adds no runtime
  dependency. The flip side: **you cannot query it at runtime** to ask "does
  property X exist on type Y" — it only helps at author/compile time. That is
  why this skill's runtime validator (`validate_structured_data.js`) does
  *not* depend on it, and instead uses the `jsonld` processor for structural
  checks plus a small hand-maintained table for Google's rich-results
  requirements.
- It describes the **schema.org vocabulary**, not **Google's rich-results
  requirements** (which properties Google needs for a given rich result). Those
  are a separate, shifting dataset owned by Google Search — see the provenance
  note in `validate_structured_data.js`. `schema-dts` will happily type-check a
  vocabulary-valid object that Google would still reject for a rich result, so
  it complements the validator rather than replacing it.

## Usage

Install (already present here as a devDependency):

```bash
npm install --save-dev schema-dts
```

Author the block as a typed object. TypeScript rejects unknown properties and
wrong value shapes at compile time:

```ts
import type { Product, WithContext } from "schema-dts";

const product: WithContext<Product> = {
	"@context": "https://schema.org",
	"@type": "Product",
	name: "Widget Pro",
	image: "https://example.com/img/widget-pro.jpg",
	offers: {
		"@type": "Offer",
		price: "49.99", // string, per schema.org — a number here is a type error
		priceCurrency: "USD",
		availability: "https://schema.org/InStock",
	},
	// headliner: "typo" // <- compile error: not a property of Product
};

const block = `<script type="application/ld+json">${JSON.stringify(product)}</script>`;
```

For React components, Google's companion package
[`react-schemaorg`](https://github.com/google/react-schemaorg) wraps the same
types in a `<JsonLd>` element.

## Where each tool fits

| Concern | Tool | When |
|---|---|---|
| "Is this a real schema.org property / right value type?" | `schema-dts` (compile time) | Hand-authoring JSON-LD in a TS project |
| "Is this structurally valid JSON-LD?" (bad `@id`, keyword misuse, broken `@context`) | `jsonld` (runtime, in the validator) | Every validation run |
| "Does Google require this property for a rich result?" | `REQUIRED_PROPERTIES` table + Rich Results Test | Every validation run; final say is Google's live test |

When the JSON-LD is instead **generated** from rendered HTML by
`scripts/generate_json_ld.js`, type-checking the hand-written object doesn't
apply — the generator's output is validated at runtime by
`validate_structured_data.js` instead.
