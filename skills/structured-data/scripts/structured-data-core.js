/**
 * structured-data-core.js — the canonical structural validator for schema.org
 * Microdata + JSON-LD. Checks internal consistency (does the markup follow the
 * spec's own rules), NOT search-engine rich-result eligibility.
 *
 * This file is the single source of truth for validation. Two things use it:
 *   1. scripts/validate_structured_data.js — the skill's own CLI validator.
 *   2. scripts/scaffold_validation_test.js — copies this file VERBATIM into a
 *      consumer's project so their test suite can validate structured data
 *      with no dependency on the skill remaining installed.
 *
 * Because it's vendored as-is, it depends only on `cheerio` and `jsonld`
 * (which the consumer installs as devDependencies) and uses no Node-only APIs
 * beyond those. Keep it that way — no fs, no process, no CLI here.
 */

import * as cheerio from "cheerio";
import jsonld from "jsonld";

// PROVENANCE: this table is Google Search Central's "required for rich
// results" data (https://developers.google.com/search/docs/appearance/structured-data) --
// it is NOT part of the schema.org vocabulary, which has no notion of a
// "required" property. No authoritative npm package publishes it (schema.org
// packages like schema-dts describe the vocabulary, not Google's search
// requirements), and Google revises these requirements independently of the
// vocabulary, so this is maintained by hand and deliberately kept small.
// Snapshot: 2026-07. Always defer to Google's live Rich Results Test for the
// final word; this table only catches obvious omissions early.
// Keep in sync with the "Yes" rows in references/schema-types/*.md.
export const REQUIRED_PROPERTIES = {
	Article: ["headline", "image", "datePublished", "author"],
	NewsArticle: ["headline", "image", "datePublished", "author"],
	BlogPosting: ["headline", "image", "datePublished", "author"],
	Product: ["name", "image", "offers"],
	Recipe: ["name", "image", "recipeIngredient", "recipeInstructions"],
	Event: ["name", "startDate", "location"],
};

// Offline JSON-LD document loader. schema.org's context is resolved to a
// minimal { @vocab: https://schema.org/ } mapping -- which is how schema.org's
// own context expands bare terms -- so jsonld.expand() runs the real
// expansion algorithm without any network access. Any other remote context is
// refused (fail-closed) rather than silently fetched; validation must not
// depend on the network, at author time or in CI.
const SCHEMA_ORG_HOSTS = new Set(["schema.org", "www.schema.org"]);

export async function offlineDocumentLoader(url) {
	try {
		if (SCHEMA_ORG_HOSTS.has(new URL(url).hostname)) {
			return {
				contextUrl: null,
				documentUrl: url,
				document: { "@context": { "@vocab": "https://schema.org/" } },
			};
		}
	} catch {
		// not a parseable URL -- fall through to the refusal below
	}
	const err = new Error(`refusing to fetch remote context <${url}> during offline validation`);
	err.code = "REMOTE_CONTEXT_BLOCKED";
	throw err;
}

export function validateMicrodata($) {
	const errors = [];
	const warnings = [];

	const itemrefTargets = new Set();
	$("[itemref]").each((_, el) => {
		$(el)
			.attr("itemref")
			.split(/\s+/)
			.forEach((id) => itemrefTargets.add(id));
	});

	function hasItemscopeAncestor(el) {
		let node = $(el).parent();
		while (node.length) {
			if (node.attr("itemscope") !== undefined) return true;
			node = node.parent();
		}
		return false;
	}

	$("[itemprop]").each((_, el) => {
		const $el = $(el);
		const elId = $el.attr("id");
		if (hasItemscopeAncestor(el)) return;
		if (elId && itemrefTargets.has(elId)) return;
		errors.push(
			`orphan itemprop="${$el.attr("itemprop")}" on <${el.tagName}> -- not inside an itemscope and not referenced via itemref`
		);
	});

	$("[itemscope]").each((_, el) => {
		const $el = $(el);
		const itemtype = $el.attr("itemtype");
		if (!itemtype) {
			warnings.push(`<${el.tagName} itemscope> has no itemtype -- valid but untyped, low SEO value`);
		} else if (!itemtype.startsWith("http")) {
			errors.push(`itemtype="${itemtype}" is not an absolute URL`);
		}
	});

	return { errors, warnings };
}

export async function validateJsonLd($) {
	const errors = [];
	const warnings = [];

	// Parse every block first, then run the (async) expansions concurrently, so
	// a page with several JSON-LD blocks doesn't pay for them serially. Results
	// are processed in document order afterwards for deterministic output.
	const parsed = $('script[type="application/ld+json"]')
		.toArray()
		.map((el) => {
			try {
				return { data: JSON.parse($(el).text()) };
			} catch (e) {
				return { parseError: e };
			}
		});

	// Run the reference JSON-LD processor's expansion algorithm. This catches
	// structural JSON-LD errors our own code never would -- bad @id values,
	// keyword misuse, malformed @context -- with the spec's own error codes.
	// Resolves to null on success, or the error on failure.
	const expandErrors = await Promise.all(
		parsed.map((p) =>
			p.parseError
				? Promise.resolve(null)
				: jsonld.expand(p.data, { documentLoader: offlineDocumentLoader }).then(
						() => null,
						(e) => e
					)
		)
	);

	parsed.forEach((p, i) => {
		if (p.parseError) {
			errors.push(`invalid JSON in <script type="application/ld+json">: ${p.parseError.message}`);
			return;
		}

		const expandErr = expandErrors[i];
		if (expandErr) {
			const code = expandErr.code || expandErr.details?.code;
			if (code === "REMOTE_CONTEXT_BLOCKED" || code === "loading remote context failed") {
				// Non-schema.org remote @context can't be resolved offline; that's a
				// limitation of local validation, not a defect in the markup.
				warnings.push(
					"JSON-LD uses a remote @context that can't be resolved offline -- skipped deep JSON-LD validation for this block; confirm with Google's Rich Results Test"
				);
			} else {
				errors.push(`malformed JSON-LD${code ? ` [${code}]` : ""}: ${expandErr.message}`);
				return;
			}
		}

		const data = p.data;
		if (!("@context" in data)) warnings.push("JSON-LD block missing @context");
		const typeName = data["@type"];
		if (!typeName) {
			errors.push("JSON-LD block missing @type");
			return;
		}

		const required = REQUIRED_PROPERTIES[typeName];
		if (!required) {
			warnings.push(
				`@type "${typeName}" isn't in this script's known-requirements table -- check https://schema.org/${typeName} and Google's structured data docs directly`
			);
			return;
		}

		const missing = required.filter((prop) => !(prop in data));
		if (missing.length) {
			errors.push(
				`@type "${typeName}" missing required propert${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}`
			);
		}
	});

	return { errors, warnings };
}

/**
 * Validate an HTML string. Returns { errors, warnings, hasMicrodata,
 * hasJsonLd }. `errors.length === 0` means the structural check passed.
 */
export async function collectIssues(html) {
	const $ = cheerio.load(html, { decodeEntities: false });

	const hasMicrodata = $("[itemscope]").length > 0;
	const hasJsonLd = $('script[type="application/ld+json"]').length > 0;

	let errors = [];
	let warnings = [];
	if (hasMicrodata) {
		const res = validateMicrodata($);
		errors = errors.concat(res.errors);
		warnings = warnings.concat(res.warnings);
	}
	if (hasJsonLd) {
		const res = await validateJsonLd($);
		errors = errors.concat(res.errors);
		warnings = warnings.concat(res.warnings);
	}

	return { errors, warnings, hasMicrodata, hasJsonLd };
}
