# Pattern Runtime

Pattern Runtime is the shared delivery layer for Pattern-owned Webflow behavior
across the V3 library and mixed V1/V2/V2L/V3 consumer sites.

## Current assets

| Asset | Role |
| --- | --- |
| `pattern-runtime-consumer-0.2.1.js` | Consumer-site runtime currently used with the version gateway |
| `pattern-runtime-library-0.3.1.js` | V3 library runtime |
| `pattern-version-gateway.js` | Detects page generation and activates compatible modules |
| `pattern-runtime.js` | Unified runtime candidate |
| `pattern-runtime-loader.js` | Manifest-driven bootstrap for the unified runtime |

Production references must use immutable commit URLs and matching SRI values.
The loader and channel manifests are not activated merely by committing them.

## Module contract

Each behavior module should expose a namespaced, repeat-safe global:

```js
window.PatternExample = {
  version: '1.0.0',
  init(scope = document) {},
  destroy(scope = document) {},
};
```

Use a `WeakMap` or `WeakSet` per component root instead of a page-wide
initialized flag. Runtime modules must preserve authored content when a
dependency fails or JavaScript is unavailable.

## Conditional dependencies

Runtime loads Finsweet only when its authored attribute is present. Consent Pro
and all `[fs-consent-*]` behavior remain outside the runtime's Finsweet module
selection.

## Diagnostics

Add `?pattern-runtime-debug` to the page URL or
`data-pattern-runtime-debug` to the runtime script, then inspect:

```js
window.PatternRuntime.inspect();
```

The runtime emits `pattern:runtime:*` document events for readiness, loading,
errors, and completed scans.

## Testing and releases

Run the repository test suite before preparing a release:

```bash
npm test
```

For the unified runtime release package:

```bash
npm run build:runtime-release -- --commit=HEAD --channel=canary
```

See `docs/OPERATIONS.md` for release and rollback requirements.
