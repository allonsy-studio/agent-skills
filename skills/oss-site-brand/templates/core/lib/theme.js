// Turns the project layer (accent, optional fonts) into the computed token
// block that is injected after the static token sheet. The text-safe shades
// are measured against the real surface tokens parsed from tokens.css, so a
// change to a surface color flows through without a second source of truth.

import { readFileSync } from "node:fs";

import { AA_NORMAL, normalizeHex, onAccent, textSafe } from "./color.js";
import { parseRootProperties, resolveProperty } from "./css-tokens.js";
import { MONO_STACK, SANS_STACK } from "./project.js";

/** Surfaces body text & links can sit on, per the static token sheet. */
export const TEXT_SURFACES = ["--bg", "--bg-elev", "--code-bg"];

/** Weights requested when a font entry does not list any. */
const DEFAULT_WEIGHTS = [400, 700];

/** The locked mono family always loads; every other family is the project's. */
const MONO_FAMILY = { family: "PT Mono", weights: [] };

/** Quote a family name for a font-family list. */
const quote = (family) => `"${family}"`;

/** Google Fonts css2 family segment, e.g. `Inter:wght@400;700`. */
function familySegment({ family, weights }) {
	const name = family.trim().replace(/\s+/g, "+");
	if (!weights.length) return `family=${name}`;
	const sorted = [...new Set(weights)].sort((a, b) => a - b);
	return `family=${name}:wght@${sorted.join(";")}`;
}

/**
 * @param {{ project: Record<string, any>, tokensCss: string }} input
 * @returns {{
 *   accent: string,
 *   onAccent: string,
 *   accentTextLight: string,
 *   accentTextDark: string,
 *   fonts: { family: string, weights: number[] }[],
 *   fontsUrl: string,
 *   css: string,
 * }}
 */
export function computeTheme({ project, tokensCss }) {
	const properties = parseRootProperties(tokensCss);
	const surfaces = (mode) =>
		TEXT_SURFACES.map((name) => resolveProperty(properties, name, mode));

	const accent = normalizeHex(project.accent);
	const accentTextLight = textSafe(
		accent,
		surfaces("light"),
		"light",
		AA_NORMAL
	);
	const accentTextDark = textSafe(accent, surfaces("dark"), "dark", AA_NORMAL);
	const on = onAccent(accent);

	const fonts = [];
	const declarations = [
		`--accent: ${accent};`,
		`--accent-text-light: ${accentTextLight};`,
		`--accent-text-dark: ${accentTextDark};`,
		`--on-accent: ${on};`,
	];

	const sans = project.fonts?.sans;
	const display = project.fonts?.display;
	if (sans) {
		fonts.push({
			family: sans.family,
			weights: sans.weights ?? DEFAULT_WEIGHTS,
		});
		declarations.push(`--font-sans: ${quote(sans.family)}, ${SANS_STACK};`);
	}
	if (display) {
		fonts.push({
			family: display.family,
			weights: display.weights ?? DEFAULT_WEIGHTS,
		});
		declarations.push(
			`--font-display: ${quote(display.family)}, var(--font-sans);`
		);
	}
	fonts.push(MONO_FAMILY);

	const fontsUrl = `https://fonts.googleapis.com/css2?${fonts
		.map(familySegment)
		.join("&")}&display=swap`;

	const css = `:root {\n${declarations.map((d) => `\t${d}`).join("\n")}\n}\n`;

	return {
		accent,
		onAccent: on,
		accentTextLight,
		accentTextDark,
		fonts,
		fontsUrl,
		css,
	};
}

/**
 * @param {Record<string, any>} project
 * @param {string} tokensPath path to the static token sheet
 */
export function computeThemeFromFiles(project, tokensPath) {
	return computeTheme({
		project,
		tokensCss: readFileSync(tokensPath, "utf8"),
	});
}

export { MONO_STACK, SANS_STACK };
