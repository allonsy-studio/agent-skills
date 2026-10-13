// Load a built site for the brand checks: its pages, the stylesheets each page
// uses (in cascade order), the project layer, & the package facts.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

import { parseRootProperties } from "../../lib/css-tokens.js";

/** Files scanned as text when looking for forbidden strings. */
export const TEXT_EXTENSIONS = new Set([
	".html",
	".css",
	".js",
	".json",
	".svg",
	".webmanifest",
	".md",
	".webc",
	".txt",
]);

/** @param {string} dir @returns {string[]} files under dir, absolute */
export function walk(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out.sort();
}

/** @typedef {ReturnType<typeof loadSite>} Site */

/**
 * @param {{
 *   siteDir: string,
 *   packagePath?: string,
 *   base?: string,
 * }} options siteDir is the site directory (e.g. `docs`); base is the path the build was served from
 */
export function loadSite({
	siteDir,
	packagePath = path.join(siteDir, "..", "package.json"),
	base = process.env.SITE_BASE || "/",
}) {
	const outDir = path.join(siteDir, "_site");
	if (!existsSync(outDir)) {
		throw new Error(
			`No built site at ${outDir}. Build it first (yarn docs:build), then run the checks.`
		);
	}
	const normalizedBase = base.replace(/\/?$/, "/");
	const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
	const projectPath = path.join(siteDir, "src", "_data", "project.json");
	const project = JSON.parse(readFileSync(projectPath, "utf8"));

	/** Output file for a URL as the page would request it, or null when external. */
	const resolveUrl = (href, pageFile = "index.html") => {
		if (!href || href.startsWith("#") || /^(mailto|tel|data):/.test(href)) {
			return null;
		}
		let pathname;
		if (/^https?:\/\//.test(href)) {
			// Absolute URLs to this site's own canonical host map into the output.
			const own = new URL(
				readCanonicalFallback(outDir) ?? "https://invalid.example/"
			);
			const url = new URL(href);
			if (url.origin !== own.origin) return null;
			pathname = url.pathname.startsWith(own.pathname)
				? "/" + url.pathname.slice(own.pathname.length)
				: url.pathname;
			return toFile(outDir, pathname);
		}
		if (href.startsWith("/")) {
			if (!href.startsWith(normalizedBase)) return { file: null, outside: true };
			pathname = "/" + href.slice(normalizedBase.length);
		} else {
			const dir = path.posix.dirname("/" + pageFile);
			pathname = path.posix.resolve(dir, href);
		}
		return toFile(outDir, pathname);
	};

	const pages = walk(outDir)
		.filter((file) => file.endsWith(".html"))
		.map((file) => {
			const rel = path.relative(outDir, file).split(path.sep).join("/");
			const html = readFileSync(file, "utf8");
			const dom = new JSDOM(html);
			return { file: rel, html, document: dom.window.document, dom };
		});

	for (const page of pages) {
		page.styles = pageStyles(page, resolveUrl, outDir);
		page.css = page.styles.map((s) => s.css).join("\n");
		page.properties = parseRootProperties(page.css);
	}

	return {
		siteDir,
		outDir,
		base: normalizedBase,
		pkg,
		project,
		pages,
		resolveUrl,
		files: walk(outDir),
	};
}

/** The canonical URL from the first built page, used to recognize absolute links to the site. */
function readCanonicalFallback(outDir) {
	const index = path.join(outDir, "index.html");
	if (!existsSync(index)) return null;
	const match = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(
		readFileSync(index, "utf8")
	);
	return match ? match[1] : null;
}

function toFile(outDir, pathname) {
	const clean = decodeURIComponent(pathname.split(/[?#]/)[0]);
	const candidates = clean.endsWith("/")
		? [path.join(outDir, clean, "index.html")]
		: [path.join(outDir, clean), path.join(outDir, clean, "index.html")];
	const file = candidates.find((c) => existsSync(c) && statSync(c).isFile());
	return { file: file ?? null, outside: false, tried: candidates[0] };
}

/** Stylesheets & inline styles of a page, in document (cascade) order. */
function pageStyles(page, resolveUrl, outDir) {
	const styles = [];
	for (const node of page.document.querySelectorAll(
		'link[rel~="stylesheet"], style'
	)) {
		if (node.localName === "style") {
			styles.push({ source: "inline", css: node.textContent ?? "" });
			continue;
		}
		const resolved = resolveUrl(node.getAttribute("href"), page.file);
		if (resolved?.file) {
			styles.push({
				source: path.relative(outDir, resolved.file).split(path.sep).join("/"),
				css: readFileSync(resolved.file, "utf8"),
			});
		}
	}
	return styles;
}
