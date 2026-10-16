import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFileSync(join(skillRoot, ...parts), "utf8");

const skillMd = read("SKILL.md");
const frontmatter = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? "";
const references = readdirSync(join(skillRoot, "references"));

describe("SKILL.md", () => {
	test("starts with parseable frontmatter", () => {
		assert.ok(frontmatter, "SKILL.md must start with YAML frontmatter");
		assert.match(frontmatter, /^name:\s*webc-components$/m);
		assert.match(frontmatter, /^description:/m);
	});

	test("keeps the description within the 1024-character limit", () => {
		assert.ok(description.length > 0, "description is empty");
		assert.ok(description.length <= 1024, `description is ${description.length} chars`);
	});

	test("describes when to trigger and when not to", () => {
		assert.match(description, /Use this whenever/);
		assert.match(description, /Trigger on phrases like/);
		assert.match(description, /Do not trigger/);
	});

	test("keeps the body under 500 lines", () => {
		assert.ok(skillMd.split("\n").length < 500);
	});

	test("links only to reference files that exist", () => {
		const links = [...skillMd.matchAll(/`(references\/[\w-]+\.md)`/g)].map((m) => m[1]);
		assert.ok(links.length > 0, "SKILL.md should point at its references");
		for (const link of new Set(links)) {
			assert.ok(existsSync(join(skillRoot, link)), `missing ${link}`);
		}
	});

	test("cites only checklist and internals sections that exist", () => {
		const count = (file) => [...read("references", file).matchAll(/^## \d+\./gm)].length;
		const sections = {
			"review-checklist": count("review-checklist.md"),
			internals: count("webc-internals.md"),
		};
		for (const [, file, n] of skillMd.matchAll(/(review-checklist|internals) §(\d+)/g)) {
			assert.ok(Number(n) <= sections[file], `${file} §${n} does not exist`);
		}
	});
});

describe("reference files", () => {
	test("every reference is linked from SKILL.md", () => {
		for (const file of references) {
			assert.ok(skillMd.includes(`references/${file}`), `references/${file} is not reachable from SKILL.md`);
		}
	});

	test("every reference over 100 lines has a table of contents", () => {
		for (const file of references) {
			const body = read("references", file);
			if (body.split("\n").length > 100) {
				assert.match(body, /^## Contents$/m, `references/${file} needs a table of contents`);
			}
		}
	});

	test("every table-of-contents anchor resolves to a heading", () => {
		/** @param {string} heading */
		const slug = (heading) =>
			heading
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.trim()
				.replace(/\s/g, "-");
		for (const file of references) {
			const body = read("references", file);
			const anchors = new Set([...body.matchAll(/^#{2,3} (.+)$/gm)].map((m) => slug(m[1])));
			for (const [, anchor] of body.matchAll(/\]\(#([\w-]+)\)/g)) {
				assert.ok(anchors.has(anchor), `references/${file} links to missing #${anchor}`);
			}
		}
	});

	test("cross-references between references point at real sections", () => {
		const internals = [...read("references", "webc-internals.md").matchAll(/^## (\d+)\./gm)].length;
		for (const file of references) {
			for (const [, n] of read("references", file).matchAll(/internals §(\d+)/g)) {
				assert.ok(Number(n) <= internals, `references/${file} cites internals §${n}`);
			}
		}
	});

	test("the internals keep their source citations and verified markers", () => {
		const internals = read("references", "webc-internals.md");
		assert.match(internals, /\*\*verified\*\*/i);
		assert.match(internals, /\w+\.(?:js|cjs):\d+/);
	});

	test("conventions are labelled as opinion, not WebC fact", () => {
		assert.match(read("references", "conventions.md"), /opinions, not WebC facts/);
	});

	test("prose avoids em dashes", () => {
		for (const file of ["SKILL.md", ...references.map((f) => `references/${f}`)]) {
			assert.ok(!read(file).includes("\u2014"), `${file} contains an em dash`);
		}
	});
});

describe("evals", () => {
	const evals = JSON.parse(read("evals", "evals.json"));

	test("declares the skill it exercises", () => {
		assert.equal(evals.skill_name, "webc-components");
	});

	test("every eval has a unique id, a prompt, and an expectation", () => {
		const ids = new Set();
		for (const item of evals.evals) {
			assert.ok(item.prompt, `eval ${item.id} has no prompt`);
			assert.ok(item.expected_output, `eval ${item.id} has no expectation`);
			assert.ok(!ids.has(item.id), `duplicate eval id ${item.id}`);
			ids.add(item.id);
		}
	});

	test("has at least two positive and two negative cases", () => {
		const negatives = evals.evals.filter((e) => e.should_trigger === false);
		assert.ok(negatives.length >= 2, "need at least two negative cases");
		assert.ok(evals.evals.length - negatives.length >= 2, "need at least two positive cases");
	});

	test("covers the four verified review traps", () => {
		const prompts = evals.evals.map((e) => e.prompt).join("\n");
		assert.match(prompts, /<slot>[^<]+<\/slot>/, "whitespace-defeated slot fallback");
		assert.match(prompts, /:is\(ul, ol\)/, "leaking container selector");
		assert.match(prompts, /@[\w-]+="false"/, '"false"-is-truthy boolean prop');
		assert.match(prompts, /:style="[^"]*undefined/, ":style undefined crash");
	});

	test("covers a prompt that never says WebC", () => {
		assert.ok(
			evals.evals.some((e) => e.should_trigger !== false && !/webc/i.test(e.prompt.replace(/\.webc/gi, ""))),
			"need a positive prompt that only shows .webc files"
		);
	});
});
