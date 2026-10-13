import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { readRepoFacts } from "../scripts/lib/facts.js";
import { chooseSite, suggestFlavor, suggestTooling } from "../scripts/lib/flavor.js";
import { suggest } from "../scripts/suggest.js";
import { makeRepo, REPOS } from "./helpers/repos.js";

const facts = (overrides = {}) => ({
	hasNestedDocsPages: false,
	isSingleAction: false,
	usesTypeScript: false,
	hasJavaScript: false,
	...overrides,
});

describe("suggestFlavor rules", () => {
	test("nested docs pages mean workspaces, ahead of every other rule", () => {
		assert.equal(suggestFlavor(facts({ hasNestedDocsPages: true, isSingleAction: true })).flavor, "workspaces");
	});

	test("a single action means landing", () => {
		assert.deepEqual(suggestFlavor(facts({ isSingleAction: true })), {
			flavor: "landing",
			reason: "One action, one page.",
		});
	});

	test("everything else is docs", () => {
		assert.deepEqual(suggestFlavor(facts()), { flavor: "docs", reason: "Default." });
	});
});

describe("suggestTooling rules", () => {
	test("TypeScript suggests typedoc, JavaScript suggests jsdoc, both can apply", () => {
		assert.deepEqual(suggestTooling(facts()), []);
		assert.deepEqual(suggestTooling(facts({ usesTypeScript: true })).map((t) => t.tool), ["typedoc"]);
		assert.deepEqual(suggestTooling(facts({ hasJavaScript: true })).map((t) => t.tool), ["jsdoc"]);
		assert.deepEqual(
			suggestTooling(facts({ usesTypeScript: true, hasJavaScript: true })).map((t) => t.tool),
			["typedoc", "jsdoc"]
		);
	});
});

describe("suggest, then confirm", () => {
	const single = facts({ isSingleAction: true, hasJavaScript: true });

	test("with a person present nothing is applied: it asks", () => {
		const result = chooseSite(single, { userPresent: true });
		assert.equal(result.status, "needs-confirmation");
		assert.equal(result.applied, false);
		assert.match(result.question, /Suggested flavor: landing/);
		assert.equal(result.built, true);
	});

	test("unattended applies the suggestion and lists it in the report", () => {
		const result = chooseSite(single, { userPresent: false });
		assert.equal(result.applied, true);
		assert.equal(result.listedInReport, true);
		assert.equal(result.confirmedBy, "unattended");
		assert.equal(result.flavor, "landing");
	});

	test("the maintainer can confirm or pick another flavor", () => {
		const picked = chooseSite(single, { userPresent: true, choice: "docs" });
		assert.equal(picked.flavor, "docs");
		assert.equal(picked.suggestedFlavor, "landing");
		assert.equal(picked.confirmedBy, "maintainer");
		assert.throws(() => chooseSite(single, { userPresent: true, choice: "blog" }), /Unknown flavor/);
	});

	test("docs and workspaces are recognized but reported as not yet built", () => {
		for (const flavor of ["docs", "workspaces"]) {
			const result = chooseSite(single, { userPresent: true, choice: flavor });
			assert.equal(result.built, false);
			assert.match(result.report, /not yet built/);
		}
		assert.equal(chooseSite(facts(), { userPresent: false }).built, false);
		assert.equal(chooseSite(single, { userPresent: true, choice: "landing" }).report, undefined);
	});
});

describe("the repositories in the architecture doc", () => {
	const expectations = {
		// Its JavaScript lives in scripts/, which is tooling, not a resource.
		"agent-skills": ["workspaces", []],
		opx: ["docs", ["typedoc"]],
		dashly: ["docs", ["jsdoc"]],
		envoy: ["landing", ["jsdoc"]],
		"glob-concat-cli": ["landing", ["jsdoc"]],
		"markdown-it-anchor-sections": ["landing", ["jsdoc"]],
	};
	for (const [name, [flavor, tools]] of Object.entries(expectations)) {
		test(`${name}: ${flavor}, tooling ${tools.join(" & ") || "none"}`, () => {
			const result = suggest({ repo: REPOS[name](), unattended: true });
			assert.equal(result.flavor, flavor);
			assert.deepEqual(result.tooling.map((t) => t.tool), tools);
		});
	}
});

describe("reading facts", () => {
	test("overrides replace the heuristics and are reported", () => {
		const root = REPOS.opx();
		const result = suggest({ repo: root, unattended: true, nestedDocs: "yes" });
		assert.equal(result.flavor, "workspaces");
		assert.deepEqual(result.signals.overridden, ["nestedDocsPages"]);
		assert.throws(() => suggest({ repo: root, nestedDocs: "maybe" }), /yes or no/);
	});

	test("a repository with workspaces is never a single action", () => {
		assert.equal(readRepoFacts(REPOS.opx()).isSingleAction, false);
	});

	test("a long README is not one-page material", () => {
		const root = REPOS.envoy();
		assert.equal(readRepoFacts(root).isSingleAction, true);
		assert.equal(readRepoFacts(root, { singleAction: false }).isSingleAction, false);
	});

	test("TypeScript is a tsconfig or .ts sources; .d.ts, tests & config files do not count", () => {
		const base = { "package.json": { name: "x" } };
		assert.equal(readRepoFacts(makeRepo({ ...base, "tsconfig.json": {} })).usesTypeScript, true);
		assert.equal(readRepoFacts(makeRepo({ ...base, "src/a.ts": "" })).usesTypeScript, true);
		const none = readRepoFacts(
			makeRepo({
				...base,
				"types/a.d.ts": "",
				"tests/a.test.js": "",
				"eslint.config.js": "",
				"scripts/build.js": "",
			})
		);
		assert.equal(none.usesTypeScript, false);
		assert.equal(none.hasJavaScript, false);
		assert.equal(readRepoFacts(makeRepo({ ...base, "src/a.mjs": "" })).hasJavaScript, true);
	});

	test("explains a missing package.json", () => {
		assert.throws(() => readRepoFacts("/nonexistent-path-for-test"), /No package.json/);
	});
});
