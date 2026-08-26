# The data cascade

How Eleventy assembles the `data` object every template renders with,
and which source wins when keys collide.

## Contents

- [Priority order](#priority-order)
- [Global data files (`_data/`)](#global-data-files-_data)
- [Template and directory data files](#template-and-directory-data-files)
- [Front matter](#front-matter)
- [Computed data (`eleventyComputed`)](#computed-data-eleventycomputed)
- [Eleventy-supplied data](#eleventy-supplied-data)
- [Custom data file formats](#custom-data-file-formats)
- [Debugging the cascade](#debugging-the-cascade)

## Priority order

Highest wins; all sources deep-merge (objects and arrays combine down
the cascade):

1. Computed data (`eleventyComputed`)
2. Front matter in the template
3. Template data files (`post.11tydata.js` beside the template)
4. Directory data files (and ascending parent directories)
5. Front matter in layouts
6. Config API global data (`eleventyConfig.addGlobalData(key, value)`)
7. Global data files (`_data/`)

Deep merge means `tags` accumulate down the cascade (a directory data
file's `tags: ["post"]` plus front matter `tags: ["travel"]` yields
both). Opt a single key out with the `override:` prefix — front matter
`override:tags: []` discards inherited tags. (`setDataDeepMerge(false)`
still exists in v3 but is removed in v4 — don't reach for it.)

## Global data files (`_data/`)

Every `*.json` and `*.js` file becomes global data keyed by filename:
`_data/site.json` → `site`; nested dirs nest keys
(`_data/users/list.json` → `users.list`).

JS data files export a value, function, or async function — the return
value is awaited:

```js
// _data/github.js — runs once per build
import Fetch from "@11ty/eleventy-fetch";

export default async function () {
	return Fetch("https://api.github.com/repos/11ty/eleventy", {
		duration: "1d",
		type: "json",
	});
}
```

The function receives a `configData` argument carrying `addGlobalData`
values and the `eleventy` global (`configData.eleventy.env.source`,
`.runMode`) for build-mode-dependent data.

## Template and directory data files

For `posts/subdir/my-post.md`, Eleventy looks for (template-specific
first):

- `posts/subdir/my-post.11tydata.js` / `.11tydata.json` / `.json`
- `posts/subdir/subdir.11tydata.js` / `.11tydata.json` / `.json` — whole directory
- `posts/posts.11tydata.js` / `.11tydata.json` / `.json` — directory + subdirs

The basename must match the template or directory name. The classic use
is one file setting the layout and tags for a whole folder:

```json
// posts/posts.json
{ "layout": "layouts/post.njk", "tags": "post" }
```

Rename the convention with `setDataFileBaseName("index")` /
`setDataFileSuffixes([".11tydata", ""])` if a project needs it.

## Front matter

Parsed by gray-matter. YAML is the default; JSON and JS blocks are
built-in:

```markdown
---js
const title = "My page";
function currentYear() { return new Date().getFullYear(); }
---
```

The free-form JS block (top-level vars become data) is v3+. Only
`permalink` and `eleventyComputed` values are rendered as templates —
other front matter is plain data.

Customize via `setFrontMatterParsingOptions`: add engines (e.g. TOML),
or enable excerpts:

```js
eleventyConfig.setFrontMatterParsingOptions({
	excerpt: true,
	excerpt_separator: "<!-- more -->", // optional; default is "---"
});
// → available as page.excerpt
```

## Computed data (`eleventyComputed`)

Runs last, right before render — the place for values derived from other
data. Lives in front matter, data files, or globally in
`_data/eleventyComputed.js`:

```js
export default {
	eleventyComputed: {
		title: (data) => data.title ?? titleFromSlug(data.page.fileSlug),
		eleventyNavigation: {
			key: (data) => data.title,
			parent: (data) => data.parent,
		},
	},
};
```

Rules that matter:

- Values can be strings (rendered as templates — slower), functions,
  async functions, or promises. Functions receive the full `data`.
- It **cannot** set template-configuration props (`layout`,
  `pagination`, `tags`) — with one exception: `permalink` works, and
  computed permalinks are the standard way to build URLs from data.
- Inter-key dependencies are auto-detected from property access; for a
  conditional path, touch the dependency first
  (`data.someValue; // declare dependency`).

## Eleventy-supplied data

Available in every template, and as `this.page` / `this.eleventy` inside
filters, shortcodes, and transforms:

```js
page: {
	url,            // "/posts/my-post/" — false when permalink: false
	fileSlug,       // "my-post"
	filePathStem,   // "/posts/my-post"
	date,           // JS Date used for collection sorting
	inputPath,      // "./posts/my-post.md"
	outputPath,     // "_site/posts/my-post/index.html" — false when permalink: false
	outputFileExtension,
	rawInput,       // v3: the unrendered template source
	lang,           // with I18nPlugin
	excerpt,        // when excerpt parsing is enabled
}

eleventy: {
	version, generator,   // put {{ eleventy.generator }} in a <meta> tag
	env: { root, config, source /* "cli"|"script" */, runMode /* "build"|"serve"|"watch" */ },
	directories: { input, includes, data, output },
}
```

Also supplied: `pkg` (the project's package.json), `collections`,
`pagination` (when paginating), and `content` (inside layouts). In v3
these supplied objects are frozen against modification.

## Custom data file formats

```js
import YAML from "yaml";
eleventyConfig.addDataExtension("yaml,yml", (contents) => YAML.parse(contents));

// Binary/metadata example — parser gets a path instead of contents:
import exifr from "exifr";
eleventyConfig.addDataExtension("png,jpeg", {
	parser: async (file) => ({ exif: await exifr.parse(file) }),
	read: false,
});
```

Custom formats work in `_data/` and as directory/template data files,
ranking below `.js`/`.json` when both exist.

## Debugging the cascade

- `{{ name | log }}` — the built-in `log` filter `console.log`s any
  value mid-pipeline and passes it through.
- Dump everything a template sees: create a page with
  `{{ page | dump | safe }}` (Nunjucks) or inspect in a computed
  function with `console.log(data)`.
- `DEBUG=Eleventy* npx @11ty/eleventy` traces data file loading.
- Wrong value? Walk the priority list top-down — the usual culprits are
  a forgotten directory data file or deep-merged `tags`.
