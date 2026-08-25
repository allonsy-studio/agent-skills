import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import { parseFrontmatter } from "../../scripts/parse-skills.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const skillsDir = path.join(root, "skills");

const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "skill.schema.json"), "utf8"));
const validateSkill = new Ajv2020({ allErrors: true }).compile(schema);

const skillNames = fs
	.readdirSync(skillsDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

const read = (skill, ...parts) => fs.readFileSync(path.join(skillsDir, skill, ...parts), "utf8");
const exists = (skill, ...parts) => fs.existsSync(path.join(skillsDir, skill, ...parts));

test("there is at least one skill to validate", () => {
	assert.ok(skillNames.length > 0, "expected skills/ to contain skill directories");
});

// Every claim the marketplace "Built to be trusted" section makes about skills
// is enforced here, so the landing page can never assert something the repo
// doesn't actually guarantee. A new skill that skips tests, evals, or the
// metadata contract fails CI rather than silently making the page lie.
describe("skill contract", () => {
	for (const skill of skillNames) {
		describe(skill, () => {
			const pkg = JSON.parse(read(skill, "package.json"));

			test("declares a `skill` block that satisfies the schema", () => {
				assert.ok(pkg.skill, "package.json is missing the `skill` block");
				const valid = validateSkill(pkg.skill);
				assert.ok(
					valid,
					`skill metadata is invalid:\n${(validateSkill.errors ?? [])
						.map((e) => `  ${e.instancePath || "/"} ${e.message}`)
						.join("\n")}`
				);
			});

			test("package name matches the directory", () => {
				assert.equal(pkg.name, `@allons-y/skill-${skill}`);
			});

			test("ships a SKILL.md whose frontmatter name matches the directory", () => {
				assert.ok(exists(skill, "SKILL.md"), "missing SKILL.md");
				const front = parseFrontmatter(read(skill, "SKILL.md"));
				assert.equal(front.name, skill, "SKILL.md frontmatter `name` must match the directory");
				assert.ok(front.description, "SKILL.md frontmatter is missing a description");
			});

			test('backs the "every skill tested" claim with a test suite', () => {
				assert.ok(exists(skill, "tests"), "missing tests/ directory");
				const hasTestFile = fs
					.readdirSync(path.join(skillsDir, skill, "tests"))
					.some((f) => f.endsWith(".test.js"));
				assert.ok(hasTestFile, "tests/ has no *.test.js files");
			});

			test('backs the "eval-backed" claim with an evals suite', () => {
				assert.ok(exists(skill, "evals", "evals.json"), "missing evals/evals.json");
			});
		});
	}
});
