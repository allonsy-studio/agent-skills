// Layer map shared by the scaffold and the audit: which template files are
// studio-locked, which flavors exist, and where each file lands in a project.
// The core & flavor template trees mirror the site directory 1:1.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	".."
);
export const TEMPLATES_DIR = path.join(SKILL_ROOT, "templates");
export const CORE_DIR = path.join(TEMPLATES_DIR, "core");
export const FLAVORS_DIR = path.join(TEMPLATES_DIR, "flavors");
export const WORKFLOW_TEMPLATE = path.join(TEMPLATES_DIR, "workflows", "pages.yml");

/** Flavors the skill recognizes, and whether templates exist for them. */
export const FLAVORS = Object.freeze({
	landing: { built: true },
	docs: { built: false },
	workspaces: { built: false },
});

/** Site-relative paths of the studio layer. Locked: never edited in a project. */
export const STUDIO_FILES = Object.freeze([
	"src/_components/studio-banner.webc",
	"src/_components/studio-cta.webc",
	"src/_components/studio-footer.webc",
	"src/_data/studio.js",
	"src/assets/css/studio.css",
	"src/assets/img/studio/oss-banner.svg",
	"src/assets/img/studio/oss-footer-dark.svg",
	"src/assets/img/studio/oss-footer-light.svg",
]);

/** Site-relative path of the hash file the audit checks the studio layer against. */
export const STUDIO_LOCK = "tests/studio.lock.json";

/** Packages the site build & its test suite need, with the ranges tested here. */
export const SITE_DEV_DEPENDENCIES = Object.freeze({
	"@11ty/eleventy": "^3.1.5",
	"@11ty/eleventy-plugin-webc": "^0.11.2",
	"axe-core": "^4.11.0",
	jsdom: "^29.1.1",
	prismjs: "^1.30.0",
});

/**
 * @param {string} dir
 * @returns {string[]} files under dir, as sorted forward-slash relative paths
 */
export function listFiles(dir) {
	const out = [];
	const walk = (current) => {
		for (const name of readdirSync(current).sort()) {
			const full = path.join(current, name);
			if (statSync(full).isDirectory()) walk(full);
			else out.push(path.relative(dir, full).split(path.sep).join("/"));
		}
	};
	walk(dir);
	return out;
}

/**
 * Template files for a flavor: the shared core plus the flavor's own files.
 *
 * @param {string} flavor
 * @param {{ coreDir?: string, flavorsDir?: string }} [dirs]
 * @returns {{ rel: string, source: string, layer: "core" | "flavor" }[]}
 */
export function templateFiles(
	flavor,
	{ coreDir = CORE_DIR, flavorsDir = FLAVORS_DIR } = {}
) {
	const files = listFiles(coreDir).map((rel) => ({
		rel,
		source: path.join(coreDir, rel),
		layer: /** @type {const} */ ("core"),
	}));
	const flavorDir = path.join(flavorsDir, flavor);
	return files.concat(
		listFiles(flavorDir).map((rel) => ({
			rel,
			source: path.join(flavorDir, rel),
			layer: /** @type {const} */ ("flavor"),
		}))
	);
}

/**
 * sha256 of each studio file, keyed by site-relative path.
 *
 * @param {(rel: string) => Buffer} read
 * @returns {Record<string, string>}
 */
export function hashStudioFiles(read) {
	const hashes = {};
	for (const rel of STUDIO_FILES) {
		hashes[rel] = createHash("sha256").update(read(rel)).digest("hex");
	}
	return hashes;
}

/** Serialized lock file for the shipped studio layer. */
export function studioLockContent(coreDir = CORE_DIR) {
	const hashes = hashStudioFiles((rel) =>
		readFileSync(path.join(coreDir, rel))
	);
	return JSON.stringify(hashes, null, "\t") + "\n";
}
