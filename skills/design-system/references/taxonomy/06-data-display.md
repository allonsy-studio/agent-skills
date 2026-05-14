# Data Display

### Table
**What it is:** Rows and columns of structured data.
**Variants:** Basic, sortable, filterable, with row selection, with expandable rows.
**ARIA pattern:** Native `<table>`, `<thead>`, `<tbody>`, `<th scope>`. For sortable columns, use `aria-sort`. For interactive grids with cell-level focus, use `role="grid"`.
**Common mistakes:**
```html
<!-- ❌ Using <div> grid for tabular data — AT can't navigate cells -->
<div class="row"><div class="col">Name</div><div class="col">Email</div></div>
<!-- ✅ Use a real <table> — screen readers provide cell navigation -->
<table>
  <thead><tr><th scope="col">Name</th><th scope="col">Email</th></tr></thead>
  <tbody><tr><td>Cassondra</td><td>…</td></tr></tbody>
</table>

<!-- ❌ Sortable column with no sort state announced -->
<th><button>Name ▲</button></th>
<!-- ✅ Announce sort state -->
<th aria-sort="ascending"><button>Name</button></th>
```

### List
**What it is:** A collection of related items.
**Variants:** Unordered (`<ul>`), ordered (`<ol>`), description (`<dl>`), interactive (with actions per item).
**ARIA pattern:** Native list elements. For interactive lists where items can be selected, `role="listbox"`.
**Common mistakes:**
```html
<!-- ❌ Using role="listbox" for a non-selectable list -->
<ul role="listbox"><li role="option">News item</li></ul>
<!-- ✅ listbox implies selection; for display-only lists, use native <ul>/<ol> -->

<!-- ❌ Stripping list semantics with CSS (list-style: none in Safari) -->
<!-- ✅ Add role="list" explicitly when list-style: none is applied,
     since Safari + VoiceOver strips list semantics without it -->
```

### Tree / Tree View
**What it is:** A hierarchical list where items can be expanded/collapsed.
**ARIA pattern:** `role="tree"` / `role="treeitem"` with `aria-expanded`.
**Common mistakes:**
```html
<!-- ❌ Nested <ul> with no tree roles — AT sees a flat list of lists -->
<ul><li>Parent<ul><li>Child</li></ul></li></ul>
<!-- ✅ Full tree semantics with aria-expanded -->
<ul role="tree">
  <li role="treeitem" aria-expanded="true">
    Parent
    <ul role="group">
      <li role="treeitem">Child</li>
    </ul>
  </li>
</ul>
```

### Tag / Chip
**What it is:** A compact label representing a category, filter, or attribute.
**Variants:** Read-only, dismissible, selectable, input (for tokenized inputs).
**ARIA pattern:** If dismissible, include a button with an accessible label like "Remove [tag name]".
**Common mistakes:**
```html
<!-- ❌ Dismiss button with no context — AT reads just "X" or "Close" -->
<span class="tag">React <button>×</button></span>
<!-- ✅ Button includes the tag name -->
<span class="tag">React <button aria-label="Remove React">×</button></span>
```

### Chart / Data Visualization
**What it is:** A graphical representation of data — trends, distributions, comparisons, or relationships.
**Variants:** Bar, line, area, pie/donut, scatter, heatmap, sparkline (inline mini-chart).
**Key concerns:** Charts are inherently visual. Provide a text summary or data table alternative for every chart (WCAG 1.1.1). Use `role="img"` with `aria-label` or `aria-labelledby` on the chart container. If the chart is interactive (hover for values, click to filter), all interactions need keyboard equivalents. Color alone must not convey meaning — use patterns, labels, or shape differentiation (WCAG 1.4.1).
**ARIA pattern:** `role="img"` with `aria-label` for static charts. For interactive charts, expose underlying data via a companion table or use `aria-live` regions to announce values on keyboard navigation.
**Common mistakes:**
```html
<!-- ❌ Canvas chart with no text alternative -->
<canvas id="revenue-chart"></canvas>
<!-- ✅ Add role, label, and a data table fallback -->
<figure>
  <canvas id="revenue-chart" role="img" aria-label="Revenue by quarter: Q1 $1.2M, Q2 $1.5M, Q3 $1.1M, Q4 $1.8M"></canvas>
  <details><summary>View data table</summary><table>…</table></details>
</figure>

<!-- ❌ Color alone distinguishes data series -->
<!-- ✅ Add patterns, labels, or distinct shapes alongside color -->
```

### Avatar
**What it is:** A visual representation of a user — photo, initials, or icon.
**Key concern:** Needs appropriate `alt` text if it's an image. If decorative (next to the user's name), `alt=""`.
**Common mistakes:**
```html
<!-- ❌ Meaningful avatar with no alt text -->
<img src="avatar.jpg" class="avatar" />
<!-- ✅ Decorative: empty alt. Standalone: descriptive alt -->
<img src="avatar.jpg" alt="" class="avatar" /> <!-- next to name text -->
<img src="avatar.jpg" alt="Cassondra Roberts" class="avatar" /> <!-- standalone -->
```

### A note on icons and empty states

**Icons** are content, not standalone components. An icon is a piece of
content that appears inside other components — buttons, links, alerts,
badges, navigation items, list items. See `references/iconography.md` for
how to size, color, name, and make icons accessible. When someone says "I
need an icon component," what they typically need is a rendering mechanism
(a Web Component or utility that resolves an icon name to SVG markup) — not
a pattern with its own ARIA role and keyboard contract.

**Empty states** are a facet of other components, not a standalone pattern.
A table, list, card grid, or any data-displaying component should define
what it looks like when there's no data. Empty states should be helpful —
explain why the view is empty and suggest an action. Build empty state
support into each relevant component's API (e.g., a `slot="empty"` or an
`empty-message` attribute) rather than creating a generic "EmptyState"
component that gets dropped in arbitrarily.
