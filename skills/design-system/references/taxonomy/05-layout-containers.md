# Layout & Containers

## Card
**What it is:** A bounded container representing a single entity — an article, product, person, etc.
**Variants:** Basic, interactive (clickable), with media, horizontal.
**Key concern:** If the entire card is clickable, the click target must be clear and the card needs an accessible name (typically from its heading). Don't wrap the entire card in an `<a>` — use a heading link with a pseudo-element stretch technique or explicit link text.
**Common mistakes:**
```html
<!-- ❌ Wrapping entire card in <a> — AT reads ALL card content as link text -->
<a href="/product/1" class="card">
  <img src="…" alt="Widget" />
  <h3>Widget</h3>
  <p>A great product for your needs with many features…</p>
  <span>$29.99</span>
</a>
<!-- ✅ Heading link + pseudo-element stretch for the click target -->
<div class="card">
  <img src="…" alt="" />
  <h3><a href="/product/1" class="card-link">Widget</a></h3>
  <p>A great product…</p>
  <span>$29.99</span>
</div>
<!-- .card-link::after { content: ''; position: absolute; inset: 0; } -->
```

### Header
**What it is:** The top-level banner of a page, containing branding and primary navigation.
**ARIA pattern:** `<header>` landmark (or `role="banner"` if not a direct child of `<body>`).
**Common mistakes:**
```html
<!-- ❌ <header> inside <section> — it's not a banner landmark anymore -->
<section><header>…</header></section>
<!-- ✅ Top-level <header> is the banner; nested headers are just headers -->
```

### Footer
**What it is:** Bottom section with copyright, legal links, secondary navigation.
**ARIA pattern:** `<footer>` landmark (or `role="contentinfo"`).
**Common mistakes:**
```html
<!-- ❌ Same issue as Header — <footer> inside <article> isn't contentinfo -->
<!-- ✅ Keep the site-wide footer as a direct child of <body> -->
```

### Divider / Separator
**What it is:** A visual line separating sections of content.
**ARIA pattern:** `role="separator"`. If purely decorative, use `aria-hidden="true"`.
**Common mistakes:**
```html
<!-- ❌ Using <hr> inside a list or between every item — noisy for AT -->
<li>Item 1</li><hr /><li>Item 2</li>
<!-- ✅ Use CSS border/gap for visual separation; reserve <hr> for thematic breaks -->
```

### Grid / Layout Grid
**What it is:** A structural system for arranging content in columns and rows.
**Not to be confused with:** Data grid/table (interactive, keyboard-navigable data).
**Common mistakes:**
```html
<!-- ❌ Using role="grid" for a CSS layout grid — grid role implies
     interactive cells with arrow-key navigation -->
<div role="grid" class="card-grid">…</div>
<!-- ✅ Layout grids need no ARIA role — they're purely visual structure -->
<div class="card-grid">…</div>
```
