/**
 * Pure helpers for sprite-sheet planning + coords-doc generation.
 *
 * No IO beyond `pathExists` (a trivial fs.access wrapper). Importable
 * standalone from tests, the eleventy preview, or any tool that needs to
 * compute item positions without invoking the sharp-based build pipeline.
 *
 * The render pipeline (sharp + SVG composite + labeled sheet PNG) lives in
 * `build-sprites.js` and is intentionally kept separate.
 */

import { access } from "node:fs/promises";

// Layout — must match build_sprites.py for backwards compatibility.
export const LAYOUT = {
	img_size: 120,
	pad_x: 6,
	pad_y: 6,
	label_h: 32,
	cols: 8,
	title_h: 52,
};
LAYOUT.cell_w = LAYOUT.img_size + 2 * LAYOUT.pad_x;
LAYOUT.cell_h = LAYOUT.img_size + 2 * LAYOUT.pad_y + LAYOUT.label_h;

/**
 * Sheet definitions: which gatherables.json items belong on each sheet, and
 * what file they go to. Ingredient sheets are split by `category` field.
 *
 * @param {Record<string, Array<{name: string, category?: string}>>} categories
 * @param {Array<{name: string}>} recipes
 * @returns {Array<{id: string, file: string, title: string, items: string[]}>}
 */
export function planSheets(categories, recipes) {
	// Use the folder name for the ingredients sheet title.
	const sheets = Object.keys(categories)
		.filter((cat) => cat !== "ingredients")
		.map((cat) => ({
			id: cat,
			file: `${cat}.png`,
			title: cat.charAt(0).toUpperCase() + cat.slice(1),
			items: categories[cat].map((i) => i.name),
		}));

	// Get a list of all possible categories from the ingredients sheet.
	const byCategory = new Map();
	for (const item of categories.ingredients ?? []) {
		if (!byCategory.has(item.category)) byCategory.set(item.category, []);
		byCategory.get(item.category).push(item.name);
	}

	for (const [folder, names] of byCategory) {
		sheets.push({
			id: `ingredients-${folder}`,
			file: `ingredients-${folder}.png`,
			title: `Ingredients — ${folder[0].toUpperCase()}${folder.slice(1)}`,
			items: names,
		});
	}

	if (recipes?.length) {
		sheets.push({
			id: "recipes",
			file: "recipes.png",
			title: "Recipes",
			items: recipes.map((r) => r.name),
		});
	}

	return sheets;
}

/**
 * Compute grid (row, col) and pixel box for each item on a sheet.
 *
 * @param {string[]} items
 * @returns {{ sorted: string[], map: Record<string, {row: number, col: number, x: number, y: number, w: number, h: number}> }}
 */
export function computeCoords(items) {
	const sorted = [...items].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
	/** @type {Record<string, {row: number, col: number, x: number, y: number, w: number, h: number}>} */
	const map = {};
	sorted.forEach((name, idx) => {
		const col = idx % LAYOUT.cols;
		const row = Math.floor(idx / LAYOUT.cols);
		const cx = col * LAYOUT.cell_w;
		const cy = LAYOUT.title_h + row * LAYOUT.cell_h;
		map[name] = {
			row,
			col,
			x: cx + LAYOUT.pad_x,
			y: cy + LAYOUT.pad_y,
			w: LAYOUT.img_size,
			h: LAYOUT.img_size,
		};
	});
	return { sorted, map };
}

/**
 * Generate the sprite-coords.json data structure.
 *
 * @param {Array<{id: string, file: string, title: string, items: string[]}>} sheets
 * @returns {{version: number, note: string, layout: typeof LAYOUT, sheets: Record<string, object>}}
 */
export function buildCoordsDoc(sheets) {
	const doc = {
		version: 1,
		note: "Auto-generated. Item coordinates on each sprite sheet. Items are sorted alphabetically inside each sheet; (row, col) is the grid position and (x, y, w, h) is the pixel box of the icon (label strip is below at y+h..y+h+label_h).",
		layout: LAYOUT,
		sheets: {},
	};
	for (const sheet of sheets) {
		const { sorted, map } = computeCoords(sheet.items);
		doc.sheets[sheet.id] = {
			file: sheet.file,
			title: sheet.title,
			item_count: sorted.length,
			rows: Math.ceil(sorted.length / LAYOUT.cols),
			items: map,
		};
	}
	return doc;
}

/**
 * Test whether a filesystem path exists.
 *
 * @param {string} p
 * @returns {Promise<boolean>}
 */
export async function pathExists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

/** Escape the five XML special characters so a string is safe to embed in SVG. */
export function escapeXml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Rough text-width estimate for a 12-px sans-serif label. */
export function estimateWidth(s) {
	let w = 0;
	for (const ch of s) {
		if (/[A-Z]/.test(ch)) w += 8;
		else if (/[0-9]/.test(ch)) w += 7;
		else if (/[a-z]/.test(ch)) w += 6.5;
		else w += 4; // space, punctuation
	}
	return Math.ceil(w);
}

/**
 * Wrap a label onto up to two lines, breaking on whitespace. Lines past the
 * second are truncated.
 *
 * @param {string} name
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function wrapLabel(name, maxWidth) {
	const words = name.split(/\s+/);
	const lines = [];
	let cur = "";
	for (const w of words) {
		const trial = cur ? `${cur} ${w}` : w;
		if (estimateWidth(trial) <= maxWidth) cur = trial;
		else {
			if (cur) lines.push(cur);
			cur = w;
		}
	}
	if (cur) lines.push(cur);
	return lines.slice(0, 2);
}
