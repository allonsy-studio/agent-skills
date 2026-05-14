# Accessibility Patterns for Design System Components

Accessibility is the structural skeleton of a well-built component.
Every recommendation here is tied to a specific WCAG 2.2 criterion or
WAI-ARIA Authoring Practice. AA requirements are labeled **[AA]** and
are non-negotiable baselines. AAA recommendations are labeled **[AAA]**
and represent stretch goals that meaningfully improve the experience.

---

## Table of contents

1. [Foundational ARIA Rules](#foundational-aria-rules)
2. [Keyboard Interaction Patterns](#keyboard-interaction-patterns)
3. [Focus Management](#focus-management)
4. [Live Regions & Dynamic Content](#live-regions--dynamic-content)
5. [Color & Visual Design](#color--visual-design)
6. [Motion & Animation](#motion--animation)
7. [Touch & Pointer](#touch--pointer)
8. [Component-Specific ARIA Patterns](#component-specific-aria-patterns)
9. [Testing Approaches](#testing-approaches)

---

## Foundational ARIA Rules

> Rule 1 is the spec-grade version of the "lean on the browser" principle
> in [`guiding-principles.md`](./guiding-principles.md). This file is
> authoritative for ARIA-specific reasoning; the guiding-principles file
> states the broader heuristic.

### The five rules of ARIA use

1. **Don't use ARIA if native HTML does the job.** A `<button>` is always
   better than `<div role="button" tabindex="0">`. Native elements come
   with free keyboard handling, form participation, and screen reader
   semantics.

2. **Don't change native semantics unless you have to.** Don't put
   `role="button"` on an `<a>`. If you need a link that looks like a
   button, style the `<a>` — don't change its role.

3. **All interactive ARIA controls must be keyboard-operable.** If you add
   `role="tab"`, the element must respond to arrow keys, Home, End, etc.
   The role alone doesn't add behavior — you must implement it.

4. **Don't hide focusable elements.** Never use `role="presentation"` or
   `aria-hidden="true"` on a focusable element or its ancestor. This
   creates a "ghost" element — keyboard-reachable but invisible to
   assistive tech.

5. **All interactive elements must have an accessible name.** Every button,
   link, input, and widget needs a name. Sources of naming, in priority
   order: `aria-labelledby` > `aria-label` > `<label>` > content
   (`textContent` for buttons) > `title` > `placeholder` (last resort).

### Accessible names vs. descriptions

**Name** (what it IS): provided by `aria-label`, `aria-labelledby`,
`<label>`, or content. This is what screen readers announce when the
user focuses the element.

**Description** (extra context): provided by `aria-describedby`. Read
after the name, often after a pause. Use for help text, error messages,
or supplementary instructions.

```html
<label for="email">Email address</label>                <!-- Name -->
<input id="email" type="email" aria-describedby="hint"> <!-- Control -->
<p id="hint">We'll never share your email.</p>          <!-- Description -->
```

---

## Keyboard Interaction Patterns

### Universal keyboard expectations

These keys should work the same way across all components:

| Key       | Behavior                                                  |
| --------- | --------------------------------------------------------- |
| Tab       | Move focus to the next focusable element                  |
| Shift+Tab | Move focus to the previous focusable element              |
| Enter     | Activate the focused element (button, link)               |
| Space     | Activate button, toggle checkbox/switch, select option    |
| Escape    | Close/dismiss the current layer (modal, popover, menu)    |

### Roving tabindex vs. aria-activedescendant

Two strategies for managing focus within composite widgets (tabs, menus,
listboxes, grids):

**Roving tabindex:** One item has `tabindex="0"`, the rest have
`tabindex="-1"`. Arrow keys move `tabindex="0"` to the focused item.
The widget is one tab stop.

```javascript
// Roving tabindex for a tab list
handleArrowKey(direction) {
  const items = this.getAllTabs();
  const current = items.indexOf(this.activeTab);
  const next = (current + direction + items.length) % items.length;

  items[current].tabIndex = -1;
  items[next].tabIndex = 0;
  items[next].focus();
}
```

**aria-activedescendant:** The container element stays focused. Arrow keys
update `aria-activedescendant` to point to the visually focused item.
The item is not actually focused in the DOM — the container tells the
screen reader which child to announce.

```html
<div role="listbox"
     tabindex="0"
     aria-activedescendant="option-2"
     aria-label="Choose a fruit">
  <div role="option" id="option-1">Apple</div>
  <div role="option" id="option-2" class="visually-focused">Banana</div>
  <div role="option" id="option-3">Cherry</div>
</div>
```

**When to use which:**
- **Roving tabindex** when each item needs to receive real DOM focus (e.g.,
  tabs where focus triggers panel display, toolbar buttons).
- **aria-activedescendant** when the container needs to keep focus (e.g.,
  combobox where the input must retain focus while the user browses options).

### Component-specific keyboard contracts

**Tabs:**
- Arrow Left/Right (or Up/Down for vertical tabs): Move between tabs
- Home/End: First/last tab
- Tab key: Move into the active panel from the tab list
- Activation: Automatic (focus = select) or manual (focus then Enter/Space)

**Menu / Dropdown:**
- Arrow Down/Up: Navigate items
- Home/End: First/last item
- Typeahead: Type a character to jump to matching item
- Enter/Space: Activate item
- Escape: Close menu, return focus to trigger

**Combobox:**
- Arrow Down: Open listbox if closed, move to next option if open
- Arrow Up: Move to previous option
- Enter: Select the focused option
- Escape: Clear input or close listbox
- Type: Filter options
- Home/End: Move cursor within text input (not the listbox)

**Tree view:**
- Arrow Down/Up: Navigate visible items
- Arrow Right: Expand node (if collapsed), or move to first child
- Arrow Left: Collapse node (if expanded), or move to parent
- Enter/Space: Activate/select item
- Home/End: First/last visible item
- Typeahead: Jump to matching item
- `*` (asterisk): Expand all siblings at current level

**Dialog (modal):**
- Tab/Shift+Tab: Cycle through focusable elements (focus trapped)
- Escape: Close dialog
- On open: Move focus to first focusable element (or the dialog itself)
- On close: Return focus to the trigger element

**Slider:**
- Arrow Right/Up: Increase value by one step
- Arrow Left/Down: Decrease value by one step
- Page Up: Increase by a large step
- Page Down: Decrease by a large step
- Home: Set to minimum
- End: Set to maximum

---

## Focus Management

### Focus visibility **[AA — WCAG 2.4.7, enhanced in 2.4.11/2.4.12]**

**[AA] 2.4.7 Focus Visible:** Keyboard focus indicator must be visible.
Use `:focus-visible` (not `:focus`) to show focus rings only for keyboard
users.

**[AA] 2.4.11 Focus Not Obscured (Minimum):** The focused element is not
entirely hidden by author-created content (sticky headers, cookie banners,
chat widgets). At least part of the focus indicator must be visible.

**[AAA] 2.4.12 Focus Not Obscured (Enhanced):** No part of the focused
element is hidden by author-created content.

**[AAA] 2.4.13 Focus Appearance:** The focus indicator must:
- Have an area at least as large as a 2px perimeter around the component
- Have at least 3:1 contrast between focused and unfocused states
- Have at least 3:1 contrast against adjacent colors

Recommended focus style that satisfies all three levels:
```css
:focus-visible {
  outline: 2px solid var(--ds-focus-ring-color, #2563eb);
  outline-offset: 2px;
  border-radius: var(--ds-focus-ring-radius, 2px);
}
```

The `outline-offset: 2px` creates visual separation from the element's
border and ensures the focus ring isn't obscured by adjacent elements.

### Focus trapping

Required for modal dialogs. Focus must cycle within the dialog — Tab from
the last focusable element wraps to the first, Shift+Tab from the first
wraps to the last.

```javascript
class FocusTrap {
  constructor(container) {
    this.container = container;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  activate() {
    document.addEventListener('keydown', this.handleKeyDown);
    this.firstFocusable?.focus();
  }

  deactivate() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  get focusableElements() {
    return [...this.container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"]), [contenteditable]'
    )].filter(el => !el.closest('[hidden], [aria-hidden="true"]'));
  }

  get firstFocusable() { return this.focusableElements[0]; }
  get lastFocusable() {
    const els = this.focusableElements;
    return els[els.length - 1];
  }

  handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === this.firstFocusable) {
      e.preventDefault();
      this.lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === this.lastFocusable) {
      e.preventDefault();
      this.firstFocusable.focus();
    }
  }
}
```

### Focus restoration

When a modal, popover, or menu closes, return focus to the element that
triggered it. This is essential — without it, keyboard users lose their
place in the document.

```javascript
class DsDialog extends HTMLElement {
  open() {
    this.triggerElement = document.activeElement; // Save trigger
    this.setAttribute('open', '');
    this.focusTrap.activate();
  }

  close() {
    this.removeAttribute('open');
    this.focusTrap.deactivate();
    this.triggerElement?.focus(); // Restore focus
  }
}
```

### Scroll and focus coordination

When focus moves to an element that's outside the viewport (e.g., in a long
list), the browser must scroll it into view. Use `element.focus({
preventScroll: false })` (the default) unless you're managing scroll
yourself.

For components like tabs where the panel might be below the fold:
```javascript
tabPanel.focus({ preventScroll: false });
// Or manually scroll if you need animation:
tabPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

---

## Live Regions & Dynamic Content

### When to use live regions

Use live regions to announce content changes that happen outside the user's
current focus. Without them, screen reader users won't know that a toast
appeared, a form error was shown, or a list was filtered.

### Live region types

**`aria-live="polite"`** — waits for the current announcement to finish:
- Status messages: "3 results found"
- Non-urgent notifications
- Loading completion: "Content loaded"

**`aria-live="assertive"`** — interrupts the current announcement:
- Error alerts: "Payment failed"
- Time-sensitive warnings
- Session expiration notices

**`role="status"`** — implicit `aria-live="polite"`:
```html
<div role="status">3 items in your cart</div>
```

**`role="alert"`** — implicit `aria-live="assertive"`:
```html
<div role="alert">Your session will expire in 2 minutes.</div>
```

### Critical implementation detail

The live region container must exist in the DOM BEFORE content is injected
into it. If you create the element AND insert content in the same
operation, many screen readers won't announce it.

```html
<!-- Correct: container exists, content updates later -->
<div aria-live="polite" id="status-region"></div>

<script>
  // Later, when results change:
  document.getElementById('status-region').textContent = '5 results found';
</script>
```

```html
<!-- Wrong: container and content created simultaneously -->
<script>
  const region = document.createElement('div');
  region.setAttribute('aria-live', 'polite');
  region.textContent = '5 results found';
  document.body.appendChild(region); // Many screen readers will miss this
</script>
```

### Status messages **[AA — WCAG 4.1.3]**

Status messages that don't receive focus must be programmatically
determinable through role or properties. This means:
- Form validation errors shown on submit → live region or `role="alert"`
- Search result counts → `role="status"`
- Progress updates → `role="status"` or `role="progressbar"`
- Shopping cart count updates → `role="status"`

---

## Color & Visual Design

### Contrast requirements

**[AA] 1.4.3 Contrast (Minimum):**
- Normal text: 4.5:1 against background
- Large text (18pt / 14pt bold): 3:1 against background

**[AAA] 1.4.6 Contrast (Enhanced):**
- Normal text: 7:1 against background
- Large text: 4.5:1 against background

**[AA] 1.4.11 Non-text Contrast:**
- UI components (buttons, inputs, focus rings): 3:1 against adjacent colors
- Graphical objects needed for understanding: 3:1

### Color not as sole indicator **[AA — WCAG 1.4.1]**

Never use color alone to convey information. Always pair with text, icons,
or patterns:

```html
<!-- Bad: only color differentiates error state -->
<input style="border-color: red;">

<!-- Good: color + icon + text -->
<div class="ds-field ds-field--error">
  <label for="email">Email</label>
  <input id="email" aria-describedby="email-error" aria-invalid="true">
  <p id="email-error" class="ds-field__error">
    <svg aria-hidden="true"><!-- error icon --></svg>
    Please enter a valid email address.
  </p>
</div>
```

### High contrast mode and forced colors

Test with Windows High Contrast Mode (now called "Contrast Themes") and
`forced-colors: active` media query. Custom colors get overridden — ensure
your component's structure is still clear:

```css
@media (forced-colors: active) {
  .ds-button {
    /* In forced-colors mode, use system colors */
    border: 1px solid ButtonText;
  }

  .ds-button:focus-visible {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }

  .ds-checkbox__indicator {
    /* Borders become the primary way to see elements */
    border: 2px solid ButtonText;
  }
}
```

---

## Motion & Animation

### Pause, stop, hide **[AA — WCAG 2.2.1, 2.2.2, 2.3.1]**

**[AA] 2.2.1 Timing Adjustable:** If content auto-advances (carousel,
toast), the user must be able to pause, extend, or dismiss it. Auto-
dismissing toasts must give at least 20 seconds OR provide a way to
extend.

**[AA] 2.2.2 Pause, Stop, Hide:** Moving, blinking, or scrolling content
that starts automatically must be pausable if it lasts more than 5 seconds.

**[AA] 2.3.1 Three Flashes or Below Threshold:** No content flashes more
than 3 times per second.

### Reduced motion **[should implement — aligns with AAA 2.3.3]**

Respect `prefers-reduced-motion`. This isn't just about preference — it
prevents vestibular disorders from being triggered:

```css
/* Default: animations on */
.ds-drawer {
  transition: transform 300ms ease;
}

/* Reduced motion: instant transitions */
@media (prefers-reduced-motion: reduce) {
  .ds-drawer {
    transition: none;
  }

  /* Or: keep subtle opacity fades, remove transforms */
  .ds-modal {
    transition: opacity 150ms ease;
    /* Remove: transform, slide, bounce */
  }
}
```

---

## Touch & Pointer

### Target size **[AA — WCAG 2.5.8, AAA — 2.5.5]**

**[AA] 2.5.8 Target Size (Minimum):** Interactive targets must be at least
24×24 CSS pixels, OR have sufficient spacing from other targets. Inline
links within text blocks are exempt.

**[AAA] 2.5.5 Target Size (Enhanced):** At least 44×44 CSS pixels.

```css
/* Ensure minimum touch target even for icon buttons */
.ds-icon-button {
  min-width: 44px;  /* AAA target */
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* If the visible element is small, expand the hit area */
.ds-checkbox__input {
  position: relative;
}
.ds-checkbox__input::before {
  content: '';
  position: absolute;
  inset: -8px; /* Expand clickable area */
}
```

### Dragging alternatives **[AA — WCAG 2.5.7]**

**[AA] 2.5.7 Dragging Movements:** Any action performed by dragging must
also be achievable through a simple pointer action (click, tap). This
means:
- Sortable lists: drag AND up/down buttons
- Sliders: drag AND click on track AND arrow key support
- Kanban boards: drag AND a menu action to move cards

---

## Component-Specific ARIA Patterns

Quick reference for the most common widget patterns. Each links the
relevant WAI-ARIA Authoring Practice.

### Accordion

**Native-first approach — use `<details>`/`<summary>`:**
```html
<details class="ds-accordion-item">
  <summary>
    <h3 class="ds-accordion-heading">Section Title</h3>
  </summary>
  <div class="ds-accordion-panel">
    <p>Panel content.</p>
  </div>
</details>
```
- The browser handles expand/collapse, keyboard activation (Enter/Space), and `aria-expanded` semantics automatically
- No JavaScript needed for basic disclosure behavior
- Add JS only for coordinated behavior (e.g., single-expand across a group of `<details>` elements)
- The heading inside `<summary>` preserves document outline

**Custom approach** (when `<details>` is insufficient — e.g., animation requirements, or IE support):
```html
<div class="ds-accordion">
  <h3>
    <button aria-expanded="false" aria-controls="panel-1" id="header-1">
      Section Title
    </button>
  </h3>
  <div id="panel-1" role="region" aria-labelledby="header-1" hidden>
    <p>Panel content.</p>
  </div>
</div>
```
- Heading level should match the page hierarchy
- `aria-expanded` on the button, not the panel
- `hidden` attribute or `display: none` on collapsed panels
- This approach requires you to implement keyboard handling, focus management, and ARIA state management that `<details>` gives you for free

### Tabs
```html
<div class="ds-tabs">
  <div role="tablist" aria-label="Account settings">
    <button role="tab" id="tab-1" aria-selected="true" aria-controls="panel-1">
      Profile
    </button>
    <button role="tab" id="tab-2" aria-selected="false" aria-controls="panel-2" tabindex="-1">
      Security
    </button>
  </div>
  <div role="tabpanel" id="panel-1" aria-labelledby="tab-1" tabindex="0">
    Profile content.
  </div>
  <div role="tabpanel" id="panel-2" aria-labelledby="tab-2" tabindex="0" hidden>
    Security content.
  </div>
</div>
```
- Only the active tab has `tabindex="0"` (roving tabindex)
- Arrow keys move between tabs
- `tabindex="0"` on panels so they can receive focus via Tab
- Hidden panels use `hidden` attribute

### Dialog (Modal)
```html
<div role="dialog"
     aria-modal="true"
     aria-labelledby="dialog-title"
     aria-describedby="dialog-desc">
  <h2 id="dialog-title">Confirm deletion</h2>
  <p id="dialog-desc">This will permanently delete your account.</p>
  <button>Delete account</button>
  <button>Cancel</button>
</div>
```
- Focus trap: Tab/Shift+Tab cycle within dialog
- Escape closes dialog
- Focus first focusable element on open
- Return focus to trigger on close
- `aria-modal="true"` + `inert` on background content

### Combobox
```html
<div class="ds-combobox">
  <label for="search-input">Search cities</label>
  <div class="ds-combobox__wrapper">
    <input id="search-input"
           role="combobox"
           aria-expanded="false"
           aria-autocomplete="list"
           aria-controls="listbox-1"
           aria-activedescendant="">
    <ul id="listbox-1" role="listbox" hidden>
      <li role="option" id="opt-1">Amsterdam</li>
      <li role="option" id="opt-2">Berlin</li>
      <li role="option" id="opt-3">Copenhagen</li>
    </ul>
  </div>
</div>
```
- Input keeps focus; `aria-activedescendant` points to highlighted option
- Arrow Down opens listbox if closed, navigates if open
- Enter selects highlighted option
- Escape clears or closes
- Typing filters options; announce count via live region

### Switch / Toggle
```html
<label class="ds-switch">
  <span class="ds-switch__label">Dark mode</span>
  <button role="switch"
          aria-checked="false"
          class="ds-switch__control">
    <span class="ds-switch__thumb"></span>
  </button>
</label>
```
- `role="switch"` with `aria-checked`
- Space or Enter toggles state
- Label associated via wrapping `<label>` or `aria-labelledby`

### Tooltip
```html
<button aria-describedby="tip-1">
  <svg aria-hidden="true"><!-- icon --></svg>
  <span class="visually-hidden">Settings</span>
</button>
<div role="tooltip" id="tip-1" class="ds-tooltip">
  Open application settings
</div>
```
- `role="tooltip"` on the tooltip element
- `aria-describedby` on the trigger
- Show on hover AND focus
- Hide on Escape
- No interactive content inside tooltips
- Delay show (~300ms) to avoid accidental triggers

---

## Testing Approaches

### Automated testing checklist

Run these on every component:
- axe-core or similar (catches ~30-40% of issues)
- HTML validator (catches invalid ARIA, missing labels)
- Color contrast checker on all states (default, hover, focus, disabled,
  error)
- Forced-colors mode screenshot comparison

### Manual testing protocol

For each component:
1. **Keyboard-only navigation:** Unplug the mouse. Can you operate every
   feature? Is focus visible at all times? Does focus order make sense?

2. **Screen reader testing:** Test with at least two:
   - VoiceOver + Safari (macOS/iOS)
   - NVDA + Firefox or Chrome (Windows)
   - TalkBack + Chrome (Android)

   Verify: name announced, role announced, state changes announced,
   instructions conveyed.

3. **Zoom testing:** Zoom to 200% and 400%. Does the component reflow? Is
   anything clipped or overlapping?

4. **Reduced motion:** Enable `prefers-reduced-motion: reduce`. Do
   animations stop or simplify?

5. **High contrast mode:** Enable Windows Contrast Themes. Are all elements
   visible and distinguishable?

### What to verify per screen reader

| Check                    | What you're listening for                            |
| ------------------------ | ---------------------------------------------------- |
| Focus lands correctly    | Component name and role announced on focus            |
| State changes            | "expanded", "collapsed", "checked", "selected"       |
| Live region updates      | Toasts, error messages, search results announced     |
| Group context            | "Tab 2 of 4", "Option 3 of 10"                      |
| Instructions             | "Use arrow keys to navigate" (if applicable)         |
| Dismissal                | Escape key works, focus returns to trigger            |
