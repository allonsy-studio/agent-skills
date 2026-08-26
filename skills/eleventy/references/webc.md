# WebC in Eleventy

Single-file HTML components with build-time rendering and per-page
asset bundling. Officially documented and usable, but development
velocity has been low since ~2023 — flag that trade-off when a project
is choosing an approach, and don't present WebC as deprecated (it isn't).

## Contents

- [Setup](#setup)
- [Defining and using components](#defining-and-using-components)
- [Props, dynamic attributes, content props](#props-dynamic-attributes-content-props)
- [The webc:* attributes](#the-webc-attributes)
- [Slots](#slots)
- [CSS/JS hoisting and bundles](#cssjs-hoisting-and-bundles)
- [Pages, layouts, and mixing engines](#pages-layouts-and-mixing-engines)
- [Common pitfalls](#common-pitfalls)

## Setup

```js
import pluginWebc from "@11ty/eleventy-plugin-webc";

export default function (eleventyConfig) {
	eleventyConfig.addPlugin(pluginWebc, {
		components: "_components/**/*.webc", // global components, glob relative to project root
	});
}
```

This registers `.webc` as a template format. Components resolve three
ways: the global `components` glob (filename = tag name,
`my-card.webc` → `<my-card>`), `webc.components` set via the data
cascade, or explicit `webc:import="./path.webc"` /
`webc:import="npm:@11ty/eleventy-img"`.

## Defining and using components

A component is an HTML fragment. Host-tag rule: a component with **no**
`<style>`/`<script>` has its host tag stripped from output (`webc:keep`
opts back in); one **with** CSS/JS keeps the host tag (`webc:nokeep`
opts out). An asset-only component implies `<slot></slot>`.

```html
<!-- _components/my-card.webc -->
<div class="card">
	<h2 @text="title"></h2>
	<slot></slot>
</div>
<style>
	.card { border: 1px solid; }
</style>
```

```html
<my-card @title="Hello"><p>Body content</p></my-card>
```

## Props, dynamic attributes, content props

- `@prop="value"` — props: server-only, never rendered as attributes.
  Referenced by name inside the component (dashes become camelCase).
- `:attr="expr"` — dynamic attribute, value is a JS expression evaluated
  against data/props: `<img :src="src" :alt="alt">`.
- `@attributes` — spread the host's attributes onto this node.
- Content props: `@text="expr"` (escaped), `@html="expr"` (reprocessed
  as WebC), `@raw="expr"` (not reprocessed).
- Page templates read the data cascade directly (`site.title`); inside
  components use `$data` (`@text="$data.site.title"`).
- `<!--- triple-dash comments --->` are stripped from output.

## The webc:* attributes

| Attribute | Purpose |
| --- | --- |
| `webc:if` / `webc:elseif` / `webc:else` | Conditionals (JS expressions, async-friendly) |
| `webc:for="item of array"` | Loops (`of`/`in`; nested loops can't see outer scope — known limitation) |
| `webc:type="js"` | Run JS at build; the last statement's value is the output |
| `webc:type="11ty" 11ty:type="njk"` | Render another engine inside WebC with full data cascade |
| `webc:is="tag"` | Remap element (needed for `<head>` children and `<table>` internals) |
| `webc:root` | Merge attributes onto the host tag; `webc:root="override"` replaces it |
| `webc:import` | Import a component for this element (path or `npm:` package) |
| `webc:scoped` | Hash-scope the component's CSS (or a stable custom prefix) |
| `webc:setup` | `<script>` run once per component at build; top-level vars become data |
| `webc:bucket="name"` | Route the asset to a named bundle bucket |
| `webc:keep` / `webc:nokeep` | Host-tag and bundling opt-in/out |
| `webc:raw` | Skip WebC processing of children |
| `webc:ignore` | Remove the node entirely |

Inside `webc:type="js"`, helpers are available as `webc.attributes`,
`webc.renderAttributes()`, `webc.escapeText()`, and attributes as
`this.attributeName`.

## Slots

```html
<!-- component -->
<slot name="header"></slot>
<slot>Default fallback</slot>

<!-- usage -->
<my-card>
	<h2 slot="header">Title</h2>
	Everything unslotted lands in the default slot.
</my-card>
```

## CSS/JS hoisting and bundles

Eleventy runs WebC in bundler mode: `<style>`, `<link rel="stylesheet">`,
and `<script>` inside components are hoisted into per-page bundles (the
core Bundle plugin under the hood). The layout must output them —
`webc:keep` is required so the output tags aren't themselves re-hoisted:

```html
<style @raw="getBundle('css')" webc:keep></style>
<script @raw="getBundle('js')" webc:keep></script>
<!-- or as files: -->
<link rel="stylesheet" :href="getBundleFileUrl('css')" webc:keep />
```

Named buckets let a component defer non-critical CSS:
`<style webc:bucket="defer">` in the component,
`getBundle('css', 'defer')` in the layout.

## Pages, layouts, and mixing engines

- `.webc` files in the input dir are **pages** (front matter supported);
  component files don't get front matter — use `webc:setup` or props.
- Markup starting with `<!doctype`/`<html>` renders as a full page;
  anything else as a fragment.
- WebC layouts: content sets `layout: my-layout.webc`; the layout
  outputs `@raw="content"` (or `@html="content"` to reprocess as WebC).
- Universal Eleventy filters and JS functions are callable in
  expressions: `<div @text="slugify(title)"></div>`.
- Embed other engines when a feature is missing:

```html
<template webc:type="11ty" 11ty:type="njk">
	{% for post in collections.post %}…{% endfor %}
</template>
```

## Common pitfalls

- Missing `webc:keep` on the layout's `getBundle` tags → styles/scripts
  disappear (re-hoisted into the very bundle being printed).
- Expecting the host tag in output CSS — an HTML-only component's tag is
  stripped; style an inner element or add `webc:keep`.
- Using `@html` on untrusted content — it reprocesses as WebC; prefer
  `@text` or `@raw`.
- Custom-element naming isn't required (no dash needed), but sticking to
  dashed names avoids clashes with real HTML tags.
