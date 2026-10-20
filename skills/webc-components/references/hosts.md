# Running WebC outside Eleventy

Scope: `@11ty/webc` 0.11.4 called directly, and the four published integrations, read in
full: `express-webc` 0.0.1, `koa-webc` 0.1.0, `@jackdbd/fastify-webc` 0.1.0, and
`vite-plugin-webc` 0.2.0. Claims marked **verified** were reproduced by compiling with
WebC 0.11.4, or with the version a package ships where noted.

WebC is a standalone compiler. Host tags, slots, props, attributes, and flow control
(`webc-internals.md`) behave the same in every host. What changes per host is how
components are registered, which data and helpers reach templates, whether bundler mode
is on, and how long the process lives.

## Contents

1. [Hosts at a glance](#1-hosts-at-a-glance)
2. [What changes outside Eleventy](#2-what-changes-outside-eleventy)
3. [Express](#3-express)
4. [Koa](#4-koa)
5. [Fastify](#5-fastify)
6. [Vite](#6-vite)
7. [Any other server or build](#7-any-other-server-or-build)
8. [Pages built with a client-side framework](#8-pages-built-with-a-client-side-framework)

## 1. Hosts at a glance

| Host | WebC version | Data in templates | Helpers | Bundler mode | Components |
| --- | --- | --- | --- | --- | --- |
| Eleventy (`@11ty/eleventy-plugin-webc`) | 0.11.x | the page's data cascade | Eleventy filters and JavaScript functions | on | the plugin's `components` glob |
| Standalone (`@11ty/webc`) | yours | `compile({ data })` | only what `setHelper` adds | off unless `setBundlerMode(true)` | `defineComponents(glob)` |
| Express (`express-webc`) | pinned `^0.4.5` | none | none | off | `components/**.webc` beside the views folder |
| Koa (`koa-webc`) | `^0.10.0` | `ctx` plus the `data` options | none | opt-in, broken (§4) | the `defineComponents` option |
| Fastify (`@jackdbd/fastify-webc`) | `^0.11.4` | `reply.render(page, data)` | `tap` by default | not supported | `components`, default `components/**/*.webc` |
| Vite (`vite-plugin-webc`) | peer `^0.5.3` | none | none | build only | `src/**/*.webc`, fixed |

Last published: Express 2022-09, Vite 2022-10, Koa 2023-09, Fastify 2025-01. Only the
Fastify plugin targets current WebC.

## 2. What changes outside Eleventy

- **`webc:setup` runs on every compile.** The Eleventy plugin shares one component manager
  across pages (`setGlobalComponentManager`), so setup runs once per file. Every other
  host creates a `new WebC()` per request or page with no shared manager, so setup runs
  on each compile with that compile's data. **Verified:** a setup constant that reads
  `user` renders `ada`, then `bob`, for two compiles. Per-request values in setup work
  here, at the cost of one `vm` evaluation per component per request.
- **Data reaches the page and `webc:setup`, not component attributes.** Data passed to
  `compile({ data })` is readable unprefixed in the page and in setup. In a component's
  attributes it is readable only as `$data`. **Verified:** `:data-u="typeof user"` in a
  component renders `undefined`; `$data.user` renders `ada`.
- **Helpers are whatever the host registers.** An unpassed prop resolves to a same-named
  helper (internals §2): Eleventy filters in Eleventy, `setHelper` names elsewhere.
  fastify-webc registers `tap` by default, so an unpassed prop named `tap` is a function.
  **Verified.**
- **Without bundler mode, every instance ships its own `<style>` and `<script>`.**
  **Verified:** two instances of a component render two style blocks and two script
  blocks, and `compile()` returns empty `css` and `js`. A client script runs once per
  instance, so wrap it in a block and guard `customElements.define` (conventions,
  universal practice 9).
- **A long-running server keeps every string it parsed.** The AST cache is a module-level
  object keyed by content and never evicted (internals §1). Every distinct string passed
  through `@html` stays for the life of the process. **Verified:** 5,000 distinct 2 KB
  strings grew the heap by 30 MB; 5,000 identical ones by 0.1 MB. Render per-request text
  with `@text`, and trusted per-request markup with `@raw`, which skips the parse
  (internals §8).
- **`uid` is random per compile**, so per request in a server (internals §9).

## 3. Express

- `express-webc` registers a view engine: `app.engine("webc", WebCEngine)` and `app.set("view engine", "webc")`.
- It passes no data. `res.render` locals and `res.locals` never reach the template.
- It pins `@11ty/webc` `^0.4.5`, which has no `webc:setup`, `webc:if`, `webc:elseif`,
  `webc:for`, `@text`, or `@raw` (from that version's attribute list). Most of this skill
  assumes 0.11. Raise the version with an `overrides` entry, or call WebC directly (§7).
- Components match `<views>/../components/**.webc`; the folder name comes from the
  `webc:components` app setting.
- Bundler mode is never set, so assets stay inline per instance (§2).

## 4. Koa

- `app.use(KoaWebC({ viewPath, defineComponents, data, bundle }))`, then
  `await ctx.render("page.webc", { data, bundle })`.
- Templates receive `{ ctx, ...options.data, ...extra.data }`: the page reads `ctx`
  directly, a component reads `$data.ctx`.
- Bundle mode breaks the page. **Verified** with koa-webc 0.1.0 and the WebC 0.10.1 it
  installs: the `<style>` lands before `<!doctype html>` (quirks mode); CSS from several
  components is joined with commas (`.a{color:red},.b{color:blue}`, which drops every rule
  after the first); scripts are joined with commas (`const a=1,const b=2`, a syntax
  error). Leave `bundle` off, or compile with WebC directly (§7).

## 5. Fastify

- `fastify.register(webc, { components, templates, helpers, transforms })`, then
  `return reply.render("page.webc", data)`. Output is streamed with `page.stream()`.
- It targets WebC `^0.11.4`, so the rest of this skill applies, with the differences in §2.
- `useBundlerMode: true` throws, so assets stay inline per instance.
- Pass `helpers: []` to drop the default `tap` helper.

## 6. Vite

Read from source; not verified by a build.

- `vite-plugin-webc` compiles `.html` entry files against components in `src/**/*.webc`.
- The dev server compiles without bundler mode, so assets stay inline per instance.
- The build uses bundler mode. It marks the page's own `<style>` and `<script>` as
  `webc:raw` so WebC leaves them alone, and puts component CSS and JS into two virtual
  modules (`virtual:webc-generated.css` and `.js`) shared by every page of the build.
- Its peer dependency is `@11ty/webc` `^0.5.3`.

## 7. Any other server or build

WebC runs wherever Node runs; it needs `node:vm` and `node:fs`. Runtimes without
`node:vm`, such as most edge and worker runtimes, cannot run it. Bun and Deno are
untested.

A per-request render with bundling done correctly. **Verified:** the CSS lands in the
head once, the JS once before `</body>`, for a page with two instances of a component.

```js
import { WebC } from "@11ty/webc";

/**
 * Renders one WebC page with component CSS in the head and JS before the body ends.
 * @param {string} file
 * @param {object} data
 */
export async function render(file, data) {
	const page = new WebC({ file });
	page.defineComponents("components/**/*.webc");
	page.setBundlerMode(true);
	const { html, css, js } = await page.compile({ data });
	return html
		.replace("</head>", `<style>${css.join("\n")}</style></head>`)
		.replace("</body>", `<script>${js.join("\n")}</script></body>`);
}
```

- Join `css` and `js` with newlines; the arrays' default join adds commas (§4).
- Register helpers on purpose with `setHelper`, and name props so they cannot collide
  with them (§2).
- Cache the rendered HTML when the data has not changed: each compile re-runs every
  `webc:setup` and every dynamic attribute (internals §5).

## 8. Pages built with a client-side framework

WebC has no client runtime. What ships is compiled HTML, CSS, and each component's own
client script.

- A component whose behavior is a custom element (conventions, `behavior: a`) works on a
  page built with any framework, because the browser upgrades the tag wherever it
  appears. Pass values through attributes, not framework props.
- A framework that renders an element on the client replaces the server HTML inside it.
  Keep WebC output outside the elements the framework controls, such as the layout shell
  or static sections.
