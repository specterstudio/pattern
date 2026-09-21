# Production source baseline — September 21, 2026

This update records code required by the published Pattern US and UK sites. It does not change Webflow, upload a component library, change a CDN pin, or publish a site.

## Evidence and scope

- Read 123 public pages: 67 on `www.pattern.com` and 56 on `uk.pattern.com`, selected from their published sitemaps to cover navigation pages and distinct route families. This is not an exhaustive crawl.
- Checked the US and UK homepages in a browser. The US consumer runtime initialized its matching modules; the UK version loader reported `ready` with no failed dependencies.
- Matched 35 hosted source paths byte-for-byte against their selected live CDN versions and the corresponding Git objects. Some of these paths already existed unchanged on `main`.
- Matched the script/style payloads of 10 local source files exactly against published HTML. Duplicate local copies and historical head/footer snapshots were excluded.
- Confirmed live `PatternIcon` instances on `/pi` and `PiWelcomeAnimation` instances on `/marketplace`. Their production manifest is linked below. The retained local icon and Pi animation application chunks match production after normalizing Webflow's assigned library identifier. A fresh build passes; its generated module IDs and import wrappers differ, so the generated bundle is not claimed to be byte-identical.
- Validated TypeScript, the existing 1,500-icon verification, the local component build, and selected standalone JavaScript syntax. This source synchronization does not introduce new runtime behavior.

## Hosted source files

Each link identifies the exact production version used for the source copy. Several sites or page generations may load different versions of the same path. The earlier immutable Git commits and tags remain authoritative for those variants; replacing their URLs with `main` would be a separate release.

| Source path | Verified production version |
| --- | --- |
| `webflow/pattern.com/archive/legacy-root/teknkl-formsplus-core-1.0.8.js` | [c2386d587e92](https://cdn.jsdelivr.net/gh/specterstudio/pattern@c2386d587e9213612a86fd11f3b064a916d4d9fa/webflow/pattern.com/archive/legacy-root/teknkl-formsplus-core-1.0.8.js) |
| `webflow/pattern.com/archive/legacy-root/teknkl-simpledto-2.0.4.js` | [c2386d587e92](https://cdn.jsdelivr.net/gh/specterstudio/pattern@c2386d587e9213612a86fd11f3b064a916d4d9fa/webflow/pattern.com/archive/legacy-root/teknkl-simpledto-2.0.4.js) |
| `webflow/pattern.com/scripts/content/box-slider-slot-controls.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/content/box-slider-slot-controls.js) |
| `webflow/pattern.com/scripts/content/case-study-cms-slider.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/content/case-study-cms-slider.js) |
| `webflow/pattern.com/scripts/content/cta-inject.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/cta-inject.js) |
| `webflow/pattern.com/scripts/content/logos.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/logos.js) |
| `webflow/pattern.com/scripts/content/rich-text-heading-conversion.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/rich-text-heading-conversion.js) |
| `webflow/pattern.com/scripts/content/toc.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/content/toc.js) |
| `webflow/pattern.com/scripts/interaction/accordion.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/interaction/accordion.js) |
| `webflow/pattern.com/scripts/interaction/card-load-animations-v10.js` | [aa2e661b1aad](https://cdn.jsdelivr.net/gh/specterstudio/pattern@aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6/webflow/pattern.com/scripts/interaction/card-load-animations-v10.js) |
| `webflow/pattern.com/scripts/interaction/lazy-load.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/lazy-load.js) |
| `webflow/pattern.com/scripts/interaction/marquee.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/interaction/marquee.js) |
| `webflow/pattern.com/scripts/interaction/pagination-fix.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/pagination-fix.js) |
| `webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js) |
| `webflow/pattern.com/scripts/media/iframe-popup.js` | [v1.0.2](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.2/webflow/pattern.com/scripts/media/iframe-popup.js) |
| `webflow/pattern.com/scripts/media/video-popup.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/media/video-popup.js) |
| `webflow/pattern.com/scripts/media/video-preview.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/media/video-preview.js) |
| `webflow/pattern.com/scripts/nav/home-anchor-nav.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/nav/home-anchor-nav.js) |
| `webflow/pattern.com/scripts/nav/nav.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/nav/nav.js) |
| `webflow/pattern.com/scripts/runtime/pattern-runtime-consumer-0.2.1.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/runtime/pattern-runtime-consumer-0.2.1.js) |
| `webflow/pattern.com/scripts/runtime/pattern-version-gateway.js` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/runtime/pattern-version-gateway.js) |
| `webflow/pattern.com/scripts/schema/faq-schema-generator.js` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/schema/faq-schema-generator.js) |
| `webflow/pattern.com/styles/home-anchor-nav.css` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/styles/home-anchor-nav.css) |
| `webflow/pattern.com/styles/marquee.css` | [9b174800a295](https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/styles/marquee.css) |
| `webflow/pattern.com/styles/nav.css` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/styles/nav.css) |
| `webflow/pattern.com/styles/pagination-fix.css` | [v1.0.8](https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/styles/pagination-fix.css) |
| `webflow/pattern.com/styles/v3-utility-bridge.css` | [84b9726d25c1](https://cdn.jsdelivr.net/gh/specterstudio/pattern@84b9726d25c17b1fd1f594fbe53039946ef504ba/webflow/pattern.com/styles/v3-utility-bridge.css) |
| `webflow/uk.pattern.com/version-split/css/features.css` | [uk-version-split-v0.4.3](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.4.3/webflow/uk.pattern.com/version-split/css/features.css) |
| `webflow/uk.pattern.com/version-split/css/shared.css` | [uk-version-split-v0.4.3](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.4.3/webflow/uk.pattern.com/version-split/css/shared.css) |
| `webflow/uk.pattern.com/version-split/css/v1.css` | [uk-version-split-v0.5.3](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.5.3/webflow/uk.pattern.com/version-split/css/v1.css) |
| `webflow/uk.pattern.com/version-split/css/v2.css` | [uk-version-split-v0.4.3](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.4.3/webflow/uk.pattern.com/version-split/css/v2.css) |
| `webflow/uk.pattern.com/version-split/js/loader.js` | [uk-version-split-v0.5.2](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.5.2/webflow/uk.pattern.com/version-split/js/loader.js) |
| `webflow/uk.pattern.com/version-split/js/shared.js` | [uk-version-split-v0.5.2](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.5.2/webflow/uk.pattern.com/version-split/js/shared.js) |
| `webflow/uk.pattern.com/version-split/js/v1.js` | [uk-version-split-v0.5.2](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.5.2/webflow/uk.pattern.com/version-split/js/v1.js) |
| `webflow/uk.pattern.com/version-split/js/v2.js` | [uk-version-split-v0.5.2](https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.5.2/webflow/uk.pattern.com/version-split/js/v2.js) |

The US runtime and gateway use commit `9b174800a295ad09a50e1b4d58d5004b853c81b6`. Their dependent files are retained together. The card animation is pinned separately to `aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6`, and the V3 utility styles to `84b9726d25c17b1fd1f594fbe53039946ef504ba`.

The UK site uses `v1.0.8` for legacy assets (including its video popup and accordion), `v1.0.2` for iframe popups, UK CSS from `uk-version-split-v0.4.3` with V1 spacing from `uk-version-split-v0.5.3`, and the loader/scripts from `uk-version-split-v0.5.2`. Where US and UK source versions differ at the same path, the source table selects the US version while the UK continues using its existing tag.

## Inline Webflow source

These files are source copies of embedded code. Their script/style payloads match production. Webflow executes the embedded copy, so changing these Git files alone does not change the site. The `embeds/` names describe the current production purpose rather than preserving local draft filenames.

| Source path | Example verified page |
| --- | --- |
| `webflow/pattern.com/scripts/content/pi-welcome-slider-controller.js` | [https://www.pattern.com/marketplace](https://www.pattern.com/marketplace) |
| `webflow/pattern.com/scripts/nav/page-anchor.js` | [https://www.pattern.com/catalog-advertising](https://www.pattern.com/catalog-advertising) |
| `webflow/pattern.com/embeds/v3-navigation.html` | [https://www.pattern.com/](https://www.pattern.com/) |
| `webflow/pattern.com/embeds/global-layout-styles.html` | [https://www.pattern.com/software](https://www.pattern.com/software) |
| `webflow/pattern.com/embeds/legacy-compatibility-styles.html` | [https://www.pattern.com/software](https://www.pattern.com/software) |
| `webflow/pattern.com/embeds/home-hero-script.html` | [https://www.pattern.com/](https://www.pattern.com/) |
| `webflow/pattern.com/embeds/slider-script.html` | [https://www.pattern.com/category/beauty](https://www.pattern.com/category/beauty) |
| `webflow/pattern.com/embeds/tab-styles.html` | [https://www.pattern.com/pi](https://www.pattern.com/pi) |
| `webflow/pattern.com/embeds/marketo-footer-styles.html` | [https://www.pattern.com/](https://www.pattern.com/) |
| `webflow/pattern.com/embeds/marketo-global-styles.html` | [https://www.pattern.com/](https://www.pattern.com/) |

## Webflow code components

[Production component manifest](https://code-components.website-files.com/6aa0b90be0c8d66ee3e4099a%2Fmodule%2Fwf-manifest.json) exposes `PatternIcon` and `PiWelcomeAnimation`.

`webflow/pattern.com/code-components/` contains their source, property definitions, dependency lockfile, build configuration, and existing verification. The generated icon registry is required source data. The Pi wrapper imports `scripts/components/pi-welcome/pi-welcome-elements.js`, which in turn uses its accompanying CSS. Those production application assets are therefore included.

The component `dist/` output, installed dependencies, local telemetry preferences, screenshots, and previews are excluded. See the [component README](../webflow/pattern.com/code-components/README.md) for the local build commands.

## Exclusions and maintenance

- No unused runtime distribution infrastructure, library-only runtime, preparation files, unverified slider revisions, speculative feature work, or design-token exports were added.
- Existing historical files were not deleted or treated as current merely because they were already committed.
- Keep production Git commits and release tags reachable and immutable. A commit/push updates the repository; an authorized Webflow or code-library release updates visitors' experience.
- Recheck the relevant public page and pinned asset before changing any source version. The date on this record matters; it is not an automatically updated inventory.

## Existing issue observed during verification

The US homepage still requests the two legacy `blackpixelca/pattern@main` root URLs for `teknkl-formsplus-core-1.0.8.js` and `teknkl-simpledto-2.0.4.js`; both returned HTTP 404. The correctly pinned archived paths were also found on other inspected pages. This source-only update leaves those Webflow references unchanged; repairing them requires a separate site change.
