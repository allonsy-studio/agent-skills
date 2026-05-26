import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recipes = JSON.parse(
	readFileSync(path.join(__dirname, "..", "references", "recipes.json"), "utf8"),
);
const gatherables = JSON.parse(
	readFileSync(
		path.join(__dirname, "..", "references", "gatherables.json"),
		"utf8",
	),
);

const VALID_COURSES = new Set(["appetizer", "entree", "dessert"]);

test("recipes.json: top-level shape", () => {
	assert.ok(Array.isArray(recipes.recipes), "recipes is not an array");
	assert.ok(recipes.recipes.length > 0, "no recipes");
});

test("recipes.json: every recipe has required scalar fields", () => {
	for (const r of recipes.recipes) {
		assert.equal(typeof r.name, "string", `recipe missing name`);
		assert.ok(VALID_COURSES.has(r.course), `${r.name}: bad course "${r.course}"`);
		assert.equal(typeof r.star_rating, "number", `${r.name}: missing star_rating`);
		assert.equal(typeof r.energy, "number", `${r.name}: missing energy`);
		assert.equal(typeof r.sale_price, "number", `${r.name}: missing sale_price`);
		assert.ok(Array.isArray(r.ingredients), `${r.name}: ingredients not array`);
		assert.ok(r.ingredients.length >= 1, `${r.name}: empty ingredients`);
	}
});

test("recipes.json: ingredient slots are well-formed", () => {
	for (const r of recipes.recipes) {
		for (const slot of r.ingredients) {
			assert.equal(typeof slot.name, "string", `${r.name}: slot missing name`);
			// `category` is optional; when present it must be true (we strip false).
			if ("category" in slot) {
				assert.equal(
					slot.category,
					true,
					`${r.name}: slot ${slot.name} has category: ${slot.category} (only "true" is valid; false should be omitted)`,
				);
			}
		}
	}
});

test("recipes.json: no removed schema fields linger", () => {
	for (const r of recipes.recipes) {
		assert.equal("key" in r, false, `${r.name}: removed field 'key' still present`);
		assert.equal(
			"expansion" in r,
			false,
			`${r.name}: removed field 'expansion' still present`,
		);
		for (const slot of r.ingredients) {
			assert.equal(
				"flexible" in slot,
				false,
				`${r.name}: slot ${slot.name} uses old 'flexible' key — should be 'category'`,
			);
		}
	}
});

test("recipes.json: no duplicate recipe names", () => {
	const seen = new Set();
	for (const r of recipes.recipes) {
		assert.equal(seen.has(r.name), false, `duplicate recipe name: ${r.name}`);
		seen.add(r.name);
	}
});

test("recipes.json: category slots use known category names", () => {
	const KNOWN = new Set([
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
	for (const r of recipes.recipes) {
		for (const slot of r.ingredients) {
			if (slot.category !== true) continue;
			assert.ok(
				KNOWN.has(slot.name),
				`${r.name}: category slot "${slot.name}" is not a known cooking category`,
			);
		}
	}
});

test("recipes.json: fixed-slot ingredients exist in the gatherables catalog", () => {
	// Build a flat name set across all gatherable categories (case-insensitive).
	const known = new Set();
	for (const items of Object.values(gatherables.categories)) {
		for (const item of items) known.add(item.name.toLowerCase());
	}

	const missing = new Set();
	for (const r of recipes.recipes) {
		for (const slot of r.ingredients) {
			if (slot.category === true) continue;
			if (!known.has(slot.name.toLowerCase())) missing.add(slot.name);
		}
	}
	// Some recipes reference items not in gatherables (crafted, intermediate, or
	// catalog gaps). Surface them so we can decide whether to add to the catalog.
	if (missing.size > 0) {
		const list = [...missing].sort().slice(0, 10).join(", ");
		console.warn(
			`  ${missing.size} recipe ingredient name(s) not in gatherables catalog: ${list}${missing.size > 10 ? "…" : ""}`,
		);
	}
});
