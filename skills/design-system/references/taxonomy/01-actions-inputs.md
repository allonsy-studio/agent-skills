# Actions & Inputs

### Button
**What it is:** Triggers an action (submit, toggle, navigate).
**Variants:** Primary, secondary, tertiary/ghost, destructive, icon-only, split button, toggle button.
**Content model:** A button's content is text, an icon, or both. Icons are content — not a separate component. An icon-only button is a variant, not a different pattern. When a button contains only an icon, it requires an accessible label (`aria-label` or visually hidden text) because there's no visible text to serve as the name.
**Not to be confused with:** Link (navigates without side effects), Tag/Chip (displays metadata, may be dismissible but isn't primarily an action trigger).
**ARIA pattern:** `button` (native `<button>` preferred).
**Common mistakes:**
```html
<!-- ❌ Using <div> or <a> as a button -->
<div class="btn" onclick="save()">Save</div>
<!-- ✅ Use native <button> — free keyboard, focus, and form semantics -->
<button type="button" onclick="save()">Save</button>

<!-- ❌ Icon-only button with no accessible name -->
<button><svg class="icon-trash"></svg></button>
<!-- ✅ Add a label for AT -->
<button aria-label="Delete item"><svg class="icon-trash" aria-hidden="true"></svg></button>

<!-- ❌ type defaults to "submit" — accidental form submissions -->
<button>Cancel</button>
<!-- ✅ Explicit type="button" when not submitting a form -->
<button type="button">Cancel</button>
```

### Link
**What it is:** Navigates to a resource — another page, an anchor, or a file.
**Variants:** Inline, standalone, with icon, external (opens new window).
**Content model:** Like buttons, links can contain text, an icon, or both. An icon-only link needs an accessible label just like an icon-only button. Icons placed inside links are content — they don't change the component's identity.
**Not to be confused with:** Button (triggers action, not navigation). If it looks like a button but navigates, it's still a link semantically.
**ARIA pattern:** Native `<a href>`.
**Common mistakes:**
```html
<!-- ❌ Link with no href — not keyboard-focusable or announced as link -->
<a onclick="goto('/settings')">Settings</a>
<!-- ✅ Always include href; use button if there's no URL -->
<a href="/settings">Settings</a>

<!-- ❌ "Click here" / "Read more" — ambiguous out of context -->
<a href="/report">Click here</a>
<!-- ✅ Descriptive link text -->
<a href="/report">View the Q4 report</a>

<!-- ❌ External link with no warning -->
<a href="https://external.com" target="_blank">Docs</a>
<!-- ✅ Announce the behavior + prevent opener tabnabbing -->
<a href="https://external.com" target="_blank" rel="noopener noreferrer">
  Docs <span class="visually-hidden">(opens in new tab)</span>
</a>
```
