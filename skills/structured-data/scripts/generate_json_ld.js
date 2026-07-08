#!/usr/bin/env node
/**
 * generate_json_ld.js — builds a JSON-LD <script> block from a selector-map
 * config (see assets/selector-map-template.json), extracting values from
 * the SAME rendered HTML the page ships. Extracting from the actual target
 * file (rather than hand-typing the JSON-LD separately) is what closes
 * JSON-LD's usual drift risk: the emitted structured data is generated
 * from the same source as what's on screen, not maintained as an
 * independent parallel copy.
 *
 * Never modifies the target file. Prints a unified diff to stdout showing
 * the inserted <script type="application/ld+json"> block (right before
 * </head>, falling back to right before </body> if there's no <head>);
 * apply it yourself once you've reviewed it.
 *
 * Usage:
 *     node generate_json_ld.js --config assets/selector-map.json --target page.html
 *
 * Requires: cheerio, diff (npm install cheerio diff)
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import { createTwoFilesPatch } from "diff";
import { parseArgs, indexItems, readTextFileOrExit, compilePattern } from "./inject_microdata.js";

export function loadConfig(configPath) {
	return indexItems(JSON.parse(fs.readFileSync(configPath, "utf8")));
}

export function buildValue(prop, el) {
	const rawValue = prop.source === "attribute" ? el.attr(prop.attribute) || "" : el.text();
	const pattern = prop.value_pattern;
	if (pattern) {
		const match = rawValue.match(compilePattern(pattern));
		// For JSON-LD we control the emitted string directly, so it's safe to
		// use just the cleaned match -- there's no separate visible node a
		// crawler could read a raw, uncleaned value from.
		return match ? match[0] : rawValue.trim();
	}
	return rawValue.trim();
}

export function buildItem($, el, itemDef, itemsByName) {
	const obj = { "@type": itemDef.itemtype.split("/").pop() };

	for (const prop of itemDef.properties || []) {
		const itemprop = prop.itemprop;

		if (prop.nestedItem) {
			const nestedDef = itemsByName[prop.nestedItem];
			const nestedEl = $(el).find(nestedDef.selector).first();
			if (nestedEl.length === 0) {
				console.error(
					`  ! warning: nested selector '${nestedDef.selector}' for '${itemprop}' not found, skipping`
				);
				continue;
			}
			obj[itemprop] = buildItem($, nestedEl.get(0), nestedDef, itemsByName);
			continue;
		}

		if (prop.constant !== undefined) {
			obj[itemprop] = prop.constant;
			continue;
		}

		const target = $(el).find(prop.selector).first();
		if (target.length === 0) {
			console.error(`  ! warning: selector '${prop.selector}' for '${itemprop}' not found, skipping`);
			continue;
		}
		obj[itemprop] = buildValue(prop, target);
	}

	return obj;
}

/**
 * Build the JSON-LD object from an HTML string.
 * Throws if the config's root selector matches no elements.
 */
export function buildJsonLd(originalText, itemsByName) {
	const $ = cheerio.load(originalText, { decodeEntities: false });
	const rootDef = itemsByName.root;
	const rootEl = $(rootDef.selector).first();
	if (rootEl.length === 0) {
		throw new Error(`root selector '${rootDef.selector}' matched no elements`);
	}
	return { "@context": "https://schema.org", ...buildItem($, rootEl.get(0), rootDef, itemsByName) };
}

/**
 * Escape a JSON string for safe embedding inside an HTML <script> element.
 * JSON.stringify leaves `<`, `>`, `&` literal, so a value containing
 * `</script>` would terminate the block early (breakage + injection). Escaping
 * them as \u00xx keeps the JSON valid and round-trips through JSON.parse. Also
 * escapes U+2028/U+2029, which are legal in JSON but break inline scripts.
 * See Google's structured-data guidance on escaping JSON-LD in HTML.
 */
export function escapeJsonLdForHtml(json) {
	return json.replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

/**
 * Insert a serialized JSON-LD <script> block into the HTML string, before
 * </head> (falling back to </body>, then appending). Returns the new HTML.
 */
export function insertJsonLd(originalText, jsonLdObj) {
	const scriptBlock =
		'<script type="application/ld+json">\n' +
		escapeJsonLdForHtml(JSON.stringify(jsonLdObj, null, 2)) +
		"\n</script>\n";

	if (originalText.includes("</head>")) {
		return originalText.replace("</head>", scriptBlock + "</head>");
	}
	if (originalText.includes("</body>")) {
		return originalText.replace("</body>", scriptBlock + "</body>");
	}
	return originalText + "\n" + scriptBlock;
}

export function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log("Usage: node generate_json_ld.js --config <path> --target <path>");
		return;
	}
	const args = parseArgs(argv);
	if (!args.config || !args.target) {
		console.error("Usage: node generate_json_ld.js --config <path> --target <path>");
		process.exit(1);
	}

	let itemsByName;
	try {
		itemsByName = loadConfig(args.config);
	} catch (err) {
		console.error(`error: cannot read config ${args.config}: ${err.message}`);
		process.exit(1);
	}
	const originalText = readTextFileOrExit(args.target, "target");

	let jsonLdObj;
	try {
		jsonLdObj = buildJsonLd(originalText, itemsByName);
	} catch (err) {
		console.error(`error: ${err.message}`);
		process.exit(1);
	}

	const newText = insertJsonLd(originalText, jsonLdObj);

	const diff = createTwoFilesPatch(
		`${args.target} (original)`,
		`${args.target} (with JSON-LD)`,
		originalText,
		newText
	);
	process.stdout.write(diff);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
	main();
}
