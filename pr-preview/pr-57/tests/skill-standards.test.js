import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { parseFrontmatter } from "../scripts/parse-skills.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(root, "skills");

const skillNames = fs
	.readdirSync(skillsDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
	.map((entry) => entry.name);

/**
 * List every markdown file under a skill's references directory, relative to it.
 * @param {string} skillDir
 */
const referenceFiles = (skillDir) => {
	const dir = path.join(skillDir, "references");
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { recursive: true })
		.filter((file) => String(file).endsWith(".md"))
		.map((file) => path.join("references", String(file)));
};

// Rules every skill follows, whatever its topic. A skill that cannot meet one
// fails here, so change the rule or the skill, not the test for one skill.
describe("skill standards", () => {
	for (const skill of skillNames) {
		describe(skill, () => {
			const skillDir = path.join(skillsDir, skill);
			const skillMd = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
			const body = skillMd.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
			const references = referenceFiles(skillDir);

			test("keeps the description within the 1024-character limit", () => {
				const description = parseFrontmatter(skillMd).description ?? "";
				assert.ok(description.length > 0, "description is empty");
				assert.ok(description.length <= 1024, `description is ${description.length} chars`);
			});

			test("keeps the body under 500 lines", () => {
				assert.ok(skillMd.split("\n").length < 500, "SKILL.md is 500 lines or more");
			});

			test("uses no in-page heading links, which the site does not render", () => {
				assert.doesNotMatch(body, /\]\(#[\w-]+\)/, "write 'see the X section' instead of [X](#x)");
			});

			test("numbers ordered lists from 1", () => {
				assert.doesNotMatch(body, /^0\. /m);
			});

			test("links only to local files that exist", () => {
				const links = [...body.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)].map((m) => m[1].split("#")[0]);
				for (const link of new Set(links)) {
					assert.ok(fs.existsSync(path.join(skillDir, link)), `SKILL.md links to missing ${link}`);
				}
			});

			test("every reference file is reachable from SKILL.md through other references", () => {
				const mentions = (text) => [...text.matchAll(/([\w./-]+\.md)\b/g)].map((m) => m[1]);
				const reached = new Set();
				const visit = (text, dir) => {
					for (const token of mentions(text)) {
						for (const candidate of [path.normalize(path.join(dir, token)), path.normalize(token)]) {
							if (reached.has(candidate) || !references.includes(candidate)) continue;
							reached.add(candidate);
							visit(fs.readFileSync(path.join(skillDir, candidate), "utf8"), path.dirname(candidate));
						}
					}
					for (const [, token] of text.matchAll(/([\w./-]+\/)(?=[\s`)])/g)) {
						const prefix = path.normalize(path.join(dir, token)).replace(/[\\/]+$/, "") + path.sep;
						for (const file of references) {
							if (file.startsWith(prefix) && !reached.has(file)) {
								reached.add(file);
								visit(fs.readFileSync(path.join(skillDir, file), "utf8"), path.dirname(file));
							}
						}
					}
				};
				visit(body, ".");
				for (const file of references) {
					assert.ok(reached.has(file), `${file} is not reachable from SKILL.md`);
				}
			});

			test("has an evals file that names the skill and gives every case an id, prompt, and expectation", () => {
				const evals = JSON.parse(fs.readFileSync(path.join(skillDir, "evals", "evals.json"), "utf8"));
				assert.equal(evals.skill_name, skill, "evals/evals.json skill_name must match the directory");
				const ids = new Set();
				for (const item of evals.evals) {
					assert.ok(item.prompt, `eval ${item.id} has no prompt`);
					assert.ok(item.expected_output, `eval ${item.id} has no expectation`);
					assert.ok(!ids.has(item.id), `duplicate eval id ${item.id}`);
					ids.add(item.id);
				}
			});
		});
	}
});
