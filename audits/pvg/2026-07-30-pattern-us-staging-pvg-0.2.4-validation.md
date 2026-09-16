# Pattern US staging PVG 0.2.4 validation

Status: **Automated staging gate passed; staging is ready for handoff**

Production domains were not published.

## Publish evidence

- Target: `pattern-us.webflow.io` only
- Webflow publish result: `customDomains: []`
- Latest live staging timestamp: `2026-07-30T17:30:53Z`
- Live loader: PVG `0.2.4`
- Runtime commit:
  `7bb2b6f2fc7ae258285fbafcd643e717b64009e1`
- Runtime SRI:
  `sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp`
- Mode: `active`
- Legacy policy: `gateway`

## Representative browser gate

Kenneth confirmed that the Case Study template is V2. Its shared root marker
was corrected from `cc-v1` to `cc-v2` and republished to staging:

- Gaia and Flannels share Webflow template page
  `68224e2eae021c5c842dd3c5`.
- The live template root is now `page_main cc-v2`.
- Gaia and Flannels both resolve as explicit V2 in active gateway mode.
- The initial crawl contained 22 routes using this template; Flannels brings
  the current published scope to 23 Case Study routes.

The corrected final matrix passed:

- All 26 representative routes returned HTTP 200.
- All 26 resolved to the expected explicit V1, V2, or V3 version.
- All 26 activated PVG 0.2.4.
- No PVG module, console, or request failures were found.
- No unmanaged or duplicate PVG-owned assets were found.
- 27 count-up cards across six routes initialized horizontally and animated.
- Portal Studio Splide initialized once, produced one track/list, and moved.
- The two blog routes that returned transient HTTP 500 during the initial crawl
  returned HTTP 200 and passed the full PVG/version checks.

Evidence:
`2026-07-30-us-staging-pvg-0.2.4-browser-matrix.json`

## Full sitemap/source gate

The initial crawl inspected all 1,124 sitemap URLs at concurrency four without
a 429. The corrective publish then swapped the drafted International route for
the new Flannels CMS route, keeping the sitemap total at 1,124.

- All 1,124 routes in the final sitemap are now accounted for at HTTP 200.
- Two blog routes returned transient HTTP 500 responses during the crawl; both
  returned HTTP 200 on sequential and real-browser rechecks.
- Corrected final classification: 1,031 explicit V2, 89 explicit V1, one
  explicit V3, and three approved utility exclusions.
- No inferred or conflicting content routes remain.
- Prep Calculator, Consent Pro, and Catalog Offer are approved utility
  exclusions and are not PVG content-page blockers.
- No removed site-level legacy asset remained in the HTML source.

Raw evidence:
`2026-07-30-us-staging-pvg-0.2.4-route-crawl.json`

## Corrective staging publish

The crawl proved that International Expansion Videos was still live and
included in the sitemap despite the earlier unpublish attempt.

Its saved Webflow state was corrected and republished only to staging:

- `draft: true`
- `includeInSitemap: false`
- Staging compile timestamp: `2026-07-30T17:16:13Z`
- Final route status: HTTP 404
- Final sitemap state: absent

Evidence:
`2026-07-30-us-staging-pvg-0.2.4-international-correction.json`

## Case Study template correction

The shared Case Study template correction is complete:

- Template: `68224e2eae021c5c842dd3c5`
- Root: `page_main cc-v2`
- Gaia detection: explicit V2, active
- Flannels detection: explicit V2, active
- Count-ups: passed
- Latest staging compile: `2026-07-30T17:30:53Z`
- Corrected representative matrix: 26 of 26 passed

## Manual staging review

Kenneth reported that staging looks good. The retained manual review matrix is:

1. V1 navigation and mobile navigation on `/software`.
2. V1 card motion on `/partnership/asgtg`.
3. V2 count-up on `/case-study/gaia` and `/case-study/flannels`.
4. V2 navigation, count-up, accordion, and video popup on `/` and
   `/products/fulfillment/middle-mile`.
5. Continuous Portal Studio image-slider motion on
   `/products/the-portal-studio`.
6. Reports, News, Topics, and Whitepaper representative CMS pages.
7. V3 count-up and heading/section motion on `/home-v3`.
8. Marketo/contact forms, Consent Pro, Storylane, and relevant popup flows.

The staging gate is accepted. Production remains outside this automated rollout
and must be published manually by Kenneth.
