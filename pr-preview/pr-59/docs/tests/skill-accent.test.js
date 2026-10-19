import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { before, describe, test } from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "skill.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true }).compile(schema);

/**
 * Reads `theme.color` and `theme.colorDark` from a page template's front matter.
 * @param {string} file
 * @returns {{ color: string, colorDark: string }}
 */
const themeOf = (file) => {
	const front = fs.readFileSync(path.join(root, file), "utf8").split("---")[1];
	return {
		color: front.match(/^\s+color: "(#[0-9a-fA-F]{6})"$/m)?.[1],
		colorDark: front.match(/^\s+colorDark: "(#[0-9a-fA-F]{6})"$/m)?.[1],
	};
};

/** Site default accent pair, from the skill page template. */
const SITE = themeOf("docs/skill.njk");
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

const skills = fs
	.readdirSync(path.join(root, "skills"), { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "package.json")))
	.map((entry) => ({
		name: entry.name,
		skill: JSON.parse(fs.readFileSync(path.join(root, "skills", entry.name, "package.json"), "utf8")).skill ?? {},
	}));

const base = { runtime: "node", category: "Design", triggers: ["x"] };

describe("skill accent: schema", () => {
	test("accepts a hex accent with its dark-mode partner", () => {
		assert.ok(validate({ ...base, accent: "#3a7d1e", accentDark: "#8bc34a" }));
	});

	test("rejects anything but a 6-digit hex", () => {
		for (const accent of ["green", "#3a7", "rgb(0,0,0)", "#3a7d1e; color: red"]) {
			assert.ok(!validate({ ...base, accent, accentDark: "#8bc34a" }), `accepted ${accent}`);
		}
	});

	test("requires both colors together", () => {
		assert.ok(!validate({ ...base, accent: "#3a7d1e" }), "accent without accentDark");
		assert.ok(!validate({ ...base, accentDark: "#8bc34a" }), "accentDark without accent");
	});
});

describe("site accent: contrast (WCAG 2.2 AA)", () => {
	for (const file of ["docs/index.njk", "docs/skill.njk"]) {
		test(`${file} sets a light and dark accent that meet AA`, () => {
			const { color, colorDark } = themeOf(file);
			assert.ok(color && colorDark, `${file} needs theme.color and theme.colorDark`);
			assert.ok(contrast(color, LIGHT_SURFACE) >= AA, `${color} on ${LIGHT_SURFACE}`);
			assert.ok(contrast("#ffffff", color) >= AA, `white on ${color}`);
			assert.ok(contrast(colorDark, DARK_SURFACE) >= AA, `${colorDark} on ${DARK_SURFACE}`);
			assert.ok(contrast(DARK_INVERT_TEXT, colorDark) >= AA, `${DARK_INVERT_TEXT} on ${colorDark}`);
		});
	}
});

describe("skill accent: contrast (WCAG 2.2 AA)", () => {
	for (const { name, skill } of skills.filter((s) => s.skill.accent)) {
		test(`${name}: light-mode accent is readable as text and under white button text`, () => {
			assert.ok(contrast(skill.accent, LIGHT_SURFACE) >= AA, `${skill.accent} on ${LIGHT_SURFACE}`);
			assert.ok(contrast("#ffffff", skill.accent) >= AA, `white on ${skill.accent}`);
		});

		test(`${name}: dark-mode accent is readable as text and under the dark button text`, () => {
			assert.ok(contrast(skill.accentDark, DARK_SURFACE) >= AA, `${skill.accentDark} on ${DARK_SURFACE}`);
			assert.ok(contrast(DARK_INVERT_TEXT, skill.accentDark) >= AA, `${DARK_INVERT_TEXT} on ${skill.accentDark}`);
		});
	}
});

describe("skill accent: rendered pages", () => {
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

	for (const { name, skill } of skills) {
		test(`${name}: page uses ${skill.accent ? "its own accent" : "the site accent"}`, () => {
			const page = pages.find((p) => p.url === `/skills/${name}/`);
			assert.ok(page, `no page for ${name}`);
			assert.match(page.content, new RegExp(`--base: ${skill.accent ?? SITE.color};`));
			assert.match(page.content, new RegExp(`name="theme-color" content="${skill.accent ?? SITE.color}"`));
			assert.match(page.content, new RegExp(`--base-dark: ${skill.accentDark ?? SITE.colorDark};`));
		});
	}
});
