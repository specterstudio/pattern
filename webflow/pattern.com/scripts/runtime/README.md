# Pattern Runtime

Pattern Runtime 1.0 is the single delivery layer for Pattern-owned Webflow
behaviors across the all-V3 Library and mixed V1/V2/V2L/V3 production sites.
It combines the former component Runtime and Pattern Version Gateway.

See [`docs/PATTERN-RUNTIME-1.0-PLAN.md`](../../../../docs/PATTERN-RUNTIME-1.0-PLAN.md)
for the operating contract, limits, release gates, and rollback plan.

## Permanent bootstrap

Webflow sites install `pattern-runtime-loader.js` once. The loader reads the
central `stable` or `canary` manifest, then loads one immutable Runtime payload
with SRI.

Routine Runtime releases update the central manifest. They do not require a
new Webflow footer edit.

Footer templates:

- `pattern-runtime-library-footer.template.html`
- `pattern-runtime-consumer-footer.template.html`

Manifest templates are under `manifests/`.

The old `pattern-version-gateway.js` and its embeds remain temporarily as
rollback references. They are not installed beside Pattern Runtime 1.0.

## Default modules

| Module group | Page versions |
| --- | --- | --- |
| Shared utilities | V1, V2, V2L, V3 |
| Finsweet List, Scroll Disable, Social Share | Matching attribute only; V1, V2, V2L, V3 |
| Legacy navigation, FAQ, lazy load, Splide | V1, V2, V2L |
| Legacy video markup compatibility | V1, V2, V2L, V3 |
| Marquee, Home anchor nav, H1 reveal, case study, V3 popup and preview video | V3 |
| Accordion | V1, V2, V2L, V3 |

The `library-v3` profile treats the entire Pattern Library as V3 without
requiring page markers. The `consumer` profile detects explicit page-root
versions and fails closed when the version is unknown or conflicting.

## Conditional Finsweet modules

Runtime loads Finsweet only when the matching authored attribute exists:

| Runtime module | Selector | Pinned entry script |
| --- | --- | --- |
| `finsweet-list` | `[fs-list-element="list"]` | `@finsweet/attributes@2.7.1/attributes.js` |
| `finsweet-scroll-disable` | `[fs-scrolldisable-element]` | `@finsweet/attributes@2.7.1/attributes.js` |
| `finsweet-social-share` | `[fs-socialshare-element]` | `@finsweet/attributes-socialshare@1.3.2/socialshare.js` |

List and Scroll Disable share one deduplicated Finsweet Attributes entry
script. Mutation rescans call the feature module's restart lifecycle only when
new matching roots appear. Social Share keeps its compatible v1 markup contract
and reinitializes only after a new Social Share root is added.

Consent Pro and every `[fs-consent-*]` attribute remain outside these modules.

## Runtime contract

Each behavior module should expose a namespaced global with:

```js
window.PatternExample = {
  version: '1.0.0',
  init(scope = document) {},
  destroy(scope = document) {},
};
```

`init` must be idempotent and support multiple component roots. Use a
`WeakMap`/`WeakSet` per root rather than a page-wide initialized flag.
`destroy` is optional but recommended for listeners, observers, timers, and
third-party instances.

## Adding a module

Register modules before or after Runtime boot:

```js
window.PatternRuntime.register({
  id: 'example',
  selector: '[data-example]',
  global: 'PatternExample',
  script: { src: 'https://example.com/example.js' },
  dependencies: ['gsap'],
});
```

Runtime deduplicates scripts and styles by resolved URL. Styles with an SRI hash
are also deduplicated by integrity, preventing the same verified stylesheet from
loading twice when transitional loaders use different immutable commit URLs. A
single MutationObserver batches added nodes and rescans only the added scopes.

## Diagnostics

Add `?pattern-runtime-debug` to a page URL or
`data-pattern-runtime-debug` to the Runtime script. Then inspect:

```js
window.PatternRuntime.inspect();
```

The Runtime also emits `pattern:runtime:*` document events for readiness,
loader state, module loading, errors, and completed scans.

## Release packaging

After committing a candidate:

```bash
node tools/build-pattern-runtime-release.mjs \
  --commit=HEAD \
  --channel=canary
```

The release output contains:

- the central manifest candidate;
- the immutable loader and Runtime URLs and SRI values;
- Library and consumer footer snippets;
- byte counts and SHA-256 checksums.

`pattern-runtime-loader.lock.json` pins the one permanent bootstrap commit.
Release packaging reads that lock, so future Runtime releases keep producing
the same loader URL and SRI instead of asking installed sites to update.

Promote the exact tested Runtime URL and integrity value from canary to stable.
Do not rebuild between testing and promotion.

## Rollback

Normal rollback changes the central stable manifest to the last verified
Runtime. An emergency manifest can set `enabled` to `false`, which loads no
Runtime and leaves authored Webflow content available. Restoring the backed-up
site footer is reserved for a bootstrap failure.

## Content contract

Runtime enhances Webflow-rendered HTML. Critical text, headings, links,
metadata, structured data, layout CSS, and LCP resources must not depend on
Runtime execution.
