import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import YAML from "yaml";

import { PLACEHOLDER_ACCENT, scaffold } from "../scripts/scaffold.js";
import { STUDIO_FILES, STUDIO_LOCK } from "../scripts/lib/layers.js";

function project() {
	const root = mkdtempSync(path.join(tmpdir(), "scaffold-"));
	writeFileSync(
		path.join(root, "package.json"),
		JSON.stringify({ name: "thing", repository: { url: "git+https://github.com/allonsy-studio/thing.git" } })
	);
	return root;
}

const statusOf = (result, suffix) => result.actions.find((a) => a.path.endsWith(suffix))?.status;

describe("scaffold", () => {
	test("creates the core, the landing flavor, the workflow & the project layer", () => {
		const root = project();
		const result = scaffold({ targetDir: "docs", root });
		for (const rel of [
			"docs/eleventy.config.js",
			"docs/src/index.md",
			"docs/src/_includes/layouts/base.webc",
			"docs/src/_includes/layouts/landing.webc",
			"docs/src/_components/studio-cta.webc",
			"docs/tests/brand.test.js",
			"docs/tests/studio.lock.json",
			".github/workflows/pages.yml",
			"docs/src/_data/project.json",
		]) {
			assert.ok(existsSync(path.join(root, rel)), rel);
		}
		assert.equal(result.flavor, "landing");
		assert.equal(statusOf(result, "src/_data/project.json"), "created (project layer)");
		const starter = JSON.parse(readFileSync(path.join(root, "docs/src/_data/project.json"), "utf8"));
		assert.deepEqual(starter, { accent: PLACEHOLDER_ACCENT, features: [], flavor: "landing" });
	});

	test("renders the repo name & site directory into the workflow, which stays valid YAML", () => {
		const root = project();
		scaffold({ targetDir: "site", root });
		const yml = readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
		assert.match(yml, /SITE_BASE: "\/thing\/"/);
		assert.match(yml, /pages-base-url: projects\.allons-y\.studio\/thing/);
		assert.match(yml, /folder: site\/_site/);
		assert.doesNotMatch(yml, /\{\{(REPO|SITE_DIR)\}\}/);
		const workflow = YAML.parse(yml);
		assert.deepEqual(Object.keys(workflow.jobs), ["production", "preview"]);
		assert.deepEqual(workflow.on.push.paths, ["site/**", "package.json", "yarn.lock", ".github/workflows/pages.yml"]);
		assert.match(yml, /yarn docs:test/);
	});

	test("is idempotent, keeps the project layer, and reports drift without overwriting", () => {
		const root = project();
		scaffold({ targetDir: "docs", root });
		const projectFile = path.join(root, "docs/src/_data/project.json");
		writeFileSync(projectFile, JSON.stringify({ accent: "#ffd23f", flavor: "landing" }));
		const layout = path.join(root, "docs/src/assets/css/layout.css");
		writeFileSync(layout, "/* edited */");

		const again = scaffold({ targetDir: "docs", root });
		assert.equal(statusOf(again, "src/_data/project.json"), "kept (project layer)");
		assert.equal(statusOf(again, "src/assets/css/reset.css"), "unchanged");
		assert.equal(statusOf(again, "src/assets/css/layout.css"), "drift");
		assert.equal(readFileSync(layout, "utf8"), "/* edited */");
		assert.deepEqual(again.lockedEdits, []);
		assert.equal(JSON.parse(readFileSync(projectFile, "utf8")).accent, "#ffd23f");

		const updated = scaffold({ targetDir: "docs", root, update: true });
		assert.equal(statusOf(updated, "src/assets/css/layout.css"), "updated");
		assert.notEqual(readFileSync(layout, "utf8"), "/* edited */");
	});

	test("an edited studio file is reported as a locked-file edit", () => {
		const root = project();
		scaffold({ targetDir: "docs", root });
		const cta = path.join(root, "docs", STUDIO_FILES.find((f) => f.endsWith("studio-cta.webc")));
		writeFileSync(cta, "<p>mine</p>");
		const result = scaffold({ targetDir: "docs", root });
		assert.deepEqual(result.lockedEdits, ["docs/src/_components/studio-cta.webc"]);
		assert.equal(statusOf(result, "studio-cta.webc"), "locked-file-modified");
		const fixed = scaffold({ targetDir: "docs", root, update: true });
		assert.equal(statusOf(fixed, "studio-cta.webc"), "updated");
		assert.ok(fixed.lockedEdits.length === 1, "the edit is still reported when restored");
	});

	test("the lock file is part of the locked layer", () => {
		const root = project();
		scaffold({ targetDir: "docs", root });
		writeFileSync(path.join(root, "docs", STUDIO_LOCK), "{}");
		assert.deepEqual(scaffold({ targetDir: "docs", root }).lockedEdits, ["docs/tests/studio.lock.json"]);
	});

	test("dry run writes nothing", () => {
		const root = project();
		const result = scaffold({ targetDir: "docs", root, dryRun: true });
		assert.ok(result.actions.length > 10);
		assert.ok(!existsSync(path.join(root, "docs")));
	});

	test("docs & workspaces are recognized but not yet built; unknown flavors fail", () => {
		const root = project();
		assert.throws(() => scaffold({ targetDir: "docs", root, flavor: "docs" }), /not yet built/);
		assert.throws(() => scaffold({ targetDir: "docs", root, flavor: "workspaces" }), /not yet built/);
		assert.throws(() => scaffold({ targetDir: "docs", root, flavor: "blog" }), /Unknown flavor/);
		assert.ok(!existsSync(path.join(root, "docs")));
	});

	test("explains a missing repository", () => {
		const root = mkdtempSync(path.join(tmpdir(), "scaffold-"));
		assert.throws(() => scaffold({ targetDir: "docs", root }), /No package.json/);
		writeFileSync(path.join(root, "package.json"), "{}");
		assert.throws(() => scaffold({ targetDir: "docs", root }), /no repository/);
		assert.doesNotThrow(() => scaffold({ targetDir: "docs", root, repo: "thing", dryRun: true }));
	});

	test("next steps name the dependencies & scripts the site needs", () => {
		const { next } = scaffold({ targetDir: "docs", root: project(), dryRun: true });
		const text = next.join("\n");
		for (const needle of ["@11ty/eleventy@", "axe-core@", "jsdom@", "docs:build", "docs:test", "scripts/mark.js", "scripts/audit.js"]) {
			assert.ok(text.includes(needle), needle);
		}
	});
});
