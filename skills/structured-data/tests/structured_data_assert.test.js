import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig, injectMicrodata } from "../scripts/inject_microdata.js";
import { assertStructuredDataValid } from "../scripts/structured-data-assert.js";

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_HTML = fs.readFileSync(join(here, "fixtures", "product.html"), "utf8");
const TEMPLATE_CONFIG = join(here, "..", "assets", "selector-map-template.json");

test("resolves for valid injected microdata", async () => {
	const good = injectMicrodata(PRODUCT_HTML, loadConfig(TEMPLATE_CONFIG));
	const res = await assertStructuredDataValid(good, { label: "product" });
	assert.equal(res.hasMicrodata, true);
});

test("throws on an orphaned itemprop, with the label in the message", async () => {
	const html = `
		<div itemscope itemtype="https://schema.org/Person"><span itemprop="name">Ada</span></div>
		<span itemprop="price">orphan</span>`;
	await assert.rejects(assertStructuredDataValid(html, { label: "widget.html" }), (err) => {
		assert.match(err.message, /Invalid structured data \(widget\.html\)/);
		assert.match(err.message, /orphan itemprop="price"/);
		return true;
	});
});

test("is a no-op (never throws) when the page has no structured data", async () => {
	const res = await assertStructuredDataValid("<main><p>just prose</p></main>");
	assert.deepEqual(res, { hasMicrodata: false, hasJsonLd: false });
});

test("allowWarnings:false promotes a warning to a failure", async () => {
	// An itemscope with no itemtype is a warning, not an error.
	const html = `<div itemscope><span itemprop="name">x</span></div>`;
	await assert.doesNotReject(assertStructuredDataValid(html)); // default allowWarnings:true
	await assert.rejects(assertStructuredDataValid(html, { allowWarnings: false }), /no itemtype/);
});
