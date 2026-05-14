# Component API Design

The API is the contract between a component and its consumers. A good API
is small enough to learn quickly, complete enough to handle real use cases,
and stable enough that upgrades don't break things.

This reference covers the four surfaces of a component's API: attributes
and properties, content slots, events, and design tokens (CSS custom
properties).

---

## Table of contents

1. [Native-First Philosophy](#native-first-philosophy)
2. [Global Attribute Collision Checklist](#global-attribute-collision-checklist)
3. [Attributes & Properties](#attributes--properties)
4. [Content Slots](#content-slots)
5. [Events](#events)
6. [CSS Custom Properties & Design Tokens](#css-custom-properties--design-tokens)
7. [API Design Principles](#api-design-principles)
8. [Documenting an API](#documenting-an-api)

---

## Native-First Philosophy

> The general principle ("lean on the browser") lives in
> [`guiding-principles.md`](./guiding-principles.md). This section
> translates it into concrete API-design tables and decisions.

### Native element substitutions

| Instead of this                         | Use this                               |
| --------------------------------------- | -------------------------------------- |
| `<div role="button" tabindex="0">`      | `<button>`                             |
| `<div role="checkbox">`                 | `<input type="checkbox">`              |
| `<div class="ds-disclosure">`           | `<details><summary>`                   |
| `<div role="dialog" class="ds-modal">`  | `<dialog>`                             |
| `<div role="link">`                     | `<a href="...">`                       |
| `<div contenteditable>`                 | `<textarea>` or `<input>`              |
| Custom toggle component                 | `<input type="checkbox">` styled as switch, or `role="switch"` on a `<button>` |

### Lean on native attributes when they exist

If a native HTML attribute already does what your component needs, use it
directly — don't create a prefixed copy:

```html
<!-- Good: uses native `disabled`, `required`, `name` attributes -->
<ds-input disabled required name="email"></ds-input>

<!-- Bad: invents custom names for native concepts -->
<ds-input is-disabled is-required field-name="email"></ds-input>
```

The native `disabled` attribute is understood by browsers (they remove it
from tab order, grey it out, exclude it from form submission), by CSS
(`:disabled` pseudo-class), and by screen readers. A custom `is-disabled`
attribute gets none of that for free.

### When to go custom

Build custom behavior only when native HTML genuinely can't do the job:
- Combobox (no native equivalent for a filterable dropdown)
- Tabs (no native `<tablist>` element yet)
- Accordion (native `<details>` doesn't support exclusive open or animation
  easily — but consider whether `<details>` is "good enough" first)
- Rich data table (sorting, filtering, virtual scrolling beyond `<table>`)

Even in these cases, compose from native primitives: a combobox uses a
native `<input>` and manages a `<ul>` of options via ARIA.

---

## Global Attribute Collision Checklist

Custom component attributes must never collide with HTML global attributes.
If you name an attribute the same as a global attribute, the browser will
try to interpret it natively, causing subtle bugs or silent failures.

### Attributes to never use as custom attribute names

These are HTML global attributes. Do not repurpose them:

`accesskey`, `autocapitalize`, `autofocus`, `class`, `contenteditable`,
`dir`, `draggable`, `enterkeyhint`, `hidden`, `id`, `inert`, `inputmode`,
`is`, `itemid`, `itemprop`, `itemref`, `itemscope`, `itemtype`, `lang`,
`nonce`, `part`, `popover`, `role`, `slot`, `spellcheck`, `style`,
`tabindex`, `title`, `translate`, `writingsuggestions`

Also avoid collisions with common element-specific attributes that your
component might inherit if it extends a native element: `type`, `name`,
`value`, `checked`, `selected`, `href`, `src`, `action`, `method`,
`for`, `form`, `readonly`, `placeholder`, `required`, `disabled`, `open`,
`width`, `height`, `alt`.

### Safe alternatives for commonly colliding names

| You want to express    | Don't use  | Use instead            | Why                                     |
| ---------------------- | ---------- | ---------------------- | --------------------------------------- |
| Visual variation       | `style`    | `variant`              | `style` is the inline CSS attribute     |
| Component category     | `type`     | `variant` or `severity`| `type` has native meaning on `<button>`, `<input>` |
| Display label          | `title`    | `label` or `heading`   | `title` is a global attr (tooltip text) |
| Collapsed/expanded     | `open`     | OK on custom elements  | `open` is native on `<details>`/`<dialog>` but fine on custom elements that don't extend them |
| Visibility control     | `hidden`   | `collapsed` or use native `hidden` | `hidden` is a global attribute with native behavior — use it if you want that behavior, don't override it |
| Tab navigation control | `tabindex` | (use native `tabindex`)| Never override — use it as-is           |

### The test

Before finalizing any attribute name, check:
1. Is it a [global HTML attribute](https://html.spec.whatwg.org/multipage/dom.html#global-attributes)?
2. Is it a native attribute on any element your component might compose?
3. Does the browser already do something with this attribute name?

If yes to any: use it natively (if the native behavior is what you want)
or pick a different name (if you need different behavior).

---

## Attributes & Properties

### The basics

Attributes are the public knobs on a component. They control behavior,
appearance, and state.

```html
<!-- Attributes in vanilla HTML -->
<ds-button variant="primary" disabled>Save</ds-button>

<!-- Equivalent in a Web Component's JS API -->
const btn = document.querySelector('ds-button');
btn.variant = 'primary';
btn.disabled = true;
```

### Categories of attributes

Organize your attributes into these buckets — it makes the API easier to
learn and document:

**Configuration** — set once, rarely changed:
- `variant` (primary, secondary, ghost)
- `size` (sm, md, lg)
- `orientation` (horizontal, vertical)

**State** — changes during interaction:
- `disabled`, `readonly`, `required`
- `open`, `expanded`, `selected`
- `loading`, `error`

**Data** — connects the component to content:
- `value`, `label`, `placeholder`
- `src`, `href`, `name`

**ARIA bridging** — maps to ARIA attributes:
- `label` → `aria-label`
- `describedby` → `aria-describedby`

### Attribute design rules

**Boolean attributes follow HTML convention.** Present = true, absent = false.
Don't use `disabled="false"` — remove the attribute entirely. In HTML, the
presence of a boolean attribute is what matters, not its value.

```html
<!-- Correct -->
<ds-button disabled>Can't click</ds-button>
<ds-button>Can click</ds-button>

<!-- Wrong: disabled="false" still evaluates as disabled in HTML -->
<ds-button disabled="false">Surprise, still disabled</ds-button>
```

**Enumerated attributes use lowercase string values.** Keep the set small
and document every valid value.

```html
<ds-alert severity="info">    <!-- info | success | warning | error -->
<ds-button variant="primary">  <!-- primary | secondary | ghost | destructive -->
```

**Reflect properties to attributes when it matters.** If CSS or selectors
need to respond to a property change, reflect it. State attributes like
`open`, `disabled`, `expanded` should always reflect — they're used in CSS
selectors.

```css
/* CSS can target reflected attributes */
ds-accordion-item[open] .content { display: block; }
ds-button[disabled] { opacity: 0.5; cursor: not-allowed; }
```

**Use sensible defaults.** A component should be useful with zero
configuration:

```html
<!-- This should render a working, styled button -->
<ds-button>Click me</ds-button>

<!-- Not this: requiring variant, size, and type just to render -->
<ds-button variant="primary" size="md" type="button">Click me</ds-button>
```

### Vanilla HTML example

```html
<div class="ds-alert" role="alert" data-severity="error">
  <svg class="ds-alert__icon" aria-hidden="true"><!-- icon --></svg>
  <div class="ds-alert__content">
    <p class="ds-alert__title">Payment failed</p>
    <p class="ds-alert__description">Your card was declined.</p>
  </div>
  <button class="ds-alert__dismiss" aria-label="Dismiss alert">
    <svg aria-hidden="true"><!-- close icon --></svg>
  </button>
</div>
```

### Web Component example

```javascript
class DsAlert extends HTMLElement {
  static observedAttributes = ['severity', 'dismissible', 'open'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  get severity() { return this.getAttribute('severity') ?? 'info'; }
  set severity(val) { this.setAttribute('severity', val); }

  get dismissible() { return this.hasAttribute('dismissible'); }
  set dismissible(val) {
    val ? this.setAttribute('dismissible', '') : this.removeAttribute('dismissible');
  }

  get open() { return this.hasAttribute('open'); }
  set open(val) {
    val ? this.setAttribute('open', '') : this.removeAttribute('open');
  }

  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        :host(:not([open])) { display: none; }
        /* Token-driven styling */
        .alert {
          padding: var(--ds-alert-padding, var(--ds-spacing-md, 1rem));
          border-radius: var(--ds-alert-radius, var(--ds-radius-md, 0.5rem));
          border-left: 4px solid var(--ds-alert-accent-color);
          background: var(--ds-alert-bg);
        }
        :host([severity="error"]) {
          --ds-alert-accent-color: var(--ds-color-error-500, #dc2626);
          --ds-alert-bg: var(--ds-color-error-50, #fef2f2);
        }
        :host([severity="info"]) {
          --ds-alert-accent-color: var(--ds-color-info-500, #2563eb);
          --ds-alert-bg: var(--ds-color-info-50, #eff6ff);
        }
      </style>
      <div class="alert" role="alert">
        <slot name="icon"></slot>
        <div class="content">
          <slot></slot>
        </div>
        ${this.dismissible ? `
          <button class="dismiss" aria-label="Dismiss alert"
                  @click="${() => this.dismiss()}">×</button>
        ` : ''}
      </div>
    `;
  }

  dismiss() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('ds-dismiss', { bubbles: true }));
  }
}
customElements.define('ds-alert', DsAlert);
```

---

## Content Slots

Slots define where consumer-provided content goes. They're the component's
content model.

### Slot types

**Default slot** — the primary content area:
```html
<ds-card>
  <p>This goes in the default slot.</p>
</ds-card>
```

**Named slots** — specific content areas:
```html
<ds-card>
  <img slot="media" src="photo.jpg" alt="Description">
  <h3 slot="heading">Card Title</h3>
  <p>Default slot content.</p>
  <div slot="actions">
    <ds-button>Save</ds-button>
    <ds-button variant="ghost">Cancel</ds-button>
  </div>
</ds-card>
```

### Slot design rules

**Name slots after what they contain, not where they appear.**
Good: `heading`, `actions`, `media`, `icon`, `description`.
Bad: `top`, `bottom-right`, `area-2`.

**Keep the default slot for primary content.** Named slots for everything
else.

**Document whether a slot is required or optional.** Headings and labels
are often required for accessibility — if slot="heading" is empty and
there's no label attribute fallback, the component is incomplete.

**Provide fallback content** for optional slots:
```html
<!-- Inside the shadow DOM template -->
<slot name="icon">
  <svg class="default-icon"><!-- default icon --></svg>
</slot>
```

### Vanilla HTML equivalent

In vanilla HTML, "slots" are represented by well-known class names or child
element conventions:

```html
<div class="ds-card">
  <div class="ds-card__media">
    <img src="photo.jpg" alt="Description">
  </div>
  <div class="ds-card__body">
    <h3 class="ds-card__heading">Card Title</h3>
    <p class="ds-card__description">Description text.</p>
  </div>
  <div class="ds-card__actions">
    <button class="ds-button">Save</button>
  </div>
</div>
```

---

## Events

Events are how components communicate outward — telling consumers that
something happened.

### Event design rules

**Prefix custom events with your namespace:**
```javascript
// Namespaced — no collision risk
this.dispatchEvent(new CustomEvent('ds-change', { ... }));
this.dispatchEvent(new CustomEvent('ds-dismiss', { ... }));

// Not namespaced — could collide with native events or other libraries
this.dispatchEvent(new CustomEvent('change', { ... }));
```

**Use `detail` for event data:**
```javascript
this.dispatchEvent(new CustomEvent('ds-select', {
  bubbles: true,
  composed: true,  // crosses shadow DOM boundary
  detail: {
    value: this.value,
    label: this.selectedLabel
  }
}));
```

**Standard event vocabulary:**
| Event suffix | Meaning                        | Example          |
| ------------ | ------------------------------ | ---------------- |
| `-change`    | Value changed                  | `ds-change`      |
| `-input`     | Value being actively modified  | `ds-input`       |
| `-open`      | Component opened/expanded      | `ds-open`        |
| `-close`     | Component closed/collapsed     | `ds-close`       |
| `-dismiss`   | User dismissed the element     | `ds-dismiss`     |
| `-select`    | Item selected                  | `ds-select`      |
| `-submit`    | Form/action submitted          | `ds-submit`      |
| `-error`     | Operation failed               | `ds-error`       |
| `-load`      | Content finished loading       | `ds-load`        |

**Fire events after state changes, not before.** When a consumer receives
`ds-open`, the component should already be open. If you need a cancelable
"before" event, use a separate event: `ds-before-open` (cancelable) then
`ds-open` (informational).

**Ensure `bubbles: true` and `composed: true`** for events that consumers
need to hear from ancestor elements. `composed` is critical for Web
Components — without it, the event stops at the shadow DOM boundary.

---

## CSS Custom Properties & Design Tokens

CSS custom properties are the styling API of a component. They let consumers
customize appearance without overriding internal selectors.

### Token hierarchy

Design systems typically use a three-tier token structure:

```
Global tokens       →  Alias tokens         →  Component tokens
--ds-blue-500          --ds-color-primary       --ds-button-bg
--ds-space-4           --ds-spacing-md          --ds-button-padding
--ds-font-sans         --ds-font-body           --ds-button-font
```

**Global tokens** are raw values (colors, sizes, fonts). Named for what
they are.

**Alias tokens** (semantic tokens) map global values to purposes. Named for
what they mean.

**Component tokens** scope alias tokens to a specific component. Named for
where they're used.

### Component token naming convention

```
--{prefix}-{component}-{element}-{property}-{variant}-{state}
```

Only include segments that are needed:
```css
--ds-button-bg                         /* component + property */
--ds-button-bg-hover                   /* + state */
--ds-button-icon-color                 /* + element + property */
--ds-button-bg-primary                 /* + variant */
--ds-button-bg-primary-hover           /* + variant + state */
```

### Exposing tokens on a component

```css
/* Inside the component */
:host {
  /* Component tokens with alias fallbacks */
  --_bg: var(--ds-button-bg, var(--ds-color-primary, #2563eb));
  --_color: var(--ds-button-color, var(--ds-color-on-primary, #fff));
  --_padding-x: var(--ds-button-padding-x, var(--ds-spacing-md, 1rem));
  --_padding-y: var(--ds-button-padding-y, var(--ds-spacing-sm, 0.5rem));
  --_radius: var(--ds-button-radius, var(--ds-radius-md, 0.375rem));
  --_font-size: var(--ds-button-font-size, var(--ds-font-size-sm, 0.875rem));

  /* Apply them */
  background: var(--_bg);
  color: var(--_color);
  padding: var(--_padding-y) var(--_padding-x);
  border-radius: var(--_radius);
  font-size: var(--_font-size);
}

:host(:hover) {
  --_bg: var(--ds-button-bg-hover, var(--ds-color-primary-600, #1d4ed8));
}

:host([disabled]) {
  --_bg: var(--ds-button-bg-disabled, var(--ds-color-neutral-200, #e5e7eb));
  --_color: var(--ds-button-color-disabled, var(--ds-color-neutral-500, #6b7280));
}
```

### Vanilla CSS equivalent

```css
.ds-button {
  background: var(--ds-button-bg, var(--ds-color-primary, #2563eb));
  color: var(--ds-button-color, var(--ds-color-on-primary, #fff));
  padding: var(--ds-button-padding-y, 0.5rem) var(--ds-button-padding-x, 1rem);
  border-radius: var(--ds-button-radius, var(--ds-radius-md, 0.375rem));
  font-size: var(--ds-button-font-size, 0.875rem);
  font-family: var(--ds-button-font, var(--ds-font-body, system-ui));
  border: var(--ds-button-border-width, 1px) solid var(--ds-button-border-color, transparent);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.ds-button:hover {
  background: var(--ds-button-bg-hover, var(--ds-color-primary-600, #1d4ed8));
}

.ds-button:focus-visible {
  outline: var(--ds-focus-ring-width, 2px) solid var(--ds-focus-ring-color, #2563eb);
  outline-offset: var(--ds-focus-ring-offset, 2px);
}

.ds-button[disabled] {
  background: var(--ds-button-bg-disabled, #e5e7eb);
  color: var(--ds-button-color-disabled, #6b7280);
  cursor: not-allowed;
}
```

### What to expose, what to keep private

**Expose:** colors, spacing, border-radius, font properties, focus ring
styles — anything a theme would reasonably want to change.

**Keep private:** internal layout mechanics (flexbox/grid details), animation
keyframes (expose duration/easing but not the keyframes themselves),
z-index stacking (manage internally, expose a layer token if needed).

**Use private custom properties** (prefixed with `_`) for internal wiring
that shouldn't be part of the public API:
```css
:host {
  --_internal-gap: calc(var(--ds-button-padding-x) * 0.5);
}
```

---

## API Design Principles

### Progressive disclosure
The zero-config case should work. Extra attributes add power:
```html
<!-- Works with no attributes -->
<ds-dialog>Content here</ds-dialog>

<!-- Full-featured -->
<ds-dialog
  open
  modal
  close-on-escape
  close-on-backdrop
  aria-label="Confirm deletion"
>
  <h2 slot="heading">Are you sure?</h2>
  <p>This action cannot be undone.</p>
  <div slot="actions">
    <ds-button variant="destructive">Delete</ds-button>
    <ds-button variant="ghost">Cancel</ds-button>
  </div>
</ds-dialog>
```

### Consistency across the system
If `Alert` uses `severity` for its status level, `Badge` should too — not
`type` or `level` or `status`. Build a vocabulary table for your system:

| Concept          | Attribute name | Values                              |
| ---------------- | -------------- | ----------------------------------- |
| Visual weight    | `variant`      | primary, secondary, ghost           |
| Status/severity  | `severity`     | info, success, warning, error       |
| Size             | `size`         | sm, md, lg                          |
| Disabled state   | `disabled`     | (boolean)                           |
| Loading state    | `loading`      | (boolean)                           |
| Open/expanded    | `open`         | (boolean)                           |
| Orientation      | `orientation`  | horizontal, vertical                |

### Form participation
Components used in forms should participate in form submission via the
`ElementInternals` API:

```javascript
class DsSelect extends HTMLElement {
  static formAssociated = true;

  constructor() {
    super();
    this.internals = this.attachInternals();
  }

  set value(val) {
    this._value = val;
    this.internals.setFormValue(val);
  }

  get value() { return this._value; }
}
```

---

## Documenting an API

Every component's API documentation should include:

```markdown
## ds-button

A button for triggering actions.

### Attributes

| Attribute    | Type    | Default     | Description              |
| ------------ | ------- | ----------- | ------------------------ |
| `variant`    | string  | `"primary"` | Visual style             |
| `size`       | string  | `"md"`      | Size: sm, md, lg         |
| `disabled`   | boolean | `false`     | Disables interaction     |
| `loading`    | boolean | `false`     | Shows loading spinner    |
| `type`       | string  | `"button"`  | submit, reset, or button |

### Slots

| Slot      | Description                         |
| --------- | ----------------------------------- |
| (default) | Button label text                   |
| `prefix`  | Content before the label (e.g. icon)|
| `suffix`  | Content after the label (e.g. icon) |

### Events

| Event       | Detail        | Description              |
| ----------- | ------------- | ------------------------ |
| `ds-click`  | `{}`          | Fired on activation      |

### CSS Custom Properties

| Property              | Default                  | Description       |
| --------------------- | ------------------------ | ----------------- |
| `--ds-button-bg`      | `var(--ds-color-primary)`| Background color  |
| `--ds-button-color`   | `var(--ds-color-on-primary)` | Text color   |
| `--ds-button-radius`  | `var(--ds-radius-md)`    | Border radius     |
```
