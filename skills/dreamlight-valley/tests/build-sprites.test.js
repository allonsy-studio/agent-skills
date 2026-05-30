import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	LAYOUT,
	planSheets,
	computeCoords,
	buildCoordsDoc,
	pathExists,
	escapeXml,
	estimateWidth,
	wrapLabel,
} from "../scripts/sprite-coords.js";

/* ----------------------------------------------------------------
 * LAYOUT
 * ---------------------------------------------------------------- */

test("LAYOUT: derived cell dimensions match base constants", () => {
	assert.equal(LAYOUT.cell_w, LAYOUT.img_size + 2 * LAYOUT.pad_x);
	assert.equal(
		LAYOUT.cell_h,
		LAYOUT.img_size + 2 * LAYOUT.pad_y + LAYOUT.label_h,
	);
});

/* ----------------------------------------------------------------
 * planSheets
 * ---------------------------------------------------------------- */

test("planSheets: builds one sheet per non-ingredient category", () => {
	const categories = {
		collectables: [{ name: "Amber" }, { name: "Antique Iron" }],
		gems: [{ name: "Ruby" }],
	};
	const sheets = planSheets(categories, []);
	const ids = sheets.map((s) => s.id).sort();
	assert.deepEqual(ids, ["collectables", "gems"]);
	const coll = sheets.find((s) => s.id === "collectables");
	assert.equal(coll.file, "collectables.png");
	assert.equal(coll.title, "Collectables");
	assert.deepEqual(coll.items, ["Amber", "Antique Iron"]);
});

test("planSheets: splits ingredients sheet by category field", () => {
	const categories = {
		ingredients: [
			{ name: "garlic", category: "vegetable" },
			{ name: "onion", category: "vegetable" },
			{ name: "lemon", category: "fruit" },
		],
	};
	const sheets = planSheets(categories, []);
	const ids = sheets.map((s) => s.id).sort();
	assert.deepEqual(ids, ["ingredients-fruit", "ingredients-vegetable"]);
	const veg = sheets.find((s) => s.id === "ingredients-vegetable");
	assert.equal(veg.title, "Ingredients — Vegetable");
	assert.equal(veg.file, "ingredients-vegetable.png");
	assert.deepEqual(veg.items.sort(), ["garlic", "onion"]);
});

test("planSheets: appends a recipes sheet when recipes are provided", () => {
	const sheets = planSheets({}, [{ name: "Pickled Herring" }]);
	const recipes = sheets.find((s) => s.id === "recipes");
	assert.ok(recipes, "recipes sheet should exist");
	assert.equal(recipes.file, "recipes.png");
	assert.equal(recipes.title, "Recipes");
	assert.deepEqual(recipes.items, ["Pickled Herring"]);
});

test("planSheets: omits recipes sheet when recipes array is empty or missing", () => {
	assert.equal(planSheets({}, []).find((s) => s.id === "recipes"), undefined);
	assert.equal(
		planSheets({}, undefined).find((s) => s.id === "recipes"),
		undefined,
	);
});

test("planSheets: filters out 'ingredients' from non-ingredient category list", () => {
	// 'ingredients' is special-cased — never gets a top-level sheet by that name.
	const sheets = planSheets({ ingredients: [] }, []);
	const ingredientsSheet = sheets.find((s) => s.id === "ingredients");
	assert.equal(ingredientsSheet, undefined);
});

test("planSheets: handles missing categories.ingredients gracefully", () => {
	// Don't throw when categories has no `ingredients` key at all.
	assert.doesNotThrow(() => planSheets({ gems: [{ name: "Ruby" }] }, []));
});

/* ----------------------------------------------------------------
 * computeCoords
 * ---------------------------------------------------------------- */

test("computeCoords: empty input returns empty map", () => {
	const { sorted, map } = computeCoords([]);
	assert.deepEqual(sorted, []);
	assert.deepEqual(map, {});
});

test("computeCoords: sorts case-insensitively", () => {
	const { sorted } = computeCoords(["banana", "Apple", "cherry"]);
	assert.deepEqual(sorted, ["Apple", "banana", "cherry"]);
});

test("computeCoords: row/col indexing wraps at cols boundary", () => {
	const items = Array.from({ length: LAYOUT.cols + 2 }, (_, i) =>
		// Pad so alphabetical sort matches numeric insertion order
		String(i).padStart(3, "0"),
	);
	const { map } = computeCoords(items);
	assert.equal(map["000"].row, 0);
	assert.equal(map["000"].col, 0);
	const lastInRow0 = String(LAYOUT.cols - 1).padStart(3, "0");
	assert.equal(map[lastInRow0].row, 0);
	assert.equal(map[lastInRow0].col, LAYOUT.cols - 1);
	const firstInRow1 = String(LAYOUT.cols).padStart(3, "0");
	assert.equal(map[firstInRow1].row, 1);
	assert.equal(map[firstInRow1].col, 0);
});

test("computeCoords: pixel boxes derive from layout constants", () => {
	const { map } = computeCoords(["Amber"]);
	const c = map.Amber;
	assert.equal(c.x, 0 * LAYOUT.cell_w + LAYOUT.pad_x);
	assert.equal(c.y, LAYOUT.title_h + 0 * LAYOUT.cell_h + LAYOUT.pad_y);
	assert.equal(c.w, LAYOUT.img_size);
	assert.equal(c.h, LAYOUT.img_size);
});

/* ----------------------------------------------------------------
 * buildCoordsDoc
 * ---------------------------------------------------------------- */

test("buildCoordsDoc: produces well-formed top-level doc", () => {
	const sheets = [
		{ id: "gems", file: "gems.png", title: "Gems", items: ["Ruby"] },
	];
	const doc = buildCoordsDoc(sheets);
	assert.equal(doc.version, 1);
	assert.ok(doc.note);
	assert.deepEqual(doc.layout, LAYOUT);
	assert.ok(doc.sheets.gems);
});

test("buildCoordsDoc: per-sheet item_count and rows derive from items", () => {
	const items = Array.from({ length: LAYOUT.cols * 2 + 3 }, (_, i) =>
		String(i).padStart(3, "0"),
	);
	const sheets = [{ id: "x", file: "x.png", title: "X", items }];
	const doc = buildCoordsDoc(sheets);
	const s = doc.sheets.x;
	assert.equal(s.item_count, items.length);
	assert.equal(s.rows, Math.ceil(items.length / LAYOUT.cols));
	assert.equal(s.file, "x.png");
	assert.equal(s.title, "X");
});

/* ----------------------------------------------------------------
 * pathExists
 * ---------------------------------------------------------------- */

test("pathExists: true for an existing path, false for a missing one", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "build-sprites-"));
	try {
		assert.equal(await pathExists(dir), true);
		assert.equal(await pathExists(path.join(dir, "no-such")), false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

/* ----------------------------------------------------------------
 * escapeXml
 * ---------------------------------------------------------------- */

test("escapeXml: escapes all five XML special characters", () => {
	assert.equal(escapeXml("&"), "&amp;");
	assert.equal(escapeXml("<"), "&lt;");
	assert.equal(escapeXml(">"), "&gt;");
	assert.equal(escapeXml('"'), "&quot;");
	assert.equal(escapeXml("'"), "&apos;");
});

test("escapeXml: passes plain text through unchanged", () => {
	assert.equal(escapeXml("Amber Pie"), "Amber Pie");
	assert.equal(escapeXml(""), "");
});

test("escapeXml: escapes ampersand before the other entities (no double-escape)", () => {
	// "& <" -> "&amp; &lt;", not "&amp;amp; &amp;lt;"
	assert.equal(escapeXml("& <"), "&amp; &lt;");
});

/* ----------------------------------------------------------------
 * estimateWidth
 * ---------------------------------------------------------------- */

test("estimateWidth: empty string returns 0", () => {
	assert.equal(estimateWidth(""), 0);
});

test("estimateWidth: uppercase letters are wider than lowercase", () => {
	assert.ok(estimateWidth("AAAA") > estimateWidth("aaaa"));
});

test("estimateWidth: digits wider than lowercase, narrower than uppercase", () => {
	assert.ok(estimateWidth("1111") > estimateWidth("aaaa"));
	assert.ok(estimateWidth("1111") < estimateWidth("AAAA"));
});

test("estimateWidth: returns an integer (Math.ceil)", () => {
	const w = estimateWidth("abcde");
	assert.equal(Number.isInteger(w), true);
});

test("estimateWidth: punctuation/space contribute the narrowest width", () => {
	// "    " (four spaces): each is 4 → total 16
	assert.equal(estimateWidth("    "), 16);
});

/* ----------------------------------------------------------------
 * wrapLabel
 * ---------------------------------------------------------------- */

test("wrapLabel: short label returns a single line", () => {
	const lines = wrapLabel("Amber", 1000);
	assert.deepEqual(lines, ["Amber"]);
});

test("wrapLabel: long label wraps to two lines on a space boundary", () => {
	const lines = wrapLabel("Arendellian Pickled Herring", 100);
	assert.equal(lines.length, 2);
	// Lines join back to original (no characters lost)
	assert.equal(lines.join(" "), "Arendellian Pickled Herring");
});

test("wrapLabel: truncates at two lines for very long names", () => {
	const lines = wrapLabel("one two three four five six seven eight", 20);
	assert.ok(lines.length <= 2, `expected ≤2 lines, got ${lines.length}`);
});

test("wrapLabel: handles single-word names that exceed maxWidth", () => {
	// Single word that doesn't fit still produces at least one line (the word itself).
	const lines = wrapLabel("Supercalifragilistic", 10);
	assert.equal(lines.length, 1);
	assert.equal(lines[0], "Supercalifragilistic");
});
