import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import YAML from "yaml";

import {
	CORE_DIR,
	FLAVORS,
	FLAVORS_DIR,
	listFiles,
	SKILL_ROOT,
	STUDIO_FILES,
	STUDIO_LOCK,
	studioLockContent,
	templateFiles,
	TEMPLATES_DIR,
	WORKFLOW_TEMPLATE,
} from "../scripts/lib/layers.js";
import { FLAVOR_NAMES } from "../templates/core/lib/project.js";
import { FORBIDDEN } from "../templates/core/tests/lib/checks.js";

const read = (...parts) => readFileSync(path.join(SKILL_ROOT, ...parts), "utf8");
const frontmatter = (text) => YAML.parse(/^---\n([\s\S]*?)\n---/.exec(text)[1]);

describe("SKILL.md", () => {
	const text = read("SKILL.md");
	const front = frontmatter(text);

	test("frontmatter follows the architecture guide", () => {
		assert.equal(front.name, "oss-site-brand");
		assert.ok(front.description.length <= 1024, `${front.description.length} chars`);
		assert.match(front.description, /Use whenever/);
		assert.match(front.description, /Do not trigger/);
		assert.doesNotMatch(front.description, /\b(I|you)\b/i);
	});

	test("the body is lean", () => {
		assert.ok(text.split("\n").length < 500);
	});

	test("every reference is linked and exists", () => {
		const linked = [...text.matchAll(/`(references\/[\w-]+\.md)`/g)].map((m) => m[1]);
		assert.ok(linked.length >= 6);
		for (const rel of linked) assert.ok(existsSync(path.join(SKILL_ROOT, rel)), rel);
		const files = listFiles(path.join(SKILL_ROOT, "references")).map((f) => `references/${f}`);
		for (const file of files) assert.ok(linked.includes(file), `${file} is not linked from SKILL.md`);
	});

	test("every script it tells the agent to run exists", () => {
		const scripts = new Set([...text.matchAll(/scripts\/([\w-]+\.js)/g)].map((m) => m[1]));
		assert.ok(scripts.size >= 4);
		for (const name of scripts) assert.ok(existsSync(path.join(SKILL_ROOT, "scripts", name)), name);
	});

	test("references over 100 lines open with a table of contents", () => {
		for (const file of listFiles(path.join(SKILL_ROOT, "references"))) {
			const body = read("references", file);
			if (body.split("\n").length > 100) assert.match(body, /## Contents/, file);
		}
	});

	test("prose uses colons rather than em dashes", () => {
		for (const file of ["SKILL.md", ...listFiles(path.join(SKILL_ROOT, "references")).map((f) => `references/${f}`)]) {
			assert.doesNotMatch(read(file), /—/, file);
		}
	});
});

describe("evals", () => {
	const evals = JSON.parse(read("evals", "evals.json"));
	test("name the skill and carry positives and tempting negatives", () => {
		assert.equal(evals.skill_name, "oss-site-brand");
		const positives = evals.evals.filter((e) => e.should_trigger !== false);
		const negatives = evals.evals.filter((e) => e.should_trigger === false);
		assert.ok(positives.length >= 2 && negatives.length >= 2);
		assert.equal(new Set(evals.evals.map((e) => e.id)).size, evals.evals.length);
	});
});

describe("layers", () => {
	test("flavor names agree between the project validator and the layer map", () => {
		assert.deepEqual(Object.keys(FLAVORS).sort(), [...FLAVOR_NAMES].sort());
	});

	test("only built flavors have template directories", () => {
		for (const [name, { built }] of Object.entries(FLAVORS)) {
			assert.equal(existsSync(path.join(FLAVORS_DIR, name)), built, name);
		}
	});

	test("every studio file exists in the core", () => {
		for (const rel of STUDIO_FILES) assert.ok(existsSync(path.join(CORE_DIR, rel)), rel);
	});

	test("the studio lock is current: run `yarn workspace @allons-y/skill-oss-site-brand lock`", () => {
		assert.equal(readFileSync(path.join(CORE_DIR, STUDIO_LOCK), "utf8"), studioLockContent());
	});

	test("core and flavor files never collide", () => {
		const rels = templateFiles("landing").map((f) => f.rel);
		assert.equal(new Set(rels).size, rels.length);
	});

	test("the Pages workflow template is valid YAML once its placeholders are filled", () => {
		const text = readFileSync(WORKFLOW_TEMPLATE, "utf8");
		assert.match(text, /\{\{REPO\}\}/);
		assert.match(text, /\{\{SITE_DIR\}\}/);
		assert.doesNotThrow(() => YAML.parse(text.replaceAll("{{REPO}}", "thing").replaceAll("{{SITE_DIR}}", "docs")));
	});
});

describe("the templates follow the brand rules", () => {
	const files = listFiles(TEMPLATES_DIR)
		.filter((f) => /\.(js|css|webc|md|yml|json|svg)$/.test(f))
		.filter((f) => !f.startsWith("core/tests/lib/checks.js"))
		.map((f) => [f, readFileSync(path.join(TEMPLATES_DIR, f), "utf8")]);

	test("no forbidden address or tag appears in any template", () => {
		for (const [file, text] of files) {
			for (const { pattern, label } of FORBIDDEN) {
				assert.doesNotMatch(text, pattern, `${file} contains ${label}`);
			}
		}
	});

	test("no template hard-codes a license", () => {
		const spdx = /\b(?:MPL-2\.0|Apache-2\.0|MIT|ISC|GPL-[23]\.0)\b/;
		for (const [file, text] of files) {
			if (file === "core/tests/lib/checks.js") continue;
			assert.doesNotMatch(text, spdx, file);
		}
	});

	test("the studio contact addresses are the three published ones", () => {
		const addresses = new Set(files.flatMap(([, text]) => text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []));
		assert.deepEqual([...addresses].sort(), ["contact@allons-y.studio"]);
	});

	test("the head partial has no twitter tags and links the icon set", () => {
		const head = readFileSync(path.join(CORE_DIR, "src/_components/site-head.webc"), "utf8");
		assert.doesNotMatch(head, /twitter/i);
		for (const needle of ["og:image", "theme-color", 'rel="canonical"', "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "manifest"]) {
			assert.ok(head.includes(needle), needle);
		}
	});

	test("no theme switcher", () => {
		for (const [file, text] of files) {
			assert.doesNotMatch(text, /theme-toggle|data-theme|color-scheme-switch/i, file);
		}
	});

	test("the Eleventy config uses the studio plugins", () => {
		const config = readFileSync(path.join(CORE_DIR, "eleventy.config.js"), "utf8");
		for (const needle of ["HtmlBasePlugin", "eleventy-plugin-webc", "highlight"]) {
			assert.ok(config.includes(needle), needle);
		}
	});
});

describe("package.json", () => {
	const pkg = JSON.parse(read("package.json"));
	test("is a private skill workspace with a node runtime", () => {
		assert.equal(pkg.private, true);
		assert.equal(pkg.name, "@allons-y/skill-oss-site-brand");
		assert.equal(pkg.skill.runtime, "node");
		assert.ok(pkg.skill.triggers.length >= 1);
	});
});
