#!/usr/bin/env node
/**
 * Build sprite-coords.json (and optionally regenerate sprite sheets) for the
 * dreamlight-valley skill.
 *
 * Two modes:
 *   1. Coords-only (default): derives every item's grid position from
 *      gatherables.json and writes references/sprite-coords.json.
 *      No source images required.
 *   2. Full rebuild: if references/images/<category>/*.png exist, also
 *      regenerates the labeled sprite sheets via sharp.
 *
 * Layout matches the Python builder: 8-col alphabetical grid, 120-px icons,
 * 32-px label strip, dark background with section title.
 */

import { readFile, readdir, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IMG_DIR = join(ROOT, "references", "images");
const OUT_DIR = join(ROOT, "references");
const GATHERABLES = join(ROOT, "references", "gatherables.json");
const RECIPES = join(ROOT, "references", "recipes.json");

// Layout — must match build_sprites.py for backwards compatibility.
const LAYOUT = {
	img_size: 120,
	pad_x: 6,
	pad_y: 6,
	label_h: 32,
	cols: 8,
	title_h: 52,
};
LAYOUT.cell_w = LAYOUT.img_size + 2 * LAYOUT.pad_x;
LAYOUT.cell_h = LAYOUT.img_size + 2 * LAYOUT.pad_y + LAYOUT.label_h;

const BG_HEX = "transparent";
const LABEL_BG_HEX = "#26262c";
const TEXT_COLOR = "#ebebeb";
const TITLE_COLOR = "#ffffff";
const RULE_COLOR = "#50505a";

/**
 * Sheet definitions: which gatherables.json items belong on each sheet, and
 * what file they go to. Ingredient sheets are split by `category` field.
 */
function planSheets(categories, recipes) {
	// Use the folder name for the ingredients sheet title.
	const sheets = Object.keys(categories)
		.filter(cat => cat !== "ingredients")
		.map(cat => ({
			id: cat,
			file: `${cat}.png`,
			title: cat.charAt(0).toUpperCase() + cat.slice(1),
			items: categories[cat].map((i) => i.name)
		}));

	// Get a list of all possible categories from the ingredients sheet.
	const byCategory = new Map();
	for (const item of categories.ingredients) {
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

/** Compute grid (row, col) and pixel box for each item on a sheet. */
function computeCoords(items) {
	const sorted = [...items].sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
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

/** Generate the sprite-coords.json data structure. */
function buildCoordsDoc(sheets) {
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

async function pathExists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

function escapeXml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** Rough text-width estimate for a 12-px sans-serif label. */
function estimateWidth(s) {
	let w = 0;
	for (const ch of s) {
		if (/[A-Z]/.test(ch)) w += 8;
		else if (/[0-9]/.test(ch)) w += 7;
		else if (/[a-z]/.test(ch)) w += 6.5;
		else w += 4; // space, punctuation
	}
	return Math.ceil(w);
}

function wrapLabel(name, maxWidth) {
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

async function buildSheet(sharp, sheet, coords) {
	const folder = sheet.id.startsWith("ingredients-")
		? join(IMG_DIR, "ingredients", sheet.id.replace("ingredients-", ""))
		: join(IMG_DIR, sheet.id);

	if (!(await pathExists(folder))) {
		return { built: false, reason: `no source folder at ${folder}` };
	}

	const filesInFolder = (await readdir(folder)).filter((f) => f.endsWith(".png"));
	if (filesInFolder.length === 0) {
		return { built: false, reason: "folder is empty" };
	}

	const sortedNames = Object.keys(coords.items).sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);
	const rows = Math.ceil(sortedNames.length / LAYOUT.cols);
	const W = LAYOUT.cols * LAYOUT.cell_w;
	const H = LAYOUT.title_h + rows * LAYOUT.cell_h + LAYOUT.pad_y;

	// Build SVG overlay (background, title bar, label strips, label text).
	const svgParts = [
		`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`,
		`<rect width="${W}" height="${H}" fill="${BG_HEX}"/>`,
		`<text x="${LAYOUT.pad_x * 2}" y="${LAYOUT.pad_y * 2 + 22}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" fill="${TITLE_COLOR}">${escapeXml(sheet.title)} — ${sortedNames.length} items</text>`,
		`<line x1="0" y1="${LAYOUT.title_h - 1}" x2="${W}" y2="${LAYOUT.title_h - 1}" stroke="${RULE_COLOR}" stroke-width="1"/>`,
	];

	const composites = [];
	for (const name of sortedNames) {
		const c = coords.items[name];
		const cx = c.col * LAYOUT.cell_w;
		const cy = LAYOUT.title_h + c.row * LAYOUT.cell_h;
		const filename = `${name.replace(/ /g, "_")}.png`;
		const filePath = join(folder, filename);
		if (!(await pathExists(filePath))) {
			console.warn(`  missing source: ${filename}`);
			continue;
		}
		const iconBuf = await readFile(filePath);
		const resized = await sharp(iconBuf)
			.resize({ width: LAYOUT.img_size, height: LAYOUT.img_size, fit: "inside" })
			.toBuffer();
		const meta = await sharp(resized).metadata();
		const ix = cx + LAYOUT.pad_x + Math.floor((LAYOUT.img_size - meta.width) / 2);
		const iy = cy + LAYOUT.pad_y + Math.floor((LAYOUT.img_size - meta.height) / 2);
		composites.push({ input: resized, top: iy, left: ix });

		// Label strip.
		const ly0 = cy + LAYOUT.pad_y + LAYOUT.img_size + 2;
		svgParts.push(
			`<rect x="${cx + 2}" y="${ly0}" width="${LAYOUT.cell_w - 4}" height="${LAYOUT.label_h - 4}" fill="${LABEL_BG_HEX}"/>`,
		);

		const lines = wrapLabel(name, LAYOUT.cell_w - 10);
		const lineH = 14;
		const totalH = lineH * lines.length;
		let textY = ly0 + Math.floor((LAYOUT.label_h - 4 - totalH) / 2) + 11;
		for (const ln of lines) {
			const lnW = estimateWidth(ln);
			const tx = cx + Math.floor((LAYOUT.cell_w - lnW) / 2);
			svgParts.push(
				`<text x="${tx}" y="${textY}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" fill="${TEXT_COLOR}">${escapeXml(ln)}</text>`,
			);
			textY += lineH;
		}
	}

	svgParts.push("</svg>");
	const svg = svgParts.join("");

	const png = await sharp(Buffer.from(svg))
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toBuffer();

	await writeFile(join(OUT_DIR, "sprites", sheet.file), png);
	return { built: true, dim: [W, H], count: sortedNames.length };
}

async function main() {
	// Create the output directory if it doesn't exist.
	await mkdir(OUT_DIR, { recursive: true });
	await mkdir(join(OUT_DIR, "sprites"), { recursive: true });

	// Read the gatherables and recipes files.
	const gatherables = JSON.parse(await readFile(GATHERABLES, "utf8"));
	const recipes = JSON.parse(await readFile(RECIPES, "utf8"));
	const sheets = planSheets(gatherables?.categories ?? {}, recipes?.recipes ?? []);
	const coordsDoc = buildCoordsDoc(sheets);

	// Always emit coords.
	const coordsPath = join(OUT_DIR, "sprite-coords.json");
	await writeFile(coordsPath, JSON.stringify(coordsDoc, null, 2) + "\n");
	const total = Object.values(coordsDoc.sheets).reduce(
		(n, s) => n + s.item_count,
		0,
	);
	console.log(`Wrote ${coordsPath}`);
	console.log(`  ${sheets.length} sheets, ${total} items indexed`);

	// Optionally rebuild sheets if source images are present.
	const imagesExist = await pathExists(IMG_DIR);
	if (!imagesExist) {
		console.log(`\nSource images at ${IMG_DIR} not present — skipping sheet regeneration.`);
		console.log(
			`To regenerate: populate references/images/<category>/*.png and re-run yarn build:sprites.`,
		);
		return;
	}

	const { default: sharp } = await import("sharp");
	console.log("\nRegenerating sprite sheets:");
	for (const sheet of sheets) {
		const coords = coordsDoc.sheets[sheet.id];
		const result = await buildSheet(sharp, sheet, coords);
		if (result.built) {
			console.log(
				`  ${sheet.file}: ${result.count} imgs, ${result.dim[0]}×${result.dim[1]}`,
			);
		} else {
			console.log(`  ${sheet.file}: skipped (${result.reason})`);
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
