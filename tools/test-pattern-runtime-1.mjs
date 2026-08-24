import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = path.join(
  projectRoot,
  'webflow/pattern.com/scripts/runtime/pattern-runtime.js',
);
const loaderPath = path.join(
  projectRoot,
  'webflow/pattern.com/scripts/runtime/pattern-runtime-loader.js',
);
const gatewayPath = path.join(
  projectRoot,
  'webflow/pattern.com/scripts/runtime/pattern-version-gateway.js',
);
const videoPopupPath = path.join(
  projectRoot,
  'webflow/pattern.com/scripts/media/video-popup.js',
);
const videoPreviewPath = path.join(
  projectRoot,
  'webflow/pattern.com/scripts/media/video-preview.js',
);
const caseStudyPath = path.join(
  projectRoot,
  'webflow/pattern.com/scripts/content/case-study-cms-slider.js',
);
const marketoComponentTwinPaths = [
  'marketo-global-css-library.html',
  'marketo-global-css-production.html',
  'marketo-footer-css-library.html',
  'marketo-footer-css-production.html',
].map((filename) =>
  path.join(
    projectRoot,
    'webflow/pattern.com/styles/v3-prep/component-twins',
    filename,
  ),
);
const runtimeSource = await fs.readFile(runtimePath, 'utf8');
const loaderSource = await fs.readFile(loaderPath, 'utf8');
const gatewaySource = await fs.readFile(gatewayPath, 'utf8');
const videoPopupSource = await fs.readFile(videoPopupPath, 'utf8');
const videoPreviewSource = await fs.readFile(videoPreviewPath, 'utf8');
const caseStudySource = await fs.readFile(caseStudyPath, 'utf8');
const marketoComponentTwinSources = await Promise.all(
  marketoComponentTwinPaths.map((filePath) => fs.readFile(filePath, 'utf8')),
);
const runtimeSRI = `sha384-${crypto
  .createHash('sha384')
  .update(runtimeSource)
  .digest('base64')}`;

const browser = await chromium.launch({ headless: true });
const results = [];

const run = async (name, task) => {
  try {
    await task();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({
      name,
      status: 'failed',
      error: error.stack || error.message,
    });
  }
};

const createRuntimePage = async ({
  html = '<main></main>',
  config = {},
  beforeRuntime,
} = {}) => {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate((value) => {
    window.PatternRuntimeConfig = value;
  }, {
    mode: 'active',
    legacyPolicy: 'gateway',
    disableDefaults: true,
    observeMutations: true,
    baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    ...config,
  });
  if (beforeRuntime) await beforeRuntime(page);
  await page.addScriptTag({ content: runtimeSource });
  await page.waitForFunction(() => window.PatternRuntime?.version === '1.0.0');
  return page;
};

const markerFixtures = [
  {
    version: 'v1',
    html: '<main class="page_main cc-v1"></main>',
  },
  {
    version: 'v2',
    html: '<main class="page_main cc-v2"></main>',
  },
  {
    version: 'v2l',
    html: '<main class="page_main cc-v2l"></main>',
  },
  {
    version: 'v3',
    html: '<main class="page_main_v3"></main>',
  },
];

await run('Library profile treats every page as V3', async () => {
  const page = await createRuntimePage({
    html: '<main class="page_main"></main>',
    config: { profile: 'library-v3' },
  });
  const inspection = await page.evaluate(() => window.PatternRuntime.inspect());
  assert.equal(inspection.profile, 'library-v3');
  assert.equal(inspection.detection.version, 'v3');
  assert.equal(inspection.detection.source, 'library-v3-profile');
  assert.equal(inspection.activation.allowed, true);
  await page.close();
});

await run('Consumer profile detects V1, V2, V2L, and V3 markers', async () => {
  for (const fixture of markerFixtures) {
    const page = await createRuntimePage({
      html: fixture.html,
      config: { profile: 'consumer' },
    });
    const inspection = await page.evaluate(() => window.PatternRuntime.inspect());
    assert.equal(inspection.detection.version, fixture.version);
    assert.equal(inspection.detection.safe, true);
    assert.equal(inspection.activation.allowed, true);
    await page.close();
  }
});

await run('Unknown and conflicting consumer pages fail closed', async () => {
  const unknownPage = await createRuntimePage({
    html: '<main class="page_main"></main>',
    config: { profile: 'consumer' },
  });
  const unknown = await unknownPage.evaluate(() => window.PatternRuntime.inspect());
  assert.equal(unknown.detection.safe, false);
  assert.equal(unknown.activation.allowed, false);
  assert.equal(unknown.activation.reason, 'unresolved-version');
  await unknownPage.close();

  const conflictPage = await createRuntimePage({
    html: '<main class="page_main cc-v1 cc-v2"></main>',
    config: { profile: 'consumer' },
  });
  const conflict = await conflictPage.evaluate(() => window.PatternRuntime.inspect());
  assert.equal(conflict.detection.safe, false);
  assert.equal(conflict.activation.allowed, false);
  assert.equal(conflict.activation.reason, 'conflicting-version-markers');
  await conflictPage.close();
});

await run('Observe mode creates a plan without loading assets', async () => {
  const page = await createRuntimePage({
    html: '<main class="page_main_v3"><div data-example></div></main>',
    config: {
      profile: 'consumer',
      mode: 'observe',
      disableDefaults: false,
    },
  });
  await page.evaluate(() => {
    window.PatternRuntime.register({
      id: 'example',
      versions: ['v3'],
      selector: '[data-example]',
      script: { src: '../example.js' },
    });
  });
  await page.waitForFunction(
    () =>
      window.PatternRuntime
        .inspect()
        .modules.find((module) => module.id === 'example')?.status === 'planned',
  );
  const state = await page.evaluate(() => ({
    inspection: window.PatternRuntime.inspect(),
    requested: [...document.scripts].some((script) => script.src.endsWith('/example.js')),
  }));
  assert.equal(state.inspection.activation.reason, 'observe-mode');
  assert.equal(state.requested, false);
  await page.close();
});

await run('A matched module script is requested once and reused', async () => {
  const page = await createRuntimePage({
    html: '<main class="page_main_v3"><div data-example></div></main>',
    config: {
      profile: 'consumer',
    },
  });
  let requests = 0;
  await page.route('https://runtime.test/webflow/pattern.com/scripts/example.js', (route) => {
    requests += 1;
    return route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.PatternExample = window.PatternExample || {
          version: '1.0.0',
          init(scope) {
            scope.querySelectorAll('[data-example]').forEach((element) => {
              element.dataset.exampleReady = 'true';
            });
          }
        };
      `,
    });
  });
  await page.evaluate(() => {
    window.PatternRuntime.register({
      id: 'example',
      versions: ['v3'],
      selector: '[data-example]',
      global: 'PatternExample',
      script: { src: '../example.js' },
    });
  });
  await page.waitForFunction(
    () => document.querySelector('[data-example]')?.dataset.exampleReady === 'true',
  );
  await page.evaluate(async () => {
    await window.PatternRuntime.scan(document);
    await window.PatternRuntime.scan(document);
  });
  assert.equal(requests, 1);
  await page.close();
});

await run('Mutation observation initializes late component markup', async () => {
  const page = await createRuntimePage({
    html: '<main class="page_main_v3"></main>',
    config: { profile: 'consumer' },
    beforeRuntime: async (target) => {
      await target.evaluate(() => {
        window.PatternLateModule = {
          version: '1.0.0',
          init(scope) {
            const element =
              scope.matches?.('[data-late]') ? scope : scope.querySelector?.('[data-late]');
            if (element) element.dataset.ready = 'true';
          },
        };
      });
    },
  });
  await page.evaluate(() => {
    window.PatternRuntime.register({
      id: 'late',
      versions: ['v3'],
      selector: '[data-late]',
      global: 'PatternLateModule',
    });
    const element = document.createElement('div');
    element.setAttribute('data-late', '');
    document.querySelector('main').appendChild(element);
  });
  await page.waitForFunction(
    () => document.querySelector('[data-late]')?.dataset.ready === 'true',
  );
  await page.close();
});

await run('Consumer pageFunctions bridge parks Runtime-owned callbacks', async () => {
  const page = await createRuntimePage({
    html: '<main class="page_main cc-v2"></main>',
    config: {
      profile: 'consumer',
      pageFunctions: ['nav', 'splideSlider'],
    },
    beforeRuntime: async (target) => {
      await target.evaluate(() => {
        window.__pageFunctionCalls = [];
        window.pageFunctions = {
          functions: {
            nav: () => window.__pageFunctionCalls.push('nav'),
            splideSlider: () => window.__pageFunctionCalls.push('splideSlider'),
            other: () => window.__pageFunctionCalls.push('other'),
          },
          executed: {},
          executeFunctions() {
            Object.entries(this.functions).forEach(([id, fn]) => {
              fn();
              this.executed[id] = true;
            });
          },
        };
      });
    },
  });
  const calls = await page.evaluate(() => {
    window.pageFunctions.executeFunctions();
    return window.__pageFunctionCalls;
  });
  assert.deepEqual(calls, ['other']);
  await page.close();
});

await run('Library V3 popup recognizes prefixed and unprefixed Video Player roots', async () => {
  for (const rootClass of [
    'video_player_wrap',
    'pattern-library-v3--video_player_wrap',
  ]) {
    const page = await createRuntimePage({
      html: `
        <main class="page_main">
          <div class="${rootClass}">
            <button data-video-player-open></button>
            <dialog data-video-player-dialog>
              <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
              <button data-video-player-close>Close</button>
            </dialog>
          </div>
        </main>
      `,
      config: {
        profile: 'library-v3',
        disableDefaults: false,
      },
      beforeRuntime: async (target) => {
        await target.evaluate(() => {
          window.PatternVideoPopup = {
            version: '1.1.3',
            init() {
              document.documentElement.dataset.popupInitialized = 'true';
            },
          };
        });
      },
    });
    await page.waitForFunction(
      () => document.documentElement.dataset.popupInitialized === 'true',
    );
    const plan = await page.evaluate(() =>
      window.PatternRuntime.plan().map((item) => item.id),
    );
    assert.equal(plan.includes('v3-video-popup'), true);
    assert.equal(plan.includes('legacy-video-popup'), false);
    await page.close();
  }
});

await run('V3 video popup preserves explicit consent and resumes after approval', async () => {
  const page = await browser.newPage();
  await page.route(
    'https://runtime.test/webflow/pattern.com/scripts/media/video-popup.js',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        headers: { 'access-control-allow-origin': '*' },
        body: videoPopupSource,
      }),
  );
  await page.setContent(`
    <main class="page_main">
      <div class="pattern-library-v3--video_player_wrap">
        <button data-video-player-open>Play</button>
        <dialog data-video-player-dialog data-consent-category="personalization">
          <iframe data-video-src="https://www.youtube.com/watch?v=K4TOrB7at0Y"></iframe>
          <button data-video-player-close aria-hidden="true">Overlay</button>
          <button data-video-player-close>Close</button>
        </dialog>
      </div>
    </main>
  `);
  await page.evaluate(() => {
    const listeners = new Map();
    const consentState = { personalization: false };
    window.__consentFixture = {
      consentState,
      listeners,
      approve() {
        consentState.personalization = true;
        listeners.get('consent-updated')?.forEach((listener) =>
          listener({ consents: consentState }),
        );
      },
    };
    window.FinsweetConsentPro = {
      consents: {
        get: () => consentState,
      },
      on(name, listener) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(listener);
      },
    };
    window.PatternRuntimeConfig = {
      profile: 'library-v3',
      mode: 'active',
      legacyPolicy: 'gateway',
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: runtimeSource });
  await page.waitForFunction(() => window.PatternVideoPopup?.version === '1.1.3');
  await page.locator('[data-video-player-open]').click();
  let state = await page.evaluate(() => {
    const dialog = document.querySelector('dialog');
    return {
      open: dialog.open,
      src: dialog.querySelector('iframe').getAttribute('src'),
    };
  });
  assert.equal(state.open, false);
  assert.equal(state.src, null);

  await page.evaluate(() => window.__consentFixture.approve());
  await page.waitForFunction(() => document.querySelector('dialog')?.open === true);
  state = await page.evaluate(() => {
    const dialog = document.querySelector('dialog');
    return {
      open: dialog.open,
      src: dialog.querySelector('iframe').getAttribute('src'),
    };
  });
  assert.equal(state.open, true);
  assert.match(state.src, /^https:\/\/www\.youtube\.com\/embed\/K4TOrB7at0Y\?/);

  await page.locator('[data-video-player-close]:not([aria-hidden="true"])').click();
  await page.waitForFunction(() => document.querySelector('dialog')?.open === false);
  state = await page.evaluate(() => ({
    src: document.querySelector('dialog iframe').getAttribute('src'),
    focusRestored: document.activeElement === document.querySelector('[data-video-player-open]'),
    bodyPosition: document.body.style.position,
    htmlOverflow: document.documentElement.style.overflow,
  }));
  assert.equal(state.src, null);
  assert.equal(state.focusRestored, true);
  assert.equal(state.bodyPosition, '');
  assert.equal(state.htmlOverflow, '');

  await page.locator('[data-video-player-open]').click();
  await page.waitForFunction(() => document.querySelector('dialog')?.open === true);
  await page.locator('[data-video-player-close][aria-hidden="true"]').click();
  await page.waitForFunction(() => document.querySelector('dialog')?.open === false);
  await page.close();
});

await run('V3 preview video hydrates near the viewport only after personalization consent', async () => {
  const mediaRequests = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route(
    'https://runtime.test/webflow/pattern.com/scripts/media/video-preview.js',
    (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        headers: { 'access-control-allow-origin': '*' },
        body: videoPreviewSource,
      }),
  );
  await page.route('https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN', (route) => {
    mediaRequests.push(route.request().url());
    return route.fulfill({
      contentType: 'video/mp4',
      body: '',
    });
  });
  await page.route('https://assets.pattern.com/runtime-rescan-preview.mp4', (route) => {
    mediaRequests.push(route.request().url());
    return route.fulfill({
      contentType: 'video/mp4',
      body: '',
    });
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
        </div>
      </section>
    </main>
  `);
  await page.evaluate(() => {
    const listeners = new Map();
    const consentState = { personalization: false };
    window.__previewConsentFixture = {
      consentState,
      approve() {
        consentState.personalization = true;
        listeners.get('consent-updated')?.forEach((listener) =>
          listener({ consents: consentState }),
        );
      },
    };
    window.FinsweetConsentPro = {
      consents: { get: () => consentState },
      on(name, listener) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(listener);
      },
    };
    window.PatternRuntimeConfig = {
      profile: 'consumer',
      mode: 'active',
      legacyPolicy: 'gateway',
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await page.addScriptTag({ content: runtimeSource });
  await page.waitForFunction(
    () =>
      window.PatternRuntime
        ?.inspect()
        .modules.find((module) => module.id === 'v3-video-preview')?.status === 'ready',
  );

  let state = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      src: video.getAttribute('src'),
      dataSrc: video.getAttribute('data-src'),
      autoplay: video.hasAttribute('autoplay'),
      preload: video.getAttribute('preload'),
      consent: video.getAttribute('fs-consent-categories'),
      popupModule: window.PatternRuntime
        .inspect()
        .modules.find((module) => module.id === 'v3-video-popup'),
    };
  });
  assert.equal(state.src, null);
  assert.equal(state.dataSrc, 'https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN');
  assert.equal(state.autoplay, false);
  assert.equal(state.preload, 'none');
  assert.equal(state.consent, 'personalization');
  assert.equal(state.popupModule.status, 'idle');
  assert.deepEqual(mediaRequests, []);

  await page.locator('#what-we-do video').scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  assert.deepEqual(mediaRequests, []);

  await page.evaluate(() => window.__previewConsentFixture.approve());
  await page.waitForFunction(() =>
    document.querySelector('video')?.hasAttribute('data-video-preview-hydrated'),
  );
  state = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      src: video.getAttribute('src'),
      autoplay: video.hasAttribute('autoplay'),
      consent: video.getAttribute('fs-consent-categories'),
    };
  });
  assert.equal(state.src, 'https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN');
  assert.equal(state.autoplay, false);
  assert.equal(state.consent, 'personalization');
  assert.equal(mediaRequests.length, 1);

  await page.evaluate(() => {
    const section = document.createElement('section');
    section.id = 'late-video-section';
    section.style.marginTop = '2000px';
    section.innerHTML = `
      <div class="video_player_wrap">
        <video
          data-src="https://assets.pattern.com/runtime-rescan-preview.mp4"
          preload="none"
          muted
          playsinline
          fs-consent-categories="personalization"
        ></video>
      </div>
    `;
    document.querySelector('main').append(section);
  });
  await page.locator('#late-video-section video').scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    document
      .querySelector('#late-video-section video')
      ?.hasAttribute('data-video-preview-hydrated'),
  );
  assert.equal(mediaRequests.length, 2);
  await page.close();
});

await run('Consumer V3 preserves authored fc-video-popup markup during migration', async () => {
  const page = await createRuntimePage({
    html: `
      <main class="page_main_v3">
        <div fc-video-popup="open"></div>
        <div fc-video-popup="component"></div>
      </main>
    `,
    config: {
      profile: 'consumer',
      mode: 'observe',
      disableDefaults: false,
    },
  });
  const plan = await page.evaluate(() =>
    window.PatternRuntime.plan().map((item) => item.id),
  );
  assert(plan.includes('legacy-video-popup'));
  assert(!plan.includes('v3-video-popup'));
  await page.close();
});

await run('Pages without Finsweet selectors request no Finsweet assets', async () => {
  const requests = [];
  const page = await createRuntimePage({
    html: '<main class="page_main_v3"><h1>Home V3</h1></main>',
    config: {
      profile: 'consumer',
      disableDefaults: false,
    },
    beforeRuntime: async (target) => {
      target.on('request', (request) => {
        if (/finsweet|socialshare/i.test(request.url())) requests.push(request.url());
      });
    },
  });

  await page.waitForTimeout(150);
  const state = await page.evaluate(() => ({
    plan: window.PatternRuntime.plan().map((item) => item.id),
    modules: window.PatternRuntime
      .inspect()
      .modules.filter((item) => item.id.startsWith('finsweet-')),
  }));

  assert.deepEqual(requests, []);
  assert.equal(state.plan.some((id) => id.startsWith('finsweet-')), false);
  assert(state.modules.every((module) => module.status === 'idle'));
  await page.close();
});

await run('Conditional Finsweet modules deduplicate scripts and restart for rescanned DOM', async () => {
  const pageErrors = [];
  const page = await createRuntimePage({
    html: '<main class="page_main_v3"></main>',
    config: {
      profile: 'consumer',
      disableDefaults: false,
    },
    beforeRuntime: async (target) => {
      target.on('console', (message) => {
        if (message.type() === 'error') pageErrors.push(message.text());
      });
    },
  });

  let attributesRequests = 0;
  let socialShareRequests = 0;
  await page.route('https://runtime.test/finsweet-attributes.js', (route) => {
    attributesRequests += 1;
    return route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.__finsweetLoads = [];
        window.__finsweetRestarts = [];
        window.FinsweetAttributes = {
          modules: {},
          process: new Set(),
          async load(feature) {
            if (this.process.has(feature)) return;
            this.process.add(feature);
            window.__finsweetLoads.push(feature);
            const module = this.modules[feature] ||= {};
            module.loading = Promise.resolve();
            module.restart = async () => {
              window.__finsweetRestarts.push(feature);
            };
          }
        };
      `,
    });
  });
  await page.route('https://runtime.test/finsweet-socialshare.js', (route) => {
    socialShareRequests += 1;
    return route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.__socialShareInit = 0;
        window.__socialShareDestroy = 0;
        window.fsAttributes = {
          socialshare: {
            async init() {
              window.__socialShareInit += 1;
              this.destroy = () => {
                window.__socialShareDestroy += 1;
              };
            }
          }
        };
      `,
    });
  });

  await page.evaluate(() => {
    window.PatternRuntime.registerDependency({
      id: 'finsweet-attributes-v2',
      global: 'FinsweetAttributes',
      scripts: [{ src: 'https://runtime.test/finsweet-attributes.js', type: 'module' }],
    });
    window.PatternRuntime.registerDependency({
      id: 'finsweet-social-share-v1',
      global: 'fsAttributes.socialshare',
      scripts: [
        {
          src: 'https://runtime.test/finsweet-socialshare.js',
          attributes: { 'fs-attributes-preventload': '' },
        },
      ],
    });

    const main = document.querySelector('main');
    const list = document.createElement('div');
    list.setAttribute('fs-list-element', 'list');
    const scrollDisable = document.createElement('button');
    scrollDisable.setAttribute('fs-scrolldisable-element', 'smart-nav');
    const socialShare = document.createElement('button');
    socialShare.setAttribute('fs-socialshare-element', 'twitter');
    main.append(list, scrollDisable, socialShare);
  });

  await page.waitForFunction(
    () =>
      window.__finsweetLoads?.includes('list') &&
      window.__finsweetLoads?.includes('scrolldisable') &&
      window.__socialShareInit === 1,
  );

  let state = await page.evaluate(() => ({
    loads: window.__finsweetLoads,
    restarts: window.__finsweetRestarts,
    socialInit: window.__socialShareInit,
    socialDestroy: window.__socialShareDestroy,
    attributesScripts: document.querySelectorAll(
      'script[src="https://runtime.test/finsweet-attributes.js"]',
    ).length,
    attributesType: document.querySelector(
      'script[src="https://runtime.test/finsweet-attributes.js"]',
    )?.type,
    socialScripts: document.querySelectorAll(
      'script[src="https://runtime.test/finsweet-socialshare.js"]',
    ).length,
    socialPreventLoad: document
      .querySelector('script[src="https://runtime.test/finsweet-socialshare.js"]')
      ?.hasAttribute('fs-attributes-preventload'),
  }));
  assert.deepEqual(state.loads.sort(), ['list', 'scrolldisable']);
  assert.deepEqual(state.restarts, []);
  assert.equal(state.socialInit, 1);
  assert.equal(state.socialDestroy, 0);
  assert.equal(state.attributesScripts, 1);
  assert.equal(state.attributesType, 'module');
  assert.equal(state.socialScripts, 1);
  assert.equal(state.socialPreventLoad, true);

  await page.evaluate(() => {
    const generatedPageButton = document.createElement('a');
    generatedPageButton.setAttribute('fs-list-element', 'page-button');
    document.querySelector('main').appendChild(generatedPageButton);
  });
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.__finsweetRestarts), []);

  await page.evaluate(() => {
    const nextList = document.createElement('div');
    nextList.setAttribute('fs-list-element', 'list');
    const nextSocialShare = document.createElement('button');
    nextSocialShare.setAttribute('fs-socialshare-element', 'facebook');
    document.querySelector('main').append(nextList, nextSocialShare);
  });
  await page.waitForFunction(
    () =>
      window.__finsweetRestarts?.filter((feature) => feature === 'list').length === 1 &&
      window.__socialShareInit === 2,
  );

  state = await page.evaluate(() => ({
    restarts: window.__finsweetRestarts,
    socialInit: window.__socialShareInit,
    socialDestroy: window.__socialShareDestroy,
  }));
  assert.deepEqual(state.restarts, ['list']);
  assert.equal(state.socialInit, 2);
  assert.equal(state.socialDestroy, 1);
  assert.equal(attributesRequests, 1);
  assert.equal(socialShareRequests, 1);
  assert.deepEqual(pageErrors, []);
  await page.close();
});

await run('V3 case study defers Swiper and GSAP until the slider approaches the viewport', async () => {
  const requests = [];
  const page = await createRuntimePage({
    html: `
      <main class="page_main_v3">
        <div data-case-study-slider style="margin-top: 5000px">
          <div class="w-dyn-items">
            <div class="w-dyn-item">
              <article class="pattern-library-v3--case-study_slider_wrap">
                <div class="pattern-library-v3--case-study_slider_visual">
                  <div class="pattern-library-v3--u-image-wrapper"><img src="about:blank" alt="One"></div>
                </div>
                <div class="pattern-library-v3--case-study_slider_content">One</div>
                <div class="pattern-library-v3--case-study_slider_controls">
                  <button data-case-study-prev>Previous</button>
                  <button data-case-study-next>Next</button>
                </div>
              </article>
            </div>
            <div class="w-dyn-item">
              <article class="pattern-library-v3--case-study_slider_wrap">
                <div class="pattern-library-v3--case-study_slider_visual">
                  <div class="pattern-library-v3--u-image-wrapper"><img src="about:blank" alt="Two"></div>
                </div>
                <div class="pattern-library-v3--case-study_slider_content">Two</div>
              </article>
            </div>
          </div>
        </div>
      </main>
    `,
    config: {
      profile: 'consumer',
      disableDefaults: false,
    },
    beforeRuntime: async (target) => {
      await target.route(
        'https://runtime.test/webflow/pattern.com/scripts/content/case-study-cms-slider.js',
        (route) =>
          route.fulfill({
            contentType: 'application/javascript',
            headers: { 'access-control-allow-origin': '*' },
            body: caseStudySource,
          }),
      );
      await target.route(
        'https://cdn.prod.website-files.com/gsap/3.15.0/gsap.min.js',
        (route) => {
          requests.push('gsap');
          return route.fulfill({
            contentType: 'application/javascript',
            headers: { 'access-control-allow-origin': '*' },
            body: 'window.gsap = { killTweensOf() {}, to() {} };',
          });
        },
      );
      await target.route(
        'https://cdn.jsdelivr.net/npm/swiper@8.4.7/swiper-bundle.min.css',
        (route) => {
          requests.push('swiper-css');
          return route.fulfill({
            contentType: 'text/css',
            headers: { 'access-control-allow-origin': '*' },
            body: '.swiper { overflow: hidden; }',
          });
        },
      );
      await target.route(
        'https://cdn.jsdelivr.net/npm/swiper@8.4.7/swiper-bundle.min.js',
        (route) => {
          requests.push('swiper-js');
          return route.fulfill({
            contentType: 'application/javascript',
            headers: { 'access-control-allow-origin': '*' },
            body: `
              window.Swiper = class Swiper {
                constructor(element, options) {
                  this.el = element;
                  this.options = options;
                  this.realIndex = 0;
                }
                destroy() {}
              };
            `,
          });
        },
      );
    },
  });

  await page.waitForFunction(
    () => document.querySelector('[data-case-study-slider-deferred]'),
  );
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => ({
    ready: document.querySelector('[data-case-study-slider]')?.hasAttribute(
      'data-case-study-slider-ready',
    ),
    module: window.PatternRuntime
      .inspect()
      .modules.find((item) => item.id === 'case-study'),
  }));
  assert.equal(before.ready, false);
  assert.deepEqual(before.module.dependencies, []);
  assert.deepEqual(requests, []);

  await page.locator('[data-case-study-slider]').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelector('[data-case-study-slider-ready]'),
  );

  assert.deepEqual(requests.sort(), ['gsap', 'swiper-css', 'swiper-js']);
  await page.close();
});

await run('V1 and V2 pages reject the V3 case study module and its dependencies', async () => {
  for (const version of ['v1', 'v2']) {
    const page = await createRuntimePage({
      html: `<main class="page_main cc-${version}"><div data-case-study-slider></div></main>`,
      config: {
        profile: 'consumer',
        disableDefaults: false,
      },
    });

    const plan = await page.evaluate(() => window.PatternRuntime.plan().map((item) => item.id));
    assert.equal(plan.includes('case-study'), false);

    await page.addScriptTag({ content: caseStudySource });
    await page.evaluate(() => window.PatternCaseStudyCMS.init(document, window.PatternRuntime));

    const state = await page.evaluate(() => ({
      styleInjected: Boolean(document.getElementById('pattern-case-study-slider-styles')),
      dependencyStatuses: window.PatternRuntime
        .inspect()
        .dependencies.filter((item) => ['gsap', 'swiper'].includes(item.id)),
    }));
    assert.equal(state.styleInjected, false);
    assert(state.dependencyStatuses.every((item) => item.status === 'idle'));
    await page.close();
  }
});

await run('V3 Marketo CSS twins leave legacy forms outside the component untouched', async () => {
  marketoComponentTwinSources.forEach((source) => {
    assert.equal(
      /(?<!\[data-marketo-form-id\] )\.mktoForm\b/.test(source),
      false,
      'Every Marketo form selector must include the V3 component root.',
    );
  });

  const page = await browser.newPage();
  const productionCss = [marketoComponentTwinSources[1], marketoComponentTwinSources[3]].join('\n');
  await page.setContent(`
    ${productionCss}
    <div class="pattern-library-v3--footer_wrap">
      <form class="mktoForm" id="mktoForm_826"></form>
      <div data-marketo-form-id="963">
        <form class="mktoForm" id="mktoForm_963"></form>
      </div>
    </div>
  `);

  const state = await page.evaluate(() => {
    const legacy = getComputedStyle(document.getElementById('mktoForm_826'));
    const current = getComputedStyle(document.getElementById('mktoForm_963'));
    return {
      legacyPrimary: legacy.getPropertyValue('--mkto-primary').trim(),
      legacyDisplay: legacy.display,
      currentPrimary: current.getPropertyValue('--mkto-primary').trim(),
      currentDisplay: current.display,
    };
  });

  assert.equal(state.legacyPrimary, '');
  assert.equal(state.legacyDisplay, 'block');
  assert.notEqual(state.currentPrimary, '');
  assert.equal(state.currentDisplay, 'flex');
  await page.close();
});

await run('Unified Runtime preserves the PVG module plan for consumer fixtures', async () => {
  const fixtures = [
    {
      version: 'v1',
      html: `
        <main class="page_main cc-v1">
          <nav class="nav_wrap"></nav>
          <div fc-video-popup="open"></div>
          <img src="about:blank">
          <div class="splide"></div>
        </main>
      `,
    },
    {
      version: 'v2',
      html: `
        <main class="page_main cc-v2">
          <div class="faq_card"></div>
          <img src="about:blank">
          <div class="w-pagination-next"></div>
        </main>
      `,
    },
    {
      version: 'v2l',
      html: `
        <main class="page_main cc-v2l">
          <nav class="nav_wrap"></nav>
          <div card-grid><div card-load></div></div>
        </main>
      `,
    },
    {
      version: 'v3',
      html: `
        <main class="page_main_v3">
          <div data-marquee></div>
          <div data-home-anchor-nav></div>
          <div class="pattern-library-v3--accordion_wrap"></div>
        </main>
      `,
    },
  ];

  for (const fixture of fixtures) {
    const oldPage = await browser.newPage();
    await oldPage.setContent(fixture.html);
    await oldPage.evaluate(() => {
      window.PatternVersionGatewayConfig = {
        mode: 'observe',
        legacyPolicy: 'gateway',
      };
    });
    await oldPage.addScriptTag({ content: gatewaySource });
    await oldPage.waitForFunction(() => window.PatternVersionGateway?.version === '0.2.5');
    const oldPlan = await oldPage.evaluate(() =>
      window.PatternVersionGateway.plan().map((item) => item.id).sort(),
    );

    const newPage = await createRuntimePage({
      html: fixture.html,
      config: {
        profile: 'consumer',
        mode: 'observe',
        disableDefaults: false,
      },
    });
    const newPlan = await newPage.evaluate(() =>
      window.PatternRuntime.plan().map((item) => item.id).sort(),
    );
    assert.deepEqual(newPlan, oldPlan, `Plan mismatch for ${fixture.version}`);
    await oldPage.close();
    await newPage.close();
  }
});

await run('Permanent bootstrap loads an integrity-checked Runtime manifest', async () => {
  const page = await browser.newPage();
  await page.route('https://assets.test/runtime/loader.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: loaderSource,
    }),
  );
  await page.route('https://assets.test/runtime/stable.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        schemaVersion: 1,
        channel: 'stable',
        enabled: true,
        runtime: {
          version: '1.0.0',
          src: 'https://assets.test/runtime/pattern-runtime.js',
          integrity: runtimeSRI,
        },
      }),
    }),
  );
  await page.route('https://assets.test/runtime/pattern-runtime.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: runtimeSource,
    }),
  );
  await page.setContent(`
    <main class="page_main"></main>
    <script
      src="https://assets.test/runtime/loader.js"
      data-pattern-runtime-profile="library-v3"
      data-pattern-runtime-channel="stable"
      data-pattern-runtime-manifest="https://assets.test/runtime/stable.json"
    ></script>
  `);
  await page.waitForFunction(() => window.PatternRuntime?.version === '1.0.0');
  const inspection = await page.evaluate(() => window.PatternRuntime.inspect());
  assert.equal(inspection.profile, 'library-v3');
  assert.equal(inspection.manifestVersion, '1.0.0');
  await page.close();
});

await run('Disabled central manifest loads no Runtime', async () => {
  const page = await browser.newPage();
  await page.route('https://assets.test/runtime/loader.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: loaderSource,
    }),
  );
  await page.route('https://assets.test/runtime/stable.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        schemaVersion: 1,
        channel: 'stable',
        enabled: false,
      }),
    }),
  );
  await page.setContent(`
    <main class="page_main"></main>
    <script
      src="https://assets.test/runtime/loader.js"
      data-pattern-runtime-profile="library-v3"
      data-pattern-runtime-channel="stable"
      data-pattern-runtime-manifest="https://assets.test/runtime/stable.json"
    ></script>
  `);
  await page.waitForFunction(() => window.__patternRuntimeLoaderPromise);
  await page.evaluate(() => window.__patternRuntimeLoaderPromise);
  const state = await page.evaluate(() => ({
    runtime: window.PatternRuntime?.version || null,
    payloads: document.querySelectorAll('[data-pattern-runtime-payload]').length,
  }));
  assert.equal(state.runtime, null);
  assert.equal(state.payloads, 0);
  await page.close();
});

await browser.close();

const failed = results.filter((result) => result.status === 'failed');
console.log(JSON.stringify({ runtimeSRI, results }, null, 2));

if (failed.length) process.exitCode = 1;
