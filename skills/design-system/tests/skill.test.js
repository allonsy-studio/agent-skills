import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(__dirname, "..");

test("SKILL.md exists and parses frontmatter", () => {
	const content = readFileSync(join(skillRoot, "SKILL.md"), "utf-8");
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	assert.ok(match, "SKILL.md must start with YAML frontmatter");

	const frontmatter = match[1];
	assert.match(frontmatter, /^name:\s*\S+/m, "frontmatter must declare `name`");
	assert.match(
		frontmatter,
		/^description:/m,
		"frontmatter must declare `description`"
	);
});
