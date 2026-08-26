# Assets and performance

Images, CSS/JS pipelines, custom compilers, build speed, and deployment.

## Contents

- [The asset ladder — pick the simplest rung](#the-asset-ladder--pick-the-simplest-rung)
- [Images: @11ty/eleventy-img](#images-11tyeleventy-img)
- [The Bundle plugin](#the-bundle-plugin)
- [Custom compilers via addExtension (Sass, esbuild, PostCSS)](#custom-compilers-via-addextension-sass-esbuild-postcss)
- [Vite integration](#vite-integration)
- [Build performance](#build-performance)
- [Deployment](#deployment)

## The asset ladder — pick the simplest rung

Escalate only when the current rung stops being enough:

1. **Passthrough copy** — `addPassthroughCopy("src/css")`; zero deps.
2. **Templates as concatenators** — a `.njk` file with
   `permalink: "css/site.css"` that includes partials.
3. **Custom template types** — `addExtension` wiring Sass/PostCSS/
   esbuild into the build graph (below).
4. **Bundle plugin / WebC** — per-page minimal CSS/JS from components.
5. **Vite plugin** — a full bundler when the site is really an app.

## Images: @11ty/eleventy-img

`npm install @11ty/eleventy-img` (v7+ is ESM, Node ≥ 22). Prefer the
**transform plugin**: write plain `<img src="cat.jpg">` anywhere and it
rewrites HTML output to responsive `<picture>` markup, generating the
files:

```js
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
	formats: ["avif", "webp", "jpeg"], // avif is the slow one — drop it if builds crawl
	widths: ["auto"],                  // or [320, 640, 1280]
	urlPath: "/img/",
	outputDir: "./_site/img/",
	transformOnRequest: process.env.ELEVENTY_RUN_MODE === "serve", // lazy in dev
	htmlOptions: {
		imgAttributes: { loading: "lazy", decoding: "async" },
	},
});
```

Per-image control in markup: `eleventy:widths="200,600"`,
`eleventy:formats="webp"`, `eleventy:ignore` (skip this image),
`eleventy:output="./dir/"`.

Shortcode form (when you need programmatic control):

```js
import Image from "@11ty/eleventy-img";

eleventyConfig.addShortcode("image", async function (src, alt, sizes = "") {
	return Image(src, {
		widths: [400, 800],
		formats: ["avif", "jpeg"],
		returnType: "html",
		htmlOptions: { imgAttributes: { alt, sizes, loading: "lazy", decoding: "async" } },
	});
});
```

- `alt` is required (build error otherwise); `sizes` is required when
  emitting more than one width.
- **Async shortcodes don't work inside Nunjucks macros** — the transform
  plugin sidesteps this entirely.
- Remote URLs are downloaded and cached (`cacheOptions: { duration: "1d" }`);
  processed output is cached on disk and skipped when unchanged.
- The bare `Image(src, opts)` call returns per-format metadata
  (`url`, `srcset`, `width`, `outputPath`) for fully custom markup.

## The Bundle plugin

In core since v3, zero-install, opt-in — a minimum-viable asset pipeline
(no transpilation: code in = code out):

```js
eleventyConfig.addBundle("css"); // creates {% css %} + registers "css" for getBundle
eleventyConfig.addBundle("js", {
	toFileDirectory: "bundle",    // where getBundleFileUrl writes files
	transforms: [async function (content) { return minify(content); }],
});
```

Components/templates contribute; the layout outputs:

```njk
{% css %}.hero { color: rebeccapurple; }{% endcss %}   {# add to default bucket #}
{% css "defer" %}.footer { … }{% endcss %}             {# named bucket #}

<style>{% getBundle "css" %}</style>                    {# inline (critical CSS) #}
<link rel="stylesheet" href="{% getBundleFileUrl 'css', 'defer' %}"> {# file #}
```

Duplicate blocks are hoisted/deduped automatically, so a shortcode used
50 times contributes its CSS once. This is the same machinery WebC
bundler mode uses.

## Custom compilers via addExtension (Sass, esbuild, PostCSS)

Register a file extension as a first-class template type so watch mode,
incremental builds, and permalinks all apply:

```js
import * as sass from "sass";
import path from "node:path";

eleventyConfig.addTemplateFormats("scss");
eleventyConfig.addExtension("scss", {
	outputFileExtension: "css",
	useLayouts: false,
	compile: function (inputContent, inputPath) {
		let { dir } = path.parse(inputPath);
		let result = sass.compileString(inputContent, {
			loadPaths: [dir || ".", this.config.dir.includes],
		});
		this.addDependencies(inputPath, result.loadedUrls); // incremental-build graph
		return () => result.css;
	},
	compileOptions: {
		// Sass convention: underscore partials produce no output file
		permalink: function (contents, inputPath) {
			if (path.parse(inputPath).name.startsWith("_")) return false;
		},
	},
});
```

Key options: `compile(content, path)` returns the render function (or
`undefined` to skip the file); `read: false` hands the compile step just
the path (for tools that read files themselves, e.g. esbuild);
`compileOptions.permalink` — `"raw"` (v3 default), `false` (never
write), or a function; `this.addDependencies()` keeps `--incremental`
and watch accurate.

For esbuild/PostCSS the same shape applies — or run them in an
`eleventy.before` event and passthrough-copy the result when you don't
need per-file permalink control.

## Vite integration

`@11ty/eleventy-plugin-vite` runs Vite as dev-server middleware and as a
post-build production pass:

```js
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";
eleventyConfig.addPlugin(EleventyVitePlugin, {
	viteOptions: { /* full Vite config */ },
});
```

Reach for it when the project needs real bundling (code-splitting,
HMR-heavy JS, framework islands) — not for a few CSS files.

## Build performance

Diagnose before optimizing:

```bash
DEBUG=Eleventy:Benchmark* npx @11ty/eleventy   # per-phase timing breakdown
npx --node-options="--cpu-prof" @11ty/eleventy --quiet  # CPU profile → SpeedScope
```

Eleventy also auto-warns (no DEBUG needed) when a filter, shortcode, or
data file eats more than ~8% of build time. The
`@11ty/eleventy-plugin-directory-output` plugin prints per-file size and
timing.

The levers, in the order they usually pay off:

1. `--incremental` (and `--incremental=file.md` to rebuild one file);
   declare collection dependencies with `eleventyImport` and compiler
   dependencies with `addDependencies` so it stays correct.
2. Memoize expensive filters/shortcodes — HTML/CSS/JS minification in a
   transform is the most common build-killer.
3. Cache network work with `eleventy-fetch` (`duration`).
4. Image builds: drop `avif` from dev formats, use `transformOnRequest`
   during `--serve`.
5. `setServerPassthroughCopyBehavior("passthrough")` — stop copying
   assets on every dev build.

Baseline expectation: Eleventy builds ~4,000 Markdown files in ~2s —
if a modest site takes 30s, something specific is wrong; profile it.

## Deployment

- A standard build is production-ready — there's no built-in dev/prod
  mode switch. Output is `_site/` by default; point the host's publish
  directory there and run `npx @11ty/eleventy` as the build command.
- **Subdirectory deploys** (e.g. GitHub Pages project sites): build with
  `--pathprefix=/repo-name/` and add `HtmlBasePlugin` so URLs in the
  HTML get rewritten. On a custom domain, remove the prefix.
- Persist `.cache/` (eleventy-fetch) and the image output dir across CI
  builds where the host supports it — it turns remote fetches and image
  processing into no-ops.
