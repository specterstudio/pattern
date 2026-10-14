# Pattern UK transition runtime

One standalone loading entry point for UK's complete-page V1/V2-to-V3 transition. The current package version is tracked in `runtime.config.json` and `release.json`. Each release must be installed and verified on staging before production publication.

- Site: `uk.pattern.com` / Webflow `684987756493653cc7c5a406`.
- Bundle: `pattern-uk-transition-runtime.js`.
- Diagnostics: `window.PatternUKRuntime.inspect()`.
- Configuration: `runtime.config.json`.
- Release hashes and pins: `release.json`.
- Hosted snippet: `install.template.html`; use a full pushed commit SHA.
- Retired global blocks: `cutover-inventory.json`.

Build and test through `webflow/shared-runtime/`. The [regional runtime guide](../../../shared-runtime/README.md) documents architecture, release pins, migration checks and rollback. Shared V3 feature code is pinned independently of future US changes.

Back up current site globals and prepare a complete head/footer cutover before installing the snippet. Do not append the new runtime to the old global legacy scripts/loader. Shared tracking, consent and form services retain their regional settings. Raw saved-code snapshots and the complete replacement drafts stay local.

Previously captured unmarked pages retain legacy compatibility. New pages need explicit markers. A rebuilt page needs one authoritative `data-pattern-version="v3"` marker and the complete legacy canvas/code component removed, including navigation/footer. Review Page Settings code separately.

Installed-site validation remains necessary for Foundation wildcard CSS/variables, native tag typography, navigation, sliders, CMS pagination, popups, consent and form delivery. Committing or pushing this package changes no Webflow global settings.

Legacy video/iframe popup detection includes the original `fc-video-popup` and `fc-iframe-popup` attributes. Keep the existing global Marketo SDK as the single owner; form embeds retain initialization and CMS bindings. LinkedIn partner setup remains in the regional GTM container and must not be silently removed by the runtime.
