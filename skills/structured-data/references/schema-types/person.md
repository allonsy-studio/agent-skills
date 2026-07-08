# Person

Full vocabulary: https://schema.org/Person

Doesn't have a dedicated Google rich-result type on its own, but is very frequently used nested inside `Article.author`, `Organization.founder`, `Event.performer`, and profile pages.

## Properties

| Property | Notes |
|---|---|
| `name` | Required in practice — everything else is optional context |
| `jobTitle` | |
| `worksFor` | Nested `Organization` |
| `affiliation` | Nested `Organization`, distinct from `worksFor` when the relationship isn't employment |
| `url` | Canonical profile/homepage URL |
| `image` | |
| `sameAs` | Array of URLs to social/professional profiles (GitHub, LinkedIn, Mastodon, etc.) — this is how search engines connect a Person entity across the web |
| `email` / `telephone` | Only include if genuinely intended to be public |
| `address` | Nested `PostalAddress` |

## Microdata example

```html
<div itemscope itemtype="https://schema.org/Person">
  <span itemprop="name">Cassondra Roberts</span>
  <span itemprop="jobTitle">Principal Front-End Engineer &amp; Design Systems Architect</span>
  <div itemprop="worksFor" itemscope itemtype="https://schema.org/Organization">
    <span itemprop="name">Allons-y Studio</span>
  </div>
  <a itemprop="sameAs" href="https://github.com/castastrophe">GitHub</a>
</div>
```

## JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Cassondra Roberts",
  "jobTitle": "Principal Front-End Engineer & Design Systems Architect",
  "worksFor": {
    "@type": "Organization",
    "name": "Allons-y Studio"
  },
  "sameAs": ["https://github.com/castastrophe"]
}
```
