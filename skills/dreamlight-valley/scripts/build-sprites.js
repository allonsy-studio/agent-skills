#!/usr/bin/env node
/**
 * Build sprite-coords.json (and optionally regenerate sprite sheets) for the
 * dreamlight-valley skill.
 *
 * Two modes:
 *   1. Coords-only (default): derives every item's grid position from
 *      gatherables.json and writes references/sprite-coords.json.
 *      No source images or ImageMagick required.
 *   2. Full rebuild: if references/images/<category>/*.png exist AND
 *      ImageMagick is on PATH, also regenerates the labeled sprite sheets
 *      via `montage`.
 *
 * Layout matches the Python builder: 8-col alphabetical grid, 120-px icons,
 * 32-px label strip, dark background with section title.
 */

import { readFile, readdir, writeFile, mkdir, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const IMG_DIR = join(ROOT, "references", "images");
const OUT_DIR = join(ROOT, "references");
const GATHERABLES = join(ROOT, "references", "gatherables.json");
const RECIPES = join(ROOT, "references", "recipes.json");

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

const LABEL_BG = "#26262c";
const TEXT_COLOR = "#ebebeb";
const TITLE_COLOR = "#ffffff";
const BG_COLOR = "transparent";

/**
 * Sheet definitions: which gatherables.json items belong on each sheet, and
 * what file they go to. Ingredient sheets are split by `category` field.
 *
 * @param {Record<string, Array<{name: string, category?: string}>>} categories
 * @param {Array<{name: string}>} recipes
 * @returns {Array<{id: string, file: string, title: string, items: string[]}>}
 */
export function planSheets(categories, recipes) {
	const sheets = Object.keys(categories)
		.filter((cat) => cat !== "ingredients")
		.map((cat) => ({
			id: cat,
			file: `${cat}.png`,
			title: cat.charAt(0).toUpperCase() + cat.slice(1),
			items: categories[cat].map((i) => i.name),
		}));

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

/**
 * Return the path to the source folder of icons for a sheet.
 *
 * @param {{id: string}} sheet
 * @param {string} imageRoot
 * @returns {string}
 */
export function sourceFolderForSheet(sheet, imageRoot) {
	return sheet.id.startsWith("ingredients-")
		? join(imageRoot, "ingredients", sheet.id.replace("ingredients-", ""))
		: join(imageRoot, sheet.id);
}

/**
 * Build the ImageMagick `montage` argv that lays out icons + per-cell labels.
 * Returns null if there are no icons to montage.
 *
 * @param {Array<{path: string, label: string}>} icons  source icons in display order
 * @param {string} outPath
 * @returns {string[] | null}
 */
export function buildMontageArgs(icons, outPath) {
	if (icons.length === 0) return null;

	const args = [
		"-background",
		BG_COLOR,
		"-fill",
		TEXT_COLOR,
		"-font",
		"Helvetica",
		"-pointsize",
		"12",
		"-mattecolor",
		LABEL_BG,
		"-label",
		"%l",
	];

	// Each icon gets a `-label "<name>"` immediately before its path so montage
	// uses the human-readable name (not the filename) under the cell.
	for (const icon of icons) {
		args.push("-label", icon.label, icon.path);
	}

	args.push(
		"-tile",
		`${LAYOUT.cols}x`,
		"-geometry",
		`${LAYOUT.img_size}x${LAYOUT.img_size}+${LAYOUT.pad_x}+${LAYOUT.pad_y}`,
		outPath,
	);

	return args;
}

/**
 * Build the ImageMagick `convert` argv that splices a title bar onto a montage.
 *
 * @param {string} montagePath
 * @param {{title: string, count: number}} sheet
 * @param {string} outPath
 * @returns {string[]}
 */
export function buildTitleArgs(montagePath, sheet, outPath) {
	const title = `${sheet.title} — ${sheet.count} items`;
	return [
		montagePath,
		"-background",
		LABEL_BG,
		"-fill",
		TITLE_COLOR,
		"-font",
		"Helvetica-Bold",
		"-pointsize",
		"22",
		"-gravity",
		"NorthWest",
		"-splice",
		`0x${LAYOUT.title_h}`,
		"-annotate",
		`+${LAYOUT.pad_x * 2}+${LAYOUT.pad_y * 2 + 22}`,
		title,
		outPath,
	];
}

/**
 * Run an external command; resolve with stdout, reject on non-zero exit.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCmd(cmd, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args);
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => (stdout += d.toString()));
		child.stderr.on("data", (d) => (stderr += d.toString()));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve({ stdout, stderr });
			else
				reject(
					new Error(
						`${cmd} exited ${code}\n${stderr || stdout || ""}`,
					),
				);
		});
	});
}

/**
 * First ImageMagick binary on PATH, or null. Honors `magick` (v7) and
 * falls back to v6's separate `montage` / `convert` binaries.
 *
 * @returns {Promise<{montage: string[], convert: string[]} | null>}
 */
export async function detectImageMagick() {
	try {
		await runCmd("magick", ["-version"]);
		return { montage: ["magick", "montage"], convert: ["magick"] };
	} catch {
		// fall through
	}
	try {
		await runCmd("montage", ["-version"]);
		return { montage: ["montage"], convert: ["convert"] };
	} catch {
		return null;
	}
}

/**
 * Render one sprite sheet via ImageMagick.
 *
 * @param {{montage: string[], convert: string[]}} im
 * @param {{id: string, file: string, title: string}} sheet
 * @param {{items: Record<string, object>}} coords
 * @returns {Promise<{built: boolean, count?: number, reason?: string}>}
 */
async function buildSheetViaImageMagick(im, sheet, coords) {
	const folder = sourceFolderForSheet(sheet, IMG_DIR);
	if (!(await pathExists(folder))) {
		return { built: false, reason: `no source folder at ${folder}` };
	}

	const filesInFolder = (await readdir(folder)).filter((f) =>
		f.endsWith(".png"),
	);
	if (filesInFolder.length === 0) {
		return { built: false, reason: "folder is empty" };
	}

	const sortedNames = Object.keys(coords.items).sort((a, b) =>
		a.toLowerCase().localeCompare(b.toLowerCase()),
	);

	const icons = [];
	for (const name of sortedNames) {
		const filename = `${name.replace(/ /g, "_")}.png`;
		const filePath = join(folder, filename);
		if (!(await pathExists(filePath))) {
			console.warn(`  missing source: ${filename}`);
			continue;
		}
		icons.push({ path: filePath, label: name });
	}

	const tilePath = join(OUT_DIR, "sprites", `_tile_${sheet.file}`);
	const finalPath = join(OUT_DIR, "sprites", sheet.file);

	const montageArgs = buildMontageArgs(icons, tilePath);
	if (!montageArgs) {
		return { built: false, reason: "no usable icons" };
	}

	await runCmd(im.montage[0], [...im.montage.slice(1), ...montageArgs]);

	const titleArgs = buildTitleArgs(
		tilePath,
		{ title: sheet.title, count: icons.length },
		finalPath,
	);
	await runCmd(im.convert[0], [...im.convert.slice(1), ...titleArgs]);

	return { built: true, count: icons.length };
}

/**
 * CLI entry point. Reads gatherables + recipes, plans sheets, writes the
 * coords doc, and optionally regenerates sprite PNGs when source images +
 * ImageMagick are both present.
 */
export async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	await mkdir(join(OUT_DIR, "sprites"), { recursive: true });

	const gatherables = JSON.parse(await readFile(GATHERABLES, "utf8"));
	const recipes = JSON.parse(await readFile(RECIPES, "utf8"));
	const sheets = planSheets(
		gatherables?.categories ?? {},
		recipes?.recipes ?? [],
	);
	const coordsDoc = buildCoordsDoc(sheets);

	const coordsPath = join(OUT_DIR, "sprite-coords.json");
	await writeFile(coordsPath, JSON.stringify(coordsDoc, null, 2) + "\n");
	const total = Object.values(coordsDoc.sheets).reduce(
		(n, s) => n + s.item_count,
		0,
	);
	console.log(`Wrote ${coordsPath}`);
	console.log(`  ${sheets.length} sheets, ${total} items indexed`);

	const imagesExist = await pathExists(IMG_DIR);
	if (!imagesExist) {
		console.log(
			`\nSource images at ${IMG_DIR} not present — skipping sheet regeneration.`,
		);
		console.log(
			`To regenerate: populate references/images/<category>/*.png and re-run yarn build.`,
		);
		return;
	}

	const im = await detectImageMagick();
	if (!im) {
		console.warn(
			"\nImageMagick (`magick` or `montage`) not found on PATH — skipping sheet regeneration.",
		);
		console.warn(
			"Install it: brew install imagemagick (macOS) or apt-get install imagemagick (Debian/Ubuntu)",
		);
		return;
	}

	console.log("\nRegenerating sprite sheets:");
	for (const sheet of sheets) {
		const coords = coordsDoc.sheets[sheet.id];
		const result = await buildSheetViaImageMagick(im, sheet, coords);
		if (result.built) {
			console.log(`  ${sheet.file}: ${result.count} icons`);
		} else {
			console.log(`  ${sheet.file}: skipped (${result.reason})`);
		}
	}
}

// Run only when invoked as a CLI, not on import — so tests can import the
// pure helpers without triggering main().
const isCliInvocation =
	process.argv[1] && __filename === process.argv[1];
if (isCliInvocation) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
