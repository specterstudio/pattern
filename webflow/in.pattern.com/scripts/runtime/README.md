# Pattern India transition runtime

One standalone loading entry point for India's complete-page V1/V2-to-V3 transition. Release `1.0.0-rc.1` is a staging candidate; it has not been installed or published in Webflow.

- Site: `in.pattern.com` / Webflow `6931b20b1debf2f074c9a9ed`.
- Bundle: `pattern-india-transition-runtime.js`.
- Diagnostics: `window.PatternIndiaRuntime.inspect()`.
- Configuration: `runtime.config.json`.
- Release hashes and pins: `release.json`.
- Hosted snippet: `install.template.html`; use a full pushed commit SHA.
- Retired global blocks: `cutover-inventory.json`.

Build and test through `webflow/shared-runtime/`. The [regional runtime guide](../../../shared-runtime/README.md) documents architecture, release pins, migration checks and rollback. Shared V3 feature code is pinned independently of future US changes.

Back up current site globals and prepare a complete head/footer cutover before installing the snippet. Do not append the new runtime to the old global legacy scripts/loader. Shared tracking, consent and form services retain their regional settings. Raw saved-code snapshots and the complete replacement drafts stay local.

Previously captured unmarked pages retain legacy compatibility. New pages need explicit markers. A rebuilt page needs one authoritative `data-pattern-version="v3"` marker and the complete legacy canvas/code component removed, including navigation/footer. Review Page Settings code separately.

Installed-site validation remains necessary for Foundation wildcard CSS/variables, native tag typography, navigation, sliders, CMS pagination, popups, consent and form delivery. Committing or pushing this package changes no Webflow global settings.
