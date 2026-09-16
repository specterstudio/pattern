# Pattern UK V1/V2 Split

Phases 1 through 4 are complete. The site has explicit page markers, a
validated source split, and an isolated two-page asset-selection pilot in
saved Designer state. Nothing was published.

## Outcome

- Site: Pattern UK (`684987756493653cc7c5a406`)
- Pages inventoried: 106
- Intended V1 pages: 105
- Intended V2 pages: 1
- Existing `data-pattern-version` attributes: 0
- Pages with a deterministic marker target: 106
- Active `Custom Code` component instances: 101
- Active custom-code embeds captured: 4 of 4
- Site head and footer freeform code captured
- Page-level freeform and registered script state captured for all 106 pages

The only intended V2 page is Pattern Intelligence (`/pattern-intelligence`, page ID `6a0e3cc3ba585cc12d1c2f43`). Its `.page_main.cc-v2` root is already a reliable temporary V2 signal.

## Key finding

The present implementation cannot safely be divided by moving whole embeds.

- `01-text-style.html` is primarily the V2/Lumos foundation, but it contains global resets and utilities that may support shared components.
- `02-base.html` is primarily the V1 compatibility layer, but its selector uses `.page_code_wrap`. Because that wrapper is the active `Custom Code` component root, the supposed V1 layer is enabled on every page carrying that component—including the V2 page.
- `03-color.html` contains both a V1 grid block and the V2-priority site overrides. It must be split internally.
- `04-responsive.html` is shared Marketo form CSS, despite its historical `page_code_responsive` name.

The correct architecture therefore has four layers: Shared core, V1, V2, and feature-specific assets.

## Package contents

- `phase-1-findings.md` — findings, risks, and decisions
- `implementation-plan.md` — proposed mutation phases and approval gates
- `asset-classification.csv` — current-to-target asset map
- `page-marker-plan.csv` — all 106 intended markers and exact element IDs
- `page-root-manifest.json` — element-tree evidence
- `rollback/` — current site/page/custom-code state for rollback
- `capture-status.json` — capture completeness and non-blocking API limits

## Phase 2 verification

- 106 of 106 pages independently re-read and verified
- 105 V1 markers
- 1 V2 marker
- 0 failures
- Pattern Intelligence preserved `.page_main.cc-v2`
- Site last-published timestamp remained `2026-07-28T16:42:59.449Z`

See `phase-2-summary.md` and `phase-2-verification.json`.

## Phase 4 verification

- Immutable package: `uk-version-split-v0.4.3`
- Pilot pages: Pattern Intelligence (V2) and Our Story (V1)
- Four responsive breakpoints
- 80 of 80 CDN-backed browser checks passed
- Site last-published timestamp remained `2026-07-28T16:42:59.449Z`

See `phase-4-summary.md` and `phase-4-verification.json`.

## Next approval

Phase 5 would move from the two-page pilot to a controlled site-wide rollout.
It requires a separate plan, approval, and publication decision.
