# Typography in Design Systems

You're building type foundations for teams you may never meet, in products
you may never see. That means your typography system needs to survive being
used in a dense data dashboard, a marketing landing page, a native-feeling
mobile webview, and a right-to-left admin panel — without anyone calling
you to ask how.

This reference covers the decisions you need to make, the tokens you need
to ship, and the traps that won't show up until production.

---

## Table of contents

1. [Type scale architecture](#type-scale-architecture)
2. [Font stack strategy](#font-stack-strategy)
3. [Tokens for typography](#tokens-for-typography)
4. [Responsive type](#responsive-type)
5. [Vertical rhythm and spacing](#vertical-rhythm-and-spacing)
6. [Type in components](#type-in-components)
7. [Performance and loading](#performance-and-loading)
8. [Accessibility and readability](#accessibility-and-readability)
9. [Multi-script and variable font considerations](#multi-script-and-variable-font-considerations)

---

## Type scale architecture

### Choosing a scale

A type scale is a constrained set of font sizes that creates visual
hierarchy. Two approaches:

**Ratio-based scale** — each step is a fixed multiplier of the previous.
Common ratios:
- 1.125 (Major Second) — tight, good for data-heavy UIs
- 1.200 (Minor Third) — balanced, the most common choice
- 1.250 (Major Third) — pronounced hierarchy, good for editorial
- 1.333 (Perfect Fourth) — dramatic, marketing/hero-heavy

```
Base: 16px, Ratio: 1.25
→ 10.24, 12.80, 16.00, 20.00, 25.00, 31.25, 39.06
```

**Hand-tuned scale** — pick sizes that look right at each step, often
snapped to pixel grid or 4px baseline. More pragmatic, harder to extend.

```
→ 11, 12, 14, 16, 20, 24, 32, 40, 48
```

For a large org, a ratio-based scale with rounding to the nearest half-pixel
gives you mathematical consistency with visual predictability. Ship it as
tokens so consumers never do their own math.

### Scale naming

Avoid naming sizes after their pixel value (`font-16`) — it's a leaky
abstraction that breaks when the scale changes. Two workable approaches:

**T-shirt sizes:** `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`
- Pros: intuitive, widely understood
- Cons: hard to extend beyond 3xl, ambiguous midpoints

**Semantic roles:** `caption`, `body`, `body-lg`, `heading-sm`,
`heading-md`, `heading-lg`, `display`
- Pros: communicates intent, not just size
- Cons: can be rigid if a team needs a heading size for a non-heading
  context

**Hybrid (recommended for large systems):** ship both. Semantic aliases
point to scale steps:

```css
/* Scale tokens — the raw steps */
--ds-font-size-100: 0.75rem;   /* 12px */
--ds-font-size-200: 0.875rem;  /* 14px */
--ds-font-size-300: 1rem;      /* 16px */
--ds-font-size-400: 1.25rem;   /* 20px */
--ds-font-size-500: 1.5rem;    /* 24px */
--ds-font-size-600: 2rem;      /* 32px */
--ds-font-size-700: 2.5rem;    /* 40px */

/* Semantic aliases */
--ds-font-size-caption: var(--ds-font-size-100);
--ds-font-size-body-sm: var(--ds-font-size-200);
--ds-font-size-body: var(--ds-font-size-300);
--ds-font-size-heading-sm: var(--ds-font-size-400);
--ds-font-size-heading-md: var(--ds-font-size-500);
--ds-font-size-heading-lg: var(--ds-font-size-600);
--ds-font-size-display: var(--ds-font-size-700);
```

Teams use the semantic tokens. When the scale changes, you remap aliases
without touching any component code.

---

## Font stack strategy

### The cascade of risk

Every font you add is a network request, a licensing question, a FOUT/FOIT
decision, and a script-coverage assumption. You don't know if the consuming
team is on a fast corporate network or a 3G mobile hotspot.

**Recommended stack structure:**

```css
--ds-font-family-sans: 'Inter', 'Noto Sans', system-ui, -apple-system,
  BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
  sans-serif;

--ds-font-family-mono: 'JetBrains Mono', 'Noto Sans Mono', ui-monospace,
  SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
```

Key decisions to document:
- **Primary typeface** (`Inter` above): the brand-aligned choice. Must be
  licensed for web embedding.
- **Multilingual fallback** (`Noto Sans`): covers CJK, Arabic, Devanagari,
  and hundreds of other scripts. If your org operates in multiple locales,
  this is not optional.
- **System fallback chain**: makes the first paint fast and gives a
  reasonable experience if web fonts fail entirely.

### When to offer font-weight-only differentiation

Some products within the org might not be allowed to load custom fonts (CSP
restrictions, performance budgets, embedded contexts). Your system should
degrade gracefully:

```css
/* Headings are distinguished by weight and size, not just font-family */
.ds-heading {
  font-family: var(--ds-font-family-heading, var(--ds-font-family-sans));
  font-weight: var(--ds-font-weight-heading, 700);
}
```

If `--ds-font-family-heading` isn't set, headings still work — they just
use the same sans-serif as body with a heavier weight.

---

## Tokens for typography

### What to tokenize

Ship tokens for every typographic decision a consumer might need to
override:

```css
/* Family */
--ds-font-family-sans: ...;
--ds-font-family-serif: ...;
--ds-font-family-mono: ...;

/* Size (scale) */
--ds-font-size-{100–700}: ...;

/* Weight */
--ds-font-weight-regular: 400;
--ds-font-weight-medium: 500;
--ds-font-weight-semibold: 600;
--ds-font-weight-bold: 700;

/* Line height */
--ds-line-height-tight: 1.2;    /* headings */
--ds-line-height-normal: 1.5;   /* body text */
--ds-line-height-relaxed: 1.75; /* long-form reading */

/* Letter spacing */
--ds-letter-spacing-tight: -0.02em;  /* large headings */
--ds-letter-spacing-normal: 0;
--ds-letter-spacing-wide: 0.05em;    /* uppercase, captions */

/* Paragraph spacing */
--ds-paragraph-spacing: 1em;
```

### Composite type tokens

For large systems, consider shipping "type style" tokens that bundle size,
weight, line-height, and letter-spacing into a single reference:

```css
/* Define type styles as groups */
.ds-type-body {
  font-size: var(--ds-font-size-300);
  line-height: var(--ds-line-height-normal);
  font-weight: var(--ds-font-weight-regular);
  letter-spacing: var(--ds-letter-spacing-normal);
}

.ds-type-heading-lg {
  font-size: var(--ds-font-size-600);
  line-height: var(--ds-line-height-tight);
  font-weight: var(--ds-font-weight-bold);
  letter-spacing: var(--ds-letter-spacing-tight);
}
```

This prevents mismatched combinations — a consumer shouldn't have to
remember that `font-size-600` pairs with `line-height-tight` and
`letter-spacing-tight`.

---

## Responsive type

### The problem

You don't know what viewport your component will render in. It might be
full-page on desktop, or crammed into a 320px sidebar. Fixed pixel sizes
will either be too large or too small somewhere.

### Fluid type with clamp()

Use `clamp()` so text scales smoothly between viewport widths without
breakpoint jumps:

```css
--ds-font-size-display: clamp(2rem, 1.5rem + 2vw, 3.5rem);
--ds-font-size-heading-lg: clamp(1.5rem, 1.25rem + 1vw, 2.5rem);
--ds-font-size-body: clamp(0.9375rem, 0.875rem + 0.25vw, 1.0625rem);
```

**Important guardrails:**
- Always set a minimum (first value) that's readable on 320px screens
- Body text should barely change — keep the range tight (15px–17px).
  Dramatic fluid body text causes reflow and is disorienting.
- Headings can scale more aggressively
- Test at 200% zoom — `clamp()` with `vw` units can fight against zoom if
  the viewport is small, so the minimum must be a `rem` value that respects
  the user's font-size preference

### Container queries for component-level type

If a component might live in a narrow container on a wide viewport (sidebar,
card grid), viewport-based sizing is wrong. Container queries fix this:

```css
.ds-card {
  container-type: inline-size;
}

@container (max-width: 300px) {
  .ds-card__heading {
    font-size: var(--ds-font-size-300);
  }
}

@container (min-width: 301px) {
  .ds-card__heading {
    font-size: var(--ds-font-size-400);
  }
}
```

---

## Vertical rhythm and spacing

### Baseline grid

A baseline grid aligns text across columns and components to a consistent
rhythm, usually 4px or 8px. This is aspirational — true baseline grids are
hard to enforce in the browser — but the principle is useful:

- Set all spacing tokens as multiples of your baseline unit
- Use `line-height` values that produce line boxes aligning to the grid
- Margin between elements: use type-aware spacing (e.g., `margin-bottom`
  on headings differs from `margin-bottom` on paragraphs)

```css
/* 4px baseline grid */
--ds-baseline: 0.25rem; /* 4px */

/* Spacing as multiples */
--ds-spacing-xs: calc(var(--ds-baseline) * 1);  /* 4px */
--ds-spacing-sm: calc(var(--ds-baseline) * 2);  /* 8px */
--ds-spacing-md: calc(var(--ds-baseline) * 4);  /* 16px */
--ds-spacing-lg: calc(var(--ds-baseline) * 6);  /* 24px */
--ds-spacing-xl: calc(var(--ds-baseline) * 8);  /* 32px */
```

### Prose spacing within components

Components that contain user-authored prose (card descriptions, alert
messages, dialog content) should provide sensible defaults:

```css
.ds-prose > * + * {
  margin-block-start: var(--ds-paragraph-spacing, 1em);
}

.ds-prose h2 { margin-block-start: 1.5em; }
.ds-prose h3 { margin-block-start: 1.25em; }
.ds-prose ul, .ds-prose ol { padding-inline-start: 1.5em; }
```

---

## Type in components

### How components should consume type tokens

Components should reference semantic type tokens, not raw sizes:

```css
/* Good: semantic token */
.ds-button {
  font-size: var(--ds-button-font-size, var(--ds-font-size-body-sm));
  font-weight: var(--ds-button-font-weight, var(--ds-font-weight-medium));
  line-height: var(--ds-button-line-height, var(--ds-line-height-tight));
}

/* Bad: magic number */
.ds-button {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
}
```

### Truncation and overflow

You don't know how long the text in your component will be — it could be
3 characters in English and 30 in German. Ship truncation utilities:

```css
/* Single-line truncation */
.ds-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line truncation (clamp to N lines) */
.ds-line-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* Consumer sets this */
  -webkit-line-clamp: var(--ds-line-clamp, 2);
}
```

**Accessibility warning:** truncated text must still be accessible. Use
`title` attribute or a tooltip for the full text, or better yet, provide
an expand/collapse mechanism for content-heavy contexts.

### Minimum readable sizes

Set a floor. No text in the system should render below:
- **Body text:** 16px (1rem) — the browser default exists for a reason
- **Caption/helper text:** 12px (0.75rem) minimum, prefer 14px
- **Interactive labels:** 16px on touch devices to avoid zoom-on-focus in
  iOS Safari (inputs below 16px trigger automatic zoom)

---

## Performance and loading

### Font loading strategy

The consuming team will inherit your font loading choices. Make them
intentional:

**`font-display: swap`** — shows fallback immediately, swaps when loaded.
Best for body text (content is readable immediately, minor reflow on swap).

**`font-display: optional`** — shows fallback, uses web font only if it
loads extremely fast. Best for performance-critical contexts. The font
might never display on slow connections.

**`font-display: fallback`** — compromise between swap and optional. Short
block period (100ms), then swap within ~3 seconds. After that, falls back.

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

### Subsetting

If your org operates primarily in Latin-script languages, subset your fonts
to exclude CJK, Arabic, etc. from the base download. Load those ranges on
demand:

```css
/* Latin subset — loads for everyone */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F;
  font-display: swap;
}

/* CJK — loads only if characters are used on the page */
@font-face {
  font-family: 'Noto Sans JP';
  src: url('/fonts/noto-sans-jp.woff2') format('woff2');
  unicode-range: U+3000-9FFF, U+F900-FAFF, U+FF00-FFEF;
  font-display: swap;
}
```

### Preload critical fonts

Document that consuming teams should preload the primary font weight:

```html
<link rel="preload" href="/fonts/inter-var.woff2" as="font"
      type="font/woff2" crossorigin>
```

---

## Accessibility and readability

### WCAG requirements for text

**[AA] 1.4.4 Resize Text:** Text must be resizable up to 200% without loss
of content or functionality. This means: use `rem` or `em` for font sizes,
never `px` on body text. (`px` on headings is tolerable if the base size
is `rem`-based, but `rem` everywhere is safer.)

**[AA] 1.4.10 Reflow:** At 320px equivalent width (400% zoom on a 1280px
viewport), content must reflow to a single column with no horizontal
scrolling. This is a layout concern, but typography contributes — long
words in narrow containers need `overflow-wrap: break-word`.

**[AA] 1.4.12 Text Spacing:** Users must be able to override:
- Line height to 1.5× font size
- Paragraph spacing to 2× font size
- Letter spacing to 0.12em
- Word spacing to 0.16em

…without loss of content or functionality. This means: don't set fixed
heights on text containers. If your component has `height: 48px` and the
user increases line-height, text overflows or clips.

**[AAA] 1.4.8 Visual Presentation:** Line length should not exceed 80
characters (40 for CJK). Most design systems enforce this with a
`max-width` on prose containers:

```css
.ds-prose { max-width: 70ch; }
```

### Line length

Optimal reading line length is 45–75 characters for Latin text. For a
design system, ship a prose container with a `max-width` in `ch` units:

```css
.ds-reading-width { max-width: 65ch; }
.ds-reading-width-wide { max-width: 85ch; }  /* for wider layouts */
.ds-reading-width-narrow { max-width: 45ch; } /* for captions, cards */
```

---

## Multi-script and variable font considerations

### Variable fonts

If shipping a variable font, document the available axes:

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-weight: 100 900; /* weight axis range */
  font-style: oblique 0deg 10deg; /* slant axis, if available */
  font-display: swap;
}
```

Expose weight as a token, not a raw `font-variation-settings` string:

```css
/* Good: consumers use standard font-weight */
.ds-heading { font-weight: var(--ds-font-weight-bold); }

/* Avoid exposing raw axis values to consumers */
.ds-heading { font-variation-settings: 'wght' 700; }
```

### CJK, Arabic, Devanagari, and other scripts

Different scripts have different typographic needs. At minimum:
- **CJK:** needs larger base size (16px Latin ≈ 18px CJK for visual
  equivalence), different line-height defaults (1.7–1.8), and `word-break:
  break-all` or `overflow-wrap: anywhere` for line breaking
- **Arabic/Hebrew:** right-to-left layout (see `references/i18n.md`),
  different line-height needs, cursive connections that some fonts handle
  poorly at small sizes
- **Devanagari/Thai/Tamil:** tall ascenders/descenders that need extra
  line-height (1.7+)

If you don't know which scripts your system will encounter, use Noto as a
fallback family — it covers virtually every script — and set generous
line-height defaults that don't break with tall scripts:

```css
/* Safe for multi-script environments */
--ds-line-height-normal: 1.6;  /* slightly more generous than 1.5 */
```
