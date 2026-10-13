import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { contrastRatio } from "../templates/core/lib/color.js";
import {
	parseRootProperties,
	resolveProperty,
	resolveValue,
	splitTopLevel,
} from "../templates/core/lib/css-tokens.js";
import { MONO_STACK } from "../templates/core/lib/project.js";
import { computeTheme, TEXT_SURFACES } from "../templates/core/lib/theme.js";
import { CORE_DIR } from "../scripts/lib/layers.js";

const tokensCss = readFileSync(
	path.join(CORE_DIR, "src", "assets", "css", "tokens.css"),
	"utf8"
);

describe("token resolver", () => {
	const props = parseRootProperties(`
		/* comment */
		:root { --a: light-dark(#111111, #eeeeee); --b: var(--a); --c: var(--missing, #123456); }
		.other { --a: #ff0000; }
	`);

	test("reads only :root declarations", () => {
		assert.equal(props.get("--a"), "light-dark(#111111, #eeeeee)");
	});

	test("resolves light-dark(), var() and fallbacks per mode", () => {
		assert.equal(resolveProperty(props, "--b", "light"), "#111111");
		assert.equal(resolveProperty(props, "--b", "dark"), "#eeeeee");
		assert.equal(resolveProperty(props, "--c", "light"), "#123456");
	});

	test("fails loudly on an unknown token or a cycle", () => {
		assert.throws(() => resolveProperty(props, "--nope", "light"), /not declared/);
		const cyclic = parseRootProperties(":root { --x: var(--y); --y: var(--x); }");
		assert.throws(() => resolveProperty(cyclic, "--x", "light"), /Cycle/);
	});

	test("splits only at the top level", () => {
		assert.deepEqual(splitTopLevel('a, f(b, c), "d, e"', ","), ["a", " f(b, c)", ' "d, e"']);
	});

	test("resolves a value that is not a declared property", () => {
		assert.equal(resolveValue(props, "var(--b)", "dark"), "#eeeeee");
	});
});

describe("computeTheme", () => {
	test("emits the computed accent block with passing text shades", () => {
		const theme = computeTheme({ project: { accent: "#ffd23f" }, tokensCss });
		assert.equal(theme.accent, "#ffd23f");
		assert.equal(theme.onAccent, "#101216");
		assert.match(theme.css, /--accent-text-light: #[0-9a-f]{6};/);
		for (const surface of TEXT_SURFACES) {
			const props = parseRootProperties(tokensCss);
			assert.ok(contrastRatio(theme.accentTextLight, resolveProperty(props, surface, "light")) >= 4.5);
			assert.ok(contrastRatio(theme.accentTextDark, resolveProperty(props, surface, "dark")) >= 4.5);
		}
	});

	test("always loads the locked mono and adds swap to the font URL", () => {
		const theme = computeTheme({ project: { accent: "#2346d4" }, tokensCss });
		assert.deepEqual(theme.fonts.map((f) => f.family), ["PT Mono"]);
		assert.match(theme.fontsUrl, /family=PT\+Mono/);
		assert.match(theme.fontsUrl, /display=swap$/);
	});

	test("project fonts go in front of the default stack", () => {
		const theme = computeTheme({
			project: {
				accent: "#2346d4",
				fonts: { sans: { family: "Inter" }, display: { family: "Fraunces", weights: [700] } },
			},
			tokensCss,
		});
		assert.match(theme.css, /--font-sans: "Inter", ui-sans-serif/);
		assert.match(theme.css, /--font-display: "Fraunces", var\(--font-sans\);/);
		assert.match(theme.fontsUrl, /family=Inter:wght@400;700&family=Fraunces:wght@700&family=PT\+Mono/);
		assert.doesNotMatch(theme.css, /--font-mono/);
	});

	test("the token sheet declares the locked mono stack", () => {
		const props = parseRootProperties(tokensCss);
		assert.equal(props.get("--font-mono").replace(/\s+/g, " "), MONO_STACK);
		assert.match(MONO_STACK, /^"PT Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace$/);
	});
});
