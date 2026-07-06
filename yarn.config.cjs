// Yarn constraints — the workspace-native enforcement of package.json-field
// invariants across every skill workspace. `yarn constraints` checks them (and
// runs in CI); `yarn constraints --fix` rewrites offending manifests in place,
// with correct key order.
//
// This is the package.json identity half of the skill-metadata contract. The
// semantic half — the `skill.*` shape (category/runtime vocabulary, triggers)
// and SKILL.md agreement — is validated by the JSON Schema in
// `schemas/skill.schema.json` and the tests in `docs/tests/`. Constraints can't
// see inside SKILL.md; the schema tests can't reach the dependency graph or fix
// manifests. Together they cover the whole contract.

/** @type {import("@yarnpkg/types").Yarn.Constraints.constraints} */
module.exports = {
	async constraints({ Yarn }) {
		for (const workspace of Yarn.workspaces()) {
			// Only the skill workspaces (skills/<name>); skip the root and docs/.
			const match = workspace.cwd.match(/(?:^|\/)skills\/([^/]+)\/?$/);
			if (!match) continue;
			const dir = match[1];

			// Skills are bundled inside the root package, never published on their
			// own — so each must be private.
			workspace.set("private", true);

			// Canonical package name, derived from the directory (the slug that
			// also drives the marketplace id, docs URL, and npx target).
			workspace.set("name", `@allons-y/skill-${dir}`);
		}
	},
};
