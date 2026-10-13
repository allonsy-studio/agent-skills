# Logo and favicon

Existing assets always win. When a project has no logo or favicon, ask once for metaphors or visuals, and fall back to a wordmark when none come. This never blocks the build.

## Contents

- [Flow](#flow)
- [Proposing marks](#proposing-marks)
- [Wordmark rule](#wordmark-rule)
- [Files produced](#files-produced)
- [Checks](#checks)

## Flow

1. `node scripts/mark.js inspect --site docs` reports `hasFavicon`, `hasLogo`, the missing files, and the next `action`:
   - `keep`: favicon and logo both exist. Nothing to make; the audit validates the links.
   - `ask`: put the question below to the maintainer, then rerun with `--concept yes|no`.
   - `propose`: there is a concept; offer three sketches.
   - `wordmark`: no concept, or nobody to ask. Say so in the report.
2. Ask exactly once: "Does the project have any metaphors or visuals that could carry a mark? An object, an action, a shape, a nickname."
3. With nobody present (`--unattended`), skip the question and use the wordmark.

## Proposing marks

Draw three simple SVG sketches from the concept and save them as `docs/src/assets/img/marks/option-1.svg` to `option-3.svg`. Keep each to a 64 by 64 `viewBox`, two or three shapes, and the project accent plus one neutral. No text, no gradients. The maintainer picks one; then:

```text
node scripts/mark.js icons --site docs --svg docs/src/assets/img/marks/option-2.svg
```

This writes `favicon.svg` and every raster from the chosen sketch. Delete the unused options.

## Wordmark rule

| Rule | Value |
| --- | --- |
| Typeface | The project's own heading font when set; otherwise the default sans at weight 700 |
| Favicon | First letter on an accent-filled rounded square; letter color computed for 4.5:1 or better |

`node scripts/mark.js wordmark --site docs` draws it. Raster text uses fonts installed on the machine, with a generic fallback, so a raster never renders blank.

## Files produced

All land in `docs/src/assets/img/` and are never overwritten without `--force`:

| File | Size |
| --- | --- |
| `favicon.svg` | Vector |
| `favicon-32.png` | 32 px |
| `apple-touch-icon.png` | 180 px |
| `icon-192.png`, `icon-512.png` | 192 and 512 px (manifest icons) |
| `og-image.png` | 1200 by 630 social image |
| `manifest.webmanifest` | Icons by relative path |

## Checks

Every `<link rel="icon">` resolves; `og:image` and `theme-color` are present; `og:image` is 1200 by 630; every manifest icon resolves.
