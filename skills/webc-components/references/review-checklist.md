# WebC review checklist

Reusable rules for reviewing WebC components. Each rule states the WebC behaviour behind
it, how to find it in source, the fix, and a regression test. Examples come from a
review of the `allonsy-studio/webc-resources` component library; component names there
(`rich-text`, `tag-list`, `skip-link`) illustrate the rule and apply to any library.

Sections run from broken output to cost. Section references like "internals §3" point at
`webc-internals.md`.

## Contents

1. [Container styles apply to slotted components](#1-container-styles-apply-to-slotted-components)
2. [Whitespace prevents default-slot fallbacks](#2-whitespace-prevents-default-slot-fallbacks)
3. [Boolean props need one truthiness rule](#3-boolean-props-need-one-truthiness-rule)
4. [Missing required props fail the build](#4-missing-required-props-fail-the-build)
5. [Dynamic `style` and `class` never evaluate to `undefined`](#5-dynamic-style-and-class-never-evaluate-to-undefined)
6. [Unpassed props resolve to helpers](#6-unpassed-props-resolve-to-helpers)
7. [Slot content cannot see its author's props](#7-slot-content-cannot-see-its-authors-props)
8. [A prop and an attribute never share a name](#8-a-prop-and-an-attribute-never-share-a-name)
9. [Every user-facing string is overridable](#9-every-user-facing-string-is-overridable)
10. [Every component keeps or drops its tag consistently](#10-every-component-keeps-or-drops-its-tag-consistently)
11. [Registered custom properties: cost and syntax](#11-registered-custom-properties-cost-and-syntax)
12. [Per-instance expression cost](#12-per-instance-expression-cost)
13. [Other checks](#13-other-checks)

## 1. Container styles apply to slotted components

**Behaviour.** A descendant selector in a component that takes slotted content applies
to whatever is slotted in, including other components. At equal specificity the
container's rule wins: WebC bundles a slotted component's CSS before its container's
(internals §7).
**Verified** in Chromium.

**Find it.** In any component with a `<slot>`, a selector of the form
`<own-tag> <element>` or `<own-tag> :is(<elements>)` with no `>` and no `:where()`.

**Example.**

| Placement | Result |
| --- | --- |
| `tag-list` in `site-footer`'s column | `site-footer ul` applies: chips stack vertically |
| `tag-list` inside `rich-text` | `rich-text :is(ul, ol)` applies: bullets and padding |
| `site-search` in `side-nav`'s `search` slot | `side-nav svg-icon` changes its icon color; `side-nav a` would restyle result links |
| `data-table` inside `rich-text` | `rich-text :is(th, td)` also matches; the values are identical today, so changing either component breaks the other |

**Fix.** In a container, wrap bare-element descendant selectors in `:where()` so they
carry the container's specificity only:

```css
rich-text :where(ul, ol) {
	padding-inline-start: 1.25rem;
}
```

Or anchor them to the container's own structure with a child combinator
(`side-nav nav > ul a`). Components style their own elements with a slightly more
specific selector (`link-button a[data-variant]`), so their rules apply inside any
container.

**Test.** A test that scans each slot-taking component's CSS and fails on
`<tag> <element>` without `:where()` or `>`, with an allowlist for intended cases.

## 2. Whitespace prevents default-slot fallbacks

**Behaviour.** Every non-`slot` child node, whitespace text and comments included, goes
to the default slot. The fallback renders only when that slot has zero nodes
(internals §3). **Verified.**

**Find it.** `<slot>fallback text</slot>` with no `name`, especially when the fallback is
an accessible name.

**Example.** `skip-link` renders `<a :href="href || '#main'"><slot>Skip to content</slot></a>`.
Called as `<skip-link>\n</skip-link>`, it renders `<a href="#main">\n</a>`: an empty link,
an accessibility failure.

**Fix.** For a single short accessible name, use a prop with a default
(`@label`, falling back to "Skip to content") instead of a default-slot fallback. For
real content, keep the slot and document "write the call on one line, or give content".
Named-slot fallbacks are safe.

**Test.** A fixture test rendering `<x>\n</x>` and asserting the accessible name.

## 3. Boolean props need one truthiness rule

**Behaviour.** `@x` and `@x="false"` both pass strings: `""` and `"false"`. Only `:@x`
passes a real boolean. An unprefixed `x` is a public attribute: it renders on the host and
leaves the prop unset (internals §4). **Verified.**

**Example.** Four components in one library, four behaviours:

| Component | `@x` | `@x="true"` | `:@x="true"` | `@x="false"` | `:@x="false"` | `x` |
| --- | --- | --- | --- | --- | --- | --- |
| `card-grid mono` | on | on | on | off | off | on, and renders on the host |
| `page-notice live` | off | off | on | off | off | off, and renders on the host |
| `page-head theme-toggle` | off | off | on | off | off | off |
| `segmented-control icon-only` | on | on | on | **on** | off | off, and renders on the host |

**Fix.** One expression everywhere, documented once:

```js
/** @returns {boolean} true for `@x`, `@x="true"`, and `:@x="true"`. */
const isOn = (x) => x === true || x === "" || x === "true";
```

The string `"false"` must be off. Each component's docs name the accepted forms.

**Test.** A table-driven fixture test rendering every column above for every boolean
prop.

## 4. Missing required props fail the build

**Behaviour.** A missing prop becomes `undefined`, and an `undefined` attribute is
dropped with no warning (internals §4). Error messages name the attribute, never the file
(internals §9).

**Example.** A radio group rendered from an `options` prop without `@name` produces
nameless radios: several can be checked at once.

**Fix.** When a prop is required for correct output, define a guard function in
`webc:setup` and call it from the attribute that needs the value. Setup cannot see
props, and a top-level `throw` there fails every build that
registers the component (internals §9). Do not generate names from `uid`: it is random
per build.

```html
<script webc:setup>
/**
 * Returns the value, or throws a readable build error when it is missing.
 * @param {unknown} value
 * @param {string} message
 */
function required(value, message) {
	if (value === undefined || value === "") throw new Error(message);
	return value;
}
</script>
<input type="radio" :name="required(name, 'radio-group: @name is required')">
```

The build error names the attribute, then `Original error message: radio-group: @name
is required`.

**Test.** A test asserting the render rejects with that message.

## 5. Dynamic `style` and `class` never evaluate to `undefined`

**Behaviour.** `style` and `class` are merged with `.toString()`, so `:style="undefined"`
crashes the build. Every other attribute may be `undefined` safely (internals §4).

**Find it.** `:style="cond ? '…' : undefined"`, or `:class` reading an optional prop
with no fallback.

**Fix.** Return `''`: `:style="size ? '--size: ' + size : ''"`.

## 6. Unpassed props resolve to helpers

**Behaviour.** Helpers sit below props in the data cascade (internals §2). An unpassed
prop named `url`, `slugify`, or any registered filter resolves to that function. Outside
Eleventy the helpers are whatever the host registers (hosts §2).

**Find it.** A prop named like a common filter, read without a type check.
`href || '#'` returns the function when `href` is a helper name.

**Fix.** Guard: `typeof url === 'string' ? url : '#'`. Or rename the prop.

## 7. Slot content cannot see its author's props

**Behaviour.** Slotted markup is compiled with the receiving component's props and the
page's context (internals §3). **Verified.**

**Find it.** Inside a component definition, a dynamic attribute in another component's
children that reads the outer component's prop or a `webc:setup` helper.

**Fix.** Pass the value as a prop to the inner component, and let it render the markup.
Never forward a `<slot>` into another component's children: it recurses until out of
memory.

## 8. A prop and an attribute never share a name

**Behaviour.** `<data-table @label="L" label="plain">` crashes with
`Cannot redefine property: label___webc_privacy` (internals §2). **Verified.**

**Fix.** Choose prop names that do not collide with attributes callers will set.
`@for` and other reserved words also fail as prop names.

## 9. Every user-facing string is overridable

**Rule.** Every string a user reads or hears, including script-generated live-region
text ("N results") and fallback labels ("Sample N"), can be replaced by a prop. Pass
script strings to the client through `data-*` attributes on the server-rendered markup.

## 10. Every component keeps or drops its tag consistently

**Behaviour.** The host tag is kept only when the file has a non-empty `<style>`, a
non-setup script, a stylesheet link, `webc:root`, or declarative shadow DOM.
`webc:root="override"` replaces the tag instead (internals §1).

**Find it.** A library where some template components have a `<style>` and some do not:
their tags appear inconsistently, and adding a style later changes the DOM.

**Fix.** Either give every component a `<style>` that sets `display` (usually `block`)
on its tag, or document in the component's JSDoc that the tag is dropped.

## 11. Registered custom properties: cost and syntax

**Behaviour.** Registering shared tokens in each component (`@property`) lets each
component render correctly without a shared stylesheet, but bundling deduplicates by
file content, not by rule. **Example:** 84
`@property` lines for 22 tokens on one page, 23% of raw CSS and 10% gzipped.

**Rule.** An acceptable trade-off when documented. Use `syntax: "*"`: a typed syntax
rejects `rem` and `em`, and makes `light-dark()` always resolve to the light value. Derived tokens
using `var()` cannot be registered; give them a fallback instead.

## 12. Per-instance expression cost

**Behaviour.** Every dynamic attribute, `@text`, and `webc:if` compiles a fresh
`vm.Script` each evaluation (internals §5).

**Example.** An icon component with five dynamic attributes, one `webc:if`, and a helper
called three times costs eight compiles per instance. A single
`@raw="render(name, label)"` halves it.

**Rule.** Optimize only heavily repeated components (icons, table cells). Elsewhere,
keep the more readable form.

## 13. Other checks

- Child-combinator heading rules miss wrapped headings: `section > h2` does not match a
  heading inside `heading-anchor > h2`.
- Mixing `@media` viewport queries with container queries in one layout system: prefer
  container queries for components.
- `??` versus `||` on `""`: an empty-string prop does not fall through with `??`.
- Directional glyphs (`←`, `→`) do not mirror in right-to-left text. Use logical
  alternatives or a `:dir(rtl)` transform.
- Regular HTML comments in a component ship to every page (internals §9).
- Client scripts without a block wrapper collide in the concatenated bundle
  (internals §7).
