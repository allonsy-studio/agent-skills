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
 * Pure data transforms (planSheets, computeCoords, buildCoordsDoc, helpers,
 * LAYOUT) live in ./sprite-coords.js and are unit-tested. This file is the
 * CLI + IO entry point: it orchestrates the build, drives sharp for the
 * actual image compositing, and is excluded from coverage.
 *
 * Layout matches the Python builder: 8-col alphabetical grid, 120-px icons,
 * 32-px label strip, dark background with section title.
 */

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
	LAYOUT,
	planSheets,
	buildCoordsDoc,
	pathExists,
	escapeXml,
	estimateWidth,
	wrapLabel,
} from "./sprite-coords.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const IMG_DIR = join(ROOT, "references", "images");
const OUT_DIR = join(ROOT, "references");
const GATHERABLES = join(ROOT, "references", "gatherables.json");
const RECIPES = join(ROOT, "references", "recipes.json");

const BG_HEX = "transparent";
const LABEL_BG_HEX = "#26262c";
const TEXT_COLOR = "#ebebeb";
const TITLE_COLOR = "#ffffff";
const RULE_COLOR = "#50505a";

/**
 * Render one sprite sheet by compositing icons + SVG title/labels.
 *
 * @param {any} sharp  the dynamically-imported sharp module
 * @param {{ id: string, file: string, title: string }} sheet
 * @param {{ items: Record<string, { row: number, col: number }> }} coords
 * @returns {Promise<{ built: false, reason: string } | { built: true, dim: [number, number], count: number }>}
 */
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

// Run only when invoked as a CLI, not on import.
const isCliInvocation = process.argv[1] && __filename === process.argv[1];
if (isCliInvocation) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
