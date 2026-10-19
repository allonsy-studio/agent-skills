import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { before, describe, test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Escapes text once, as Nunjucks autoescaping does.
 * @param {string} text
 * @returns {string}
 */
const escapeOnce = (text) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

/**
 * Reads the captured attribute value from the first match of `tag`.
 * @param {string} html
 * @param {RegExp} tag
 * @returns {string | undefined}
 */
const contentOf = (html, tag) => html.match(tag)?.[1];

// Skill descriptions reach the page head through computed front matter in
// docs/skill.njk and are output again by _includes/foundation.njk. Escaping
// in both places shipped an apostrophe as `&amp;#39;` in link previews.
describe("skill page head", () => {
	/** @type {Array<{ url: string, content: string }>} */
	let pages = [];

	before(() => {
		// The CLI runs from the repo root, which Eleventy resolves every input path against.
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

	const skills = fs
		.readdirSync(path.join(root, "skills"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "package.json")))
		.map((entry) => ({
			name: entry.name,
			description: JSON.parse(fs.readFileSync(path.join(root, "skills", entry.name, "package.json"), "utf8")).description,
		}));

	test("renders a page for every skill", () => {
		assert.equal(pages.length, skills.length);
	});

	for (const { name, description } of skills) {
		test(`${name}: description meta tags escape the text exactly once`, () => {
			const page = pages.find((p) => p.url === `/skills/${name}/`);
			assert.ok(page, `no page for ${name}`);
			const expected = escapeOnce(description);
			assert.equal(contentOf(page.content, /<meta name="description" content="([^"]*)"/), expected);
			assert.equal(contentOf(page.content, /<meta property="og:description" content="([^"]*)"/), expected);
		});
	}

	test("never double-escapes anything in a skill page head", () => {
		for (const page of pages) {
			const head = page.content.split("</head>")[0];
			assert.doesNotMatch(head, /&amp;(#\d+|[a-z]+);/, `${page.url} has a double-escaped entity`);
		}
	});
});
