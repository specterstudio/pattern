# Pattern Web Platform Assets

Source-controlled JavaScript, CSS, runtime loaders, and validation tools used by
Pattern's Webflow sites.

## Production safety

Production pages load assets from immutable Git commit URLs through jsDelivr.
Updating `main` does not publish Webflow or change a currently pinned asset.

Do not force-push shared history, rewrite published commits, or move an existing
release tag. Those commits and tags may be referenced directly by production.
See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) before preparing a release.

## Repository structure

```text
webflow/pattern.com/
  scripts/       Pattern US behavior and runtime assets
  styles/        Pattern US styles
  archive/       Legacy source retained for pinned production references
webflow/uk.pattern.com/version-split/
                 Pattern UK Shared/V1/V2 assets and verification
infra/           Runtime distribution configuration
tools/           Local build and browser regression tests
docs/            Architecture and release guidance
```

## Local setup

```bash
npm install
npx playwright install chromium
npm test
```

The test suite runs against local fixtures and does not publish or modify a
Webflow site.

## Delivery model

- Pattern US uses the consumer runtime and Pattern Version Gateway to select
  behavior for V1, V2, V2L, and V3 pages.
- Pattern's V3 library uses the library runtime profile.
- Pattern UK maintains a separate Shared/V1/V2 package under
  `webflow/uk.pattern.com/version-split/`.
- Third-party vendor code remains vendor-managed unless a retained legacy copy
  is required by an existing immutable production reference.

The runtime architecture is documented in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository hygiene

Do not commit Webflow exports, page inventories, screenshots, personal paths,
credentials, generated previews, or one-time rollout captures. Keep temporary
validation output under `output/`, which is ignored.
