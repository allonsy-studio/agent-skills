import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { readProject, validateProject } from "../templates/core/lib/project.js";
import {
	buildSite,
	firstSentence,
	minimumVersion,
	normalizeRepository,
} from "../templates/core/lib/site.js";

const write = (dir, name, data) =>
	writeFileSync(path.join(dir, name), typeof data === "string" ? data : JSON.stringify(data));

const pkg = (overrides = {}) => ({
	name: "@allons-y/thing",
	description: "Does a thing. Quickly.",
	license: "MPL-2.0",
	repository: { type: "git", url: "git+https://github.com/allonsy-studio/thing.git" },
	engines: { node: ">=24" },
	...overrides,
});

function fixture(packageJson, project = { accent: "#2346d4" }) {
	const dir = mkdtempSync(path.join(tmpdir(), "site-"));
	write(dir, "package.json", packageJson);
	write(dir, "project.json", project);
	return { packagePath: path.join(dir, "package.json"), projectPath: path.join(dir, "project.json") };
}

describe("project layer validation", () => {
	test("accepts a minimal project", () => {
		assert.deepEqual(validateProject({ accent: "#2346d4" }), []);
	});

	test("reports every problem at once", () => {
		const problems = validateProject({
			accent: "blue",
			flavor: "blog",
			usage: { code: 1 },
			features: [{ title: "x" }],
			fonts: { mono: { family: "Fira" }, serif: { family: "X" }, sans: { weights: [50] } },
		});
		assert.ok(problems.some((p) => /accent/.test(p)));
		assert.ok(problems.some((p) => /flavor/.test(p)));
		assert.ok(problems.some((p) => /usage/.test(p)));
		assert.ok(problems.some((p) => /features\[0\] needs a body/.test(p)));
		assert.ok(problems.some((p) => /fonts\.mono is locked/.test(p)));
		assert.ok(problems.some((p) => /fonts\.serif is not a known role/.test(p)));
		assert.ok(problems.some((p) => /fonts\.sans needs a string family/.test(p)));
	});

	test("rejects non-objects", () => {
		assert.match(validateProject([])[0], /JSON object/);
	});

	test("readProject explains a missing or malformed file", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "project-"));
		assert.throws(() => readProject(path.join(dir, "none.json")), /No project file/);
		write(dir, "bad.json", "{");
		assert.throws(() => readProject(path.join(dir, "bad.json")), /not valid JSON/);
		write(dir, "invalid.json", { accent: "x" });
		assert.throws(() => readProject(path.join(dir, "invalid.json")), /1 problem/);
	});
});

describe("site facts from package.json", () => {
	test("reads the license instead of hard-coding it", () => {
		for (const license of ["MPL-2.0", "Apache-2.0"]) {
			const site = buildSite(fixture(pkg({ license })));
			assert.equal(site.license, license);
		}
	});

	test("derives name, repo, urls and node range", () => {
		const site = buildSite(fixture(pkg()));
		assert.equal(site.name, "thing");
		assert.equal(site.repo, "https://github.com/allonsy-studio/thing");
		assert.equal(site.url, "https://projects.allons-y.studio/thing/");
		assert.equal(site.node, "24+");
		assert.equal(site.tagline, "Does a thing");
		assert.equal(site.npm, "https://www.npmjs.com/package/@allons-y/thing");
	});

	test("private packages have no npm link", () => {
		assert.equal(buildSite(fixture(pkg({ private: true }))).npm, null);
	});

	test("fails with an actionable message when the license or description is missing", () => {
		assert.throws(() => buildSite(fixture(pkg({ license: undefined }))), /no `license`/);
		assert.throws(() => buildSite(fixture(pkg({ description: "" }))), /no `description`/);
	});

	test("project overrides win for tagline and url", () => {
		const site = buildSite(
			fixture(pkg(), { accent: "#2346d4", tagline: "Custom", url: "https://example.org/x" })
		);
		assert.equal(site.tagline, "Custom");
		assert.equal(site.url, "https://example.org/x/");
	});

	test("normalizes repository spellings", () => {
		for (const input of [
			"github:allonsy-studio/thing",
			"allonsy-studio/thing",
			"git+https://github.com/allonsy-studio/thing.git",
			"git://github.com/allonsy-studio/thing.git",
			"ssh://git@github.com/allonsy-studio/thing.git",
		]) {
			assert.equal(normalizeRepository(input), "https://github.com/allonsy-studio/thing", input);
		}
		assert.throws(() => normalizeRepository(undefined), /needs a `repository`/);
	});

	test("small helpers", () => {
		assert.equal(minimumVersion(">=24.0.0"), "24+");
		assert.equal(minimumVersion(undefined), null);
		assert.equal(firstSentence("One. Two."), "One");
	});
});
