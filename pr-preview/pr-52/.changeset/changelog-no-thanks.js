// Wraps @changesets/changelog-github so the generated CHANGELOG keeps the PR
// and commit links but drops the auto-inserted "Thanks [@user](url)!" author
// attribution *for the maintainer only*. External contributors keep their
// thanks. Referenced from `.changeset/config.json`.
//
// For a maintainer-authored change the upstream release line looks like:
//   - [#42](url) [`sha`](url) Thanks [@castastrophe](url)! - <summary>
// and we rewrite it to:
//   - [#42](url) [`sha`](url) - <summary>

import githubChangelog from "@changesets/changelog-github";

// The maintainer whose self-thanks we suppress. Everyone else keeps theirs.
const MAINTAINER_LOGIN = "castastrophe";

/**
 * Strip the "Thanks [@castastrophe](url)! " attribution from a generated
 * release line. Lines authored by anyone else — or with no associated author —
 * are returned unchanged.
 *
 * @param {string} line
 * @returns {string}
 */
function stripMaintainerThanks(line) {
	const pattern = new RegExp(
		`Thanks \\[@${MAINTAINER_LOGIN}\\]\\([^)]*\\)! `,
		"g"
	);
	return line.replace(pattern, "");
}

export default {
	async getReleaseLine(changeset, type, options) {
		const line = await githubChangelog.getReleaseLine(changeset, type, options);
		return stripMaintainerThanks(line);
	},
	getDependencyReleaseLine(changesets, dependenciesUpdated, options) {
		return githubChangelog.getDependencyReleaseLine(
			changesets,
			dependenciesUpdated,
			options
		);
	},
};
