import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "references", "gatherables.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));

const EXPECTED_CATEGORIES = ["collectables", "flowers", "gems", "ingredients"];

test("gatherables.json: top-level shape", () => {
	assert.equal(typeof data, "object");
	assert.ok(data.categories, "missing top-level `categories` key");
	assert.deepEqual(
		Object.keys(data.categories).sort(),
		EXPECTED_CATEGORIES,
		"top-level categories list mismatch",
	);
});

test("gatherables.json: every item has a name and locations array", () => {
	for (const [cat, items] of Object.entries(data.categories)) {
		assert.ok(Array.isArray(items), `${cat} is not an array`);
		for (const item of items) {
			assert.equal(typeof item.name, "string", `${cat}: missing name`);
			assert.ok(item.name.length > 0, `${cat}: empty name`);
			assert.ok(
				Array.isArray(item.locations),
				`${cat}/${item.name}: locations is not an array`,
			);
		}
	}
});

test("gatherables.json: no duplicate names within a category", () => {
	for (const [cat, items] of Object.entries(data.categories)) {
		const seen = new Set();
		for (const item of items) {
			assert.equal(
				seen.has(item.name),
				false,
				`${cat}: duplicate name "${item.name}"`,
			);
			seen.add(item.name);
		}
	}
});

test("gatherables.json: ingredients use the documented category set", () => {
	const VALID = new Set([
		"vegetable",
		"fruit",
		"grain",
		"spice",
		"sweet",
		"seafood",
		"dairy",
		"meat",
		"ice",
		"fish",
	]);
	for (const item of data.categories.ingredients) {
		assert.equal(
			typeof item.category,
			"string",
			`${item.name}: missing category`,
		);
		assert.ok(
			VALID.has(item.category),
			`${item.name}: unknown category "${item.category}"`,
		);
	}
});

test("gatherables.json: ingredients use the documented method set", () => {
	const VALID = new Set(["gardening", "foraging", "fishing", "purchase"]);
	for (const item of data.categories.ingredients) {
		if (!("method" in item)) continue;
		const methods = Array.isArray(item.method) ? item.method : [item.method];
		for (const m of methods) {
			assert.ok(VALID.has(m), `${item.name}: unknown method "${m}"`);
		}
	}
});

test("gatherables.json: flower availability uses the documented tiers when present", () => {
	const VALID = new Set(["abundant", "average", "rare", "ultra-rare"]);
	for (const item of data.categories.flowers) {
		if (!("availability" in item)) continue;
		assert.ok(
			VALID.has(item.availability),
			`${item.name}: unknown availability "${item.availability}"`,
		);
	}
});

test("gatherables.json: forageable method allows arrays and is non-empty", () => {
	for (const item of data.categories.collectables) {
		assert.ok("method" in item, `${item.name}: missing method`);
		if (Array.isArray(item.method)) {
			assert.ok(
				item.method.length > 0,
				`${item.name}: empty method array`,
			);
			for (const m of item.method) {
				assert.equal(typeof m, "string", `${item.name}: non-string method entry`);
			}
		} else {
			assert.equal(typeof item.method, "string", `${item.name}: method is not a string or array`);
		}
	}
});

test("gatherables.json: numeric fields are non-negative when present", () => {
	for (const items of Object.values(data.categories)) {
		for (const item of items) {
			for (const f of ["sale_price", "energy", "slot_max"]) {
				if (!(f in item)) continue;
				assert.equal(typeof item[f], "number", `${item.name}: ${f} is not a number`);
				assert.ok(item[f] >= 0, `${item.name}: negative ${f}`);
			}
		}
	}
});
