# PVG V3 Release and Rollback

## What this release does

The V3 activation loader turns PVG on only when the page has an explicit V3
marker. V1, V2, and V2L continue using the scripts already installed on Pattern
US.

This first release does not remove or replace any legacy global scripts.

## Prepared release code

Use
`webflow/pattern.com/scripts/runtime/pattern-version-gateway-v3-active-embed.html`.

The prepared embed:

- loads PVG `0.2.3` from an immutable commit URL;
- verifies the runtime with SRI;
- sets `mode="active"`; and
- sets `legacyPolicy="preserve"`.

That combination activates explicitly marked V3 pages and refuses ambiguous,
unknown, or conflicting pages. It also preserves all V1, V2, and V2L pages.

## Exact rollback

Replace the V3 activation embed with
`webflow/pattern.com/scripts/runtime/pattern-version-gateway-embed.html` and
publish.

The observation embed immediately returns PVG to `mode="observe"` on the next
page load. Observation mode loads no component scripts or styles. The existing
production footer scripts remain the delivery path.

Removing the PVG embed completely is also safe during this release because no
legacy global scripts have been removed.

## Short Pattern US change window

Do all checks below before opening Pattern US:

1. Confirm the pinned runtime and both embeds are available from the approved
   release commit.
2. Confirm the V3 Library cards and heading pages still pass.
3. Confirm browser-only tests pass for explicit V1, explicit V2, inferred V2,
   V2L compatibility, and V3.
4. Copy the V3 activation embed before opening Pattern US.
5. Open Pattern US, replace only the PVG observation embed with the V3
   activation embed, and publish immediately.
6. Verify Home V3, one V1 page, and one V2 page.

If any check fails, perform the exact rollback above and publish immediately.

## Not part of this release

- Removing V1 or V2 scripts from the global footer
- Enabling `legacyPolicy="gateway"` on Pattern US
- Renaming variable collections
- Adding a broad route fallback for unmarked pages
- Publishing the Pattern Library or Pattern US
