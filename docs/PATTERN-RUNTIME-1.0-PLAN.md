# Pattern Runtime 1.0

Status: implementation candidate

Scope: Pattern V3 Library and Pattern production sites using V1, V2, V2L, or V3

Live-site writes: none during implementation and verification

## Summary

Pattern Runtime 1.0 is the single Pattern-owned JavaScript delivery system for
Webflow sites. It replaces the separate Pattern Runtime and Pattern Version
Gateway entry points.

Every site installs one permanent bootstrap once. Routine Runtime releases do
not require another Webflow footer edit. The bootstrap reads a centrally
managed release manifest and loads one immutable, integrity-checked Runtime
build.

The Runtime:

- knows whether it is running on the all-V3 Library or a mixed-version consumer
  site;
- determines whether a consumer page is V1, V2, V2L, or V3;
- detects the Pattern features present on that page;
- loads each required module and dependency once;
- preserves authored Webflow content when a module cannot load;
- supports central canary promotion, stable promotion, disable, and rollback;
- exposes one diagnostic API: `window.PatternRuntime`.

## What changes

### Current system

Pattern sites can load both:

- `pattern-runtime.js`, which detects components by selector; and
- `pattern-version-gateway.js`, which detects the page version and also loads
  components.

The overlap means both systems can attempt to own the same V3 feature.

### Pattern Runtime 1.0

There is one public system and one public global:

```js
window.PatternRuntime
```

Version routing from PVG becomes an internal Runtime responsibility. PVG is
kept in the repository only as a rollback reference during the migration. It is
not installed beside Pattern Runtime 1.0.

## Production delivery

### One-time site installation

Each site receives one permanent bootstrap:

```html
<script
  src="IMMUTABLE_PATTERN_RUNTIME_BOOTSTRAP_URL"
  integrity="IMMUTABLE_BOOTSTRAP_SRI"
  crossorigin="anonymous"
  data-pattern-runtime-profile="consumer"
  data-pattern-runtime-channel="stable"
  data-pattern-runtime-manifest="https://runtime.pattern.com/channels/stable.json"
  defer
></script>
```

The V3 Library uses the same bootstrap with:

```html
data-pattern-runtime-profile="library-v3"
```

The bootstrap URL and integrity value remain unchanged during normal Runtime
releases.

### Central release manifests

The bootstrap reads one of these centrally hosted manifests:

- `https://runtime.pattern.com/channels/canary.json`
- `https://runtime.pattern.com/channels/stable.json`

Each manifest identifies one immutable Runtime build:

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "enabled": true,
  "runtime": {
    "version": "1.0.0",
    "src": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@COMMIT/webflow/pattern.com/scripts/runtime/pattern-runtime.js",
    "integrity": "sha384-RUNTIME_HASH"
  }
}
```

Normal releases update a manifest. They do not update individual Webflow
sites.

The manifests are served from the first-party `runtime.pattern.com` Custom
Domain by the static-assets project in
`infra/pattern-runtime-distribution`. Its initial channels are disabled, and
attaching that production domain remains a separate approved deployment action.

### Release channels

`canary` is used by:

- Pattern V3 Library before stable promotion;
- Pattern US staging during cross-version verification;
- any future designated test site.

`stable` is used by production sites after the canary gate passes.

Promotion copies the already-tested immutable Runtime URL and integrity value
from `canary.json` into `stable.json`. It does not rebuild the Runtime.

## Runtime profiles

### `library-v3`

- Treats the entire Pattern Library site as V3.
- Does not require page-level V3 markers.
- Never loads V1, V2, or V2L modules.
- Loads V3 modules only when their actual component markup is present.

### `consumer`

- Detects V1, V2, V2L, or V3 from explicit page-root markers.
- Supports a reviewed route registry when an explicit marker is unavailable.
- Fails closed when a version is unknown or conflicting.
- Loads only modules allowed for the detected version.

## Version detection

Consumer-site detection order:

1. explicit page-root marker;
2. explicit Runtime configuration;
3. reviewed route registry;
4. fail closed.

Component-level classes must not determine the version of the whole page.

Conflicting page markers or a conflict between configuration and authored
markup prevent activation. Authored Webflow content remains visible.

## Module ownership

Pattern Runtime is the only owner of Pattern-managed modules after migration.
It maintains one registry, one dependency cache, one script cache, and one
style cache.

The initial registry preserves the currently validated feature set:

| Feature | Versions |
| --- | --- |
| Dynamic year | V1, V2, V2L, V3 |
| Legacy heading normalization | V1, V2, V2L |
| Legacy navigation | V1, V2, V2L |
| Legacy-markup video popup compatibility | V1, V2, V2L, V3 |
| Brand logos | V1, V2, V2L, V3 |
| FAQ schema | V1, V2, V2L |
| Legacy lazy loading | V1, V2, V2L |
| CTA injection | V1, V2, V2L, V3 |
| Table of contents | V1, V2, V2L, V3 |
| Iframe popup | V1, V2, V2L, V3 |
| Pagination | V1, V2, V2L, V3 |
| Card load/count-up animations | V1, V2, V2L, V3 |
| Splide | V1, V2, V2L |
| Marquee | V3 |
| Home anchor navigation | V3 |
| V3 H1 reveal | V3 |
| V3 case-study slider | V3 |
| Accordion | V1, V2, V2L, V3 |
| V3 video popup | V3 |

Portable selectors must support both Library source classes and Webflow’s
installed Library prefixes. Data attributes and Webflow state classes remain
unmodified.

## `pageFunctions` compatibility

Pattern US currently retains a global `pageFunctions` executor. The permanent
bootstrap installs the compatibility bridge before `DOMContentLoaded`.

The bridge prevents Runtime-owned callbacks such as `nav` and `splideSlider`
from executing before their dependencies are ready. Pattern Runtime invokes
those callbacks after the correct page version and dependencies are confirmed.

The bridge is idempotent and is enabled only for the `consumer` profile.

## Loading and failure behavior

For every matched module, Pattern Runtime:

1. confirms that the module is allowed for the detected version;
2. reuses an existing compatible global when available;
3. loads dependencies in dependency order;
4. loads styles and scripts using immutable URLs and integrity metadata;
5. calls the module’s idempotent `init()` method;
6. records status and errors in `PatternRuntime.inspect()`.

If a module fails:

- the failure is isolated to that module;
- the Runtime continues evaluating other modules;
- authored Webflow content remains available;
- a diagnostic event and warning are emitted.

Unknown or conflicting pages fail closed and receive no managed module assets.

## Public API

Pattern Runtime 1.0 exposes:

```js
window.PatternRuntime.version
window.PatternRuntime.config
window.PatternRuntime.detectVersion()
window.PatternRuntime.plan()
window.PatternRuntime.scan()
window.PatternRuntime.inspect()
window.PatternRuntime.activate()
window.PatternRuntime.observe()
window.PatternRuntime.destroy()
window.PatternRuntime.register()
window.PatternRuntime.registerDependency()
```

Runtime events use the `pattern:runtime:*` namespace.

## Central rollback

### Level 1: disable

Set the active manifest to:

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "enabled": false
}
```

The bootstrap loads no Runtime. Authored Webflow content remains available.

### Level 2: manifest rollback

Restore `stable.json` to the last verified Runtime URL and integrity value.
Sites receive the previous Runtime on the next uncached manifest request.

This is the normal rollback and does not require a Webflow publish.

### Level 3: site-footer rollback

If the permanent bootstrap itself is the problem, restore the backed-up footer:

- V3 Library Runtime baseline:
  - commit `67b1b9067494947932a1c96e9130948b7a80cdee`;
  - SRI `sha384-35qqbwYU8UzldCtXLfipbbmuVIep3uACBojgj75JZKxOdjFrWwmhqTPq6nLh67ZC`.
- Pattern US Runtime baseline:
  - commit `2ed6b54eb009d82cc02476201ae1546ccd5bb693`;
  - SRI `sha384-CiwMnsAZuxy0py4P6p1i4fc1DRXU9M88PvQCdjbBUQazExKSxxpC/0zj36JIeWHN`.
- Pattern US PVG baseline:
  - commit `7bb2b6f2fc7ae258285fbafcd643e717b64009e1`;
  - SRI `sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp`.

The user-created Webflow backups remain the final recovery point.

## Release gates

### Local gate

- JavaScript syntax passes.
- Manifest and bootstrap schemas pass.
- Every repository-owned SRI matches the exact release bytes.
- Unit/browser fixtures pass for Library, V1, V2, V2L, V3, unknown, and
  conflicting pages.
- Mutation and duplicate-loading fixtures pass.
- Consent-gated video behavior passes.
- Manifest disable and rollback fixtures pass.

### Library canary gate

- Entire site is treated as V3.
- Representative component-canvas pages initialize only their matched modules.
- Video popup, headings, marquee, anchor navigation, case studies, accordion,
  and dynamic year pass.
- No legacy module is requested.

### Pattern US staging gate

- Existing representative V1/V2/V2L/V3 browser matrix passes.
- Unknown and conflicting pages fail closed.
- `pageFunctions` navigation and Splide behavior pass.
- No duplicate Runtime-owned assets appear.
- Consent, forms, navigation, and authored fallback remain intact.

### Stable promotion gate

- Canary manifest points to the exact build tested on Library and staging.
- Runtime URL and integrity match.
- Rollback manifest is prepared before promotion.
- Production promotion changes only `stable.json`.

## Operational limits

Pattern Runtime does not:

- repair invalid component markup, missing attributes, or missing media URLs;
- replace Webflow publishing, component synchronization, or CMS authoring;
- override consent choices;
- bypass Content Security Policy, browser security, or third-party outages;
- infer an unknown consumer page version unsafely;
- guarantee features that depend on a removed third-party API;
- make destructive DOM changes when initialization fails;
- automatically publish Webflow sites.

The first page load requires access to the bootstrap host, manifest host, and
the selected immutable asset hosts. If those services are unavailable, the
Runtime fails closed and authored content remains.

The central manifest is intentionally powerful: a bad stable promotion can
affect every connected production site. Canary testing, immutable artifacts,
short manifest caching, and prepared rollback are mandatory.

## Implementation sequence

1. Preserve the existing Runtime and PVG commits as rollback references.
2. Merge version detection, legacy routing, and module loading into
   `pattern-runtime.js`.
3. Implement `library-v3` and `consumer` profiles.
4. Implement the permanent bootstrap and manifest validation.
5. Add fixtures and run the local regression gate.
6. Inject the candidate into published Library and Pattern US staging pages in
   read-only browser sessions.
7. Commit and publish immutable candidate assets.
8. Install the permanent bootstrap on Library using the canary channel.
9. Publish and verify Library.
10. Install the permanent bootstrap on Pattern US staging.
11. Publish staging and run the complete version matrix.
12. Promote the tested Runtime to stable.
13. Publish Pattern US production only after explicit approval.
14. Keep the old footer and backups until the stable observation window ends.
