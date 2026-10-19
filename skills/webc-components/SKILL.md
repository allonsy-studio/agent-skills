---
name: webc-components
description: Author and review WebC (@11ty/webc) components using a source-level account of how WebC compiles them. Use this whenever someone writes, edits, debugs, or reviews a `.webc` file, a WebC layout or page, or a component library built on `@11ty/eleventy-plugin-webc`, even if the request only says "component" and the project has `.webc` files. Covers host tags that appear or vanish, props that resolve to the wrong value, slot fallbacks that never render, container styles that leak into slotted components, `webc:setup`, `webc:for`, `webc:if`, `@html`/`@raw`/`@text`, and bundling order. Trigger on phrases like "write a WebC component", "review this .webc", "why is my slot empty", "my prop is undefined", "audit our WebC components", "set up my WebC conventions", or a pasted `.webc` file. Do not trigger for Eleventy configuration, Nunjucks or Liquid templates, or framework-agnostic component naming and ARIA questions with no WebC involved.
metadata:
  recommended-model: claude-sonnet-5-5
---

# WebC components

Most WebC bugs compile without errors and appear only in the rendered HTML: an empty
link, a custom tag that appears in the output after an unrelated style change, a prop
that resolves to an Eleventy filter. This skill documents how `@11ty/webc` 0.11.x compiles components, from
its source code, so authors avoid these bugs and reviewers can find them.

**Keep WebC facts and style choices apart.** `references/webc-internals.md` and
`references/review-checklist.md` describe how WebC behaves, for any project.
`references/conventions.md` holds universal practices plus decision points with several
valid options. A saved **profile** records the option a user or project chose for each
(see the Profiles section below).

## Symptom lookup

Match the user's symptom or error here first. Read only the cited section.

| Symptom | Cause | Fix | Read |
| --- | --- | --- | --- |
| Slot fallback text never shows; an empty link or button | Whitespace or a comment inside the host tag fills the default slot | A prop with a default for short required text | review-checklist §2 |
| A component looks wrong only inside another component | The container's bare descendant selector (`rich-text ul`) matches the slotted component and, at equal specificity, wins: the container's CSS is bundled last | `:where()` or `>` in the container's selector | review-checklist §1 |
| `@x="false"` still turns an option on | `"false"` is a non-empty string, so it is truthy | `x === true \|\| x === '' \|\| x === 'true'` | review-checklist §3 |
| A hyphenated prop is always `undefined` | Props are read camelCased: `@icon-only` is `iconOnly` | Read the camelCase name | internals §4 |
| `{{ label }}` appears literally in the output | WebC has no `{{ }}` interpolation | `<span @text="label"></span>` for text, `:attr="label"` for attributes | internals §8 |
| An unprefixed attribute does nothing | `live` is a public attribute; only `@live` sets the prop | Prefix with `@` or `:@` | internals §4 |
| Build error `reading 'toString'` | A dynamic `style` or `class` returned `undefined` | Return `''` | review-checklist §5 |
| An unpassed prop holds a function, not `undefined` | It resolves to a same-named helper (`url`, `slugify`) | `typeof url === 'string'` check, or rename the prop | review-checklist §6 |
| Slotted markup cannot read the outer component's prop | Slot content compiles with the receiving component's data | Pass the value as a prop | review-checklist §7 |
| The custom tag appears or vanishes after a style change | The tag is kept only when the file has a `<style>` or one of the other conditions in Workflow 1, step 2 | Set `display` on a kept tag, or document a dropped one | review-checklist §10 |
| Build error `Cannot redefine property: x___webc_privacy` | A prop and a public attribute share a name on one tag | Rename the prop | review-checklist §8 |
| One page's value appears on every page | `webc:setup` runs once per file with the first page's data | Compute per-page values in attribute expressions | internals §5 |
| A nested component cannot see page front matter | Components see page data only through `$data` or props | Pass a prop, or read `$data` | internals §2 |
| Ids or `name`s change on every build | `uid` is random per build | Derive them from props | internals §9 |

## When to read which reference

| Doing this | Read |
| --- | --- |
| Predicting output, debugging a surprise, any "why does WebC…" | `references/webc-internals.md` |
| Reviewing a component or a library | `references/review-checklist.md`, then internals for the cited sections |
| Writing a component, or judging style in a review | `references/conventions.md`, filtered by the active profile |
| Setting up or changing a profile | `references/conventions.md`, then `templates/profile.md` |

Read the internals table of contents first; jump to the section a question needs.

## Profiles

A profile stores a user's choices for the decision points in `references/conventions.md`,
plus any house rules of their own.

### Finding the active profile

Check in this order and use the first found:

1. **Project instructions** (`AGENTS.md`, `CLAUDE.md`, or similar) that state component
   conventions. These take precedence.
2. **Memory**: an entry titled `webc-components profile`.
3. **File**: `profile.md` in this skill's own directory (next to this `SKILL.md`).

With no profile, apply the universal practices only and follow the project's existing
code on each decision point.

### Setting one up

Offer setup once, the first time a component is written or reviewed without a profile,
and whenever the user asks ("set up my WebC conventions", "we use `webc:scoped`"). Skip
it for one-off questions.

1. Offer the three presets from `references/conventions.md` (`site`, `library`,
   `class-based`) plus **custom**. Use a structured question tool when the
   harness has one.
2. For **custom**, ask about the decision points a few at a time, with each option's
   one-line trade-off. To start from a preset, ask only about the decisions that
   differ.
3. Ask for house rules no decision covers (naming, a required wrapper, a token prefix).
   Record them in the user's words.
4. Ask where to save:
   - **Memory**, when the harness has persistent memory: follows the user across
     projects. Save the filled template as one entry titled `webc-components profile`.
   - **File** in this skill's directory as `profile.md`: stays on this machine. A
     reinstall with the `npx` installer keeps it; a plugin update may replace the skill
     directory, so note that when saving.
5. Fill `templates/profile.md`, save it, and show the saved result.

To change a profile, read it, apply the change, and save it back to the same place.

## Workflow 1: author a component

1. **Load the profile** (see Profiles above) and apply its choices.
2. **Decide whether the custom tag renders.** WebC removes the custom tag from the
   output unless the file has a non-empty `<style>`, a non-setup `<script>`, a
   stylesheet `<link>`, `webc:root`, or declarative shadow DOM.
   `webc:root="override"` replaces the tag with the element that carries it. If the tag
   renders, set `display` on it. If it does not, say so in the component's docs.
3. **Choose slots or props.** Content (text, headings, links, lists) goes in slots.
   Settings and data the component computes from go in props. A short accessible name
   that must never be empty is a prop with a default, not a default-slot fallback.
4. **Validate props.** Normalize booleans with one expression
   (`x === true || x === '' || x === 'true'`). Type-check any prop whose name matches a
   helper (`typeof url === 'string'`). For a required prop, define a check function in
   `webc:setup` and call it from the attribute that needs the value; setup runs once per
   file and cannot see props. Return `''`, never `undefined`, from a dynamic `style` or
   `class`.
5. **Scope the CSS** with the profile's `style-scope` choice. A component that takes
   slotted content wraps bare-element descendant selectors in `:where()` or anchors them
   with a child combinator, so they never outrank the slotted component's own rules.
6. **Wrap client scripts in a block** `{ … }`. The bundle joins every component's
   scripts into one file, so top-level `const` names from two components conflict.
7. **Render a fixture and read the HTML** (see Rendering a fixture below). Include the edge cases: a host with only a
   newline inside, a boolean prop set to `"false"`, an unpassed optional prop, and the
   component slotted into its most likely container.

## Workflow 2: review a component or library

1. Ask for scope if unclear: one component, or the whole library. Styles from one
   component applying to another only show up when reviewing the whole library.
2. Go through `references/review-checklist.md` in order. The first sections are the bugs
   verified in rendered output; the later ones are cost and consistency. A question about
   one bug is still a review: after answering it, scan every file the user shared for:
   - `<!--` comments that are not `<!---` (they ship to every page)
   - a kept host tag with no `display` set
   - a default `<slot>` with fallback text
   - a container selector like `own-tag ul` with no `:where()` or `>`
   - boolean props not using the one truthiness rule, all of them, not only the one asked about
   - a dynamic `style` or `class` that can be `undefined`

   End the reply with a **Scan** list: one line per item above, either the file and line
   where it occurs or "clear". Quote the line you found; do not mark an item clear without
   reading every line of the file. Then propose the checklist's regression test for each
   rule that applies.
3. For each finding, cite the rule, the file and line, the concrete failing input, and
   the rendered result. Render it (see Rendering a fixture below) and add **verified**.
   When code cannot be run, add **not rendered** instead; never guess the output.
4. Give each finding one label and report them in this order:
   - `broken`: wrong output, a build failure, or an accessibility failure today.
   - `fragile`: correct today; a likely change breaks it.
   - `cost`: build time, page weight, or inconsistency between components.
   - `convention`: differs from the active profile. Without a profile, report only
     universal-practice gaps and places where the library mixes options on one
     decision point.
5. Propose a regression test for each fixed bug.

Per finding:

```markdown
### [broken] Short claim
- Where: `components/skip-link.webc:21`
- Input: `<skip-link>\n</skip-link>`
- Renders: `<a href="#main">` + newline + `</a>` (an empty link), verified
- Rule: review-checklist §2, internals §3
- Fix: an `@label` prop defaulting to "Skip to content"
- Test: fixture rendering the newline case
```

## Rendering a fixture

`@11ty/webc` is installed with `@11ty/eleventy-plugin-webc`. Save as `render.mjs` in the
project root and run `node render.mjs`:

```js
import { WebC } from "@11ty/webc";

const page = new WebC();
page.defineComponents("_components/*.webc");
page.setContent(`<skip-link>\n</skip-link>`);
const { html } = await page.compile();
console.log(JSON.stringify(html));
```

Change the glob to the project's component folder. `JSON.stringify` makes whitespace
visible. Delete the file afterwards.

## Reference files

- `references/webc-internals.md`: how WebC compiles a component, with source citations
  and the behaviours verified by compiling or rendering.
- `references/review-checklist.md`: reusable review rules, each with a concrete
  example from a real component library.
- `references/conventions.md`: universal practices, decision points with their
  options, and three presets.
- `templates/profile.md`: the profile format, filled in and saved during setup.
