// Flavor & tooling suggestions. The skill suggests and never applies on a
// guess: the maintainer confirms or picks another. In an unattended run the
// suggestion is applied and listed in the report.

import { FLAVORS } from "./layers.js";

/**
 * @typedef {Object} Facts
 * @property {boolean} hasNestedDocsPages each workspace surfaced as its own product, a page each
 * @property {boolean} isSingleAction one command or function whose install & usage fit on one page
 * @property {boolean} usesTypeScript a tsconfig.json or .ts sources
 * @property {boolean} hasJavaScript .js or .mjs sources
 */

/**
 * Suggest a flavor. Nothing is applied until the maintainer confirms.
 *
 * @param {Facts} p
 * @returns {{ flavor: "workspaces" | "landing" | "docs", reason: string }}
 */
export function suggestFlavor(p) {
	if (p.hasNestedDocsPages) {
		return { flavor: "workspaces", reason: "Docs nest under workspaces." };
	}
	if (p.isSingleAction) {
		return { flavor: "landing", reason: "One action, one page." };
	}
	return { flavor: "docs", reason: "Default." };
}

/**
 * Tooling suggestions run beside the flavor suggestion.
 *
 * @param {Facts} p
 * @returns {{ tool: "typedoc" | "jsdoc", reason: string }[]}
 */
export function suggestTooling(p) {
	const tools = [];
	if (p.usesTypeScript) {
		tools.push({
			tool: "typedoc",
			reason: "TypeScript source: generate the API reference.",
		});
	}
	if (p.hasJavaScript) {
		tools.push({
			tool: "jsdoc",
			reason: "JavaScript resources: document them with JSDoc.",
		});
	}
	return tools;
}

/** The question put to the maintainer when someone is present. */
export function confirmationQuestion({ flavor, reason }) {
	return `Suggested flavor: ${flavor} (${reason}) Confirm, or pick landing, docs, or workspaces.`;
}

/**
 * Suggest, then confirm. Landing grows into Docs without a rewrite: same core.
 *
 * With a person present and no `choice`, nothing is applied: the result asks
 * for confirmation. A `choice` is the maintainer's answer (a confirmation or
 * another flavor). With nobody present the suggestion is applied and listed.
 *
 * @param {Facts} p
 * @param {{ userPresent: boolean, choice?: string }} ctx
 */
export function chooseSite(p, { userPresent, choice }) {
	const suggestion = { ...suggestFlavor(p), tooling: suggestTooling(p) };

	if (choice !== undefined) {
		if (!(choice in FLAVORS)) {
			throw new Error(
				`Unknown flavor "${choice}". Choose one of: ${Object.keys(FLAVORS).join(", ")}.`
			);
		}
		return withBuildStatus({
			...suggestion,
			flavor: choice,
			status: "applied",
			applied: true,
			confirmedBy: "maintainer",
			listedInReport: true,
			suggestedFlavor: suggestion.flavor,
		});
	}

	if (!userPresent) {
		return withBuildStatus({
			...suggestion,
			status: "applied",
			applied: true,
			confirmedBy: "unattended",
			listedInReport: true,
			suggestedFlavor: suggestion.flavor,
		});
	}

	return {
		...suggestion,
		status: "needs-confirmation",
		applied: false,
		built: FLAVORS[suggestion.flavor].built,
		question: confirmationQuestion(suggestion),
	};
}

/** Add whether templates exist for the flavor, and the report line when they do not. */
function withBuildStatus(result) {
	const built = FLAVORS[result.flavor].built;
	return {
		...result,
		built,
		...(built
			? {}
			: { report: `The ${result.flavor} flavor is not yet built: report it & stop.` }),
	};
}
