# Application Chrome & Layout

These patterns form the structural shell of single-page applications, dashboards,
and tool UIs. They're assembled from primitives in the sections above but have
their own distinct keyboard contracts, resize behaviors, and landmark requirements.

## App Shell
**What it is:** The outermost layout frame of a single-page application — typically a fixed header, a collapsible sidebar, and a main content area.
**Variants:** Sidebar + header, top-nav only, rail (icon-only sidebar) + header, stacked (header + sub-header).
**Key concerns:** The shell defines the landmark structure of the entire app. `<header>`, `<nav>`, `<main>`, and `<aside>` must be used correctly so screen reader users can jump between regions. The sidebar toggle must announce its state (`aria-expanded`). When the sidebar collapses to a rail, icon-only items need accessible labels.
**ARIA pattern:** Landmarks (`banner`, `navigation`, `main`, `complementary`). The sidebar toggle is a button with `aria-expanded` and `aria-controls` pointing to the sidebar region.
**Common mistakes:**
```html
<!-- ❌ No landmark structure — AT users can't jump between regions -->
<div class="header">…</div>
<div class="sidebar">…</div>
<div class="content">…</div>
<!-- ✅ Use landmarks so AT users can navigate by region -->
<header role="banner">…</header>
<nav aria-label="Main">…</nav>
<main>…</main>

<!-- ❌ Collapsed sidebar icons have no labels -->
<button class="nav-icon"><svg>…</svg></button>
<!-- ✅ Icon-only items always need accessible names -->
<button class="nav-icon" aria-label="Settings"><svg aria-hidden="true">…</svg></button>
```

### Split Pane / Resizable Panels
**What it is:** Two or more content regions separated by a draggable divider that lets users resize each pane.
**Variants:** Horizontal split, vertical split, multi-pane (three-way), collapsible panes.
**Key concerns:** The divider must be keyboard-operable — arrow keys resize, Home/End snap to min/max. Minimum pane sizes must be enforced. `prefers-reduced-motion` should disable drag animations. The divider needs an accessible name ("Resize sidebar" not "Divider").
**ARIA pattern:** The divider is `role="separator"` with `aria-orientation`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `tabindex="0"`. When the separator is focusable and operable, it becomes a "widget separator" per the ARIA spec. Use `aria-controls` to reference the pane IDs.
**Common mistakes:**
```html
<!-- ❌ Divider is only mouse-draggable — keyboard users can't resize -->
<div class="divider" onmousedown="startDrag()"></div>
<!-- ✅ Make it focusable and keyboard-operable -->
<div role="separator" tabindex="0" aria-orientation="vertical"
     aria-valuenow="50" aria-valuemin="10" aria-valuemax="90"
     aria-label="Resize sidebar">
</div>
<!-- Arrow keys adjust, Home/End snap to min/max -->

<!-- ❌ No minimum pane size — user can collapse to 0px -->
<!-- ✅ Enforce min-width/min-height and clamp aria-valuenow -->
```

### Sticky Header / Sticky Region
**What it is:** A header, toolbar, or summary row that pins to the viewport edge on scroll while the rest of the page scrolls beneath it.
**Variants:** Sticky header (top), sticky footer (bottom), sticky column (table), show-on-scroll-up (auto-hiding header).
**Key concerns:** `position: sticky` is pure CSS and needs no ARIA — the DOM order stays correct. The main trap is z-index wars and clipping contexts (`overflow: hidden` on ancestors kills stickiness). Auto-hiding headers must not hide focused elements — if focus is inside the header, don't hide it. Sticky regions should never cover interactive content without providing a way to reach it.
**ARIA pattern:** None specific. The header should already be a `<header>` / `role="banner"` landmark. Ensure skip links still work when the header is sticky.
**Common mistakes:**
```css
/* ❌ Sticky element inside an overflow:hidden ancestor — stickiness silently breaks */
.parent { overflow: hidden; }
.parent .sticky-header { position: sticky; top: 0; } /* won't work */
/* ✅ Audit ancestor overflow — remove or restructure to avoid clipping context */

/* ❌ Auto-hiding header hides while user has focus inside it */
/* ✅ Check document.activeElement before hiding; if focus is
   inside the header, keep it visible */
```

### Command Bar / Toolbar
**What it is:** A horizontal strip of action buttons, often with overflow and grouped sections.
**Variants:** Fixed toolbar, contextual toolbar (appears on selection), overflow with "more" menu.
**Not to be confused with:** Command palette (overlay with search). Navigation bar (links to pages, not actions).
**ARIA pattern:** `role="toolbar"` with `aria-label` or `aria-labelledby`. Arrow keys move between items within the toolbar. `Tab` enters the toolbar, arrows navigate, `Tab` again exits. Items that don't fit should overflow into a dropdown menu, not simply disappear.
**Common mistakes:**
```html
<!-- ❌ Toolbar items are all individual tab stops — painful navigation -->
<div class="toolbar">
  <button>Bold</button><button>Italic</button><button>Underline</button>
  <!-- 20+ more buttons all in tab order -->
</div>
<!-- ✅ Roving tabindex — Tab enters, arrows navigate, Tab exits -->
<div role="toolbar" aria-label="Formatting">
  <button tabindex="0">Bold</button>
  <button tabindex="-1">Italic</button>
  <button tabindex="-1">Underline</button>
</div>

<!-- ❌ Overflow items simply get display:none — they vanish without a trace -->
<!-- ✅ Move overflow items into a "More actions" dropdown menu -->
```

### Status Bar
**What it is:** A narrow strip (usually at the bottom of the app) displaying contextual metadata — line number, connection status, notification count, active mode.
**Variants:** Simple text, segmented with multiple indicators, interactive (clickable regions).
**Key concerns:** Status bars are typically decorative/supplemental, so they should not steal focus. Use `role="status"` or `aria-live="polite"` for values that update dynamically (e.g., connection status). If individual segments are interactive (clickable), each needs button semantics and an accessible label.
**ARIA pattern:** `role="status"` on the container or individual live segments. Interactive segments use `role="button"`. The bar itself can be `role="contentinfo"` if it serves as a footer-like region.
**Common mistakes:**
```html
<!-- ❌ Status bar updates with assertive live region — interrupts constantly -->
<div aria-live="assertive">Ln 42, Col 8</div>
<!-- ✅ Use polite for routine metadata updates -->
<div aria-live="polite">Ln 42, Col 8</div>

<!-- ❌ Interactive segments look clickable but are <span>s — not focusable -->
<span class="status-segment" onclick="showBranch()">main</span>
<!-- ✅ Use buttons -->
<button class="status-segment" aria-label="Git branch: main">main</button>
```

### Notification Center
**What it is:** A panel (popover or drawer) containing a list of notifications, typically opened from a bell icon in the header.
**Variants:** Popover dropdown, side drawer, full-page view.
**Key concerns:** The trigger button must announce the unread count (e.g., `aria-label="Notifications, 3 unread"`). The panel is either a popover (non-modal, `aria-expanded` on trigger) or a dialog (modal, with focus trap). Each notification item should be a discrete unit — if dismissible, the dismiss button needs a label like "Dismiss notification: `[title]`". Mark-all-as-read is a destructive-ish action, so consider confirmation.
**ARIA pattern:** Trigger is a button with `aria-expanded` and `aria-haspopup`. Notification list is `role="list"` or `role="feed"` (if infinite-scrolling). The `role="feed"` pattern supports `aria-setsize`/`aria-posinset` for virtualized lists.
**Common mistakes:**
```html
<!-- ❌ Trigger button shows visual badge count but AT reads just "Notifications" -->
<button>🔔 <span class="badge">3</span></button>
<!-- ✅ Include the count in the accessible name -->
<button aria-label="Notifications, 3 unread" aria-expanded="false" aria-haspopup="true">
  🔔 <span class="badge" aria-hidden="true">3</span>
</button>

<!-- ❌ Dismiss button per notification has no context — AT reads "Dismiss" 10x -->
<button>Dismiss</button>
<!-- ✅ Include the notification title -->
<button aria-label="Dismiss: Build failed on main">Dismiss</button>
```
