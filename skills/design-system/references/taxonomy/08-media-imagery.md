# Media & Imagery

## Carousel / Slideshow
**What it is:** Cycles through multiple slides of content.
**Key concerns:** Auto-advancing carousels must be pausable (WCAG 2.2.1). Each slide should be a live region or manage focus appropriately. Keyboard and touch support for navigation.
**ARIA pattern:** Region with `aria-roledescription="carousel"`, slides as `role="group"` with `aria-roledescription="slide"`, `aria-label="N of M"`.
**Common mistakes:**
```html
<!-- ❌ Auto-advancing with no pause control — fails WCAG 2.2.1 -->
setInterval(nextSlide, 3000);
<!-- ✅ Provide a visible pause button; also pause on hover and focus -->

<!-- ❌ Hidden slides are still in tab order — user tabs through invisible content -->
<div class="slide" style="display:none"><a href="…">Link</a></div>
<!-- ✅ Use inert or tabindex="-1" on hidden slides -->
<div class="slide" hidden inert>…</div>
```

### Image / Figure
**What it is:** A visual element with optional caption.
**ARIA pattern:** `<figure>` with `<figcaption>`. `<img alt="…">` with descriptive or empty alt as appropriate.
**Common mistakes:**
```html
<!-- ❌ Decorative image with alt text — AT reads it unnecessarily -->
<img src="decorative-swirl.svg" alt="Swirl decoration" />
<!-- ✅ Empty alt for decorative images -->
<img src="decorative-swirl.svg" alt="" />

<!-- ❌ Informative image with missing alt — AT reads filename -->
<img src="IMG_4392.jpg" />
<!-- ✅ Descriptive alt -->
<img src="IMG_4392.jpg" alt="Team at the product launch event" />
```
