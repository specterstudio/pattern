import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(
  'audits/pvg/2026-07-30-us-staging-legacy-cutover-recovery',
);
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const beforeHead = read('site-head-before.html');
const beforeFooter = read('site-footer-before.html');
const beforePortalFooter = read('portal-footer-before.html');
const legacyEmbed = fs.readFileSync(
  'webflow/pattern.com/scripts/runtime/pattern-version-gateway-legacy-active-embed.html',
  'utf8',
);

function indexOfOrThrow(source, marker) {
  const index = source.indexOf(marker);
  if (index === -1) {
    throw new Error(`Missing expected cutover marker: ${marker}`);
  }
  return index;
}

function externalOrInlineScriptBlock(source, marker) {
  const start = indexOfOrThrow(source, marker);
  const endTag = '</script>';
  const end = source.indexOf(endTag, start);
  if (end === -1) {
    throw new Error(`Missing closing script tag after: ${marker}`);
  }
  return source.slice(start, end + endTag.length).trim();
}

const versionCssStart = indexOfOrThrow(
  beforeHead,
  '<!-- Pattern navigation CSS -->',
);
const consentGateStart = indexOfOrThrow(
  beforeHead,
  '<!-- =========================================================\n     CONSENT-GATED THIRD-PARTY SCRIPTS',
);
const videoPopupStart = indexOfOrThrow(
  beforeHead,
  '<!-- Pattern video popup -->',
);

const siteHeadAfter = (
  beforeHead.slice(0, versionCssStart) +
  beforeHead.slice(consentGateStart, videoPopupStart)
).trimEnd();

const footerIntroAndAutopilot = beforeFooter.slice(
  0,
  beforeFooter.indexOf(
    '</script>',
    indexOfOrThrow(beforeFooter, '<!-- Autopilot SDK'),
  ) + '</script>'.length,
);
const storylane = externalOrInlineScriptBlock(
  beforeFooter,
  '<!-- Storylane — Analytics consent -->',
);
const pageFunctionExecutor = externalOrInlineScriptBlock(
  beforeFooter,
  '<!-- Execute registered page functions -->',
);
const componentRuntime = externalOrInlineScriptBlock(
  beforeFooter,
  '<!-- Pattern Component Runtime — consumer-site modules -->',
);

const siteFooterAfter = [
  footerIntroAndAutopilot.trimEnd(),
  storylane,
  pageFunctionExecutor,
  componentRuntime,
  legacyEmbed.trim(),
].join('\n\n') + '\n';

const portalStyleEnd =
  beforePortalFooter.indexOf('</style>') + '</style>'.length;
if (portalStyleEnd < '</style>'.length) {
  throw new Error('Missing Portal Studio page style block.');
}
const portalFooterAfter =
  beforePortalFooter.slice(0, portalStyleEnd).trimEnd() + '\n';

const forbiddenHead = [
  'v1.0.8/webflow/pattern.com/styles/nav.css',
  'v1.0.8/webflow/pattern.com/styles/pagination-fix.css',
  '@splidejs/splide@4.1.4/dist/css/splide.min.css',
  'v1.0.8/webflow/pattern.com/scripts/media/video-popup.js',
];
const forbiddenFooter = [
  '@splidejs/splide@4.1.4/dist/js/splide.min.js',
  'v1.0.8/webflow/pattern.com/scripts/nav/nav.js',
  'v1.0.8/webflow/pattern.com/scripts/content/logos.js',
  'v1.0.8/webflow/pattern.com/scripts/content/rich-text-heading-conversion.js',
  'v1.0.8/webflow/pattern.com/scripts/schema/faq-schema-generator.js',
  'v1.0.8/webflow/pattern.com/scripts/interaction/accordion.js',
  'v1.0.8/webflow/pattern.com/scripts/interaction/lazy-load.js',
  'v1.0.8/webflow/pattern.com/scripts/content/cta-inject.js',
  'v1.0.8/webflow/pattern.com/scripts/content/toc.js',
  'v1.0.2/webflow/pattern.com/scripts/media/iframe-popup.js',
  'v1.0.8/webflow/pattern.com/scripts/interaction/pagination-fix.js',
  'card-load-animations-v10.js',
  "legacyPolicy: 'preserve'",
  "dataset.pvgLegacyPolicy = 'preserve'",
];

for (const value of forbiddenHead) {
  if (siteHeadAfter.includes(value)) {
    throw new Error(`Removed head dependency survived cutover: ${value}`);
  }
}
for (const value of forbiddenFooter) {
  if (siteFooterAfter.includes(value)) {
    throw new Error(`Removed footer dependency survived cutover: ${value}`);
  }
}

for (const value of [
  'api.consentpro.com',
  'window.dataLayer',
  'dev.visualwebsiteoptimizer.com',
  'app.getsignals.ai',
  '@finsweet/attributes',
  'data-pattern-organization-schema',
]) {
  if (!siteHeadAfter.includes(value)) {
    throw new Error(`Required head infrastructure is missing: ${value}`);
  }
}
for (const value of [
  'cdn.bc0a.com/autopilot',
  'js.storylane.io',
  'pageFunctions.executeFunctions',
  'pattern-runtime.js',
  "legacyPolicy: 'gateway'",
  "dataset.pvgLegacyPolicy = 'gateway'",
  "dataset.patternPvgLoader = '0.2.4'",
  '7bb2b6f2fc7ae258285fbafcd643e717b64009e1',
  'sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp',
]) {
  if (!siteFooterAfter.includes(value)) {
    throw new Error(`Required footer infrastructure is missing: ${value}`);
  }
}

if (portalFooterAfter.includes('DOMContentLoaded')) {
  throw new Error('Duplicate Portal Studio DOMContentLoaded owner survived.');
}

process.stdout.write(
  JSON.stringify(
    {
      siteHeadAfter,
      siteFooterAfter,
      portalFooterAfter,
      summary: {
        siteHeadBeforeBytes: Buffer.byteLength(beforeHead),
        siteHeadAfterBytes: Buffer.byteLength(siteHeadAfter),
        siteFooterBeforeBytes: Buffer.byteLength(beforeFooter),
        siteFooterAfterBytes: Buffer.byteLength(siteFooterAfter),
        portalFooterBeforeBytes: Buffer.byteLength(beforePortalFooter),
        portalFooterAfterBytes: Buffer.byteLength(portalFooterAfter),
      },
    },
    null,
    2,
  ),
);
