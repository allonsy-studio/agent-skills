// Site facts, derived from the project's own package.json. All logic lives in
// lib/site.js; a data file may only have a default export.

import path from "node:path";

import { buildSite } from "../../lib/site.js";

export default function () {
	// docs/src/_data -> the project root is three levels up.
	const root = path.resolve(import.meta.dirname, "..", "..", "..");
	return buildSite({
		packagePath:
			process.env.SITE_PACKAGE_JSON ?? path.join(root, "package.json"),
		projectPath: path.join(import.meta.dirname, "project.json"),
	});
}
