// The brand & accessibility baseline as a node:test suite. Projects run it
// against their built site (`yarn docs:test`); the skill runs the same suite
// against fixture builds.

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
	checkAccessibility,
	checkContrast,
	checkFlavor,
	checkForbidden,
	checkLicense,
	checkMetadata,
	checkStudioLayer,
	checkTypography,
} from "./checks.js";
import { loadSite } from "./site.js";

/**
 * @param {import("node:test").TestContext} t
 * @param {Awaited<ReturnType<typeof checkContrast>>} outcome
 */
function expectPass(t, outcome) {
	if (outcome.skipped) {
		t.skip(outcome.notes.join(" "));
		return;
	}
	for (const note of outcome.notes) t.diagnostic(note);
	assert.deepEqual(outcome.problems, [], `${outcome.title} failed:\n- ${outcome.problems.join("\n- ")}`);
}

/**
 * @param {Parameters<typeof loadSite>[0]} options
 */
export function defineBrandSuite(options) {
	describe("brand & accessibility baseline", () => {
		const site = loadSite(options);
		const areas = [
			["contrast meets 4.5:1 (3:1 large text) in light & dark", checkContrast],
			["axe-core, landmarks, skip link, headings, focus & reduced motion", checkAccessibility],
			["metadata & icon links resolve", checkMetadata],
			["studio layer is present & unmodified", checkStudioLayer],
			["typography: shared mono, swap, no unused fonts", checkTypography],
			["license is read from package.json", checkLicense],
			["no forbidden addresses or tags", checkForbidden],
			["flavor rules", checkFlavor],
		];
		for (const [name, check] of areas) {
			test(name, async (t) => expectPass(t, await check(site)));
		}
	});
}
