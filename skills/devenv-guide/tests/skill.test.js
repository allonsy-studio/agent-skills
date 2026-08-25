import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { ACCENT_DECLARATION } from "../scripts/verify-guide.js";

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFileSync(join(skillRoot, ...parts), "utf8");

const skillMd = read("SKILL.md");
const frontmatter = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";

describe("SKILL.md", () => {
	test("starts with parseable frontmatter", () => {
		assert.ok(frontmatter, "SKILL.md must start with YAML frontmatter");
		assert.match(frontmatter, /^name:\s*devenv-guide$/m);
		assert.match(frontmatter, /^description:/m);
	});

	test("does not declare a license that contradicts the repository", () => {
		// Skills inherit the repository's MPL-2.0. None of them carry their own.
		assert.ok(
			!/^license:/m.test(frontmatter),
			"skills inherit the repository license; drop the frontmatter field"
		);
	});

	test("describes when to trigger, not only what it does", () => {
		const description = frontmatter.match(/^description:\s*(.+)$/m)[1];
		assert.match(description, /Use this whenever/);
		assert.match(description, /Trigger on phrases like/);
	});

	test("links only to reference files that exist", () => {
		const links = [...skillMd.matchAll(/`(references\/[\w-]+\.md)`/g)].map(
			(m) => m[1]
		);
		assert.ok(links.length > 0, "SKILL.md should point at its references");
		for (const link of new Set(links)) {
			assert.ok(existsSync(join(skillRoot, link)), `missing ${link}`);
		}
	});

	test("names only scripts that ship with the skill", () => {
		const named = [...skillMd.matchAll(/`?scripts\/([\w-]+\.js)`?/g)].map(
			(m) => m[1]
		);
		assert.ok(named.length > 0, "SKILL.md should point at its scripts");
		for (const script of new Set(named)) {
			assert.ok(
				existsSync(join(skillRoot, "scripts", script)),
				`SKILL.md names scripts/${script}, which does not exist`
			);
		}
	});

	test("keeps the property the guides depend on", () => {
		// Every step ends with a check, and troubleshooting is indexed by the
		// error text. If a future edit trades either away for brevity, the
		// output stops being useful at 11pm, which is when guides get read.
		assert.match(skillMd, /every step ends\s+with a check/);
		assert.match(skillMd, /indexed by the error text/);
	});
});

describe("reference files", () => {
	const references = readdirSync(join(skillRoot, "references"));

	test("every reference is linked from SKILL.md", () => {
		for (const file of references) {
			assert.ok(
				skillMd.includes(`references/${file}`),
				`references/${file} is not reachable from SKILL.md`
			);
		}
	});

	test("no reference points at a script that no longer exists", () => {
		for (const file of references) {
			const body = read("references", file);
			for (const [, script] of body.matchAll(/scripts\/([\w-]+\.(?:js|py))/g)) {
				assert.ok(
					existsSync(join(skillRoot, "scripts", script)),
					`references/${file} names scripts/${script}, which does not exist`
				);
			}
		}
	});

	test("the catalog hardcodes no version numbers", () => {
		// Version numbers go stale faster than this file gets updated, and a
		// wrong one sends readers to the wrong download. The skill fetches
		// current stable at build time instead.
		const catalog = read("references", "tool-catalog.md");
		const versions = [...catalog.matchAll(/\b(?:v|version )\d+\.\d+/gi)];
		assert.deepEqual(
			versions.map((m) => m[0]),
			[],
			"tool-catalog.md must not pin version numbers"
		);
	});
});

describe("assets", () => {
	test("the stylesheet carries both substitution points", () => {
		const css = read("assets", "guide.css");
		assert.match(
			css,
			ACCENT_DECLARATION,
			"guide.css must declare --accent for build-guide.js to rewrite"
		);
		assert.ok(
			css.includes("FOOTERTEXT"),
			"guide.css must expose a FOOTERTEXT token"
		);
	});

	test("the stylesheet is valid CSS on its own, with no leftover tokens", () => {
		// Everything except the footer string is a real value, so the file can
		// be linted and previewed without running the build first.
		const css = read("assets", "guide.css");
		assert.ok(!css.includes("ACCENT"), "no bare ACCENT token should remain");
		assert.match(css, /--accent:\s*#[0-9a-f]{6};/i);
	});

	test("the stylesheet styles every class the checks look for", () => {
		const css = read("assets", "guide.css");
		for (const cls of ["note", "warn", "stop", "ok", "done", "sym", "split"]) {
			assert.ok(
				new RegExp(`\\.${cls}\\b`).test(css),
				`guide.css has no rule for .${cls}`
			);
		}
	});
});

describe("evals", () => {
	const evals = JSON.parse(read("evals", "evals.json"));

	test("declares the skill it exercises", () => {
		assert.equal(evals.skill_name, "devenv-guide");
	});

	test("every eval has a unique id and a prompt", () => {
		const ids = new Set();
		for (const item of evals.evals) {
			assert.ok(item.prompt, `eval ${item.id} has no prompt`);
			assert.ok(item.expected_output, `eval ${item.id} has no expectation`);
			assert.ok(!ids.has(item.id), `duplicate eval id ${item.id}`);
			ids.add(item.id);
		}
	});

	test("covers triggering on phrasings that never say 'setup guide'", () => {
		// Skill descriptions under-trigger by default. The prompts that matter
		// are the ones a real person types, which rarely name the artifact.
		const oblique = evals.evals.filter(
			(e) => !/setup guide|install instructions/i.test(e.prompt)
		);
		assert.ok(
			oblique.length >= 2,
			"need at least two prompts that do not name the artifact"
		);
	});

	test("covers modifying an existing guide, the least tested path", () => {
		assert.ok(
			evals.evals.some((e) => /existing|last month|already|add .* to (the|our)/i.test(e.prompt)),
			"the description claims this skill modifies existing guides; eval it"
		);
	});

	test("includes a negative case, so triggering is discriminating", () => {
		assert.ok(
			evals.evals.some((e) => e.should_trigger === false),
			"need at least one tempting prompt that must NOT trigger the skill"
		);
	});
});
