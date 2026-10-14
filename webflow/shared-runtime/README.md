# Pattern regional transition runtimes

One standalone runtime per regional site, maintained in the existing Pattern repository. These packages support whole-page V1/V2-to-V3 rebuilds. They are staging candidates, not installed or certified production runtimes.

## Repository boundaries

```text
webflow/
  pattern.com/                           existing US code
  in.pattern.com/scripts/runtime/        India config, bundle and release
  uk.pattern.com/scripts/runtime/        UK config, bundle and release
  shared-runtime/                        regional build template and tests
```

Keep regional entry points and overrides in their domain folders. Shared code belongs here only when both regions need it. Do not change existing US runtime files to configure India or UK. The older `uk.pattern.com/version-split/` package remains historical and is replaced at the site's loading entry point during an approved cutover.

Each regional folder includes:

- `pattern-india-transition-runtime.js` or `pattern-uk-transition-runtime.js`: the complete hosted entry point, including its engine.
- `runtime.config.json`: the region's Webflow site ID, diagnostic API, release version, legacy controllers and captured compatibility page IDs.
- `legacy-cms-reset.js`: the preserved regional legacy callback.
- `release.json`: bundle hashes, SRI, upstream pins and release status.
- `install.template.html`: hosted script snippet; replace its commit placeholder with the pushed full commit SHA.
- `cutover-inventory.json`: hashes and URLs of global blocks to retire. Full saved head/footer snapshots stay local.

India uses `PatternIndiaRuntime`; UK uses `PatternUKRuntime`. Their settings and events are separate, and each refuses to start on the wrong Webflow site. The internal `PatternRuntime` engine is bundled in each file, with the upstream US presets disabled. The regional runtime is the only orchestrator on its site's page.

Shared V3 controllers still come from their existing repository paths under `pattern.com`, pinned to a reviewed commit and integrity hash. Those URLs describe where reusable controller source lives; they do not start the US runtime. A later US commit cannot silently update these regional dependencies. Future moves into a common controller directory should be a separate reviewed change.

## Build and tests

Node 22+ is recommended. Test dependencies are development tools only.

```sh
cd webflow/shared-runtime
npm ci
npx playwright install chromium
npm run build
npm test
```

`npm run check` verifies that committed bundles, release manifests and installation templates exactly match their inputs. The test asset loader fetches public dependencies into an ignored cache and checks their recorded integrity hashes before browser tests. No raw site backups or vendor test caches are committed. The original complete-global-code drafts passed 53 local checks; this portable suite covers routing and controller behavior without including private site snapshots.

The engine vendor file is an integrity-locked capture from this same repository at `9b174800a295ad09a50e1b4d58d5004b853c81b6`. The builder adapts it for controlled startup, dependency order, bounded asset waits and version guards, while leaving the existing US source unchanged. Updating either the vendor or V3 manifest requires a review and test run.

## Release and loading

The initial version is `1.0.0-rc.1`, a staging candidate. Each site's version lives in its own config so releases can evolve independently. Update the affected version, build, test and commit. Use the pushed full Git commit SHA in the loading URL, never `main` or an unversioned branch URL. Include the SRI from that site's release manifest.

```text
https://cdn.jsdelivr.net/gh/specterstudio/pattern@<FULL_COMMIT_SHA>/webflow/in.pattern.com/scripts/runtime/pattern-india-transition-runtime.js
https://cdn.jsdelivr.net/gh/specterstudio/pattern@<FULL_COMMIT_SHA>/webflow/uk.pattern.com/scripts/runtime/pattern-uk-transition-runtime.js
```

Committing or pushing does not install these scripts into Webflow. Site-wide code changes and publication are separate actions. Before an approved cutover, back up and re-read current global code, compare the inventory hashes and prepare complete revised head/footer blocks that preserve current shared services. Never install the snippet alongside the old loader and legacy global controllers.

Place the site's config and single deferred script in its global head after consent defaults. Retain the existing page-function registration helper and shared services. Transfer version-owned behavior using the cutover inventory: legacy scripts/styles, H1 repair, copyright updating, Finsweet delivery, CMS-reset registration and the ordinary page-function executor. The replacement runtime owns their startup. UK consent defaults, Consent Pro, attribution, GTM and Marketo must retain their original behavior; India tracking/chat/VWO and regional form wiring also remain separate shared services.

Roll back by restoring the exact previous global head/footer pair. Keep those local backups until the pilot passes. Pinning the previous runtime alone is insufficient if the earlier global-code layout also changed.

## Page migration and limits

Explicit `v1`, `v2` and `v2l` markers select legacy behavior. An explicit `v3` marker selects V3 controllers. Previously captured unmarked pages use the restricted `legacy-unmarked` branch; the stored IDs are compatibility allowances, not guesses at V1 versus V2. New pages need explicit markers. Invalid/mixed markers, unmarked V3 content and another running orchestrator block startup. Page versions cannot change during a loaded session.

For each conversion, back up the page and Page Settings code, remove the entire legacy canvas/code component, rebuild with V3 and set one authoritative `data-pattern-version="v3"` marker. Remove old Body/root version markers and use the intended Production Load Version. Clearing a canvas does not remove Page Settings scripts.

The runtime routes JavaScript and its owned external styles. It does not automatically isolate Webflow tag styles, Foundation wildcard CSS, variables or component-local scripts. Before migration sprints, verify a rebuilt V3 page alongside untouched legacy pages at desktop/mobile widths, including UK Pattern Intelligence V2, navigation, sliders, CMS pagination/filtering, popups, consent and form delivery. Check initial render timing because legacy global assets now wait for completed-page version detection. These installed-site checks remain outstanding.
