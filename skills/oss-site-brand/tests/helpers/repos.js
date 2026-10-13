// Test helper: build small repository trees in a temp directory.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * @param {Record<string, string | object>} files path -> contents (objects become JSON)
 * @returns {string} repository root
 */
export function makeRepo(files) {
	const root = mkdtempSync(path.join(tmpdir(), "repo-"));
	for (const [rel, content] of Object.entries(files)) {
		const target = path.join(root, rel);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(
			target,
			typeof content === "string" ? content : JSON.stringify(content, null, 2)
		);
	}
	return root;
}

/** The repositories named in the architecture doc, reduced to their signals. */
export const REPOS = {
	// Workspaces that each carry their own page: a skill, then its pages.
	"agent-skills": () =>
		makeRepo({
			"package.json": { name: "@allons-y/agent-skills", workspaces: ["skills/*", "docs/", "."] },
			"skills/one/package.json": { name: "@allons-y/skill-one" },
			"skills/one/SKILL.md": "# one",
			"skills/two/package.json": { name: "@allons-y/skill-two" },
			"skills/two/SKILL.md": "# two",
			"scripts/run.js": "export {};",
			"README.md": "# agent-skills\n",
		}),
	// One product, many packages; a single table of contents, not nested pages.
	opx: () =>
		makeRepo({
			"package.json": { name: "opx", workspaces: ["packages/*"] },
			"packages/lint-js/package.json": { name: "@opx/lint-js" },
			"packages/lint-js/README.md": "# lint-js",
			"packages/lint-css/package.json": { name: "@opx/lint-css" },
			"packages/lint-css/README.md": "# lint-css",
			"packages/lint-js/src/index.ts": "export {};",
			"tsconfig.json": {},
			"README.md": "# opx\n".repeat(30),
		}),
	// A JavaScript docs site: several docs pages, no workspaces.
	dashly: () =>
		makeRepo({
			"package.json": { name: "dashly", main: "index.js" },
			"index.js": "export {};",
			"lib/render.mjs": "export {};",
			"docs/a.md": "a",
			"docs/b.md": "b",
			"docs/c.md": "c",
			"docs/d.md": "d",
			"README.md": "# dashly\n",
		}),
	// One command, short README.
	envoy: () =>
		makeRepo({
			"package.json": { name: "@allons-y/envoy", bin: { envoy: "bin/envoy.js" } },
			"bin/envoy.js": "#!/usr/bin/env node",
			"README.md": "# envoy\n\nInstall & use.\n",
		}),
	"glob-concat-cli": () =>
		makeRepo({
			"package.json": { name: "@allons-y/glob-concat-cli", bin: "cli.js" },
			"cli.js": "#!/usr/bin/env node",
			"README.md": "# glob-concat-cli\n",
		}),
	// One exported function.
	"markdown-it-anchor-sections": () =>
		makeRepo({
			"package.json": { name: "markdown-it-anchor-sections", main: "index.js", exports: { ".": "./index.js" } },
			"index.js": "export default function plugin() {}",
			"README.md": "# plugin\n",
		}),
};
