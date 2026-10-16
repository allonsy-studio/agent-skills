---
name: webc-components
description: Author and review WebC (@11ty/webc) components with a code-level model of how WebC compiles them, so output matches intent on the first render. Use this whenever someone writes, edits, debugs, or reviews a `.webc` file, a WebC layout or page, or a component library built on `@11ty/eleventy-plugin-webc`, even if the request only says "component" and the project has `.webc` files. Covers host tags that appear or vanish, props that resolve to the wrong value, slot fallbacks that never render, container styles that leak into slotted components, `webc:setup`, `webc:for`, `webc:if`, `@html`/`@raw`/`@text`, and bundling order. Trigger on phrases like "write a WebC component", "review this .webc", "why is my slot empty", "my prop is undefined", "audit our WebC components", or a pasted `.webc` file. Do not trigger for Eleventy configuration, Nunjucks or Liquid templates, or framework-agnostic component naming and ARIA questions with no WebC involved.
---

# WebC components

Most WebC bugs compile cleanly and only show up in rendered HTML: an empty link, a tag
that silently appears, a prop that resolves to an Eleventy filter. This skill carries a
model of what the compiler actually does (`@11ty/webc` 0.11.x, read at source level) so
components are written right the first time and reviews find the bugs that tests miss.

**Keep WebC facts and house style apart.** `references/webc-internals.md` and
`references/review-checklist.md` describe how WebC behaves, for any project.
`references/conventions.md` is the Allons-y studio's opinionated style. Apply it only to
Allons-y repositories, or when the project's own `AGENTS.md` adopts it; otherwise offer it
as a suggestion, labelled as such.

## When to read which reference

| Doing this | Read |
| --- | --- |
| Predicting output, debugging a surprise, any "why does WebC…" | `references/webc-internals.md` |
| Reviewing a component or a library | `references/review-checklist.md`, then internals for the cited sections |
| Writing a component for an Allons-y repo, or a repo that adopts its rules | `references/conventions.md` |

Read the internals table of contents first; jump to the section a question needs.

## Workflow 1: author a component

1. **Decide the host tag's fate.** WebC drops the custom tag unless the file has a
   `<style>`, a non-setup `<script>`, a stylesheet `<link>`, `webc:root`, or declarative
   shadow DOM. If the tag is kept, set `display` on it. If it is dropped, say so in the
   component's docs.
2. **Choose slots or props.** Content (text, headings, links, lists) goes in slots.
   Settings and data the component computes from go in props. A short accessible name
   that must never be empty is a prop with a default, not a default-slot fallback.
3. **Write the props defensively.** Normalize booleans with one expression
   (`x === true || x === '' || x === 'true'`). Guard any prop whose name matches a helper
   (`typeof url === 'string'`). `throw` in `webc:setup` when a required prop is missing.
   Return `''`, never `undefined`, from a dynamic `style` or `class`.
4. **Scope the CSS.** Selectors start at the component's tag. A component that takes
   slotted content wraps bare-element descendant selectors in `:where()` or anchors them
   with a child combinator, so they never outrank the slotted component's own rules.
5. **Keep scripts collision-safe.** Wrap each component's client script in a block
   `{ … }`; bundles concatenate scripts from every component into one file.
6. **Render a fixture and read the HTML.** Include the edge cases: a host with only a
   newline inside, a boolean prop set to `"false"`, an unpassed optional prop, and the
   component slotted into its most likely container.

## Workflow 2: review a component or library

1. Ask for scope if unclear: one component, or the whole library (cross-component leaks
   only show up at library scope).
2. Walk `references/review-checklist.md` in order. The first sections are the bugs
   verified in rendered output; the later ones are cost and consistency.
3. For each finding, cite the rule, the file and line, the concrete failing input, and
   the rendered result. Mark a finding **verified** only after compiling or rendering it.
4. Report findings grouped by severity: broken output or accessibility failures first,
   then latent bugs (correct today, wrong under a plausible change), then cost and
   consistency. Separate convention gaps (house style) from WebC bugs.
5. Propose a test that pins each fixed bug, so it cannot come back.

Per finding:

```markdown
### [severity] Short claim
- Where: `components/skip-link.webc:21`
- Input: `<skip-link>\n</skip-link>`
- Renders: `<a href="#main"> </a>` (an empty link)
- Rule: review-checklist §2, internals §3
- Fix: an `@label` prop defaulting to "Skip to content"
- Pin it: fixture test rendering the newline case
```

## The highest-impact rules

1. Whitespace defeats a default-slot fallback: `<x>\n</x>` renders the newline, not the
   fallback.
2. A container's bare descendant selectors (`rich-text ul`) style slotted components;
   bundle order breaks the tie. Use `:where()` or `>`.
3. `@x="false"` passes the string `"false"`, which is truthy.
4. `:style="undefined"` and `:class="undefined"` crash the build. Return `''`.
5. An unpassed prop resolves to a same-named helper (`url`, `slugify`), not `undefined`.
6. Slot content sees the receiving component's props, never its author's.
7. A template component's host tag appears or vanishes with its `<style>`.
8. A prop and a public attribute of the same name on one tag crash the build.
9. `webc:setup` runs once per file with the first page's data. Per-page values belong in
   attribute expressions.
10. `uid` is random per build. Never derive ids or `name`s from it.

## Reference files

- `references/webc-internals.md`: how WebC compiles a component, with source citations
  and the behaviours verified by compiling or rendering.
- `references/review-checklist.md`: reusable review rules, each with a concrete
  example from a real component library.
- `references/conventions.md`: the Allons-y studio's opinionated component conventions.
