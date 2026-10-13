// Test helper: scaffold a fixture project, draw its icons, & build the site
// with Eleventy. Builds live under node_modules/.cache so Node resolves the
// repository's packages from them, as it would in a real project.

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scaffold } from "../../scripts/scaffold.js";
import { writeIconSet } from "../../scripts/lib/mark.js";
import { normalizeHex } from "../../templates/core/lib/color.js";
import { buildSite } from "../../templates/core/lib/site.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(here, "..", "fixtures");
export const CACHE = path.join(here, "..", "..", "node_modules", ".cache", "brand-tests");
const require = createRequire(import.meta.url);
// The package's `exports` hide package.json; its entry lives in src/, the CLI beside it.
const eleventyBin = path.join(
	path.dirname(require.resolve("@11ty/eleventy")),
	"..",
	"cmd.cjs"
);

/**
 * Build a fixture project's site.
 *
 * @param {{
 *   name: string,
 *   fixture?: string,
 *   base?: string,
 *   package?: Record<string, unknown>,
 *   project?: Record<string, unknown>,
 *   icons?: boolean,
 *   edit?: (root: string) => void,
 * }} options name keeps parallel builds apart; edit runs after scaffold
 */
export async function buildFixtureSite({
	name,
	fixture = "landing",
	base = "/example-cli/",
	package: pkgOverrides = {},
	project: projectOverrides = {},
	icons = true,
	edit,
}) {
	const root = path.join(CACHE, name);
	rmSync(root, { recursive: true, force: true });
	mkdirSync(root, { recursive: true });

	const source = path.join(FIXTURES, fixture);
	const pkg = { ...JSON.parse(readFileSync(path.join(source, "package.json"), "utf8")), ...pkgOverrides };
	writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, "\t"));

	const result = scaffold({ targetDir: "docs", root, flavor: "landing" });
	const siteDir = path.join(root, "docs");
	const project = {
		...JSON.parse(readFileSync(path.join(source, "project.json"), "utf8")),
		flavor: "landing",
		...projectOverrides,
	};
	writeFileSync(
		path.join(siteDir, "src", "_data", "project.json"),
		JSON.stringify(project, null, "\t")
	);

	if (icons) {
		const projectPath = path.join(siteDir, "src", "_data", "project.json");
		const site = buildSite({ packagePath: path.join(root, "package.json"), projectPath });
		await writeIconSet({
			siteDir,
			name: site.name,
			tagline: site.tagline,
			accent: normalizeHex(project.accent),
			project,
		});
	}
	if (edit) edit(root);

	const run = spawnSync(
		process.execPath,
		[eleventyBin, "--config=docs/eleventy.config.js"],
		{ cwd: root, env: { ...process.env, SITE_BASE: base }, encoding: "utf8" }
	);
	if (run.status !== 0) {
		throw new Error(`Eleventy build failed for ${name}:\n${run.stdout}\n${run.stderr}`);
	}
	return { root, siteDir, outDir: path.join(siteDir, "_site"), base, scaffold: result };
}

/** Copy a built site so a test can break it without touching the shared build. */
export function copyBuild(build, name) {
	const target = path.join(CACHE, `${name}-copy`);
	rmSync(target, { recursive: true, force: true });
	cpSync(build.root, target, { recursive: true });
	return { ...build, root: target, siteDir: path.join(target, "docs"), outDir: path.join(target, "docs", "_site") };
}
