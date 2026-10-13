// Facts the flavor & tooling suggestions read from a repository. Everything
// here is a heuristic; the suggestion reports the signals it used so the
// maintainer can correct a wrong reading.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Directories never scanned for source files. */
const SKIPPED_DIRS = new Set([
	".git",
	".github",
	".yarn",
	"node_modules",
	"dist",
	"build",
	"coverage",
	"_site",
	// The brand site itself, test code & tooling are not the project's resources.
	"docs",
	"test",
	"tests",
	"__tests__",
	"scripts",
]);

/** Stop scanning after this many files: a safety net for very large repositories. */
const MAX_FILES_SCANNED = 20000;

/**
 * A project whose install & usage fit on one page has a short README. 200
 * lines is about four screens: past that the content wants a table of contents.
 */
const MAX_SINGLE_PAGE_README_LINES = 200;

/** A repo that already keeps more than a few docs pages is not one-page material. */
const MAX_SINGLE_PAGE_DOC_FILES = 3;

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Markdown files directly or deeply under a directory, up to a cap. */
function countMarkdown(dir) {
	if (!existsSync(dir)) return 0;
	let count = 0;
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			if (entry.name === "node_modules" || entry.name === "_site") continue;
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith(".md")) count += 1;
		}
	};
	walk(dir);
	return count;
}

/**
 * Expand workspace globs. Supports exact directories & a trailing `/*`, which
 * is all the workspaces in these repositories use.
 *
 * @param {string} root
 * @param {string[]} patterns
 * @returns {string[]} absolute member directories
 */
export function expandWorkspaces(root, patterns) {
	const dirs = [];
	for (const raw of patterns) {
		const pattern = raw.replace(/\/+$/, "");
		if (pattern === "." || pattern === "") continue;
		if (pattern.endsWith("/*") || pattern.endsWith("/**")) {
			const base = path.join(root, pattern.replace(/\/\*+$/, ""));
			if (!existsSync(base)) continue;
			for (const entry of readdirSync(base, { withFileTypes: true })) {
				if (entry.isDirectory() && existsSync(path.join(base, entry.name, "package.json"))) {
					dirs.push(path.join(base, entry.name));
				}
			}
		} else if (existsSync(path.join(root, pattern, "package.json"))) {
			dirs.push(path.join(root, pattern));
		}
	}
	return dirs;
}

/** Whether a workspace member is surfaced as its own page-worthy product. */
function hasOwnPage(dir) {
	return existsSync(path.join(dir, "SKILL.md")) || countMarkdown(path.join(dir, "docs")) > 0;
}

/**
 * Walk source files once and report what languages they use.
 *
 * @param {string} root
 */
export function scanSources(root) {
	let typescript = existsSync(path.join(root, "tsconfig.json"));
	let javascript = false;
	let scanned = 0;
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (scanned >= MAX_FILES_SCANNED || (typescript && javascript)) return;
			if (entry.isDirectory()) {
				if (!SKIPPED_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
				continue;
			}
			scanned += 1;
			const name = entry.name;
			if (/\.(ts|tsx|mts|cts)$/.test(name) && !name.endsWith(".d.ts")) {
				typescript = true;
			} else if (/\.(js|mjs)$/.test(name) && !/\.config\.(js|mjs)$/.test(name)) {
				javascript = true;
			}
		}
	};
	walk(root);
	return { typescript, javascript };
}

/** Number of commands a package exposes: bin entries, else exports, else main. */
function entryPointCount(pkg) {
	if (typeof pkg.bin === "string") return 1;
	if (pkg.bin && typeof pkg.bin === "object") return Object.keys(pkg.bin).length;
	if (pkg.exports && typeof pkg.exports === "object") {
		const keys = Object.keys(pkg.exports).filter((key) => key !== "./package.json");
		// A conditions-only exports object (`import`, `default`) is one entry.
		return keys.every((key) => key.startsWith(".")) ? keys.length : 1;
	}
	return pkg.main || pkg.module ? 1 : 0;
}

/**
 * Read the facts the flavor & tooling rules need.
 *
 * @param {string} repoRoot
 * @param {{ nestedDocsPages?: boolean, singleAction?: boolean }} [overrides]
 *   the maintainer's reading of the two judgment calls, when the heuristics are wrong
 * @returns {{
 *   name: string,
 *   workspaces: { dir: string, name: string, hasOwnPage: boolean }[],
 *   hasNestedDocsPages: boolean,
 *   isSingleAction: boolean,
 *   usesTypeScript: boolean,
 *   hasJavaScript: boolean,
 *   signals: Record<string, unknown>,
 * }}
 */
export function readRepoFacts(repoRoot, overrides = {}) {
	const root = path.resolve(repoRoot);
	const pkgFile = path.join(root, "package.json");
	if (!existsSync(pkgFile)) {
		throw new Error(`No package.json at ${root}. Run from the project root or pass --repo <path>.`);
	}
	const pkg = readJson(pkgFile);
	const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces?.packages ?? []);
	const members = expandWorkspaces(root, patterns);
	const workspaces = members.map((dir) => ({
		dir: path.relative(root, dir).split(path.sep).join("/"),
		name: readJson(path.join(dir, "package.json")).name ?? path.basename(dir),
		hasOwnPage: hasOwnPage(dir),
	}));

	const readme = ["README.md", "readme.md"].map((n) => path.join(root, n)).find(existsSync);
	const readmeLines = readme ? readFileSync(readme, "utf8").split("\n").length : 0;
	const docFiles = countMarkdown(path.join(root, "docs"));
	const entryPoints = entryPointCount(pkg);
	const sources = scanSources(root);

	const nestedHeuristic = workspaces.filter((w) => w.hasOwnPage).length >= 2;
	const singleHeuristic =
		workspaces.length === 0 &&
		entryPoints === 1 &&
		docFiles <= MAX_SINGLE_PAGE_DOC_FILES &&
		readmeLines <= MAX_SINGLE_PAGE_README_LINES;

	return {
		name: pkg.name ?? path.basename(root),
		workspaces,
		hasNestedDocsPages: overrides.nestedDocsPages ?? nestedHeuristic,
		isSingleAction: overrides.singleAction ?? singleHeuristic,
		usesTypeScript: sources.typescript,
		hasJavaScript: sources.javascript,
		signals: {
			workspaceCount: workspaces.length,
			workspacesWithOwnPage: workspaces.filter((w) => w.hasOwnPage).length,
			entryPoints,
			docFiles,
			readmeLines,
			tsconfig: existsSync(path.join(root, "tsconfig.json")),
			overridden: Object.keys(overrides).filter((key) => overrides[key] !== undefined),
		},
	};
}
