# Component conventions

Conventions build on the WebC behaviour in `webc-internals.md`. There are two kinds:

- **Universal practices** avoid a known WebC failure or an accessibility failure. Apply
  them in every project.
- **Decision points** have more than one valid answer. A project chooses one option per
  decision and uses it consistently. The choices are stored in a **profile** (see
  `SKILL.md`, "Profiles"). Without a profile, follow the project's existing code; when
  the code is inconsistent, report the inconsistency rather than choosing for the
  project.

Each decision has an id (`style-scope`) and lettered options (`a`, `b`, `c`). A profile
records each choice as `style-scope: a`. The presets at the end are common combinations.

## Contents

1. [Universal practices](#universal-practices)
2. [Decision points](#decision-points)
3. [Presets](#presets)

## Universal practices

1. **One file per component.** Markup, styles, and behavior live in the `.webc`
   file. No dependence on another component's selectors.
2. **Set `display` on a kept host tag.** A custom element defaults to `inline`
   (internals §1).
3. **Prefix every prop.** Use `@name` or `:@name` at every call site. An unprefixed
   attribute renders on the host and leaves the prop unset (internals §4).
4. **One boolean rule.** `x === true || x === '' || x === 'true'`, so the string
   `"false"` is off (review checklist §3).
5. **Required props fail the build** through a guard function defined in `webc:setup`
   and called from the attribute that needs the value, with a message naming the
   component and the prop (review checklist §4).
6. **Dynamic `style` and `class` return `''`**, never `undefined` (internals §4).
7. **Guard helper-shadowed props** with a type check: `typeof url === 'string'`
   (internals §2).
8. **No HTML comments.** They ship to every page. Document in `webc:setup` or in
   `<!--- triple-dash --->` comments, which WebC strips (internals §9).
9. **Client scripts are wrapped in a block** `{ … }`, and `customElements.define` is
   guarded by `customElements.get` (internals §7).
10. **Markup works without JavaScript.** Scripts enhance server-rendered output; they do
    not create it.
11. **Generic components take props and slots, not `$data`.** Page data couples a
    component to one site's data shape (`$data.page` is the common exception).
12. **Head components** are called as `<meta webc:is="name" webc:nokeep />` and take no
    slots (internals §9).
13. **Containers do not style slotted components.** Wrap descendant selectors in
    `:where()` or anchor them with `>` (review checklist §1).
14. **Every user-facing string is overridable** by a prop, including script-generated
    text (review checklist §9).
15. **Accessible in every color mode.** WCAG 2.2 AA in light, dark, and forced colors.
16. **Spec links point to a section anchor**, never a spec's home page.

## Decision points

| Id | Decides | Options |
| --- | --- | --- |
| `style-scope` | How styles stay inside a component | a: tag selectors · b: `webc:scoped` · c: classes |
| `cascade-layers` | Whether component CSS sits in a layer | a: one named layer · b: no layers |
| `tokens` | How theming values reach a component | a: registered shared tokens · b: `var()` with literal fallback · c: none |
| `docs` | Where props, slots, and custom properties are documented | a: JSDoc in `webc:setup` · b: a README per component · c: triple-dash comments |
| `behavior` | How client-side behavior attaches | a: custom element on the tag · b: plain script · c: none |
| `content-api` | Whether content arrives as slots or props | a: slots first · b: props first |
| `host-tag` | Whether the custom tag appears in output | a: always kept · b: dropped and documented · c: explicit per component |
| `print` | Where print styles live | a: in each component · b: one print stylesheet |
| `file-header` | Whether files carry a license header | a: SPDX block · b: none |
| `categories` | Whether components declare a category | a: JSDoc `@category` · b: none |
| `previews` | How components are shown and checked | a: a story per component · b: fixture tests only · c: none |

### style-scope

- **a: Tag selectors.** Every selector starts at the component's tag (`card-grid ul`).
  No classes, no build step. Readable output; the tag must be kept (`host-tag: a`).
- **b: `webc:scoped`.** WebC generates a hashed class, adds it to the host, and
  prefixes the component's selectors with it; `:host` targets the tag itself. Guards
  against name collisions; output carries generated class names.
- **c: Classes.** The component emits class names styled by a shared stylesheet or a
  CSS framework. Fits an existing class-based design system; the component no longer
  contains its styles, so universal practice 1 applies only to markup and behavior.

### cascade-layers

- **a: One named layer** (for example `components`). One foundation component declares
  the layer order and writes to a bundle bucket linked first, since a page renders its
  content before its layout and the default bucket would declare the order late
  (internals §7).
- **b: No layers.** Simpler; specificity and bundle order decide conflicts.

### tokens

- **a: Registered shared tokens.** A component token falls back to a shared one,
  `var(--card-gap, var(--space-m))`, and the component registers each shared token it
  reads with `@property … syntax: "*"` so it renders standalone. Costs repeated
  `@property` rules per page (review checklist §11).
- **b: `var()` with a literal fallback**, `var(--card-gap, 1rem)`. No registration;
  the fallback is duplicated wherever the token is read.
- **c: None.** Values are literal. Fine for a single site with no theming.

### docs

- **a: JSDoc in `webc:setup`** with `@prop`, `@slot` (`@slot -` for the unnamed slot),
  and `@cssprop`. WebC strips the block, and tools can read it.
- **b: A README per component.** Easy to browse; drifts from the source unless tested.
- **c: Triple-dash comments** next to the markup they describe.

### behavior

- **a: Custom element on the tag.** Setup is idempotent (`connectedCallback` runs again
  on a move), waits for `DOMContentLoaded` while the document is parsing, and is undone
  in `disconnectedCallback`. Covers elements added after load. Needs `host-tag: a`.
- **b: Plain script** that queries for the component's markup once on load. Smaller;
  misses elements added later.
- **c: None.** Server-rendered output only.

Sketch of option a:

```js
{
	class CopyButton extends HTMLElement {
		#wired = false;

		/** Wires listeners once; runs again on a move. */
		connectedCallback() {
			if (this.#wired) return;
			this.#wired = true;
			this.querySelector("button")?.addEventListener("click", () => this.#copy());
		}

		/** Undoes setup. */
		disconnectedCallback() {}

		/** Copies the value and announces the result. */
		async #copy() {}
	}
	if (!customElements.get("copy-button")) customElements.define("copy-button", CopyButton);
}
```

### content-api

- **a: Slots first.** Headings, text, links, and lists are the caller's markup, so the
  caller chooses heading levels. Props are for settings (`@variant`) and data the
  component computes from. A list component takes `<li>` children. WebC cannot test a
  slot for content, so hide an empty wrapper with `:not(:has(*))`.
- **b: Props first.** The component renders from data (`:@items="…"`). Suits
  components fed from a CMS or data files; the component sets heading levels.

### host-tag

- **a: Always kept.** Every component has a `<style>` that sets `display` on its tag.
- **b: Dropped and documented.** Template components without styles drop the tag, and
  their docs say so (review checklist §10).
- **c: Explicit per component** with `webc:root`, `webc:root="override"`, or a call-site
  `webc:nokeep`, so the choice is
  visible in the source rather than inferred from the file's contents.

### print

- **a: In each component**, inside its own `@media print`.
- **b: One print stylesheet** for the site.

### file-header

- **a: SPDX block** at the top of every `.js` file and `webc:setup` block.
- **b: None.**

### categories

- **a: JSDoc `@category`** from a fixed list (for example `layout`, `landmark`,
  `container`, `component`, `template`, `document`). Lets a preview group components.
- **b: None.**

### previews

- **a: A story per component**, rendered from a WebC page, with docs read from the
  component's JSDoc.
- **b: Fixture tests only**, rendering each component and asserting on the HTML.
- **c: None.**

## Presets

| Decision | `site` | `library` | `class-based` |
| --- | --- | --- | --- |
| `style-scope` | b | a | c |
| `cascade-layers` | b | a | a |
| `tokens` | b | a | b |
| `docs` | c | a | b |
| `behavior` | b | a | a |
| `content-api` | a | a | a |
| `host-tag` | b | a | c |
| `print` | b | a | b |
| `file-header` | b | a | b |
| `categories` | b | a | b |
| `previews` | b | a | a |

- **`site`**: components used in one Eleventy site. The fewest requirements.
- **`library`**: a published package of standalone components. Every component renders
  correctly on its own, in any site. This is the combination used by
  `allonsy-studio/webc-resources`.
- **`class-based`**: WebC wrapping an existing class-based design system or CSS
  framework, where the classes and global styles already exist.
