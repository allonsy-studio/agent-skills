import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig, injectMicrodata } from "../scripts/inject_microdata.js";
import { buildJsonLd, insertJsonLd } from "../scripts/generate_json_ld.js";
import {
	extractMicrodata,
	extractJsonLd,
	extractAll,
	compareExtractions,
} from "../scripts/structured-data-extract.js";

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_HTML = fs.readFileSync(join(here, "fixtures", "product.html"), "utf8");
const TEMPLATE_CONFIG = join(here, "..", "assets", "selector-map-template.json");
const T = "https://schema.org/Thing";
const mdItem = (body) => extractMicrodata(`<div itemscope itemtype="${T}">${body}</div>`)[0];

test("extracts a meta element's content attribute", () => {
	assert.deepEqual(mdItem(`<meta itemprop="x" content="MV">`).properties.x, ["MV"]);
});

test("resolves an <a href> against the base URL", () => {
	assert.deepEqual(mdItem(`<a itemprop="url" href="/p">L</a>`).properties.url, [
		"https://example.com/p",
	]);
});

test("uses a <time> element's datetime attribute", () => {
	assert.deepEqual(mdItem(`<time itemprop="d" datetime="2026-01-01">Jan</time>`).properties.d, [
		"2026-01-01",
	]);
});

test("uses a <data> element's value attribute, not its text", () => {
	assert.deepEqual(mdItem(`<data itemprop="v" value="42">forty-two</data>`).properties.v, ["42"]);
});

test("captures itemid as the item's id", () => {
	assert.equal(mdItem(`<span itemprop="n" itemid="ignored">N</span>`).properties.n[0], "N");
	assert.equal(extractMicrodata(`<div itemscope itemtype="${T}" itemid="urn:x"></div>`)[0].id, "urn:x");
});

test("assigns a multi-token itemprop to every named property", () => {
	const item = mdItem(`<span itemprop="a b">V</span>`);
	assert.deepEqual(item.properties.a, ["V"]);
	assert.deepEqual(item.properties.b, ["V"]);
});

test("recurses into a nested item", () => {
	const item = mdItem(
		`<div itemprop="child" itemscope itemtype="https://schema.org/Offer"><span itemprop="price">9</span></div>`
	);
	assert.equal(item.properties.child[0].type, "Offer");
	assert.deepEqual(item.properties.child[0].properties.price, ["9"]);
});

test("extractJsonLd handles a single node, an array, and an @graph", () => {
	const single = extractJsonLd(
		`<script type="application/ld+json">{"@type":"Product","name":"A"}</script>`
	);
	assert.equal(single[0].type, "Product");
	assert.deepEqual(single[0].properties.name, ["A"]);

	const graph = extractJsonLd(
		`<script type="application/ld+json">{"@graph":[{"@type":"Person","name":"X"},{"@type":"Organization","name":"Y"}]}</script>`
	);
	assert.deepEqual(
		graph.map((i) => i.type),
		["Person", "Organization"]
	);
});

test("extractJsonLd skips a malformed block instead of throwing", () => {
	assert.deepEqual(extractJsonLd(`<script type="application/ld+json">{ nope }</script>`), []);
});

test("dogfood: injector + generator on the same source show NO drift", () => {
	// Build one page carrying BOTH formats from the same fixture, then confirm
	// the two extractions agree. Also exercises URL normalization (microdata
	// resolves image to absolute; JSON-LD keeps it relative).
	const byName = loadConfig(TEMPLATE_CONFIG);
	const withMicro = injectMicrodata(PRODUCT_HTML, byName);
	const both = insertJsonLd(withMicro, buildJsonLd(PRODUCT_HTML, byName));

	const extracted = extractAll(both);
	assert.equal(extracted.microdata.length, 1);
	assert.equal(extracted.jsonld.length, 1);

	const cmp = compareExtractions(extracted);
	assert.equal(cmp.comparable, true);
	assert.deepEqual(cmp.drift, [], `unexpected drift: ${JSON.stringify(cmp.drift)}`);
});

test("compareExtractions reports a value mismatch", () => {
	const extracted = {
		microdata: [{ type: "Product", properties: { name: ["A"], price: ["10"] } }],
		jsonld: [{ type: "Product", properties: { name: ["A"], price: ["12"] } }],
	};
	const { comparable, drift } = compareExtractions(extracted);
	assert.equal(comparable, true);
	assert.equal(drift.length, 1);
	assert.equal(drift[0].path, "price");
	assert.equal(drift[0].kind, "value-mismatch");
});

test("compareExtractions flags a property present in only one format", () => {
	const { drift } = compareExtractions({
		microdata: [{ type: "Product", properties: { name: ["A"], sku: ["123"] } }],
		jsonld: [{ type: "Product", properties: { name: ["A"] } }],
	});
	assert.deepEqual(drift, [{ path: "sku", kind: "missing-in-jsonld", microdata: ["123"] }]);
});

test("drift flags a differing item count (not just first-item props)", () => {
	const { drift } = compareExtractions({
		microdata: [
			{ type: "Product", properties: { name: ["A"] } },
			{ type: "Product", properties: { name: ["B"] } },
		],
		jsonld: [{ type: "Product", properties: { name: ["A"] } }],
	});
	assert.ok(
		drift.some((d) => d.kind === "count-mismatch"),
		`expected a count-mismatch, got: ${JSON.stringify(drift)}`
	);
});

test("drift flags a differing @type on the primary item", () => {
	const { drift } = compareExtractions({
		microdata: [{ type: "Product", properties: { name: ["A"] } }],
		jsonld: [{ type: "Offer", properties: { name: ["A"] } }],
	});
	assert.ok(drift.some((d) => d.kind === "type-mismatch" && d.path === "@type"));
});

test("compareExtractions is not comparable when only one format is present", () => {
	const cmp = compareExtractions({ microdata: [{ type: "X", properties: {} }], jsonld: [] });
	assert.equal(cmp.comparable, false);
	assert.deepEqual(cmp.drift, []);
});
