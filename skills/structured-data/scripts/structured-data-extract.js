/**
 * structured-data-extract.js — extracts the structured data a spec-compliant
 * PARSER reads out of static HTML, for the preview view. This is intentionally
 * separate from structured-data-core.js: extraction pulls in microdata-node,
 * and the core is vendored into consumer test suites for *validation* only, so
 * it must not inherit an extraction-only dependency.
 *
 * This is a parser's-eye view, NOT a crawler simulation. It does not render
 * JS, apply Google's rich-result filtering, or judge eligibility -- see
 * references/extraction-preview.md.
 *
 * Requires: cheerio, microdata-node.
 */

import * as cheerio from "cheerio";
import microdata from "microdata-node";

// microdata-node resolves relative URL properties (img/src, a/href, ...)
// against a base. Static files have no real base, so we use a placeholder and
// resolve JSON-LD URL values against the SAME base when comparing, so a
// relative path and its absolute form don't read as drift. Override via --base.
export const DEFAULT_BASE = "https://example.com/";

// Canonical extracted shape, shared by both formats so the renderer and the
// drift comparison work on one model:
//   Item  = { type: string|null, id?: string, properties: { [name]: Value[] } }
//   Value = string | Item

function shortType(typeValue) {
	if (!typeValue) return null;
	const types = Array.isArray(typeValue) ? typeValue : [typeValue];
	return types.map((t) => String(t).split(/[/#]/).pop()).join(", ") || null;
}

function microdataItemToCanonical(item) {
	const out = { type: shortType(item.type), properties: {} };
	if (item.id) out.id = item.id;
	for (const [key, values] of Object.entries(item.properties || {})) {
		out.properties[key] = values.map((v) =>
			v && typeof v === "object" && v.properties ? microdataItemToCanonical(v) : String(v)
		);
	}
	return out;
}

export function extractMicrodata(html, { base = DEFAULT_BASE } = {}) {
	const { items } = microdata.toJson(html, { base });
	return items.map(microdataItemToCanonical);
}

function jsonLdNodeToCanonical(node) {
	const out = { type: shortType(node["@type"]), properties: {} };
	if (node["@id"]) out.id = node["@id"];
	for (const [key, value] of Object.entries(node)) {
		if (key === "@type" || key === "@context" || key === "@id") continue;
		const values = Array.isArray(value) ? value : [value];
		out.properties[key] = values.map((v) =>
			v && typeof v === "object" ? jsonLdNodeToCanonical(v) : String(v)
		);
	}
	return out;
}

// DEFERRED OPTIMIZATION (#9): this cheerio.load is a second full parse of the
// same HTML that extractMicrodata already parsed. It cannot be collapsed into
// one parse cheaply: microdata-node's public API takes an HTML string and
// parses internally (htmlparser2.parseDOM), with no way to pass it a shared
// DOM. The only parse we control is this one. Cheapening it (an htmlparser2
// streaming Parser scoped to ld+json <script> tags, dropping cheerio here) is
// worth doing ONLY if the preview grows a batch mode over many/large files.
// Today the double-parse lives solely in the interactive, one-file preview
// path -- the site-wide validation loop (structured-data-core.js) already
// single-parses -- so the win is marginal. Left as-is intentionally.
export function extractJsonLd(html) {
	const $ = cheerio.load(html, { decodeEntities: false });
	const items = [];
	$('script[type="application/ld+json"]').each((_, el) => {
		let data;
		try {
			data = JSON.parse($(el).text());
		} catch {
			// invalid JSON is the validator's job to report; the preview just skips it
			return;
		}
		const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
		for (const node of nodes) {
			if (node && typeof node === "object") items.push(jsonLdNodeToCanonical(node));
		}
	});
	return items;
}

export function extractAll(html, { base = DEFAULT_BASE } = {}) {
	return {
		microdata: extractMicrodata(html, { base }),
		jsonld: extractJsonLd(html),
	};
}

function normalizeValue(value, base) {
	const s = String(value).trim();
	if (/^https?:\/\//i.test(s) || s.startsWith("/")) {
		try {
			return new URL(s, base).href;
		} catch {
			// not resolvable -- compare as-is
		}
	}
	return s;
}

function flatten(item, base, prefix = "", out = {}) {
	for (const [key, values] of Object.entries(item.properties || {})) {
		const path = prefix ? `${prefix}.${key}` : key;
		const scalars = [];
		for (const v of values) {
			if (v && typeof v === "object") flatten(v, base, path, out);
			else scalars.push(normalizeValue(v, base));
		}
		if (scalars.length) out[path] = (out[path] || []).concat(scalars);
	}
	return out;
}

/**
 * Compare the primary Microdata item against the primary JSON-LD item and
 * report where they disagree -- the drift risk the skill warns about. Returns
 * { comparable: boolean, drift: [{ path, kind, microdata?, jsonld? }] }.
 * Only meaningful when the page carries both formats.
 *
 * Deep property comparison is done on the FIRST item of each format. When
 * either format carries more than one item -- or the two primary items are
 * different @types -- that is surfaced as its own drift entry, so a page with
 * a list of items can't read as a clean "agree" just because item[0] matched.
 */
export function compareExtractions({ microdata: md, jsonld }, { base = DEFAULT_BASE } = {}) {
	if (!md?.length || !jsonld?.length) return { comparable: false, drift: [] };

	const drift = [];

	if (md.length !== jsonld.length) {
		drift.push({
			path: "(item count)",
			kind: "count-mismatch",
			microdata: [String(md.length)],
			jsonld: [String(jsonld.length)],
		});
	}

	if (md[0].type !== jsonld[0].type) {
		drift.push({
			path: "@type",
			kind: "type-mismatch",
			microdata: [String(md[0].type)],
			jsonld: [String(jsonld[0].type)],
		});
	}

	const m = flatten(md[0], base);
	const j = flatten(jsonld[0], base);
	const paths = [...new Set([...Object.keys(m), ...Object.keys(j)])].sort();

	for (const path of paths) {
		const mv = m[path] ? [...m[path]].sort() : null;
		const jv = j[path] ? [...j[path]].sort() : null;
		if (!mv) drift.push({ path, kind: "missing-in-microdata", jsonld: jv });
		else if (!jv) drift.push({ path, kind: "missing-in-jsonld", microdata: mv });
		else if (JSON.stringify(mv) !== JSON.stringify(jv))
			drift.push({ path, kind: "value-mismatch", microdata: mv, jsonld: jv });
	}
	return { comparable: true, drift };
}
