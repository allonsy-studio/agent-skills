# Design Tokens

Design tokens are the single source of truth for the visual decisions in a
design system — colors, spacing, typography, elevation, motion, and more.
They're the bridge between what a designer decides and what an engineer
implements. When a designer says "primary button background should be
blue-600 in light mode and blue-400 in dark mode," the token is the
artifact that encodes that decision in a way both Figma and code can
consume.

This reference is for people responsible for defining, naming, organizing,
and maintaining tokens at scale. It's format-agnostic — the principles
apply whether your tokens live in JSON, YAML, a Figma plugin, or a
spreadsheet. Where format matters, examples show plain JSON with notes on
how the structure maps to common tooling.

---

## Table of contents

1. [What tokens are (and aren't)](#what-tokens-are-and-arent)
2. [Token tiers](#token-tiers)
3. [Naming grammar](#naming-grammar)
4. [Token categories](#token-categories)
5. [Themes and modes](#themes-and-modes)
6. [Responsive and adaptive tokens](#responsive-and-adaptive-tokens)
7. [Token lifecycle](#token-lifecycle)
8. [Governance at scale](#governance-at-scale)
9. [Cross-platform output](#cross-platform-output)
10. [Bridging design tools and code](#bridging-design-tools-and-code)
11. [Common mistakes](#common-mistakes)

---

## What tokens are (and aren't)

### Tokens are named decisions

A token is a name attached to a value, along with enough context to know
when and why to use it. The name carries meaning — it tells you something
the raw value cannot.

`#2563eb` means nothing.
`color-primary-500` tells you it's a shade in the primary palette.
`color-action-default` tells you it's the color for interactive elements
in their resting state.

Each of those is progressively more useful because each encodes more
intent.

### Tokens are not variables

CSS custom properties, Sass variables, and JSON key-value pairs are all
*formats* tokens can be expressed in. The token itself is the decision:
"interactive elements in their default state use this color." The format
is just how you ship that decision to a platform.

### Tokens are not styles

A token holds a single value (a color, a number, a font name). A style
or "type style" or "effect style" is a composite — a bundle of tokens
applied together (`font-size` + `line-height` + `font-weight` +
`letter-spacing`). Tokens are atoms; styles are molecules. Your system
needs both, and they're managed differently.

---

## Token tiers

Tokens work in layers. Each tier adds meaning and narrows the context.
Getting the tiers right is the most important structural decision in your
token system — it determines how flexible theming is, how easy maintenance
is, and how much damage a breaking change can do.

### Tier 1: Global tokens (primitives)

Raw values, named for what they are. These are the palette — every color,
every spacing step, every font weight the system recognizes.

```json
{
  "color": {
    "blue": {
      "100": { "value": "#dbeafe" },
      "200": { "value": "#bfdbfe" },
      "500": { "value": "#3b82f6" },
      "600": { "value": "#2563eb" },
      "900": { "value": "#1e3a8a" }
    },
    "neutral": {
      "0": { "value": "#ffffff" },
      "50": { "value": "#f9fafb" },
      "900": { "value": "#111827" },
      "1000": { "value": "#000000" }
    }
  },
  "spacing": {
    "1": { "value": "4px" },
    "2": { "value": "8px" },
    "4": { "value": "16px" },
    "6": { "value": "24px" },
    "8": { "value": "32px" }
  }
}
```

**Rules for global tokens:**
- Name them for what they are, not what they're for
- They're the raw material — exhaustive but not prescriptive
- Consumers should rarely reference global tokens directly (there are
  exceptions — more on that below)
- Changes here cascade everywhere, so extend carefully

### Tier 2: Alias tokens (semantic / contextual)

Map global values to purposes. These are the tokens most consumers
actually use. They answer the question "what color should interactive
things be?" rather than "what shade of blue is this?"

```json
{
  "color": {
    "action": {
      "default": { "value": "{color.blue.600}" },
      "hover": { "value": "{color.blue.700}" },
      "disabled": { "value": "{color.neutral.300}" }
    },
    "surface": {
      "default": { "value": "{color.neutral.0}" },
      "subtle": { "value": "{color.neutral.50}" },
      "inverse": { "value": "{color.neutral.900}" }
    },
    "text": {
      "default": { "value": "{color.neutral.900}" },
      "subtle": { "value": "{color.neutral.500}" },
      "on-action": { "value": "{color.neutral.0}" },
      "on-inverse": { "value": "{color.neutral.0}" }
    },
    "border": {
      "default": { "value": "{color.neutral.200}" },
      "strong": { "value": "{color.neutral.400}" }
    },
    "feedback": {
      "error": { "value": "{color.red.600}" },
      "success": { "value": "{color.green.600}" },
      "warning": { "value": "{color.amber.500}" },
      "info": { "value": "{color.blue.600}" }
    }
  },
  "spacing": {
    "component": {
      "xs": { "value": "{spacing.1}" },
      "sm": { "value": "{spacing.2}" },
      "md": { "value": "{spacing.4}" },
      "lg": { "value": "{spacing.6}" },
      "xl": { "value": "{spacing.8}" }
    }
  }
}
```

**Rules for alias tokens:**
- Name them for what they mean, not what they look like
- Every alias must reference a global token (never a raw value)
- This is the theming layer — swapping alias values is how you implement
  dark mode, brand themes, and high-contrast modes
- When two alias tokens have the same value, that's fine — they might
  diverge in a future theme

### Tier 3: Component tokens

Scope alias tokens to a specific component. These exist for one reason:
to give consumers a stable knob to customize a specific component without
understanding the broader alias system.

```json
{
  "button": {
    "bg": { "value": "{color.action.default}" },
    "bg-hover": { "value": "{color.action.hover}" },
    "bg-disabled": { "value": "{color.action.disabled}" },
    "text": { "value": "{color.text.on-action}" },
    "padding-x": { "value": "{spacing.component.md}" },
    "padding-y": { "value": "{spacing.component.sm}" },
    "radius": { "value": "{radius.md}" },
    "font-size": { "value": "{font-size.body-sm}" }
  }
}
```

**Rules for component tokens:**
- Every component token references an alias token (never a global)
- Only create component tokens for values that consumers might reasonably
  want to override — don't tokenize every internal CSS property
- The naming convention should follow the pattern from
  `references/api-design.md`:
  `--{prefix}-{component}-{element}-{property}-{variant}-{state}`
- Component tokens are the most volatile tier — they change when
  components are redesigned

### When to skip tiers

Not every token needs all three tiers. A spacing token used in one place
doesn't need a component alias just for formality. The tiers exist to
manage complexity — use them where the complexity exists.

A small system (under 10 components) might survive on just global + alias.
A large system (50+ components across multiple products) probably needs
all three, plus discipline about when to create new ones.

---

## Naming grammar

### The anatomy of a token name

A good token name reads like a path from broad to narrow:

```
{category}-{concept}-{property}-{variant}-{state}
```

Not every segment is always present. Include only what's needed for
clarity:

| Token                          | Category | Concept  | Property | Variant | State   |
| ------------------------------ | -------- | -------- | -------- | ------- | ------- |
| `color-action-default`         | color    | action   | —        | —       | default |
| `color-action-hover`           | color    | action   | —        | —       | hover   |
| `color-text-on-action`         | color    | text     | —        | —       | —       |
| `spacing-component-md`         | spacing  | component| —        | md      | —       |
| `font-size-heading-lg`         | font-size| heading  | —        | lg      | —       |
| `shadow-elevation-md`          | shadow   | elevation| —        | md      | —       |
| `button-bg-primary-hover`      | —        | button   | bg       | primary | hover   |

### Naming principles

**1. Consistent category prefixes.** Every token starts with its category
unless it's a component token (which starts with the component name):

Categories: `color`, `spacing`, `font-size`, `font-weight`, `font-family`,
`line-height`, `letter-spacing`, `radius`, `shadow`, `border-width`,
`opacity`, `duration`, `easing`, `z-index`

**2. Alphabetical scanability.** Names should sort well. Put the most
important differentiator first. `color-action-hover` sorts next to
`color-action-default` — good. `hover-color-action` scatters related
tokens — bad.

**3. Mutually exclusive states.** If a token has a `-hover` variant,
define the full state set: `default`, `hover`, `active`, `focus`,
`disabled`. Don't leave gaps — missing states force consumers to invent
ad-hoc values.

**4. No raw values in names.** `color-blue-600` is a global token name
(it describes the value). `color-action-default` is an alias (it
describes the use). Never put raw values in alias or component token
names — `button-bg-2563eb` is meaningless.

**5. Delimiter consistency.** Pick one: hyphens (`color-action-default`),
dots (`color.action.default`), or slashes (`color/action/default`). Many
token tools use dots internally and transform to platform-appropriate
formats on output. What matters is that your canonical source uses one
convention and you document the output mapping.

### Scale naming

Scales (color ramps, spacing steps, font sizes) need a consistent
numeric or t-shirt naming convention:

**Numeric scale (recommended for color and spacing):**
`100, 200, 300, 400, 500, 600, 700, 800, 900`

Leaves room for insertion (`150`, `550`) without renaming. Don't use
simple sequential numbers (`1, 2, 3`) — they leave no room between steps.

**T-shirt scale (acceptable for semantic aliases):**
`xs, sm, md, lg, xl, 2xl, 3xl`

Easy to understand but hard to extend beyond `3xl` without looking silly.
Good for spacing and radius; awkward for color.

**Semantic names (recommended for typography):**
`caption, body-sm, body, heading-sm, heading-md, heading-lg, display`

Best when the set is small and stable, and each step has a distinct purpose.

---

## Token categories

### Color

The largest and most complex category. Organize by usage context, not by
hue:

**Global tier:** organized by hue and shade
(`blue-100` through `blue-900`, `neutral-0` through `neutral-1000`)

**Alias tier:** organized by role:
- `color-action-*` — interactive elements (buttons, links, focus rings)
- `color-surface-*` — backgrounds (page, card, sidebar, overlay)
- `color-text-*` — text and icons on surfaces
- `color-border-*` — borders and dividers
- `color-feedback-*` — error, success, warning, info
- `color-decorative-*` — brand accents, illustrations (if applicable)

Every alias color token should have a clear relationship to a surface.
`color-text-default` is the text color for `color-surface-default`.
`color-text-on-action` is the text color for `color-action-default`.
This pairing is how you guarantee contrast.

### Spacing

A constrained scale based on a base unit (typically 4px or 8px):

```
spacing-0:  0
spacing-1:  4px
spacing-2:  8px
spacing-3:  12px
spacing-4:  16px
spacing-6:  24px
spacing-8:  32px
spacing-10: 40px
spacing-12: 48px
spacing-16: 64px
```

Alias layer maps these to usage:
- `spacing-component-*` — internal padding and gaps within components
- `spacing-layout-*` — gaps between components, section margins
- `spacing-inset-*` — padding inside containers (can be a symmetric
  shorthand or separate inline/block values)

### Typography

Type tokens usually span multiple CSS properties. Organize as individual
tokens that can be composed:

```
font-family-sans, font-family-serif, font-family-mono
font-size-{scale}
font-weight-regular, font-weight-medium, font-weight-semibold, font-weight-bold
line-height-tight, line-height-normal, line-height-relaxed
letter-spacing-tight, letter-spacing-normal, letter-spacing-wide
```

Then define composite "type styles" that bundle these (see
`references/typography.md` for the full architecture). Type styles are
not tokens themselves — they're recipes that reference tokens.

### Elevation / Shadow

Shadows encode depth. Define as a scale:

```
shadow-none:  none
shadow-xs:    0 1px 2px rgba(0,0,0,0.05)
shadow-sm:    0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
shadow-md:    0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)
shadow-lg:    0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
shadow-xl:    0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)
```

Shadow colors should reference color tokens so they adapt in dark mode:

```
shadow-color: {color.neutral.1000}  (with alpha applied per step)
```

### Border radius

```
radius-none: 0
radius-sm:   2px
radius-md:   4px (or 0.25rem)
radius-lg:   8px
radius-xl:   12px
radius-full: 9999px  (pill shape)
```

### Motion

Duration and easing tokens control animation:

```
duration-instant:  0ms
duration-fast:     100ms
duration-normal:   200ms
duration-slow:     400ms
duration-slower:   600ms

easing-default:    cubic-bezier(0.4, 0, 0.2, 1)
easing-in:         cubic-bezier(0.4, 0, 1, 1)
easing-out:        cubic-bezier(0, 0, 0.2, 1)
easing-spring:     cubic-bezier(0.175, 0.885, 0.32, 1.275)
```

These should be paired with `prefers-reduced-motion` behavior at the
component level (see `references/accessibility-patterns.md`), but the
token defines the *default* duration — the component decides whether to
use it or set it to `0ms` under reduced motion.

### Z-index

Z-index tokens prevent the "z-index: 99999" arms race:

```
z-index-base:     0
z-index-dropdown: 1000
z-index-sticky:   1100
z-index-overlay:  1300
z-index-modal:    1400
z-index-popover:  1500
z-index-toast:    1600
z-index-tooltip:  1700
```

Leave large gaps between steps. Teams *will* need to insert layers you
didn't anticipate.

### Opacity

```
opacity-0:    0
opacity-25:   0.25
opacity-50:   0.5
opacity-75:   0.75
opacity-100:  1
```

Often used for disabled states, overlays, and skeleton loading.

---

## Themes and modes

### What "theming" means in a token system

A theme is a set of alias-tier value overrides applied to the same token
names. The names don't change — the values behind them do.

```
Light mode:
  color-surface-default  → #ffffff
  color-text-default     → #111827

Dark mode:
  color-surface-default  → #1f2937
  color-text-default     → #f9fafb
```

Components reference `color-surface-default` and `color-text-default`.
When the theme switches, the output changes, and no component code is
touched.

### Modes vs. themes

A helpful distinction:

**Themes** are brand-level: "Acme Corp" vs. "Beta Product" vs. "Partner
White Label." They change the global palette entirely — different primary
color, different typography, different personality.

**Modes** are context-level within a theme: light/dark, high contrast,
compact/comfortable density. They change alias values but use the same
global palette.

In practice, this means:
- Global tokens differ between **themes** (Acme uses blue, Beta uses teal)
- Alias tokens differ between **modes** (light mode maps `surface-default`
  to white, dark mode maps it to gray-900)
- Component tokens generally stay the same across both (they reference
  aliases, and aliases resolve differently per theme and mode)

### Implementing dark mode via tokens

Dark mode is an alias-tier override, not a global-tier change. The same
blue-600 might be used in both light and dark mode — what changes is which
alias points to it.

```
Light:
  color-action-default → {color.blue.600}
  color-surface-default → {color.neutral.0}
  color-text-default → {color.neutral.900}

Dark:
  color-action-default → {color.blue.400}    ← lighter shade for contrast
  color-surface-default → {color.neutral.900}
  color-text-default → {color.neutral.50}
```

Key decisions for dark mode:
- **Don't just invert.** Pure inversion (white→black, black→white)
  produces harsh contrast. Dark mode surfaces should be dark gray, not
  pure black. Text should be slightly off-white, not pure white.
- **Shadows become less effective.** In dark mode, shadows are barely
  visible against dark backgrounds. Consider using subtle border or
  surface-color differentiation for elevation instead.
- **Verify contrast at every level.** A color pair that passes WCAG AA
  in light mode might fail in dark mode. Test alias pairs, not
  individual colors.
- **Saturated colors need adjustment.** Fully saturated hues (blue-600)
  on dark backgrounds can vibrate or feel heavy. Lighter, slightly
  desaturated variants (blue-400, blue-300) often work better.

### High contrast mode

Beyond OS-level forced colors (which override your tokens entirely —
see `references/accessibility-patterns.md`), your system can offer a
high-contrast theme that's designed:

```
High contrast:
  color-action-default → {color.blue.800}     ← darker for stronger contrast
  color-text-default → {color.neutral.1000}   ← pure black
  color-surface-default → {color.neutral.0}   ← pure white
  color-border-default → {color.neutral.700}  ← much stronger border
  border-width-default → 2px                  ← thicker borders
```

### Density modes

For data-heavy applications, a compact density mode reduces spacing:

```
Comfortable:
  spacing-component-sm → {spacing.2}    (8px)
  spacing-component-md → {spacing.4}    (16px)

Compact:
  spacing-component-sm → {spacing.1}    (4px)
  spacing-component-md → {spacing.2}    (8px)
```

Document minimum touch target sizes (see `references/accessibility-patterns.md`)
as a floor that density modes must not breach.

---

## Responsive and adaptive tokens

### When token values should change with viewport

Most tokens are static — `color-action-default` is the same at 320px and
2560px. But some values, particularly spacing and typography, may need to
adapt.

**Approach 1: Responsive alias overrides.** Define alias tokens that
change at breakpoints:

```css
:root {
  --ds-spacing-layout-lg: 24px;
  --ds-font-size-display: 2rem;
}

@media (min-width: 768px) {
  :root {
    --ds-spacing-layout-lg: 48px;
    --ds-font-size-display: 3rem;
  }
}
```

**Approach 2: Fluid values in the token.** Use `clamp()` so the token
itself is responsive (see `references/typography.md` for type-specific
guidance):

```json
{
  "font-size": {
    "display": { "value": "clamp(2rem, 1.5rem + 2vw, 3.5rem)" }
  }
}
```

**Approach 3: Separate token sets per breakpoint.** Ship distinct sets
(`tokens-mobile.css`, `tokens-desktop.css`) loaded conditionally. More
control, more complexity.

For most systems, approach 1 or 2 for typography and layout spacing is
sufficient. Don't make colors or border-radius responsive — it adds
complexity without clear benefit.

---

## Token lifecycle

### Creating a new token

Before creating a token, ask:

1. **Does this decision already have a token?** Search existing tokens.
   Duplicate tokens with different names are a maintenance hazard.
2. **Is this value used in more than one place?** A one-off value used
   in a single component might not need a token — a local CSS value is
   fine. Tokenize when the value represents a system-level decision.
3. **At which tier does it belong?** If it's a raw value (a color hex,
   a pixel size), it's global. If it maps a raw value to a purpose, it's
   alias. If it scopes an alias to a component, it's component-tier.
4. **Can you name it without referencing its current value?** If the best
   name you can think of is `color-blue-for-buttons`, the token is
   at the wrong tier — that's a global value being used as an alias.
   Rename to `color-action-default`.

### Deprecating a token

Tokens get used in places you can't see — other teams' codebases, Figma
files, documentation. Removing a token without warning breaks things
silently.

**Deprecation process:**
1. **Mark as deprecated** in the token source with a reason and
   replacement:
   ```json
   {
     "color-primary": {
       "value": "{color.blue.600}",
       "deprecated": true,
       "deprecated-comment": "Use color-action-default instead. Will be removed in v4.0."
     }
   }
   ```
2. **Keep shipping the token** for at least one major version. It should
   still resolve to a value — it just also emits a warning.
3. **Emit build warnings** in consuming projects. If your tooling
   supports it, output a console warning or build-log message when a
   deprecated token is referenced.
4. **Remove in the next major version** after the deprecation notice has
   been live for a full release cycle.

### Versioning tokens

Tokens are an API. Treat changes with the same rigor as code API changes:

- **Patch:** fix a value that was wrong (a color that didn't meet
  contrast, a shadow that was missing a layer). No name changes.
- **Minor:** add new tokens. No removals, no renames, no value changes
  that alter visual output.
- **Major:** remove tokens, rename tokens, or change values in ways that
  intentionally alter visual output across consumers.

---

## Governance at scale

### Who owns tokens?

In a large organization, token ownership typically splits:

- **Global tokens:** owned by the design system team. Changes are rare
  and high-impact.
- **Alias tokens:** owned by the design system team, with input from
  product designers. This is where most theming and brand decisions
  land.
- **Component tokens:** co-owned by the design system team and the
  engineers who build the component. Created when consumers need an
  override hook.

### Contribution model

Define a lightweight process for requesting new tokens:

1. **Requester describes the use case:** "I need a background color for
   selected rows in data tables."
2. **Token team evaluates:** does an existing token cover this? (Often
   `color-surface-selected` or `color-action-subtle` already exists and
   the requester didn't find it.) If not, is the need generic enough to
   warrant a system token, or is it a one-off?
3. **If approved:** token team proposes a name, tier placement, and value.
   Requester validates the value works in their context. Token is added.
4. **If rejected:** document why. "Use `color-surface-subtle` for this
   case" or "this is too specific — use a local CSS custom property in
   your component."

### Naming audits

Periodically audit your token set for:

- **Synonyms:** `color-bg-primary` and `color-surface-action` that mean
  the same thing. Consolidate.
- **Orphans:** tokens no one references. Either they're serving an edge
  case you forgot about, or they can be deprecated.
- **Naming inconsistencies:** `color-action-hover` but
  `color-feedback-error-bg` (one uses state suffix, the other buries
  "bg" in the name). Standardize.
- **Tier violations:** alias tokens referencing raw values instead of
  globals. Component tokens referencing globals instead of aliases.

### Documentation

Every token should be documented with:
- **Name**
- **Value** (and what it resolves to at each tier)
- **Description:** one sentence explaining when to use it
- **Tier:** global, alias, or component
- **Category:** color, spacing, typography, etc.
- **Related tokens:** tokens commonly used together
  (`color-action-default` is related to `color-text-on-action`)
- **Preview:** a visual swatch or rendered example

---

## Cross-platform output

### Tokens are platform-agnostic at the source

The canonical token definition is a structured data file — not a CSS file,
not a Swift file, not an XML file. It's the thing those files are
generated *from*.

Common output targets:

| Platform      | Format                                  | Example                                           |
| ------------- | --------------------------------------- | ------------------------------------------------- |
| Web (CSS)     | Custom properties                       | `--ds-color-action-default: #2563eb;`             |
| Web (Sass)    | Variables                               | `$ds-color-action-default: #2563eb;`              |
| Web (JS/TS)   | Module export                           | `export const colorActionDefault = '#2563eb';`    |
| iOS (Swift)   | Asset catalog or extension              | `Color.actionDefault`                             |
| Android       | XML resources or Compose                | `<color name="ds_color_action_default">#2563eb</color>` |
| Figma         | Variables                               | `color/action/default` in the variables panel     |

The key insight: the token name and value are the same across platforms.
Only the *format* changes. A build step transforms your source tokens into
each platform's native format. What tool you use for that build step is
an implementation choice — what matters is that the source is
authoritative and platform-neutral.

### Name transformation

Different platforms have different naming conventions. Your build step
should handle this automatically:

```
Source:          color-action-default
CSS:             --ds-color-action-default
Sass:            $ds-color-action-default
JS:              colorActionDefault
Swift:           Color.actionDefault
Android XML:     ds_color_action_default
Figma:           color/action/default
```

Document the transformation rules so engineers know how to find the token
on their platform given the canonical name.

### Platform-specific value adjustments

Some values need platform-specific transformations:

- **Color format:** CSS uses hex or `oklch()`, iOS uses `UIColor` /
  `Color` with 0–1 ranges, Android uses 8-digit hex (AARRGGBB)
- **Spacing units:** CSS uses `rem` or `px`, iOS uses points, Android
  uses `dp`
- **Typography:** CSS uses `font-family` + `font-size` + etc., iOS uses
  `UIFont` descriptors, Android uses `TextAppearance` styles

The *value* changes but the *decision* is the same. A spacing token of
"16px" in CSS is "16pt" in iOS and "16dp" in Android — visually
equivalent, formatted differently.

---

## Bridging design tools and code

### Single source of truth

The hardest operational problem in token management is keeping design tools
and code in sync. Two approaches:

**Design-to-code:** designers manage tokens in Figma (or similar), and a
build step exports them to code. Works well for small teams where
designers drive visual decisions and engineers consume them.

**Code-to-design:** engineers manage tokens in a structured data file, and
a sync tool pushes them to Figma. Works well for large systems where
tokens are versioned, reviewed in PRs, and need the same change management
as code.

**Neither is wrong.** What's wrong is having two sources of truth. If
Figma says `action-default` is `#2563eb` and the codebase says it's
`#1d4ed8`, someone is painting the wrong blue and nobody will notice
until QA.

Pick one authoritative source. Sync to the other. Automate the sync.

### Token documentation as a shared artifact

Your token documentation should be the artifact both designers and
engineers reference. It should:

- Show every token with a visual preview (color swatch, spacing
  visualization, type specimen)
- Be searchable by name, value, and category
- Indicate which tier each token lives in
- Show the computed value for each active theme/mode
- Flag deprecated tokens prominently
- Be generated from the token source (not manually maintained)

---

## Common mistakes

### 1. Over-tokenizing

Not every CSS value needs a token. A `gap: 2px` between two icon paths
inside a custom SVG sprite is not a system-level decision. Tokenize
decisions that cross component boundaries or that a theme might want to
change. Leave implementation details as local values.

**The test:** would changing this value in isolation make sense, or would
it always change as part of a broader update? If the latter, it's probably
not a token — it's a detail that follows from a token
(e.g., `calc(var(--ds-spacing-sm) / 2)`).

### 2. Under-aliasing

Having global tokens but no alias tier means every component references
`color-blue-600` directly. When the brand changes from blue to purple,
you're doing find-and-replace across every component. The alias tier
(`color-action-default → color-blue-600`) gives you one place to change.

### 3. Naming for current values

`color-dark-blue` is a name that's wrong the moment the value changes.
`color-action-default` is a name that survives any value change. Name
for the role, not the appearance.

### 4. Inconsistent state coverage

If `button-bg` has a `-hover` variant but not a `-disabled` variant,
some engineer will invent their own disabled color. Define the full state
matrix for any token that has states: `default`, `hover`, `active`,
`focus`, `disabled` at minimum.

### 5. Skipping the theme test

Before shipping a new token, verify it works across all active themes
and modes. A color that looks right in light mode and passes contrast
in light mode might fail in dark mode. Test the pairs, not the
individual values.

### 6. Treating tokens as "set and forget"

Tokens need the same maintenance as code. Schedule periodic audits
(quarterly works for most teams), review usage analytics if available,
and sunset tokens that no longer serve a purpose. A bloated token set
is almost as bad as no token set — it's confusing, overlapping, and
makes every decision harder.
