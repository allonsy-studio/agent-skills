#!/usr/bin/env node
/**
 * Build a setup-guide PDF from body-only HTML, then verify the result.
 *
 *     node scripts/build-guide.js body.html guide.pdf \
 *         --title "CS-230 Setup Guide" \
 *         --footer "CS-230 Web Development  |  Environment Setup Guide" \
 *         --accent "#1e40af"
 *
 * Write body content only. This script supplies the doctype, head, stylesheet and
 * page furniture. Do not include <html>, <head>, <style> or <body> tags in the input.
 *
 * The verification report at the end is the point of using this rather than calling
 * a renderer directly. It catches the failure modes that survive visual review:
 * commands that wrap across lines and break when copied, callout bloat, unresolved
 * placeholders, and troubleshooting entries that will not be findable. Those checks
 * run with no renderer installed, so `--html-only` is always available.
 *
 * Rendering is delegated to whichever engine is on the machine. Prefer WeasyPrint:
 * the stylesheet uses CSS margin boxes (`@bottom-left`, `counter(pages)`) for the
 * footer and page numbers, and headless Chrome silently drops them.
 *
 *     pipx install weasyprint      # or: pip install weasyprint
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";

import { buildHtml, verify } from "./verify-guide.js";

const USAGE = `Usage: node scripts/build-guide.js <body.html> <output.pdf> [options]

  --title <text>     document title (default: "Setup Guide")
  --footer <text>    running footer text (default: the title)
  --accent <color>   accent color, any CSS color (default: "#1e40af")
  --keep-html <path> also write the assembled HTML here
  --html-only        assemble and verify, but do not render a PDF
  --renderer <path>  explicit renderer binary (weasyprint, or a Chrome build)
  --help             show this message

Rendering prefers WeasyPrint, which supports the CSS margin boxes this
stylesheet uses for the footer and page numbers. Headless Chrome is used as a
fallback and drops them.
`;

/** Chrome builds to try, in order, when WeasyPrint is not installed. */
const CHROME_CANDIDATES = [
	process.env.PUPPETEER_EXECUTABLE_PATH,
	process.env.CHROME_PATH,
	"/opt/pw-browsers/chromium",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/usr/bin/google-chrome",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

/**
 * Is `command` runnable, and does it respond to `--version`?
 *
 * @param {string} command
 * @param {string[]} [args]
 * @returns {boolean}
 */
function runnable(command, args = ["--version"]) {
	const result = spawnSync(command, args, { stdio: "ignore" });
	return !result.error && result.status === 0;
}

/**
 * @typedef {Object} Renderer
 * @property {string} name
 * @property {(html: string, output: string) => void} render
 * @property {string} [caveat]
 */

/**
 * Render through WeasyPrint, which honours the stylesheet's margin boxes.
 *
 * @param {string[]} command argv prefix, e.g. ["weasyprint"] or ["python3", "-m", "weasyprint"]
 * @returns {Renderer}
 */
function weasyprintRenderer(command) {
	return {
		name: command.join(" "),
		render(html, output) {
			const result = spawnSync(
				command[0],
				[...command.slice(1), "-", output],
				{ input: html, stdio: ["pipe", "inherit", "inherit"] }
			);
			if (result.status !== 0) {
				throw new Error(
					`${command.join(" ")} exited with status ${result.status}.`
				);
			}
		},
	};
}

/**
 * Render through headless Chrome. Chrome has no support for CSS margin boxes,
 * so the running footer and "Page N of M" are lost.
 *
 * @param {string} binary
 * @returns {Renderer}
 */
function chromeRenderer(binary) {
	return {
		name: binary,
		caveat:
			"Chrome does not support CSS margin boxes, so the running footer and " +
			"page numbers are missing. Install WeasyPrint for a print-ready PDF.",
		render(html, output) {
			const dir = mkdtempSync(join(tmpdir(), "devenv-guide-"));
			const page = join(dir, "guide.html");
			writeFileSync(page, html, "utf8");
			const result = spawnSync(
				binary,
				[
					"--headless",
					"--disable-gpu",
					"--no-sandbox",
					"--no-pdf-header-footer",
					`--print-to-pdf=${resolvePath(output)}`,
					`file://${page}`,
				],
				// Chrome writes pages of dbus and GPU noise to stderr on a
				// headless box. Hold it back unless the render actually failed.
				{ stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" }
			);
			if (result.status !== 0) {
				if (result.stderr) process.stderr.write(result.stderr);
				throw new Error(
					`${binary} exited with status ${result.status}.`
				);
			}
		},
	};
}

/**
 * @param {string} [explicit] a renderer named on the command line
 * @returns {Renderer|null}
 */
function findRenderer(explicit) {
	if (explicit) {
		const isChrome = /chrom(e|ium)/i.test(explicit);
		return isChrome
			? chromeRenderer(explicit)
			: weasyprintRenderer([explicit]);
	}
	if (runnable("weasyprint")) return weasyprintRenderer(["weasyprint"]);
	if (runnable("python3", ["-m", "weasyprint", "--version"])) {
		return weasyprintRenderer(["python3", "-m", "weasyprint"]);
	}
	for (const candidate of CHROME_CANDIDATES) {
		if (existsSync(candidate) || runnable(candidate)) {
			return chromeRenderer(candidate);
		}
	}
	return null;
}

function main() {
	let values;
	let positionals;
	try {
		({ values, positionals } = parseArgs({
			args: process.argv.slice(2),
			allowPositionals: true,
			options: {
				title: { type: "string" },
				footer: { type: "string" },
				accent: { type: "string", default: "#1e40af" },
				"keep-html": { type: "string" },
				"html-only": { type: "boolean", default: false },
				renderer: { type: "string" },
				help: { type: "boolean", default: false },
			},
		}));
	} catch (err) {
		console.error(err.message);
		console.error(USAGE);
		return 2;
	}

	if (values.help) {
		console.log(USAGE);
		return 0;
	}

	const [bodyPath, output] = positionals;
	if (!bodyPath || (!output && !values["html-only"])) {
		console.error(USAGE);
		return 2;
	}

	const title = values.title ?? "Setup Guide";
	const body = readFileSync(bodyPath, "utf8");
	const html = buildHtml(body, {
		title,
		footer: values.footer ?? title,
		accent: values.accent,
	});

	if (values["keep-html"]) {
		writeFileSync(values["keep-html"], html, "utf8");
	}

	let rendered = false;
	if (!values["html-only"]) {
		const renderer = findRenderer(values.renderer);
		if (!renderer) {
			console.error(
				"\nNo PDF renderer found. Install WeasyPrint (`pipx install weasyprint`),\n" +
					"pass one with --renderer, or re-run with --html-only and print the HTML\n" +
					"from a browser. The verification report below still applies.\n"
			);
		} else {
			try {
				renderer.render(html, output);
				rendered = true;
				console.log(`\nWrote ${output}  (via ${renderer.name})`);
				if (renderer.caveat) console.log(`  note: ${renderer.caveat}`);
			} catch (err) {
				console.error(`\nRendering failed: ${err.message}`);
			}
		}
	}

	console.log("=".repeat(62));
	const { ok, report } = verify(body);
	console.log(report);

	if (!ok) return 1;
	if (!values["html-only"] && !rendered) return 1;
	return 0;
}

process.exitCode = main();
