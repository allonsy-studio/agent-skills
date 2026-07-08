import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { loadConfig, injectMicrodata } from "../scripts/inject_microdata.js";
import {
	runnerImport,
	buildEleventyTest,
	buildComponentTest,
	buildTest,
	readVendorFiles,
} from "../scripts/scaffold_validation_test.js";

const here = dirname(fileURLToPath(import.meta.url));
const PRODUCT_HTML = fs.readFileSync(join(here, "fixtures", "product.html"), "utf8");
const TEMPLATE_CONFIG = join(here, "..", "assets", "selector-map-template.json");

test("runnerImport maps each supported runner and rejects others", () => {
	assert.match(runnerImport("node"), /from "node:test"/);
	assert.match(runnerImport("vitest"), /from "vitest"/);
	assert.match(runnerImport("jest"), /from "@jest\/globals"/);
	assert.throws(() => runnerImport("mocha"), /unknown --runner/);
});

test("eleventy test carries the runner import, site dir, and assert import", () => {
	const s = buildEleventyTest({ runner: "node", siteDir: "dist" });
	assert.match(s, /import \{ test \} from "node:test";/);
	assert.match(s, /const SITE_DIR = "dist";/);
	assert.match(s, /from "\.\/structured-data-assert\.js"/);
	assert.match(s, /run the 11ty build first/);
});

test("component test wires the chosen runner and render module", () => {
	const s = buildComponentTest({ runner: "vitest", renderModule: "../lib/ssr.js" });
	assert.match(s, /import \{ test \} from "vitest";/);
	assert.match(s, /from "\.\.\/lib\/ssr\.js"/);
	assert.match(s, /const CASES = \[/);
});

test("component test fails until CASES is configured (no silent green)", () => {
	const s = buildComponentTest({ runner: "node" });
	assert.match(s, /No component CASES configured/);
	assert.match(s, /throw new Error/);
});

test("buildTest rejects an unknown project type", () => {
	assert.throws(() => buildTest("angular", {}), /unknown --type/);
});

test("readVendorFiles returns core before assert, and core is the real validator", () => {
	const files = readVendorFiles();
	assert.deepEqual(
		files.map((f) => f.name),
		["structured-data-core.js", "structured-data-assert.js"]
	);
	assert.match(files[0].contents, /export async function collectIssues/);
	assert.match(files[1].contents, /export async function assertStructuredDataValid/);
});

test("vendored core+assert are self-contained and work when relocated", async () => {
	// Prove the consumer bundle stands alone: write the two files to a fresh
	// dir and drive them there. (Kept inside the repo tree so Node still
	// resolves cheerio/jsonld from the workspace's node_modules.)
	const files = readVendorFiles();
	const dir = fs.mkdtempSync(join(here, "vendor-"));
	try {
		for (const f of files) fs.writeFileSync(join(dir, f.name), f.contents);
		const mod = await import(pathToFileURL(join(dir, "structured-data-assert.js")).href);

		const good = injectMicrodata(PRODUCT_HTML, loadConfig(TEMPLATE_CONFIG));
		await mod.assertStructuredDataValid(good, { label: "relocated" });

		await assert.rejects(
			mod.assertStructuredDataValid(
				`<div itemscope itemtype="https://schema.org/Thing"></div><span itemprop="x">orphan</span>`
			),
			/orphan itemprop="x"/
		);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
