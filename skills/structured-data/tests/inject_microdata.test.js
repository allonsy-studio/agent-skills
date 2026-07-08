import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as cheerio from "cheerio";
import {
	parseArgs,
	indexItems,
	loadConfig,
	injectMicrodata,
	readTextFileOrExit,
	compilePattern,
} from "../scripts/inject_microdata.js";

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_HTML = fs.readFileSync(join(here, "fixtures", "product.html"), "utf8");
const TEMPLATE_CONFIG = join(here, "..", "assets", "selector-map-template.json");

test("parseArgs turns --flag value pairs into an object", () => {
	const args = parseArgs(["--config", "map.json", "--target", "page.html"]);
	assert.deepEqual(args, { config: "map.json", target: "page.html" });
});

test("compilePattern caches and reuses the same RegExp for a given pattern", () => {
	assert.equal(compilePattern("[0-9]+"), compilePattern("[0-9]+"));
});

test("readTextFileOrExit returns contents for a readable file", () => {
	assert.match(readTextFileOrExit(join(here, "fixtures", "product.html"), "target"), /product-card/);
});

test("readTextFileOrExit prints a clean error and exits on a missing file", () => {
	const origExit = process.exit;
	const origErr = console.error;
	let message = "";
	process.exit = (code) => {
		throw new Error(`__exit_${code}`);
	};
	console.error = (m) => {
		message = m;
	};
	try {
		assert.throws(() => readTextFileOrExit("/no/such/file.html", "target"), /__exit_1/);
	} finally {
		process.exit = origExit;
		console.error = origErr;
	}
	assert.match(message, /target not found: \/no\/such\/file\.html/);
});

test("loadConfig reads and indexes the shipped template by item name", () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	assert.equal(byName.root.itemtype, "https://schema.org/Product");
	assert.equal(byName.offer.itemtype, "https://schema.org/Offer");
});

test("injectMicrodata tags the root and its properties", () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const out = injectMicrodata(PRODUCT_HTML, byName);

	assert.match(out, /itemtype="https:\/\/schema\.org\/Product"/);
	assert.match(out, /itemtype="https:\/\/schema\.org\/Offer"/);
	assert.match(out, /<h1 class="product-title" itemprop="name"/);
	assert.match(out, /class="product-hero"[^>]*itemprop="image"/);
	assert.match(out, /class="product-description" itemprop="description"/);
});

test("a currency-formatted price becomes a hidden <meta>, not a tag on the visible node", () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const out = injectMicrodata(PRODUCT_HTML, byName);

	// The cleaned numeric value lives in a hidden meta sibling...
	assert.match(out, /<meta itemprop="price" content="49\.99">/);
	// ...and the visible "$49.99" span is left untouched (no itemprop on it).
	assert.doesNotMatch(out, /class="price" itemprop="price"/);
});

test("constant properties emit meta (value) and link (url) children", () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const out = injectMicrodata(PRODUCT_HTML, byName);

	assert.match(out, /<meta itemprop="priceCurrency" content="USD">/);
	assert.match(out, /<link itemprop="availability" href="https:\/\/schema\.org\/InStock">/);
});

test("a bare numeric value_pattern match tags the visible node directly", () => {
	const html = `<div class="p"><span class="v">49.99</span></div>`;
	const byName = indexItems({
		items: [
			{
				name: "root",
				itemtype: "https://schema.org/Product",
				selector: ".p",
				properties: [
					{
						itemprop: "price",
						selector: ".v",
						source: "text",
						value_pattern: "[0-9]+(\\.[0-9]+)?",
					},
				],
			},
		],
	});
	const out = injectMicrodata(html, byName);
	// Exact match => tag the visible node, no hidden meta sibling.
	assert.match(out, /class="v" itemprop="price"/);
	assert.doesNotMatch(out, /<meta itemprop="price"/);
});

test("a constant value with quotes and angle brackets is escaped, not injected", () => {
	const byName = indexItems({
		items: [
			{
				name: "root",
				itemtype: "https://schema.org/Thing",
				selector: ".t",
				properties: [{ itemprop: "note", constant: 'say "hi" <b> & more' }],
			},
		],
	});
	const out = injectMicrodata(`<div class="t"></div>`, byName);
	const $ = cheerio.load(out);
	const meta = $("meta[itemprop='note']");

	// The value round-trips exactly (no attribute breakout)...
	assert.equal(meta.attr("content"), 'say "hi" <b> & more');
	// ...and no spurious attribute was injected by an unescaped quote.
	assert.equal(meta.attr("onerror"), undefined);
	assert.equal(meta.attr("b"), undefined);
});

test("injectMicrodata throws when the root selector matches nothing", () => {
	const byName = indexItems({
		items: [{ name: "root", itemtype: "https://schema.org/Product", selector: ".nope", properties: [] }],
	});
	assert.throws(() => injectMicrodata("<div class='x'></div>", byName), /matched no elements/);
});
