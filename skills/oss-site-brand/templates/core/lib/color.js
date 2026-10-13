// Color math for the site tokens: WCAG 2.x contrast, the computed text-safe
// accent shades, and the computed on-accent text color. Pure functions, no I/O,
// so the build, the contrast script, and the tests all share one definition.

/** Ink & white candidates for text drawn on top of the accent. */
export const INK = "#101216";
export const WHITE = "#ffffff";

/** WCAG 2.x thresholds: normal text, then large text (>= 24px, or >= 18.66px bold). */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

/**
 * Lightness step used when searching for a text-safe shade. One percent is
 * fine enough that the shade stays visually close to the accent, and coarse
 * enough that the search ends in at most 100 iterations.
 */
const LIGHTNESS_STEP = 0.01;

/**
 * Parse `#rgb` or `#rrggbb` into 0-255 channels.
 *
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function parseHex(hex) {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
	if (!match) {
		throw new Error(
			`Invalid color "${hex}": expected a hex value such as #2346d4.`
		);
	}
	let digits = match[1];
	if (digits.length === 3) {
		digits = [...digits].map((d) => d + d).join("");
	}
	return {
		r: parseInt(digits.slice(0, 2), 16),
		g: parseInt(digits.slice(2, 4), 16),
		b: parseInt(digits.slice(4, 6), 16),
	};
}

/**
 * Format channels as a lowercase `#rrggbb` string.
 *
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {string}
 */
export function toHex({ r, g, b }) {
	return (
		"#" +
		[r, g, b]
			.map((c) =>
				Math.max(0, Math.min(255, Math.round(c)))
					.toString(16)
					.padStart(2, "0")
			)
			.join("")
	);
}

/** Normalize any accepted hex spelling to lowercase `#rrggbb`. */
export function normalizeHex(hex) {
	return toHex(parseHex(hex));
}

/**
 * WCAG relative luminance.
 *
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
	const { r, g, b } = parseHex(hex);
	const [lr, lg, lb] = [r, g, b].map((channel) => {
		const c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * WCAG contrast ratio between two colors, in the range 1 to 21.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * @param {string} hex
 * @returns {{ h: number, s: number, l: number }} h in degrees, s & l in 0-1
 */
export function hexToHsl(hex) {
	const { r, g, b } = parseHex(hex);
	const [rn, gn, bn] = [r / 255, g / 255, b / 255];
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return { h: 0, s: 0, l };
	const s = d / (1 - Math.abs(2 * l - 1));
	let h;
	if (max === rn) h = ((gn - bn) / d) % 6;
	else if (max === gn) h = (bn - rn) / d + 2;
	else h = (rn - gn) / d + 4;
	return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * @param {{ h: number, s: number, l: number }} hsl
 * @returns {string}
 */
export function hslToHex({ h, s, l }) {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] =
		h < 60
			? [c, x, 0]
			: h < 120
				? [x, c, 0]
				: h < 180
					? [0, c, x]
					: h < 240
						? [0, x, c]
						: h < 300
							? [x, 0, c]
							: [c, 0, x];
	return toHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * Text color for content drawn on an accent fill: ink or white, whichever has
 * the higher contrast. Ink is not pure black, so for a mid-tone accent where
 * both fall under 4.5:1 the choice widens to pure black or white (the better
 * of those two is never below 4.58:1). White is never assumed.
 *
 * @param {string} accent
 * @returns {string}
 */
export function onAccent(accent) {
	const best = (candidates) =>
		candidates.reduce((a, b) =>
			contrastRatio(a, accent) >= contrastRatio(b, accent) ? a : b
		);
	const pick = best([INK, WHITE]);
	return contrastRatio(pick, accent) >= AA_NORMAL ? pick : best(["#000000", WHITE]);
}

/**
 * The accent, adjusted only as far as needed so it reads as text on every
 * given surface. The hue & saturation stay; lightness moves toward darker for
 * light surfaces and lighter for dark ones. An accent that already passes is
 * returned unchanged.
 *
 * @param {string} accent
 * @param {string[]} surfaces hex backgrounds the text can sit on
 * @param {"light"|"dark"} mode
 * @param {number} [min] minimum contrast ratio
 * @returns {string}
 */
export function textSafe(accent, surfaces, mode, min = AA_NORMAL) {
	const passes = (hex) => surfaces.every((s) => contrastRatio(hex, s) >= min);
	const start = normalizeHex(accent);
	if (passes(start)) return start;

	const hsl = hexToHsl(start);
	const direction = mode === "light" ? -1 : 1;
	for (let l = hsl.l; l >= 0 && l <= 1; l += direction * LIGHTNESS_STEP) {
		const candidate = hslToHex({ ...hsl, l });
		if (passes(candidate)) return candidate;
	}
	// Black or white always passes against a surface of the matching mode.
	return mode === "light" ? "#000000" : "#ffffff";
}
