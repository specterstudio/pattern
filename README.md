# Pattern Webflow Assets

Custom JavaScript, CSS, and Webflow code components supporting Pattern's
production websites. Webflow manages the pages, CMS content, and visual layouts.

## Structure

```text
webflow/pattern.com/
  scripts/          Navigation, sliders, video, animation, and shared loaders
  styles/           Hosted stylesheets
  embeds/           Source copies of scripts and styles embedded in Webflow
  code-components/  Pattern Icon and Pi Welcome Animation source
  archive/          Previously retained source and legacy dependencies
webflow/uk.pattern.com/version-split/
  css/              Shared, V1, V2, and feature styles used on the UK site
  js/               UK version loader and its supporting scripts
docs/               Production source references and maintenance instructions
```

## Production source baseline

The September 21, 2026 update adds source verified against 123 published US and
UK pages, the assets those pages reference, and the deployed Webflow component
bundle. It is a representative dependency review, not an exhaustive page crawl.
See [Production sources](docs/PRODUCTION-SOURCES.md) for the exact references,
verification method, and maintenance boundaries.

The source added in that update excludes local experiments, library-only
preparations, unused delivery infrastructure, raw exports, and generated
previews. Older files already present in this repository remain available;
their presence alone does not establish current production use.

## Code changes and website releases

- **Commit and push:** save reviewed source changes to GitHub.
- **Publish or deploy:** make a selected version available to site visitors.

The verified hosted assets use specific Git commits or release tags through
jsDelivr. Inline embeds and code components have their own Webflow delivery
steps. Updating this repository does not update those production references.

Never move an existing release tag or rewrite a commit used by a live site.
Different sites may load different versions of the same path. Consult the
production source record before changing an asset reference; do not replace a
pinned reference with `@main`.

## Code components

See [the code component instructions](webflow/pattern.com/code-components/README.md)
to install dependencies, validate the source, and build a local bundle.

Do not commit credentials, local tool settings, Webflow exports, browser logs,
screenshots, generated build folders, or temporary audit output.
