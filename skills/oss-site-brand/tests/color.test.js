import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	AA_LARGE,
	AA_NORMAL,
	contrastRatio,
	hexToHsl,
	hslToHex,
	normalizeHex,
	onAccent,
	parseHex,
	relativeLuminance,
	textSafe,
} from "../templates/core/lib/color.js";

const LIGHT_SURFACES = ["#ffffff", "#f4f5f8", "#eceef3"];
const DARK_SURFACES = ["#101216", "#181b21", "#1d212a"];

describe("contrast math", () => {
	test("black on white is 21:1 and the ratio is symmetric", () => {
		assert.equal(contrastRatio("#000000", "#ffffff"), 21);
		assert.equal(contrastRatio("#ffffff", "#000000"), 21);
	});

	test("identical colors are 1:1", () => {
		assert.equal(contrastRatio("#2346d4", "#2346d4"), 1);
	});

	test("luminance of white is 1 and of black is 0", () => {
		assert.equal(relativeLuminance("#fff"), 1);
		assert.equal(relativeLuminance("#000"), 0);
	});

	test("thresholds are the WCAG values", () => {
		assert.equal(AA_NORMAL, 4.5);
		assert.equal(AA_LARGE, 3);
	});
});

describe("hex parsing", () => {
	test("expands shorthand and lowercases", () => {
		assert.equal(normalizeHex("#ABC"), "#aabbcc");
		assert.deepEqual(parseHex("#102030"), { r: 16, g: 32, b: 48 });
	});

	test("rejects anything else with a helpful message", () => {
		for (const bad of ["red", "#12", "#gggggg", "", undefined]) {
			assert.throws(() => parseHex(bad), /Invalid color/);
		}
	});

	test("hsl round trip stays within one channel step", () => {
		for (const hex of ["#2346d4", "#ffd23f", "#c92c6b", "#808080"]) {
			const back = parseHex(hslToHex(hexToHsl(hex)));
			const start = parseHex(hex);
			for (const channel of ["r", "g", "b"]) {
				assert.ok(Math.abs(back[channel] - start[channel]) <= 1, hex);
			}
		}
	});
});

describe("on-accent text color", () => {
	test("is chosen by contrast, never assumed white", () => {
		assert.equal(onAccent("#ffd23f"), "#101216");
		assert.equal(onAccent("#2346d4"), "#ffffff");
	});

	test("always reaches 4.5:1 for a sweep of accents", () => {
		for (let r = 0; r < 256; r += 51) {
			for (let g = 0; g < 256; g += 51) {
				for (let b = 0; b < 256; b += 51) {
					const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
					assert.ok(contrastRatio(onAccent(hex), hex) >= AA_NORMAL, hex);
				}
			}
		}
	});
});

describe("text-safe accent shades", () => {
	test("an accent that already passes is returned unchanged", () => {
		assert.equal(textSafe("#2346d4", LIGHT_SURFACES, "light"), "#2346d4");
	});

	test("light mode darkens a bright accent until every surface passes", () => {
		const shade = textSafe("#ffd23f", LIGHT_SURFACES, "light");
		assert.notEqual(shade, "#ffd23f");
		for (const surface of LIGHT_SURFACES) {
			assert.ok(contrastRatio(shade, surface) >= AA_NORMAL, surface);
		}
	});

	test("dark mode lightens a deep accent until every surface passes", () => {
		const shade = textSafe("#2346d4", DARK_SURFACES, "dark");
		for (const surface of DARK_SURFACES) {
			assert.ok(contrastRatio(shade, surface) >= AA_NORMAL, surface);
		}
	});

	test("extreme accents still land on a passing color", () => {
		for (const accent of ["#000000", "#ffffff", "#808080", "#ff00ff", "#00ffff"]) {
			for (const [mode, surfaces] of [
				["light", LIGHT_SURFACES],
				["dark", DARK_SURFACES],
			]) {
				const shade = textSafe(accent, surfaces, mode);
				for (const surface of surfaces) {
					assert.ok(contrastRatio(shade, surface) >= AA_NORMAL, `${accent} ${mode} ${surface}`);
				}
			}
		}
	});
});
