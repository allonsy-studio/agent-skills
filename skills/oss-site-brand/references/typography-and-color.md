# Typography and color

Aligned defaults, open overrides: a project may bring its own font families, but the monospace is the same everywhere.

## Contents

- [Fonts](#fonts)
- [Accent](#accent)
- [Contrast](#contrast)

## Fonts

| Token | Rule |
| --- | --- |
| `--font-sans` | Default: the system UI stack, `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. A project may override it with its own family |
| `--font-display` | Optional. Unset means it inherits `--font-sans` |
| `--font-mono` | Locked: PT Mono, then `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. Projects cannot override it |

PT Mono is the shared mono because agent-skills already ships it. Set project fonts in `project.json` (`fonts.sans`, `fonts.display`); the build puts them in front of the default stack and builds the Google Fonts URL with `display=swap`. The audit fails on a redeclared `--font-mono`, a font loaded without `swap`, and a loaded family that no rule uses.

## Accent

Set one hex `accent`. The build computes, per project:

- `--accent-text-light` and `--accent-text-dark`: the accent moved in lightness only as far as needed to read as text on every surface (4.5:1). An accent that already passes is unchanged.
- `--on-accent`: ink or white, whichever has more contrast; pure black or white when a mid-tone accent leaves both ink and white under 4.5:1. White is never assumed.

A bright yellow accent gets a darker text shade in light mode and dark ink on buttons. This is intended.

## Contrast

Surfaces and text are fixed in `tokens.css`. Thresholds: 4.5:1 for normal text, 3:1 for large text (24 px, or 18.66 px bold) and non-text UI such as the focus ring. The audit prints the final resolved hex values for every pair, in light and dark, so a failure names the colors. A `color: var(--x)` rule using a token no pair covers also fails, so a new text color cannot slip through unmeasured.
