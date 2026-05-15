# Feedback & Status

## Alert / Notification
**What it is:** A prominent message informing the user of something important.
**Variants:** Inline (in the page flow), banner (full-width at top), toast (floating, auto-dismissing).
**ARIA pattern:** `role="alert"` for urgent messages (assertive), `role="status"` for polite updates.
**Common mistakes:**
```html
<!-- ❌ role="alert" on a container that exists at page load — AT reads it immediately -->
<div role="alert">Welcome!</div>
<!-- ✅ Inject the alert dynamically, or add role="alert" after the content is set -->

<!-- ❌ Using role="alert" for low-priority info — interrupts the user -->
<div role="alert">Your preferences have been saved.</div>
<!-- ✅ Use role="status" for non-urgent confirmations -->
<div role="status">Your preferences have been saved.</div>
```

### Toast
**What it is:** A brief, auto-dismissing notification that appears in a corner or edge.
**Key concerns:** Must be announced to screen readers (`role="status"` or live region). Auto-dismiss must be pausable (WCAG 2.2.1). Should include a dismiss button.
**ARIA pattern:** `role="status"` inside an `aria-live="polite"` region.
**Common mistakes:**
```html
<!-- ❌ Auto-dismiss with no way to pause — fails WCAG 2.2.1 -->
setTimeout(() => toast.remove(), 3000);
<!-- ✅ Pause on hover/focus, extend on keyboard interaction -->

<!-- ❌ Toast has action button but disappears before user can reach it -->
<!-- ✅ Toasts with actions should persist until dismissed, or at minimum
     pause the timer when focus enters the toast -->
```

### Banner
**What it is:** A page-level or app-level message, usually full-width at the top.
**Variants:** Informational, warning, error, success.
**ARIA pattern:** `role="alert"` or `role="status"` depending on urgency.
**Common mistakes:**
```html
<!-- ❌ Color alone distinguishes severity — fails WCAG 1.4.1 -->
<div class="banner-red">Error occurred</div>
<!-- ✅ Add an icon + text label alongside the color -->
<div class="banner-error" role="alert">
  <svg aria-hidden="true">…error icon…</svg>
  <strong>Error:</strong> Something went wrong.
</div>
```

### Progress Bar
**What it is:** Visualizes completion of a task — determinate (known percentage) or indeterminate.
**ARIA pattern:** `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`.
**Common mistakes:**
```html
<!-- ❌ Visual-only progress bar — AT sees nothing -->
<div class="progress"><div class="bar" style="width:60%"></div></div>
<!-- ✅ ARIA attributes expose the value -->
<div role="progressbar" aria-valuenow="60" aria-valuemin="0"
     aria-valuemax="100" aria-label="Upload progress">
  <div class="bar" style="width:60%"></div>
</div>
```

### Spinner / Loading
**What it is:** Indicates background activity when duration is unknown.
**Key concern:** Must announce loading state to screen readers (`role="status"` with descriptive text).
**ARIA pattern:** `role="status"` with `aria-live="polite"`, visually hidden text like "Loading…".
**Common mistakes:**
```html
<!-- ❌ CSS-only spinner with no text — AT reads nothing -->
<div class="spinner"></div>
<!-- ✅ Pair with visually hidden status text -->
<div role="status">
  <div class="spinner" aria-hidden="true"></div>
  <span class="visually-hidden">Loading…</span>
</div>
```

### Skeleton
**What it is:** Placeholder shapes mimicking the eventual content layout during loading.
**Key concern:** Often invisible to screen readers. Pair with an `aria-busy="true"` container and a live region announcing when content is ready.
**Common mistakes:**
```html
<!-- ❌ Skeleton replaces content silently — AT doesn't know content loaded -->
<div class="skeleton-card"></div>  <!-- becomes --> <div class="card">…</div>
<!-- ✅ Mark container as busy; announce when ready -->
<div aria-busy="true">…skeletons…</div>
<!-- When loaded: set aria-busy="false", update live region -->
```

### Badge
**What it is:** A small label near another element indicating status or count.
**Variants:** Status dot, count, text label.
**ARIA pattern:** If conveying important information, ensure it's in the accessible name or description of the parent element. Decorative badges can be `aria-hidden`.
**Common mistakes:**
```html
<!-- ❌ Badge count is visually present but not in the button's accessible name -->
<button>Inbox <span class="badge">5</span></button>
<!-- AT reads "Inbox" but not "5" -->
<!-- ✅ Include the count in the accessible name -->
<button>Inbox <span class="badge" aria-hidden="true">5</span>
  <span class="visually-hidden">5 unread messages</span>
</button>
```
