import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coords = JSON.parse(
	readFileSync(
		path.join(__dirname, "..", "references", "sprite-coords.json"),
		"utf8",
	),
);
const gatherables = JSON.parse(
	readFileSync(
		path.join(__dirname, "..", "references", "gatherables.json"),
		"utf8",
	),
);
const recipes = JSON.parse(
	readFileSync(
		path.join(__dirname, "..", "references", "recipes.json"),
		"utf8",
	),
);

test("sprite-coords.json: layout constants present", () => {
	const L = coords.layout;
	for (const f of [
		"img_size",
		"pad_x",
		"pad_y",
		"label_h",
		"cols",
		"title_h",
		"cell_w",
		"cell_h",
	]) {
		assert.equal(typeof L[f], "number", `layout.${f} missing or non-numeric`);
	}
	assert.equal(L.cell_w, L.img_size + 2 * L.pad_x, "cell_w derived from layout is wrong");
	assert.equal(
		L.cell_h,
		L.img_size + 2 * L.pad_y + L.label_h,
		"cell_h derived from layout is wrong",
	);
});

test("sprite-coords.json: every recipe has a coord entry", () => {
	assert.ok(coords.sheets.recipes, "recipes sheet missing from sprite-coords");
	const indexed = new Set(Object.keys(coords.sheets.recipes.items));
	for (const r of recipes.recipes) {
		assert.ok(indexed.has(r.name), `recipes coords missing for "${r.name}"`);
	}
	assert.equal(
		coords.sheets.recipes.item_count,
		recipes.recipes.length,
		`recipes sheet item_count ${coords.sheets.recipes.item_count} ≠ recipes.json length ${recipes.recipes.length}`,
	);
});

test("sprite-coords.json: every gatherables item has a coord entry", () => {
	const flatNames = new Map(); // sheetId -> Set of names expected

	for (const cat of ["collectables", "flowers", "gems"]) {
		flatNames.set(cat, new Set(gatherables.categories[cat].map((i) => i.name)));
	}
	for (const item of gatherables.categories.ingredients) {
		const sheet = `ingredients-${item.category}`;
		if (!flatNames.has(sheet)) flatNames.set(sheet, new Set());
		flatNames.get(sheet).add(item.name);
	}

	for (const [sheetId, expected] of flatNames) {
		assert.ok(coords.sheets[sheetId], `coords missing sheet: ${sheetId}`);
		const got = new Set(Object.keys(coords.sheets[sheetId].items));
		for (const name of expected) {
			assert.ok(got.has(name), `${sheetId}: missing coord for "${name}"`);
		}
		for (const name of got) {
			assert.ok(
				expected.has(name),
				`${sheetId}: coord present for unknown item "${name}"`,
			);
		}
	}
});

test("sprite-coords.json: coords are alphabetical within each sheet", () => {
	for (const [sheetId, sheet] of Object.entries(coords.sheets)) {
		const sorted = Object.keys(sheet.items).sort((a, b) =>
			a.toLowerCase().localeCompare(b.toLowerCase()),
		);
		const expectedPosOf = new Map();
		sorted.forEach((name, idx) => {
			expectedPosOf.set(name, {
				row: Math.floor(idx / coords.layout.cols),
				col: idx % coords.layout.cols,
			});
		});
		for (const [name, c] of Object.entries(sheet.items)) {
			const exp = expectedPosOf.get(name);
			assert.equal(c.row, exp.row, `${sheetId}/${name}: row ${c.row} ≠ ${exp.row}`);
			assert.equal(c.col, exp.col, `${sheetId}/${name}: col ${c.col} ≠ ${exp.col}`);
		}
	}
});

test("sprite-coords.json: pixel boxes match the layout constants", () => {
	const L = coords.layout;
	for (const sheet of Object.values(coords.sheets)) {
		for (const [name, c] of Object.entries(sheet.items)) {
			const expectedX = c.col * L.cell_w + L.pad_x;
			const expectedY = L.title_h + c.row * L.cell_h + L.pad_y;
			assert.equal(c.x, expectedX, `${sheet.file}/${name}: x mismatch`);
			assert.equal(c.y, expectedY, `${sheet.file}/${name}: y mismatch`);
			assert.equal(c.w, L.img_size, `${sheet.file}/${name}: w mismatch`);
			assert.equal(c.h, L.img_size, `${sheet.file}/${name}: h mismatch`);
		}
	}
});

test("sprite-coords.json: rows and item_count are consistent", () => {
	for (const sheet of Object.values(coords.sheets)) {
		const count = Object.keys(sheet.items).length;
		assert.equal(
			sheet.item_count,
			count,
			`${sheet.file}: item_count ${sheet.item_count} ≠ actual ${count}`,
		);
		const expectedRows = Math.ceil(count / coords.layout.cols);
		assert.equal(
			sheet.rows,
			expectedRows,
			`${sheet.file}: rows ${sheet.rows} ≠ expected ${expectedRows}`,
		);
	}
});
