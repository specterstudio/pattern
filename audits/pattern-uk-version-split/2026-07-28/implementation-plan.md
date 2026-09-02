# Implementation Plan

Each phase requires separate approval. No phase includes publishing unless publishing is explicitly approved afterward.

## Phase 2 — Add explicit page markers

This is the recommended first mutation.

1. Re-read each target immediately before its write.
2. Add `data-pattern-version="v1"` to 105 mapped roots.
3. Add `data-pattern-version="v2"` to the Pattern Intelligence `.page_main.cc-v2` root.
4. Preserve every existing class, including `.cc-v2`.
5. Do not alter custom code or asset loading.
6. Re-read all 106 pages and confirm the exact marker count.
7. Inspect Pattern Intelligence plus representative V1, `.page_wrap`, and Body-target pages in Designer.
8. Do not publish.

Expected visual impact: none. The current CSS does not use `data-pattern-version`, so this phase only establishes metadata.

Pilot requirement: validate that Webflow accepts a custom attribute on one Body target. If it does not, use an early page-head document marker for those 12 pages and record that exception before continuing.

## Phase 3 — Prepare version assets without switching production

1. Split the captured code into these source files:
   - `shared.css`
   - `v1.css`
   - `v2.css`
   - `shared.js`
   - `v1.js`
   - `v2.js`
   - feature CSS/JS modules where DOM capability is a better boundary than version
2. Remove `.page_code_wrap` as a V1 signal.
3. De-duplicate the V1 grid declarations currently present in both active CSS blocks.
4. Keep Marketo form CSS shared.
5. Keep the V2 Content Wrapper and V2 component overrides in V2.
6. Audit generic resets and shared Header/Footer dependencies before moving the V2/Lumos foundation wholesale.
7. Create Shared, V1, and V2 Custom Code component resources for Designer/component markup needs only.
8. Do not use Conditional Visibility to load external assets.
9. Validate the extracted files locally and against captured baselines.

Asset hosting should use immutable, versioned URLs. The existing Pattern repository plus a pinned jsDelivr tag is the natural current route, but creating and publishing a new tag requires separate approval.

## Phase 4 — Pilot the loader and head CSS

1. Keep truly shared CSS in the global site head.
2. Add a pinned V1 stylesheet link to V1 page heads.
3. Add a pinned V2 stylesheet link to the Pattern Intelligence page head.
4. Add one global footer loader that reads `data-pattern-version` and loads only the matching version JavaScript.
5. Load feature JavaScript by declared feature or selector, not merely by version.
6. Pilot on Pattern Intelligence and one representative V1 page.
7. Compare desktop, tablet, and mobile geometry to the Phase 1 baseline.
8. Specifically verify Pattern Intelligence container width, Section/Grid behavior, Content Wrapper alignment, navigation dropdowns, Marketo forms, and footer.
9. Do not publish.

## Phase 5 — Roll out in batches

1. V2 page: Pattern Intelligence.
2. Low-complexity V1 static pages.
3. V1 CMS templates and collection pages.
4. Forms, calculators, event pages, and utility pages.
5. Re-read all page code and marker state.
6. Perform site-wide visual and console checks.
7. Stop for publish approval.

## Current blockers and risks

| Item | Status | Effect |
|---|---|---|
| Version classification | Resolved | 105 V1, 1 V2 |
| Marker targets | Resolved | Exact target exists on all 106 pages |
| Active rollback capture | Resolved | All active embeds and site/page code captured |
| Body custom-attribute support | Requires pilot | May affect 12 fallback pages only |
| Five pages without active Custom Code | Requires identification before component rollout | Does not block global marker or loader work |
| Inactive backup embed rate limit | Non-blocking | Active implementation is fully captured |
| Asset hosting/version URL | Decision required before loader pilot | No effect on marker-only Phase 2 |
| Publish authority | Not granted | All work remains saved/unpublished |

There is no blocker to Phase 2 marker-only work.
