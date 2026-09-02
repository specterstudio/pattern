# Pattern UK Version Split

Phase 5 public runtime package for separating Shared, V1, V2, and
feature-specific assets. Release `0.5.2` is pinned by the immutable tag
`uk-version-split-v0.5.2`.

This repository contains the public browser assets and their validation tools.
Page inventories, Webflow identifiers, rollout classifications, and other
internal audit data are intentionally excluded. The package is not applied
site-wide by this release.

## Architecture

| Layer | Source | Purpose |
|---|---|---|
| Shared CSS | `css/shared.css` | Current Lumos foundation plus generic helpers required by both page versions and shared Header/Footer components |
| V1 CSS | `css/v1.css` | V1 compatibility and production-fidelity rules scoped through `data-pattern-version="v1"` |
| V2 CSS | `css/v2.css` | V2 Content Wrapper alignment behavior scoped through `data-pattern-version="v2"` |
| Feature bundle | `css/features.css` | Concatenated shared feature CSS |
| Feature CSS | `css/features/*.css` | Marketo, icons, cards, buttons, gradients, accordions, sliders, navigation, modal, lightbox, marquee, grid media, and rich text |
| Permanent loader | `js/loader.js` | Reads the explicit version marker, loads Shared plus matching version JavaScript, and activates selector-driven feature scripts |
| Shared JS | `js/shared.js` | Current `pageFunctions` registry and one-time DOM-ready execution |
| V1 JS | `js/v1.js` | Intentionally empty because the audit found no V1-exclusive JavaScript |
| V2 JS | `js/v2.js` | Intentionally empty because the audit found no V2-exclusive JavaScript |
| Shared Designer resource | `components/shared.html` | Pinned Shared and Features stylesheet links |
| V1 Designer resource | `components/v1.html` | Pinned V1 stylesheet link |
| V2 Designer resource | `components/v2.html` | Pinned V2 stylesheet link |

`external-assets.json` inventories current hosted assets and candidate DOM
selectors. Its JavaScript feature entries are compiled into the loader at build
time.

## Activation and safety

- `data-pattern-version="v1"` or `"v2"` is the only version signal.
- The Phase 4 `data-pattern-asset-pilot` gate is not used by the permanent
  loader.
- Duplicate matching markers are accepted because a page may expose the same
  value on more than one mapped wrapper.
- Missing, invalid, or conflicting version markers fail closed.
- Runtime and stylesheet resources use duplicate guards.
- `.page_code_wrap` is not a version signal anywhere in the generated source.
- V1 accepts all three mapped marker locations: Body, `.page_main`, and
  `.page_wrap`.
- Conditional Visibility may select component markup, but it must not load CSS
  or JavaScript.

## Shared dependency decisions

- The unsuffixed `--grid-1` through `--grid-12` aliases remain Shared because
  the global Header and Footer consume them.
- Marketo is a shared feature, not a V1 or V2 asset.
- Shared Header/Footer container tokens, grid aliases, fluid type and margin
  aliases, and the compatibility foundation remain Shared.
- The optional `.page_main.cc-v1` production-fidelity boundary remains opt-in.
  A page's version marker does not add that combo class's visual overrides.

## Build and verification

Run:

```bash
node webflow/uk.pattern.com/version-split/build.mjs
node webflow/uk.pattern.com/version-split/verify-phase5.mjs
```

The build reads the exact Phase 1 rollback captures, regenerates the source
files, and writes hashes and structural checks to `validation.json`.

Current validation:

- 27 generated files
- 18 CSS files
- 4 JavaScript files
- 54 of 54 structural checks passed
- 18 of 18 CSS files parsed in Chromium
- 468 CSSOM rules parsed
- 18 of 18 browser behavior/runtime checks passed
- Shared container-token and grid-alias behavior verified
- V1-only type aliases verified
- V2 Content Wrapper alignment verified only with a V2 marker
- Permanent V1 and V2 runtime selection verified without the Phase 4 gate
- Invalid and conflicting marker states verified to fail closed
- Designer component resources verified against pinned `v0.5.2` URLs

## Rollout boundary

This public package does not authorize Webflow writes or publishing. Each
separately approved rollout batch must re-read current page state, insert
Shared and the matching version resource in that order, remove the legacy
resource only after both replacements exist, and stop on the first visual,
console, or network failure.
