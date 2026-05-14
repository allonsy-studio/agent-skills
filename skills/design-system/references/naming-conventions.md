# Naming Conventions for Design System Components

Good component names are the difference between a system people adopt
willingly and one they fight against. A name is a component's primary
documentation — it's what appears in import statements, search results,
and team conversations. Get it right and everything downstream gets easier.

---

## Table of contents

1. [Core principles](#core-principles)
2. [Naming hierarchy: element → variant → state](#naming-hierarchy)
3. [Case conventions](#case-conventions)
4. [Common naming pitfalls](#common-naming-pitfalls)
5. [Name selection process](#name-selection-process)
6. [Cross-system name survey](#cross-system-name-survey)
7. [Prefixing and namespacing](#prefixing-and-namespacing)

---

## Core principles

### 1. Prefer established names over invented ones

The web UI community has converged on names for most common patterns. Using
those names means developers and designers already know what to expect when
they hear "accordion", "combobox", or "breadcrumbs".

Before inventing a name, check:
- The Component Gallery (component.gallery/components)
- WAI-ARIA Authoring Practices role names
- What Material, Spectrum, Carbon, Lightning, and Primer call it

If 4+ major systems use the same name, that name is correct by convention
even if you can think of a "better" one.

### 2. Name for function, not visual appearance

Bad: `SidePanel`, `FloatingBox`, `BlueBar`
Good: `Drawer`, `Popover`, `Toolbar`

Visual names break when the design changes. "SidePanel" stops making sense
when the same component appears at the bottom on mobile. Functional names
survive redesigns.

### 3. Name for what it IS, not what it DOES

Bad: `Expandable`, `Clickable`, `Filterable`
Good: `Accordion`, `Button`, `ComboBox`

"-able" suffixes describe behavior, which is a property of many components.
An accordion is expandable, but so is a tree view. Name the pattern, and the
behavior follows.

### 4. Single, unambiguous words where possible

Good: `Alert`, `Badge`, `Card`, `Modal`, `Toast`
Acceptable: `ProgressBar`, `DatePicker`, `FileUpload`
Avoid: `InformationalBannerNotification`, `CollapsibleSectionGroupWidget`

Compound names are fine when a single word would be ambiguous (is "Progress"
a bar or a stepper?), but keep them to two words maximum. Three-word names
are a sign you're over-specifying.

### 5. Avoid jargon that only your team understands

Internal codenames ("Sparky", "Cortex", "Nebula") might be fun but they
create a barrier for every new team member and every external contributor.
If you need internal shorthand, use it in conversation — not in the
component API.

---

## Naming hierarchy

Components exist at three levels, and naming conventions differ at each:

### Base component name
The core pattern: `Button`, `Modal`, `Tabs`.
This is the public-facing name in your system.

### Variants
Meaningful sub-types: `Button` → `IconButton`, `SplitButton`.
Use compound names or modifier props — pick one strategy and be consistent:
- **Compound name approach:** `IconButton`, `AlertDialog`, `InlineAlert`
- **Prop approach:** `<Button variant="icon">`, `<Alert inline>`

Most systems use a hybrid: separate components for structurally different
variants (IconButton has different markup from Button) and props for
stylistic variants (primary vs. secondary).

### States
Temporary conditions: `disabled`, `loading`, `error`, `expanded`.
States are almost always expressed as boolean props or attributes, never as
separate component names. There is no `DisabledButton` — there's
`<Button disabled>`.

---

## Case conventions

Pick one and enforce it across the entire system:

| Context              | Convention       | Example               |
| -------------------- | ---------------- | --------------------- |
| Web Component tag    | kebab-case       | `<my-button>`         |
| React/Vue component  | PascalCase       | `<MyButton>`          |
| CSS class (BEM)      | block__element   | `.button__icon`       |
| CSS class (utility)  | kebab-case       | `.text-sm`            |
| CSS custom property  | kebab-case       | `--button-bg`         |
| Design token         | kebab-case       | `color-primary-500`   |
| JS prop/attribute    | camelCase        | `isDisabled`          |
| HTML attribute       | kebab-case       | `is-disabled`         |

Web Components specifically require a hyphen in the tag name (custom element
spec). Use a consistent prefix: `ds-button`, `acme-modal`, etc.

---

## Common naming pitfalls

### The synonym trap
Don't have both `Alert` and `Notification` and `Message` in the same
system unless they are genuinely different patterns. If they are different,
document precisely how:
- `Alert`: Inline, in the page flow, demands attention
- `Toast`: Floating, auto-dismissing, non-blocking
- `Banner`: Full-width, page-level, persistent until dismissed

### The abstraction trap
`Container`, `Wrapper`, `Box`, `Block` — these names are so generic they
convey nothing. If you find yourself reaching for one, ask: what is this
container *for*? A `Card` is a container. A `Dialog` is a container. Name
the purpose, not the HTML structure.

### The inconsistency trap
If `DatePicker` is two words smushed together, `FileUpload` should be too
— not `FileUploader` or `Upload`. If your buttons are `PrimaryButton` and
`SecondaryButton`, your alerts should be `InfoAlert` and `ErrorAlert`, not
`InformationalAlertBanner`.

Choose patterns and apply them uniformly:
- Noun vs. verb: `FileUpload` vs. `FileUploader` — pick one
- Qualifier position: `InlineAlert` vs. `AlertInline` — pick one (prefix is
  more common and reads better in alphabetical lists)

### The false-precision trap
`SmallRoundedPrimaryActionButton` encodes visual design decisions into the
name. When the design changes, the name is wrong. Keep names semantic, push
visual variants to props and tokens.

---

## Name selection process

When naming a new component:

1. **Describe what it does** in one sentence: "A panel that slides in from
   the edge of the screen to show contextual content."

2. **Check the taxonomy** (`references/component-taxonomy.md`): this
   matches "Drawer".

3. **Cross-reference major systems**: Material calls it "Navigation drawer"
   or "Bottom sheet" (depending on behavior). Spectrum calls it "Tray".
   Carbon calls it "Side panel". Lightning calls it "Panel".

4. **Propose 2–3 candidates** with trade-off notes:
   - `Drawer` — most widely used term, clear metaphor
   - `Panel` — generic but recognizable, risk of confusion with other panel
     patterns
   - `Sheet` — emerging convention (iOS/Android), specifically for
     bottom-anchored variants

5. **Pick the one with the strongest ecosystem consensus** unless your
   system has a specific reason to deviate.

6. **Document the decision** — especially if you chose something
   unconventional. Future contributors will wonder why.

---

## Cross-system name survey

Common components and what major systems call them — use this to validate
your naming choices:

| Pattern        | Material       | Spectrum    | Carbon        | Lightning   | Primer       |
| -------------- | -------------- | ----------- | ------------- | ----------- | ------------ |
| Accordion      | Accordion      | Accordion   | Accordion     | Accordion   | —            |
| Alert          | Snackbar/Alert | Alert       | Notification  | Alert       | Flash        |
| Breadcrumbs    | Breadcrumbs    | Breadcrumbs | Breadcrumb    | Breadcrumb  | Breadcrumbs  |
| Button         | Button         | Button      | Button        | Button      | Button       |
| Card           | Card           | Card        | Tile          | Card        | Box          |
| Checkbox       | Checkbox       | Checkbox    | Checkbox      | Checkbox    | Checkbox     |
| Combobox       | Autocomplete   | Combobox    | ComboBox      | Combobox    | Autocomplete |
| Dialog/Modal   | Dialog         | Dialog      | Modal         | Modal       | Dialog       |
| Drawer         | Drawer         | Tray        | Side panel    | Panel       | —            |
| Dropdown       | Menu           | Picker      | Dropdown      | Menu        | ActionMenu   |
| Pagination     | Pagination     | —           | Pagination    | —           | Pagination   |
| Progress       | Progress       | ProgressBar | ProgressBar   | ProgressBar | ProgressBar  |
| Radio          | Radio          | Radio       | RadioButton   | Radio       | Radio        |
| Select         | Select         | Picker      | Select        | Combobox    | Select       |
| Slider         | Slider         | Slider      | Slider        | Slider      | —            |
| Switch/Toggle  | Switch         | Switch      | Toggle        | Toggle      | ToggleSwitch |
| Tabs           | Tabs           | Tabs        | Tabs          | Tabs        | UnderlineNav |
| Tag            | Chip           | Tag         | Tag           | Pill/Badge  | Label        |
| Toast          | Snackbar       | Toast       | Toast         | Toast       | Toast        |
| Tooltip        | Tooltip        | Tooltip     | Tooltip       | Tooltip     | Tooltip      |
| Tree View      | —              | —           | TreeView      | Tree        | TreeView     |

---

## Prefixing and namespacing

### Web Components: prefixing is mandatory
The custom element spec requires a hyphen. Use a consistent 2–4 character
prefix:
- Organization: `gh-button` (GitHub), `sl-button` (Shoelace)
- System name: `mwc-button` (Material Web Components)
- Generic: `ds-button` (design system)

### CSS: use a methodology
BEM, CUBE CSS, or a custom convention — pick one:
- BEM: `.ds-button`, `.ds-button--primary`, `.ds-button__icon`
- CUBE: `.button[data-variant="primary"]`
- Utility-first: composable classes, component names in wrapper

### React/Vue: prefixing is optional
Framework components are scoped by their import, so `Button` is fine — it
won't collide. But if your library is published as an npm package consumed
alongside other component libraries, consider a prefix: `DsButton`.
