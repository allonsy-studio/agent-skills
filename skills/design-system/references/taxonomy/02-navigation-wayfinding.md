# Navigation & Wayfinding

## Navigation / Nav
**What it is:** A container for navigation links — site-wide, local, or in-page.
**Variants:** Top bar, sidebar, hamburger/mobile, mega menu.
**ARIA pattern:** `<nav>` landmark with `aria-label` distinguishing multiple navs.
**Common mistakes:**
```html
<!-- ❌ Multiple <nav> elements with no labels -->
<nav>…site nav…</nav>
<nav>…footer nav…</nav>
<!-- ✅ Distinguish them for screen reader landmark navigation -->
<nav aria-label="Main">…</nav>
<nav aria-label="Footer">…</nav>

<!-- ❌ Using <div role="navigation"> instead of <nav> -->
<div role="navigation">…</div>
<!-- ✅ Use the native element -->
<nav aria-label="Main">…</nav>
```

### Breadcrumbs
**What it is:** A trail showing the user's location in a site hierarchy.
**ARIA pattern:** `<nav aria-label="Breadcrumb">` with `<ol>`, current page marked with `aria-current="page"`.
**Common mistakes:**
```html
<!-- ❌ Using <div> with visual separators in the text -->
<div>Home > Products > Widget</div>
<!-- ✅ Ordered list with aria-current on the current page -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/products/widget" aria-current="page">Widget</a></li>
  </ol>
</nav>
```

### Pagination
**What it is:** Controls for moving between pages of content.
**Variants:** Numbered, prev/next only, load-more, infinite scroll (not strictly pagination but often a replacement).
**ARIA pattern:** `<nav aria-label="Pagination">` with links or buttons.
**Common mistakes:**
```html
<!-- ❌ No indication of current page for AT -->
<a href="?p=2" class="active">2</a>
<!-- ✅ Mark the current page -->
<a href="?p=2" aria-current="page">2</a>

<!-- ❌ Disabled prev/next as links with no href -->
<a class="disabled">Previous</a>
<!-- ✅ Use button with disabled attribute or aria-disabled -->
<button disabled>Previous</button>
```

### Tabs
**What it is:** Switches between panels of content within the same context.
**Variants:** Horizontal, vertical, fitted/scrollable, with icons.
**Not to be confused with:** Navigation (tabs switch panels on the same page; nav goes to different pages). Segmented control (form input that selects a value).
**ARIA pattern:** `tablist` / `tab` / `tabpanel` with arrow-key navigation.
**Common mistakes:**
```html
<!-- ❌ Using links as tabs — Tab key moves between "tabs" -->
<a href="#panel1" class="tab">One</a>
<a href="#panel2" class="tab">Two</a>
<!-- ✅ Arrow keys navigate tabs, Tab moves to the panel -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel1">One</button>
  <button role="tab" aria-selected="false" aria-controls="panel2">Two</button>
</div>

<!-- ❌ Tab panel has no association back to its tab -->
<div id="panel1">…</div>
<!-- ✅ Link panel back to its tab -->
<div role="tabpanel" id="panel1" aria-labelledby="tab1">…</div>
```

### Sidebar
**What it is:** A vertical panel alongside main content, typically for navigation or contextual tools.
**Variants:** Fixed, collapsible, mini/rail.
**Common mistakes:**
```html
<!-- ❌ Sidebar with no landmark role — invisible to AT navigation -->
<div class="sidebar">…nav items…</div>
<!-- ✅ Use an appropriate landmark -->
<nav aria-label="Sidebar" class="sidebar">…nav items…</nav>
<!-- or for non-nav content: -->
<aside aria-label="Inspector" class="sidebar">…</aside>
```

### Segmented Control
**What it is:** A set of 2–5 options that acts as a single-select input, often used as a view switcher.
**Not to be confused with:** Tabs (segmented control is a form input; tabs manage panels). Radio group (visually different but functionally similar).
**ARIA pattern:** `radiogroup` with `radio` roles.
**Common mistakes:**
```html
<!-- ❌ Using buttons — no single-select semantics -->
<button class="active">Grid</button>
<button>List</button>
<!-- ✅ Radio group semantics — AT knows exactly one is selected -->
<div role="radiogroup" aria-label="View">
  <button role="radio" aria-checked="true">Grid</button>
  <button role="radio" aria-checked="false">List</button>
</div>
```

### Table of Contents
**What it is:** An in-page nav listing sections of the current document, often with scroll-spy behavior.
**Common mistakes:**
```html
<!-- ❌ Scroll-spy updates visual highlight but not AT state -->
<a href="#intro" class="active">Introduction</a>
<!-- ✅ Mark the current section -->
<a href="#intro" aria-current="true">Introduction</a>
```
