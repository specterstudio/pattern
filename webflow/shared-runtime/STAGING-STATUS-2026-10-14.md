# Regional runtime repair status — October 14, 2026

## Repository

Runtime source fixes were committed and pushed at `8ae77539e509723a44ad07ba6e211f99753bfaf3` on `specter/regional-transition-runtimes`, draft PR #11. Both regional packages are `1.0.0-rc.2`; reproducible build checks and 54 portable browser fixtures passed. Both commit-pinned CDN bundles returned HTTP 200 with exact SRI. Existing US runtime and canonical Library V3 source were not changed.

## UK: installed on staging

The rc.2 head replacement and 13 shared form embed corrections were saved and read back. Only Webflow staging was published, most recently at 2026-10-14 18:15:51 UTC. Production domain publish metadata remains 2026-10-14 09:53:43 UTC; the production homepage HTML hash is unchanged.

All 233 previously inventoried staging URLs return HTTP 200 with exactly one regional loader, the correct rc.2 commit, no retired version-split loader and one main-document Marketo SDK tag. A SDK inside a cross-domain vendor iframe is a separate document, not a site-global duplicate.

Fresh runtime diagnostics on Home, V2 Pattern Intelligence, Contact, Geo and a CMS report were ready with empty feature errors. Browser checks verified Home Products menu open/Escape close, V2 popup open/close, contact form 716, newsletter 914, Geo configured form 1264 and CMS report form 1389 rendering. Geo previously initialized hardcoded 1361 despite its bound form property being 1264; the shared helper now honors that property. Form initialization, bindings and regional service hooks were retained. No form was submitted.

## UK: LinkedIn fix remains an unpublished GTM draft

Container GTM-PL9XF8B workspace 34 contains two modifications:

1. LinkedIn InsightTag 2.0 template: add shared cache token `pattern-linkedin-insight-sdk` to injectScript. Google documents this as one script element with queued callbacks for concurrent calls.
2. Pause legacy tag 353, LinkedIn Insight Tag, which tracks partner 9260697 on the same Consent Updated trigger as tag 345. The current UK tag 345, MENA tag 347 (8600684), conversion tags and their consent/triggers remain intact.

The official gallery update was inspected; it still lacks a shared cache token. The narrow custom edit pauses future gallery update notifications until the template is restored, so future upgrades require deliberate review.

GTM preview on staging confirmed both distinct account tags firing once per page and one SDK. The two originally affected pages, /in-development/untitled and /other-pages/prep-calculator, each had one SDK in preview. Existing template tests have three fallback-test failures in both the original and patched code; the script-injection test passes. Preview validates the loading fix but does not certify every conversion scenario. No GTM Submit or live publication occurred. Public staging still uses the existing live GTM container until separately authorized publication.

## India: prepared, not installed

India remains on rc.1. This repair run made no India Webflow code changes and no India publication. Prepared fixes cover rc.2 dependency ordering and hero callback registration, one global Marketo SDK with 21 embed removals, five guarded page-footer TOC handlers and the corrected receiver staging origin. A report embed contains CMS bindings and requires preserving those bindings through supported Designer editing.

An interrupted Designer element-selection request created connector receipt 94cf56c3-a7a4-4a70-8d4a-5bf84febf3c0. A fresh selected-element read showed none selected. The connector's automated review does not support this operation and refused the subsequent write before dispatch. Manual receipt review is required; do not replay the uncertain selection or bypass the hold. An older unrelated US style receipt appears first in Specter Dock and must not be cleared without its own evidence.

The sender at go.pattern.com/dtp-2.html also lacks pattern-in-v1.webflow.io in its trusted staging origins. Its Marketo owner must add that origin before prefill is certified, even after receiver code is corrected.

## Remaining readiness gates

- Kenneth: resolve India's pending connector review; Codex can then install and publish its prepared changes to staging under existing authorization.
- Kenneth: separately authorize the reviewed UK GTM publication if desired; it affects production tracking as well as staging.
- Video owner: restore Vimeo 1194248611 or provide a replacement. Popup operation is repaired; playback remains unavailable.
- Migration team: verify a rebuilt V3 pilot alongside untouched legacy pages, including wildcard Foundation styles and variables. No V3 page was created in this repair run.
- Form owner/test lead: an explicitly authorized test submission and CRM receipt/attribution check remain outstanding.

A clean duplicate-free readiness sign-off for both sites remains on hold until these applicable gates are resolved.
