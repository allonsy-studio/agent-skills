// The project layer: everything a maintainer owns about their site. Read and
// validated in one place so the build, the audit, and the scaffold agree on
// the shape and report the same errors.

import { readFileSync } from "node:fs";

import { parseHex } from "./color.js";

/** Page-template flavors a project can pick. */
export const FLAVOR_NAMES = ["landing", "docs", "workspaces"];

/** Font roles a project may override. The mono role is locked by the studio. */
export const FONT_ROLES = ["sans", "display"];

/** Locked mono stack: PT Mono first, then the platform monospace fonts. */
export const MONO_STACK =
	'"PT Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Default sans stack. A project may put its own family in front of it. */
export const SANS_STACK =
	'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Check a parsed project file against the project-layer shape.
 *
 * @param {unknown} project
 * @returns {string[]} human-readable problems; empty when valid
 */
export function validateProject(project) {
	const problems = [];
	if (!project || typeof project !== "object" || Array.isArray(project)) {
		return ["project.json must contain a JSON object."];
	}
	const p = /** @type {Record<string, any>} */ (project);

	try {
		parseHex(p.accent);
	} catch {
		problems.push(
			`accent must be a hex color such as #2346d4 (found ${JSON.stringify(p.accent)}).`
		);
	}

	if (p.flavor !== undefined && !FLAVOR_NAMES.includes(p.flavor)) {
		problems.push(
			`flavor must be one of ${FLAVOR_NAMES.join(", ")} (found ${JSON.stringify(p.flavor)}).`
		);
	}

	for (const key of ["tagline", "lede", "install", "logo", "url"]) {
		if (p[key] !== undefined && typeof p[key] !== "string") {
			problems.push(`${key} must be a string.`);
		}
	}

	if (p.usage !== undefined) {
		if (
			!p.usage ||
			typeof p.usage.code !== "string" ||
			typeof p.usage.language !== "string"
		) {
			problems.push("usage needs a string `language` and a string `code`.");
		}
	}

	for (const list of ["features", "packages"]) {
		if (p[list] === undefined) continue;
		if (!Array.isArray(p[list])) {
			problems.push(`${list} must be an array.`);
			continue;
		}
		p[list].forEach((item, index) => {
			const text = list === "features" ? "body" : "description";
			const title = list === "features" ? "title" : "name";
			if (!item || typeof item[title] !== "string" || !item[title]) {
				problems.push(`${list}[${index}] needs a ${title}.`);
			}
			if (!item || typeof item[text] !== "string" || !item[text]) {
				problems.push(`${list}[${index}] needs a ${text}.`);
			}
		});
	}

	if (p.fonts !== undefined) {
		if (!p.fonts || typeof p.fonts !== "object") {
			problems.push("fonts must be an object.");
		} else {
			for (const [role, font] of Object.entries(p.fonts)) {
				if (role === "mono") {
					problems.push(
						"fonts.mono is locked to PT Mono and cannot be overridden."
					);
					continue;
				}
				if (!FONT_ROLES.includes(role)) {
					problems.push(
						`fonts.${role} is not a known role (use ${FONT_ROLES.join(" or ")}).`
					);
					continue;
				}
				if (!font || typeof font.family !== "string" || !font.family) {
					problems.push(`fonts.${role} needs a string family.`);
				}
				if (
					font?.weights !== undefined &&
					(!Array.isArray(font.weights) ||
						!font.weights.every(
							(w) => Number.isInteger(w) && w >= 100 && w <= 900
						))
				) {
					problems.push(
						`fonts.${role}.weights must be integers from 100 to 900.`
					);
				}
			}
		}
	}

	return problems;
}

/**
 * Read & validate a project file. Throws one error listing every problem.
 *
 * @param {string} path
 * @returns {Record<string, any>}
 */
export function readProject(path) {
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") {
			throw new Error(
				`No project file at ${path}. Create it from the scaffold's project.json template.`,
				{ cause: error }
			);
		}
		throw error;
	}
	let project;
	try {
		project = JSON.parse(raw);
	} catch (error) {
		throw new Error(`${path} is not valid JSON: ${error.message}`, { cause: error });
	}
	const problems = validateProject(project);
	if (problems.length) {
		throw new Error(
			`${path} has ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n- ${problems.join("\n- ")}`
		);
	}
	return project;
}
