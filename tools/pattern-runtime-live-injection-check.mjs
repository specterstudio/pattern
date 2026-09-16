import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Read-only verifier. It substitutes the local candidate in browser memory and
// does not call Webflow APIs, edit Designer state, or publish.
const RUNTIME_PATH =
  '/Users/kenneth/_Projects/pattern/webflow/pattern.com/scripts/runtime/pattern-runtime.js';
const OUTPUT =
  process.env.PATTERN_RUNTIME_OUTPUT ||
  '/Users/kenneth/_Projects/pattern/audits/pattern-runtime/2026-07-30-live-injection.json';
const ASSET_COMMIT =
  process.env.PATTERN_RUNTIME_ASSET_COMMIT ||
  'a29ef9687fdf7983bb2c4fde0b2d72bf6320ec75';
const BASE_URL =
  `https://cdn.jsdelivr.net/gh/specterstudio/pattern@${ASSET_COMMIT}` +
  '/webflow/pattern.com/scripts/runtime/';

const checks = [
  {
    name: 'V3 Library video popup',
    url: 'https://pattern-l3.webflow.io/cc/video',
    profile: 'library-v3',
    expectedVersion: 'v3',
    expectedModules: ['v3-video-popup'],
    forbiddenModules: ['legacy-video-popup'],
    exerciseVideo: true,
  },
  {
    name: 'Pattern US V1',
    url: 'https://pattern-us.webflow.io/software',
    profile: 'consumer',
    expectedVersion: 'v1',
  },
  {
    name: 'Pattern US V2',
    url: 'https://pattern-us.webflow.io/',
    profile: 'consumer',
    expectedVersion: 'v2',
  },
  {
    name: 'Pattern US V3',
    url: 'https://pattern-us.webflow.io/home-v3',
    profile: 'consumer',
    expectedVersion: 'v3',
    expectedModules: [
      'marquee',
      'home-anchor-nav',
      'v3-heading-text-reveal',
      'case-study',
      'v3-video-popup',
    ],
  },
];

const runtimeSource = await fs.readFile(RUNTIME_PATH, 'utf8');
const browser = await chromium.launch({ headless: true });
const results = [];

for (const check of checks) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const consoleEntries = [];
  const requestFailures = [];

  await page.route(/\/pattern-runtime\.js(?:\?|$)/, (route) => route.abort());
  await page.route(/\/pattern-version-gateway\.js(?:\?|$)/, (route) => route.abort());

  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) return;
    const location = message.location().url || null;
    const text = message.text();
    if (
      /Pattern Runtime|Pattern PVG|integrity/i.test(`${text} ${location || ''}`) &&
      !/The legacy cutover runtime could not load/.test(text)
    ) {
      consoleEntries.push({
        type: message.type(),
        text,
        url: location,
      });
    }
  });
  page.on('pageerror', (error) => {
    if (/Pattern Runtime|Pattern PVG|integrity/i.test(error.message)) {
      consoleEntries.push({
        type: 'pageerror',
        text: error.message,
        url: null,
      });
    }
  });
  page.on('requestfailed', (request) => {
    if (
      /pattern-runtime|pattern-version-gateway|specterstudio\/pattern|@splidejs/i.test(
        request.url(),
      )
    ) {
      const error = request.failure()?.errorText || 'unknown';
      // These are the intentionally blocked published entry points.
      if (
        error === 'net::ERR_FAILED' &&
        /\/pattern-(?:runtime|version-gateway)\.js(?:\?|$)/.test(request.url())
      ) {
        return;
      }
      requestFailures.push({
        url: request.url(),
        error,
      });
    }
  });

  await page.addInitScript({
    content: `
      window.PatternRuntimeConfig = {
        profile: ${JSON.stringify(check.profile)},
        mode: 'active',
        legacyPolicy: 'gateway',
        baseUrl: ${JSON.stringify(BASE_URL)}
      };
      ${runtimeSource}
    `,
  });

  const response = await page.goto(check.url, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  try {
    await page.waitForFunction(
      () => window.PatternRuntime?.version === '1.0.0',
      null,
      { timeout: 15_000 },
    );
  } catch {
    // The state readback below records a missing candidate.
  }
  await page.waitForTimeout(2_000);

  let video = null;
  if (check.exerciseVideo) {
    video = await page.evaluate(async () => {
      const trigger = document.querySelector('[data-video-player-open]');
      if (!trigger) return { trigger: false, opened: false };

      trigger.click();
      await new Promise((resolve) => window.setTimeout(resolve, 250));

      const dialog = trigger
        .closest('[class*="video_player_wrap"]')
        ?.querySelector('dialog[data-video-player-dialog]');
      const iframe = dialog?.querySelector('iframe');

      return {
        trigger: true,
        opened:
          dialog?.getAttribute('aria-hidden') === 'false' ||
          dialog?.hasAttribute('open') ||
          Boolean(iframe?.src),
        dialogAriaHidden: dialog?.getAttribute('aria-hidden') || null,
        iframeSrc: iframe?.src || null,
      };
    });
  }

  const state = await page.evaluate(() => {
    const inspection = window.PatternRuntime?.inspect?.() || null;
    const ownedAssets = [
      ...document.querySelectorAll('[data-pattern-runtime-asset]'),
    ].map((element) => ({
      tag: element.tagName,
      module: element.getAttribute('data-pattern-runtime-module'),
      src: element.getAttribute('src') || element.getAttribute('href'),
    }));
    const duplicates = Object.entries(
      ownedAssets.reduce((counts, asset) => {
        if (!asset.src) return counts;
        counts[asset.src] = (counts[asset.src] || 0) + 1;
        return counts;
      }, {}),
    ).filter(([, count]) => count > 1);

    return {
      title: document.title,
      runtimeVersion: window.PatternRuntime?.version || null,
      legacyGatewayPresent: Boolean(window.PatternVersionGateway?.version),
      inspection,
      ownedAssets,
      duplicates,
    };
  });

  const readyModules =
    state.inspection?.modules
      ?.filter((module) => module.status === 'ready')
      .map((module) => module.id) || [];
  const moduleErrors =
    state.inspection?.modules?.filter((module) => module.status === 'error') || [];
  const failures = [];

  if (response?.status() !== 200) failures.push(`HTTP ${response?.status() || 0}`);
  if (state.runtimeVersion !== '1.0.0') failures.push('Runtime 1.0.0 missing');
  if (state.inspection?.detection?.version !== check.expectedVersion) {
    failures.push(
      `Expected ${check.expectedVersion}; detected ${
        state.inspection?.detection?.version || 'nothing'
      }`,
    );
  }
  if (state.inspection?.activation?.reason !== 'active') {
    failures.push(
      `Activation is ${state.inspection?.activation?.reason || 'missing'}`,
    );
  }
  if (state.legacyGatewayPresent) failures.push('Legacy PVG global is present');
  if (moduleErrors.length) failures.push('Runtime module errors are present');
  if (state.duplicates.length) failures.push('Duplicate Runtime assets are present');
  if (consoleEntries.length) failures.push('Runtime console errors are present');
  if (requestFailures.length) failures.push('Runtime asset requests failed');

  for (const moduleId of check.expectedModules || []) {
    if (!readyModules.includes(moduleId)) {
      failures.push(`Expected module is not ready: ${moduleId}`);
    }
  }
  for (const moduleId of check.forbiddenModules || []) {
    if (readyModules.includes(moduleId)) {
      failures.push(`Forbidden module is ready: ${moduleId}`);
    }
  }
  if (check.exerciseVideo && !video?.opened) {
    failures.push('Video popup did not open');
  }

  results.push({
    ...check,
    status: response?.status() || 0,
    runtimeVersion: state.runtimeVersion,
    detection: state.inspection?.detection || null,
    activation: state.inspection?.activation || null,
    readyModules,
    moduleErrors,
    ownedAssets: state.ownedAssets,
    duplicates: state.duplicates,
    video,
    consoleEntries,
    requestFailures,
    failures,
  });

  await context.close();
}

await browser.close();
await fs.mkdir(new URL('.', `file://${OUTPUT}`).pathname, { recursive: true });
await fs.writeFile(
  OUTPUT,
  `${JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      runtimePath: RUNTIME_PATH,
      assetCommit: ASSET_COMMIT,
      results,
    },
    null,
    2,
  )}\n`,
);

const summary = results.map((result) => ({
  name: result.name,
  status: result.status,
  detected: result.detection?.version || null,
  activation: result.activation?.reason || null,
  readyModules: result.readyModules,
  videoOpened: result.video?.opened ?? null,
  failures: result.failures,
}));

process.stdout.write(`${JSON.stringify({ summary, output: OUTPUT }, null, 2)}\n`);
if (results.some((result) => result.failures.length)) process.exitCode = 1;
