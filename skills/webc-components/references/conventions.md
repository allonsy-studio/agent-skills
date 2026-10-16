# Allons-y studio conventions

**These are opinions, not WebC facts.** They are the house rules of the Allons-y studio,
taken from `allonsy-studio/webc-resources` (`AGENTS.md`). Apply them to Allons-y
repositories and to projects whose own instructions adopt them. Elsewhere, offer them as
suggestions and label them as house style, never as WebC requirements.

Where a convention exists because of a WebC behaviour, the internals section is cited.

## Contents

1. [Ownership and styling](#ownership-and-styling)
2. [Props and slots](#props-and-slots)
3. [Documentation](#documentation)
4. [Behaviour](#behaviour)
5. [Head components](#head-components)
6. [Accessibility and quality](#accessibility-and-quality)

## Ownership and styling

1. One `.webc` file owns its markup, styles, and behaviour. No dependence on classes,
   global stylesheets, or another file's selectors.
2. Selectors start at the component's custom tag. No classes, no `webc:scoped`. Set
   `display` on the tag (internals §1).
3. Styles sit in a cascade layer: `components` for generic components, `studio` for
   studio components. One foundation component declares the layer order and writes to a
   bundle bucket that is linked first, because a page renders its content before its
   layout and the default bucket would declare the order late (internals §7).
4. A component token falls back to the shared one:
   `var(--component-token, var(--shared-token))`. Each shared token the component reads
   is registered in its own `<style>` with `syntax: "*"`:

   ```css
   @property --allonsy-space-m { syntax: "*"; inherits: true; initial-value: 1.25rem; }
   ```

5. Print rules live in the component's own `@media print`. A component that sets a size
   and padding also sets `box-sizing: border-box`.

## Props and slots

6. Props use the `@` prefix at every call site (`@title="…"`, `:@title="expr"`).
7. Slots first. Content goes in slots, not attributes: always for layouts, landmarks,
   and containers. The caller writes headings, text, links, and lists, so the caller
   picks heading levels. Props are for settings (`@variant`, `@label`) and data the
   component must compute from. A list component takes `<li>` children. WebC cannot
   test a slot for content, so hide an empty wrapper with `:not(:has(*))`.
8. Generic components take props and slots only, never `$data` (except `$data.page`).
   Guard helper-shadowed props with `typeof url === 'string'` (internals §2).

## Documentation

9. No HTML comments in components: they ship to every page (internals §9). Document
   props, slots, and custom properties in JSDoc inside `<script webc:setup>`. Document
   an unnamed slot as `@slot - …`.
10. Every `.js` file and `webc:setup` block starts with an SPDX license block comment.
11. Every component names a JSDoc `@category`: `layout`, `landmark`, `container`,
    `component`, `template`, or `document`.
12. Every non-head component has at least one preview story. The preview reads props,
    slots, and custom properties from the JSDoc, so the JSDoc stays accurate.

A setup block in this style:

```html
<script webc:setup>
/*
 * SPDX-License-Identifier: MPL-2.0
 */

/**
 * Short facts in a row, such as a license or a runtime.
 * @slot - The facts, as `<li>` elements.
 * @cssprop --tag-list-gap - Space between facts. Falls back to --allonsy-space-m.
 * @category component
 */
</script>
```

## Behaviour

13. Behaviour is a custom element registered under the component's own tag, guarded by
    `customElements.get`. Server-rendered markup is the whole component without the
    script. Setup is idempotent (`connectedCallback` runs again on a move), waits for
    `DOMContentLoaded` while the document is parsing, and is undone in
    `disconnectedCallback`. The script is wrapped in a block (internals §7):

    ```js
    {
    	class CopyButton extends HTMLElement {
    		#wired = false;
    		#timer;

    		/** Wires listeners once; runs again on a move. */
    		connectedCallback() {
    			if (this.#wired) return;
    			this.#wired = true;
    			this.querySelector("button")?.addEventListener("click", () => this.#copy());
    		}

    		/** Undoes setup. */
    		disconnectedCallback() {
    			clearTimeout(this.#timer);
    		}

    		/** Copies the value and announces the result. */
    		async #copy() {}
    	}
    	if (!customElements.get("copy-button")) customElements.define("copy-button", CopyButton);
    }
    ```

## Head components

14. Head components are called as `<meta webc:is="name" webc:nokeep />` and have no
    slots (internals §9).

## Accessibility and quality

15. WCAG 2.2 AA in light, dark, and forced colors. Colors use `light-dark()`.
16. Spec links point to the section anchor, never a spec's home page.
