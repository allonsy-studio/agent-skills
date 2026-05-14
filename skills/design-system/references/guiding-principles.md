# Guiding principles

These principles inform every recommendation in this skill. When you're
deciding between two approaches, lean toward whichever one better satisfies
these.

## 1. Lean on the browser

> Cross-link from `api-design.md` (native-first philosophy) and
> `accessibility-patterns.md` (ARIA-as-repair rules). This file is the
> single source of truth for the principle; the other two reference it.

Before adding JS behavior or ARIA attributes, check whether a native HTML
element or built-in browser feature already does the job:

- `<details>` is a disclosure widget.
- `<dialog>` handles modal focus trapping.
- A `<button>` doesn't need `role="button"`.
- Native input types (`type="email"`, `type="date"`, etc.) ship with
  validation, mobile keyboards, and screen-reader semantics.

Native elements give you keyboard handling, form participation, and
assistive-technology semantics for free — and they keep working when your
JavaScript fails. **ARIA is a repair tool for when HTML falls short, not a
first resort.**

For the spec-grade rules on when ARIA *is* warranted (and the five
WAI-ARIA "no ARIA is better than bad ARIA" rules), see
[`accessibility-patterns.md`](./accessibility-patterns.md).

## 2. Never shadow global HTML attributes

Component attribute names must not collide with HTML's global attributes
(`style`, `class`, `title`, `id`, `hidden`, `tabindex`, `lang`, `dir`,
`draggable`, etc.).

If a native attribute already does what you need, use it directly — don't
reinvent it under a prefixed name. If you need a different behavior, pick a
name that doesn't collide:

- Use `severity` instead of `type` for alert variants (since `type` is a
  native attribute on `<button>`, `<input>`, etc.).
- Use `variant` instead of `style` for visual variations.

See [`api-design.md`](./api-design.md) for the full collision checklist.

## 3. Name for recognition, not description

Component names should map to what users already know. "Accordion" beats
"CollapsibleSectionGroup" because the industry has converged on that term.
Check the taxonomy in
[`component-taxonomy.md`](./component-taxonomy.md) for established names.

## 4. Minimal, complete API

Expose what consumers need; hide what they don't. A component should be
useful with zero configuration but extensible for complex cases. Aim for a
small required-prop surface and a larger optional surface.

## 5. Accessibility is structural, not decorative

Accessibility is not something bolted on after the visual design — it's the
skeleton the component is built around. Start with the ARIA pattern, then
layer visuals on top.

## 6. Design tokens over hard-coded values

Components should consume tokens, not define raw colors or spacing. This
makes theming possible and keeps the system coherent. See
[`design-tokens.md`](./design-tokens.md) for token architecture.

## 7. Keyboard interaction is not optional

If it's interactive, it has a keyboard contract. This isn't just "add
tabindex" — it's focus management, arrow key navigation, roving tabindex
vs. active descendant, and escape-to-close behaviors. See
[`accessibility-patterns.md`](./accessibility-patterns.md) for the
per-pattern keyboard specs.

## 8. Internationalization from day one

Use CSS logical properties for content-flow values (text spacing, content
containers, borders that frame content) and physical properties for
viewport- or device-anchored values (fixed positioning, shadow offsets,
decorative chrome).

The heuristic: **logical when the value should follow the reader, physical
when it should follow the screen.**

Externalize all user-facing strings, handle text expansion, and test in
RTL. See [`i18n.md`](./i18n.md).
