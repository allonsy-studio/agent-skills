/**
 * Assemble a setup-guide document and check it for the failure modes that
 * survive visual review.
 *
 * `build-guide.js` is the CLI around this module; everything here is pure, so
 * the checks are unit-tested rather than eyeballed against a rendered PDF.
 *
 * The checks exist because each one caught a broken guide at least once:
 * commands that wrap across lines and break when copied out, callout bloat,
 * install steps with no "Done when" check, and punctuation the house style
 * does not use.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

/**
 * Commands longer than this inside a half-width column will wrap in the PDF and
 * arrive broken when a reader copies them. Measured against the CS-230 template
 * at 8.5pt DejaVu Sans Mono in a two-column table cell.
 */
export const MAX_COL_COMMAND_CHARS = 46;
export const MAX_FULL_COMMAND_CHARS = 96;

/** The one declaration in `assets/guide.css` that carries the accent color. */
export const ACCENT_DECLARATION = /--accent:\s*[^;]+;/;

const PLACEHOLDER =
	/\[\s*(?:TODO|TBD|FIXME|[A-Z][A-Z _-]{3,})\s*\]|\{\{[^}]+\}\}|XXX+/g;

/**
 * Sections that legitimately have no "Done when" check: they are the check, or
 * there is nothing installed in them to verify.
 */
const SKIP_SECTIONS = [
	"before you begin",
	"check your work",
	"when it goes wrong",
	"troubleshoot",
	"appendix",
	"verify",
];

/** Punctuation the house style does not use. */
const BANNED_PUNCTUATION = [
	["—", "em dash"],
	["–", "en dash"],
	["·", "middot"],
];

/**
 * Wrap body-only HTML in the document furniture and inline the stylesheet.
 *
 * @param {string} body body content only — no <html>, <head>, <style> or <body>
 * @param {{ title?: string, footer?: string, accent?: string, css?: string }} [options]
 * @returns {string}
 */
export function buildHtml(body, options = {}) {
	const {
		title = "Setup Guide",
		footer = "Setup Guide",
		accent = "#1e40af",
		css = readFileSync(join(ASSETS, "guide.css"), "utf8"),
	} = options;

	// The stylesheet is valid CSS on its own: the accent is a real custom
	// property with a real default, rewritten here, and the footer is a literal
	// string. Keep the footer a string rather than a var() — margin-box
	// `content` is where renderer support for custom properties gets thin.
	const styled = css
		.replace(ACCENT_DECLARATION, `--accent: ${accent};`)
		.replaceAll("FOOTERTEXT", footer);
	const inner = body.replace(/<\/?(?:html|body)[^>]*>/gi, "").trim();

	return [
		"<!DOCTYPE html>",
		'<html lang="en">',
		"<head>",
		'<meta charset="utf-8">',
		`<title>${title}</title>`,
		`<style>${styled}</style>`,
		"</head>",
		"<body>",
		inner,
		"</body>",
		"</html>",
		"",
	].join("\n");
}

/**
 * Remove markup, joining the text exactly as it sits. Use this to measure what a
 * reader copies — `<pre><code>brew install php</code></pre>` is sixteen
 * characters of command, not eighteen.
 *
 * @param {string} s
 * @returns {string}
 */
export function stripTags(s) {
	return s.replace(/<[^>]+>/g, "");
}

/**
 * Remove markup, leaving a space where each tag was. Use this to count words:
 * `<p>ten</p><div>eleven</div>` is two words, and stripTags would read it as the
 * single word "teneleven".
 *
 * @param {string} s
 * @returns {string}
 */
export function textOf(s) {
	return s.replace(/<[^>]+>/g, " ");
}

/**
 * @param {string} s
 * @returns {string}
 */
export function unescapeEntities(s) {
	return s
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&nbsp;", " ");
}

/**
 * Words of readable text in a fragment of markup.
 *
 * @param {string} html
 * @returns {string[]}
 */
function words(html) {
	return textOf(html).split(/\s+/).filter(Boolean);
}

/**
 * @typedef {Object} CommandProblem
 * @property {number} length characters on the offending line
 * @property {number} limit characters that fit where the command sits
 * @property {"column"|"full width"} where
 * @property {string} text truncated preview of the line
 */

/**
 * Find code blocks whose lines will wrap and break on copy.
 *
 * A long command inside a narrow column looks fine on the page and arrives with
 * a newline in the middle when pasted. This is the most damaging bug in this
 * document class, so the limit is tighter inside a table cell than at full width.
 *
 * @param {string} body
 * @returns {CommandProblem[]}
 */
export function checkCommands(body) {
	const problems = [];
	for (const match of body.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)) {
		const before = body.slice(0, match.index);
		const inColumn = before.lastIndexOf("<td") > before.lastIndexOf("</td>");
		const limit = inColumn ? MAX_COL_COMMAND_CHARS : MAX_FULL_COMMAND_CHARS;

		for (const raw of unescapeEntities(stripTags(match[1])).split("\n")) {
			const line = raw.trimEnd();
			if (line.length <= limit) continue;
			problems.push({
				length: line.length,
				limit,
				where: inColumn ? "column" : "full width",
				text: line.length > 70 ? `${line.slice(0, 70)}...` : line,
			});
		}
	}
	return problems;
}

/**
 * Measure how much of the document is inside coloured boxes. A page of callouts
 * is a page nobody reads, including the one callout that mattered.
 *
 * @param {string} body
 * @returns {{ total: number, callout: number, percent: number, boxes: { words: number, kind: string }[] }}
 */
export function checkCallouts(body) {
	const total = words(body).length;
	const boxes = [];
	let callout = 0;

	for (const match of body.matchAll(/<div class="(note|warn|stop|ok)\b/g)) {
		const start = match.index;
		let depth = 0;
		let end = start;
		for (const tag of body.slice(start).matchAll(/<\/?div\b/g)) {
			depth += tag[0].startsWith("<div") ? 1 : -1;
			if (depth === 0) {
				end = start + tag.index + tag[0].length;
				break;
			}
		}
		const n = words(body.slice(start, end)).length;
		callout += n;
		boxes.push({ words: n, kind: match[1] });
	}

	return {
		total,
		callout,
		percent: total ? (100 * callout) / total : 0,
		boxes: boxes.sort((a, b) => b.words - a.words),
	};
}

/**
 * Unfilled placeholders left in the body.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function findPlaceholders(body) {
	return [...textOf(body).matchAll(PLACEHOLDER)].map((m) => m[0]);
}

/**
 * @typedef {Object} StructureReport
 * @property {string[]} failures always wrong — the guide is broken until they are fixed
 * @property {string[]} advisories need a human look, but may be correct as written
 */

/**
 * Check the structural promises the guide makes to its reader.
 *
 * @param {string} body
 * @returns {StructureReport}
 */
export function checkStructure(body) {
	const failures = [];
	const advisories = [];

	// An install step is an <h2> whose section contains a platform-split table.
	const missing = [];
	for (const section of body.split(/(?=<h2[^>]*>)/)) {
		if (!section.startsWith("<h2")) continue;
		if (!section.includes('class="split"')) continue;

		const heading = section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
		const title = heading ? words(heading[1]).join(" ") : "?";
		if (SKIP_SECTIONS.some((k) => title.toLowerCase().includes(k))) continue;

		if (!section.includes('class="done"') && !section.includes("Done when")) {
			missing.push(title.slice(0, 40));
		}
	}
	if (missing.length > 0) {
		failures.push(
			`Install steps with no 'Done when' check: [${missing.join(", ")}]. ` +
				"A reader cannot tell whether these worked."
		);
	}

	// Troubleshooting entries are titled with the error text the reader is
	// staring at, so they can search for what is on their screen.
	const symptoms = [
		...body.matchAll(/<div class="sym">([\s\S]*?)<\/div>/g),
	].map((m) => m[1]);
	const untitled = symptoms
		.filter((t) => !t.includes("<code>"))
		.map((t) => words(t).join(" ").slice(0, 46));
	if (untitled.length > 0) {
		advisories.push(
			`${untitled.length} of ${symptoms.length} troubleshooting entries have no error text ` +
				"in <code>. That's fine when the symptom is not a message (a stuck editor, " +
				`a missing button). Confirm these are that: [${untitled.slice(0, 3).join(", ")}]`
		);
	}

	const text = textOf(body);
	for (const [char, name] of BANNED_PUNCTUATION) {
		const n = text.split(char).length - 1;
		if (n > 0) {
			failures.push(
				`Found ${n} ${name}(s). House style uses pipes in metadata and ` +
					"restructured sentences elsewhere."
			);
		}
	}

	return { failures, advisories };
}

/**
 * The verification report, and whether the guide is clean enough to hand over.
 *
 * @param {string} body
 * @returns {{ ok: boolean, report: string }}
 */
export function verify(body) {
	const lines = [];
	let ok = true;

	const commands = checkCommands(body);
	if (commands.length > 0) {
		ok = false;
		lines.push(
			"",
			`  COMMANDS THAT WILL BREAK ON COPY  (${commands.length})`,
			"  A wrapped command becomes two broken commands when pasted."
		);
		for (const { length, limit, where, text } of commands) {
			lines.push(
				`    ${String(length).padStart(3, " ")} chars (limit ${limit} in ${where}): ${text}`
			);
		}
		lines.push(
			"  Fix: move it to a full-width block, or tell the reader to copy it from",
			"  their own screen or the vendor's page. An explicit instruction not to",
			"  copy from the PDF is an acceptable resolution. Silence is not."
		);
	} else {
		lines.push("", "  Commands: all fit on one line.");
	}

	const callouts = checkCallouts(body);
	const over = callouts.percent > 10;
	lines.push(
		"",
		`  Callouts: ${callouts.callout} of ${callouts.total} words ` +
			`(${callouts.percent.toFixed(0)}%)${over ? "  <-- over budget" : ""}`
	);
	if (over) {
		ok = false;
		lines.push(
			"  Budget is about 10%. Move the longest boxes under headings as prose."
		);
		for (const box of callouts.boxes.slice(0, 4)) {
			lines.push(`    ${String(box.words).padStart(4, " ")}w  .${box.kind}`);
		}
	}

	const placeholders = findPlaceholders(body);
	if (placeholders.length > 0) {
		lines.push(
			"",
			`  Placeholders left: ${placeholders.length}  [${placeholders.slice(0, 5).join(", ")}]`,
			"  Intentional? Say so in your handoff. Otherwise fill them in."
		);
	}

	const { failures, advisories } = checkStructure(body);
	if (failures.length > 0) {
		ok = false;
		lines.push("");
		for (const failure of failures) lines.push(`  ${failure}`);
	}
	if (advisories.length > 0) {
		lines.push("");
		for (const advisory of advisories) lines.push(`  note: ${advisory}`);
	}

	lines.push(
		"",
		"=".repeat(62),
		ok ? "  Clean." : "  Fix the items above, then rebuild.",
		"  Still to check by hand: cross-references point at steps that exist,",
		"  and claims about installer behavior were verified, not remembered.",
		""
	);

	return { ok, report: lines.join("\n") };
}
