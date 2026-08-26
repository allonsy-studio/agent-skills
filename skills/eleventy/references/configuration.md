# Eleventy v3 configuration

Everything that lives in `eleventy.config.js`: file shape, directories,
formats, copying, ignoring, watching, serving, events, transforms, CLI,
and the plugins bundled with core.

## Contents

- [Config file names and shapes](#config-file-names-and-shapes)
- [Directories](#directories)
- [Template formats](#template-formats)
- [Passthrough copy](#passthrough-copy)
- [Ignores](#ignores)
- [Watch and serve](#watch-and-serve)
- [Events](#events)
- [Transforms and preprocessors](#transforms-and-preprocessors)
- [Environment variables](#environment-variables)
- [CLI](#cli)
- [Plugins bundled with core](#plugins-bundled-with-core)

## Config file names and shapes

Search order (first found wins): `.eleventy.js`, `eleventy.config.js`,
`eleventy.config.mjs` (v3+), `eleventy.config.cjs`. Override with
`--config=path.js` (v3 errors if the file doesn't exist).

The preferred shape is a callback — ESM and async supported in v3:

```js
/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */
export default async function (eleventyConfig) {
	// full Configuration API available here
}

// Static options go in a NAMED export, not the return value:
export const config = {
	dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
	markdownTemplateEngine: "njk", // default "liquid"; false disables preprocessing
	htmlTemplateEngine: "njk",     // default "liquid"
	pathPrefix: "/",
};
```

CJS projects use `module.exports = function (eleventyConfig) {}` plus
`module.exports.config = {…}`. Returning the options object from the
callback also works but is discouraged for order-of-operations reasons.
There is no `defineConfig()` helper in core.

## Directories

Defaults: `input: "."`, `output: "_site"`, `includes: "_includes"`,
`data: "_data"`, `layouts` falls back to the includes dir. **Includes,
data, and layouts are relative to the input directory**; input and output
are relative to the project root.

v3 setter methods — order matters, put these at the top of the config:

```js
eleventyConfig.setInputDirectory("src");
eleventyConfig.setOutputDirectory("dist");
eleventyConfig.setIncludesDirectory("_includes"); // relative to input
eleventyConfig.setLayoutsDirectory("_layouts");   // relative to input
eleventyConfig.setDataDirectory("_data");         // relative to input
```

A separate layouts dir is optional; use it when you want layouts out of
the includes namespace.

## Template formats

```js
eleventyConfig.setTemplateFormats(["md", "njk", "html", "11ty.js"]); // replace
eleventyConfig.addTemplateFormats("webc");                           // append
```

Default set: `html,liquid,ejs,md,hbs,mustache,haml,pug,njk,11ty.js`.
Listing `"css"` or `"js"` here treats those files as templates copied to
output — a zero-dependency way to ship assets (see
`assets-and-performance.md` for the full ladder).

## Passthrough copy

Copy files to output without processing:

```js
eleventyConfig.addPassthroughCopy("src/img");            // path relative to project root;
                                                         // input-dir prefix stripped → _site/img
eleventyConfig.addPassthroughCopy({ "vendor/x.css": "assets/x.css" }); // input → output target
eleventyConfig.addPassthroughCopy("**/*.jpg");           // globs work (slower)
// Glob + target FLATTENS matched files into the target dir — structure is not preserved.
```

Second-argument options: `expand` (symlinks), `debug`, `failOnError`,
`dot`, `copyOptions`, and `mode: "html-relative"` (v3.1+ — copy only
files actually referenced by `href`/`src`/`srcset` in template output).

During `--serve`, files can be served in place instead of copied:
`eleventyConfig.setServerPassthroughCopyBehavior("passthrough")` —
reverts to real copying for production builds.

## Ignores

```js
eleventyConfig.ignores.add("README.md");    // a JS Set — add/delete
eleventyConfig.watchIgnores.add("scratch/**"); // watch-only ignores, separate Set
```

- `**/node_modules/**` is always ignored.
- `.gitignore` (project root) is honored **by default** — a common
  surprise when content is gitignored. Opt out with
  `eleventyConfig.setUseGitIgnore(false)` (then list `node_modules`
  yourself in `.eleventyignore`).
- `.eleventyignore` files are read from the project root and the input
  directory.

## Watch and serve

```js
eleventyConfig.addWatchTarget("./src/scss/");   // rebuild when these change
eleventyConfig.addWatchTarget("./_config/**", { resetConfig: true }); // v3: re-run config
eleventyConfig.setWatchJavaScriptDependencies(false); // stop spidering JS deps
eleventyConfig.setWatchThrottleWaitTime(100);
eleventyConfig.setChokidarConfig({ usePolling: true, interval: 500 }); // WSL/network drives

eleventyConfig.setServerOptions({
	port: 8080,          // auto-increments if busy
	liveReload: true,
	domDiff: true,       // morph the DOM instead of full reload; disable if it fights your JS
	watch: [],           // extra globs that trigger a browser update without a build
	showAllHosts: false, // print LAN IPs
	https: {},           // { key, cert }
	onRequest: {},       // { "URLPattern pathname": handler } — dev-only request handlers
});
```

## Events

```js
eleventyConfig.on("eleventy.before", async ({ directories, runMode, outputMode }) => {});
eleventyConfig.on("eleventy.after", async ({ directories, results, runMode, outputMode }) => {
	// results: [{ inputPath, outputPath, url, content }]
});
eleventyConfig.on("eleventy.beforeWatch", async (changedFiles) => {}); // re-runs only
```

`runMode` is `"build" | "watch" | "serve"`; `outputMode` is
`"fs" | "json" | "ndjson"`. Use `eleventy.before` for pre-build codegen
(e.g. compiling CSS with esbuild/Sass) and `eleventy.after` for
post-processing output. Async callbacks are awaited.

## Transforms and preprocessors

Transforms post-process rendered output before it's written:

```js
eleventyConfig.addTransform("htmlmin", async function (content) {
	if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
		return minify(content);
	}
	return content; // always return content
});
```

`this.page.outputPath` is `false` when `permalink: false`. Transforms run
on every build for every page — keep them fast and memoize expensive work
(minification is the classic build-time killer).

## Environment variables

Supplied by Eleventy on `process.env` (readable in config, JS data files,
and JS templates): `ELEVENTY_ROOT`, `ELEVENTY_SOURCE` (`cli`/`script`),
`ELEVENTY_RUN_MODE` (`build`/`serve`/`watch`), `ELEVENTY_VERSION` (v3+).

`ELEVENTY_ENV` is a **user convention**, not built-in — set it yourself
(`cross-env ELEVENTY_ENV=production eleventy`). Expose env values to
non-JS templates via a data file:

```js
// _data/env.js
export default {
	isProduction: process.env.ELEVENTY_RUN_MODE === "build",
};
```

Prefer `ELEVENTY_RUN_MODE` over a custom var when "dev vs prod" really
means "serve vs build".

## CLI

```
npx @11ty/eleventy                      # build to _site
npx @11ty/eleventy --serve --port=8081  # dev server + watch
npx @11ty/eleventy --watch              # rebuild only, no server
--input=src --output=dist               # config file preferred over flags
--formats=md,njk                        # restrict formats ('--formats=' disables all, v3)
--pathprefix=/repo-name/                # subdirectory deploys (pairs with HtmlBasePlugin)
--incremental                           # only rebuild what changed
--incremental=path/to/file.md           # build one file + dependents (v3)
--ignore-initial                        # skip the startup build (with --watch/--serve)
--dryrun                                # run everything, write nothing
--quiet                                 # less logging
--to=json | --to=ndjson                 # emit build results as data instead of files
```

## Plugins bundled with core

Named exports from `"@11ty/eleventy"` — no install, but each needs
explicit `addPlugin`:

```js
import {
	HtmlBasePlugin,               // rewrites URLs in HTML output using pathPrefix
	InputPathToUrlTransformPlugin,// turns href="posts/x.md" into the built URL
	RenderPlugin,                 // {% renderTemplate %}, {% renderFile %}, renderContent filter
	IdAttributePlugin,            // adds id attributes to headings (v3)
	I18nPlugin,                   // locale-aware URL filters (see data-driven-pages.md)
} from "@11ty/eleventy";

eleventyConfig.addPlugin(HtmlBasePlugin); // options: { baseHref, extensions: "html" }
eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);
eleventyConfig.addPlugin(IdAttributePlugin, { checkDuplicates: "error" });
```

Separate-install official plugins: `@11ty/eleventy-img`,
`@11ty/eleventy-fetch`, `@11ty/eleventy-plugin-rss`,
`@11ty/eleventy-plugin-syntaxhighlight`, `@11ty/eleventy-navigation`,
`@11ty/eleventy-plugin-webc`, `@11ty/eleventy-plugin-directory-output`,
`@11ty/is-land`, `@11ty/eleventy-plugin-vite`.

Third-party plugins register the same way:
`eleventyConfig.addPlugin(pluginFn, options)`.
