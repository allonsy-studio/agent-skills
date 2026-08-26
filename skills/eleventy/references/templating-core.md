# Templating core: layouts, permalinks, filters, shortcodes, collections, dates

Engine-agnostic template machinery. For engine specifics see
`nunjucks-markdown.md`, `webc.md`, or `javascript-templates.md`.

## Contents

- [Layouts](#layouts)
- [Permalinks](#permalinks)
- [Universal filters and shortcodes](#universal-filters-and-shortcodes)
- [Built-in filters](#built-in-filters)
- [Collections](#collections)
- [The collections API](#the-collections-api)
- [Dates](#dates)

## Layouts

```yaml
---
layout: layouts/post.njk
title: My post
---
```

- Resolved against the includes dir (or the dedicated layouts dir if
  configured). Any template engine works, and engines can mix down the
  chain (md content → njk layout → html layout).
- The layout injects the child's rendered output via the `content`
  variable — `{{ content | safe }}` in Nunjucks (unescaped `{{ content }}`
  in Liquid). Forgetting `safe` in a Nunjucks layout is the classic
  "my page renders as escaped HTML" bug.
- **Layout chaining**: a layout's own front matter can declare another
  `layout:`. Data merges through the chain; content-adjacent data wins.
- Aliases: `eleventyConfig.addLayoutAlias("post", "layouts/post.njk")`
  lets content say `layout: post`.
- Extensionless `layout: mylayout` works but is slower and ambiguous;
  disable with `eleventyConfig.setLayoutResolution(false)` if you want
  strictness.
- Prefer Eleventy layouts for page shells; Nunjucks `{% extends %}` is a
  separate, engine-level mechanism you can still use for block-based
  inheritance inside `.njk` files.

## Permalinks

Defaults produce pretty URLs: *about.md* → `_site/about/index.html`
(`/about/`). Control per file with `permalink` front matter — the one
front matter key rendered as a template (quote it in YAML):

```yaml
permalink: "/recipes/{{ title | slugify }}/"
```

- Trailing slash means directory + `index.html`. An extensionless,
  slashless permalink throws (set `eleventyAllowMissingExtension: true`
  to allow).
- `permalink: false` — render nothing to disk, but the page still exists
  in collections (`item.url === false`). Good for data-only entries.
- Non-HTML output: `permalink: "feed.xml"`, `permalink: "api/data.json"`
  — the template body becomes the file contents.
- Function form (in a data file, receives the cascade, `this` has
  universal filters):

```js
// recipes/recipes.11tydata.js
export default {
	permalink: function ({ title }) {
		return `/recipes/${this.slugify(title)}/`;
	},
};
```

- With pagination, the permalink renders once per page:
  `permalink: "tags/{{ tag }}/page-{{ pagination.pageNumber }}/"`.
- Escape hatches: per-file `dynamicPermalink: false` disables template
  rendering of the permalink; `permalinkBypassOutputDir: true` writes
  relative to the project root.
- Two inputs resolving to one output path is a build error — usually a
  pagination/permalink collision.

## Universal filters and shortcodes

Registered once, available in Nunjucks, Liquid, 11ty.js (as
`this.name()`), WebC (as `name()` in expressions), and inside Markdown
via its preprocessor engine:

```js
eleventyConfig.addFilter("readableDate", function (date) {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
});
eleventyConfig.addFilter("myAsyncFilter", async function (value) { /* v2+ */ });

eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);
eleventyConfig.addShortcode("image", async function (src, alt) { /* async ok */ });

eleventyConfig.addPairedShortcode("callout", function (content, type = "note") {
	// content = the rendered inner block, always the FIRST parameter
	return `<div class="callout callout-${type}">${content}</div>`;
});
// {% callout "warning" %}Inner *markdown* and {{ vars }} work here.{% endcallout %}
```

- Use `function () {}` (not arrows) when you need the context:
  `this.page`, `this.eleventy`, and (Nunjucks-only) `this.env`/`this.ctx`.
- Reuse registered filters inside config code with
  `eleventyConfig.getFilter("slugify")`.
- Async filters/shortcodes work everywhere except inside Nunjucks macros
  and Handlebars — see `nunjucks-markdown.md`.
- Memoize expensive filters/shortcodes (e.g. with the `memoize` package);
  they run once per call site per build.

## Built-in filters

- `slugify` — `@sindresorhus/slugify`-based, used in permalinks:
  `{{ title | slugify }}`. (Supersedes the deprecated `slug`; switching
  an old project can change URLs — check before "upgrading".)
- `url` — applies `pathPrefix` to root-relative paths. Modern projects
  usually prefer `HtmlBasePlugin` and skip sprinkling `| url` everywhere.
- `log` — `console.log` passthrough for pipeline debugging:
  `{{ value | log | upper }}`.
- `inputPathToUrl` (v3) — `<a href="{{ 'pages/about.md' | inputPathToUrl }}">`
  links by source file instead of hard-coding URLs; the
  `InputPathToUrlTransformPlugin` does the same for plain
  `href="about.md"` markup.
- Collection navigation (arg defaults to current page):
  `collections.post | getPreviousCollectionItem`,
  `getNextCollectionItem`, `getCollectionItem`, `getCollectionItemIndex`.

## Collections

Content is grouped by `tags` front matter; every tag creates
`collections.<tag>`, and everything lives in `collections.all`:

```yaml
tags: ["post", "travel"]   # string, array, or YAML list
```

```njk
{% for post in collections.post %}
	<a href="{{ post.url }}">{{ post.data.title }}</a>
{% endfor %}
```

Collection items expose `url`, `date`, `inputPath`, `page`, `data`
(the full cascade), `content` (rendered, layout-free), and `rawInput`
(v3).

- Default sort: ascending by date, then input path. To show newest
  first, use the engine's non-mutating reverse (Nunjucks
  `| reverse`, Liquid `reversed`, JS `.toReversed()`). **Never**
  `Array.prototype.reverse()` in a template — it mutates the shared
  array for every consumer.
- Exclude a page: `eleventyExcludeFromCollections: true` (or an array of
  collection names in v3).
- Deep merge accumulates `tags` from directory data files; reset with
  `override:tags`.
- For incremental builds, templates consuming a collection outside
  `pagination.data` should declare it:
  `eleventyImport: { collections: ["post"] }`.

## The collections API

```js
eleventyConfig.addCollection("postsByYear", (collectionsApi) => {
	// getAll() | getAllSorted() | getFilteredByTag("post") |
	// getFilteredByTags("post", "travel") | getFilteredByGlob("posts/**/*.md")
	const posts = collectionsApi.getFilteredByGlob("posts/**/*.md");
	return Object.groupBy(posts, (p) => p.date.getFullYear());
});
```

Callbacks can be async and return anything — arrays, objects, maps.
Common patterns: newest-first
(`getAllSorted().reverse()` — safe here, it's your own copy), filtering
drafts (`.filter(p => !p.data.draft)`), building a tag list
(`Set` over all items' `data.tags`).

## Dates

`page.date` resolution: front matter `date` → a `YYYY-MM-DD` anywhere in
the file path → file creation time. File-creation dates are unstable on
CI — set explicit dates on anything whose order matters.

Special string values: `date: "Last Modified"`, `"Created"`,
`"git Last Modified"`, `"git Created"`.

**The off-by-one-day gotcha**: `date: 2024-06-01` parses as midnight
UTC; formatting it in a local timezone can print May 31. Format in UTC
(`page.date.toUTCString()`, or `Intl.DateTimeFormat` with
`timeZone: "UTC"` in a filter). v3 adds custom parsing:

```js
eleventyConfig.addDateParsing(function (dateValue) {
	// return a Date, Luxon DateTime, or new parseable value; falsy = default handling
});
```
