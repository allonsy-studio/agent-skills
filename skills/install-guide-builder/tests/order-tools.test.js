import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	DEFAULT_MANAGER,
	MANAGERS,
	TOOLS,
	formatCatalog,
	formatReport,
	main,
	resolve,
	warnings,
} from "../scripts/order-tools.js";

/** Collect what `main` writes, so the CLI is exercised without a subprocess. */
function capture(argv) {
	const out = [];
	const err = [];
	const code = main(argv, {
		log: (s) => out.push(s),
		error: (s) => err.push(s),
	});
	return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("the catalog", () => {
	test("every prerequisite is itself a catalog entry", () => {
		for (const [name, [, , requires]] of Object.entries(TOOLS)) {
			for (const pre of requires) {
				assert.ok(TOOLS[pre], `${name} requires unknown tool "${pre}"`);
			}
		}
	});

	test("a prerequisite never sits above its dependent", () => {
		for (const [name, [layer, , requires]] of Object.entries(TOOLS)) {
			for (const pre of requires) {
				assert.ok(
					TOOLS[pre][0] <= layer,
					`${pre} (layer ${TOOLS[pre][0]}) must not come after ${name} (layer ${layer})`
				);
			}
		}
	});

	test("every managed runtime has a default manager that manages it", () => {
		for (const [runtime, managers] of Object.entries(MANAGERS)) {
			assert.ok(
				managers.includes(DEFAULT_MANAGER[runtime]),
				`default manager for ${runtime} is not in its manager list`
			);
		}
	});
});

describe("resolve", () => {
	test("pulls in prerequisites transitively", () => {
		// gh -> git -> vscode, none of which were asked for.
		const { ordered, added } = resolve(["gh"], "macos");
		assert.deepEqual(ordered, ["vscode", "git", "gh"]);
		assert.deepEqual([...added].sort(), ["git", "vscode"]);
	});

	test("orders by layer, then by the reader's own selection order", () => {
		const { ordered } = resolve(["postgres", "node", "docker"], "macos");
		assert.deepEqual(ordered, [
			"xcode-clt",
			"homebrew",
			"node",
			"postgres",
			"docker",
		]);
	});

	test("puts a prerequisite before its dependent in the same layer", () => {
		// Git and the GitHub CLI are both layer 3, and Git is the one the reader
		// did not name. Sorting by layer and selection order alone emits `gh`
		// first, which is an install order that cannot be followed.
		const { ordered } = resolve(["gh", "git"], "macos");
		assert.ok(ordered.indexOf("git") < ordered.indexOf("gh"));
	});

	test("does not hang on a selection whose prerequisites are all present", () => {
		const { ordered } = resolve(
			["gh", "git", "vscode", "postgres", "homebrew"],
			"macos"
		);
		assert.equal(new Set(ordered).size, ordered.length);
		assert.equal(ordered.length, 6);
	});

	test("skips a prerequisite that does not apply to the target OS", () => {
		// PHP requires Homebrew, but Homebrew is macOS/Linux only.
		const { ordered } = resolve(["php"], "windows");
		assert.deepEqual(ordered, ["php"]);

		const macos = resolve(["php"], "macos");
		assert.deepEqual(macos.ordered, ["xcode-clt", "homebrew", "php"]);
	});

	test("drops a chosen tool that does not apply to the target OS", () => {
		const { ordered } = resolve(["scoop", "git"], "macos");
		assert.ok(!ordered.includes("scoop"));
		assert.deepEqual(ordered, ["vscode", "git"]);
	});

	test('"all" keeps every platform-specific tool', () => {
		const { ordered } = resolve(["scoop", "homebrew"], "all");
		assert.ok(ordered.includes("scoop"));
		assert.ok(ordered.includes("homebrew"));
	});

	test("marks only the tools it added, not the ones chosen", () => {
		const { added } = resolve(["homebrew", "postgres"], "macos");
		assert.ok(!added.has("homebrew"), "homebrew was chosen, not added");
		assert.ok(added.has("xcode-clt"));
	});

	test("is deterministic across runs", () => {
		const once = resolve(["postgres", "mysql", "redis"], "macos").ordered;
		const twice = resolve(["postgres", "mysql", "redis"], "macos").ordered;
		assert.deepEqual(once, twice);
	});
});

describe("warnings", () => {
	test("flags a runtime picked with no version manager", () => {
		const out = warnings(["node"], "macos");
		assert.equal(out.length, 1);
		assert.match(out[0], /no version manager/);
		assert.match(out[0], /nvm/);
	});

	test("flags two managers for one runtime", () => {
		const out = warnings(["node", "nvm", "fnm"], "macos").filter((w) =>
			/Two managers/.test(w)
		);
		assert.equal(out.length, 1);
		assert.match(out[0], /nvm, fnm/);
	});

	test("stays quiet when exactly one manager is picked", () => {
		assert.deepEqual(warnings(["node", "nvm"], "macos"), []);
	});

	test("warns about the nvm Windows split", () => {
		const out = warnings(["node", "nvm"], "windows");
		assert.ok(out.some((w) => /coreybutler\/nvm-windows/.test(w)));
		assert.ok(out.some((w) => /uninstall any Node/.test(w)));
	});

	test("does not raise the Windows nvm split on a macOS-only guide", () => {
		assert.deepEqual(warnings(["node", "nvm"], "macos"), []);
	});

	test("warns when uv and a python.org Python are both selected", () => {
		const out = warnings(["python", "uv"], "macos");
		assert.ok(out.some((w) => /do NOT also send readers to python\.org/.test(w)));
	});

	test("offers mise once three or more runtimes are selected", () => {
		const out = warnings(
			["node", "nvm", "python", "uv", "go"],
			"macos"
		).filter((w) => /Offer mise/.test(w));
		assert.equal(out.length, 1);
		assert.match(out[0], /^3 runtimes/);
	});

	test("does not offer mise when mise is already selected", () => {
		const out = warnings(["node", "python", "go", "mise"], "macos");
		assert.ok(!out.some((w) => /Offer mise/.test(w)));
	});
});

describe("formatReport", () => {
	test("marks prerequisites the reader did not choose", () => {
		const report = formatReport(["postgres"], "macos");
		assert.match(report, /Homebrew\s+layer 1\s+<- prerequisite, not chosen/);
		assert.match(report, /PostgreSQL\s+layer 6$/m);
		assert.match(report, /why the reader is installing something they did not ask for/);
	});

	test("omits the prerequisite note when nothing was added", () => {
		const report = formatReport(["sqlite"], "macos");
		assert.ok(!report.includes("prerequisite, not chosen"));
		assert.ok(!report.includes("did not ask for"));
	});

	test("ignores tools that are not in the catalog", () => {
		const report = formatReport(["sqlite", "cobol"], "macos");
		assert.match(report, /SQLite/);
		assert.ok(!report.includes("cobol"));
	});
});

describe("formatCatalog", () => {
	test("lists every tool exactly once, grouped by layer", () => {
		const catalog = formatCatalog();
		for (const name of Object.keys(TOOLS)) {
			assert.ok(
				new RegExp(`\\b${name.replace(/[+]/g, "\\+")}\\b`).test(catalog),
				`${name} missing from the catalog listing`
			);
		}
		assert.match(catalog, /Managers group with their runtime/);
	});
});

describe("the CLI", () => {
	test("prints the catalog when given no tools", () => {
		const { code, out } = capture([]);
		assert.equal(code, 0);
		assert.match(out, /Known tools, by layer/);
	});

	test("--list prints the catalog even with tools named", () => {
		const { code, out } = capture(["node", "--list"]);
		assert.equal(code, 0);
		assert.match(out, /Known tools, by layer/);
	});

	test("--help prints usage", () => {
		const { code, out } = capture(["--help"]);
		assert.equal(code, 0);
		assert.match(out, /Usage: node scripts\/order-tools\.js/);
	});

	test("resolves a selection", () => {
		const { code, out } = capture(["postgres", "--os", "macos"]);
		assert.equal(code, 0);
		assert.match(out, /Install order {2}\(os: macos\)/);
		assert.match(out, /Homebrew/);
	});

	test("rejects an unknown --os", () => {
		const { code, err } = capture(["node", "--os", "solaris"]);
		assert.equal(code, 2);
		assert.match(err, /Unknown --os "solaris"/);
	});

	test("rejects an unparseable flag", () => {
		const { code, err } = capture(["--nope"]);
		assert.equal(code, 2);
		assert.match(err, /Usage: node scripts\/order-tools\.js/);
	});

	test("reports unknown tools on stderr but still resolves the rest", () => {
		const { code, out, err } = capture(["sqlite", "cobol"]);
		assert.equal(code, 0);
		assert.match(err, /Not in the catalog: \[cobol\]/);
		assert.match(out, /SQLite/);
	});
});
