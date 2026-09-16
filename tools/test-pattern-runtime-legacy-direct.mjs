import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const consumerSource = await read(
  '../webflow/pattern.com/scripts/runtime/pattern-runtime-consumer-0.2.1.js',
);
const librarySource = await read(
  '../webflow/pattern.com/scripts/runtime/pattern-runtime-library-0.3.1.js',
);
const gatewaySource = await read(
  '../webflow/pattern.com/scripts/runtime/pattern-version-gateway.js',
);
const videoPopupSource = await read('../webflow/pattern.com/scripts/media/video-popup.js');
const videoPreviewSource = await read('../webflow/pattern.com/scripts/media/video-preview.js');
const caseStudySource = await read(
  '../webflow/pattern.com/scripts/content/case-study-cms-slider.js',
);

const FINSWEET_ATTRIBUTES_URL =
  'https://cdn.jsdelivr.net/npm/@finsweet/attributes@2.7.1/attributes.js';
const FINSWEET_SOCIAL_URL =
  'https://cdn.jsdelivr.net/npm/@finsweet/attributes-socialshare@1.3.2/socialshare.js';
const FINSWEET_ATTRIBUTES_SRI =
  'sha384-xUNsiuzyRX1VYBNfbdrbjkq3Ti55JX/QAqCx7D88OakMPmepdkAsMj8bv1aa5fsj';
const FINSWEET_SOCIAL_SRI =
  'sha384-D2S3kvjqou2OO4E2xTXD1Pg9dxpLd68gdZr0CVgndB9Grh/lCwGqUsUe7vPZT/wC';

assert.ok(consumerSource.includes(FINSWEET_ATTRIBUTES_URL));
assert.ok(consumerSource.includes(FINSWEET_SOCIAL_URL));
assert.ok(consumerSource.includes(FINSWEET_ATTRIBUTES_SRI));
assert.ok(consumerSource.includes(FINSWEET_SOCIAL_SRI));
assert.ok(consumerSource.includes("const VERSION = '0.2.1'"));
assert.ok(librarySource.includes("const VERSION = '0.3.1'"));

const browser = await chromium.launch({ headless: true });
const results = [];

const run = async (name, task) => {
  try {
    await task();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', error: error.stack || error.message });
  }
};

const createRuntimePage = async ({
  html,
  source = consumerSource,
  version = '0.2.1',
  beforeRuntime,
} = {}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(html || '<main></main>');
  await page.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
      observe: true,
    };
  });
  if (beforeRuntime) await beforeRuntime(page);
  await page.addScriptTag({ content: source });
  await page.waitForFunction((expected) => window.PatternRuntime?.version === expected, version);
  return page;
};

const finsweetTestSource = consumerSource.replace(
  /integrity:\s*'sha384-(?:xUNsiuzyRX1VYBNfbdrbjkq3Ti55JX\/QAqCx7D88OakMPmepdkAsMj8bv1aa5fsj|D2S3kvjqou2OO4E2xTXD1Pg9dxpLd68gdZr0CVgndB9Grh\/lCwGqUsUe7vPZT\/wC)'/g,
  "integrity: ''",
);

await run('Home V3 without feature attributes makes zero Finsweet requests', async () => {
  const requests = [];
  const page = await browser.newPage();
  page.on('request', (request) => {
    if (/finsweet|socialshare/i.test(request.url())) requests.push(request.url());
  });
  await page.setContent(`
    <main class="page_main_v3">
      <div fs-consent-categories="personalization">Consent Pro remains authored.</div>
    </main>
  `);
  await page.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: consumerSource });
  await page.waitForFunction(() => window.PatternRuntime?.version === '0.2.1');
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => ({
    finsweet: window.PatternRuntime
      .inspect()
      .modules.filter((module) => module.id.startsWith('finsweet-')),
    consent: document.querySelector('[fs-consent-categories]')?.getAttribute(
      'fs-consent-categories',
    ),
  }));
  assert.deepEqual(requests, []);
  assert.equal(state.consent, 'personalization');
  assert.ok(state.finsweet.every((module) => module.matched === false));
  await page.close();
});

await run('Finsweet features load once and restart after Runtime rescans', async () => {
  const requests = [];
  const page = await browser.newPage();
  page.on('request', (request) => {
    if (/finsweet|socialshare/i.test(request.url())) requests.push(request.url());
  });
  await page.route(FINSWEET_ATTRIBUTES_URL, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: `
        window.__finsweetLoads = [];
        window.__finsweetRestarts = [];
        window.FinsweetAttributes = {
          modules: {},
          async load(feature) {
            window.__finsweetLoads.push(feature);
            this.modules[feature] = {
              loading: Promise.resolve(),
              restart: () => window.__finsweetRestarts.push(feature),
            };
          },
        };
      `,
    }),
  );
  await page.route(FINSWEET_SOCIAL_URL, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: `
        window.__socialInit = 0;
        window.__socialDestroy = 0;
        window.fsAttributes = {
          socialshare: {
            loading: Promise.resolve(),
            init: async () => { window.__socialInit += 1; },
            destroy: () => { window.__socialDestroy += 1; },
          },
        };
      `,
    }),
  );
  await page.setContent(`
    <main class="page_main cc-v2">
      <div fs-list-element="list"></div>
      <button fs-scrolldisable-element="toggle"></button>
      <a fs-socialshare-element="twitter"></a>
      <div fs-consent-categories="personalization"></div>
    </main>
  `);
  await page.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: finsweetTestSource });
  await page.waitForFunction(
    () =>
      window.__finsweetLoads?.includes('list') &&
      window.__finsweetLoads?.includes('scrolldisable') &&
      window.__socialInit === 1,
  );
  await page.evaluate(() => {
    const list = document.createElement('div');
    list.setAttribute('fs-list-element', 'list');
    document.body.appendChild(list);
    const social = document.createElement('a');
    social.setAttribute('fs-socialshare-element', 'facebook');
    document.body.appendChild(social);
  });
  await page.waitForFunction(
    () =>
      window.__finsweetRestarts?.filter((feature) => feature === 'list').length === 1 &&
      window.__socialInit === 2,
  );
  const state = await page.evaluate(
    ({ attributesUrl, socialUrl }) => ({
      loads: window.__finsweetLoads,
      restarts: window.__finsweetRestarts,
      socialInit: window.__socialInit,
      socialDestroy: window.__socialDestroy,
      attributesScripts: document.querySelectorAll(`script[src="${attributesUrl}"]`).length,
      socialScripts: document.querySelectorAll(`script[src="${socialUrl}"]`).length,
      socialPreventLoad: document
        .querySelector(`script[src="${socialUrl}"]`)
        ?.hasAttribute('fs-attributes-preventload'),
      consent: document.querySelector('[fs-consent-categories]').getAttribute(
        'fs-consent-categories',
      ),
    }),
    {
      attributesUrl: FINSWEET_ATTRIBUTES_URL,
      socialUrl: FINSWEET_SOCIAL_URL,
    },
  );
  assert.deepEqual([...state.loads].sort(), ['list', 'scrolldisable']);
  assert.equal(state.restarts.filter((feature) => feature === 'list').length, 1);
  assert.equal(state.socialInit, 2);
  assert.equal(state.socialDestroy, 1);
  assert.equal(state.attributesScripts, 1);
  assert.equal(state.socialScripts, 1);
  assert.equal(state.socialPreventLoad, true);
  assert.equal(state.consent, 'personalization');
  assert.equal(requests.filter((url) => url === FINSWEET_ATTRIBUTES_URL).length, 1);
  assert.equal(requests.filter((url) => url === FINSWEET_SOCIAL_URL).length, 1);

  await page.evaluate(() => {
    const generatedPageButton = document.createElement('a');
    generatedPageButton.setAttribute('fs-list-element', 'page-button');
    document.body.appendChild(generatedPageButton);
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(
      () => window.__finsweetRestarts.filter((feature) => feature === 'list').length,
    ),
    1,
  );
  await page.close();
});

await run('Consumer backport repairs popup and defers preview media', async () => {
  const mediaRequests = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/scripts/media/video-popup.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: videoPopupSource,
    }),
  );
  await page.route('**/scripts/media/video-preview.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: videoPreviewSource,
    }),
  );
  await page.route('https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN', (route) => {
    mediaRequests.push(route.request().url());
    return route.fulfill({ contentType: 'video/mp4', body: '' });
  });
  page.on('request', (request) => {
    if (/finsweet|socialshare/i.test(request.url())) mediaRequests.push(request.url());
  });
  await page.setContent(`
    <main class="page_main_v3">
      <section id="what-we-do" style="margin-top: 5000px">
        <div class="pattern-library-v3--video_player_wrap">
          <video
            data-src="https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN"
            preload="none"
            muted
            loop
            playsinline
            fs-consent-categories="personalization"
          ></video>
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog>
            <button data-video-player-close aria-hidden="true">Overlay</button>
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      </section>
    </main>
  `);
  await page.evaluate(() => {
    window.FinsweetConsentPro = {
      consents: { get: () => ({ personalization: true }) },
      on() {},
    };
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: consumerSource });
  await page.waitForFunction(
    () =>
      window.PatternRuntime?.version === '0.2.1' &&
      window.PatternVideoPopup?.version === '1.1.3' &&
      window.PatternVideoPreview?.version === '1.0.0',
  );
  let state = await page.evaluate(() => {
    const video = document.querySelector('video');
    const modules = window.PatternRuntime.inspect().modules;
    return {
      videoSrc: video.getAttribute('src'),
      dataSrc: video.getAttribute('data-src'),
      autoplay: video.hasAttribute('autoplay'),
      preload: video.getAttribute('preload'),
      consent: video.getAttribute('fs-consent-categories'),
      popup: modules.find((module) => module.id === 'video-popup'),
      preview: modules.find((module) => module.id === 'video-preview'),
    };
  });
  assert.equal(state.videoSrc, null);
  assert.equal(state.autoplay, false);
  assert.equal(state.preload, 'none');
  assert.equal(state.consent, 'personalization');
  assert.equal(state.popup.status, 'ready');
  assert.equal(state.preview.status, 'ready');
  assert.deepEqual(mediaRequests, []);

  await page.evaluate(() => {
    const opener = document.querySelector('[data-video-player-open]');
    opener.focus();
    opener.click();
  });
  await page.waitForFunction(() => document.querySelector('dialog')?.open === true);
  state = await page.evaluate(() => ({
    iframeSrc: document.querySelector('iframe').getAttribute('src'),
    videoSrc: document.querySelector('video').getAttribute('src'),
  }));
  assert.match(state.iframeSrc, /^https:\/\/player\.vimeo\.com\/video\/1146670446\?/);
  assert.equal(state.videoSrc, null);

  await page.locator('[data-video-player-close]:not([aria-hidden="true"])').click();
  await page.waitForFunction(() => document.querySelector('dialog')?.open === false);
  state = await page.evaluate(() => ({
    iframeSrc: document.querySelector('iframe').getAttribute('src'),
    focusRestored:
      document.activeElement === document.querySelector('[data-video-player-open]'),
  }));
  assert.equal(state.iframeSrc, null);
  assert.equal(state.focusRestored, true);

  await page.locator('#what-we-do video').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector('video')?.getAttribute('src')?.includes('WQ71necbZXNVhu9OrFcJN'),
  );
  assert.equal(
    mediaRequests.filter((url) => url.includes('WQ71necbZXNVhu9OrFcJN')).length,
    1,
  );
  assert.equal(mediaRequests.some((url) => /finsweet|socialshare/i.test(url)), false);
  await page.close();
});

await run('Consumer Runtime and PVG share V3 modules without duplicate scripts', async () => {
  const requests = [];
  const consoleErrors = [];
  const page = await browser.newPage();
  page.on('request', (request) => {
    if (/video-(?:popup|preview)\.js/.test(request.url())) requests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.route('**/scripts/media/video-popup.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 75));
    return route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: videoPopupSource,
    });
  });
  await page.route('**/scripts/media/video-preview.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 75));
    return route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: videoPreviewSource,
    });
  });
  await page.setContent(`
    <main class="page_main_v3">
      <div class="pattern-library-v3--video_player_wrap">
        <video data-src="https://assets.pattern.com/preview.mp4" preload="none"></video>
        <button data-video-player-open>Play</button>
        <dialog data-video-player-dialog>
          <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
          <button data-video-player-close>Close</button>
        </dialog>
      </div>
    </main>
  `);
  await page.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
    window.PatternVersionGatewayConfig = {
      mode: 'active',
      legacyPolicy: 'gateway',
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: consumerSource });
  await page.addScriptTag({ content: gatewaySource });
  await page.waitForFunction(
    () =>
      window.PatternVersionGateway?.version === '0.2.5' &&
      window.PatternVersionGateway
        .inspect()
        .modules.find((module) => module.id === 'v3-video-popup')?.status === 'ready' &&
      window.PatternVersionGateway
        .inspect()
        .modules.find((module) => module.id === 'v3-video-preview')?.status === 'ready',
  );
  assert.equal(requests.filter((url) => url.endsWith('/video-popup.js')).length, 1);
  assert.equal(requests.filter((url) => url.endsWith('/video-preview.js')).length, 1);
  assert.equal(consoleErrors.length, 0);
  await page.close();
});

await run('Consumer Runtime recognizes the prefixed Case Study component', async () => {
  const dependencyRequests = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('request', (request) => {
    if (/gsap|swiper/i.test(request.url())) dependencyRequests.push(request.url());
  });
  await page.route('**/scripts/content/case-study-cms-slider.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: caseStudySource,
    }),
  );
  await page.route('**/gsap@3.13.0/dist/gsap.min.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.gsap = { timeline() { return {}; } };',
    }),
  );
  await page.route('**/swiper@8.4.7/swiper-bundle.min.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route('**/swiper@8.4.7/swiper-bundle.min.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Swiper = class { constructor() { this.realIndex = 0; } destroy() {} };`,
    }),
  );
  const item = (index) => `
    <div class="w-dyn-item">
      <article class="pattern-library-v3--case-study_slider_wrap">
        <div class="pattern-library-v3--case-study_slider_visual">
          <div class="pattern-library-v3--u-image-wrapper"><img src="image-${index}.jpg"></div>
        </div>
        <div class="pattern-library-v3--case-study_slider_content">
          <div class="pattern-library-v3--case-study_slider_quote">Quote ${index}</div>
          <div class="pattern-library-v3--case-study_slider_name">
            <span class="pattern-library-v3--u-text">Name ${index}</span>
            <span class="pattern-library-v3--u-text">Role ${index}</span>
          </div>
          <a class="pattern-library-v3--clickable_link" href="#${index}">Read</a>
        </div>
      </article>
    </div>`;
  await page.setContent(`
    <main class="page_main_v3">
      <div data-case-study-cms-source="true" class="w-dyn-list" style="margin-top: 5000px">
        <div class="w-dyn-items">${item(1)}${item(2)}</div>
      </div>
    </main>
  `);
  await page.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: consumerSource });
  await page.waitForFunction(
    () => document.querySelector('[data-case-study-cms-source][data-case-study-slider-deferred]') !== null,
  );
  assert.deepEqual(dependencyRequests, []);
  await page.locator('[data-case-study-cms-source]').hover({ force: true });
  await page.waitForFunction(
    () => document.querySelector('[data-case-study-cms-source][data-case-study-slider-ready]') !== null,
  );
  assert.equal(dependencyRequests.filter((url) => /gsap/i.test(url)).length, 1);
  assert.equal(dependencyRequests.filter((url) => /swiper-bundle\.min\.js/i.test(url)).length, 1);
  await page.close();
});

await run('V1 and V2 keep the legacy Runtime path and base behavior', async () => {
  for (const version of ['v1', 'v2']) {
    const page = await createRuntimePage({
      html: `
        <main class="page_main cc-${version}">
          <span data-dynamic-year>2000</span>
          <div fs-consent-categories="personalization"></div>
        </main>
      `,
    });
    const state = await page.evaluate(() => ({
      year: document.querySelector('[data-dynamic-year]').textContent,
      consent: document.querySelector('[fs-consent-categories]').getAttribute(
        'fs-consent-categories',
      ),
      modules: window.PatternRuntime.inspect().modules.map((module) => module.id),
    }));
    assert.equal(state.year, String(new Date().getFullYear()));
    assert.equal(state.consent, 'personalization');
    assert.ok(state.modules.includes('marquee'));
    assert.ok(state.modules.includes('accordion'));
    assert.ok(state.modules.includes('video-popup'));
    await page.close();
  }
});

await run('V3 Library recognizes prefixed and unprefixed video roots', async () => {
  const page = await browser.newPage();
  await page.route('**/scripts/media/video-popup.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: videoPopupSource,
    }),
  );
  await page.setContent(`
    <main>
      <div class="pattern-library-v3--video_player_wrap">
        <button data-video-player-open>Play prefixed</button>
        <dialog data-video-player-dialog>
          <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
          <button data-video-player-close>Close</button>
        </dialog>
      </div>
      <div class="video_player_wrap">
        <button data-video-player-open>Play unprefixed</button>
        <dialog data-video-player-dialog>
          <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
          <button data-video-player-close>Close</button>
        </dialog>
      </div>
    </main>
  `);
  await page.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: librarySource });
  await page.waitForFunction(
    () =>
      window.PatternRuntime?.version === '0.3.1' &&
      document.querySelectorAll('[data-video-player-popup-initialized]').length === 2,
  );
  const state = await page.evaluate(() => ({
    popup: window.PatternRuntime
      .inspect()
      .modules.find((module) => module.id === 'video-popup'),
    finsweetModules: window.PatternRuntime
      .inspect()
      .modules.filter((module) => module.id.startsWith('finsweet-')).length,
  }));
  assert.equal(state.popup.status, 'ready');
  assert.equal(state.popup.matched, true);
  assert.equal(state.finsweetModules, 0);
  await page.close();
});

await browser.close();

const failures = results.filter((result) => result.status === 'failed');
results.forEach((result) => {
  console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${result.name}`);
  if (result.error) console.error(result.error);
});
if (failures.length) process.exitCode = 1;
