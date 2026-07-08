/**
 * structured-data-assert.js — a throw-based assertion wrapper around
 * structured-data-core.js, for dropping into a project's test suite.
 *
 * The throwing API is deliberately runner-agnostic: a thrown error fails a
 * test in node:test, vitest, and jest alike, so the same test body works under
 * any of them. Both this file and structured-data-core.js are vendored
 * together into a consumer project by the structured-data skill's
 * scaffold_validation_test.js; the relative import below resolves in both the
 * skill and the consumer because the two files always travel together.
 */

import { collectIssues } from "./structured-data-core.js";

export { collectIssues };

/**
 * Assert that an HTML string carries no invalid structured data.
 *
 * @param {string} html - the rendered/built HTML to check.
 * @param {object} [opts]
 * @param {boolean} [opts.allowWarnings=true] - when false, warnings fail too.
 * @param {string}  [opts.label] - identifier (file path, component name) shown
 *                                 in the thrown message.
 * @returns {Promise<{hasMicrodata: boolean, hasJsonLd: boolean}>}
 * @throws {Error} if the markup has structural problems. A page with no
 *                 structured data at all is a no-op, not a failure.
 */
export async function assertStructuredDataValid(html, opts = {}) {
	const { allowWarnings = true, label } = opts;
	const { errors, warnings, hasMicrodata, hasJsonLd } = await collectIssues(html);

	if (!hasMicrodata && !hasJsonLd) return { hasMicrodata, hasJsonLd };

	const problems = allowWarnings ? errors : [...errors, ...warnings];
	if (problems.length) {
		const where = label ? ` (${label})` : "";
		throw new Error(`Invalid structured data${where}:\n  - ${problems.join("\n  - ")}`);
	}

	return { hasMicrodata, hasJsonLd };
}
