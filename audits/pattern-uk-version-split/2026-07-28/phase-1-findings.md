# Phase 1 Findings

## Page classification

| Classification | Count | Rule |
|---|---:|---|
| V1 | 105 | Every UK page except Pattern Intelligence |
| V2 | 1 | Pattern Intelligence, `/pattern-intelligence` |

Pattern Intelligence already has `.page_main.cc-v2`. No page currently has the proposed `data-pattern-version` attribute.

## Marker targets

| Target | Count | Use |
|---|---:|---|
| `.page_main` | 92 | Preferred marker target |
| `.page_wrap` | 2 | Fallback when no `.page_main` exists |
| `Body` | 12 | Utility, template, draft, and event-page fallback |

All 106 targets have exact component and element IDs in `page-marker-plan.csv`.

The two `.page_wrap` targets are Marketplace Performance Center and Password (401). The 12 Body targets are the four Executive Acceleration Forum pages, Authors Template, Thank You Pages Template, Prep Calculator, Home Hero Sliders Template, Topic Cards Template, New Sliders Template, Logos Template, and Leaderships Template.

## Current custom-code architecture

### Active `Custom Code` component

- Component ID: `89894b6d-cf3f-dfb6-51d8-63b0d19309e1`
- Instances: 101
- Description identifies it as a post-detach V1/V2 transition bridge.
- All four embeds are captured in `rollback/custom-code-active/`.

The 101-instance count means five of the 106 page records do not currently carry this component. A later component rollout must not assume universal coverage.

### `01-text-style.html`

This 21,372-character block is predominantly V2/Lumos foundation CSS. Evidence includes suffixed V2 variables such as `--_default-2`, `--_theme-2`, and `--_text-style-2`.

It also owns unscoped browser resets, focus rules, margin trimming, trigger utilities, and other behavior that shared components may currently depend on. It is a V2 candidate, not a safe whole-block move.

### `02-base.html`

This 34,961-character block is predominantly the V1 compatibility layer. It explicitly contains V1 Base, Color, Text Style, Responsive, Forms, Custom, Navigation, Fluid Sizes, and production-fidelity sections.

The critical defect is its broad activation selector:

```css
body:has(:is(.page_code_wrap, .page_main.cc-v1))
```

`.page_code_wrap` is the active global custom-code wrapper. On the 101 pages carrying that component, the selector makes the V1 compatibility layer true regardless of page version. The V2 Pattern Intelligence page therefore receives V1 declarations whenever it carries the component.

The durable replacement is an explicit version selector, for example:

```css
[data-pattern-version="v1"]
```

or a document selector derived from that attribute. `.page_code_wrap` must be removed as a version signal.

### `03-color.html`

This 21,303-character block is explicitly labelled V2 priority, but its first section is a global V1 grid system. That grid overlaps the V1 grid declarations already present in `02-base.html`.

The remainder contains:

- generic modal and text helpers;
- the V2 Content Wrapper alignment repair;
- V2 card, button, gradient, CMS, and rich-text rules;
- global selectors that require shared-versus-V2 review.

It must be split by section. Moving the complete file to V2 would remove V1 grid variables; leaving it global continues V2 leakage.

### `04-responsive.html`

This 15,710-character block is global Marketo form styling for standard forms and the shared footer newsletter. It uses V2-token fallbacks, but its behavior is feature-specific and shared. It belongs in Shared/Forms, not V1 or V2.

## Site-level assets

The site head and footer currently load all assets on every page. They fall into three groups:

1. Shared core: consent, analytics, page-function registry, preconnects, header/navigation, copyright, and the final function runner.
2. Feature-specific: Splide, pagination, social share, video popup, logos, rich-text conversion, FAQ schema, accordion, lazy load, CTA injection, Storylane, iframe popup, and card animation.
3. Page-specific code: Slick on Home and Pattern Intelligence; TOC on four thank-you pages; Flowdrive on two Marketplace Performance Center pages; article TOC on Blogs and News templates; registered FAQ schema on GEO Scorecard.

Feature scripts should be loaded by DOM capability or a page feature declaration. V1/V2 alone is not precise enough to decide whether these assets are needed.

## Rollback status

Exact current state is captured for:

- site details, pages, registered scripts, site head, and site footer;
- active Custom Code metadata and all four active embeds;
- page-level freeform code for all 106 pages;
- page-level registered-script responses;
- page root and intended marker information for all 106 pages.

Three useful embeds from the inactive one-instance backup component were also captured. Webflow rate-limited the remaining inactive backup reads. This does not block a rollback of the active implementation or the marker-only phase.

## Phase 1 conclusion

The split is possible and the page classification is complete. The first mutation should be marker-only because it is inert under the current CSS and creates the stable boundary required for every later asset change.
