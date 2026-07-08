import { test } from "node:test";
import assert from "node:assert/strict";

import { renderPreview, main } from "../scripts/preview_extraction.js";

const SAMPLE = {
	microdata: [{ type: "Product", properties: { name: ["Widget"], price: ["49.99"] } }],
	jsonld: [{ type: "Product", properties: { name: ["Widget"], price: ["59.99"] } }],
};

test("renders the parser-not-crawler framing and the Rich Results deferral", () => {
	const out = renderPreview(SAMPLE, { comparable: true, drift: [] }, "both");
	assert.match(out, /NOT a simulation of Google's crawler/);
	assert.match(out, /Rich Results Test/);
});

test("shows both sections and the extracted values in 'both' mode", () => {
	const out = renderPreview(SAMPLE, { comparable: true, drift: [] }, "both");
	assert.match(out, /▸ Microdata \(1 item\)/);
	assert.match(out, /▸ JSON-LD \(1 item\)/);
	assert.match(out, /name {2,}"Widget"/);
});

test("renders a drift warning when the extractions disagree", () => {
	const drift = [{ path: "price", kind: "value-mismatch", microdata: ["49.99"], jsonld: ["59.99"] }];
	const out = renderPreview(SAMPLE, { comparable: true, drift }, "both");
	assert.match(out, /⚠ Drift between Microdata and JSON-LD \(1\)/);
	assert.match(out, /price {2,}Microdata=49\.99 {2,}JSON-LD=59\.99/);
});

test("reports agreement when there is no drift", () => {
	const out = renderPreview(SAMPLE, { comparable: true, drift: [] }, "both");
	assert.match(out, /Microdata and JSON-LD agree/);
});

test("--format microdata omits the JSON-LD section and the drift check", () => {
	const out = renderPreview(SAMPLE, { comparable: true, drift: [] }, "microdata");
	assert.match(out, /▸ Microdata/);
	assert.doesNotMatch(out, /▸ JSON-LD/);
	assert.doesNotMatch(out, /Drift/);
});

test("--help prints usage and returns without error", () => {
	const origLog = console.log;
	let out = "";
	console.log = (m) => {
		out += m;
	};
	try {
		main(["--help"]);
	} finally {
		console.log = origLog;
	}
	assert.match(out, /Usage: node preview_extraction\.js/);
});

test("shows which base relative URLs were resolved against", () => {
	const out = renderPreview(SAMPLE, { comparable: true, drift: [] }, "both", "https://mysite.test/");
	assert.match(out, /resolved against https:\/\/mysite\.test\//);
});

test("truncates very long scalar values in the text view", () => {
	const long = "x".repeat(300);
	const data = { microdata: [{ type: "Article", properties: { articleBody: [long] } }], jsonld: [] };
	const out = renderPreview(data, { comparable: false, drift: [] }, "both");
	assert.match(out, /… \(300 chars\)/);
	assert.doesNotMatch(out, new RegExp("x".repeat(200)));
});

test("notes when a nested item is present", () => {
	const nested = {
		microdata: [
			{
				type: "Product",
				properties: { offers: [{ type: "Offer", properties: { price: ["10"] } }] },
			},
		],
		jsonld: [],
	};
	const out = renderPreview(nested, { comparable: false, drift: [] }, "both");
	assert.match(out, /offers →/);
	assert.match(out, /Offer/);
	assert.match(out, /Drift check: skipped/);
});
