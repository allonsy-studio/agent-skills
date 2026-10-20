import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
	test("describes when to trigger and when not to", () => {
		assert.match(description, /Use this whenever/);
		assert.match(description, /Trigger on phrases like/);
		assert.match(description, /Do not trigger/);
	});

	test("does not tell the agent to read props from webc:setup", () => {
		for (const file of ["SKILL.md", ...references.map((f) => `references/${f}`)]) {
			assert.doesNotMatch(read(file), /`throw` in `webc:setup` when/, `${file} repeats the setup-throw advice`);
		}
	});

	test("says the later-bundled rule wins a specificity tie", () => {
		for (const file of ["SKILL.md", ...references.map((f) => `references/${f}`)]) {
			assert.doesNotMatch(read(file), /used first applies/, `${file} says the first-used component wins`);
		}
	});

	test("notes that webc:root=\"override\" replaces the host tag", () => {
		for (const file of ["SKILL.md", "references/webc-internals.md", "references/review-checklist.md"]) {
			assert.match(read(file), /webc:root="override"/, `${file} omits the override exception`);
		}
	});

	test("opens with a symptom lookup that points at one section per row", () => {
		const table = skillMd.split("## Symptom lookup")[1]?.split("\n## ")[0] ?? "";
		const rows = table.split("\n").filter((line) => line.startsWith("| ") && !/^\| (Symptom|---)/.test(line));
		assert.ok(rows.length >= 10, "the symptom lookup needs a row per common trap");
		for (const row of rows) {
			assert.match(row, /\| (review-checklist|internals) §\d+ \|$/, `no section cited: ${row}`);
		}
	});

	test("gives a render recipe so findings can be verified", () => {
		assert.match(skillMd, /^## Rendering a fixture$/m);
		assert.match(skillMd, /import \{ WebC \} from "@11ty\/webc"/);
		assert.match(skillMd, /\*\*not rendered\*\*/);
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

	test("conventions separate universal practices from decision points", () => {
		const conventions = read("references", "conventions.md");
		for (const heading of ["Universal practices", "Decision points", "Presets"]) {
			assert.match(conventions, new RegExp(`^## ${heading}$`, "m"), `missing "${heading}"`);
		}
	});

	test("prose avoids em dashes", () => {
		for (const file of ["SKILL.md", ...references.map((f) => `references/${f}`)]) {
			assert.ok(!read(file).includes("\u2014"), `${file} contains an em dash`);
		}
	});
});

describe("profiles", () => {
	const conventions = read("references", "conventions.md");
	const template = read("templates", "profile.md");
	const decisions = [...conventions.matchAll(/^### ([a-z-]+)$/gm)].map((m) => m[1]);

	/**
	 * Option letters a decision defines.
	 * @param {string} id
	 */
	const optionsOf = (id) => {
		const section = conventions.split(`### ${id}\n`)[1].split(/\n##/)[0];
		return new Set([...section.matchAll(/^- \*\*([a-z]):/gm)].map((m) => m[1]));
	};

	test("every decision point is in the summary table and has options", () => {
		assert.ok(decisions.length > 0, "no decision points found");
		for (const id of decisions) {
			assert.match(conventions, new RegExp(`^\\| \`${id}\` \\|`, "m"), `${id} missing from the summary table`);
			assert.ok(optionsOf(id).size >= 2, `${id} needs at least two options`);
		}
	});

	test("every preset picks a defined option for every decision", () => {
		const header = conventions.match(/^\| Decision \|(.+)$/m)[1];
		const presets = [...header.matchAll(/`([\w-]+)`/g)].map((m) => m[1]);
		assert.ok(presets.length >= 2, "need at least two presets");
		for (const id of decisions) {
			const row = conventions.match(new RegExp(`^\\| \`${id}\` \\| ([a-z]) \\| ([a-z]) \\| ([a-z]) \\|$`, "m"));
			assert.ok(row, `presets table has no row for ${id}`);
			for (const pick of row.slice(1)) {
				assert.ok(optionsOf(id).has(pick), `${id} has no option ${pick}`);
			}
		}
	});

	test("the template lists every decision with a valid default", () => {
		for (const id of decisions) {
			const pick = template.match(new RegExp(`^- ${id}: ([a-z])$`, "m"))?.[1];
			assert.ok(pick, `templates/profile.md is missing ${id}`);
			assert.ok(optionsOf(id).has(pick), `templates/profile.md picks undefined ${id}: ${pick}`);
		}
	});

	test("SKILL.md documents where a profile is found and saved", () => {
		assert.match(skillMd, /^## Profiles$/m);
		assert.match(skillMd, /templates\/profile\.md/);
		assert.match(skillMd, /`webc-components profile`/);
		assert.match(skillMd, /`profile\.md` in this skill's own directory/);
	});

	test("a saved profile file is never committed", () => {
		const gitignore = readFileSync(join(skillRoot, "..", "..", ".gitignore"), "utf8");
		assert.match(gitignore, /^skills\/webc-components\/profile\.md$/m);
	});
});

describe("README", () => {
	test("recommends a model for each kind of task", () => {
		const readme = read("README.md");
		assert.match(readme, /^## Choosing a model$/m);
		assert.match(readme, /Recommended: \*\*Claude \w+/);
	});
});

describe("site listing", () => {
	const pkg = JSON.parse(read("package.json"));

	test("lists the profile trigger the description advertises", () => {
		assert.match(description, /set up my WebC conventions/);
		assert.ok(pkg.skill.triggers.includes("set up my WebC conventions"), "package.json triggers feed the page's \"Try saying\" list");
	});

	test("the page summary mentions profiles", () => {
		assert.match(pkg.description, /profile/);
	});
});

describe("evals", () => {
	const evals = JSON.parse(read("evals", "evals.json"));

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

	test("covers setting up a profile", () => {
		assert.ok(
			evals.evals.some((e) => e.should_trigger !== false && /profile|conventions|preferences/i.test(e.expected_output) && /webc:scoped|conventions|preferences/i.test(e.prompt)),
			"need a positive prompt that sets up a profile"
		);
	});

	test("covers a prompt that never says WebC", () => {
		assert.ok(
			evals.evals.some((e) => e.should_trigger !== false && !/webc/i.test(e.prompt.replace(/\.webc/gi, ""))),
			"need a positive prompt that only shows .webc files"
		);
	});
});
