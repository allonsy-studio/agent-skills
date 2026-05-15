# Form Controls

## Text Input / Text Field
**What it is:** A single-line text entry field.
**Variants:** With prefix/suffix, with clear button, with character count, masked (password).
**ARIA pattern:** Native `<input>` with `<label>`. Error messages linked via `aria-describedby`. Required state via `aria-required` or `required`.
**Common mistakes:**
```html
<!-- ❌ Placeholder as label — disappears on input, fails AT -->
<input placeholder="Email address" />
<!-- ✅ Always use a real <label> -->
<label for="email">Email address</label>
<input id="email" type="email" />

<!-- ❌ Error message not linked to input — AT users don't hear it -->
<input id="email" /><span class="error">Invalid email</span>
<!-- ✅ Link via aria-describedby -->
<input id="email" aria-describedby="email-err" aria-invalid="true" />
<span id="email-err" class="error">Invalid email</span>
```

### Textarea
**What it is:** A multi-line text entry field.
**Variants:** Auto-growing, with character count.
**ARIA pattern:** Native `<textarea>` with `<label>`.
**Common mistakes:**
```html
<!-- ❌ Auto-growing textarea that jumps layout on every keystroke -->
<!-- ✅ Use a CSS field-sizing: content (if supported) or debounce
     the resize calculation. Set a max-height to avoid infinite growth. -->

<!-- ❌ Character count not exposed to AT -->
<textarea></textarea><span>42/280</span>
<!-- ✅ Link via aria-describedby; update a live region on approach to limit -->
<textarea aria-describedby="char-count"></textarea>
<span id="char-count" aria-live="polite">42 of 280 characters</span>
```

### Select
**What it is:** A dropdown to choose one value from a list.
**Variants:** Native (`<select>`), custom-styled, with search/filter (→ becomes a combobox).
**Key concern:** Custom selects are notoriously hard to make accessible. Prefer native `<select>` unless you need features it can't provide.
**ARIA pattern:** Native `<select>` or `role="listbox"` with `role="option"`.
**Common mistakes:**
```html
<!-- ❌ Custom select built from divs — loses keyboard nav, AT pairing -->
<div class="select" onclick="toggleDropdown()">
  <span>Choose…</span>
  <div class="options"><div class="option">…</div></div>
</div>
<!-- ✅ Start with native <select>; only go custom if you need search/multi-select -->
<label for="plan">Plan</label>
<select id="plan"><option>Free</option><option>Pro</option></select>
```

### Combobox
**What it is:** An input combining a text field with a filterable list of options.
**Variants:** Autocomplete (suggests matches), autosuggest (searches as you type), multi-select combobox.
**ARIA pattern:** `role="combobox"` with `aria-expanded`, `aria-controls` pointing to a `listbox`, `aria-activedescendant` for virtual focus.
**Common mistakes:**
```html
<!-- ❌ Moving DOM focus to each option — breaks typing mid-filter -->
listItem.focus(); // User loses cursor position in the input
<!-- ✅ Use aria-activedescendant — DOM focus stays on the input -->
input.setAttribute('aria-activedescendant', 'opt-3');

<!-- ❌ No result count announcement — AT users type into the void -->
<!-- ✅ Update an aria-live region with result count, debounced ~150ms -->
<div role="status" aria-live="polite" class="visually-hidden">3 results</div>
```

### Checkbox
**What it is:** A toggle for a binary choice, or one option in a multi-select group.
**Variants:** Single, group, indeterminate (tri-state for "select all" scenarios).
**ARIA pattern:** Native `<input type="checkbox">` with `<label>`. Indeterminate state set via JS (`el.indeterminate = true`) and `aria-checked="mixed"`.
**Common mistakes:**
```html
<!-- ❌ Custom checkbox with div + click handler — no keyboard, no label -->
<div class="checkbox" onclick="toggle()">✓</div> Accept terms
<!-- ✅ Native checkbox -->
<label><input type="checkbox" /> Accept terms</label>

<!-- ❌ "Select all" checkbox with no indeterminate state when partial -->
<!-- ✅ Set el.indeterminate = true and aria-checked="mixed" when
     some (but not all) items are checked -->
```

### Radio Button
**What it is:** One option in a single-select group.
**ARIA pattern:** Native `<input type="radio">` within a `<fieldset>` + `<legend>`. Arrow keys move selection within the group.
**Common mistakes:**
```html
<!-- ❌ Radio group with no fieldset — group label is missing -->
<input type="radio" name="size" /> Small
<input type="radio" name="size" /> Large
<!-- ✅ Wrap in fieldset with legend -->
<fieldset>
  <legend>Size</legend>
  <label><input type="radio" name="size" /> Small</label>
  <label><input type="radio" name="size" /> Large</label>
</fieldset>
```

### Toggle / Switch
**What it is:** An on/off control, visually resembling a physical switch.
**Not to be confused with:** Checkbox (semantically similar, but toggle implies an immediate state change — no form submission required).
**ARIA pattern:** `role="switch"` with `aria-checked`.
**Common mistakes:**
```html
<!-- ❌ Using a checkbox for an instant-effect toggle — confusing semantics -->
<input type="checkbox" /> Dark mode
<!-- ✅ Use role="switch" when the toggle takes effect immediately -->
<button role="switch" aria-checked="false">Dark mode</button>

<!-- ❌ Visual state changes but aria-checked doesn't update -->
<!-- ✅ Always sync aria-checked with the visual state -->
```

### Slider / Range
**What it is:** A draggable control for selecting a value within a range.
**Variants:** Single-thumb, dual-thumb (range), stepped, with tick marks.
**ARIA pattern:** `role="slider"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` (for human-readable value). Arrow keys adjust value.
**Common mistakes:**
```html
<!-- ❌ Slider announces raw number — "50" means nothing -->
<div role="slider" aria-valuenow="50">…</div>
<!-- ✅ Provide human-readable value text -->
<div role="slider" aria-valuenow="50" aria-valuetext="50%"
     aria-label="Volume">…</div>

<!-- ❌ Dual-thumb range with one slider — AT can't distinguish handles -->
<!-- ✅ Use two separate slider elements, each with its own label
     (e.g., "Minimum price" and "Maximum price") -->
```

### Datepicker
**What it is:** A specialized input for selecting a date, often with a calendar popup.
**Variants:** Single date, date range, with time, month/year picker.
**ARIA pattern:** Complex — typically `role="dialog"` for the calendar popup, `role="grid"` for the calendar grid, with extensive keyboard support (arrow keys navigate days, Page Up/Down navigate months).
**Common mistakes:**
```html
<!-- ❌ Blocking manual text input — some users prefer typing dates -->
<input type="text" readonly onclick="openCalendar()" />
<!-- ✅ Allow both keyboard entry and calendar picker -->
<input type="text" placeholder="MM/DD/YYYY" aria-describedby="date-hint" />
<button aria-label="Choose date" aria-expanded="false">📅</button>
<span id="date-hint" class="visually-hidden">Format: month/day/year</span>
```

### File Upload
**What it is:** An input for selecting files from the user's device.
**Variants:** Single file, multi-file, drag-and-drop zone, with preview.
**ARIA pattern:** Native `<input type="file">`. Drag-and-drop zones need `role="button"` or instruction text and keyboard alternatives.
**Common mistakes:**
```html
<!-- ❌ Drag-and-drop only — keyboard users can't upload -->
<div ondrop="handleDrop()" class="dropzone">Drop files here</div>
<!-- ✅ Always pair drag-and-drop with an input fallback -->
<div class="dropzone">
  <p>Drop files here or</p>
  <label for="upload" class="btn">Choose files</label>
  <input type="file" id="upload" multiple />
</div>
```

### Stepper / Number Input
**What it is:** A numeric input with increment/decrement buttons.
**ARIA pattern:** `role="spinbutton"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Or native `<input type="number">`.
**Common mistakes:**
```html
<!-- ❌ Increment/decrement buttons with no labels -->
<button>+</button><input type="text" value="1" /><button>-</button>
<!-- ✅ Label the buttons -->
<button aria-label="Decrease quantity">−</button>
<input type="number" value="1" aria-label="Quantity" min="1" max="99" />
<button aria-label="Increase quantity">+</button>
```
