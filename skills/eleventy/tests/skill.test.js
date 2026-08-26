import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(__dirname, "..");
const skillMd = readFileSync(join(skillRoot, "SKILL.md"), "utf-8");

/** @returns {string} the YAML frontmatter block of SKILL.md */
function frontmatter() {
	const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	assert.ok(match, "SKILL.md must start with YAML frontmatter");
	return match[1];
}

test("SKILL.md frontmatter declares name matching the directory", () => {
	const fm = frontmatter();
	const name = fm.match(/^name:\s*(\S+)/m);
	assert.ok(name, "frontmatter must declare `name`");
	assert.equal(name[1], basename(skillRoot), "`name` must match directory name");
});

test("SKILL.md frontmatter declares a description under 1024 characters", () => {
	const fm = frontmatter();
	assert.match(fm, /^description:/m, "frontmatter must declare `description`");
	const description = fm
		.split(/^description:\s*>?\s*$/m)[1]
		?.split(/^\S/m)[0];
	assert.ok(description, "description block must have content");
	assert.ok(
		description.replace(/\s+/g, " ").trim().length <= 1024,
		"description must be ≤ 1024 characters",
	);
});

test("every references/ link in SKILL.md resolves to a real file", () => {
	const links = [...skillMd.matchAll(/\((\.\/references\/[\w-]+\.md)\)/g)].map(
		(m) => m[1],
	);
	assert.ok(links.length > 0, "SKILL.md must link at least one reference");
	for (const link of links) {
		assert.ok(
			existsSync(join(skillRoot, link)),
			`linked reference must exist: ${link}`,
		);
	}
});

test("every file in references/ is linked from SKILL.md", () => {
	const files = readdirSync(join(skillRoot, "references")).filter((f) =>
		f.endsWith(".md"),
	);
	for (const file of files) {
		assert.ok(
			skillMd.includes(`references/${file}`),
			`orphaned reference not linked from SKILL.md: ${file}`,
		);
	}
});

test("reference files over 100 lines carry a table of contents", () => {
	const files = readdirSync(join(skillRoot, "references")).filter((f) =>
		f.endsWith(".md"),
	);
	for (const file of files) {
		const content = readFileSync(join(skillRoot, "references", file), "utf-8");
		if (content.split("\n").length > 100) {
			assert.match(
				content,
				/^## Contents$/m,
				`${file} exceeds 100 lines and must have a "## Contents" section`,
			);
		}
	}
});

test("cross-reference mentions between reference files resolve", () => {
	const refDir = join(skillRoot, "references");
	for (const file of readdirSync(refDir).filter((f) => f.endsWith(".md"))) {
		const content = readFileSync(join(refDir, file), "utf-8");
		for (const [, target] of content.matchAll(/`([\w-]+\.md)`/g)) {
			assert.ok(
				existsSync(join(refDir, target)),
				`${file} mentions missing reference: ${target}`,
			);
		}
	}
});
