# Pattern US staging legacy cutover plan

Status: **Prepared; Webflow changes not yet applied**

Scope: Pattern US staging only. Production must not be published during this
cutover.

## Release assets

- PVG version: `0.2.4`
- Runtime commit:
  `7bb2b6f2fc7ae258285fbafcd643e717b64009e1`
- Runtime SRI:
  `sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp`
- Runtime:
  `https://cdn.jsdelivr.net/gh/specterstudio/pattern@7bb2b6f2fc7ae258285fbafcd643e717b64009e1/webflow/pattern.com/scripts/runtime/pattern-version-gateway.js`
- Legacy-cutover embed commit:
  `1a33f83d725a22a05d6cf1b0e51b4bdccb094425`
- Legacy-cutover embed:
  `https://cdn.jsdelivr.net/gh/specterstudio/pattern@1a33f83d725a22a05d6cf1b0e51b4bdccb094425/webflow/pattern.com/scripts/runtime/pattern-version-gateway-legacy-active-embed.html`

The runtime and legacy-cutover embed returned HTTP 200 from jsDelivr. The
runtime bytes matched the SRI above. The strict local compatibility suite
passed for V1, V2, V2L, and V3.

## Pre-publish Designer changes

### Explicit V2 roots

Add `cc-v2` to the `.page_main` root of these pages or templates:

| Page or template | Page ID | Representative route |
| --- | --- | --- |
| Login Portal | `67d327c7ca817d803c46c97a` | `/login` |
| News Template | `67d327c7ca817d803c46ca99` | `/news/31-of-aussie-online-shoppers-have-access-to-amazon-prime-up-by-63-in-less` |
| Topics Template | `67d327c7ca817d803c46cab9` | `/topics/3pl-fulfillment` |
| Reports Template | `67d327c7ca817d803c46cacf` | `/reports/2026-state-of-fulfillment` |
| Partner Success Stories | `67d327c7ca817d803c46cad7` | `/resources/partner-success-stories` |
| Whitepapers Template | `6894c8a639fa3a2fde5d413f` | `/whitepaper/fulfillment-pet-brands` |
| Marketplace Performance Review Request | `69c580f31898bcb4f86adeb7` | `/performance-review` |
| International Expansion Videos | `6a54f3bced5874fe1272943f` | `/resources/international-expansion-videos` |

The Reports Template currently renders `page_main cc-v21`. Replace `cc-v21`
with `cc-v2`; do not retain both.

Home Copy is deleted. Prep Calculator, Consent Pro, and Catalog Offer are
excluded because they are utility/non-content surfaces rather than real PVG
pages.

### Portal Studio slider ownership

Component:

- Name: `Slider / Images`
- Component ID: `add325b2-98f6-2022-6cd2-f5c46e4b47a2`
- JS embed element:
  `add325b2-98f6-2022-6cd2-f5c46e4b47aa`

Replace the malformed component JS embed with the working page initializer,
registered as the component's single `splideSlider` owner:

```html
<script>
  pageFunctions.addFunction('splideSlider', function () {
    var splideEl = document.querySelector('#splideSlider');
    if (!splideEl) return;
    if (splideEl.dataset.patternSliderImagesInitialized === 'true') return;

    var slides = Array.from(splideEl.children);
    if (!slides.length) return;

    var track = document.createElement('div');
    track.className = 'splide__track';
    var list = document.createElement('ul');
    list.className = 'splide__list';

    slides.forEach(function (slide) {
      var item = document.createElement('li');
      item.className = 'splide__slide';
      item.appendChild(slide);
      list.appendChild(item);
    });

    track.appendChild(list);
    splideEl.appendChild(track);

    var splide = new Splide('#splideSlider', {
      type: 'loop',
      perPage: 4,
      gap: '0px',
      pagination: false,
      arrows: false,
      drag: false,
      clones: 8,
      breakpoints: {
        1024: { perPage: 3 },
        768: { perPage: 2 },
        480: { perPage: 1 }
      }
    });

    splide.mount();
    splideEl.dataset.patternSliderImagesInitialized = 'true';

    var speed = 0.5;
    var position = 0;
    var slideWidth = 0;
    var totalWidth = 0;

    function getMetrics() {
      var firstSlide = splideEl.querySelector('.splide__slide');
      if (!firstSlide) return;
      slideWidth = firstSlide.offsetWidth;
      totalWidth = slideWidth * slides.length;
    }

    function tick() {
      position += speed;
      if (totalWidth > 0 && position >= totalWidth) {
        position -= totalWidth;
      }

      var slideList = splideEl.querySelector('.splide__list');
      if (slideList) {
        slideList.style.transform = 'translateX(-' + position + 'px)';
      }

      requestAnimationFrame(tick);
    }

    getMetrics();
    window.addEventListener('resize', getMetrics);
    setTimeout(function () {
      getMetrics();
      tick();
    }, 300);
  });
</script>
```

Then remove the page-level `DOMContentLoaded` block on
`/products/the-portal-studio` that currently rebuilds `#splideSlider` and calls
`new Splide(...)`. Keeping both blocks produces two initializers for the same
root.

## Site header diff

Keep the shared `pageFunctions` registry and all consent, analytics, SEO,
font, Marketo, and Finsweet infrastructure.

Remove only these version-owned global assets:

- Pattern navigation CSS (`v1.0.8/styles/nav.css`)
- Pagination CSS (`v1.0.8/styles/pagination-fix.css`)
- Splide CSS preload and its `<noscript>` fallback
- Pattern legacy video popup (`v1.0.8/scripts/media/video-popup.js`)

PVG supplies each asset only when matching markup is present.

## Site footer diff

Remove only these version-owned global assets:

- Splide `4.1.4` JavaScript
- Navigation
- Logo rotation
- Rich-text heading correction
- FAQ schema
- Accordion
- Image lazy loading
- Rich-text CTA injection
- Article/legal TOC
- Iframe popup
- Pagination behavior
- Attribute-driven card animations

Keep:

- Autopilot
- Storylane
- The shared page-function executor
- Pattern Component Runtime

Replace the current PVG `0.2.3` V3-active/preserve loader block with the full
contents of
`pattern-version-gateway-legacy-active-embed.html`. The new loader uses
`legacyPolicy: "gateway"` and temporarily parks the `nav` and `splideSlider`
callbacks while the retained executor runs. PVG invokes those callbacks after
their dependencies are ready.

## Staging publish and validation

Publish only to `pattern-us.webflow.io`.

Automated checks:

1. Confirm every sitemap route returns 200.
2. Confirm PVG `0.2.4`, runtime commit, SRI, `mode: active`, and
   `legacyPolicy: gateway`.
3. Confirm all 189 previously inferred routes now resolve explicitly to V2.
4. Confirm no removed global asset remains on a page without matching markup.
5. Confirm dependency and module URLs load at most once.
6. Confirm no page resolves as inferred, unknown, or conflicting except the
   three approved excluded utility surfaces.

Manual matrix:

- V1: `/software`
- V1 count-up template: `/case-study/gaia`
- V1 card animation: `/partnership/asgtg`
- V2: `/`
- V2 count-up/accordion/video: `/products/fulfillment/middle-mile`
- V2 Portal/Splide: `/products/the-portal-studio`
- Newly marked static V2: `/performance-review`
- Newly marked CMS templates: one News, Topics, Reports, and Whitepaper route
- V3 staging-only control: `/home-v3`

Check navigation, mobile navigation, count-up, drop/fade animations, Splide
motion, accordion open/close and keyboard behavior, video and iframe popups,
pagination, CTA injection, TOC, FAQ schema, lazy loading, dynamic year, forms,
and console/network errors.

## Rollback

If any staging gate fails:

1. Restore the current saved site header and footer from the manual backup.
2. Restore the Portal page-level initializer and previous component embed
   together.
3. Restore the eight original page-root class lists.
4. Publish only to the Webflow staging subdomain.
5. Re-run the representative V1/V2/V3 matrix before any further change.

No production-domain publish is part of this plan.
