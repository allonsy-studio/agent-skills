import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig, injectMicrodata } from "../scripts/inject_microdata.js";
import { buildJsonLd, insertJsonLd } from "../scripts/generate_json_ld.js";
import { validate } from "../scripts/validate_structured_data.js";

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_HTML = fs.readFileSync(join(here, "fixtures", "product.html"), "utf8");
const TEMPLATE_CONFIG = join(here, "..", "assets", "selector-map-template.json");

test("reports no structured data on a plain page", async () => {
	const res = await validate("<html><body><p>nothing here</p></body></html>");
	assert.equal(res.hasMicrodata, false);
	assert.equal(res.hasJsonLd, false);
});

test("microdata produced by the injector validates clean", async () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const injected = injectMicrodata(PRODUCT_HTML, byName);
	const res = await validate(injected);

	assert.equal(res.hasMicrodata, true);
	assert.deepEqual(res.errors, [], `unexpected errors: ${res.errors.join("; ")}`);
});

test("JSON-LD produced by the generator validates clean", async () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const obj = buildJsonLd(PRODUCT_HTML, byName);
	const withJsonLd = insertJsonLd(PRODUCT_HTML, obj);
	const res = await validate(withJsonLd);

	assert.equal(res.hasJsonLd, true);
	assert.deepEqual(res.errors, [], `unexpected errors: ${res.errors.join("; ")}`);
});

test("flags an itemprop with no itemscope ancestor as an orphan", async () => {
	// A page needs at least one itemscope for the microdata check to run;
	// the price span below sits outside it, so it's a genuine orphan.
	const html = `
		<div itemscope itemtype="https://schema.org/Person"><span itemprop="name">Ada</span></div>
		<span itemprop="price">orphaned</span>`;
	const res = await validate(html);
	assert.equal(res.errors.length, 1);
	assert.match(res.errors[0], /orphan itemprop="price"/);
});

test("an itemref target rescues an otherwise-orphaned itemprop", async () => {
	const html = `
		<div itemscope itemtype="https://schema.org/Person" itemref="extra"></div>
		<span id="extra" itemprop="name">Ada</span>`;
	const res = await validate(html);
	assert.deepEqual(res.errors, []);
});

test("a relative itemtype URL is an error", async () => {
	const html = `<div itemscope itemtype="Product"><span itemprop="name">x</span></div>`;
	const res = await validate(html);
	assert.ok(res.errors.some((e) => /not an absolute URL/.test(e)));
});

test("invalid JSON in an ld+json block is an error", async () => {
	const html = `<script type="application/ld+json">{ not valid }</script>`;
	const res = await validate(html);
	assert.ok(res.errors.some((e) => /invalid JSON/.test(e)));
});

test("structurally malformed JSON-LD is caught by the jsonld processor", async () => {
	// Valid JSON, but invalid JSON-LD: @id must be a string. Our own checks
	// would never notice this -- the reference processor's expansion does.
	const html = `<script type="application/ld+json">
		{ "@context": "https://schema.org", "@type": "Product", "@id": 123 }
	</script>`;
	const res = await validate(html);
	assert.ok(
		res.errors.some((e) => /malformed JSON-LD/.test(e) && /@id/.test(e)),
		`expected a malformed-JSON-LD error, got: ${res.errors.join("; ")}`
	);
});

test("a non-schema.org remote @context degrades to a warning, not a false error", async () => {
	// The context can't be resolved offline; that's a limitation of local
	// validation, not a defect in the markup, so it must not fail the check.
	const html = `<script type="application/ld+json">
		{ "@context": "https://example.com/my-context.jsonld", "@type": "Thing", "name": "X" }
	</script>`;
	const res = await validate(html);
	assert.deepEqual(res.errors, [], `unexpected errors: ${res.errors.join("; ")}`);
	assert.ok(res.warnings.some((w) => /can't be resolved offline/.test(w)));
});

test("a known @type missing a required property is an error", async () => {
	const html = `<script type="application/ld+json">
		{ "@context": "https://schema.org", "@type": "Product", "name": "X" }
	</script>`;
	const res = await validate(html);
	assert.ok(res.errors.some((e) => /missing required propert/.test(e) && /image/.test(e)));
});

test("validates multiple JSON-LD blocks independently (parallel expansion, ordered output)", async () => {
	const html = `
		<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"A","image":"x","offers":{}}</script>
		<script type="application/ld+json">{ not json }</script>`;
	const res = await validate(html);
	// The first (valid) block passes; the second (malformed) is reported.
	assert.ok(res.errors.some((e) => /invalid JSON/.test(e)));
	assert.ok(!res.errors.some((e) => /missing required/.test(e)));
});

test("an unknown @type is a warning, not an error", async () => {
	const html = `<script type="application/ld+json">
		{ "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "X" }
	</script>`;
	const res = await validate(html);
	assert.deepEqual(res.errors, []);
	assert.ok(res.warnings.some((w) => /known-requirements table/.test(w)));
});
