# Product

Full vocabulary: https://schema.org/Product

## Properties

| Property | Typically required for rich results | Notes |
|---|---|---|
| `name` | Yes | |
| `image` | Yes | |
| `offers` | Yes | Nested `Offer` — needs `price`, `priceCurrency`, `availability` |
| `offers.price` | Yes (within offers) | Numeric string, no currency symbol |
| `offers.priceCurrency` | Yes (within offers) | ISO 4217 code, e.g. `USD` |
| `offers.availability` | Recommended | One of schema.org's `ItemAvailability` values, e.g. `https://schema.org/InStock` |
| `sku` / `gtin` / `gtin13` / `mpn` | Recommended | At least one strongly recommended for product identification |
| `brand` | Recommended | Nested `Brand` or `Organization` with a `name` |
| `aggregateRating` | Optional, high-value if present | Needs `ratingValue` and `reviewCount`; don't fabricate — only include if real ratings exist |
| `review` | Optional | Array of `Review` objects if showing individual reviews |
| `description` | Recommended | |

**Gotcha:** for a plain element (not `meta`/`link`/`img`/`time`/etc.), the microdata property value algorithm uses the element's raw `textContent` — there's no automatic stripping of a currency symbol or other display formatting. If the visible price is "$49.99", wrapping the whole string in `itemprop="price"` makes the machine-readable value `"$49.99"`, which fails Google's expected plain-numeric format. Keep the currency symbol outside the `itemprop`-tagged span (see the example below) or use a `meta` element with the clean numeric value instead of tagging the visible text at all.

**This is the type where Microdata's drift-risk argument matters most** — a mismatched price between visible markup and structured data is exactly the kind of thing that gets flagged as manipulative by search engines, and it's also the property most likely to change frequently. Weight that in the format decision.

## Microdata example

```html
<div itemscope itemtype="https://schema.org/Product">
  <h1 itemprop="name">Widget Pro</h1>
  <img itemprop="image" src="/img/widget-pro.jpg" alt="">
  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <span>$<span itemprop="price">49.99</span></span>
    <meta itemprop="priceCurrency" content="USD">
    <link itemprop="availability" href="https://schema.org/InStock">
  </div>
</div>
```

## JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget Pro",
  "image": "https://example.com/img/widget-pro.jpg",
  "offers": {
    "@type": "Offer",
    "price": "49.99",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  }
}
```
