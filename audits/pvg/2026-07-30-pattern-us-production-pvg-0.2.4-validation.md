# Pattern US production PVG 0.2.4 validation

Status: **Production rollout passed**

Kenneth manually published Pattern US production. Codex performed only
read-only post-publish verification and made no Webflow changes.

## Publish evidence

- Site: Pattern US (`67d327c7ca817d803c46c86b`)
- Production domains:
  - `https://www.pattern.com`
  - `https://pattern.com`
- Production compile timestamp: `2026-07-30T17:42:37Z`
- Live loader: PVG `0.2.4`
- Runtime commit:
  `7bb2b6f2fc7ae258285fbafcd643e717b64009e1`
- Runtime SRI:
  `sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp`
- Mode: `active`
- Legacy policy: `gateway`
- Fixed count-up asset commit:
  `aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6`

Both production domains returned the expected PVG signature without a loader
failure. The apex domain redirects to `www.pattern.com`.

## Production browser gate

The read-only production matrix completed at `2026-07-30T17:46:45Z`:

- All 27 representative V1, V2, and V3 routes returned HTTP 200.
- All 27 routes resolved to their expected explicit version.
- All 27 activated PVG 0.2.4 in gateway mode.
- PVG route failures: 0.
- PVG count-up failures: 0.
- All 30 count-up cards across seven routes initialized horizontally and
  animated.
- No unmanaged legacy PVG assets were found.
- No duplicate PVG-owned assets were found.
- No PVG module or request failures were found.

The new `/case-study/sports-direct` production route was added to the
representative matrix. It resolved as explicit V2 and all three of its
count-up cards passed.

Evidence:
`2026-07-30-us-production-pvg-0.2.4-browser-matrix.json`

## Production source and sitemap gate

- `www.pattern.com` homepage status: HTTP 200
- `pattern.com` apex status: redirects to `www.pattern.com`
- Production sitemap status: HTTP 200
- Production sitemap routes: 1,125
- Routes added since the initial staging crawl:
  - `/case-study/flannels`
  - `/case-study/sports-direct`
- Route removed since the initial staging crawl:
  - `/resources/international-expansion-videos`
- International Expansion Videos remains HTTP 404 and absent from the
  production sitemap.

Evidence:

- `2026-07-30-us-production-pvg-0.2.4-publish-check.json`
- `2026-07-30-us-production-pvg-0.2.4-apex-check.json`

## Accepted Home V3 exception

Home V3 is publicly reachable at `/home-v3`. Its saved Webflow metadata reports
`draft: false`, and the live page runs PVG 0.2.4 as explicit V3. Its eight
count-up cards passed.

Kenneth explicitly instructed Codex to ignore Home V3 on 2026-07-30. Its
publication state is therefore an accepted rollout exception and not a Pattern
US PVG release blocker.

## Result

Pattern US production has passed the PVG 0.2.4 rollout gate. No additional
Pattern US publish is required for this release. Any rollout to another Pattern
site requires its own staging and production gates.
