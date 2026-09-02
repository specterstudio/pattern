import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Read-only controlled verifier. Published Webflow HTML is transformed in
// browser memory to mirror the saved component/prop repair, then the local
// Runtime candidate is injected. No Webflow write or publish occurs here.
const PROJECT_ROOT = '/Users/kenneth/_Projects/pattern';
const DEFAULT_RUNTIME_PATH = path.join(
  PROJECT_ROOT,
  'webflow/pattern.com/scripts/runtime/pattern-runtime.js',
);
const CONSUMER_RUNTIME_PATH =
  process.env.PATTERN_CONSUMER_RUNTIME_PATH || DEFAULT_RUNTIME_PATH;
const LIBRARY_RUNTIME_PATH =
  process.env.PATTERN_LIBRARY_RUNTIME_PATH || DEFAULT_RUNTIME_PATH;
const DEFAULT_RUNTIME_VERSION = process.env.PATTERN_RUNTIME_VERSION || '1.0.0';
const CONSUMER_RUNTIME_VERSION =
  process.env.PATTERN_CONSUMER_RUNTIME_VERSION || DEFAULT_RUNTIME_VERSION;
const LIBRARY_RUNTIME_VERSION =
  process.env.PATTERN_LIBRARY_RUNTIME_VERSION || DEFAULT_RUNTIME_VERSION;
const DIRECT_LEGACY_MODE = process.env.PATTERN_DIRECT_LEGACY_MODE === '1';
const OUTPUT_PATH =
  process.env.PATTERN_VIDEO_OUTPUT ||
  path.join(
    PROJECT_ROOT,
    'audits/pattern-runtime/2026-07-31-video-popup-saved-state-injection.json',
  );
const BASE_URL = 'https://runtime.test/webflow/pattern.com/scripts/runtime/';
const LIBRARY_URL = 'https://pattern-l3.webflow.io/cc/video';
const HOME_URL = 'https://pattern-us.webflow.io/home-v3';
const HOME_PREVIEW_URL = 'https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN';
const HOME_POPUP_URL = 'https://vimeo.com/1146670446';

const [consumerRuntimeSource, libraryRuntimeSource] = await Promise.all([
  fs.readFile(CONSUMER_RUNTIME_PATH, 'utf8'),
  fs.readFile(LIBRARY_RUNTIME_PATH, 'utf8'),
]);
const [libraryResponse, homeResponse] = await Promise.all([
  fetch(`${LIBRARY_URL}?candidate=${Date.now()}`),
  fetch(`${HOME_URL}?candidate=${Date.now()}`),
]);
if (!libraryResponse.ok || !homeResponse.ok) {
  throw new Error(
    `Published HTML fetch failed: Library ${libraryResponse.status}, Home ${homeResponse.status}`,
  );
}
const libraryRaw = await libraryResponse.text();
const homeRaw = await homeResponse.text();

const browser = await chromium.launch({ headless: true });
const transformPage = await browser.newPage();

const transformMarkup = async ({ html, isHome, popupHtml = '' }) =>
  transformPage.evaluate(
    ({ source, home, sourcePopup, homePopupUrl }) => {
      const documentCopy = new DOMParser().parseFromString(source, 'text/html');
      const rootSelector = [
        '[class~="video_player_wrap"]',
        '[class*="--video_player_wrap "]',
        '[class$="--video_player_wrap"]',
      ].join(',');
      const roots = [...documentCopy.querySelectorAll(rootSelector)];
      let reusablePopup = sourcePopup;

      // The verifier owns script execution. Published scripts are removed from
      // the detached copy so only the local Runtime candidate can initialize.
      documentCopy.querySelectorAll('script').forEach((script) => script.remove());

      if (!reusablePopup) {
        reusablePopup =
          documentCopy.querySelector('dialog[data-video-player-dialog]')?.outerHTML || '';
      }

      const prefixPopupClasses = (dialog) => {
        dialog.querySelectorAll('[class]').forEach((element) => {
          element.className = element.className
            .split(/\s+/)
            .filter(Boolean)
            .map((className) =>
              className.startsWith('pattern-library-v3--')
                ? className
                : `pattern-library-v3--${className}`,
            )
            .join(' ');
        });
        if (dialog.hasAttribute('class')) {
          dialog.className = dialog.className
            .split(/\s+/)
            .filter(Boolean)
            .map((className) =>
              className.startsWith('pattern-library-v3--')
                ? className
                : `pattern-library-v3--${className}`,
            )
            .join(' ');
        }
      };

      roots.forEach((root) => {
        const preview = root.querySelector('video');
        if (preview) {
          const sourceUrl = preview.getAttribute('data-src') || preview.getAttribute('src');
          if (sourceUrl) preview.setAttribute('data-src', sourceUrl);
          preview.removeAttribute('src');
          preview.removeAttribute('autoplay');
          preview.setAttribute('preload', 'none');
        }

        const isCentered = [...root.attributes].some(
          (attribute) =>
            attribute.name.includes('video-player--variant') &&
            attribute.value === 'with-button-only-center',
        );
        if (!isCentered || root.querySelector('dialog[data-video-player-dialog]')) return;
        if (!reusablePopup) return;

        const template = documentCopy.createElement('template');
        template.innerHTML = reusablePopup;
        const dialog = template.content.firstElementChild;
        if (!dialog) return;

        if (home) {
          prefixPopupClasses(dialog);
          const iframe = dialog.querySelector('iframe');
          if (iframe) {
            iframe.setAttribute('data-video-src', homePopupUrl);
            iframe.setAttribute('fs-consent-categories', 'personalization');
            iframe.removeAttribute('src');
          }
        }
        root.append(dialog);
      });

      return {
        html: `<!doctype html>${documentCopy.documentElement.outerHTML}`,
        popupHtml: reusablePopup,
      };
    },
    {
      source: html,
      home: isHome,
      sourcePopup: popupHtml,
      homePopupUrl: HOME_POPUP_URL,
    },
  );

const libraryTransformed = await transformMarkup({ html: libraryRaw, isHome: false });
const homeTransformed = await transformMarkup({
  html: homeRaw,
  isHome: true,
  popupHtml: libraryTransformed.popupHtml,
});
await transformPage.close();

const checks = [
  {
    name: 'Saved Library centered and working variants',
    url: LIBRARY_URL,
    html: libraryTransformed.html,
    profile: 'library-v3',
    runtimeSource: libraryRuntimeSource,
    runtimeVersion: LIBRARY_RUNTIME_VERSION,
    videoModuleIds: DIRECT_LEGACY_MODE
      ? ['video-popup', 'video-preview']
      : ['v3-video-popup', 'v3-video-preview'],
    home: false,
  },
  {
    name: 'Saved Home V3 centered popup and preview hydration',
    url: HOME_URL,
    html: homeTransformed.html,
    profile: 'consumer',
    runtimeSource: consumerRuntimeSource,
    runtimeVersion: CONSUMER_RUNTIME_VERSION,
    videoModuleIds: DIRECT_LEGACY_MODE
      ? ['video-popup', 'video-preview']
      : ['v3-video-popup', 'v3-video-preview'],
    home: true,
  },
];

const results = [];

for (const check of checks) {
  const context = await browser.newContext({
    viewport: check.home ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const previewRequests = [];

  await page.route(check.url, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: check.html }),
  );
  await page.route('https://runtime.test/webflow/pattern.com/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\//, '');
    const filePath = path.resolve(PROJECT_ROOT, pathname);
    if (!filePath.startsWith(`${PROJECT_ROOT}/webflow/pattern.com/`)) {
      return route.abort();
    }
    try {
      const body = await fs.readFile(filePath);
      return route.fulfill({
        status: 200,
        contentType: filePath.endsWith('.css')
          ? 'text/css'
          : 'application/javascript',
        headers: { 'access-control-allow-origin': '*' },
        body,
      });
    } catch {
      return route.abort();
    }
  });
  await page.route(/\/pattern-(?:runtime|version-gateway)\.js(?:\?|$)/, (route) => {
    if (route.request().url().startsWith('https://runtime.test/')) return route.fallback();
    return route.abort();
  });
  await page.route(/\/scripts\/media\/video-(?:popup|preview)\.js(?:\?|$)/, (route) => {
    if (route.request().url().startsWith('https://runtime.test/')) return route.fallback();
    return route.abort();
  });
  await page.route(HOME_PREVIEW_URL, (route) => {
    previewRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'video/mp4', body: '' });
  });
  await page.route('https://player.vimeo.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' }),
  );
  await page.route('https://timothyricks.us.getafile.online/**', (route) =>
    route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }),
  );
  await page.route('https://api.consentpro.com/**', (route) => route.abort());

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript({
    content: `
      window.FinsweetConsentPro = {
        consents: { get: () => ({ personalization: true }) },
        on() {}
      };
      window.PatternRuntimeConfig = {
        profile: ${JSON.stringify(check.profile)},
        mode: 'active',
        legacyPolicy: 'gateway',
        baseUrl: ${JSON.stringify(BASE_URL)}
      };
      ${check.runtimeSource}
    `,
  });

  const response = await page.goto(check.url, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForFunction(
    (version) => window.PatternRuntime?.version === version,
    check.runtimeVersion,
  );
  await page.waitForFunction(
    (moduleId) =>
      window.PatternRuntime
        .inspect()
        .modules.find((module) => module.id === moduleId)?.status === 'ready',
    check.videoModuleIds[0],
  );

  let preview = null;
  if (check.home) {
    await page.waitForTimeout(500);
    const initialRequestCount = previewRequests.length;
    const authored = await page.locator('#what-we-do video').evaluate((video) => ({
      src: video.getAttribute('src'),
      dataSrc: video.getAttribute('data-src'),
      autoplay: video.hasAttribute('autoplay'),
      preload: video.getAttribute('preload'),
      consent: video.getAttribute('fs-consent-categories'),
    }));
    await page.locator('#what-we-do video').scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      document
        .querySelector('#what-we-do video')
        ?.hasAttribute('data-video-preview-hydrated'),
    );
    preview = {
      initialRequestCount,
      authored,
      requestCountAfterApproach: previewRequests.length,
      hydratedSrc: await page
        .locator('#what-we-do video')
        .getAttribute('src'),
    };
  }

  const roots = page.locator(
    '[class~="video_player_wrap"], [class*="--video_player_wrap "], [class$="--video_player_wrap"]',
  );
  const rootCount = await roots.count();
  const popupResults = [];
  for (let index = 0; index < rootCount; index += 1) {
    const root = roots.nth(index);
    if (!(await root.locator('[data-video-player-open]').count())) continue;

    await root.locator('[data-video-player-open]').click();
    await page.waitForFunction(
      (rootIndex) =>
        document
          .querySelectorAll(
            '[class~="video_player_wrap"], [class*="--video_player_wrap "], [class$="--video_player_wrap"]',
          )
          [rootIndex]?.querySelector('dialog[data-video-player-dialog]')?.open === true,
      index,
    );
    const opened = await root.evaluate((element) => {
      const dialog = element.querySelector('dialog[data-video-player-dialog]');
      const iframe = dialog.querySelector('iframe');
      return {
        dialogOpen: dialog.open,
        iframeSrc: iframe.getAttribute('src'),
        dataVideoSrc: iframe.getAttribute('data-video-src'),
        closeControls: dialog.querySelectorAll('[data-video-player-close]').length,
      };
    });
    await root.locator('[data-video-player-close]:not([aria-hidden="true"])').click();
    await page.waitForFunction(
      (rootIndex) =>
        document
          .querySelectorAll(
            '[class~="video_player_wrap"], [class*="--video_player_wrap "], [class$="--video_player_wrap"]',
          )
          [rootIndex]?.querySelector('dialog[data-video-player-dialog]')?.open === false,
      index,
    );
    const closed = await root.evaluate((element) => ({
      iframeSrc: element
        .querySelector('dialog[data-video-player-dialog] iframe')
        .getAttribute('src'),
      focusRestored:
        document.activeElement === element.querySelector('[data-video-player-open]'),
    }));
    popupResults.push({ index, opened, closed });
  }

  const runtime = await page.evaluate((videoModuleIds) => {
    const inspection = window.PatternRuntime.inspect();
    return {
      detection: inspection.detection,
      videoModules: inspection.modules.filter((module) => videoModuleIds.includes(module.id)),
      moduleScripts: [...document.querySelectorAll('script[data-pattern-runtime-asset]')]
        .filter((script) => /video-(?:popup|preview)\.js/.test(script.src))
        .map((script) => script.src),
    };
  }, check.videoModuleIds);

  const failures = [];
  if (response?.status() !== 200) failures.push(`HTTP ${response?.status() || 0}`);
  if (!popupResults.length) failures.push('No popup variant was exercised');
  popupResults.forEach((result) => {
    if (!result.opened.dialogOpen) failures.push(`Root ${result.index} did not open`);
    if (!result.opened.iframeSrc) failures.push(`Root ${result.index} iframe did not load`);
    if (result.opened.closeControls < 2) failures.push(`Root ${result.index} close controls missing`);
    if (result.closed.iframeSrc) failures.push(`Root ${result.index} iframe did not unload`);
    if (!result.closed.focusRestored) failures.push(`Root ${result.index} focus was not restored`);
  });
  if (new Set(runtime.moduleScripts).size !== runtime.moduleScripts.length) {
    failures.push('Duplicate Runtime video scripts detected');
  }
  if (consoleErrors.length || pageErrors.length) failures.push('Console or page errors detected');
  if (check.home) {
    if (preview.initialRequestCount !== 0) failures.push('Preview loaded during initial mobile view');
    if (preview.authored.src) failures.push('Preview had an authored src');
    if (!preview.authored.dataSrc) failures.push('Preview data-src missing');
    if (preview.authored.autoplay) failures.push('Preview autoplay attribute present');
    if (preview.authored.preload !== 'none') failures.push('Preview preload is not none');
    if (preview.authored.consent !== 'personalization') {
      failures.push('Preview Consent Pro category changed');
    }
    if (preview.requestCountAfterApproach !== 1 || !preview.hydratedSrc) {
      failures.push('Preview did not hydrate near the viewport');
    }
  }

  results.push({
    name: check.name,
    url: check.url,
    status: response?.status() || 0,
    popupResults,
    preview,
    runtime,
    consoleErrors,
    pageErrors,
    failures,
  });
  await context.close();
}

await browser.close();
await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      method: 'published HTML transformed in browser memory to mirror saved Webflow state',
      published: false,
      results,
    },
    null,
    2,
  )}\n`,
);

const summary = results.map((result) => ({
  name: result.name,
  status: result.status,
  popupsExercised: result.popupResults.length,
  preview: result.preview,
  videoModules: result.runtime.videoModules.map(({ id, matched, status }) => ({
    id,
    matched,
    status,
  })),
  failures: result.failures,
}));
process.stdout.write(`${JSON.stringify({ summary, output: OUTPUT_PATH }, null, 2)}\n`);
if (results.some((result) => result.failures.length)) process.exitCode = 1;
