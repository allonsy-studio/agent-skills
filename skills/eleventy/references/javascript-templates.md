# 11ty.js JavaScript templates

Templates written in plain JavaScript — the most flexible engine, ideal
for computed pages, non-HTML output, and anything where template syntax
fights you.

## Contents

- [File shapes](#file-shapes)
- [Data and front matter](#data-and-front-matter)
- [Filters and shortcodes via `this`](#filters-and-shortcodes-via-this)
- [Permalinks](#permalinks)
- [Emitting non-HTML files](#emitting-non-html-files)
- [Escaping and post-processing](#escaping-and-post-processing)

## File shapes

Extensions: `.11ty.js` (module system follows package.json), plus
`.11ty.cjs` / `.11ty.mjs` to force one. All shapes may return a string,
Buffer, or Promise:

```js
// 1. Raw value
export default "<p>Static output</p>";

// 2. Function of the full data cascade (sync or async)
export default async function (data) {
	return `<p>${data.title}</p>`;
}

// 3. Class with data() and render() — the canonical shape
class Page {
	data() {
		return { title: "Hello", layout: "layouts/base.njk" };
	}
	async render({ title }) {
		return `<h1>${title}</h1>`;
	}
}
export default Page;
```

## Data and front matter

JS templates have **no front matter** — the `data()` method (or `data`
getter / object key) plays that role, and its keys enter the cascade
exactly like front matter: `layout`, `tags`, `permalink`,
`eleventyExcludeFromCollections`, `pagination`, custom keys.

Don't confuse templates with data files: `*.11ty.js` in the input tree
renders an output file; `_data/*.js` and `*.11tydata.js` files only
contribute data.

## Filters and shortcodes via `this`

Every universal filter, shortcode, and paired shortcode is exposed as a
method on `this` inside `render()`, `data()` functions, and permalink
functions — there is no pipe syntax:

```js
class Post {
	data() {
		return {
			title: "My post title",
			permalink: function (data) {
				return `/${this.slugify(data.title)}/`;
			},
		};
	}
	render(data) {
		return `
			<h1>${this.slugify(data.title)}</h1>
			${this.myShortcode(data.title)}
			${this.pairedThing("inner content", "arg")}
		`;
	}
}
export default Post;
```

**Arrow functions break `this`** — `export default (data) => this.x()`
throws. Use regular `function` declarations/methods anywhere you need
filters, `this.page`, or `this.eleventy`. Extra project-specific
functions register with
`eleventyConfig.addJavaScriptFunction("name", fn)` (async fine).

## Permalinks

`permalink` in the `data` object can be a string or a function of the
data (Buffer/Promise also allowed). Function form plus `this`-bound
filters is the idiomatic computed URL:

```js
data() {
	return {
		key: "hello",
		permalink: (data) => `/api/${data.key}.json`,
	};
}
```

## Emitting non-HTML files

Because output is written verbatim, an 11ty.js template with a non-HTML
permalink is the standard generator for JSON endpoints, redirects files,
manifests, or CSS:

```js
// search-index.11ty.js
class SearchIndex {
	data() {
		return {
			permalink: "/search-index.json",
			eleventyExcludeFromCollections: true,
		};
	}
	render({ collections }) {
		return JSON.stringify(
			collections.all.map((p) => ({ url: p.url, title: p.data.title })),
		);
	}
}
export default SearchIndex;
```

## Escaping and post-processing

Output is **raw** — nothing is auto-escaped, unlike Nunjucks/Liquid.
Escape interpolated content yourself when it isn't trusted.

To post-process the return value as Markdown, chain engines (only
11ty.js supports this pairing directly):

```js
data() {
	return { templateEngineOverride: "11ty.js,md" };
}
render(data) {
	return `# Rendered as Markdown afterward`;
}
```
