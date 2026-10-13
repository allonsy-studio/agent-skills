#!/usr/bin/env node
// Suggest a site flavor & documentation tooling from the repository. Prints
// JSON. Nothing is applied on a guess: with a person present the result asks
// for confirmation; pass --choose with their answer, or --unattended to apply
// the suggestion & list it in the report.
//
// Usage:
//   node scripts/suggest.js [--repo .] [--unattended] [--choose landing|docs|workspaces]
//                           [--nested-docs yes|no] [--single-action yes|no]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { readRepoFacts } from "./lib/facts.js";
import { chooseSite } from "./lib/flavor.js";

/** @param {string | undefined} value `yes`, `no`, or unset */
function yesNo(value) {
	if (value === undefined) return undefined;
	if (value === "yes") return true;
	if (value === "no") return false;
	throw new Error(`Expected yes or no, found "${value}".`);
}

/**
 * @param {{
 *   repo?: string,
 *   unattended?: boolean,
 *   choose?: string,
 *   nestedDocs?: string,
 *   singleAction?: string,
 * }} options
 */
export function suggest({
	repo = ".",
	unattended = false,
	choose,
	nestedDocs,
	singleAction,
}) {
	const facts = readRepoFacts(repo, {
		nestedDocsPages: yesNo(nestedDocs),
		singleAction: yesNo(singleAction),
	});
	const result = chooseSite(facts, { userPresent: !unattended, choice: choose });
	return { project: facts.name, signals: facts.signals, ...result };
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const { values } = parseArgs({
			options: {
				repo: { type: "string" },
				unattended: { type: "boolean", default: false },
				choose: { type: "string" },
				"nested-docs": { type: "string" },
				"single-action": { type: "string" },
			},
		});
		console.log(
			JSON.stringify(
				suggest({
					repo: values.repo,
					unattended: values.unattended,
					choose: values.choose,
					nestedDocs: values["nested-docs"],
					singleAction: values["single-action"],
				}),
				null,
				2
			)
		);
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
