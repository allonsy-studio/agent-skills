import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { before, describe, test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Page backgrounds and the dark-mode button text, from `_includes/styles.css`. */
const LIGHT_SURFACE = "#fafafa";
const DARK_SURFACE = "#1a1a1a";
const DARK_INVERT_TEXT = "#39352d";
/** WCAG 2.2 AA minimum for normal text. */
const AA = 4.5;

/**
 * Relative luminance of a 6-digit hex color.
 * @param {string} hex
 * @returns {number}
 */
const luminance = (hex) => {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * WCAG contrast ratio between two hex colors.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const contrast = (a, b) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/**
 * Reads a custom property's hex value from the first `:root` block of a stylesheet.
 * @param {string} css
 * @param {string} name
 * @returns {string | undefined}
 */
const rootVar = (css, name) =>
	css.match(/:root\s*\{([^}]*)\}/)?.[1].match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];

describe("site theme: contrast (WCAG 2.2 AA)", () => {
	const light = fs.readFileSync(path.join(root, "docs", "skill.njk"), "utf8").match(/^\s+color: "(#[0-9a-fA-F]{6})"$/m)?.[1];

	for (const file of ["docs/skill.css", "docs/styles.css"]) {
		test(`${file} sets a dark-mode accent that meets AA with the site accent ${light}`, () => {
			const dark = rootVar(fs.readFileSync(path.join(root, file), "utf8"), "--base-dark");
			assert.ok(light && dark, `${file} needs --base-dark as a 6-digit hex`);
			assert.ok(contrast(light, LIGHT_SURFACE) >= AA, `${light} on ${LIGHT_SURFACE}`);
			assert.ok(contrast("#ffffff", light) >= AA, `white on ${light}`);
			assert.ok(contrast(dark, DARK_SURFACE) >= AA, `${dark} on ${DARK_SURFACE}`);
			assert.ok(contrast(DARK_INVERT_TEXT, dark) >= AA, `${DARK_INVERT_TEXT} on ${dark}`);
		});
	}
});

const themes = fs
	.readdirSync(path.join(root, "skills"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "theme.css")))
	.map((entry) => ({ name: entry.name, css: fs.readFileSync(path.join(root, "skills", entry.name, "theme.css"), "utf8") }));

describe("skill theme: contrast (WCAG 2.2 AA)", () => {
	for (const { name, css } of themes) {
		const light = rootVar(css, "--base");
		const dark = rootVar(css, "--base-dark");

		test(`${name}: sets --base and --base-dark on :root`, () => {
			assert.ok(light, "theme.css needs --base as a 6-digit hex");
			assert.ok(dark, "theme.css needs --base-dark as a 6-digit hex");
		});

		test(`${name}: light-mode accent is readable as text and under white button text`, () => {
			assert.ok(contrast(light, LIGHT_SURFACE) >= AA, `${light} on ${LIGHT_SURFACE}`);
			assert.ok(contrast("#ffffff", light) >= AA, `white on ${light}`);
		});

		test(`${name}: dark-mode accent is readable as text and under the dark button text`, () => {
			assert.ok(contrast(dark, DARK_SURFACE) >= AA, `${dark} on ${DARK_SURFACE}`);
			assert.ok(contrast(DARK_INVERT_TEXT, dark) >= AA, `${DARK_INVERT_TEXT} on ${dark}`);
		});
	}
});

describe("skill theme: rendered pages", () => {
	/** @type {Array<{ url: string, content: string }>} */
	let pages = [];

	before(() => {
		const cli = path.join(root, "node_modules", "@11ty", "eleventy", "cmd.cjs");
		assert.ok(fs.existsSync(cli), "run `yarn install` first: the Eleventy CLI is missing");
		const json = execFileSync(process.execPath, [cli, "--to=json", "--quiet"], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 64 * 1024 * 1024,
			stdio: ["ignore", "pipe", "ignore"],
		});
		pages = JSON.parse(json.slice(json.indexOf("["))).filter((page) => page.url.startsWith("/skills/"));
	});

	for (const { name, css } of themes) {
		test(`${name}: page includes its theme.css`, () => {
			const page = pages.find((p) => p.url === `/skills/${name}/`);
			assert.ok(page, `no page for ${name}`);
			assert.ok(page.content.includes(css.trim()), "theme.css is missing from the page");
		});
	}
});
