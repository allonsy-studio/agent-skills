import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig } from "../scripts/inject_microdata.js";
import { buildJsonLd, insertJsonLd, escapeJsonLdForHtml } from "../scripts/generate_json_ld.js";

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_HTML = fs.readFileSync(join(here, "fixtures", "product.html"), "utf8");
const TEMPLATE_CONFIG = join(here, "..", "assets", "selector-map-template.json");

test("buildJsonLd extracts a typed object from the rendered HTML", () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const obj = buildJsonLd(PRODUCT_HTML, byName);

	assert.equal(obj["@context"], "https://schema.org");
	assert.equal(obj["@type"], "Product");
	assert.equal(obj.name, "Widget Pro");
	assert.equal(obj.image, "/img/widget-pro.jpg");
	assert.equal(obj.description, "A very professional widget.");
});

test("value_pattern strips the currency symbol from the emitted price", () => {
	const byName = loadConfig(TEMPLATE_CONFIG);
	const obj = buildJsonLd(PRODUCT_HTML, byName);

	assert.equal(obj.offers["@type"], "Offer");
	assert.equal(obj.offers.price, "49.99");
	assert.equal(obj.offers.priceCurrency, "USD");
	assert.equal(obj.offers.availability, "https://schema.org/InStock");
});

test("insertJsonLd places the script block before </head>", () => {
	const obj = { "@context": "https://schema.org", "@type": "Product", name: "X" };
	const out = insertJsonLd(PRODUCT_HTML, obj);

	assert.match(out, /<script type="application\/ld\+json">/);
	// The block is inserted before the closing head tag.
	assert.ok(out.indexOf('application/ld+json') < out.indexOf("</head>"));
});

test("insertJsonLd falls back to </body> when there is no head", () => {
	const html = "<body><p>hi</p></body>";
	const out = insertJsonLd(html, { "@type": "Thing" });
	assert.ok(out.indexOf("application/ld+json") < out.indexOf("</body>"));
});

test("insertJsonLd appends when there is neither head nor body", () => {
	const html = "<p>fragment</p>";
	const out = insertJsonLd(html, { "@type": "Thing" });
	assert.ok(out.startsWith("<p>fragment</p>"));
	assert.match(out, /application\/ld\+json/);
});

test("buildJsonLd throws when the root selector matches nothing", () => {
	const byName = { root: { itemtype: "https://schema.org/Product", selector: ".nope", properties: [] } };
	assert.throws(() => buildJsonLd("<div></div>", byName), /matched no elements/);
});

test("escapeJsonLdForHtml escapes the HTML-sensitive characters", () => {
	assert.equal(escapeJsonLdForHtml('{"a":"<b>&"}'), '{"a":"\\u003cb\\u003e\\u0026"}');
});

test("insertJsonLd escapes </script> so a value cannot break out of the block", () => {
	const payload = "</script><img src=x onerror=alert(1)>";
	const out = insertJsonLd("<head></head>", { "@context": "https://schema.org", "@type": "Product", name: payload });

	const m = out.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
	assert.ok(m, "expected a JSON-LD script block");
	const json = m[1];

	// No raw angle brackets survive in the emitted JSON payload...
	assert.doesNotMatch(json, /[<>]/);
	assert.match(json, /\\u003c/);
	// ...and it still round-trips to the original value via JSON.parse.
	assert.equal(JSON.parse(json).name, payload);
});
