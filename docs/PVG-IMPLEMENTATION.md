# Pattern Version Gateway Implementation

## Objective

Deliver one Pattern-owned runtime that:

1. detects whether the current page is V1, V2, V2L, or V3;
2. detects which supported components are present;
3. loads only the scripts, styles, and third-party dependencies required by
   that version/component combination; and
4. preserves the existing published behavior until each version is explicitly
   cleared for cutover.

The V3 video popup is an acceptance test of this architecture. It is not a
standalone footer-script replacement.

## Runtime safety contract

- PVG defaults to `observe` and makes no page changes.
- Conflicting or unknown version markers cannot activate.
- A configured version cannot override a contradictory authored page marker.
- Unmarked `.page_main` pages are reported as probable V2 but are not safe to
  activate without an explicit marker or route-registry entry.
- V1, V2, and V2L default to `legacyPolicy: "preserve"`.
- Existing production footer assets stay installed throughout observation and
  the first V3 activation.
- A failed PVG observation loader leaves the existing production runtime intact.
- All hosted releases must use a commit-pinned URL and matching SRI.

## Version detection

| Version | Primary marker | Compatibility handling |
| --- | --- | --- |
| V1 | `.page_main.cc-v1` or `data-pattern-version="v1"` | Explicit marker required for legacy cutover |
| V2 | `.page_main.cc-v2` or `data-pattern-version="v2"` | Unmarked `.page_main` is detected but activation is refused |
| V2L | `.page_main.cc-v2l` or `data-pattern-version="v2l"` | Uses the V2 family manifest |
| V3 | `.page_main_v3`, `.cc-v3`, or `data-pattern-version="v3"` | May be activated independently after staging verification |

An exact route registry can identify pages that cannot immediately receive an
authored version marker.

## Delivery phases

### Phase A — Background foundation

- Build the PVG loader and manifest.
- Verify detection and component planning locally.
- Keep all production surfaces unchanged.

### Phase B — Shadow observation

- Install a commit-pinned `mode="observe"` loader on a safe staging surface.
- Compare `PatternVersionGateway.inspect()` against the published DOM and
  network inventory.
- Confirm that observation mode adds no component assets.

### Phase C — V3 activation

- Activate PVG only on an explicitly marked V3 staging page.
- Keep the current legacy footer assets installed.
- Verify the Home V3 video popup, accordion, marquee, Home anchor navigation,
  case studies, dynamic year, and dependency deduplication.
- Verify representative V1, V2, and V2L pages remain unchanged.

### Phase D — Legacy gateway pilot

- Finish explicit V2 marking or route-registry coverage.
- Make every legacy module safe when loaded after DOM readiness.
- Run the complete V1/V2/V2L interaction matrix with
  `legacyPolicy: "gateway"` on staging.
- Pilot one low-risk route with a pinned rollback release.

### Phase E — Footer cutover

- Replace version-owned global scripts with the pinned PVG loader.
- Keep Consent Pro and approved universal analytics infrastructure global.
- Remove a legacy asset only after its gateway-owned replacement has passed
  representative-page regression.

### Phase F — Variable collection rename

- Resolve `Button Style-2` ownership and the remaining V1 alias defects.
- Split mixed Pre-V3 styles into version-owned modules.
- Introduce compatibility aliases.
- Rename collections to their approved V1, V2, and V3 namespaces in a
  reversible pilot.
- Complete representative V1/V2/V2L/V3 validation before widening the rename.

## Current acceptance criteria

- [x] V1 marker resolves to V1.
- [x] V2 marker resolves to V2.
- [x] V2L marker resolves to V2L with V2 family ownership.
- [x] V3 marker resolves to V3.
- [x] Unmarked `.page_main` is reported as unsafe inferred V2.
- [x] Conflicting markers refuse activation.
- [x] A forced configuration that contradicts the page marker refuses activation.
- [x] Unknown pages refuse activation.
- [x] Observation mode injects no component assets.
- [x] Legacy pages remain preserved unless `legacyPolicy: "gateway"` is explicit.
- [x] V3 video markup selects the V3 popup module.
- [x] Legacy popup markup never selects the V3 popup module.
- [x] An unlabelled V3 video opens without waiting on an unrelated consent category.
- [x] An explicitly consent-gated V3 video waits until that category is allowed.
- [x] Dependencies and component assets load at most once.
- [x] Module failure leaves authored Webflow content available.
- [x] V3 H1 heading reveal is planned only when its enabled H1 variant is present.
- [x] V3 heading reveal loads GSAP, ScrollTrigger, and SplitText at one aligned version.
- [x] A V2L compatibility fixture activates the V2-family nav, card, and Splide plan.
- [x] A legacy nav registered after `pageFunctions` has already run is executed once.
- [x] V1 card-load/count-up markup activates the fixed card animation module.
- [x] A registered legacy `splideSlider` callback runs once after Splide is available.
- [x] V1 and V2 accordion fixtures preserve default-open, switching, close, and ARIA behavior.
- [x] Component-level version-like classes and attributes cannot identify the page version.
- [x] The prepared V3 activation embed preserves V1, V2, and V2L.
- [x] The observation embed is the tested rollback and loads no component assets.

## Legacy cutover candidate 0.2.4

PVG `0.2.4` closes the two runtime ownership gaps found during the Pattern US
legacy-script removal audit:

- V1 pages with `[card-grid] [card-load]` now receive the same fixed,
  commit-pinned card/count-up module already used by V2, V2L, and V3.
- Legacy pages with `.splide` load Splide first and then execute the registered
  `pageFunctions.functions.splideSlider` callback once.

The compatibility suite now exercises V1 card/count-up ownership, registered
Splide execution, and the current Accordion `1.1.0` behavior on explicit V1
and V2 fixtures. The Pattern US staging cutover must retain the shared
`pageFunctions` registry and executor during the first removal trial. The
dedicated legacy-active embed parks PVG-owned `nav` and `splideSlider`
callbacks while that retained executor runs, then PVG invokes them after their
assets are ready.

## Countup asset pin 0.2.3

PVG `0.2.3` keeps the existing version detection and safety policies and
changes only the card-load animation asset. The module now points to the
verified commit-pinned countup loader at
`aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6`, which preserves V1 and V2
behavior while fixing horizontal digit layout for V3 stat cards. All other
legacy modules remain pinned to their existing bases.

## Background candidate 0.2.2

PVG `0.2.2` is locally committed, remains inert by default, and is not
installed on Pattern Production. It adds:

- V3 H1-only heading-reveal detection and the Runtime `0.3.0` module contract;
- aligned Webflow-hosted GSAP, ScrollTrigger, and SplitText `3.15.0`
  dependencies;
- a hard refusal when a configured version contradicts an authored page
  marker; and
- regression coverage proving observation mode adds zero assets, non-H1
  headings do not match, and the active H1 module and dependencies deduplicate;
- verified SRI coverage for every repo-owned V3 asset in the gateway manifest;
  and
- coexistence coverage proving an already-loaded V3 Runtime module is reused
  without injecting a duplicate module script; and
- a late-load bridge for the legacy nav when the global `pageFunctions` queue
  already ran before PVG registered the nav function; and
- page-root-only version markers so a component-level `cc-v*` class or
  `data-pattern-version` attribute cannot switch the whole page version.

## Integrity audit finding

The current Runtime `0.2.0` manifest contains stale SRI values for the current
Case Study and V3 Video Popup module bytes. A selector-only video change would
therefore still fail when the browser enforced integrity. PVG records the
verified hashes from the current source files and treats hash verification as a
release requirement for every module.

The V3 Video Popup module also previously treated an unlabelled video as
`personalization` content. Module `1.1.2` now treats an empty category as
intentionally ungated while continuing to wait for explicit
`data-consent-category` or `fs-consent-categories` values. It also re-reads the
Consent Pro API when a wrapped `consent-updated` event arrives, so a queued Play
action resumes immediately after the required category is accepted.

## Live observation matrix — 2026-07-29

PVG was injected only into isolated browser sessions. No page, component,
custom code, or publish state was saved.

| Surface | Live detection | Safety result | Matched plan |
| --- | --- | --- | --- |
| V1 — `/products/pxm/pim` | V1 from `.page_main.cc-v1` | Browser-only gateway test passed | Dynamic year, legacy nav, FAQ schema, legacy lazy load, Splide |
| V2 — `/` | V2 from `.page_main.cc-v2` | Browser-only gateway test passed | Dynamic year, legacy nav, legacy video, legacy lazy load, card animations, accordion |
| Inferred V2 — `/resources/partner-success-stories` | V2 from an exact test-only route entry | Browser-only gateway test passed | Dynamic year, legacy nav, legacy lazy load, pagination |
| V2L compatibility fixture | V2L from `.page_main.cc-v2l` | Local active test passed; no published V2L route exists | Dynamic year, legacy nav, card animations, Splide |
| V3 — Webflow Home V3 | V3 from `.page_main_v3` | Explicit and safe; isolated active test passed | Dynamic year, marquee, Home anchor nav, case study, V3 video |

Every observation-only run injected zero managed component assets.

PVG `0.2.0` completed the live browser-only matrix on July 29, 2026. The
subsequent `0.2.2` local regression suite adds the late legacy-nav case and
tests both prepared embeds. Pattern Production reported Runtime `0.2.0`; the
V3 Library reported Runtime `0.3.0`.

The V3 Library `/cc/type` source page currently has an unmarked `.page_main`.
PVG therefore reports it as unsafe inferred V2 and refuses activation. This is
the correct fail-closed result. Before PVG can activate on the Library site,
the Library needs an authored V3 marker or an exact, reviewed route registry.

The Phase 5 Notion record classifies the production homepage as V2L with
`.cc-v2l`. The current published DOM instead contains exactly
`page_main cc-v2` and no `.cc-v2l`. PVG follows the live marker and does not
override it with the older classification. No current public sitemap route is
marked V2L, so V2L remains a tested compatibility path rather than a live
cutover target.

The isolated active Home V3 test loaded Video Popup `1.1.2`. Play remained
closed while `personalization` was false, then the pending action opened
automatically after consent became true. The dialog rendered as `flex` and the
iframe source became:

`https://player.vimeo.com/video/1146670446?autoplay=1&dnt=1`

## Public version-marker inventory — 2026-07-29

The read-only audit scanned all 1,123 URLs in the current Pattern sitemap:

| Published classification | Routes |
| --- | ---: |
| Explicit V2 | 819 |
| Unmarked `.page_main`, inferred V2 | 189 |
| Explicit V1 | 110 |
| Explicit V3 | 1 |
| Unknown | 4 |
| V2L | 0 |

The full route-level evidence is saved in
`audits/pvg/2026-07-29-pattern-version-markers.json` and can be refreshed with
`tools/audit-pattern-version-markers.mjs`.

The four unknown routes are:

- `/admin/consent-pro`
- `/catalog-offer`
- `/discover/home-copy`
- `/resources/prep-calculator`

`/home-v3` now returns 200 on `www.pattern.com` and is the one explicit V3
route. This is a change in the published external state; PVG did not publish it.

The 189 inferred-V2 routes are the remaining deterministic-detection gate for
legacy cutover. They must receive explicit markers or be independently reviewed
before being added to an exact route registry. PVG continues to refuse active
delivery on them by default.

The audit also checked version-like class tokens across every element. It found
no current cross-version conflicts. PVG `0.2.2` nevertheless scopes detection
to page roots so a future component class cannot become a page marker.

## Legacy module readiness

The frozen legacy assets currently referenced by PVG were reviewed for
late-loading, duplicate loading, and authored-content fallback.

| Module | Background readiness result |
| --- | --- |
| Dynamic year | Internal, repeat-safe |
| Legacy H1 normalizer | Internal; subsequent scans find no extra H1 |
| Legacy nav | Late-load gap fixed in PVG `0.2.1+`; nav has its own ready marker |
| Legacy video popup | Works when loaded after DOM ready; PVG URL dedupe prevents a second script load |
| Brand logos | Loads after DOM ready and guards its observers |
| FAQ schema | Guards duplicate schema and watches for late FAQ content |
| Legacy lazy load | Runs after DOM ready; repeated attributes are harmless |
| CTA inject | Uses execution and injected-element guards plus a content observer |
| Table of contents | Uses `data-toc-initialized` |
| Iframe popup | Works when loaded after DOM ready; PVG URL dedupe prevents a second script load |
| Pagination | One capture handler per script; PVG URL dedupe prevents a second load |
| Card animations | Late loader plus `data-card-grid-init` in the full module |
| Splide | Dependency URL and global are deduplicated |

The V3-only activation release does not take ownership of any item in this
legacy table. It keeps `legacyPolicy="preserve"`.

## Prepared V3 release and rollback

The exact V3 activation code and observation rollback are documented in
`docs/PVG-V3-RELEASE-AND-ROLLBACK.md`.

The active embed:

- activates only an explicit, conflict-free V3 page;
- preserves V1, V2, and V2L;
- keeps all current global legacy scripts installed; and
- fails back to those existing scripts if PVG cannot load.

The observation embed is the tested rollback. It adds no component assets.

## Production release boundary

This repository implementation is not authorization to publish Pattern
Production, replace the global footer, publish the Pattern Library, or rename
variable collections. Each delivery layer requires separate verification and
an explicit handoff.
