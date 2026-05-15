# Application Tools

Specialized controls found in SPA tool UIs — design tools, code editors, admin
dashboards, and similar applications. These tend to be complex widgets with
non-trivial keyboard contracts.

## Panel
**What it is:** A generic secondary content area within an application — properties panel, inspector, detail view, info pane.
**Variants:** Static, collapsible, floating/detachable, tabbed (multiple sub-panels in tabs).
**Not to be confused with:** Drawer (slides in from edge, often modal). Sidebar (typically navigation, not content). Dialog (overlays and traps focus).
**Key concerns:** Panels are non-modal — they coexist with main content. They need an accessible name (via heading or `aria-label`) so screen readers can identify them. If the panel is collapsible, the toggle button needs `aria-expanded` and `aria-controls`. If the panel can be closed, provide a close button with a clear label and a keyboard shortcut to reopen.
**ARIA pattern:** `role="region"` with `aria-labelledby` pointing to the panel's heading, or `role="complementary"` if it serves as a sidebar. Collapsible panels follow the disclosure pattern: button with `aria-expanded` controlling the region.
**Common mistakes:**
```html
<!-- ❌ Panel has no accessible name — AT reads "region" with no context -->
<div role="region">…properties…</div>
<!-- ✅ Name the region -->
<div role="region" aria-labelledby="panel-heading">
  <h2 id="panel-heading">Properties</h2>
  …
</div>

<!-- ❌ Close button says "X" — ambiguous when multiple panels are open -->
<button>×</button>
<!-- ✅ Include the panel name -->
<button aria-label="Close Properties panel">×</button>
```

### Color Picker
**What it is:** A control for selecting a color, typically combining a 2D gradient area, hue/alpha sliders, and text inputs for hex/RGB/HSL values.
**Variants:** Simple swatch grid, gradient + sliders, with alpha channel, with eyedropper.
**Key concerns:** The 2D gradient area is the hardest part — it needs `role="slider"` or a custom `role="application"` region with arrow-key navigation in two axes. Both the gradient and the hue slider must expose their current value to assistive technology via `aria-valuetext` (e.g., "Hue: 220 degrees" not just a number). The hex/RGB inputs are the most accessible path, so always provide them — power users and AT users will prefer them. Swatch grids use `role="radiogroup"` / `role="radio"`.
**ARIA pattern:** Hue/saturation sliders: `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`, `aria-label`. Swatch palette: `role="radiogroup"` containing `role="radio"` items. Text inputs: standard labeled `<input>`. The 2D area (if present) needs custom keyboard handling — arrow keys adjust one axis, Shift+arrow the other — and must announce position changes via `aria-valuetext` or a live region.
**Common mistakes:**
```html
<!-- ❌ 2D gradient area is mouse-only — keyboard users can't pick a color -->
<canvas onmousedown="pickColor(e)"></canvas>
<!-- ✅ Make it keyboard-operable with arrow keys -->
<div role="slider" tabindex="0" aria-label="Saturation and brightness"
     aria-valuetext="Saturation 80%, Brightness 60%">
</div>
<!-- ArrowLeft/Right = saturation, ArrowUp/Down = brightness -->

<!-- ❌ No text input fallback — AT users have no precise entry path -->
<!-- ✅ Always provide hex/RGB text inputs as the primary accessible path -->
<label for="hex">Hex</label>
<input id="hex" type="text" value="#3B82F6" />
```

### Complex Dropdown Menu
**What it is:** A dropdown menu that goes beyond a flat action list — supporting sub-menus, grouped sections, checkable items, and inline search.
**Variants:** Nested/cascading sub-menus, grouped with dividers, with checkbox/radio items, searchable, with keyboard shortcuts displayed.
**Not to be confused with:** Select/combobox (form value selection). Command palette (search-first paradigm). Simple dropdown menu (flat list of actions).
**Key concerns:** Sub-menus are activated by `ArrowRight` on a parent `menuitem`, closed by `ArrowLeft` or `Escape`. Each sub-menu level needs its own `role="menu"`. Checkbox items use `role="menuitemcheckbox"` with `aria-checked`. Radio items use `role="menuitemradio"` within a `role="group"`. Keyboard shortcut hints are displayed visually but should not pollute the accessible name — put them in a separate element with `aria-hidden="true"` or use `aria-keyshortcuts`. Typeahead (pressing a letter jumps to matching item) is expected.
**ARIA pattern:** `role="menu"` container with `role="menuitem"`, `role="menuitemcheckbox"`, or `role="menuitemradio"` children. Sub-menu triggers get `aria-haspopup="menu"` and `aria-expanded`. Groups within the menu use `role="group"` with `aria-label`. Separators use `role="separator"`.
**Common mistakes:**
```html
<!-- ❌ Sub-menu opens on hover only — keyboard/touch users stranded -->
<li onmouseenter="showSubmenu()">More…</li>
<!-- ✅ ArrowRight opens sub-menu, ArrowLeft/Escape closes it -->

<!-- ❌ Keyboard shortcut hints are part of the accessible name -->
<li role="menuitem">Save <kbd>Ctrl+S</kbd></li>
<!-- AT reads "Save Control plus S" — noisy -->
<!-- ✅ Hide the shortcut from AT; it's a visual hint only -->
<li role="menuitem">Save <kbd aria-hidden="true">Ctrl+S</kbd></li>

<!-- ❌ Checkable items use role="menuitem" — AT doesn't know they toggle -->
<li role="menuitem" class="checked">✓ Word Wrap</li>
<!-- ✅ Use menuitemcheckbox -->
<li role="menuitemcheckbox" aria-checked="true">Word Wrap</li>
```
