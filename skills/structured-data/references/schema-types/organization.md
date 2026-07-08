# Organization

Full vocabulary: https://schema.org/Organization

Mainly used for the Knowledge Panel / logo rich result, and nested inside `Article.publisher`, `Person.worksFor`, `Product.brand`.

## Properties

| Property | Notes |
|---|---|
| `name` | Required in practice |
| `url` | Canonical site URL |
| `logo` | Nested `ImageObject`, min 60x60px — required if this Organization is used as an `Article.publisher` |
| `sameAs` | Array of social/profile URLs, same purpose as on `Person` |
| `address` | Nested `PostalAddress` |
| `contactPoint` | Nested `ContactPoint` (`telephone`, `contactType`, e.g. `"customer service"`) |
| `founder` | Nested `Person` |
| `foundingDate` | ISO 8601 date |

## Microdata example

```html
<div itemscope itemtype="https://schema.org/Organization">
  <span itemprop="name">Allons-y Studio</span>
  <link itemprop="url" href="https://allons-y.studio">
  <img itemprop="logo" src="https://allons-y.studio/logo.png" alt="">
</div>
```

## JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Allons-y Studio",
  "url": "https://allons-y.studio",
  "logo": "https://allons-y.studio/logo.png"
}
```
