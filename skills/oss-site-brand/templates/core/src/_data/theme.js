// Computed theme tokens: the accent's text-safe shades, the on-accent color,
// the optional font overrides, & the font stylesheet URL.

import path from "node:path";

import { readProject } from "../../lib/project.js";
import { computeThemeFromFiles } from "../../lib/theme.js";

export default function () {
	const project = readProject(path.join(import.meta.dirname, "project.json"));
	const tokens = path.join(
		import.meta.dirname,
		"..",
		"assets",
		"css",
		"tokens.css"
	);
	return computeThemeFromFiles(project, tokens);
}
