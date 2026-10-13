// Logo & favicon: decide what to do, then draw the wordmark fallback & the
// icon set. Existing assets always win; nothing here ever blocks a build.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { onAccent } from "../../templates/core/lib/color.js";
import { SANS_STACK } from "../../templates/core/lib/project.js";

/** Icon files the head partial links to, relative to `src/assets/img/`. */
export const ICON_FILES = Object.freeze({
	svg: "favicon.svg",
	png32: "favicon-32.png",
	touch: "apple-touch-icon.png",
	icon192: "icon-192.png",
	icon512: "icon-512.png",
	social: "og-image.png",
	manifest: "manifest.webmanifest",
});

/** Pixel size of each raster, keyed like ICON_FILES. The social image is 1200 by 630. */
export const RASTER_SIZES = Object.freeze({
	png32: [32, 32],
	touch: [180, 180],
	icon192: [192, 192],
	icon512: [512, 512],
	social: [1200, 630],
});

/** Corner radius of the favicon square, as a fraction of its side (a rounded square). */
const CORNER_RATIO = 14 / 64;

/**
 * Pick the next step. Mirrors the decision in the architecture doc, as a pure
 * function so it can be tested without a conversation.
 *
 * @param {{
 *   hasFavicon: boolean,
 *   hasLogo: boolean,
 *   userPresent: boolean,
 *   hasConcept?: boolean | null,
 * }} input hasConcept is null until the maintainer has been asked
 * @returns {"keep" | "ask" | "propose" | "wordmark"}
 */
export function decideMark({ hasFavicon, hasLogo, userPresent, hasConcept = null }) {
	if (hasFavicon && hasLogo) return "keep";
	if (userPresent && hasConcept === null) return "ask";
	if (userPresent && hasConcept) return "propose";
	return "wordmark";
}

/** The one question, asked once. */
export const CONCEPT_QUESTION =
	"Does the project have any metaphors or visuals that could carry a mark? An object, an action, a shape, a nickname.";

/**
 * What the project already has, read from the site directory.
 *
 * @param {string} siteDir e.g. `docs`
 * @param {{ logo?: string }} project the parsed project layer
 */
export function inspectMark(siteDir, project = {}) {
	const img = path.join(siteDir, "src", "assets", "img");
	const present = Object.fromEntries(
		Object.entries(ICON_FILES).map(([key, file]) => [
			key,
			existsSync(path.join(img, file)),
		])
	);
	const hasLogo = Boolean(project.logo) && existsSync(path.join(img, project.logo));
	const missing = Object.entries(ICON_FILES)
		.filter(([key]) => !present[key])
		.map(([, file]) => file);
	return { hasFavicon: present.svg, hasLogo, present, missing };
}

/** First letter or digit of a package name, uppercased, scope removed. */
export function monogramOf(name) {
	const bare = String(name).replace(/^@[^/]+\//, "");
	const match = /[a-z0-9]/i.exec(bare);
	return match ? match[0].toUpperCase() : "?";
}

const escapeXml = (text) =>
	String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/**
 * Font stack for drawn text: the project's heading family when set, then the
 * default sans, with a generic fallback so a raster never renders blank.
 *
 * @param {{ fonts?: { display?: { family: string }, sans?: { family: string } } }} project
 */
export function wordmarkFontStack(project = {}) {
	const own = project.fonts?.display?.family ?? project.fonts?.sans?.family;
	const head = own ? `'${own.replace(/'/g, "")}', ` : "";
	return `${head}${SANS_STACK.replace(/"/g, "'")}, sans-serif`;
}

/**
 * The wordmark favicon: the first letter on an accent-filled rounded square.
 * The letter color is computed from the accent, never assumed white.
 *
 * @param {{ name: string, accent: string, project?: object }} input
 * @returns {{ svg: string, letter: string, fill: string, ink: string }}
 */
export function wordmarkFavicon({ name, accent, project = {} }) {
	const letter = monogramOf(name);
	const ink = onAccent(accent);
	// 64-unit grid: the baseline sits at 71% of the square so the cap height is centered.
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
		`<rect width="64" height="64" rx="${64 * CORNER_RATIO}" fill="${accent}"/>` +
		`<text x="32" y="45.5" text-anchor="middle" font-family="${escapeXml(wordmarkFontStack(project))}" ` +
		`font-weight="700" font-size="38" fill="${ink}">${escapeXml(letter)}</text>` +
		`</svg>\n`;
	return { svg, letter, fill: accent, ink };
}

/**
 * The 1200 by 630 social image: the project name & tagline on the accent.
 *
 * @param {{ name: string, tagline: string, accent: string, project?: object }} input
 * @returns {string} svg
 */
export function socialImageSvg({ name, tagline, accent, project = {} }) {
	const ink = onAccent(accent);
	const stack = escapeXml(wordmarkFontStack(project));
	// Long names shrink so they stay inside the 1200 px frame (about 0.58 em per glyph).
	const size = Math.max(64, Math.min(160, Math.floor(1000 / (name.length * 0.58))));
	const sub = tagline.length > 70 ? `${tagline.slice(0, 67).trimEnd()}...` : tagline;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">` +
		`<rect width="1200" height="630" fill="${accent}"/>` +
		`<text x="100" y="330" font-family="${stack}" font-weight="700" font-size="${size}" fill="${ink}">${escapeXml(name)}</text>` +
		`<text x="104" y="420" font-family="${stack}" font-size="40" fill="${ink}">${escapeXml(sub)}</text>` +
		`</svg>\n`
	);
}

/**
 * Web app manifest. Icon paths are relative to the manifest, so the site base
 * path never matters.
 *
 * @param {{ name: string, accent: string }} input
 */
export function manifestJson({ name, accent }) {
	return (
		JSON.stringify(
			{
				name,
				short_name: name,
				start_url: ".",
				display: "browser",
				theme_color: accent,
				background_color: "#ffffff",
				icons: [
					{ src: ICON_FILES.icon192, sizes: "192x192", type: "image/png" },
					{ src: ICON_FILES.icon512, sizes: "512x512", type: "image/png" },
				],
			},
			null,
			"\t"
		) + "\n"
	);
}

/**
 * Write the icon set into `src/assets/img/`. Files that already exist are
 * kept unless `force` is set. Rasters come from the favicon svg (the existing
 * one when present, so the set always matches the mark in use).
 *
 * @param {{
 *   siteDir: string,
 *   name: string,
 *   tagline: string,
 *   accent: string,
 *   project?: object,
 *   svg?: string,
 *   force?: boolean,
 * }} input svg overrides the wordmark favicon (a chosen sketch)
 * @returns {Promise<{ written: string[], kept: string[] }>}
 */
export async function writeIconSet({
	siteDir,
	name,
	tagline,
	accent,
	project = {},
	svg,
	force = false,
}) {
	const { default: sharp } = await import("sharp");
	const img = path.join(siteDir, "src", "assets", "img");
	mkdirSync(img, { recursive: true });
	const written = [];
	const kept = [];

	const put = (file, content) => {
		const target = path.join(img, file);
		if (existsSync(target) && !force) {
			kept.push(file);
			return false;
		}
		writeFileSync(target, content);
		written.push(file);
		return true;
	};

	put(ICON_FILES.svg, svg ?? wordmarkFavicon({ name, accent, project }).svg);
	// Rasters follow whichever favicon is on disk now: a kept one, or the one just written.
	const faviconSvg = readFileSync(path.join(img, ICON_FILES.svg));

	for (const key of ["png32", "touch", "icon192", "icon512"]) {
		const [width, height] = RASTER_SIZES[key];
		// Density keeps the svg crisp when scaled up to 512 px.
		const png = await sharp(faviconSvg, { density: (width / 64) * 72 })
			.resize(width, height)
			.png()
			.toBuffer();
		put(ICON_FILES[key], png);
	}

	const [sw, sh] = RASTER_SIZES.social;
	const social = await sharp(
		Buffer.from(socialImageSvg({ name, tagline, accent, project }))
	)
		.resize(sw, sh)
		.png()
		.toBuffer();
	put(ICON_FILES.social, social);

	put(ICON_FILES.manifest, manifestJson({ name, accent }));
	return { written, kept };
}
