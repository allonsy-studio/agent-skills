import fs from "node:fs";
import path from "node:path";

import {
	DEFAULT_MANAGER,
	MANAGERS,
	TOOLS,
	resolve,
} from "../scripts/order-tools.js";

/**
 * Eleventy preview data for the install-guide-builder skill.
 *
 * The page is an example of what the skill produces, so its content is authored
 * guide prose (`example-guide.json`) rather than the catalog, which is source
 * material for writing from, not a machine-readable file.
 *
 * The dependency facts — layer, prerequisites, platforms — are read from
 * `scripts/order-tools.js` instead of being restated here, so the demo cannot
 * claim an install order the shipped graph would not produce.
 */

const PLATFORM_LABELS = {
	macos: "macOS",
	windows: "Windows",
	linux: "Linux",
};

/**
 * Escape HTML, then render the small inline subset the guide prose uses:
 * `code` and **strong**. Everything else stays literal.
 *
 * Deliberately not exported: Eleventy only invokes a JS data file's default
 * export when it is the module's only export. A second named export makes it
 * treat the module namespace as the data, and the page renders empty.
 *
 * @param {string} text
 * @returns {string}
 */
function inline(text) {
	return String(text)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/**
 * Render the inline subset across every prose field of a step, callout,
 * troubleshooting entry, or note.
 *
 * @param {Record<string, unknown>} step
 * @returns {Record<string, unknown>}
 */
function renderStep(step) {
	return {
		...step,
		do: inline(step.do),
		callout: step.callout
			? { ...step.callout, text: inline(step.callout.text) }
			: null,
	};
}

/**
 * Which platforms a tool has steps for, in the guide's own platform order.
 *
 * @param {{ steps: Record<string, unknown[]> }} tool
 * @param {string[]} platforms
 * @returns {string[]}
 */
function platformsFor(tool, platforms) {
	return platforms.filter((os) => Array.isArray(tool.steps?.[os]));
}

/**
 * @param {{ eleventy: { env: { root: string } } }} configData
 */
export default async function (configData) {
	const root = path.resolve(configData.eleventy.env.root);
	const guide = JSON.parse(
		fs.readFileSync(
			path.join(
				root,
				"skills",
				"install-guide-builder",
				"preview",
				"example-guide.json"
			),
			"utf8"
		)
	);

	// The example may only name tools the shipped graph knows about — otherwise
	// the resolved order on the page would be fiction.
	const unknown = Object.keys(guide.tools).filter((name) => !TOOLS[name]);
	if (unknown.length > 0) {
		throw new Error(
			`example-guide.json describes tools that are not in scripts/order-tools.js: ${unknown.join(", ")}`
		);
	}

	// Resolve with every platform in scope, so the page holds the union of what
	// any single platform view needs and the client only has to filter.
	const { ordered, added } = resolve(guide.selected, "all");

	const missing = ordered.filter((name) => !guide.tools[name]);
	if (missing.length > 0) {
		throw new Error(
			`example-guide.json is missing content for resolved prerequisites: ${missing.join(", ")}`
		);
	}

	/** Which manager, if any, provides each runtime in this selection. */
	const providedBy = Object.fromEntries(
		Object.entries(MANAGERS)
			.map(([runtime, managers]) => [
				runtime,
				managers.find((m) => ordered.includes(m)),
			])
			.filter(([, manager]) => manager)
	);

	const tools = ordered.map((name, index) => {
		const [layer, label, requires, graphPlatforms] = TOOLS[name];
		const tool = guide.tools[name];
		const manager = providedBy[name];

		return {
			id: name,
			label,
			layer,
			step: index + 1,
			blurb: inline(tool.blurb),
			note: tool.note ? inline(tool.note) : null,
			// A prerequisite the reader did not check gets a marker and a reason.
			// Silent additions read as bugs.
			added: added.has(name),
			addedFor: added.has(name)
				? ordered.filter((other) => TOOLS[other][2].includes(name))
				: [],
			requires: requires.filter((pre) => ordered.includes(pre)),
			// A runtime whose manager is selected renders the manager's outcome,
			// not its own steps. On Windows installing both is worse than
			// redundant, so this is a correctness rule, not a tidiness one.
			managedBy: manager ?? null,
			managedNote: manager ? inline(tool.managedNote) : null,
			platforms: platformsFor(tool, guide.platforms),
			graphPlatforms,
			steps: Object.fromEntries(
				platformsFor(tool, guide.platforms).map((os) => [
					os,
					tool.steps[os].map(renderStep),
				])
			),
			verify: Object.fromEntries(
				platformsFor(tool, guide.platforms).map((os) => {
					const check = tool.verify[os] ?? tool.verify["*"];
					return [os, check ? { ...check, expect: inline(check.expect) } : null];
				})
			),
			troubleshooting: (tool.troubleshooting ?? []).map((entry) => ({
				...entry,
				fix: inline(entry.fix),
				platforms: entry.platforms.filter((os) =>
					guide.platforms.includes(os)
				),
			})),
		};
	});

	return {
		guide: {
			title: guide.title,
			subtitle: guide.subtitle,
			audience: guide.audience,
		},
		platforms: guide.platforms.map((id) => ({
			id,
			label: PLATFORM_LABELS[id] ?? id,
		})),
		// Only the tools the reader chose are offered as checkboxes; the rest
		// arrive as prerequisites when something needs them.
		choices: tools.filter((tool) => !tool.added),
		tools,
		defaultManagers: DEFAULT_MANAGER,
	};
}
