# Data-driven pages: pagination, external data, i18n

Turning data — local or fetched — into pages, and localizing the result.

## Contents

- [Pagination](#pagination)
- [One page per data item](#one-page-per-data-item)
- [Paginating objects and preprocessing](#paginating-objects-and-preprocessing)
- [Fetching external data (`@11ty/eleventy-fetch`)](#fetching-external-data-11tyeleventy-fetch)
- [End-to-end: pages from an API](#end-to-end-pages-from-an-api)
- [Internationalization (I18nPlugin)](#internationalization-i18nplugin)

## Pagination

`pagination` front matter chunks any data into a sequence of output
pages from a single template:

```yaml
---
pagination:
  data: collections.post   # Lodash.get path into the cascade
  size: 10                 # required
  alias: posts             # optional variable name for the chunk
  reverse: true            # newest first
permalink: "blog/{% if pagination.pageNumber > 0 %}page-{{ pagination.pageNumber }}/{% endif %}"
---
{% for post in posts %} … {% endfor %}

<nav>
	{% if pagination.href.previous %}<a href="{{ pagination.href.previous }}">Newer</a>{% endif %}
	{% if pagination.href.next %}<a href="{{ pagination.href.next }}">Older</a>{% endif %}
</nav>
```

The supplied `pagination` object: `items` (current chunk), `pageNumber`
(0-indexed), `hrefs` (all page URLs), `href.next/previous/first/last`,
`pages` (all chunks), `page.next/previous/first/last`.

Other knobs: `filter` (array of values to drop), `before(data, fullData)`
(map/slice the data first — runs before `reverse` and `filter`; `this`
carries universal filters), `generatePageOnEmptyData: true`, and
`addAllPagesToCollections: true` (by default only page 0 of a paginated
template joins collections).

## One page per data item

`size: 1` is how Eleventy makes detail pages from data — no loop, the
template renders once per item:

```yaml
---
pagination:
  data: products
  size: 1
  alias: product
permalink: "products/{{ product.slug | slugify }}/"
---
<h1>{{ product.name }}</h1>
```

This works for any cascade data: a `_data/products.json` array, a JS
data file's fetched result, or a collection.

## Paginating objects and preprocessing

Objects paginate over their **keys** by default; use `resolve: values`
for the values. A common pattern — a tag index built from a collection:

```yaml
---
pagination:
  data: collections
  size: 1
  alias: tag
  filter: ["all"]
permalink: "tags/{{ tag | slugify }}/"
---
{% for post in collections[tag] %} … {% endfor %}
```

## Fetching external data (`@11ty/eleventy-fetch`)

Build-time fetching with a disk cache, so rebuilds don't hammer APIs
(`npm install @11ty/eleventy-fetch`, Node ≥ 18):

```js
// _data/repos.js
import Fetch from "@11ty/eleventy-fetch";

export default async function () {
	return Fetch("https://api.github.com/users/11ty/repos", {
		duration: "1d",  // "0s" always fetch · "*" never refetch · s/m/h/d/w/y units
		type: "json",    // "buffer" (default) | "json" | "text" | "parsed-xml"
		fetchOptions: {
			headers: { authorization: `Bearer ${process.env.API_TOKEN}` },
			signal: AbortSignal.timeout(5000),
		},
	});
}
```

- **Add `.cache/` to `.gitignore`** — it stores full responses.
- Falls back to a stale cache when the network fails: builds keep
  working offline.
- `Fetch.concurrency = 4;` throttles parallel requests (default 10).
- Non-URL sources: `Fetch(async () => computeExpensive(), { requestId: "unique-key" })`
  caches any async work.
- Lower-level `AssetCache` gives manual `isCacheValid("1d")` /
  `getCachedValue()` / `save(data, "json")` control.

## End-to-end: pages from an API

The canonical CMS/API pattern is three small pieces:

1. `_data/articles.js` — fetch + cache the array (above).
2. `articles.njk` — `pagination: { data: articles, size: 1, alias: article }`
   with a slugified permalink.
3. An index page looping `articles` (or paginating with `size: 10`).

Keep transformation out of templates: shape the data (rename fields,
filter drafts, sort) in the data file so templates stay dumb. For
per-item derived values, `eleventyComputed` works inside the paginated
template — it runs per generated page.

## Internationalization (I18nPlugin)

Bundled with core; manages localized **URLs** (string translation needs
a library like `i18next` or plain data files):

```js
import { I18nPlugin } from "@11ty/eleventy";
eleventyConfig.addPlugin(I18nPlugin, {
	defaultLanguage: "en",       // required, BCP 47
	errorMode: "strict",         // "strict" | "allow-fallback" | "never"
});
```

Convention: language-prefixed content directories (`/en/about.md`,
`/es/about.md`). Then:

- `page.lang` — the current page's language.
- `{{ "/blog/" | locale_url }}` — rewrites to the current locale's
  version (`/es/blog/` on a Spanish page); `errorMode` governs what
  happens when the localized file doesn't exist.
- `{{ collections.all | locale_links }}` style filter — the current
  page's translations as `{ url, lang, label }` objects, for a language
  switcher.

Translation strings pattern without extra libraries: a
`_data/i18n/<lang>.json` per language plus a filter or computed data
that picks strings by `page.lang`.
