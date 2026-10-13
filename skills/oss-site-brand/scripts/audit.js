#!/usr/bin/env node
// Audit a built project site against the brand & accessibility baseline.
// Prints a report (with the final contrast hex values) and exits 1 on any
// failure. Build the site first.
//
// Usage:
//   node scripts/audit.js --site docs [--base /my-project/] [--json]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { formatReport, runChecks } from "../templates/core/tests/lib/checks.js";
import { loadSite } from "../templates/core/tests/lib/site.js";

/**
 * @param {{ site: string, base?: string }} options
 */
export async function audit({ site, base }) {
	const loaded = loadSite({ siteDir: path.resolve(site), base });
	const results = await runChecks(loaded);
	return { ok: results.every((r) => r.ok), results };
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const { values } = parseArgs({
			options: {
				site: { type: "string" },
				base: { type: "string" },
				json: { type: "boolean", default: false },
			},
		});
		if (!values.site) {
			console.error("Usage: node scripts/audit.js --site <site directory> [--base /path/] [--json]");
			process.exit(2);
		}
		const { ok, results } = await audit(values);
		console.log(values.json ? JSON.stringify({ ok, results }, null, 2) : formatReport(results));
		process.exitCode = ok ? 0 : 1;
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
