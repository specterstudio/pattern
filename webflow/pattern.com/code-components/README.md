# Pattern Webflow Code Components

Source for the production **Pattern Icon** and **Pi Welcome Animation** code
components. Production instances were verified on `/pi` and `/marketplace` at
`www.pattern.com` on September 21, 2026.

## Contents

- `src/components/`: React components and Webflow property definitions.
- `src/generated/`: the 1,500-icon SVG registry imported by Pattern Icon.
  These files are required source data and must remain in Git.
- `../scripts/components/pi-welcome/`: the Pi animation JavaScript and CSS
  imported by the React wrapper. This production export is a required input;
  its original upstream application source is not part of this repository.
- `webpack.webflow.cjs`: the bundle configuration that retains the animation
  stylesheet as a file usable inside its shadow root.

## Local validation

Use Node.js 22.13 or newer, then run from this directory:

```sh
npm ci
npm run typecheck
npm run verify
npm run bundle -- --skip-update-check
```

The verification command checks the icon inventory and accessible SVG output.
Bundling produces the ignored `dist/` directory; it does not upload a library
or publish a website. `npm run preview` writes a local icon preview.

## Updating Webflow

`npm run import` is a separate upload action. Run it only as part of an
authorized Webflow library update, then verify the consuming sites separately.
Committing these source files does not import or publish the components.
