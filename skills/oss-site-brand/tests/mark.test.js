import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import sharp from "sharp";

import { contrastRatio } from "../templates/core/lib/color.js";
import { inspect } from "../scripts/mark.js";
import {
	decideMark,
	ICON_FILES,
	inspectMark,
	manifestJson,
	monogramOf,
	RASTER_SIZES,
	wordmarkFavicon,
	wordmarkFontStack,
	writeIconSet,
} from "../scripts/lib/mark.js";

function site(project = { accent: "#2346d4" }) {
	const root = mkdtempSync(path.join(tmpdir(), "mark-"));
	const siteDir = path.join(root, "docs");
	mkdirSync(path.join(siteDir, "src", "_data"), { recursive: true });
	writeFileSync(path.join(siteDir, "src", "_data", "project.json"), JSON.stringify(project));
	writeFileSync(
		path.join(root, "package.json"),
		JSON.stringify({
			name: "@allons-y/thing",
			description: "A thing.",
			license: "MPL-2.0",
			repository: "allonsy-studio/thing",
		})
	);
	return { root, siteDir };
}

describe("decideMark: existing assets win, ask once, never block", () => {
	const cases = [
		[{ hasFavicon: true, hasLogo: true, userPresent: true }, "keep"],
		[{ hasFavicon: true, hasLogo: true, userPresent: false }, "keep"],
		[{ hasFavicon: false, hasLogo: false, userPresent: true }, "ask"],
		[{ hasFavicon: true, hasLogo: false, userPresent: true }, "ask"],
		[{ hasFavicon: false, hasLogo: false, userPresent: true, hasConcept: true }, "propose"],
		[{ hasFavicon: false, hasLogo: false, userPresent: true, hasConcept: false }, "wordmark"],
		[{ hasFavicon: false, hasLogo: false, userPresent: false }, "wordmark"],
		[{ hasFavicon: false, hasLogo: false, userPresent: false, hasConcept: true }, "wordmark"],
	];
	for (const [input, expected] of cases) {
		test(`${JSON.stringify(input)} -> ${expected}`, () => {
			assert.equal(decideMark(input), expected);
		});
	}
});

describe("wordmark favicon", () => {
	test("first letter, scope removed, uppercased", () => {
		assert.equal(monogramOf("@allons-y/envoy"), "E");
		assert.equal(monogramOf("glob-concat-cli"), "G");
		assert.equal(monogramOf("@x/-9lives"), "9");
		assert.equal(monogramOf("---"), "?");
	});

	test("the letter color reaches 4.5:1 on any accent, never assumed white", () => {
		for (const accent of ["#2346d4", "#ffd23f", "#6666ff", "#ff8800", "#00aa88", "#ffffff", "#000000"]) {
			const { ink, fill } = wordmarkFavicon({ name: "thing", accent });
			assert.ok(contrastRatio(ink, fill) >= 4.5, `${accent} -> ${ink}`);
		}
		assert.equal(wordmarkFavicon({ name: "thing", accent: "#ffd23f" }).ink, "#101216");
	});

	test("draws a rounded square in the accent with the letter, escaped", () => {
		const { svg } = wordmarkFavicon({ name: "<b>", accent: "#2346d4" });
		assert.match(svg, /<rect [^>]*rx="14"[^>]*fill="#2346d4"/);
		assert.match(svg, /font-weight="700"/);
		assert.doesNotMatch(svg, /<b>/);
	});

	test("typeface: the project heading font when set, else the default sans", () => {
		assert.match(wordmarkFontStack({}), /^ui-sans-serif, system-ui/);
		assert.match(wordmarkFontStack({ fonts: { display: { family: "Fraunces" } } }), /^'Fraunces', ui-sans-serif/);
		assert.match(wordmarkFontStack({ fonts: { sans: { family: "Inter" } } }), /^'Inter'/);
	});

	test("manifest icon paths are relative to the manifest", () => {
		const manifest = JSON.parse(manifestJson({ name: "thing", accent: "#2346d4" }));
		assert.deepEqual(manifest.icons.map((i) => i.src), [ICON_FILES.icon192, ICON_FILES.icon512]);
		assert.equal(manifest.theme_color, "#2346d4");
	});
});

describe("icon set", () => {
	test("writes every file at the sizes the doc names", async () => {
		const { siteDir } = site();
		const { written, kept } = await writeIconSet({
			siteDir,
			name: "thing",
			tagline: "A thing",
			accent: "#2346d4",
		});
		assert.equal(kept.length, 0);
		assert.equal(written.length, Object.keys(ICON_FILES).length);
		const img = path.join(siteDir, "src", "assets", "img");
		for (const [key, [width, height]] of Object.entries(RASTER_SIZES)) {
			const meta = await sharp(path.join(img, ICON_FILES[key])).metadata();
			assert.deepEqual([meta.width, meta.height], [width, height], key);
		}
		assert.match(readFileSync(path.join(img, ICON_FILES.svg), "utf8"), /^<svg /);
		assert.ok(existsSync(path.join(img, ICON_FILES.manifest)));
	});

	test("existing assets always win, and rasters follow the favicon in use", async () => {
		const { siteDir } = site();
		const img = path.join(siteDir, "src", "assets", "img");
		mkdirSync(img, { recursive: true });
		const own = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ff0000"/></svg>`;
		writeFileSync(path.join(img, ICON_FILES.svg), own);
		const { written, kept } = await writeIconSet({ siteDir, name: "thing", tagline: "A thing", accent: "#2346d4" });
		assert.deepEqual(kept, [ICON_FILES.svg]);
		assert.ok(!written.includes(ICON_FILES.svg));
		assert.equal(readFileSync(path.join(img, ICON_FILES.svg), "utf8"), own);
		const { data } = await sharp(path.join(img, ICON_FILES.icon192)).raw().toBuffer({ resolveWithObject: true });
		assert.deepEqual([...data.subarray(0, 3)], [255, 0, 0]);
	});

	test("a chosen sketch becomes the favicon, and force replaces what exists", async () => {
		const { siteDir } = site();
		const sketch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#00aa88"/></svg>`;
		await writeIconSet({ siteDir, name: "thing", tagline: "A thing", accent: "#2346d4", svg: sketch });
		const img = path.join(siteDir, "src", "assets", "img");
		assert.equal(readFileSync(path.join(img, ICON_FILES.svg), "utf8"), sketch);
		const again = await writeIconSet({ siteDir, name: "thing", tagline: "A thing", accent: "#2346d4", force: true });
		assert.equal(again.kept.length, 0);
	});

	test("a long name & tagline still fit the social image", async () => {
		const { siteDir } = site();
		await writeIconSet({
			siteDir,
			name: "markdown-it-anchor-sections-extended",
			tagline: "x".repeat(120),
			accent: "#2346d4",
		});
		const meta = await sharp(path.join(siteDir, "src", "assets", "img", ICON_FILES.social)).metadata();
		assert.equal(meta.width, 1200);
	});
});

describe("inspect", () => {
	test("a bare project asks once, then falls back to a wordmark", () => {
		const { siteDir } = site();
		const asked = inspect({ site: siteDir, userPresent: true });
		assert.equal(asked.action, "ask");
		assert.match(asked.question, /metaphors or visuals/);
		assert.equal(asked.missing.length, Object.keys(ICON_FILES).length);
		assert.equal(inspect({ site: siteDir, userPresent: true, concept: "yes" }).action, "propose");
		const fallback = inspect({ site: siteDir, userPresent: true, concept: "no" });
		assert.equal(fallback.action, "wordmark");
		assert.match(fallback.report, /say so in the report/);
		assert.equal(inspect({ site: siteDir, userPresent: false }).action, "wordmark");
	});

	test("favicon plus logo is kept", async () => {
		const { siteDir } = site({ accent: "#2346d4", logo: "logo.svg" });
		await writeIconSet({ siteDir, name: "thing", tagline: "A thing", accent: "#2346d4" });
		const img = path.join(siteDir, "src", "assets", "img");
		assert.equal(inspectMark(siteDir, { logo: "logo.svg" }).hasLogo, false);
		writeFileSync(path.join(img, "logo.svg"), "<svg/>");
		const state = inspect({ site: siteDir, userPresent: true });
		assert.equal(state.action, "keep");
		assert.deepEqual(state.missing, []);
	});
});
