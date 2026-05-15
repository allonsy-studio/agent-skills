# Iconography in Design Systems

Icons are content, not components. They appear inside buttons, links,
alerts, navigation items, badges, and list items — they don't exist as
standalone patterns with their own ARIA role or keyboard contract. What
you're building is a rendering mechanism (a way to resolve an icon name to
SVG markup) and a set of guidelines for how icons behave as content within
other components.

That said, icons are deceptively complex. They touch accessibility,
performance, theming, internationalization, and developer ergonomics all
at once. You're shipping an icon system to teams you can't supervise — it
needs to be hard to misuse.

---

## Table of contents

1. [Icon format decisions](#icon-format-decisions)
2. [Icon API design](#icon-api-design)
3. [Sizing and optical alignment](#sizing-and-optical-alignment)
4. [Color and theming](#color-and-theming)
5. [Accessibility](#accessibility)
6. [Icon naming](#icon-naming)
7. [Icon contribution and governance](#icon-contribution-and-governance)
8. [Performance](#performance)
9. [Internationalization](#internationalization)

---

## Icon format decisions

### SVG: the only serious option for design systems

Icon fonts (Font Awesome-style) are legacy technology. They fail in high
contrast mode, can't be partially colored, are blurry at non-integer sizes,
and produce unexpected behavior when fonts fail to load (invisible
rectangles, garbled characters). Ship SVG.

### Inline SVG vs. external reference

**Inline SVG** — the SVG markup lives directly in the HTML:
```html
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
</svg>
```
- Pros: styleable via CSS (`fill`, `stroke`, custom properties), no extra
  network request, works in Shadow DOM
- Cons: increases HTML size, can't be cached independently

**External SVG sprite** — icons defined once, referenced by `<use>`:
```html
<svg class="ds-icon" aria-hidden="true">
  <use href="/icons/sprite.svg#search"></use>
</svg>
```
- Pros: cacheable, smaller HTML per instance
- Cons: cross-origin restrictions, `<use>` doesn't pierce Shadow DOM
  boundaries, limited CSS customization

**Recommended for Web Components:** inline SVG, delivered via a component
that injects the SVG at render time. This avoids Shadow DOM issues and
keeps icons styleable.

**Recommended for vanilla HTML systems:** external sprite for commonly used
icons (reduces HTML size), inline SVG for one-off or complex icons.

---

## Icon API design

### As a Web Component

```javascript
class DsIcon extends HTMLElement {
  static observedAttributes = ['name', 'size', 'label'];

  get name() { return this.getAttribute('name'); }
  set name(val) { this.setAttribute('name', val); }

  get size() { return this.getAttribute('size') ?? 'md'; }
  set size(val) { this.setAttribute('size', val); }

  get label() { return this.getAttribute('label'); }
  set label(val) {
    if (val) {
      this.setAttribute('label', val);
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', val);
    } else {
      this.removeAttribute('label');
      this.removeAttribute('role');
      this.setAttribute('aria-hidden', 'true');
    }
  }

  connectedCallback() {
    if (!this.label) {
      this.setAttribute('aria-hidden', 'true');
    }
    this.render();
  }

  attributeChangedCallback() { this.render(); }

  async render() {
    const svg = await this.loadIcon(this.name);
    this.innerHTML = svg ?? '';
  }

  async loadIcon(name) {
    // Implementation depends on bundling strategy:
    // - Dynamic import from a generated icon module
    // - Fetch from a CDN/sprite
    // - Lookup in a pre-registered icon map
  }
}
customElements.define('ds-icon', DsIcon);
```

Usage:
```html
<!-- Decorative icon (next to text label) — icon is content inside the button -->
<ds-button>
  <ds-icon name="save" slot="prefix"></ds-icon>
  Save document
</ds-button>

<!-- Icon-only button — still a <ds-button>, not a separate component -->
<ds-button aria-label="Close dialog">
  <ds-icon name="close"></ds-icon>
</ds-button>

<!-- Icon inside a link -->
<a href="/settings">
  <ds-icon name="gear"></ds-icon>
  Settings
</a>
```

### As vanilla HTML

```html
<!-- Decorative icon (next to text label) — icon is content -->
<button class="ds-button">
  <svg class="ds-icon ds-icon--md" aria-hidden="true" viewBox="0 0 24 24">
    <path d="..."/>
  </svg>
  Save document
</button>

<!-- Icon-only button — same component, just different content -->
<button class="ds-button" aria-label="Close dialog">
  <svg class="ds-icon ds-icon--md" aria-hidden="true" viewBox="0 0 24 24">
    <path d="..."/>
  </svg>
</button>
```

The key pattern for icon-only buttons: the accessible label goes on the
**button**, not the icon. The icon is always `aria-hidden="true"` when
inside an interactive element, because the parent carries the accessible
name. There is no separate "icon button" component — an icon-only button
is just a button whose content happens to be an icon.

---

## Sizing and optical alignment

### Size tokens

Icons in a system typically need 4–5 sizes:

```css
--ds-icon-size-xs: 12px;  /* inline with small text, metadata */
--ds-icon-size-sm: 16px;  /* inline with body text */
--ds-icon-size-md: 20px;  /* default, buttons and nav */
--ds-icon-size-lg: 24px;  /* prominent standalone use */
--ds-icon-size-xl: 32px;  /* hero/empty state */
```

Apply via the component:
```css
.ds-icon {
  width: var(--ds-icon-size, var(--ds-icon-size-md));
  height: var(--ds-icon-size, var(--ds-icon-size-md));
  flex-shrink: 0; /* Prevent icons from collapsing in flex layouts */
}

.ds-icon--sm { --ds-icon-size: var(--ds-icon-size-sm); }
.ds-icon--md { --ds-icon-size: var(--ds-icon-size-md); }
.ds-icon--lg { --ds-icon-size: var(--ds-icon-size-lg); }
```

### Optical alignment

Icons rarely look centered even when they're mathematically centered.
Common alignment issues:

**Icons next to text:** align the icon to the text's x-height or cap
height, not the line box. This usually means a slight negative margin or
a carefully chosen vertical-align:

```css
.ds-icon--inline {
  vertical-align: -0.125em; /* nudge down to align with text baseline */
}
```

**Icons in buttons:** use flexbox with `align-items: center` and let
`gap` handle spacing:

```css
.ds-button {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-spacing-xs, 0.25rem);
}
```

**Asymmetric icons** (like a play triangle) may need visual-center
adjustments. For these, add an `--optical-offset` custom property to the
specific icon's metadata and apply it:

```css
.ds-icon[data-optical-offset] {
  transform: translateX(var(--ds-icon-optical-offset, 0));
}
```

### ViewBox consistency

All icons in the system should share the same `viewBox`. If you're using
a 24×24 grid, every icon is `viewBox="0 0 24 24"`, regardless of how much
of that space it uses. This ensures sizing is consistent — a "thin" icon
and a "heavy" icon are the same dimensions, they just have different
amounts of whitespace.

---

## Color and theming

### Current color as default

Icons should inherit color from their context by default:

```css
.ds-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: var(--ds-icon-stroke-width, 1.5);
}
```

Using `currentColor` means an icon inside a primary button automatically
gets the button's text color. An icon inside a red error message gets red.
No extra classes needed.

### When icons need their own color

Severity indicators, status icons, or brand marks may need specific colors:

```css
.ds-icon--success { color: var(--ds-color-success-500); }
.ds-icon--error { color: var(--ds-color-error-500); }
.ds-icon--warning { color: var(--ds-color-warning-500); }
```

But color alone doesn't convey meaning (WCAG 1.4.1). These icons must be
paired with text labels or shapes that are distinguishable without color.

### Multi-color icons

Some icons need more than one color (a logo, a file-type indicator).
For these, use specific CSS custom properties per region rather than
`currentColor`:

```css
.ds-icon--file-pdf {
  --ds-icon-primary: var(--ds-color-error-500);
  --ds-icon-secondary: var(--ds-color-neutral-200);
}
```

### Forced colors / high contrast mode

In Windows High Contrast Mode, `currentColor` maps to the system's text
color — icons using it will be visible automatically. But icons using
specific `fill` or `stroke` colors may disappear:

```css
@media (forced-colors: active) {
  .ds-icon {
    /* Ensure icons remain visible */
    forced-color-adjust: auto;
  }

  /* If forced-color-adjust: auto doesn't fix it */
  .ds-icon--status {
    stroke: CanvasText;
  }
}
```

---

## Accessibility

### The two-bucket rule

Every icon falls into exactly one bucket:

**Decorative** — accompanies a visible text label. The icon is redundant;
removing it doesn't change the meaning. Mark it `aria-hidden="true"`.

```html
<a href="/settings">
  <svg aria-hidden="true"><!-- gear icon --></svg>
  Settings
</a>
```

**Meaningful** — conveys information that isn't available as text elsewhere.
Needs an accessible name.

```html
<!-- Option 1: aria-label on parent interactive element -->
<button aria-label="Close">
  <svg aria-hidden="true"><!-- X icon --></svg>
</button>

<!-- Option 2: visually hidden text -->
<button>
  <svg aria-hidden="true"><!-- X icon --></svg>
  <span class="visually-hidden">Close</span>
</button>

<!-- Option 3: SVG title (less reliable across screen readers) -->
<svg role="img" aria-labelledby="icon-title-1">
  <title id="icon-title-1">Close</title>
  <path d="..."/>
</svg>
```

Option 1 or 2 are most reliable. Option 3 has inconsistent screen reader
support.

### Icon-only interactive elements: the biggest a11y risk in icon systems

A button or link containing only an icon and no accessible name is a blank
void to screen reader users. Since icons are content inside buttons and
links (not separate components), the responsibility for accessible naming
falls on the parent element.

Your button component should warn when it detects icon-only content without
a label:

```javascript
// Inside DsButton's connectedCallback or slotchange handler
checkAccessibleName() {
  const hasVisibleText = this.textContent.trim().length > 0;
  const hasAriaLabel = this.hasAttribute('aria-label');
  const hasAriaLabelledby = this.hasAttribute('aria-labelledby');
  const hasHiddenText = this.querySelector('.visually-hidden');

  if (!hasVisibleText && !hasAriaLabel && !hasAriaLabelledby && !hasHiddenText) {
    console.warn(
      `<ds-button> contains no visible text and no accessible label. ` +
      `Add aria-label, aria-labelledby, or visually-hidden text.`
    );
  }
}
```

### Animated icons

If an icon animates (spinner, pulsing notification dot), it needs:
- A way to pause/stop if it runs for more than 5 seconds (WCAG 2.2.2)
- `prefers-reduced-motion` respect (stop or simplify the animation)
- If the animation conveys status (loading), a live region or `role="status"` with descriptive text

---

## Icon naming

### Conventions

Name icons for what they **depict**, not what they're **used for**:
- Good: `chevron-right`, `magnifying-glass`, `trash-can`, `envelope`
- Bad: `next`, `search`, `delete`, `email`

Why: the same icon (`chevron-right`) might be used for "next page",
"expand", or "external link" in different contexts. Naming it for one use
case creates confusion when another team reuses it.

Exceptions: truly universal metaphors where the icon IS the action — `play`,
`pause`, `stop` — can be named for function.

### Naming structure

```text
{object}[-{modifier}][-{variant}]

Examples:
arrow-left
arrow-left-circle       (modifier: inside a circle)
chevron-down
file-text
file-text-filled        (variant: filled vs. outline)
user
user-plus               (modifier: with plus sign)
```

### Consistency checklist

- Directional icons: use consistent suffixes (`-up`, `-down`, `-left`,
  `-right`), not mixed (`-top`, `-bottom`, `-prev`, `-next`)
- Filled/outline: pick one style as default, use `-filled` or `-outline`
  suffix for the alternate
- Compound names: use hyphens (`arrow-up-right`), not camelCase
  (`arrowUpRight`) for the canonical name. Let the component framework
  adapt casing as needed.

---

## Icon contribution and governance

### For large organizations

You can't review every icon request personally. Publish contribution
guidelines:

1. **Grid and keylines:** new icons must use the same grid (e.g., 24×24
   with 2px padding, drawn on a 20×20 live area)
2. **Stroke weight:** must match the system default (e.g., 1.5px)
3. **Corner radius:** must match the system default (e.g., 1px on corners)
4. **Optical size:** small details that work at 24px may vanish at 16px.
   If the system ships multiple optical sizes, each needs a variant.
5. **Naming:** follow the naming convention above; don't duplicate existing
   icons under new names
6. **Review checklist:** passes a11y audit, works in forced-colors mode,
   looks correct at all shipped sizes

### Icon deprecation

When an icon is renamed or removed, keep the old name as an alias for at
least two major versions with a console warning:

```javascript
const DEPRECATED_ICONS = {
  'gear': { replacement: 'settings', since: '3.0.0' },
  'trash': { replacement: 'trash-can', since: '3.0.0' },
};
```

---

## Performance

### Sprite vs. individual files

| Strategy         | Good for                               | Watch out for               |
| ---------------- | -------------------------------------- | --------------------------- |
| Single sprite    | Sites using 20+ icons, HTTP/1.1        | Large initial payload       |
| Individual files | Sites using <10 icons, HTTP/2+         | Many requests on HTTP/1.1   |
| Inline in JS     | Web Component-based systems, bundlers  | Bundle size, tree-shaking   |

For large systems, ship an icon package where each icon is a separate ES
module. Bundlers tree-shake unused icons automatically:

```javascript
// Consumer imports only what they use
import { IconSearch, IconClose } from '@ds/icons';
```

### SVG optimization

Run all icons through SVGO or equivalent before shipping:
- Remove editor metadata, comments, empty groups
- Collapse unnecessary transforms
- Round coordinates to 2 decimal places
- Remove `fill` attributes that should inherit `currentColor`

---

## Internationalization

### Mirroring for RTL

Some icons must flip horizontally in right-to-left layouts:

**Must mirror:** directional icons that imply reading direction — forward
arrows, back arrows, reply, undo/redo, text alignment icons, list bullets,
progress indicators.

**Must NOT mirror:** non-directional icons — search (magnifying glass
handle can stay), clock (clockwise is universal), media controls (play
triangle is universal), checkmark, physical objects.

Implementation:
```css
/* Applied to the icon container, not the SVG */
[dir="rtl"] .ds-icon--mirror,
:dir(rtl) .ds-icon--mirror {
  transform: scaleX(-1);
}
```

Tag mirrorable icons in your icon metadata:
```json
{
  "name": "arrow-right",
  "mirror_in_rtl": true,
  "category": "navigation"
}
```

### Cultural sensitivity

Some icons carry cultural meaning that varies by region:
- **Mailbox** (US-style flag mailbox) is unrecognizable outside North
  America — use an envelope instead
- **Thumbs up** can be offensive in parts of the Middle East
- **Religious symbols** (cross, star, crescent) should never be used as
  generic markers

For a global organization, default to abstract/universal metaphors and
document any culturally loaded icons so consuming teams can substitute
region-appropriate alternatives.
