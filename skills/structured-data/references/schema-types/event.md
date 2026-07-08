# Event

Full vocabulary: https://schema.org/Event

## Properties

| Property | Typically required for rich results | Notes |
|---|---|---|
| `name` | Yes | |
| `startDate` | Yes | ISO 8601, include time and timezone offset if known |
| `location` | Yes | Nested `Place` with a nested `address` (`PostalAddress`); use `VirtualLocation` for online-only events |
| `endDate` | Recommended | |
| `image` | Recommended | |
| `description` | Recommended | |
| `offers` | Recommended | Nested `Offer` if tickets are sold — same shape as `Product.offers` |
| `performer` | Recommended | Nested `Person` or `PerformingGroup` |
| `organizer` | Recommended | Nested `Person` or `Organization` |
| `eventStatus` | Recommended | e.g. `https://schema.org/EventScheduled`, `EventCancelled`, `EventPostponed` |
| `eventAttendanceMode` | Recommended | `OfflineEventAttendanceMode`, `OnlineEventAttendanceMode`, or `MixedEventAttendanceMode` |

## Microdata example

```html
<div itemscope itemtype="https://schema.org/Event">
  <h1 itemprop="name">JSHeroes 2026</h1>
  <time itemprop="startDate" datetime="2026-06-11T09:00">June 11, 2026</time>
  <div itemprop="location" itemscope itemtype="https://schema.org/Place">
    <span itemprop="name">Cluj-Napoca</span>
  </div>
</div>
```

## JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "JSHeroes 2026",
  "startDate": "2026-06-11T09:00:00+03:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "Place",
    "name": "Cluj-Napoca",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Cluj-Napoca",
      "addressCountry": "RO"
    }
  }
}
```
