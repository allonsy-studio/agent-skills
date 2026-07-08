#!/usr/bin/env node
/**
 * preview_extraction.js — shows what a spec-compliant PARSER extracts from a
 * page's static HTML: the Microdata items, the JSON-LD items, and (when both
 * are present) where they disagree.
 *
 * This is a parser's-eye view for eyeballing VALUES and catching drift in the
 * injection loop -- NOT a simulation of Google's crawler. It does not render
 * JS, filter by rich-result requirements, or judge search eligibility. For
 * eligibility, use Google's Rich Results Test. See
 * references/extraction-preview.md.
 *
 * Usage:
 *     node preview_extraction.js --target page.html
 *     node preview_extraction.js --target page.html --format microdata|json-ld|both
 *     node preview_extraction.js --target page.html --base https://your.site/
 *     node preview_extraction.js --target page.html --json
 *
 * Requires: cheerio, microdata-node.
 */

import { pathToFileURL } from "node:url";
import { parseArgs, readTextFileOrExit } from "./inject_microdata.js";
import { extractAll, compareExtractions, DEFAULT_BASE } from "./structured-data-extract.js";

const FRAMING =
	"Parser extraction preview — what a spec-compliant parser reads from this\n" +
	"static HTML. This is NOT a simulation of Google's crawler; for search\n" +
	"eligibility, use Google's Rich Results Test.";

const MAX_VALUE_LEN = 120;

function renderValue(v) {
	if (v.length <= MAX_VALUE_LEN) return JSON.stringify(v);
	// Keep long values (e.g. articleBody) from flooding the terminal; --json
	// still carries the full value.
	return `${JSON.stringify(v.slice(0, MAX_VALUE_LEN))}… (${v.length} chars)`;
}

function renderItem(item, indent, lines) {
	const pad = "  ".repeat(indent);
	lines.push(`${pad}${item.type || "(untyped item)"}${item.id ? `  <${item.id}>` : ""}`);
	for (const [key, values] of Object.entries(item.properties || {})) {
		for (const v of values) {
			if (v && typeof v === "object") {
				lines.push(`${pad}  ${key} →`);
				renderItem(v, indent + 2, lines);
			} else {
				lines.push(`${pad}  ${key.padEnd(16)}${renderValue(v)}`);
			}
		}
	}
}

function renderSection(title, items, lines) {
	lines.push("");
	lines.push(`▸ ${title} (${items.length} item${items.length === 1 ? "" : "s"})`);
	if (items.length === 0) {
		lines.push("  (none found)");
		return;
	}
	for (const item of items) renderItem(item, 1, lines);
}

function renderDrift(comparison, lines) {
	lines.push("");
	if (!comparison.comparable) {
		lines.push("▸ Drift check: skipped (page carries only one format)");
		return;
	}
	if (comparison.drift.length === 0) {
		lines.push("▸ Drift check: Microdata and JSON-LD agree ✓");
		return;
	}
	lines.push(`⚠ Drift between Microdata and JSON-LD (${comparison.drift.length}):`);
	for (const d of comparison.drift) {
		if (d.kind === "missing-in-jsonld") {
			lines.push(`    ${d.path}  in Microdata (${d.microdata.join(", ")}), missing in JSON-LD`);
		} else if (d.kind === "missing-in-microdata") {
			lines.push(`    ${d.path}  in JSON-LD (${d.jsonld.join(", ")}), missing in Microdata`);
		} else {
			lines.push(`    ${d.path}  Microdata=${d.microdata.join(", ")}  JSON-LD=${d.jsonld.join(", ")}`);
		}
	}
}

export function renderPreview({ microdata, jsonld }, comparison, format, base = DEFAULT_BASE) {
	const lines = [FRAMING];
	if (format !== "json-ld") {
		// Say which base relative URLs (img/src, a/href) were resolved against,
		// so an absolute "https://example.com/img/..." in the output isn't
		// mistaken for the page's real value.
		if (microdata.length) lines.push("", `(relative URLs resolved against ${base} — override with --base)`);
		renderSection("Microdata", microdata, lines);
	}
	if (format !== "microdata") renderSection("JSON-LD", jsonld, lines);
	if (format === "both") renderDrift(comparison, lines);
	lines.push("");
	lines.push("Structural preview only — confirm search eligibility with Google's Rich Results Test.");
	return lines.join("\n");
}

const USAGE =
	"Usage: node preview_extraction.js --target <path> [--format both|microdata|json-ld] [--base <url>] [--json]";

export function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(USAGE);
		return;
	}
	// --json is a boolean flag; strip it before pair-parsing the rest.
	const wantJson = argv.includes("--json");
	const args = parseArgs(argv.filter((a) => a !== "--json"));
	if (!args.target) {
		console.error(USAGE);
		process.exit(1);
	}

	const format = args.format || "both";
	if (!["both", "microdata", "json-ld"].includes(format)) {
		console.error(`error: unknown --format '${format}' (expected: both, microdata, json-ld)`);
		process.exit(1);
	}
	const base = args.base || DEFAULT_BASE;

	const html = readTextFileOrExit(args.target, "target");
	const extracted = extractAll(html, { base });
	const comparison = compareExtractions(extracted, { base });

	if (wantJson) {
		process.stdout.write(JSON.stringify({ ...extracted, drift: comparison }, null, 2) + "\n");
		return;
	}

	process.stdout.write(renderPreview(extracted, comparison, format, base) + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
	main();
}
