import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { SKILL_ROOT } from "../scripts/lib/layers.js";
import { buildFixtureSite } from "./helpers/build-site.js";
import { makeRepo, REPOS } from "./helpers/repos.js";

const run = (script, args, options = {}) =>
	spawnSync(process.execPath, [path.join(SKILL_ROOT, "scripts", script), ...args], {
		encoding: "utf8",
		...options,
	});

describe("suggest.js", () => {
	test("asks for confirmation when a person is present", () => {
		const out = run("suggest.js", ["--repo", REPOS.envoy()]);
		assert.equal(out.status, 0);
		const result = JSON.parse(out.stdout);
		assert.equal(result.status, "needs-confirmation");
		assert.equal(result.flavor, "landing");
	});

	test("applies the maintainer's choice, and unattended runs list the suggestion", () => {
		const repo = REPOS.envoy();
		assert.equal(JSON.parse(run("suggest.js", ["--repo", repo, "--choose", "docs"]).stdout).flavor, "docs");
		assert.equal(JSON.parse(run("suggest.js", ["--repo", repo, "--unattended"]).stdout).listedInReport, true);
	});

	test("fails with a message on a bad repository or answer", () => {
		const missing = run("suggest.js", ["--repo", path.join(tmpdir(), "no-such-repo-xyz")]);
		assert.equal(missing.status, 1);
		assert.match(missing.stderr, /No package\.json/);
		assert.equal(run("suggest.js", ["--repo", REPOS.envoy(), "--single-action", "maybe"]).status, 1);
	});
});

describe("scaffold.js", () => {
	test("needs a target", () => {
		const out = run("scaffold.js", []);
		assert.equal(out.status, 2);
		assert.match(out.stderr, /Usage/);
	});

	test("prints a dry-run plan as JSON, and a readable plan with next steps", () => {
		const root = makeRepo({ "package.json": { name: "thing", repository: "allonsy-studio/thing" } });
		const json = run("scaffold.js", ["--target", "docs", "--dry-run", "--json"], { cwd: root });
		assert.equal(json.status, 0);
		assert.equal(JSON.parse(json.stdout).flavor, "landing");
		const text = run("scaffold.js", ["--target", "docs", "--dry-run"], { cwd: root });
		assert.match(text.stdout, /created {18}docs\/eleventy\.config\.js/);
		assert.match(text.stdout, /Next:/);
	});

	test("refuses a flavor that is not yet built", () => {
		const root = makeRepo({ "package.json": { name: "thing", repository: "allonsy-studio/thing" } });
		const out = run("scaffold.js", ["--target", "docs", "--flavor", "docs"], { cwd: root });
		assert.equal(out.status, 1);
		assert.match(out.stderr, /not yet built/);
	});

	test("exits 1 when a studio file was edited", () => {
		const root = makeRepo({ "package.json": { name: "thing", repository: "allonsy-studio/thing" } });
		run("scaffold.js", ["--target", "docs"], { cwd: root });
		writeFileSync(path.join(root, "docs/src/_components/studio-banner.webc"), "x");
		const out = run("scaffold.js", ["--target", "docs"], { cwd: root });
		assert.equal(out.status, 1);
		assert.match(out.stdout, /Studio files differ/);
	});
});

describe("mark.js", () => {
	const setup = () => {
		const root = makeRepo({
			"package.json": {
				name: "@allons-y/thing",
				description: "A thing.",
				license: "MPL-2.0",
				repository: "allonsy-studio/thing",
			},
			"docs/src/_data/project.json": { accent: "#2346d4" },
		});
		return path.join(root, "docs");
	};

	test("inspect, then wordmark writes the icon set", () => {
		const site = setup();
		const inspected = JSON.parse(run("mark.js", ["inspect", "--site", site]).stdout);
		assert.equal(inspected.action, "ask");
		const made = JSON.parse(run("mark.js", ["wordmark", "--site", site]).stdout);
		assert.ok(made.written.includes("favicon.svg"));
		assert.equal(JSON.parse(run("mark.js", ["inspect", "--site", site, "--unattended"]).stdout).action, "wordmark");
	});

	test("icons needs a sketch, and unknown commands fail", () => {
		const site = setup();
		assert.match(run("mark.js", ["icons", "--site", site]).stderr, /needs --svg/);
		assert.match(run("mark.js", ["dance", "--site", site]).stderr, /Unknown command/);
		assert.equal(run("mark.js", []).status, 2);
	});
});

describe("audit.js", () => {
	test("passes on a good build and fails, naming the problem, on a broken one", async () => {
		const good = await buildFixtureSite({ name: "cli-good", base: "/example-cli/" });
		const ok = run("audit.js", ["--site", good.siteDir, "--base", "/example-cli/"]);
		assert.equal(ok.status, 0, ok.stdout);
		assert.match(ok.stdout, /PASS {2}Studio layer/);
		assert.equal(JSON.parse(run("audit.js", ["--site", good.siteDir, "--base", "/example-cli/", "--json"]).stdout).ok, true);

		const bad = await buildFixtureSite({
			name: "cli-bad",
			base: "/example-cli/",
			edit: (root) =>
				writeFileSync(path.join(root, "docs/src/_components/studio-cta.webc"), "<p>contact@allons-y.studio</p>"),
		});
		const failed = run("audit.js", ["--site", bad.siteDir, "--base", "/example-cli/"]);
		assert.equal(failed.status, 1);
		assert.match(failed.stdout, /FAIL {2}Studio layer/);
	});

	test("needs a site, and says when there is no build", () => {
		assert.equal(run("audit.js", []).status, 2);
		const empty = mkdtempSync(path.join(tmpdir(), "audit-"));
		mkdirSync(path.join(empty, "docs"));
		writeFileSync(path.join(empty, "package.json"), "{}");
		const out = run("audit.js", ["--site", path.join(empty, "docs")]);
		assert.equal(out.status, 1);
		assert.match(out.stderr, /No built site/);
	});
});
