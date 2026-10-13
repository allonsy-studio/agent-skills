// Eleventy configuration for the studio project landing site. Core layer:
// shared by every project, so project-specific values belong in
// src/_data/project.json, never here.
//
// Build:  SITE_BASE=/my-project/ eleventy --config=docs/eleventy.config.js
// SITE_BASE is the path the site is served from (default "/"). The Pages
// workflow sets it for production & for each pull request preview.

import path from "node:path";

import { HtmlBasePlugin } from "@11ty/eleventy";
import webc from "@11ty/eleventy-plugin-webc";

import { highlight } from "./lib/highlight.js";

// Eleventy resolves these relative to the working directory; anchoring them
// to this file lets the build run from the repository root or from docs/.
const here = path.relative(process.cwd(), import.meta.dirname) || ".";
const at = (...parts) => path.posix.join(here.split(path.sep).join("/"), ...parts);

const pathPrefix = process.env.SITE_BASE || "/";

/** @param {import("@11ty/eleventy").UserConfig} config */
export default function (config) {
	config.addPlugin(webc, { components: at("src/_components/**/*.webc") });
	// Prefix root-relative URLs with the base path, for GitHub Pages project
	// sites & pull request previews.
	config.addPlugin(HtmlBasePlugin);

	config.addJavaScriptFunction("highlight", highlight);

	// Component source comments are for maintainers, not for the page.
	config.addTransform("strip-comments", function (content) {
		return this.page.outputPath?.endsWith(".html")
			? content.replace(/<!--[\s\S]*?-->/g, "")
			: content;
	});

	config.addPassthroughCopy({ [at("src/assets")]: "assets" });

	return {
		pathPrefix,
		dir: {
			input: at("src"),
			output: at("_site"),
			includes: "_includes",
			data: "_data",
		},
		templateFormats: ["md", "webc"],
	};
}
