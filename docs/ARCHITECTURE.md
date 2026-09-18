# Architecture

## Asset delivery

Pattern-owned browser assets are stored in this repository and delivered by
jsDelivr from immutable Git commits or release tags. Webflow contains the
corresponding pinned URLs and integrity attributes.

This separates three actions:

1. committing source code;
2. preparing and validating an immutable asset URL; and
3. publishing a Webflow site that references that asset.

Only the third action changes what a visitor receives from Webflow.

## Pattern US

Pattern US contains multiple generations of authored pages. The runtime layer
keeps shared behavior centralized while the Pattern Version Gateway determines
the page generation and fails closed when the version is missing or
conflicting.

The main runtime files are under
`webflow/pattern.com/scripts/runtime/`. Feature implementations remain grouped
by purpose under `scripts/content`, `scripts/interaction`, `scripts/media`,
and `scripts/nav`.

Runtime modules must be repeat-safe, scope initialization to matching roots,
and avoid hiding critical content when JavaScript is unavailable.

## Pattern V3 library

The V3 library uses the library runtime profile. Components can register
behavior modules with the shared runtime while retaining authored HTML and CSS
as the accessible fallback.

## Pattern UK

Pattern UK uses a separate version-split package with Shared, V1, V2, and
feature-specific assets. Its activation contract and verification commands are
documented in `webflow/uk.pattern.com/version-split/README.md`.

## Third-party code

Consent Pro, Finsweet, Marketo, Splide, Storylane, and other vendor-managed code
remain external dependencies. A legacy copy is retained only when an existing
immutable production reference depends on that exact path.
