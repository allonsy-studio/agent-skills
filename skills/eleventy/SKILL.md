---
name: eleventy
description: >
  Configure, template, and build static sites with Eleventy (11ty) v3 —
  covering eleventy.config.js, the data cascade, Nunjucks/Markdown/WebC/11ty.js
  templating, pagination, pages from external data, image optimization,
  bundling, and build performance. Trigger whenever the user mentions
  "Eleventy", "11ty", "eleventy.config.js", ".eleventy.js", a ".njk",
  ".webc", or ".11ty.js" file, "eleventy-img", "eleventy-fetch", "WebC",
  "data cascade", "passthrough copy", or asks how to build, configure,
  debug, or speed up an Eleventy site — even if they only say "my static
  site" and the project contains an Eleventy config. Do not trigger for
  other static site generators (Astro, Hugo, Jekyll, Next.js) or general
  HTML/CSS questions with no Eleventy involvement.
---

# Eleventy (11ty) v3

Expert guidance for building sites with Eleventy v3.x. Everything here
targets **v3 stable** (ESM-first, `eleventy.config.js`, Node ≥ 18): write
config and data files as ESM (`export default`) unless the project is
clearly CommonJS, and prefer the v3 APIs (`setInputDirectory()`, bundled
plugins imported from `"@11ty/eleventy"`) over older v2 patterns.

## Ground rules

1. **Read the project before advising.** Locate the config file
   (`eleventy.config.js`, `eleventy.config.mjs`, `.eleventy.js`, or
   `eleventy.config.cjs` — first found wins) and check `package.json` for
   the `@11ty/eleventy` version and `"type": "module"`. Recommendations
   that ignore the project's existing directory layout or module system
   cause breakage.
2. **Match the template engine in play.** Markdown files are preprocessed
   by the engine named in `markdownTemplateEngine` (default: Liquid).
   Advice that assumes Nunjucks syntax inside `.md` files fails silently
   on a Liquid-configured project — check before writing template code.
3. **Verify with a build.** After config changes, run
   `npx @11ty/eleventy --dryrun` (or a real build) rather than assuming
   correctness. For debugging, `DEBUG=Eleventy* npx @11ty/eleventy`
   prints the full internal trace.
4. **v4 is in alpha.** If a project pins `4.0.0-alpha.*`, flag that APIs
   may differ from this skill (e.g. data deep merge is removed in v4) and
   confirm against the project's behavior.

## Reference routing

Read only the file(s) the task needs — each is self-contained:

| Task involves… | Read |
| --- | --- |
| Config file shape, directories, template formats, passthrough copy, ignores, dev server, events, transforms, CLI flags, bundled plugins | [`references/configuration.md`](./references/configuration.md) |
| Where data comes from and which source wins: `_data/`, directory/template data files, front matter, `eleventyComputed`, `page`/`eleventy` variables, custom data formats | [`references/data-cascade.md`](./references/data-cascade.md) |
| Layouts, permalinks, universal filters/shortcodes, collections, dates — regardless of engine | [`references/templating-core.md`](./references/templating-core.md) |
| Nunjucks specifics (filters, macros, async caveats) or Markdown (markdown-it config, gotchas) | [`references/nunjucks-markdown.md`](./references/nunjucks-markdown.md) |
| WebC components: props, slots, `webc:*` attributes, CSS/JS bundling | [`references/webc.md`](./references/webc.md) |
| `.11ty.js` JavaScript templates, `this`-bound filters, emitting non-HTML files | [`references/javascript-templates.md`](./references/javascript-templates.md) |
| Pagination, generating pages from APIs/CMS data, `eleventy-fetch` caching, i18n | [`references/data-driven-pages.md`](./references/data-driven-pages.md) |
| Images (`eleventy-img`), CSS/JS pipelines, the Bundle plugin, Sass/PostCSS/esbuild via `addExtension`, build speed, deployment | [`references/assets-and-performance.md`](./references/assets-and-performance.md) |

Tasks usually span two files — e.g. "paginate posts from an API" needs
`data-driven-pages.md` plus `templating-core.md` (permalinks); "add a
shortcode that renders optimized images" needs `templating-core.md` plus
`assets-and-performance.md`.

## Workflows

### Scaffold a new project

1. `npm init -y && npm install @11ty/eleventy` — set `"type": "module"`
   in package.json.
2. Create `eleventy.config.js` with an explicit directory setup (see
   `references/configuration.md`). Choose input/output dirs deliberately;
   the defaults (`.` → `_site`) suit small sites, `src` → `_site` suits
   most others.
3. Add a base layout in `_includes/`, wire `markdownTemplateEngine` to
   the engine you'll actually use, and add scripts:
   `"build": "eleventy"`, `"start": "eleventy --serve"`.
4. Add `_site/` and `.cache/` to `.gitignore`.

### Implement a feature in an existing project

1. Read the config and identify: directories, template formats, engines,
   registered plugins/filters/shortcodes/collections.
2. Read the relevant reference file(s) from the table above.
3. Prefer the platform's primitives over custom code: the data cascade
   over globals threaded through templates, `eleventyComputed` over
   copy-pasted front matter, collections over hand-rolled file lists,
   bundled plugins over dependencies.
4. Build and check output paths in the output directory match
   expectations.

### Debug a failing or wrong build

- Template renders wrong values → inspect the cascade with the built-in
  `log` filter (`{{ value | log }}`) and check source priority in
  `references/data-cascade.md`.
- File missing from output → check ignores (`.gitignore` is honored by
  default), `permalink: false`, template formats, and passthrough copy.
- Wrong URL/path → permalinks section of `references/templating-core.md`;
  for subdirectory deploys, `HtmlBasePlugin` + `pathPrefix`.
- Slow build → benchmarks section of
  `references/assets-and-performance.md` (`DEBUG=Eleventy:Benchmark*`).
- Off-by-one dates → UTC parsing, dates section of
  `references/templating-core.md`.
