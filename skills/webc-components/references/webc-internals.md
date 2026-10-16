# How WebC works

Scope: `@11ty/webc` 0.11.4 and `@11ty/eleventy-plugin-webc` 0.11.2, read in full
(`webc.js`, `src/ast.js`, `attributeSerializer.js`, `componentManager.js`, `astQuery.js`,
`dataCascade.js`, `looping.js`, `moduleScript.cjs`, `proxyData.cjs`,
`fasterVmContext.cjs`, `css.js`, `assetManager.js`, `astCache.js`, and both plugin files).

Claims marked **verified** were reproduced by compiling with WebC or rendering in
Chromium. File and line citations point at those versions; line numbers drift between
releases, so search for the function name when they do not match.

## Contents

1. [Files, parsing, and the host tag](#1-files-parsing-and-the-host-tag)
2. [The data cascade](#2-the-data-cascade)
3. [Slots](#3-slots)
4. [Attributes and props](#4-attributes-and-props)
5. [Scripts: how expressions run](#5-scripts-how-expressions-run)
6. [Flow control](#6-flow-control)
7. [Bundling](#7-bundling)
8. [`@html`, `@raw`, `@text`](#8-html-raw-text)
9. [Other edge cases](#9-other-edge-cases)

## 1. Files, parsing, and the host tag

- A component is a file. parse5 parses it once as a document (`<!doctype html>`
  prepended), and the AST is cached **by content string, forever** (`astCache.js`): never
  evicted during a build. The same cache holds the AST of every string reprocessed
  through `@html`, so a docs site's whole Markdown output stays in memory until the
  process ends.
- `componentManager.parse` runs **once per file per build**, shared across pages. It
  decides `ignoreRootTag`: the host tag is **dropped** unless the file has a non-empty
  `<style>`, a `<script>` that is not `webc:setup`, a `<link rel=stylesheet>`,
  `webc:root`, or declarative shadow DOM (`componentManager.js:53`).
- Consequence: a template component with no `<style>` vanishes from output. Add a
  `<style>` later and the tag silently appears. A custom element defaults to
  `display: inline`, wrapping block content in an inline box. Always set `display` on
  the tag when it is kept, and document when it is not.

## 2. The data cascade

Every dynamic attribute, `@text`, `@html`, `webc:if`, and `webc:for` is evaluated
against an object built per node by `dataCascade.getData` (`dataCascade.js:37`). Later
entries win:

1. Page global data, **only when the authoring context is a top-level page** (layout or
   content file). Absent inside a component definition.
2. Helpers (Eleventy filters and `addJavaScriptFunction`s). So an **unpassed prop
   resolves to a same-named helper**: `url`, `slugify`, `log`, anything the project
   registers.
3. `webc:for` loop variables.
4. The component's `webc:setup` globals (every top-level `const` and `function`).
5. The host element's evaluated attributes (public ones too: `id`, `class`, `slot`,
   `style`).
6. The component's props, camelCased (`icon-only` becomes `iconOnly`).
7. `$data` (always the page's global data, even inside components) and `webc.*`.

**Verified** consequences:

- `<meta webc:is="page-head" webc:nokeep>` on a page with front matter `title` renders
  `<title></title>`. Nested components never see unprefixed globals; pass the prop.
- A loop variable named like a setup constant is shadowed by the constant (4 beats 3).
- A prop named like a public attribute on the same tag
  (`<data-table @label="L" label="plain">`) **crashes the build** with
  `Cannot redefine property: label___webc_privacy` (`attributeSerializer.js:196`).

## 3. Slots

`getSlottedContentNodes` (`ast.js:362`) assigns each top-level child with a `slot`
attribute to that name (last one wins) and **every other child node, whitespace text
included**, to the default slot. `getContentForNamedSlotNode` (`ast.js:559`) renders a
`<slot>`'s fallback only when `slots.default.childNodes.length === 0`.

- **Verified:** `<skip-link>\n</skip-link>` renders `<a href="#main"> </a>`, an empty
  link. A comment inside the tag has the same effect. Default-slot fallbacks are a trap.
- Named slot fallbacks are safe: they render whenever no child carries that name.
- Slot content is compiled with the **receiving** component's props, and with its
  authoring context set to the page, not to the component that wrote it. **Verified:**
  inside `<x-outer @outerprop="OP">`, whose definition writes
  `<x-inner @href="h"><span :data-a="typeof outerprop" :data-b="href">`, the span sees
  `outerprop` as `undefined` and `href` as `"h"`. Slot content never sees its author's
  props or setup helpers (WebC issue 152). Pass prop-driven values as props instead.
- Forwarding a `<slot>` inside another component's children recurses until out of
  memory. Render `$data.content` instead.
- A slot name takes one element; a second with the same name replaces the first. Group
  several in `<template slot="name" webc:nokeep>`.

## 4. Attributes and props

From `attributeSerializer.js`:

- Prefixes: `@` is a prop (private, literal string), `:` a dynamic public attribute,
  `:@` a dynamic prop. Props never render on the host; public attributes do. So
  `<page-notice live>` puts `live` on the host **and** does nothing, because the prop is
  unset.
- `getString` (`:201`) drops a value that is `undefined`, `null`, `false`, or `0`;
  renders `""` as a bare attribute; renders `true` as `"true"`. **Verified** with
  `:data-zero="0"` (dropped). Props bypass this.
- `style` and `class` are merged across the host and `webc:root`. `mergeAttributes`
  (`:35`) calls `.toString()`, so `:style="undefined"` throws. Return `''` to omit.
  Every other attribute may be `undefined` safely.
- Prop names are camelCased for data: `:@icon-only` is read as `iconOnly`.
- Reserved words cannot be prop names (`@for` breaks); pick another name.
- An object literal as a whole expression reads as a block. Wrap it:
  `:@prev="({ url: '#a' })"`.
- `@text="Hi"` evaluates `Hi` as an expression. Literal text goes in the element body.

## 5. Scripts: how expressions run

- Each dynamic attribute, `@text`, `webc:if`, and loop expression becomes
  `new vm.Script(content)` **every time it is evaluated** (`moduleScript.cjs:55`). There
  is no script cache; only the vm context is reused per component file
  (`fasterVmContext.cjs`). Attribute count per instance is the cost driver, not
  expression complexity.
- **Verified:** 300 icon components with five dynamic attributes compile in 48 ms; the
  same as one `@raw` render expression in 25 ms. Matters only for heavily repeated
  components.
- `webc:setup` runs once per file through `node-retrieve-globals`, with the global data
  of **whichever page parsed the file first**. Only functions and constants belong
  there; compute per-page values in attribute expressions. It cannot import npm
  modules. Values cross a vm boundary: a `Set` or `Map` built there can lose prototype
  methods; prefer arrays and plain objects.
- Loop iterations run concurrently (`Promise.all`, `ast.js:983`) and join with `"\n"`.

## 6. Flow control

`webc:if`, `webc:elseif`, and `webc:else` must be siblings; whitespace and comments
carry the state across (`ast.js:1037`). `webc:for` on the same element runs first, so
the `if` is evaluated per item with the loop variable in scope. An `if` attribute with no
value is false.

## 7. Bundling

- In bundler mode every `<style>`, non-setup `<script>`, and `<link rel=stylesheet>` is
  lifted into a bucket keyed by **the component file** and deduplicated by content
  (`ast.js:1256`). Ten instances ship one copy.
- Order within a bucket is `DepGraph.overallOrder()`: a component's assets come
  **before** those of components that use it, and components found in slotted content
  become dependencies of the receiving component. Otherwise discovery order.
  **Verified:** `x-inner` before `x-outer` before an unrelated `x-fall`.
- So two unrelated components with same-specificity rules on the same element resolve by
  whichever the page reached first. This is the source of container leaks
  (review checklist §1).
- `webc:keep` on a style or script leaves it inline. `webc:bucket` on the tag or an
  ancestor host routes it.
- Scripts from different components concatenate into one file. Wrap each in a block
  `{ … }` so top-level `const`s do not collide.

## 8. `@html`, `@raw`, `@text`

`@html` re-parses its string as WebC when it contains `<` (`ast.js:666`), so Markdown
output containing component tags becomes components. That costs a parse5 parse per page
plus a permanent AST cache entry. `@raw` skips both. `@text` escapes.

## 9. Other edge cases

- `uid` is `nanoid(5)` per instance with no deterministic option in the Eleventy
  plugin: any use makes output nondeterministic.
- `getTagName` honours `webc:is`. A component on a void tag
  (`<meta webc:is="x" webc:nokeep />`) always drops the host, which is how head
  components work. Nothing inside `<head>` may keep a custom tag, or the parser moves
  the rest into `<body>`.
- In component mode, `<html>`, `<head>`, and `<body>` tags inside a definition are
  ignored.
- `<!--- triple-dash --->` comments are stripped; regular comments ship to every page.
  Document in JSDoc inside `<script webc:setup>` instead.
- Quirks-mode input throws; any `<!doctype>` other than `html` triggers it.
- Error messages name the attribute, not the file or line. A `throw` in `webc:setup` is
  the only way to give a consumer a readable message (an unknown icon name, a missing
  required prop).
- Bundle `<link>`s need `webc:keep`, and `webc:if` cannot guard them: the bundle URL
  resolves after render. Use `dropEmptyBundleTags`.
