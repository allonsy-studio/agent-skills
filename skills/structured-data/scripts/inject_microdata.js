#!/usr/bin/env node
/**
 * inject_microdata.js — adds itemscope/itemtype/itemprop attributes to an
 * HTML file based on a selector-map config (see assets/selector-map-template.json).
 *
 * Never modifies the target file. Prints a unified diff to stdout for
 * review; apply it yourself (patch, or by hand) once you've looked at it.
 *
 * Usage:
 *     node inject_microdata.js --config assets/selector-map.json --target page.html
 *
 * Requires: cheerio, diff (npm install cheerio diff)
 *
 * Known limitation: cheerio re-serializes the whole document on write,
 * which can introduce cosmetic diff noise (attribute ordering, void-element
 * closing style) unrelated to the actual microdata additions. Review the
 * diff for the itemprop/itemscope/itemtype/meta/link lines specifically;
 * if a target file has unusual formatting requirements that make the
 * cosmetic noise a problem, fall back to direct str_replace annotation for
 * that file instead of this script.
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import { createTwoFilesPatch } from "diff";

export function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 2) {
		args[argv[i].replace(/^--/, "")] = argv[i + 1];
	}
	return args;
}

export function indexItems(cfg) {
	const byName = {};
	for (const item of cfg.items) byName[item.name] = item;
	return byName;
}

// value_pattern regexes are compiled once per distinct pattern and reused,
// rather than rebuilt for every element/property on every run.
const patternCache = new Map();
export function compilePattern(pattern) {
	let rx = patternCache.get(pattern);
	if (!rx) {
		rx = new RegExp(pattern);
		patternCache.set(pattern, rx);
	}
	return rx;
}

/**
 * Read a file as UTF-8, or print a clean one-line error and exit 1 instead of
 * dumping a Node stack trace. Shared by every CLI in this skill.
 */
export function readTextFileOrExit(filePath, kind = "file") {
	try {
		return fs.readFileSync(filePath, "utf8");
	} catch (err) {
		if (err.code === "ENOENT") console.error(`error: ${kind} not found: ${filePath}`);
		else if (err.code === "EISDIR") console.error(`error: ${filePath} is a directory, not a ${kind}`);
		else console.error(`error: cannot read ${kind} ${filePath}: ${err.message}`);
		process.exit(1);
	}
}

export function loadConfig(configPath) {
	return indexItems(JSON.parse(fs.readFileSync(configPath, "utf8")));
}

export function applyItem($, el, itemDef, itemsByName) {
	$(el).attr("itemscope", "");
	$(el).attr("itemtype", itemDef.itemtype);

	for (const prop of itemDef.properties || []) {
		const itemprop = prop.itemprop;

		if (prop.nestedItem) {
			const nestedDef = itemsByName[prop.nestedItem];
			const nestedEl = $(el).find(nestedDef.selector).first();
			if (nestedEl.length === 0) {
				console.error(
					`  ! warning: nested selector '${nestedDef.selector}' for itemprop '${itemprop}' not found, skipping`
				);
				continue;
			}
			nestedEl.attr("itemprop", itemprop);
			applyItem($, nestedEl.get(0), nestedDef, itemsByName);
			continue;
		}

		if (prop.constant !== undefined) {
			// Not derived from visible content -- always a hidden node. Build it
			// via cheerio's attr() API (not a string template) so a value
			// containing a quote or angle bracket is escaped, not injected.
			const value = prop.constant;
			const tag = value.startsWith("http")
				? $("<link>").attr("itemprop", itemprop).attr("href", value)
				: $("<meta>").attr("itemprop", itemprop).attr("content", value);
			$(el).append(tag);
			continue;
		}

		// selector-based property: find the node whose content IS the value
		const target = $(el).find(prop.selector).first();
		if (target.length === 0) {
			console.error(
				`  ! warning: selector '${prop.selector}' for itemprop '${itemprop}' not found, skipping`
			);
			continue;
		}

		const rawValue =
			prop.source === "attribute" ? target.attr(prop.attribute) || "" : target.text();

		const pattern = prop.value_pattern;
		if (pattern) {
			const match = rawValue.match(compilePattern(pattern));
			const cleaned = match ? match[0] : null;
			if (cleaned !== null && cleaned.trim() === rawValue.trim()) {
				// The visible text IS exactly the clean value -- safe to tag directly.
				target.attr("itemprop", itemprop);
			} else if (cleaned !== null) {
				// Visible text has extra formatting (e.g. a currency symbol).
				// Tagging it directly would make the crawler read the wrong value,
				// since crawlers use raw textContent verbatim. Add a hidden
				// sibling instead and leave the visible node untouched. Built via
				// attr() so the value is escaped rather than injected.
				target.after($("<meta>").attr("itemprop", itemprop).attr("content", cleaned));
				console.error(
					`  i note: '${prop.selector}' text ('${rawValue.trim()}') has extra ` +
						`formatting beyond the value_pattern match; added a hidden ` +
						`<meta itemprop="${itemprop}"> with the cleaned value ('${cleaned}') ` +
						`instead of tagging the visible text.`
				);
			} else {
				console.error(
					`  ! warning: value_pattern for itemprop '${itemprop}' did not match text '${rawValue.trim()}', skipping`
				);
			}
		} else {
			target.attr("itemprop", itemprop);
		}
	}
}

/**
 * Inject microdata into an HTML string and return the transformed HTML.
 * Throws if the config's root selector matches no elements.
 */
export function injectMicrodata(originalText, itemsByName) {
	const $ = cheerio.load(originalText, { decodeEntities: false });
	const rootDef = itemsByName.root;
	const rootElements = $(rootDef.selector);
	if (rootElements.length === 0) {
		throw new Error(`root selector '${rootDef.selector}' matched no elements`);
	}
	rootElements.each((_, el) => applyItem($, el, rootDef, itemsByName));
	return $.html();
}

const USAGE = "Usage: node inject_microdata.js --config <path> --target <path>";

export function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(USAGE);
		return;
	}
	const args = parseArgs(argv);
	if (!args.config || !args.target) {
		console.error(USAGE);
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

	let newText;
	try {
		newText = injectMicrodata(originalText, itemsByName);
	} catch (err) {
		console.error(`error: ${err.message}`);
		process.exit(1);
	}

	const diff = createTwoFilesPatch(
		`${args.target} (original)`,
		`${args.target} (with microdata)`,
		originalText,
		newText
	);
	process.stdout.write(diff);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
	main();
}
