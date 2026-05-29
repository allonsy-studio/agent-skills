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
	sourceFolderForSheet,
	buildMontageArgs,
	buildTitleArgs,
	detectImageMagick,
} from "../scripts/build-sprites.js";

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
	const ids = sheets.map((s) => s.id);
	assert.deepEqual(ids.sort(), ["collectables", "gems"]);
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

test("planSheets: omits recipes sheet when recipes array is empty or undefined", () => {
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
		// Item names ordered so alphabetical sort matches insertion order
		String(i).padStart(3, "0"),
	);
	const { map } = computeCoords(items);
	assert.equal(map["000"].row, 0);
	assert.equal(map["000"].col, 0);
	assert.equal(map[String(LAYOUT.cols - 1).padStart(3, "0")].col, LAYOUT.cols - 1);
	assert.equal(map[String(LAYOUT.cols - 1).padStart(3, "0")].row, 0);
	assert.equal(map[String(LAYOUT.cols).padStart(3, "0")].row, 1);
	assert.equal(map[String(LAYOUT.cols).padStart(3, "0")].col, 0);
});

test("computeCoords: pixel boxes are derived from layout constants", () => {
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

test("buildCoordsDoc: per-sheet item_count and rows derived from items", () => {
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
 * sourceFolderForSheet
 * ---------------------------------------------------------------- */

test("sourceFolderForSheet: maps non-ingredient sheet to <root>/<id>", () => {
	assert.equal(
		sourceFolderForSheet({ id: "gems" }, "/imgs"),
		path.join("/imgs", "gems"),
	);
});

test("sourceFolderForSheet: maps ingredients-<cat> to <root>/ingredients/<cat>", () => {
	assert.equal(
		sourceFolderForSheet({ id: "ingredients-fruit" }, "/imgs"),
		path.join("/imgs", "ingredients", "fruit"),
	);
});

/* ----------------------------------------------------------------
 * buildMontageArgs
 * ---------------------------------------------------------------- */

test("buildMontageArgs: returns null for empty icon list", () => {
	assert.equal(buildMontageArgs([], "/out.png"), null);
});

test("buildMontageArgs: emits one -label/path pair per icon, in order", () => {
	const icons = [
		{ path: "/a.png", label: "Amber" },
		{ path: "/b.png", label: "Beady" },
	];
	const args = buildMontageArgs(icons, "/out.png");
	assert.ok(args);

	// Find each icon's label pair and assert the path immediately follows
	const aIdx = args.findIndex((v, i) => v === "-label" && args[i + 1] === "Amber");
	assert.notEqual(aIdx, -1, "Amber label not found");
	assert.equal(args[aIdx + 2], "/a.png");
	const bIdx = args.findIndex((v, i) => v === "-label" && args[i + 1] === "Beady");
	assert.notEqual(bIdx, -1, "Beady label not found");
	assert.equal(args[bIdx + 2], "/b.png");
	// Amber comes before Beady in the argv
	assert.ok(aIdx < bIdx, "icons should appear in given order");
});

test("buildMontageArgs: includes tile geometry and ends with the output path", () => {
	const args = buildMontageArgs([{ path: "/a.png", label: "A" }], "/out.png");
	assert.ok(args.includes("-tile"));
	const tileIdx = args.indexOf("-tile");
	assert.equal(args[tileIdx + 1], `${LAYOUT.cols}x`);
	assert.equal(args[args.length - 1], "/out.png");
});

/* ----------------------------------------------------------------
 * buildTitleArgs
 * ---------------------------------------------------------------- */

test("buildTitleArgs: formats title as '<title> — <count> items'", () => {
	const args = buildTitleArgs(
		"/tile.png",
		{ title: "Gems", count: 7 },
		"/out.png",
	);
	const annotateIdx = args.indexOf("-annotate");
	assert.notEqual(annotateIdx, -1);
	// title text follows the -annotate offset
	assert.equal(args[annotateIdx + 2], "Gems — 7 items");
});

test("buildTitleArgs: input is first, output is last", () => {
	const args = buildTitleArgs(
		"/tile.png",
		{ title: "X", count: 1 },
		"/out.png",
	);
	assert.equal(args[0], "/tile.png");
	assert.equal(args[args.length - 1], "/out.png");
});

test("buildTitleArgs: splices a title_h-tall strip onto the top", () => {
	const args = buildTitleArgs("/in.png", { title: "T", count: 1 }, "/out.png");
	const spliceIdx = args.indexOf("-splice");
	assert.equal(args[spliceIdx + 1], `0x${LAYOUT.title_h}`);
});

/* ----------------------------------------------------------------
 * detectImageMagick
 * ---------------------------------------------------------------- */

test("detectImageMagick: returns null or a valid binary map", async () => {
	// On hosts without ImageMagick this returns null. On hosts with v6 or v7,
	// it returns a {montage, convert} pair. We don't fail the suite either way.
	const im = await detectImageMagick();
	if (im === null) return;
	assert.ok(Array.isArray(im.montage) && im.montage.length >= 1);
	assert.ok(Array.isArray(im.convert) && im.convert.length >= 1);
});
