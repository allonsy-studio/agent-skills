# Utilities

### Visually Hidden
**What it is:** Not a visible component — a CSS utility that hides content visually but keeps it accessible to screen readers.
**Implementation:** `.visually-hidden { clip: rect(0,0,0,0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px; }`
**Common mistakes:**
```css
/* ❌ Using display:none or visibility:hidden — hides from AT too */
.sr-only { display: none; }
/* ✅ The clip pattern hides visually while preserving AT access */
.visually-hidden {
  clip: rect(0,0,0,0); clip-path: inset(50%);
  height: 1px; overflow: hidden;
  position: absolute; white-space: nowrap; width: 1px;
}
```

### Skip Link
**What it is:** A link (usually the first focusable element) that jumps past navigation to main content.
**ARIA pattern:** Plain `<a href="#main-content">` that becomes visible on focus.
**Common mistakes:**
```html
<!-- ❌ Skip link target missing — link jumps nowhere -->
<a href="#main">Skip to content</a>
<!-- …but no element with id="main" exists -->
<!-- ✅ Ensure the target exists and is focusable -->
<a href="#main-content" class="skip-link">Skip to content</a>
…
<main id="main-content" tabindex="-1">…</main>
```

### Live Region
**What it is:** Not a visible component — an ARIA mechanism for announcing dynamic content changes.
**Variants:** `aria-live="polite"` (waits for current speech), `aria-live="assertive"` (interrupts).
**Common mistakes:**
```html
<!-- ❌ Adding aria-live AND content at the same time — AT misses the first announcement -->
document.body.innerHTML += '<div aria-live="polite">3 results</div>';
<!-- ✅ The live region container must exist BEFORE content is injected -->
<div aria-live="polite" id="status"></div>
<script>document.getElementById('status').textContent = '3 results';</script>

<!-- ❌ Using aria-live="assertive" for routine updates — interrupts the user constantly -->
<!-- ✅ Reserve assertive for genuine errors/alerts; use polite for status updates -->
```
