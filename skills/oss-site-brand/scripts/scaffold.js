#!/usr/bin/env node
// Copy the shared core & one flavor into a project and report what happened.
// Safe to re-run:
//
//   - Missing files are created.
//   - Files that match are left alone.
//   - Files that differ are reported as drift & kept, unless --update is
//     passed. Studio files that differ are always reported as locked-file
//     edits: the studio layer never changes per project.
//   - The project layer (src/_data/project.json & the icon files) is never
//     overwritten.
//
// Usage:
//   node scripts/scaffold.js --target docs [--flavor landing] [--accent "#2346d4"]
//                            [--repo name] [--update] [--dry-run] [--json]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
	CORE_DIR,
	FLAVORS,
	FLAVORS_DIR,
	SITE_DEV_DEPENDENCIES,
	STUDIO_FILES,
	STUDIO_LOCK,
	templateFiles,
	WORKFLOW_TEMPLATE,
} from "./lib/layers.js";

/** Accent written to a new project.json until the maintainer picks one. */
export const PLACEHOLDER_ACCENT = "#2346d4";

const posix = (p) => p.split(path.sep).join("/");

/**
 * @param {{
 *   targetDir: string,
 *   root?: string,
 *   flavor?: string,
 *   repo?: string,
 *   accent?: string,
 *   update?: boolean,
 *   dryRun?: boolean,
 *   coreDir?: string,
 *   flavorsDir?: string,
 *   workflowTemplate?: string,
 * }} options
 * @returns {{
 *   flavor: string,
 *   actions: { path: string, status: string }[],
 *   lockedEdits: string[],
 *   next: string[],
 * }}
 */
export function scaffold({
	targetDir,
	root = process.cwd(),
	flavor = "landing",
	repo,
	accent = PLACEHOLDER_ACCENT,
	update = false,
	dryRun = false,
	coreDir = CORE_DIR,
	flavorsDir = FLAVORS_DIR,
	workflowTemplate = WORKFLOW_TEMPLATE,
}) {
	if (!(flavor in FLAVORS)) {
		throw new Error(
			`Unknown flavor "${flavor}". Choose one of: ${Object.keys(FLAVORS).join(", ")}.`
		);
	}
	if (!FLAVORS[flavor].built) {
		throw new Error(
			`The ${flavor} flavor is not yet built. Only: ${Object.keys(FLAVORS)
				.filter((name) => FLAVORS[name].built)
				.join(", ")}.`
		);
	}

	const repoRoot = path.resolve(root);
	const siteDir = path.resolve(repoRoot, targetDir);
	const siteRel = posix(path.relative(repoRoot, siteDir));
	const repoName = repo ?? readRepoName(repoRoot);
	const studio = new Set([...STUDIO_FILES, STUDIO_LOCK]);
	const actions = [];
	const lockedEdits = [];

	const put = (dest, content, { locked = false } = {}) => {
		const rel = posix(path.relative(repoRoot, dest));
		if (!existsSync(dest)) {
			write(dest, content, dryRun);
			actions.push({ path: rel, status: "created" });
			return;
		}
		if (readFileSync(dest).equals(content)) {
			actions.push({ path: rel, status: "unchanged" });
			return;
		}
		if (locked) lockedEdits.push(rel);
		if (update) {
			write(dest, content, dryRun);
			actions.push({ path: rel, status: "updated" });
		} else {
			actions.push({
				path: rel,
				status: locked ? "locked-file-modified" : "drift",
			});
		}
	};

	for (const { rel, source } of templateFiles(flavor, { coreDir, flavorsDir })) {
		put(path.join(siteDir, rel), readFileSync(source), {
			locked: studio.has(rel),
		});
	}

	const workflow = readFileSync(workflowTemplate, "utf8")
		.replaceAll("{{REPO}}", repoName)
		.replaceAll("{{SITE_DIR}}", siteRel);
	put(
		path.join(repoRoot, ".github", "workflows", "pages.yml"),
		Buffer.from(workflow)
	);

	// Project layer: created once, then owned by the maintainer.
	const projectFile = path.join(siteDir, "src", "_data", "project.json");
	const projectRel = posix(path.relative(repoRoot, projectFile));
	if (existsSync(projectFile)) {
		actions.push({ path: projectRel, status: "kept (project layer)" });
	} else {
		const starter = { accent, features: [], flavor };
		write(
			projectFile,
			Buffer.from(JSON.stringify(starter, null, "\t") + "\n"),
			dryRun
		);
		actions.push({ path: projectRel, status: "created (project layer)" });
	}

	const next = [
		`Add devDependencies: ${Object.entries(SITE_DEV_DEPENDENCIES)
			.map(([name, range]) => `${name}@${range}`)
			.join(", ")}.`,
		`Add scripts: "docs:build": "eleventy --config=${siteRel}/eleventy.config.js", "docs:start": "eleventy --serve --config=${siteRel}/eleventy.config.js", "docs:test": "node --test ${siteRel}/tests/".`,
		`Fill ${siteRel}/src/_data/project.json (accent, lede, install, usage, features).`,
		`Make the icon set: node scripts/mark.js --site ${siteRel} (see references/logo-and-favicon.md).`,
		`Audit the build: node scripts/audit.js --site ${siteRel}.`,
	];
	return { flavor, actions, lockedEdits, next };
}

function write(dest, content, dryRun) {
	if (dryRun) return;
	mkdirSync(path.dirname(dest), { recursive: true });
	writeFileSync(dest, content);
}

/** Repository name from the project's package.json, for the Pages path. */
function readRepoName(repoRoot) {
	const file = path.join(repoRoot, "package.json");
	if (!existsSync(file)) {
		throw new Error(
			`No package.json at ${repoRoot}. Pass --repo <name>, or run from a project with a package.json.`
		);
	}
	const pkg = JSON.parse(readFileSync(file, "utf8"));
	const raw =
		typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
	if (!raw) {
		throw new Error(`${file} has no repository. Pass --repo <name> or add one.`);
	}
	return raw.replace(/\.git$/, "").split("/").pop();
}

function main() {
	const { values } = parseArgs({
		options: {
			target: { type: "string" },
			flavor: { type: "string", default: "landing" },
			accent: { type: "string" },
			repo: { type: "string" },
			root: { type: "string" },
			update: { type: "boolean", default: false },
			"dry-run": { type: "boolean", default: false },
			json: { type: "boolean", default: false },
		},
	});
	if (!values.target) {
		console.error(
			"Usage: node scripts/scaffold.js --target <site directory, e.g. docs> [--flavor landing] [--accent #hex] [--repo name] [--update] [--dry-run] [--json]"
		);
		process.exit(2);
	}
	const result = scaffold({
		targetDir: values.target,
		root: values.root,
		flavor: values.flavor,
		repo: values.repo,
		accent: values.accent,
		update: values.update,
		dryRun: values["dry-run"],
	});
	if (values.json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		for (const { path: p, status } of result.actions) {
			console.log(`${status.padEnd(24)} ${p}`);
		}
		if (result.lockedEdits.length) {
			console.log(
				`\nStudio files differ from the locked originals: ${result.lockedEdits.join(", ")}`
			);
		}
		console.log(`\nNext:\n${result.next.map((n) => `- ${n}`).join("\n")}`);
	}
	if (result.lockedEdits.length && !values.update) process.exitCode = 1;
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
