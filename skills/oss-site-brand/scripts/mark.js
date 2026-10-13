#!/usr/bin/env node
// Logo & favicon flow for a project site. Existing assets always win; when a
// mark is missing the maintainer is asked once for a concept, and with none
// (or nobody to ask) a wordmark is drawn. Never blocks the build.
//
// Usage:
//   node scripts/mark.js inspect  --site docs [--unattended] [--concept yes|no]
//   node scripts/mark.js wordmark --site docs [--force]
//   node scripts/mark.js icons    --site docs --svg path/to/chosen-mark.svg [--force]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { normalizeHex } from "../templates/core/lib/color.js";
import { readProject } from "../templates/core/lib/project.js";
import { buildSite } from "../templates/core/lib/site.js";
import {
	CONCEPT_QUESTION,
	decideMark,
	inspectMark,
	writeIconSet,
} from "./lib/mark.js";

/**
 * Read the facts a mark needs from a site directory.
 *
 * @param {string} siteDir
 */
function readFacts(siteDir) {
	const projectPath = path.join(siteDir, "src", "_data", "project.json");
	const project = readProject(projectPath);
	const site = buildSite({
		packagePath: path.join(siteDir, "..", "package.json"),
		projectPath,
	});
	return { project, site };
}

/**
 * @param {{ site: string, userPresent: boolean, concept?: "yes" | "no" }} options
 */
export function inspect({ site: siteDir, userPresent, concept }) {
	const { project } = readFacts(siteDir);
	const state = inspectMark(siteDir, project);
	const hasConcept = concept === undefined ? null : concept === "yes";
	const action = decideMark({
		hasFavicon: state.hasFavicon,
		hasLogo: state.hasLogo,
		userPresent,
		hasConcept,
	});
	return {
		action,
		question: action === "ask" ? CONCEPT_QUESTION : undefined,
		hasFavicon: state.hasFavicon,
		hasLogo: state.hasLogo,
		missing: state.missing,
		report:
			action === "wordmark"
				? "Wordmark fallback used: say so in the report."
				: undefined,
	};
}

async function main() {
	const [command, ...rest] = process.argv.slice(2);
	const { values } = parseArgs({
		args: rest,
		options: {
			site: { type: "string" },
			svg: { type: "string" },
			concept: { type: "string" },
			unattended: { type: "boolean", default: false },
			force: { type: "boolean", default: false },
		},
	});
	if (!command || !values.site) {
		console.error(
			"Usage: node scripts/mark.js <inspect|wordmark|icons> --site <site directory> [options]"
		);
		process.exit(2);
	}
	const siteDir = path.resolve(values.site);

	if (command === "inspect") {
		const result = inspect({
			site: siteDir,
			userPresent: !values.unattended,
			concept: values.concept,
		});
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	if (command === "wordmark" || command === "icons") {
		const { project, site } = readFacts(siteDir);
		let svg;
		if (command === "icons") {
			if (!values.svg) throw new Error("icons needs --svg <chosen mark>.");
			svg = readFileSync(path.resolve(values.svg), "utf8");
		}
		const result = await writeIconSet({
			siteDir,
			name: site.name,
			tagline: site.tagline,
			accent: normalizeHex(project.accent),
			project,
			svg,
			force: values.force,
		});
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	throw new Error(`Unknown command "${command}".`);
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
