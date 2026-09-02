# Pattern Runtime 1.0: conditional Finsweet loading

Status: implemented and verified locally against published Pattern US pages.
Nothing was published and the current Webflow global tags were not removed.

## Runtime contract

| Runtime module | Exact selector | Exact pinned entry script |
| --- | --- | --- |
| `finsweet-list` | `[fs-list-element="list"]` | `https://cdn.jsdelivr.net/npm/@finsweet/attributes@2.7.1/attributes.js` |
| `finsweet-scroll-disable` | `[fs-scrolldisable-element]` | `https://cdn.jsdelivr.net/npm/@finsweet/attributes@2.7.1/attributes.js` |
| `finsweet-social-share` | `[fs-socialshare-element]` | `https://cdn.jsdelivr.net/npm/@finsweet/attributes-socialshare@1.3.2/socialshare.js` |

List and Scroll Disable share the same dependency and entry script. Runtime
deduplicates it, loads only the requested feature, and calls the Finsweet module
restart lifecycle when a later DOM rescan finds new matching elements. Social
Share uses the compatible 1.3.2 package, prevents the package's automatic
initialization, and lets Runtime own its init/destroy lifecycle.

The pinned script integrity values are:

- Finsweet Attributes 2.7.1: `sha384-xUNsiuzyRX1VYBNfbdrbjkq3Ti55JX/QAqCx7D88OakMPmepdkAsMj8bv1aa5fsj`
- Finsweet Social Share 1.3.2: `sha384-D2S3kvjqou2OO4E2xTXD1Pg9dxpLd68gdZr0CVgndB9Grh/lCwGqUsUe7vPZT/wC`

Consent Pro and `[fs-consent-*]` are explicitly outside this change.

## Published Pattern US audit

Audit source: all 1,125 routes in `https://www.pattern.com/sitemap.xml` on
2026-07-31. All 1,125 returned successfully.

- `[fs-list-element]`: 7 pages.
- `[fs-scrolldisable-element]`: 1,121 pages. The authored value is `smart-nav`.
- `[fs-socialshare-element]`: 196 CMS pages across five template page IDs.
- Home V3, page ID `6a656092be4c857f62571add`: zero matches for all three selectors.

The seven List pages are:

| Page | Webflow page ID | Attribute values found |
| --- | --- | --- |
| `/about/newsroom` | `67d327c7ca817d803c46cad5` | `list` |
| `/resources/blog` | `67d327c7ca817d803c46cad2` | `list`, `page-button`, `scroll-anchor-pagination` |
| `/resources/ebooks` | `67d327c7ca817d803c46cad3` | `list`, `page-button`, `scroll-anchor-pagination` |
| `/resources/partner-success-stories` | `67d327c7ca817d803c46cad7` | `list`, `page-button`, `scroll-anchor-pagination` |
| `/resources/product-demos` | `67d327c7ca817d803c46cad4` | `list`, `page-button`, `scroll-anchor-pagination` |
| `/resources/reports` | `67d327c7ca817d803c46cad6` | `list`, `page-button`, `scroll-anchor-pagination` |
| `/resources/whitepapers` | `6894e28f56f77ef40d669a8c` | `list`, `page-button`, `scroll-anchor-pagination` |

The Social Share template groups are:

| Published route group | Webflow template page ID | Routes |
| --- | --- | ---: |
| `/news/*` | `67d327c7ca817d803c46ca99` | 139 |
| `/topics/*` | `67d327c7ca817d803c46cab9` | 36 |
| `/ebook/*` | `67d327c7ca817d803c46cabb` | 13 |
| `/product-demos/*` | `67d327c7ca817d803c46cad0` | 7 |
| `/whitepaper/*` | `6894c8a639fa3a2fde5d413f` | 1 |

The full exact route records, page IDs, counts, and attribute values for all
three features are in
`audits/pattern-runtime/2026-07-31-finsweet-conditional-audit.json`.

## Controlled browser verification

The published Runtime/PVG and the two current global Finsweet entry tags were
blocked in browser memory. The local Runtime candidate was then injected into
the unchanged published markup. No Webflow write or publish was made.

| Published page | Expected result | Verified result |
| --- | --- | --- |
| `/home-v3` | No matching modules and zero Finsweet requests | Passed |
| `/resources/blog` | List + Scroll Disable; one shared Attributes entry script | Passed |
| `/about/leadership` | Scroll Disable only | Passed |
| `/news/pattern-reports-record-first-quarter-2026-financial-results` | Scroll Disable + Social Share; share trigger opens expected URL | Passed |

All checks had zero duplicate entry scripts, failed Finsweet requests, and
Finsweet/Runtime console errors. Full evidence is in
`audits/pattern-runtime/2026-07-31-finsweet-live-injection.json`.

## Approval-gated Webflow cleanup

After the Runtime candidate is released and verified in the approved Webflow
environment, open Pattern US:

`Site settings` -> `Custom code` -> `Head code`

Remove only these two global tags:

```html
<script defer src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-socialshare@1/socialshare.js"></script>
<script async type="module" src="https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js" fs-scrolldisable fs-list></script>
```

Do not remove or edit Consent Pro scripts, Finsweet Consent scripts, or any
`[fs-consent-*]` attributes. Publishing and removal require separate approval.

## Files in this implementation

- `webflow/pattern.com/scripts/runtime/pattern-runtime.js`
- `webflow/pattern.com/scripts/runtime/README.md`
- `tools/test-pattern-runtime-1.mjs`
- `tools/audit-pattern-us-finsweet.mjs`
- `tools/pattern-runtime-finsweet-live-check.mjs`
- `audits/pattern-runtime/2026-07-31-finsweet-conditional-audit.json`
- `audits/pattern-runtime/2026-07-31-finsweet-live-injection.json`
