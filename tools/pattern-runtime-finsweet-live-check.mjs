import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Read-only verifier. Published Runtime/PVG/Finsweet entry points are blocked
// in browser memory and replaced with the local Runtime candidate. No Webflow
// API, Designer, or publishing operation is used.
const RUNTIME_PATH =
  process.env.PATTERN_RUNTIME_PATH ||
  '/Users/kenneth/_Projects/pattern/webflow/pattern.com/scripts/runtime/pattern-runtime.js';
const EXPECTED_VERSION = process.env.PATTERN_RUNTIME_VERSION || '1.0.0';
const OUTPUT =
  process.env.PATTERN_RUNTIME_OUTPUT ||
  '/Users/kenneth/_Projects/pattern/audits/pattern-runtime/2026-07-31-finsweet-live-injection.json';
const BASE_URL =
  'https://runtime.test/webflow/pattern.com/scripts/runtime/';
const PROJECT_ROOT = '/Users/kenneth/_Projects/pattern';
const BLOCKED_GLOBALS = [
  'https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js',
  'https://cdn.jsdelivr.net/npm/@finsweet/attributes-socialshare@1/socialshare.js',
];
const checks = [
  {
    name: 'Home V3 has no Finsweet feature requests',
    url: 'https://www.pattern.com/home-v3',
    expectedModules: [],
    expectedSelectors: [],
  },
  {
    name: 'Resources Blog loads List and Scroll Disable',
    url: 'https://www.pattern.com/resources/blog',
    expectedModules: ['finsweet-list', 'finsweet-scroll-disable'],
    expectedSelectors: ['[fs-list-element]', '[fs-scrolldisable-element]'],
  },
  {
    name: 'Leadership loads Scroll Disable only',
    url: 'https://www.pattern.com/about/leadership',
    expectedModules: ['finsweet-scroll-disable'],
    expectedSelectors: ['[fs-scrolldisable-element]'],
  },
  {
    name: 'News template loads Social Share and Scroll Disable',
    url:
      'https://www.pattern.com/news/pattern-reports-record-first-quarter-2026-financial-results',
    expectedModules: ['finsweet-social-share', 'finsweet-scroll-disable'],
    expectedSelectors: ['[fs-socialshare-element]', '[fs-scrolldisable-element]'],
    exerciseSocialShare: true,
  },
];

const runtimeSource = await fs.readFile(RUNTIME_PATH, 'utf8');
const browser = await chromium.launch({ headless: true });
const results = [];

for (const check of checks) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const candidateRequests = [];
  const blockedGlobalRequests = [];
  const consoleEntries = [];
  const requestFailures = [];
  const waitErrors = [];

  await page.route(/\/pattern-runtime\.js(?:\?|$)/, (route) => route.abort());
  await page.route(/\/pattern-version-gateway\.js(?:\?|$)/, (route) => route.abort());
  await page.route('https://runtime.test/webflow/pattern.com/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\//, '');
    const filePath = path.resolve(PROJECT_ROOT, pathname);
    if (!filePath.startsWith(`${PROJECT_ROOT}/webflow/pattern.com/`)) {
      return route.abort();
    }

    try {
      const body = await fs.readFile(filePath);
      const contentType = filePath.endsWith('.css')
        ? 'text/css'
        : 'application/javascript';
      return route.fulfill({
        status: 200,
        contentType,
        headers: { 'access-control-allow-origin': '*' },
        body,
      });
    } catch {
      return route.abort();
    }
  });
  await page.route(/cdn\.jsdelivr\.net\/npm\/@finsweet\//, (route) => {
    if (BLOCKED_GLOBALS.includes(route.request().url())) {
      blockedGlobalRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });

  page.on('request', (request) => {
    const url = request.url();
    if (
      url.includes('@finsweet/attributes@2.7.1/') ||
      url.includes('@finsweet/attributes-socialshare@1.3.2/')
    ) {
      candidateRequests.push(url);
    }
  });
  page.on('console', (message) => {
    if (!['warning', 'error'].includes(message.type())) return;
    const text = message.text();
    if (
      /Finsweet|fsAttributes|socialshare|scrolldisable|Pattern Runtime/i.test(text) &&
      !/The legacy cutover runtime could not load/.test(text)
    ) {
      consoleEntries.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => {
    if (/Finsweet|fsAttributes|socialshare|scrolldisable|Pattern Runtime/i.test(error.message)) {
      consoleEntries.push({ type: 'pageerror', text: error.message });
    }
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (
      BLOCKED_GLOBALS.includes(url) ||
      /\/pattern-(?:runtime|version-gateway)\.js(?:\?|$)/.test(url)
    ) {
      return;
    }
    if (/finsweet|socialshare/i.test(url)) {
      requestFailures.push({
        url,
        error: request.failure()?.errorText || 'unknown',
      });
    }
  });

  await page.addInitScript({
    content: `
      (() => {
        const blocked = new Set(${JSON.stringify(BLOCKED_GLOBALS)});
        const removePublishedFinsweet = () => {
          document.querySelectorAll('script[src]').forEach((script) => {
            if (blocked.has(script.src)) script.remove();
          });
        };
        const observer = new MutationObserver(removePublishedFinsweet);
        observer.observe(document, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', () => {
          removePublishedFinsweet();
          observer.disconnect();
        }, { once: true });
      })();
      window.PatternRuntimeConfig = {
        profile: 'consumer',
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
  await page.waitForFunction(
    (version) => window.PatternRuntime?.version === version,
    EXPECTED_VERSION,
    { timeout: 15_000 },
  );

  for (const moduleId of check.expectedModules) {
    try {
      await page.waitForFunction(
        (id) =>
          window.PatternRuntime
            ?.inspect()
            .modules.find((module) => module.id === id)?.status === 'ready',
        moduleId,
        { timeout: 10_000 },
      );
    } catch (error) {
      waitErrors.push({ moduleId, error: error.message });
    }
  }
  await page.waitForTimeout(1_500);

  let socialShareExercise = null;
  if (check.exerciseSocialShare) {
    socialShareExercise = await page.evaluate(() => {
      const trigger = document.querySelector(
        '[fs-socialshare-element="facebook"], [fs-socialshare-element="twitter"]',
      );
      if (!trigger) return { trigger: false, openedUrl: null };

      let openedUrl = null;
      window.open = (url) => {
        openedUrl = String(url);
        return { focus() {} };
      };
      trigger.click();
      return {
        trigger: true,
        value: trigger.getAttribute('fs-socialshare-element'),
        openedUrl,
      };
    });
  }

  const state = await page.evaluate((selectors) => {
    const inspection = window.PatternRuntime?.inspect?.() || null;
    const mainScripts = [...document.scripts]
      .map((script) => script.src)
      .filter(
        (src) =>
          src.includes('@finsweet/attributes@2.7.1/attributes.js') ||
          src.includes('@finsweet/attributes-socialshare@1.3.2/socialshare.js'),
      );
    return {
      detection: inspection?.detection || null,
      activation: inspection?.activation || null,
      modules:
        inspection?.modules
          ?.filter((module) => module.id.startsWith('finsweet-'))
          .map(({ dependencies, id, matched, status }) => ({
            id,
            status,
            matched,
            dependencies,
          })) || [],
      selectorCounts: Object.fromEntries(
        selectors.map((selector) => [selector, document.querySelectorAll(selector).length]),
      ),
      attributesVersion: window.FinsweetAttributes?.version || null,
      listVersion: window.FinsweetAttributes?.modules?.list?.version || null,
      scrollDisableVersion:
        window.FinsweetAttributes?.modules?.scrolldisable?.version || null,
      socialShareVersion: window.fsAttributes?.socialshare?.version || null,
      mainScripts,
    };
  }, check.expectedSelectors);

  const readyModules = state.modules
    .filter((module) => module.status === 'ready')
    .map((module) => module.id);
  const failures = [];
  if (response?.status() !== 200) failures.push(`HTTP ${response?.status() || 0}`);
  if (state.activation && state.activation.reason !== 'active') {
    failures.push(`Runtime activation is ${state.activation?.reason || 'missing'}`);
  }
  for (const moduleId of check.expectedModules) {
    if (!readyModules.includes(moduleId)) failures.push(`Module is not ready: ${moduleId}`);
  }
  for (const selector of check.expectedSelectors) {
    if (!state.selectorCounts[selector]) failures.push(`Selector is missing: ${selector}`);
  }
  if (!check.expectedModules.length && candidateRequests.length) {
    failures.push('Home V3 made candidate Finsweet requests');
  }
  if (state.mainScripts.length !== new Set(state.mainScripts).size) {
    failures.push('Duplicate Finsweet main scripts are present');
  }
  if (consoleEntries.length) failures.push('Finsweet/Runtime console errors are present');
  if (requestFailures.length) failures.push('Finsweet requests failed');
  if (
    check.expectedModules.some((moduleId) =>
      ['finsweet-list', 'finsweet-scroll-disable'].includes(moduleId),
    ) &&
    state.attributesVersion !== '2.7.1'
  ) {
    failures.push(`Finsweet Attributes version is ${state.attributesVersion || 'missing'}`);
  }
  if (check.expectedModules.includes('finsweet-list') && !state.listVersion) {
    failures.push('List module version is missing');
  }
  if (
    check.expectedModules.includes('finsweet-scroll-disable') &&
    !state.scrollDisableVersion
  ) {
    failures.push('Scroll Disable module version is missing');
  }
  if (
    check.expectedModules.includes('finsweet-social-share') &&
    state.socialShareVersion !== '1.3.2'
  ) {
    failures.push(`Social Share version is ${state.socialShareVersion || 'missing'}`);
  }
  if (check.exerciseSocialShare && !socialShareExercise?.openedUrl) {
    failures.push('Social Share trigger did not open a share URL');
  }

  results.push({
    ...check,
    status: response?.status() || 0,
    blockedGlobalRequests,
    candidateRequests,
    consoleEntries,
    requestFailures,
    waitErrors,
    state,
    socialShareExercise,
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
      blockedPublishedGlobals: BLOCKED_GLOBALS,
      results,
    },
    null,
    2,
  )}\n`,
);

const summary = results.map((result) => ({
  name: result.name,
  status: result.status,
  detected: result.state.detection?.version || null,
  readyModules: result.state.modules
    .filter((module) => module.status === 'ready')
    .map((module) => module.id),
  candidateRequestCount: result.candidateRequests.length,
  candidateMainScripts: result.state.mainScripts,
  socialShareOpened: result.socialShareExercise?.openedUrl || null,
  failures: result.failures,
}));
process.stdout.write(`${JSON.stringify({ summary, output: OUTPUT }, null, 2)}\n`);
if (results.some((result) => result.failures.length)) process.exitCode = 1;
