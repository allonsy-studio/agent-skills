// Builds the landing fixture with Eleventy and runs the brand & accessibility
// suite against it, then breaks copies of the build to prove each check fails
// when it should. The suite is itself tested.

import assert from "node:assert/strict";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import sharp from "sharp";

import { defineBrandSuite } from "../templates/core/tests/lib/suite.js";
import {
	checkAccessibility,
	checkContrast,
	checkFlavor,
	checkForbidden,
	checkLicense,
	checkMetadata,
	checkStudioLayer,
	checkTypography,
	expectedLicense,
	formatReport,
	runChecks,
} from "../templates/core/tests/lib/checks.js";
import { loadSite } from "../templates/core/tests/lib/site.js";
import { audit } from "../scripts/audit.js";
import { buildFixtureSite, CACHE } from "./helpers/build-site.js";

const BASE = "/example-cli/";
const landing = await buildFixtureSite({ name: "landing", base: BASE });
const variant = await buildFixtureSite({
	name: "variant",
	base: "/envoy/",
	package: { name: "envoy", license: "Apache-2.0" },
	project: {
		accent: "#ffd23f",
		fonts: { sans: { family: "Inter" }, display: { family: "Fraunces", weights: [700] } },
	},
});

// The suite a project runs, against two real builds.
describe("landing fixture", () => defineBrandSuite({ siteDir: landing.siteDir, base: BASE }));
describe("variant: Apache license, yellow accent, project fonts", () =>
	defineBrandSuite({ siteDir: variant.siteDir, base: "/envoy/" }));

describe("the built landing page", () => {
	const site = loadSite({ siteDir: landing.siteDir, base: BASE });
	const page = site.pages[0].document;

	test("is one page with the studio banner, call to action & credit", () => {
		assert.deepEqual(site.pages.map((p) => p.file), ["index.html"]);
		assert.equal(page.querySelectorAll(".studio-banner, .studio-cta, .studio-footer").length, 3);
	});

	test("reads license & repo from package.json", () => {
		assert.equal(page.querySelector("[data-license]").textContent, "MPL-2.0");
		assert.match(page.querySelector(".site-footer a[data-license]").href, /allonsy-studio\/example-cli\/blob\/main\/LICENSE$/);
	});

	test("prefixes every root-relative URL with the site base", () => {
		for (const el of page.querySelectorAll("[href^='/'], [src^='/'], [srcset^='/']")) {
			const value = el.getAttribute("href") ?? el.getAttribute("src") ?? el.getAttribute("srcset");
			assert.ok(value.startsWith(BASE), value);
		}
	});

	test("the variant uses its own license, fonts & computed accent", () => {
		const v = loadSite({ siteDir: variant.siteDir, base: "/envoy/" });
		assert.equal(v.pages[0].document.querySelector("[data-license]").textContent, "Apache-2.0");
		assert.match(v.pages[0].css, /--font-display: "Fraunces"/);
		assert.match(v.pages[0].css, /--on-accent: #101216;/);
		assert.equal(expectedLicense("envoy"), "Apache-2.0");
		assert.equal(expectedLicense("@allons-y/example-cli"), "MPL-2.0");
	});

	test("audit prints a passing report", async () => {
		const { ok, results } = await audit({ site: landing.siteDir, base: BASE });
		assert.equal(ok, true);
		const report = formatReport(results);
		assert.match(report, /PASS {2}Contrast/);
		assert.match(report, /light --on-accent #ffffff on --accent #2346d4: 7\.25:1/);
	});

	test("the base path must match the build", () => {
		const wrong = loadSite({ siteDir: landing.siteDir, base: "/other/" });
		const result = checkMetadata(wrong);
		assert.equal(result.ok, false);
		assert.match(result.problems[0], /outside the site base/);
	});

	test("loading explains a missing build", () => {
		assert.throws(() => loadSite({ siteDir: path.join(CACHE, "nothing-here") }), /No built site/);
	});
});

/**
 * Copy the landing build, break it, & load it.
 *
 * @param {string} name
 * @param {(ctx: { out: string, src: string, edit: (rel: string, fn: (text: string) => string) => void }) => void | Promise<void>} mutate
 */
async function broken(name, mutate) {
	const target = path.join(CACHE, `broken-${name}`);
	rmSync(target, { recursive: true, force: true });
	cpSync(landing.root, target, { recursive: true });
	const siteDir = path.join(target, "docs");
	const out = path.join(siteDir, "_site");
	const edit = (rel, fn) => {
		const file = path.join(rel.startsWith("src/") || rel.startsWith("tests/") ? siteDir : out, rel);
		writeFileSync(file, fn(readFileSync(file, "utf8")));
	};
	await mutate({ out, src: path.join(siteDir, "src"), edit });
	return loadSite({ siteDir, base: BASE });
}

const fails = (result, pattern) => {
	assert.equal(result.ok, false, `expected a failure matching ${pattern}`);
	assert.ok(
		result.problems.some((p) => pattern.test(p)),
		`no problem matched ${pattern}:\n${result.problems.join("\n")}`
	);
};

describe("the suite fails when the baseline is broken", () => {
	test("contrast: a muted color below 4.5:1, with the hex values printed", async () => {
		const site = await broken("contrast", ({ edit }) =>
			edit("assets/css/tokens.css", (t) => t.replace(/--fg-muted: light-dark\([^)]*\)/, "--fg-muted: light-dark(#bbbbbb, #333333)"))
		);
		const result = checkContrast(site);
		fails(result, /light --fg-muted #bbbbbb on --bg #ffffff: 1\.9\d:1/);
		fails(result, /dark --fg-muted #333333/);
	});

	test("contrast: a text color no pair covers", async () => {
		const site = await broken("uncovered", ({ edit }) =>
			edit("assets/css/layout.css", (t) => `${t}\n.x { color: var(--border); }\n`)
		);
		fails(checkContrast(site), /no contrast pair covers --border/);
	});

	test("contrast: a token that does not resolve", async () => {
		const site = await broken("unresolved", ({ edit }) =>
			edit("assets/css/tokens.css", (t) => t.replace(/--code-bg: [^;]*;/, "--code-bg: hsl(0 0% 90%);"))
		);
		fails(checkContrast(site), /Invalid color/);
	});

	test("accessibility: missing lang, skip link, main, heading order & alt text", async () => {
		const site = await broken("a11y", ({ edit }) =>
			edit("index.html", (h) =>
				h
					.replace('<html lang="en">', "<html>")
					.replace(/<a href="#main" class="skip-link">[^<]*<\/a>/, "")
					.replace("<main ", "<div ")
					.replace("</main>", "</div>")
					.replace('<h2 id="install-title">', '<h4 id="install-title">')
					.replace("</h2>", "</h4>")
					.replace("</body>", '<img src="/example-cli/assets/img/favicon.svg"></body>')
			)
		);
		const result = await checkAccessibility(site);
		fails(result, /<html> has no lang/);
		fails(result, /expected one main, found 0/);
		fails(result, /not a skip link/);
		fails(result, /heading jumps from h1 to h4/);
		fails(result, /axe image-alt/);
	});

	test("accessibility: a second h1", async () => {
		const site = await broken("h1", ({ edit }) => edit("index.html", (h) => h.replace("<h3", "<h1").replace("</h3>", "</h1>")));
		fails(await checkAccessibility(site), /expected exactly one h1, found 2/);
	});

	test("accessibility: removed focus outline & missing reduced-motion reset", async () => {
		const site = await broken("css-a11y", ({ edit }) => {
			edit("assets/css/layout.css", (t) => t.replace(/:focus-visible \{[^}]*\}/, ":focus-visible { outline: none; }"));
			edit("assets/css/reset.css", (t) => t.replace(/@media \(prefers-reduced-motion: reduce\)[\s\S]*$/, ""));
		});
		const result = await checkAccessibility(site);
		fails(result, /No :focus-visible rule draws an outline/);
		fails(result, /removes the focus outline/);
		fails(result, /scroll-behavior: smooth has no prefers-reduced-motion reset/);
		fails(result, /No prefers-reduced-motion: reduce rule found/);
	});

	test("metadata: missing description, canonical, theme-color & a broken icon", async () => {
		const site = await broken("meta", ({ edit, out }) => {
			edit("index.html", (h) =>
				h
					.replace(/<meta name="description"[^>]*>/, "")
					.replace(/<link rel="canonical"[^>]*>/, "")
					.replace(/<meta name="theme-color"[^>]*>/, "")
			);
			rmSync(path.join(out, "assets/img/favicon-32.png"));
			rmSync(path.join(out, "assets/img/icon-192.png"));
		});
		const result = checkMetadata(site);
		fails(result, /missing meta description/);
		fails(result, /missing canonical/);
		fails(result, /missing theme-color/);
		fails(result, /favicon-32\.png does not resolve/);
		fails(result, /manifest icon icon-192\.png does not resolve/);
	});

	test("metadata: a social image of the wrong size", async () => {
		const site = await broken("og", async ({ out }) => {
			await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } })
				.png()
				.toFile(path.join(out, "assets/img/og-image.png"));
		});
		fails(checkMetadata(site), /og:image is 10x10, expected 1200x630/);
	});

	test("studio layer: an edited locked file, a removed banner & contact@ elsewhere", async () => {
		const site = await broken("studio", ({ edit }) => {
			edit("src/_components/studio-cta.webc", (t) => t.replace("Studio layer", "My layer"));
			edit("index.html", (h) =>
				h
					.replace(/<a href="https:\/\/allons-y\.studio" class="studio-banner">[\s\S]*?<\/a>/, "")
					.replace("<main ", '<p>contact@allons-y.studio</p><main ')
			);
		});
		const result = checkStudioLayer(site);
		fails(result, /studio-cta\.webc was modified/);
		fails(result, /expected one studio banner, found 0/);
		fails(result, /contact@ appears outside the footer call to action/);
	});

	test("studio layer: a missing lock file, a call to action outside the footer", async () => {
		const site = await broken("studio-lock", ({ src, edit }) => {
			rmSync(path.join(src, "..", "tests", "studio.lock.json"));
			edit("index.html", (h) => {
				const cta = /<div class="studio-cta">[\s\S]*?<\/div>/.exec(h)[0];
				return h.replace(cta, "").replace("<main ", `${cta}<main `);
			});
		});
		const result = checkStudioLayer(site);
		fails(result, /studio\.lock\.json is missing/);
		fails(result, /call to action must be inside the footer/);
	});

	test("studio layer: the call to action must point at the studio address", async () => {
		const site = await broken("studio-mail", ({ edit }) =>
			edit("index.html", (h) => h.replace('href="mailto:contact@allons-y.studio"', 'href="mailto:sales@example.com"'))
		);
		fails(checkStudioLayer(site), /must link to mailto:contact@allons-y\.studio/);
	});

	test("typography: a redeclared mono, an unused font, a missing swap", async () => {
		const site = await broken("type", ({ edit }) => {
			edit("assets/css/components.css", (t) => `${t}\n:root { --font-mono: "Fira Code", monospace; }\n`);
			edit("index.html", (h) =>
				h.replace("family=PT+Mono&amp;display=swap", "family=PT+Mono&amp;family=Lobster")
			);
		});
		const result = checkTypography(site);
		fails(result, /--font-mono is declared 2 times/);
		fails(result, /expected "PT Mono, ui-monospace/);
		fails(result, /does not use display=swap/);
		fails(result, /"Lobster" is loaded but no rule uses it/);
	});

	test("typography: PT Mono must be loaded", async () => {
		const site = await broken("no-ptmono", ({ edit }) =>
			edit("index.html", (h) => h.replace(/<link[^>]*googleapis\.com\/css2[^>]*>/, ""))
		);
		fails(checkTypography(site), /PT Mono is not loaded/);
	});

	test("license: a page that disagrees with package.json, or hard-codes a license", async () => {
		const site = await broken("license", ({ edit }) => {
			edit("index.html", (h) => h.replace(/(<span data-license="">)MPL-2\.0/, "$1MIT"));
			edit("src/_includes/layouts/landing.webc", (t) => `${t}\n<p>Apache-2.0</p>`);
		});
		const result = checkLicense(site);
		fails(result, /shows license "MIT" but package.json says "MPL-2.0"/);
		fails(result, /hard-codes the license "Apache-2\.0"/);
	});

	test("license: nothing on the page shows it", async () => {
		const site = await broken("no-license", ({ edit }) =>
			edit("index.html", (h) => h.replaceAll(" data-license=\"\"", ""))
		);
		fails(checkLicense(site), /no element shows the license/);
	});

	test("forbidden: personal addresses, the .llc domain & a twitter card", async () => {
		const site = await broken("forbidden", ({ edit }) =>
			edit("index.html", (h) =>
				h.replace(
					"</head>",
					'<meta name="twitter:card" content="summary"></head>'
				).replace(
					"<main ",
					'<p>cassie@hey.com cassie@gmail.com cassie@icloud.com castastrophe@example.org consulting@allons-y.llc other@example.com</p><main '
				)
			)
		);
		const result = checkForbidden(site);
		for (const label of ["a hey.com address", "a Gmail address", "an iCloud address", "the allons-y.llc domain", "a personal address", "a twitter:card tag"]) {
			fails(result, new RegExp(label.replace(/\./g, "\\.")));
		}
		assert.match(result.notes.join(" "), /other@example\.com/);
	});

	test("forbidden: an address in a source file counts too", async () => {
		const site = await broken("forbidden-src", ({ edit }) =>
			edit("src/_data/studio.js", (t) => `${t}\n// reports@allons-y.llc\n`)
		);
		fails(checkForbidden(site), /studio\.js contains the allons-y\.llc domain/);
	});

	test("flavor: landing is a single page without a sidebar or search", async () => {
		const site = await broken("flavor", ({ out, edit }) => {
			writeFileSync(path.join(out, "extra.html"), "<!doctype html><title>x</title>");
			edit("index.html", (h) => h.replace("<main ", '<aside>nav</aside><main ').replace('id="install"', 'id="setup"'));
		});
		const result = checkFlavor(site);
		fails(result, /single page, found 2/);
		fails(result, /needs an #install section/);
		fails(result, /no sidebar or search/);
	});

	test("flavor: docs & workspaces are recognized but skipped as not yet built; unknown is an error", async () => {
		const site = loadSite({ siteDir: landing.siteDir, base: BASE });
		for (const flavor of ["docs", "workspaces"]) {
			const result = checkFlavor(site, flavor);
			assert.equal(result.skipped, true);
			assert.match(result.notes[0], /not yet built/);
		}
		fails(checkFlavor(site, "blog"), /needs a flavor/);
	});

	test("runChecks reports every area", async () => {
		const results = await runChecks(loadSite({ siteDir: landing.siteDir, base: BASE }));
		assert.deepEqual(results.map((r) => r.id), [
			"contrast",
			"accessibility",
			"metadata",
			"studio",
			"typography",
			"license",
			"forbidden",
			"flavor",
		]);
		assert.ok(results.every((r) => r.ok));
	});
});
