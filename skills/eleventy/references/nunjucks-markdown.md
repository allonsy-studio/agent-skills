# Nunjucks and Markdown in Eleventy

Engine-specific behavior for the most common pairing. Core machinery
(layouts, permalinks, filters, collections) is in `templating-core.md`.

## Contents

- [Nunjucks setup](#nunjucks-setup)
- [Nunjucks-only filters, globals, shortcodes](#nunjucks-only-filters-globals-shortcodes)
- [Includes, extends, macros](#includes-extends-macros)
- [Async caveats](#async-caveats)
- [Markdown setup (markdown-it)](#markdown-setup-markdown-it)
- [Markdown preprocessing and templateEngineOverride](#markdown-preprocessing-and-templateengineoverride)
- [Markdown gotchas](#markdown-gotchas)

## Nunjucks setup

Eleventy bundles Nunjucks; `.njk` files just work. Tune the environment
rather than replacing the library:

```js
eleventyConfig.setNunjucksEnvironmentOptions({
	throwOnUndefined: true, // surface typo'd variables as errors — recommended in dev
});
```

(`setLibrary("njk", customEnvironment)` exists for full control but
discards options set the other way.)

Autoescaping is ON: `{{ content }}` escapes HTML. Layouts must pipe
rendered content through `| safe`.

## Nunjucks-only filters, globals, shortcodes

Prefer the universal `addFilter`/`addShortcode` (see
`templating-core.md`) so other engines benefit; reach for these when you
need Nunjucks-specific behavior:

```js
eleventyConfig.addNunjucksFilter("njkOnly", (value) => value);
eleventyConfig.addNunjucksGlobal("now", () => Date.now()); // {{ now() }}
// Async filters use the Nunjucks callback convention:
eleventyConfig.addNunjucksAsyncFilter("fetchTitle", function (url, callback) {
	getTitle(url).then((t) => callback(null, t), (err) => callback(err));
});
```

Nunjucks shortcodes uniquely support named arguments:
`{% user name="Zach", twitter="zachleat" %}` → the callback receives one
object. Nunjucks requires commas between positional args.

Filters/shortcodes registered for Nunjucks get `this.env` and
`this.ctx` (v3) in addition to `this.page`/`this.eleventy`.

## Includes, extends, macros

All resolved against the includes directory (relative paths like
`{% include './partial.njk' %}` also work):

```njk
{% include "components/card.njk" %}

{% import "macros/forms.njk" as forms %}
{{ forms.input("email", label="Email") }}

{# Block inheritance — an alternative to Eleventy layout chaining #}
{% extends "base.njk" %}
{% block main %}…{% endblock %}
```

Use Eleventy's `layout:` front matter for page shells (it works across
engines and merges data); use `{% extends %}` when you need multiple
named blocks overridden per page.

## Async caveats

Nunjucks **macros are synchronous** — an async shortcode or async filter
called inside a macro breaks (this is the usual failure mode when
wrapping the eleventy-img shortcode in a macro). The same applies to
`{% set %}` capturing async output; Eleventy provides `setAsync`:

```njk
{% setAsync "imageHtml" %}{% image "cat.jpg", "A cat" %}{% endsetAsync %}
{{ imageHtml | safe }}
```

If a component must stay a macro, make the underlying work synchronous
or move image handling to the Image transform plugin (see
`assets-and-performance.md`).

## Markdown setup (markdown-it)

Eleventy uses markdown-it with only `html: true` changed from defaults.
Amend the instance for plugins (preferred over wholesale replacement):

```js
import markdownItAnchor from "markdown-it-anchor";

eleventyConfig.amendLibrary("md", (mdLib) => {
	mdLib.set({ breaks: false, linkify: true });
	mdLib.use(markdownItAnchor);
});
```

`setLibrary("md", markdownIt(options))` replaces the instance entirely —
you then own all options. Note the core `IdAttributePlugin` covers
heading ids without a markdown-it plugin.

## Markdown preprocessing and templateEngineOverride

Markdown files are first rendered by `markdownTemplateEngine` (default
**Liquid** — not Nunjucks!), then by markdown-it. So `{{ var }}` and
shortcodes inside `.md` files use the preprocessor engine's syntax.

- Set it globally: `markdownTemplateEngine: "njk"` in the config's
  static options (do this on Nunjucks projects — mixed syntax is the top
  source of silent template bugs in `.md` files).
- Per file: `templateEngineOverride: njk,md` front matter. Markdown must
  be alone or **last** in the list; `templateEngineOverride: false`
  copies content untouched; `markdownTemplateEngine: false` disables
  preprocessing project-wide (faster, and raw `{{ }}` survives).

## Markdown gotchas

- **Indented output becomes a code block**: markdown's 4-space indented
  code rule is disabled by default since v2, but shortcode/include output
  that returns indented HTML inside a `.md` file can still trip nested
  parsing. Return unindented strings from shortcodes used in Markdown
  (the `outdent` package helps with template literals).
- **Paired shortcodes in Markdown**: return `content` bare to let inner
  Markdown render; wrap it in a `<div>` and the inner content is treated
  as an HTML block (Markdown inside is NOT processed).
- **Escaping template syntax in content**: wrap literal `{{ … }}`
  examples in `{% raw %}…{% endraw %}` (both Liquid and Nunjucks).
- Markdown files always output `.html` (with pretty URLs) unless a
  `permalink` says otherwise.
