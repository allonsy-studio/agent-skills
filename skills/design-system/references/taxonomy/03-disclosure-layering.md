# Disclosure & Layering

### Accordion
**What it is:** Vertically stacked sections that expand/collapse to show content.
**Variants:** Single-expand (only one open at a time), multi-expand, nested.
**Native foundation:** Each section is a disclosure widget — the native `<details>`/`<summary>` element pair does this out of the box with zero JavaScript. Use `<details>` as the starting point; layer ARIA and JS only when you need coordinated behavior (single-expand) or animation that `<details>` can't provide. Building an accordion from `<div>`s and click handlers when `<details>` exists is unnecessary work and a common source of accessibility bugs.
**ARIA pattern:** Heading + button controlling a region. No `role="accordion"` exists — it's a pattern composed of disclosure widgets. When using `<details>`/`<summary>`, the browser provides the expand/collapse semantics automatically — you still want a heading element wrapping `<summary>` for document outline, but you don't need `aria-expanded` or `aria-controls` (the browser handles those).
**Common mistakes:**
```html
<!-- ❌ Building from <div>s with onclick — no keyboard, no semantics -->
<div class="header" onclick="toggle(this)">Section</div>
<div class="panel" style="display:none">…</div>
<!-- ✅ Use native <details>/<summary> — keyboard + AT for free -->
<details>
  <summary><h3>Section</h3></summary>
  <div class="panel">…</div>
</details>

<!-- ❌ Inline style toggling for state -->
<div style="display: none">…</div>
<!-- ✅ CSS class or hidden attribute -->
<div class="panel" hidden>…</div>

<!-- ❌ Hard-coded colors instead of tokens -->
<div style="background: #f3f4f6; padding: 12px 16px">…</div>
<!-- ✅ Design tokens + logical properties -->
<div style="background: var(--ds-color-surface-secondary); padding-block: var(--ds-spacing-sm); padding-inline: var(--ds-spacing-md)">…</div>
```

### Modal / Dialog
**What it is:** A window overlaying the page that demands user attention. Blocks interaction with content behind it.
**Variants:** Alert dialog (requires confirmation), form dialog, fullscreen.
**Not to be confused with:** Drawer (slides from edge, may not be modal). Popover (does not trap focus).
**ARIA pattern:** `dialog` with `aria-modal="true"`. Focus trap required.
**Common mistakes:**
```html
<!-- ❌ Custom div overlay — no focus trap, no AT announcement -->
<div class="modal-overlay"><div class="modal">…</div></div>
<!-- ✅ Native <dialog> — focus trap + Escape + ::backdrop for free -->
<dialog id="my-dialog">
  <h2>Confirm action</h2>
  <p>Are you sure?</p>
  <button>Cancel</button> <button>Confirm</button>
</dialog>
<script>document.getElementById('my-dialog').showModal();</script>

<!-- ❌ Focus not returned to trigger on close -->
closeDialog() { dialog.close(); }
<!-- ✅ Restore focus to the element that opened it -->
closeDialog() { dialog.close(); this._trigger.focus(); }

<!-- ❌ Missing aria-label on non-headed dialog -->
<dialog>Are you sure you want to delete this?</dialog>
<!-- ✅ Give it a name -->
<dialog aria-label="Confirm deletion">…</dialog>
```

### Drawer / Sheet
**What it is:** A panel that slides in from an edge of the viewport.
**Variants:** Left/right/bottom, modal (with backdrop) or non-modal.
**ARIA pattern:** Same as dialog if modal. If non-modal, `dialog` without `aria-modal` or complementary landmark.
**Common mistakes:**
```css
/* ❌ Physical properties — breaks in RTL */
.drawer { left: 0; padding-left: 16px; }
/* ✅ Logical properties */
.drawer { inset-inline-start: 0; padding-inline-start: 1rem; }
```
```html
<!-- ❌ Non-modal drawer traps focus like a modal -->
<!-- ✅ Non-modal drawers should NOT trap focus; only modal drawers trap -->
```

### Popover
**What it is:** A floating container shown by interacting with a trigger element.
**Not to be confused with:** Tooltip (popover can contain interactive content; tooltip cannot). Modal (popover doesn't trap focus or block the page).
**ARIA pattern:** Varies by content. Often no special role needed if triggered by a button with `aria-expanded`.
**Common mistakes:**
```html
<!-- ❌ Popover shown on hover only — keyboard users can't reach it -->
<div onmouseenter="showPopover()">Hover me</div>
<!-- ✅ Button trigger with click + keyboard activation -->
<button aria-expanded="false" aria-controls="pop1">More info</button>
<div id="pop1" popover>…interactive content…</div>

<!-- ❌ Trapping focus inside a popover — it's not a dialog -->
<!-- ✅ Popover is non-modal; Tab should naturally leave it, Escape closes it -->
```

### Tooltip
**What it is:** A text-only overlay providing supplementary description, shown on hover/focus.
**Key rule:** Tooltips must not contain interactive content. If you need interactive content, use a popover.
**ARIA pattern:** `tooltip` role, referenced by `aria-describedby` on the trigger. Must be keyboard-accessible (show on focus, not just hover).
**Common mistakes:**
```html
<!-- ❌ Tooltip only on hover — keyboard users never see it -->
<span title="Delete this item"><icon-trash /></span>
<!-- ✅ Show on focus too; use aria-describedby instead of title -->
<button aria-describedby="tip1"><icon-trash aria-hidden="true" /></button>
<div role="tooltip" id="tip1">Delete this item</div>

<!-- ❌ Interactive content inside a tooltip -->
<div role="tooltip">Click <a href="/help">here</a> for help</div>
<!-- ✅ Use a popover for interactive content; tooltips are text-only -->
```

### Dropdown Menu
**What it is:** A list of actions or options revealed by a button press.
**Not to be confused with:** Select (dropdown menu triggers actions; select chooses a form value). Popover (generic container; dropdown menu is specifically a list of actions).
**ARIA pattern:** `menu` / `menuitem` with arrow-key navigation, typeahead. Or `listbox` if selecting values.
**Common mistakes:**
```html
<!-- ❌ Using role="menu" for navigation links -->
<ul role="menu"><li role="menuitem"><a href="/home">Home</a></li></ul>
<!-- ✅ menu is for actions, not navigation. Use <nav> with a list -->

<!-- ❌ Tab key moves between items — wrong keyboard contract -->
<!-- ✅ Arrow keys move between items; Tab exits the menu entirely -->

<!-- ❌ Trigger doesn't indicate it has a popup -->
<button>Actions</button>
<!-- ✅ Announce the popup -->
<button aria-haspopup="true" aria-expanded="false">Actions</button>
```

### Disclosure
**What it is:** The primitive show/hide pattern. A button that toggles visibility of a related section.
**ARIA pattern:** Button with `aria-expanded`, controlling a region via `aria-controls`.
**Common mistakes:**
```html
<!-- ❌ Using a link instead of a button for toggle -->
<a href="#" onclick="toggle()">Show details</a>
<!-- ✅ Button with aria-expanded -->
<button aria-expanded="false" aria-controls="details1">Show details</button>
<div id="details1" hidden>…</div>
```
