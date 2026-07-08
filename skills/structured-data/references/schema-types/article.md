# Article

Full vocabulary: https://schema.org/Article (also covers `NewsArticle`, `BlogPosting` — same property set, more specific `@type`)

## Properties

| Property | Typically required for rich results | Notes |
|---|---|---|
| `headline` | Yes | Keep under ~110 characters; Google truncates longer headlines in display |
| `image` | Yes | At least one image, multiple aspect ratios recommended (1x1, 4x3, 16x9) |
| `datePublished` | Yes | ISO 8601 (`2026-07-06T09:00:00-04:00`) |
| `author` | Yes | Nested `Person` or `Organization` — needs its own `name` at minimum |
| `dateModified` | Recommended | ISO 8601; omit if never updated post-publish |
| `publisher` | Recommended | Nested `Organization` with a `logo` (`ImageObject`, min 60x60px) |
| `description` | Recommended | Plain-text summary, not the full body |
| `mainEntityOfPage` | Recommended | URL of the canonical page, needed if the article is syndicated |
| `articleBody` | Optional | Full text; large payload, usually skipped for JSON-LD to avoid duplicating the whole page in a script tag |
| `keywords` | Optional | Comma-separated or array |

Verify current requirements against Google's Article structured data documentation before treating this table as exhaustive — required-vs-recommended status for rich results shifts independently of the schema.org vocabulary itself.

## Microdata example

```html
<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">Building a Design System from Scratch</h1>
  <img itemprop="image" src="/img/hero.jpg" alt="">
  <span itemprop="author" itemscope itemtype="https://schema.org/Person">
    <span itemprop="name">Cassondra Roberts</span>
  </span>
  <time itemprop="datePublished" datetime="2026-07-06">July 6, 2026</time>
  <div itemprop="articleBody">
    ...body content...
  </div>
</article>
```

## JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Building a Design System from Scratch",
  "image": ["https://allons-y.studio/img/hero.jpg"],
  "datePublished": "2026-07-06T09:00:00-04:00",
  "author": {
    "@type": "Person",
    "name": "Cassondra Roberts"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Allons-y Studio",
    "logo": {
      "@type": "ImageObject",
      "url": "https://allons-y.studio/logo.png"
    }
  }
}
```
