// The brand & accessibility baseline. Each check takes a loaded site and
// returns { id, title, ok, skipped, problems, notes }: pure data, so the
// node:test suite, the audit script & the skill's own tests share one definition.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import axe from "axe-core";
import { JSDOM } from "jsdom";

import { AA_LARGE, AA_NORMAL, contrastRatio } from "../../lib/color.js";
import {
	familiesOf,
	resolveProperty,
	resolveValue,
} from "../../lib/css-tokens.js";
import { FLAVOR_NAMES, MONO_STACK } from "../../lib/project.js";
import { declarationsOf, parseRules } from "./css-rules.js";
import { TEXT_EXTENSIONS, walk } from "./site.js";

const result = (id, title, problems, notes = [], extra = {}) => ({
	id,
	title,
	ok: problems.length === 0,
	skipped: false,
	problems,
	notes,
	...extra,
});

/** Surfaces text can sit on. */
const SURFACES = ["--bg", "--bg-elev", "--code-bg"];

/**
 * Foreground/background pairs the site draws, with the minimum ratio each
 * must meet. `large` pairs (24px, or 18.66px bold) & non-text UI pairs meet 3:1.
 *
 * @type {{ fg: string, bg: string, min: number, use: string }[]}
 */
export const PAIRS = [
	...SURFACES.map((bg) => ({ fg: "--fg", bg, min: AA_NORMAL, use: "body text" })),
	...SURFACES.map((bg) => ({ fg: "--fg-muted", bg, min: AA_NORMAL, use: "muted text" })),
	...SURFACES.map((bg) => ({ fg: "--accent-text", bg, min: AA_NORMAL, use: "links" })),
	{ fg: "--on-accent", bg: "--accent", min: AA_NORMAL, use: "text on accent" },
	{ fg: "--accent-text", bg: "--bg", min: AA_LARGE, use: "focus ring & button border" },
	{ fg: "--tok-comment", bg: "--code-bg", min: AA_NORMAL, use: "code comment" },
	{ fg: "--tok-string", bg: "--code-bg", min: AA_NORMAL, use: "code string" },
	{ fg: "--tok-keyword", bg: "--code-bg", min: AA_NORMAL, use: "code keyword" },
	{ fg: "--tok-function", bg: "--code-bg", min: AA_NORMAL, use: "code function" },
	{ fg: "--tok-number", bg: "--code-bg", min: AA_NORMAL, use: "code number" },
	{ fg: "--studio-ink", bg: "--studio-navy", min: AA_NORMAL, use: "studio text" },
	{ fg: "--studio-link", bg: "--studio-navy", min: AA_NORMAL, use: "studio link" },
];

/** Foreground tokens the pairs above measure. */
const COVERED_FOREGROUNDS = new Set(PAIRS.map((p) => p.fg));

/**
 * Contrast: every text & on-accent pair in light & dark. Prints the final
 * resolved hex values it measured.
 *
 * @param {import("./site.js").Site} site
 * @param {{ pairs?: typeof PAIRS }} [options]
 */
export function checkContrast(site, { pairs = PAIRS } = {}) {
	const problems = [];
	const notes = [];
	for (const page of site.pages) {
		for (const mode of ["light", "dark"]) {
			for (const { fg, bg, min, use } of pairs) {
				let fgHex;
				let bgHex;
				try {
					fgHex = resolveProperty(page.properties, fg, mode);
					bgHex = resolveProperty(page.properties, bg, mode);
				} catch (error) {
					problems.push(`${page.file} ${mode} ${fg} on ${bg}: ${error.message}`);
					continue;
				}
				let ratio;
				try {
					ratio = contrastRatio(fgHex, bgHex);
				} catch (error) {
					problems.push(`${page.file} ${mode} ${fg} on ${bg}: ${error.message}`);
					continue;
				}
				const line = `${mode} ${fg} ${fgHex} on ${bg} ${bgHex}: ${ratio.toFixed(2)}:1 (min ${min}, ${use})`;
				if (page === site.pages[0]) notes.push(line);
				if (ratio < min) problems.push(`${page.file} ${line}`);
			}
		}
	}

	// A text color the pairs do not cover would pass this check unmeasured.
	const rules = parseRules(site.pages[0]?.css ?? "");
	for (const { value } of declarationsOf(rules, "color")) {
		const token = /^var\((--[\w-]+)/.exec(value)?.[1];
		if (token && !COVERED_FOREGROUNDS.has(token)) {
			problems.push(`CSS uses color: ${value} but no contrast pair covers ${token}.`);
		}
	}
	return result("contrast", "Contrast", problems, notes);
}

/** Visible focus: a :focus-visible outline exists & nothing removes it. */
function checkFocusStyles(css) {
	const problems = [];
	const rules = parseRules(css);
	const focus = rules.filter((r) => /:focus-visible/.test(r.selector));
	const drawn = declarationsOf(focus, "outline").some(({ value }) => !/^(none|0)\b/.test(value));
	if (!drawn) {
		problems.push("No :focus-visible rule draws an outline.");
	}
	for (const { value, rule } of declarationsOf(rules, "outline")) {
		if (/^(none|0)\b/.test(value) && !/^main:focus$/.test(rule.selector.trim())) {
			problems.push(`"${rule.selector}" removes the focus outline.`);
		}
	}
	return problems;
}

/** Reduced motion: smooth scrolling, animation & transitions have an off switch. */
function checkReducedMotion(css) {
	const problems = [];
	const rules = parseRules(css);
	const reduce = rules.filter((r) => r.media && /prefers-reduced-motion:\s*reduce/.test(r.media));
	const outside = rules.filter((r) => !r.media || !/prefers-reduced-motion/.test(r.media));
	const resets = (property) =>
		declarationsOf(reduce, property).length > 0;

	const smooth = declarationsOf(outside, "scroll-behavior").some(({ value }) => /smooth/.test(value));
	if (smooth && !resets("scroll-behavior")) {
		problems.push("scroll-behavior: smooth has no prefers-reduced-motion reset.");
	}
	const moves = (property) =>
		declarationsOf(outside, property).some(({ value }) => !/^(none|0s?)\b/.test(value));
	if (moves("animation") && !resets("animation-duration")) {
		problems.push("Animations have no prefers-reduced-motion reset.");
	}
	if (moves("transition") && !resets("transition-duration")) {
		problems.push("Transitions have no prefers-reduced-motion reset.");
	}
	if (!reduce.length) problems.push("No prefers-reduced-motion: reduce rule found.");
	return problems;
}

/** Document structure: landmarks, language, skip link, heading order. */
function checkStructure(page) {
	const problems = [];
	const { document } = page;
	if (!document.documentElement.getAttribute("lang")) {
		problems.push(`${page.file}: <html> has no lang.`);
	}
	const mains = document.querySelectorAll("main, [role='main']");
	if (mains.length !== 1) problems.push(`${page.file}: expected one main, found ${mains.length}.`);

	const focusable = document.querySelector("a[href], button, input, select, textarea, [tabindex='0']");
	const target = focusable?.getAttribute("href");
	const skipOk =
		focusable?.localName === "a" &&
		target?.startsWith("#") &&
		document.getElementById(target.slice(1))?.localName === "main";
	if (!skipOk) problems.push(`${page.file}: the first focusable element is not a skip link to main.`);

	const levels = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => Number(h.localName[1]));
	if (levels.filter((l) => l === 1).length !== 1) {
		problems.push(`${page.file}: expected exactly one h1, found ${levels.filter((l) => l === 1).length}.`);
	}
	levels.forEach((level, i) => {
		const previous = levels[i - 1] ?? 0;
		if (level > previous + 1) {
			problems.push(`${page.file}: heading jumps from h${previous || "none"} to h${level}.`);
		}
	});
	return problems;
}

/**
 * Accessibility: axe-core on each page, plus the structural rules axe does not
 * cover. axe's color-contrast rule needs a layout engine, so contrast is
 * measured from the tokens in checkContrast instead.
 *
 * @param {import("./site.js").Site} site
 */
export async function checkAccessibility(site) {
	const problems = [];
	const notes = [];
	for (const page of site.pages) {
		const dom = new JSDOM(page.html, { runScripts: "outside-only", pretendToBeVisual: true });
		dom.window.eval(axe.source);
		const report = await dom.window.axe.run(dom.window.document, {
			rules: { "color-contrast": { enabled: false } },
		});
		notes.push(`${page.file}: axe ran ${report.passes.length} rules, ${report.violations.length} violations.`);
		for (const violation of report.violations) {
			problems.push(
				`${page.file}: axe ${violation.id} (${violation.impact}): ${violation.help} [${violation.nodes
					.map((n) => n.target.join(" "))
					.join(", ")}]`
			);
		}
		problems.push(...checkStructure(page));
	}
	const css = site.pages[0]?.css ?? "";
	problems.push(...checkFocusStyles(css), ...checkReducedMotion(css));
	return result("accessibility", "Accessibility", problems, notes);
}

/** Read a PNG's pixel size from its header, or null when it is not a PNG. */
export function pngSize(file) {
	const bytes = readFileSync(file);
	if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") return null;
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * Metadata: title, description, canonical, og:image & theme-color present,
 * every icon link resolves, & the social image is 1200 by 630.
 *
 * @param {import("./site.js").Site} site
 */
export function checkMetadata(site) {
	const problems = [];
	const notes = [];
	for (const page of site.pages) {
		const { document } = page;
		const meta = (selector) => document.querySelector(selector)?.getAttribute("content")?.trim();
		const link = (selector) => document.querySelector(selector)?.getAttribute("href")?.trim();

		if (!document.title?.trim()) problems.push(`${page.file}: missing <title>.`);
		if (!meta('meta[name="description"]')) problems.push(`${page.file}: missing meta description.`);
		if (!link('link[rel="canonical"]')) problems.push(`${page.file}: missing canonical link.`);
		if (!meta('meta[property="og:image"]')) problems.push(`${page.file}: missing og:image.`);
		if (!meta('meta[name="theme-color"]')) problems.push(`${page.file}: missing theme-color.`);

		const hrefs = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map(
			(l) => l.getAttribute("href")
		);
		if (!document.querySelector('link[rel~="icon"]')) problems.push(`${page.file}: no <link rel="icon">.`);
		for (const href of [...hrefs, meta('meta[property="og:image"]')].filter(Boolean)) {
			const resolved = site.resolveUrl(href, page.file);
			if (resolved?.outside) problems.push(`${page.file}: ${href} is outside the site base ${site.base}.`);
			else if (resolved && !resolved.file) problems.push(`${page.file}: ${href} does not resolve to a built file.`);
		}

		const social = site.resolveUrl(meta('meta[property="og:image"]'), page.file);
		if (social?.file) {
			const size = pngSize(social.file);
			if (!size || size.width !== 1200 || size.height !== 630) {
				problems.push(
					`${page.file}: og:image is ${size ? `${size.width}x${size.height}` : "not a PNG"}, expected 1200x630.`
				);
			}
		}

		const manifest = site.resolveUrl(link('link[rel="manifest"]'), page.file);
		if (manifest?.file) {
			const data = JSON.parse(readFileSync(manifest.file, "utf8"));
			for (const icon of data.icons ?? []) {
				const target = path.join(path.dirname(manifest.file), icon.src);
				if (!existsSync(target)) problems.push(`manifest icon ${icon.src} does not resolve.`);
			}
		}
		notes.push(`${page.file}: ${hrefs.length} icon links checked.`);
	}
	return result("metadata", "Metadata", problems, notes);
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/**
 * Studio layer: locked files match their hashes, & the banner, call to action
 * and footer credit are present, in place, with contact@ only in the call to action.
 *
 * @param {import("./site.js").Site} site
 */
export function checkStudioLayer(site) {
	const problems = [];
	const notes = [];
	const lockFile = path.join(site.siteDir, "tests", "studio.lock.json");
	if (!existsSync(lockFile)) {
		problems.push("tests/studio.lock.json is missing, so the studio layer cannot be verified.");
	} else {
		const lock = JSON.parse(readFileSync(lockFile, "utf8"));
		for (const [rel, hash] of Object.entries(lock)) {
			const file = path.join(site.siteDir, rel);
			if (!existsSync(file)) problems.push(`Studio file ${rel} is missing.`);
			else if (sha256(readFileSync(file)) !== hash) problems.push(`Studio file ${rel} was modified.`);
		}
		notes.push(`${Object.keys(lock).length} studio files match their locked hashes.`);
	}

	for (const page of site.pages) {
		const { document } = page;
		const one = (selector, label) => {
			const found = document.querySelectorAll(selector);
			if (found.length !== 1) problems.push(`${page.file}: expected one ${label}, found ${found.length}.`);
			return found[0];
		};
		const banner = one(".studio-banner", "studio banner");
		const cta = one(".studio-cta", "studio call to action");
		const credit = one(".studio-footer", "studio footer credit");
		const footer = document.querySelector("footer.site-footer");

		// 4 is DOCUMENT_POSITION_FOLLOWING: main must come after the banner.
		if (banner && !(banner.compareDocumentPosition(document.querySelector("main")) & 4)) {
			problems.push(`${page.file}: the studio banner must come before main.`);
		}
		if (banner && !banner.querySelector("img[alt]")) problems.push(`${page.file}: the banner image has no alt text.`);
		for (const [node, label] of [
			[cta, "call to action"],
			[credit, "footer credit"],
		]) {
			if (node && !footer?.contains(node)) problems.push(`${page.file}: the ${label} must be inside the footer.`);
		}
		if (credit && !credit.querySelector("img[alt]")) problems.push(`${page.file}: the footer credit has no alt text.`);

		const link = cta?.querySelector('a[href^="mailto:"]');
		if (link?.getAttribute("href") !== "mailto:contact@allons-y.studio") {
			problems.push(`${page.file}: the call to action must link to mailto:contact@allons-y.studio.`);
		}
		const withoutCta = new JSDOM(page.html);
		withoutCta.window.document.querySelector(".studio-cta")?.remove();
		if (/contact@/i.test(withoutCta.window.document.documentElement.outerHTML)) {
			problems.push(`${page.file}: contact@ appears outside the footer call to action.`);
		}
	}
	return result("studio", "Studio layer", problems, notes);
}

/** Declared font families of every @font-face, with whether each swaps. */
function fontFaces(css) {
	return parseRules(css)
		.filter((r) => r.selector === "@font-face")
		.map((r) => ({
			family: familiesOf(declarationsOf([r], "font-family")[0]?.value ?? "")[0],
			swap: /swap/.test(declarationsOf([r], "font-display")[0]?.value ?? ""),
		}));
}

/** Family names a Google Fonts css2 URL loads. */
export function googleFamilies(href) {
	return [...new URL(href).searchParams.getAll("family")].map((f) => f.split(":")[0].replace(/\+/g, " "));
}

/**
 * Typography: --font-mono is the shared mono, fonts load with swap, & no
 * loaded family goes unused.
 *
 * @param {import("./site.js").Site} site
 */
export function checkTypography(site) {
	const problems = [];
	const notes = [];
	const expected = familiesOf(MONO_STACK);
	for (const page of site.pages) {
		const rules = parseRules(page.css);
		const monoDeclarations = declarationsOf(rules, "--font-mono");
		if (monoDeclarations.length !== 1) {
			problems.push(`${page.file}: --font-mono is declared ${monoDeclarations.length} times; it is locked, declare it once (in tokens.css).`);
		}
		let mono = [];
		try {
			mono = familiesOf(resolveProperty(page.properties, "--font-mono", "light"));
		} catch (error) {
			problems.push(`${page.file}: ${error.message}`);
		}
		if (mono.join("|") !== expected.join("|")) {
			problems.push(`${page.file}: --font-mono is "${mono.join(", ")}", expected "${expected.join(", ")}".`);
		}

		const loaded = new Set();
		for (const node of page.document.querySelectorAll('link[href*="fonts.googleapis.com/css2"]')) {
			const href = node.getAttribute("href");
			if (new URL(href).searchParams.get("display") !== "swap") problems.push(`${page.file}: ${href} does not use display=swap.`);
			googleFamilies(href).forEach((f) => loaded.add(f));
		}
		for (const face of fontFaces(page.css)) {
			if (!face.swap) problems.push(`${page.file}: @font-face "${face.family}" lacks font-display: swap.`);
			loaded.add(face.family);
		}

		const used = new Set();
		for (const { value } of declarationsOf(rules, "font-family")) {
			try {
				familiesOf(resolveValue(page.properties, value, "light")).forEach((f) => used.add(f.toLowerCase()));
			} catch (error) {
				problems.push(`${page.file}: font-family: ${value}: ${error.message}`);
			}
		}
		for (const family of loaded) {
			if (!used.has(family.toLowerCase())) problems.push(`${page.file}: font family "${family}" is loaded but no rule uses it.`);
		}
		if (!loaded.has("PT Mono")) problems.push(`${page.file}: PT Mono is not loaded.`);
		notes.push(`${page.file}: loaded ${[...loaded].join(", ") || "none"}; --font-mono = ${mono.join(", ")}.`);
	}
	return result("typography", "Typography", problems, notes);
}

/** Licenses written out, so a template that hard-codes one is caught. */
const SPDX_PATTERN = /\b(?:MPL-2\.0|Apache-2\.0|MIT|ISC|BSD-[23]-Clause|GPL-[23]\.0(?:-or-later|-only)?|LGPL-[23]\.\d)\b/;

/** Policy: opx and envoy are Apache-2.0; everything else is MPL-2.0. */
export function expectedLicense(packageName) {
	const bare = String(packageName).replace(/^@[^/]+\//, "");
	return bare === "opx" || bare === "envoy" ? "Apache-2.0" : "MPL-2.0";
}

/**
 * License: the page shows the license from package.json, & no source file
 * writes one out.
 *
 * @param {import("./site.js").Site} site
 */
export function checkLicense(site) {
	const problems = [];
	const notes = [];
	const license = site.pkg.license;
	if (typeof license !== "string" || !license) problems.push("package.json has no license.");

	for (const page of site.pages) {
		const shown = [...page.document.querySelectorAll("[data-license]")].map((n) => n.textContent.trim());
		if (!shown.length) problems.push(`${page.file}: no element shows the license.`);
		for (const text of shown) {
			if (text !== license) problems.push(`${page.file}: shows license "${text}" but package.json says "${license}".`);
		}
	}

	const sources = [
		...walk(path.join(site.siteDir, "src")),
		...walk(path.join(site.siteDir, "lib")),
		path.join(site.siteDir, "eleventy.config.js"),
	].filter((f) => existsSync(f) && !/\/assets\/img\//.test(f));
	for (const file of sources) {
		const text = readFileSync(file, "utf8");
		const hit = SPDX_PATTERN.exec(text);
		if (hit) problems.push(`${path.relative(site.siteDir, file)} hard-codes the license "${hit[0]}"; read it from package.json.`);
	}

	const expected = expectedLicense(site.pkg.name);
	notes.push(
		license === expected
			? `License ${license} matches the studio default for ${site.pkg.name}.`
			: `License ${license} differs from the studio default ${expected} for ${site.pkg.name}: fine only as a deliberate opt-in.`
	);
	return result("license", "License", problems, notes);
}

/** Addresses & tags no page may carry. */
export const FORBIDDEN = [
	{ pattern: /[\w.+-]*@hey\.com\b|\bhey\.com\b/i, label: "a hey.com address" },
	{ pattern: /@(?:gmail|googlemail)\.com\b/i, label: "a Gmail address" },
	{ pattern: /@(?:icloud|me|mac)\.com\b/i, label: "an iCloud address" },
	{ pattern: /allons-y\.llc/i, label: "the allons-y.llc domain" },
	{ pattern: /castastrophe@/i, label: "a personal address" },
	{ pattern: /twitter:card/i, label: "a twitter:card tag" },
];

/** The only addresses the studio publishes. */
export const ALLOWED_ADDRESSES = [
	"contact@allons-y.studio",
	"report@allons-y.studio",
	"security@allons-y.studio",
];

/**
 * Forbidden addresses & tags, across the built output & the site sources.
 *
 * @param {import("./site.js").Site} site
 */
export function checkForbidden(site) {
	const problems = [];
	const notes = [];
	const files = [
		...site.files,
		...walk(path.join(site.siteDir, "src")),
		...walk(path.join(site.siteDir, "lib")),
	].filter((f) => TEXT_EXTENSIONS.has(path.extname(f)));
	const unknown = new Set();
	for (const file of new Set(files)) {
		const text = readFileSync(file, "utf8");
		const rel = path.relative(site.siteDir, file);
		for (const { pattern, label } of FORBIDDEN) {
			if (pattern.test(text)) problems.push(`${rel} contains ${label}.`);
		}
		for (const [address] of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
			if (!ALLOWED_ADDRESSES.includes(address.toLowerCase())) unknown.add(address);
		}
	}
	if (unknown.size) notes.push(`Other addresses present (check they are intended): ${[...unknown].join(", ")}.`);
	notes.push(`${new Set(files).size} files scanned.`);
	return result("forbidden", "Contacts", problems, notes);
}

/**
 * Flavor rules. Landing: a single page. Docs & Workspaces are recognized but
 * not yet built, so they are reported as skipped.
 *
 * @param {import("./site.js").Site} site
 * @param {string} [flavor]
 */
export function checkFlavor(site, flavor = site.project.flavor) {
	if (!FLAVOR_NAMES.includes(flavor)) {
		return result("flavor", "Flavor", [`project.json needs a flavor: one of ${FLAVOR_NAMES.join(", ")}.`]);
	}
	if (flavor !== "landing") {
		return {
			...result("flavor", "Flavor", [], [`The ${flavor} flavor is not yet built: no checks run.`]),
			skipped: true,
		};
	}
	const problems = [];
	if (site.pages.length !== 1) {
		problems.push(`Landing is a single page, found ${site.pages.length}: ${site.pages.map((p) => p.file).join(", ")}.`);
	}
	const page = site.pages.find((p) => p.file === "index.html");
	if (!page) problems.push("Landing needs an index.html.");
	else {
		if (!page.document.getElementById("install")) problems.push("Landing needs an #install section.");
		if (page.document.querySelector("aside, [role='search'], input[type='search']")) {
			problems.push("Landing has no sidebar or search: those belong to the Docs flavor.");
		}
	}
	return result("flavor", "Flavor", problems, [`Landing: ${site.pages.length} page.`]);
}

/**
 * Run every check.
 *
 * @param {import("./site.js").Site} site
 * @returns {Promise<ReturnType<typeof result>[]>}
 */
export async function runChecks(site) {
	return [
		checkContrast(site),
		await checkAccessibility(site),
		checkMetadata(site),
		checkStudioLayer(site),
		checkTypography(site),
		checkLicense(site),
		checkForbidden(site),
		checkFlavor(site),
	];
}

/** Plain-text report of check results. */
export function formatReport(results) {
	const lines = [];
	for (const r of results) {
		lines.push(`${r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL"}  ${r.title}`);
		for (const note of r.notes) lines.push(`      ${note}`);
		for (const problem of r.problems) lines.push(`    - ${problem}`);
	}
	return lines.join("\n");
}
