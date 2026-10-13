// Site facts, derived from the project's own package.json so nothing here is
// ever typed twice. The license in particular is read, never hard-coded.
// Lives in lib/ rather than _data/ because Eleventy data files must have a
// default export only: named exports would be merged into the data.

import { readFileSync } from "node:fs";
import { readProject } from "./project.js";

/** Host that serves every studio project site, one path segment per repo. */
const PAGES_HOST = "https://projects.allons-y.studio";

/**
 * Turn the many spellings of `repository` into a plain https URL.
 *
 * @param {string | { url?: string }} repository
 * @returns {string}
 */
export function normalizeRepository(repository) {
	const raw = typeof repository === "string" ? repository : repository?.url;
	if (!raw) {
		throw new Error(
			"package.json needs a `repository` so the site can link to it."
		);
	}
	const shorthand = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(raw);
	if (shorthand) return `https://github.com/${shorthand[1]}`;
	return raw
		.replace(/^git\+/, "")
		.replace(/^git:\/\//, "https://")
		.replace(/^ssh:\/\/git@/, "https://")
		.replace(/\.git$/, "");
}

/** Lowest major version in an engines range such as `>=24`, as `24+`. */
export function minimumVersion(range) {
	const major = /(\d+)/.exec(range ?? "");
	return major ? `${major[1]}+` : null;
}

/** First sentence of a description, without the trailing period. */
export function firstSentence(text) {
	const sentence = text.split(/(?<=\.)\s/)[0];
	return sentence.replace(/\.$/, "");
}

/**
 * @param {{ packagePath: string, projectPath: string }} paths
 */
export function buildSite({ packagePath, projectPath }) {
	const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
	const project = readProject(projectPath);

	if (typeof pkg.license !== "string" || !pkg.license) {
		throw new Error(
			`${packagePath} has no \`license\`. The site reads the license from package.json; set it there.`
		);
	}
	if (typeof pkg.description !== "string" || !pkg.description) {
		throw new Error(
			`${packagePath} has no \`description\`. The site reads its description from package.json.`
		);
	}

	const repo = normalizeRepository(pkg.repository);
	const repoName = repo.split("/").pop();
	const name = pkg.name.split("/").pop();
	const url = (project.url ?? `${PAGES_HOST}/${repoName}/`).replace(
		/\/?$/,
		"/"
	);

	return {
		name,
		packageName: pkg.name,
		tagline: project.tagline ?? firstSentence(pkg.description),
		description: pkg.description,
		license: pkg.license,
		licenseUrl: `${repo}/blob/main/LICENSE`,
		repo,
		repoName,
		npm: pkg.private ? null : `https://www.npmjs.com/package/${pkg.name}`,
		node: minimumVersion(pkg.engines?.node),
		url,
		issuesUrl: pkg.bugs?.url ?? `${repo}/issues`,
		contributingUrl: `${repo}/blob/main/.github/CONTRIBUTING.md`,
		changelogUrl: `${repo}/blob/main/CHANGELOG.md`,
	};
}
