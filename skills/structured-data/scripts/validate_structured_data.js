#!/usr/bin/env node
/**
 * validate_structured_data.js — CLI wrapper around structured-data-core.js.
 * Reads an HTML file and reports Microdata/JSON-LD structural problems.
 * Checks internal consistency (does the markup follow the spec's own rules),
 * NOT search-engine rich-result eligibility -- that changes independently of
 * the schema.org vocabulary and needs Google's Rich Results Test for a final
 * answer. Point the user there after this passes.
 *
 * Usage:
 *     node validate_structured_data.js --target page.html
 *
 * Requires: cheerio, jsonld (npm install cheerio jsonld)
 */

import { pathToFileURL } from "node:url";
import { parseArgs, readTextFileOrExit } from "./inject_microdata.js";
import { collectIssues } from "./structured-data-core.js";

// Re-export the core's pieces so existing importers keep working.
export {
	REQUIRED_PROPERTIES,
	offlineDocumentLoader,
	validateMicrodata,
	validateJsonLd,
	collectIssues,
} from "./structured-data-core.js";

/**
 * Validate an HTML string. Returns { errors, warnings, hasMicrodata,
 * hasJsonLd }. Thin alias for the core's collectIssues.
 */
export async function validate(html) {
	return collectIssues(html);
}

export async function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log("Usage: node validate_structured_data.js --target <path>");
		return;
	}
	const args = parseArgs(argv);
	if (!args.target) {
		console.error("Usage: node validate_structured_data.js --target <path>");
		process.exit(1);
	}

	const html = readTextFileOrExit(args.target, "target");
	const { errors, warnings, hasMicrodata, hasJsonLd } = await validate(html);

	if (!hasMicrodata && !hasJsonLd) {
		console.log("No Microdata or JSON-LD found in this file.");
		process.exit(1);
	}

	warnings.forEach((w) => console.log(`  warning: ${w}`));
	errors.forEach((e) => console.log(`  error: ${e}`));

	if (errors.length) {
		console.log(`\n${errors.length} error(s), ${warnings.length} warning(s). Structural validation FAILED.`);
		process.exit(1);
	}

	console.log(`\n${warnings.length} warning(s). Structural validation passed.`);
	console.log(
		"This checks internal consistency only -- run Google's Rich Results Test for actual search-eligibility confirmation."
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
	main();
}
