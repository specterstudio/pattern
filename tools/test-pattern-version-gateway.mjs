import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const gatewaySource = await fs.readFile(
  new URL('../webflow/pattern.com/scripts/runtime/pattern-version-gateway.js', import.meta.url),
  'utf8',
);
const videoPopupSource = await fs.readFile(
  new URL('../webflow/pattern.com/scripts/media/video-popup.js', import.meta.url),
  'utf8',
);
const videoPreviewSource = await fs.readFile(
  new URL('../webflow/pattern.com/scripts/media/video-preview.js', import.meta.url),
  'utf8',
);
const headingRevealSource = await fs.readFile(
  new URL(
    '../webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js',
    import.meta.url,
  ),
  'utf8',
);
const accordionSource = await fs.readFile(
  new URL('../webflow/pattern.com/scripts/interaction/accordion.js', import.meta.url),
  'utf8',
);
const gatewayLocalAssetSources = await Promise.all(
  [
    '../webflow/pattern.com/scripts/interaction/marquee.js',
    '../webflow/pattern.com/styles/marquee.css',
    '../webflow/pattern.com/scripts/nav/home-anchor-nav.js',
    '../webflow/pattern.com/styles/home-anchor-nav.css',
    '../webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js',
    '../webflow/pattern.com/scripts/content/case-study-cms-slider.js',
    '../webflow/pattern.com/scripts/interaction/accordion.js',
    '../webflow/pattern.com/scripts/media/video-popup.js',
    '../webflow/pattern.com/scripts/media/video-preview.js',
  ].map((path) => fs.readFile(new URL(path, import.meta.url), 'utf8')),
);
const gatewayEmbed = await fs.readFile(
  new URL(
    '../webflow/pattern.com/scripts/runtime/pattern-version-gateway-embed.html',
    import.meta.url,
  ),
  'utf8',
);
const gatewayV3ActiveEmbed = await fs.readFile(
  new URL(
    '../webflow/pattern.com/scripts/runtime/pattern-version-gateway-v3-active-embed.html',
    import.meta.url,
  ),
  'utf8',
);
const gatewayLegacyActiveEmbed = await fs.readFile(
  new URL(
    '../webflow/pattern.com/scripts/runtime/pattern-version-gateway-legacy-active-embed.html',
    import.meta.url,
  ),
  'utf8',
);
const toSRI = (source) =>
  `sha384-${crypto.createHash('sha384').update(source).digest('base64')}`;
const allowUnreleasedRuntime = process.env.PVG_ALLOW_UNRELEASED_RUNTIME === '1';
const getInlineScript = (embed) => {
  const match = embed.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'Expected one inline script in the embed.');
  return allowUnreleasedRuntime
    ? match[1].replace(/sha384-[A-Za-z0-9+/=]+/g, toSRI(gatewaySource))
    : match[1];
};

const browser = await chromium.launch({ headless: true });

async function createScenario({ html, config = {}, routes = [] }) {
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const route of routes) {
    await page.route(route.url, async (request) => {
      await request.fulfill({
        status: route.status || 200,
        contentType: route.contentType || 'text/javascript',
        body: route.body || '',
        headers: {
          'access-control-allow-origin': '*',
          ...(route.headers || {}),
        },
      });
    });
  }

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => {
    window.PatternVersionGatewayConfig = value;
  }, {
    mode: 'observe',
    baseUrl: 'https://pvg.test/webflow/pattern.com/scripts/runtime/',
    ...config,
  });
  await page.addScriptTag({ content: gatewaySource });
  await page.waitForFunction(() => window.PatternVersionGateway?.version === '0.2.5');
  await page.waitForTimeout(25);

  return page;
}

async function inspectScenario(options) {
  const page = await createScenario(options);
  const result = await page.evaluate(() => ({
    ...window.PatternVersionGateway.inspect(),
    loadDependencyExposed:
      typeof window.PatternVersionGateway.loadDependency === 'function',
    managedAssets: document.querySelectorAll('[data-pattern-pvg-asset]').length,
  }));
  await page.close();
  return result;
}

async function inspectEmbedScenario({ html, embed, routes = [] }) {
  const page = await browser.newPage();

  await page.route('**/scripts/runtime/pattern-version-gateway.js', async (request) => {
    await request.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: gatewaySource,
      headers: {
        'access-control-allow-origin': '*',
      },
    });
  });

  for (const route of routes) {
    await page.route(route.url, async (request) => {
      await request.fulfill({
        status: route.status || 200,
        contentType: route.contentType || 'text/javascript',
        body: route.body || '',
        headers: {
          'access-control-allow-origin': '*',
          ...(route.headers || {}),
        },
      });
    });
  }

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: getInlineScript(embed) });
  await page.waitForFunction(() => window.PatternVersionGateway?.version === '0.2.5');
  await page.waitForTimeout(25);

  const result = await page.evaluate(() => ({
    ...window.PatternVersionGateway.inspect(),
    managedAssets: document.querySelectorAll('[data-pattern-pvg-asset]').length,
    loaderMode: document.querySelector('[data-pattern-pvg-loader]')?.dataset.pvgMode,
    loaderLegacyPolicy:
      document.querySelector('[data-pattern-pvg-loader]')?.dataset.pvgLegacyPolicy,
    dynamicYear: document.querySelector('[data-dynamic-year]')?.textContent,
  }));
  await page.close();
  return result;
}

try {
  if (!allowUnreleasedRuntime) {
    assert.ok(gatewayEmbed.includes(toSRI(gatewaySource)));
    assert.ok(gatewayV3ActiveEmbed.includes(toSRI(gatewaySource)));
    assert.ok(gatewayLegacyActiveEmbed.includes(toSRI(gatewaySource)));
  }
  assert.match(gatewayEmbed, /pattern@[0-9a-f]{40}\/webflow\/pattern\.com\/scripts\/runtime/);
  assert.match(
    gatewayV3ActiveEmbed,
    /pattern@[0-9a-f]{40}\/webflow\/pattern\.com\/scripts\/runtime/,
  );
  assert.match(
    gatewayLegacyActiveEmbed,
    /pattern@[0-9a-f]{40}\/webflow\/pattern\.com\/scripts\/runtime/,
  );
  assert.ok(!gatewayEmbed.includes('PVG_COMMIT_SHA'));
  assert.ok(!gatewayV3ActiveEmbed.includes('PVG_COMMIT_SHA'));
  assert.ok(!gatewayLegacyActiveEmbed.includes('PVG_COMMIT_SHA'));
  assert.match(gatewayEmbed, /script\.dataset\.pvgMode = 'observe'/);
  assert.match(gatewayV3ActiveEmbed, /script\.dataset\.pvgMode = 'active'/);
  assert.match(gatewayV3ActiveEmbed, /script\.dataset\.pvgLegacyPolicy = 'preserve'/);
  assert.match(gatewayLegacyActiveEmbed, /script\.dataset\.pvgMode = 'active'/);
  assert.match(
    gatewayLegacyActiveEmbed,
    /script\.dataset\.pvgLegacyPolicy = 'gateway'/,
  );
  assert.ok(gatewaySource.includes(toSRI(videoPopupSource)));
  assert.ok(gatewaySource.includes(toSRI(headingRevealSource)));
  gatewayLocalAssetSources.forEach((source) => {
    assert.ok(gatewaySource.includes(toSRI(source)));
  });
  assert.ok(
    gatewaySource.includes(
      'https://cdn.prod.website-files.com/gsap/3.15.0/gsap.min.js',
    ),
  );
  assert.ok(!gatewaySource.includes('gsap@3.13.0'));
  assert.ok(
    gatewaySource.includes(
      'pattern@aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6/webflow/pattern.com',
    ),
  );

  const v1 = await inspectScenario({
    html: '<main class="page_main cc-v1"><nav class="nav_wrap"></nav></main>',
  });
  assert.equal(v1.detection.version, 'v1');
  assert.equal(v1.detection.safe, true);
  assert.equal(v1.activation.reason, 'observe-mode');
  assert.ok(v1.plan.some((module) => module.id === 'legacy-nav'));

  const v2 = await inspectScenario({
    html: '<main class="page_main cc-v2"></main>',
  });
  assert.equal(v2.detection.version, 'v2');
  assert.equal(v2.detection.safe, true);

  const v2l = await inspectScenario({
    html: '<main class="page_main cc-v2l"></main>',
  });
  assert.equal(v2l.detection.version, 'v2l');
  assert.equal(v2l.detection.family, 'v2');

  const deferredCaseStudy = await inspectScenario({
    html: `
      <main class="page_main_v3">
        <div data-case-study-slider></div>
      </main>
    `,
  });
  const caseStudyPlan = deferredCaseStudy.plan.find(
    (module) => module.id === 'case-study',
  );
  assert.ok(caseStudyPlan);
  assert.deepEqual(caseStudyPlan.dependencies, []);
  assert.equal(deferredCaseStudy.loadDependencyExposed, true);

  const componentVersionTokens = await inspectScenario({
    html: `
      <main class="page_main">
        <div class="cc-v1" data-pattern-version="v3"></div>
      </main>
    `,
    config: { mode: 'active', legacyPolicy: 'gateway' },
  });
  assert.equal(componentVersionTokens.detection.version, 'v2');
  assert.equal(componentVersionTokens.detection.source, 'unmarked-page-main-fallback');
  assert.equal(componentVersionTokens.detection.safe, false);
  assert.equal(componentVersionTokens.activation.reason, 'unresolved-version');

  const observedEmbedV3 = await inspectEmbedScenario({
    html: '<main class="page_main_v3"><span data-dynamic-year>2000</span></main>',
    embed: gatewayEmbed,
  });
  assert.equal(observedEmbedV3.mode, 'observe');
  assert.equal(observedEmbedV3.activation.reason, 'observe-mode');
  assert.equal(observedEmbedV3.loaderMode, 'observe');
  assert.equal(observedEmbedV3.managedAssets, 0);
  assert.equal(observedEmbedV3.dynamicYear, '2000');

  const activeEmbedV3 = await inspectEmbedScenario({
    html: '<main class="page_main_v3"><span data-dynamic-year>2000</span></main>',
    embed: gatewayV3ActiveEmbed,
  });
  assert.equal(activeEmbedV3.mode, 'active');
  assert.equal(activeEmbedV3.activation.reason, 'active');
  assert.equal(activeEmbedV3.loaderMode, 'active');
  assert.equal(activeEmbedV3.loaderLegacyPolicy, 'preserve');
  assert.equal(activeEmbedV3.dynamicYear, String(new Date().getFullYear()));

  const legacyCutoverPage = await browser.newPage();
  await legacyCutoverPage.route(
    '**/scripts/runtime/pattern-version-gateway.js',
    async (request) => {
      await request.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: gatewaySource,
        headers: {
          'access-control-allow-origin': '*',
        },
      });
    },
  );
  await legacyCutoverPage.route(
    '**/@splidejs/splide@4.1.4/dist/css/splide.min.css',
    async (request) => {
      await request.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '.splide { display: block; }',
        headers: {
          'access-control-allow-origin': '*',
        },
      });
    },
  );
  await legacyCutoverPage.route(
    '**/@splidejs/splide@4.1.4/dist/js/splide.min.js',
    async (request) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await request.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: 'window.Splide = function Splide() {};',
        headers: {
          'access-control-allow-origin': '*',
        },
      });
    },
  );
  await legacyCutoverPage.setContent(
    `
      <script>
        window.__pvgEarlySplideCalls = 0;
        window.__pvgSplideCalls = 0;
        window.__pvgOtherPageFunctionCalls = 0;
        window.pageFunctions = {
          added: false,
          executed: {},
          functions: {},
          addFunction(id, fn) {
            if (!this.functions[id]) this.functions[id] = fn;
          },
          executeFunctions() {
            if (this.added) return;
            this.added = true;
            for (const id in this.functions) {
              if (this.executed[id]) continue;
              this.functions[id]();
              this.executed[id] = true;
            }
          },
        };
        window.pageFunctions.addFunction('splideSlider', () => {
          if (typeof window.Splide !== 'function') {
            window.__pvgEarlySplideCalls += 1;
            throw new Error('Splide executed before its dependency.');
          }
          window.__pvgSplideCalls += 1;
        });
        window.pageFunctions.addFunction('unrelatedPageFunction', () => {
          window.__pvgOtherPageFunctionCalls += 1;
        });
      </script>
      <main class="page_main cc-v1">
        <div class="splide"></div>
      </main>
    `,
    { waitUntil: 'domcontentloaded' },
  );
  await legacyCutoverPage.addScriptTag({
    content: getInlineScript(gatewayLegacyActiveEmbed),
  });
  await legacyCutoverPage.evaluate(() => window.pageFunctions.executeFunctions());
  await legacyCutoverPage.waitForFunction(
    () =>
      window.PatternVersionGateway?.version === '0.2.5' &&
      window.pageFunctions.executed.splideSlider === true,
  );
  const legacyCutover = await legacyCutoverPage.evaluate(() => ({
    activation: window.PatternVersionGateway.inspect().activation,
    earlySplideCalls: window.__pvgEarlySplideCalls,
    splideCalls: window.__pvgSplideCalls,
    otherCalls: window.__pvgOtherPageFunctionCalls,
    splideExecuted: window.pageFunctions.executed.splideSlider,
    otherExecuted: window.pageFunctions.executed.unrelatedPageFunction,
    loaderLegacyPolicy:
      document.querySelector('[data-pattern-pvg-loader]')?.dataset.pvgLegacyPolicy,
  }));
  assert.equal(legacyCutover.activation.allowed, true);
  assert.equal(legacyCutover.earlySplideCalls, 0);
  assert.equal(legacyCutover.splideCalls, 1);
  assert.equal(legacyCutover.otherCalls, 1);
  assert.equal(legacyCutover.splideExecuted, true);
  assert.equal(legacyCutover.otherExecuted, true);
  assert.equal(legacyCutover.loaderLegacyPolicy, 'gateway');
  await legacyCutoverPage.close();

  const rollbackPage = await browser.newPage();
  await rollbackPage.route(
    '**/scripts/runtime/pattern-version-gateway.js',
    async (request) => {
      await request.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: gatewaySource,
        headers: {
          'access-control-allow-origin': '*',
        },
      });
    },
  );
  await rollbackPage.setContent('<main class="page_main_v3"></main>', {
    waitUntil: 'domcontentloaded',
  });
  await rollbackPage.addScriptTag({
    content: getInlineScript(gatewayV3ActiveEmbed),
  });
  await rollbackPage.waitForFunction(
    () => window.PatternVersionGateway?.inspect().mode === 'active',
  );
  await rollbackPage.addScriptTag({
    content: getInlineScript(gatewayEmbed),
  });
  await rollbackPage.waitForFunction(
    () => window.PatternVersionGateway?.inspect().mode === 'observe',
  );
  await rollbackPage.evaluate(() => {
    document.querySelector('.page_main_v3').insertAdjacentHTML(
      'beforeend',
      `
        <div class="pattern-library-v3--video_player_wrap">
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog>
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      `,
    );
  });
  await rollbackPage.waitForTimeout(50);
  const rollback = await rollbackPage.evaluate(() => ({
    inspection: window.PatternVersionGateway.inspect(),
    initialized: document
      .querySelector('[class*="video_player_wrap"]')
      .hasAttribute('data-video-player-popup-initialized'),
    managedAssets: document.querySelectorAll('[data-pattern-pvg-asset]').length,
  }));
  assert.equal(rollback.inspection.mode, 'observe');
  assert.equal(rollback.inspection.activation.reason, 'observe-mode');
  assert.equal(rollback.initialized, false);
  assert.equal(rollback.managedAssets, 0);
  await rollbackPage.close();

  const activeEmbedV1 = await inspectEmbedScenario({
    html: `
      <main class="page_main cc-v1">
        <nav class="nav_wrap"></nav>
        <span data-dynamic-year>2000</span>
      </main>
    `,
    embed: gatewayV3ActiveEmbed,
  });
  assert.equal(activeEmbedV1.detection.version, 'v1');
  assert.equal(activeEmbedV1.activation.reason, 'legacy-preserved');
  assert.equal(activeEmbedV1.loaderLegacyPolicy, 'preserve');
  assert.equal(activeEmbedV1.managedAssets, 0);
  assert.equal(activeEmbedV1.dynamicYear, '2000');

  const inferredV2 = await inspectScenario({
    html: '<main class="page_main"></main>',
    config: { mode: 'active', legacyPolicy: 'gateway' },
  });
  assert.equal(inferredV2.detection.version, 'v2');
  assert.equal(inferredV2.detection.safe, false);
  assert.equal(inferredV2.activation.reason, 'unresolved-version');

  const v3Observe = await inspectScenario({
    html: `
      <main class="page_main_v3">
        <div class="pattern-library-v3--video_player_wrap">
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog>
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      </main>
    `,
  });
  assert.equal(v3Observe.detection.version, 'v3');
  assert.ok(v3Observe.plan.some((module) => module.id === 'v3-video-popup'));
  assert.equal(v3Observe.managedAssets, 0);

  const v3HeadingObserve = await inspectScenario({
    html: `
      <main class="page_main_v3">
        <div
          data-heading-reveal="true"
          data-wf--pattern-library-v3--typography-heading--font-style="h1"
        >
          <h1>Observed H1</h1>
        </div>
      </main>
    `,
  });
  assert.ok(
    v3HeadingObserve.plan.some((module) => module.id === 'v3-heading-text-reveal'),
  );
  assert.equal(v3HeadingObserve.managedAssets, 0);

  const v3NonH1HeadingObserve = await inspectScenario({
    html: `
      <main class="page_main_v3">
        <div
          data-heading-reveal="true"
          data-wf--pattern-library-v3--typography-heading--font-style="h2"
        >
          <h2>Unanimated H2</h2>
        </div>
      </main>
    `,
  });
  assert.ok(
    !v3NonH1HeadingObserve.plan.some(
      (module) => module.id === 'v3-heading-text-reveal',
    ),
  );

  const v3HeroNonH1HeadingObserve = await inspectScenario({
    html: `
      <main class="page_main_v3">
        <section id="page-hero">
          <div
            data-heading-reveal="true"
            data-wf--pattern-library-v3--typography-heading--font-style="h2"
          >
            <h2>Page-load H2</h2>
          </div>
        </section>
      </main>
    `,
  });
  assert.ok(
    v3HeroNonH1HeadingObserve.plan.some(
      (module) => module.id === 'v3-heading-text-reveal',
    ),
  );

  const v3WithLegacyMarkup = await inspectScenario({
    html: `
      <main class="page_main_v3">
        <div fc-video-popup="component"><button fc-video-popup="open"></button></div>
      </main>
    `,
  });
  assert.equal(v3WithLegacyMarkup.detection.version, 'v3');
  assert.ok(!v3WithLegacyMarkup.plan.some((module) => module.id === 'legacy-video-popup'));
  assert.ok(!v3WithLegacyMarkup.plan.some((module) => module.id === 'v3-video-popup'));

  const legacyPreserved = await inspectScenario({
    html: '<main class="page_main cc-v1"><nav class="nav_wrap"></nav></main>',
    config: { mode: 'active' },
  });
  assert.equal(legacyPreserved.activation.reason, 'legacy-preserved');
  assert.equal(
    legacyPreserved.modules.find((module) => module.id === 'legacy-nav').status,
    'preserved',
  );

  const conflict = await inspectScenario({
    html: '<main class="page_main cc-v1 page_main_v3"></main>',
    config: { mode: 'active', legacyPolicy: 'gateway' },
  });
  assert.equal(conflict.detection.safe, false);
  assert.deepEqual(conflict.detection.conflicts, ['v1']);
  assert.equal(conflict.activation.reason, 'conflicting-version-markers');

  const configuredConflict = await inspectScenario({
    html: '<main class="page_main cc-v1"></main>',
    config: { mode: 'active', legacyPolicy: 'gateway', version: 'v3' },
  });
  assert.equal(configuredConflict.detection.version, 'v1');
  assert.equal(configuredConflict.detection.safe, false);
  assert.deepEqual(configuredConflict.detection.conflicts, ['v3']);
  assert.equal(configuredConflict.activation.reason, 'conflicting-version-markers');
  assert.equal(configuredConflict.managedAssets, 0);

  const unknown = await inspectScenario({
    html: '<main></main>',
    config: { mode: 'active', legacyPolicy: 'gateway' },
  });
  assert.equal(unknown.detection.version, 'unknown');
  assert.equal(unknown.activation.reason, 'unresolved-version');
  assert.equal(unknown.managedAssets, 0);

  const activeLegacyPage = await createScenario({
    html: `
      <script>
        window.pageFunctions = {
          added: true,
          executed: {},
          functions: {},
          addFunction(id, fn) {
            if (!this.functions[id]) this.functions[id] = fn;
          },
        };
        window.pageFunctions.addFunction('splideSlider', () => {
          new window.Splide('.splide').mount();
        });
      </script>
      <main class="page_main cc-v1">
        <div class="splide"></div>
        <div class="splide"></div>
        <div card-grid>
          <article card-load="count-up"><span stat-count-up>123</span></article>
        </div>
      </main>
    `,
    config: { mode: 'active', legacyPolicy: 'gateway' },
    routes: [
      {
        url: '**/pattern@aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6/webflow/pattern.com/scripts/interaction/card-load-animations-v10.js',
        body: 'window.__pvgV1CardLoads = (window.__pvgV1CardLoads || 0) + 1;',
      },
      {
        url: '**/gsap/3.15.0/gsap.min.js',
        body: 'window.gsap = { registerPlugin() {} };',
      },
      {
        url: '**/gsap/3.15.0/ScrollTrigger.min.js',
        body: 'window.ScrollTrigger = {};',
      },
      {
        url: '**/@splidejs/splide@4.1.4/dist/css/splide.min.css',
        contentType: 'text/css',
        body: '.splide { display: block; }',
      },
      {
        url: '**/@splidejs/splide@4.1.4/dist/js/splide.min.js',
        body: `
          window.Splide = function Splide() {};
          window.Splide.prototype.mount = function mount() {
            window.__pvgSplideMounts = (window.__pvgSplideMounts || 0) + 1;
            return this;
          };
        `,
      },
    ],
  });
  await activeLegacyPage.waitForFunction(
    () => {
      const modules = window.PatternVersionGateway.inspect().modules;
      return ['card-load-animations', 'splide'].every(
        (id) => modules.find((module) => module.id === id)?.status === 'ready',
      );
    },
  );
  const activeLegacy = await activeLegacyPage.evaluate(() => ({
    activation: window.PatternVersionGateway.inspect().activation,
    managedScripts: document.querySelectorAll(
      'script[data-pattern-pvg-asset="dependency:splide:script"]',
    ).length,
    managedStyles: document.querySelectorAll(
      'link[data-pattern-pvg-asset="dependency:splide:style"]',
    ).length,
    cardLoads: window.__pvgV1CardLoads,
    splideMounts: window.__pvgSplideMounts,
    splideRegistryExecuted: window.pageFunctions.executed.splideSlider,
  }));
  assert.equal(activeLegacy.activation.allowed, true);
  assert.equal(activeLegacy.managedScripts, 1);
  assert.equal(activeLegacy.managedStyles, 1);
  assert.equal(activeLegacy.cardLoads, 1);
  assert.equal(activeLegacy.splideMounts, 1);
  assert.equal(activeLegacy.splideRegistryExecuted, true);
  await activeLegacyPage.close();

  const activeV2LPage = await createScenario({
    html: `
      <script>
        window.pageFunctions = {
          added: true,
          executed: {},
          functions: {},
          addFunction(id, fn) {
            if (!this.functions[id]) this.functions[id] = fn;
          },
        };
      </script>
      <main class="page_main cc-v2l">
        <span data-dynamic-year>2000</span>
        <nav class="nav_wrap"></nav>
        <div class="splide"></div>
        <div class="splide"></div>
        <div card-grid>
          <article card-load="count-up"><span stat-count-up>123</span></article>
        </div>
      </main>
    `,
    config: { mode: 'active', legacyPolicy: 'gateway' },
    routes: [
      {
        url: '**/pattern@v1.0.8/webflow/pattern.com/styles/nav.css',
        contentType: 'text/css',
        body: '.nav_wrap { display: block; }',
      },
      {
        url: '**/pattern@v1.0.8/webflow/pattern.com/scripts/nav/nav.js',
        body: `
          window.__pvgV2LNavLoads = (window.__pvgV2LNavLoads || 0) + 1;
          window.pageFunctions.addFunction('nav', () => {
            document.querySelectorAll('.nav_wrap').forEach((nav) => {
              nav.setAttribute('data-pattern-nav-ready', 'true');
            });
          });
        `,
      },
      {
        url: '**/pattern@aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6/webflow/pattern.com/scripts/interaction/card-load-animations-v10.js',
        body: 'window.__pvgV2LCardLoads = (window.__pvgV2LCardLoads || 0) + 1;',
      },
      {
        url: '**/gsap/3.15.0/gsap.min.js',
        body: 'window.gsap = { registerPlugin() {} };',
      },
      {
        url: '**/gsap/3.15.0/ScrollTrigger.min.js',
        body: 'window.ScrollTrigger = {};',
      },
      {
        url: '**/@splidejs/splide@4.1.4/dist/css/splide.min.css',
        contentType: 'text/css',
        body: '.splide { display: block; }',
      },
      {
        url: '**/@splidejs/splide@4.1.4/dist/js/splide.min.js',
        body: 'window.Splide = function Splide() {};',
      },
    ],
  });
  await activeV2LPage.waitForFunction(() => {
    const modules = window.PatternVersionGateway.inspect().modules;
    return ['dynamic-year', 'legacy-nav', 'card-load-animations', 'splide'].every(
      (id) => modules.find((module) => module.id === id)?.status === 'ready',
    );
  });
  const activeV2L = await activeV2LPage.evaluate(() => {
    const inspection = window.PatternVersionGateway.inspect();
    return {
      inspection,
      year: document.querySelector('[data-dynamic-year]').textContent,
      navReady: document
        .querySelector('.nav_wrap')
        .hasAttribute('data-pattern-nav-ready'),
      navLoads: window.__pvgV2LNavLoads,
      cardLoads: window.__pvgV2LCardLoads,
      navRegistryExecuted: window.pageFunctions.executed.nav,
      managedAssetIds: [...document.querySelectorAll('[data-pattern-pvg-asset]')].map(
        (asset) => asset.dataset.patternPvgAsset,
      ),
    };
  });
  assert.equal(activeV2L.inspection.detection.version, 'v2l');
  assert.equal(activeV2L.inspection.detection.family, 'v2');
  assert.equal(activeV2L.inspection.activation.allowed, true);
  assert.equal(activeV2L.year, String(new Date().getFullYear()));
  assert.equal(activeV2L.navReady, true);
  assert.equal(activeV2L.navLoads, 1);
  assert.equal(activeV2L.cardLoads, 1);
  assert.equal(activeV2L.navRegistryExecuted, true);
  assert.equal(
    activeV2L.managedAssetIds.filter((id) => id === 'dependency:splide:script').length,
    1,
  );
  assert.equal(
    activeV2L.managedAssetIds.filter((id) => id === 'dependency:splide:style').length,
    1,
  );
  assert.equal(
    activeV2L.inspection.modules.find((module) => module.id === 'v3-video-popup').matched,
    false,
  );
  await activeV2LPage.close();

  for (const version of ['v1', 'v2']) {
    const activeAccordionPage = await createScenario({
      html: `
        <main class="page_main cc-${version}">
          <div
            class="pattern-library-v2--accordion_wrap"
            data-open-by-default="1"
          >
            <div class="pattern-library-v2--accordion_list">
              <article class="pattern-library-v2--accordion_component">
                <button class="pattern-library-v2--accordion_toggle_button">
                  First question
                </button>
                <div class="pattern-library-v2--accordion_content_wrap">
                  First answer
                </div>
              </article>
              <article class="pattern-library-v2--accordion_component">
                <button class="pattern-library-v2--accordion_toggle_button">
                  Second question
                </button>
                <div class="pattern-library-v2--accordion_content_wrap">
                  Second answer
                </div>
              </article>
            </div>
          </div>
        </main>
      `,
      config: { mode: 'active', legacyPolicy: 'gateway' },
      routes: [
        {
          url: '**/gsap/3.15.0/gsap.min.js',
          body: `
            window.gsap = {
              timeline(options) {
                let target;
                return {
                  fromTo(element) {
                    target = element;
                    return this;
                  },
                  invalidate() {
                    return this;
                  },
                  play() {
                    if (target) {
                      target.style.display = 'block';
                      target.style.height = 'auto';
                    }
                    options.onComplete?.();
                    return this;
                  },
                  reverse() {
                    options.onReverseComplete?.();
                    return this;
                  },
                  progress() {
                    if (target) {
                      target.style.display = 'block';
                      target.style.height = 'auto';
                    }
                    options.onComplete?.();
                    return this;
                  },
                };
              },
            };
          `,
        },
        {
          url: '**/scripts/interaction/accordion.js',
          body: accordionSource,
        },
      ],
    });

    await activeAccordionPage.waitForFunction(
      () =>
        document.querySelector('[class*="accordion_wrap"]')?.dataset
          .accordionInitialized === 'true',
    );

    const getAccordionState = () =>
      activeAccordionPage.evaluate(() => ({
        module: window.PatternVersionGateway
          .inspect()
          .modules.find((candidate) => candidate.id === 'accordion'),
        cards: [...document.querySelectorAll('[class*="accordion_component"]')].map(
          (card) => {
            const button = card.querySelector('[class*="accordion_toggle_button"]');
            const panel = card.querySelector('[class*="accordion_content_wrap"]');
            return {
              active: card.classList.contains('is-active'),
              legacyActive: card.classList.contains('pattern-library-v2--is-active'),
              expanded: button.getAttribute('aria-expanded'),
              controls: button.getAttribute('aria-controls'),
              panelId: panel.id,
              labelledBy: panel.getAttribute('aria-labelledby'),
              buttonId: button.id,
              display: panel.style.display,
              height: panel.style.height,
            };
          },
        ),
      }));

    const defaultOpenAccordion = await getAccordionState();
    assert.equal(defaultOpenAccordion.module.status, 'ready');
    assert.equal(defaultOpenAccordion.cards[0].active, true);
    assert.equal(defaultOpenAccordion.cards[0].legacyActive, true);
    assert.equal(defaultOpenAccordion.cards[0].expanded, 'true');
    assert.equal(defaultOpenAccordion.cards[0].display, 'block');
    assert.equal(defaultOpenAccordion.cards[0].height, 'auto');
    assert.equal(
      defaultOpenAccordion.cards[0].controls,
      defaultOpenAccordion.cards[0].panelId,
    );
    assert.equal(
      defaultOpenAccordion.cards[0].labelledBy,
      defaultOpenAccordion.cards[0].buttonId,
    );
    assert.equal(defaultOpenAccordion.cards[1].active, false);
    assert.equal(defaultOpenAccordion.cards[1].expanded, 'false');
    assert.equal(defaultOpenAccordion.cards[1].display, 'none');
    assert.equal(defaultOpenAccordion.cards[1].height, '0px');

    await activeAccordionPage.click(
      '[class*="accordion_component"]:nth-child(2) [class*="accordion_toggle_button"]',
    );
    const switchedAccordion = await getAccordionState();
    assert.equal(switchedAccordion.cards[0].active, false);
    assert.equal(switchedAccordion.cards[0].expanded, 'false');
    assert.equal(switchedAccordion.cards[0].display, 'none');
    assert.equal(switchedAccordion.cards[1].active, true);
    assert.equal(switchedAccordion.cards[1].expanded, 'true');
    assert.equal(switchedAccordion.cards[1].display, 'block');

    await activeAccordionPage.click(
      '[class*="accordion_component"]:nth-child(2) [class*="accordion_toggle_button"]',
    );
    const closedAccordion = await getAccordionState();
    assert.equal(closedAccordion.cards[1].active, false);
    assert.equal(closedAccordion.cards[1].expanded, 'false');
    assert.equal(closedAccordion.cards[1].display, 'none');
    assert.equal(closedAccordion.cards[1].height, '0px');
    await activeAccordionPage.close();
  }

  const activeV3HeadingPage = await createScenario({
    html: `
      <main class="page_main_v3">
        <div
          data-heading-reveal="true"
          data-wf--pattern-library-v3--typography-heading--font-style="h1"
        >
          <h1>Active H1</h1>
        </div>
      </main>
    `,
    config: { mode: 'active' },
    routes: [
      {
        url: '**/gsap/3.15.0/gsap.min.js',
        body: 'window.gsap = { registerPlugin() {} };',
      },
      {
        url: '**/gsap/3.15.0/ScrollTrigger.min.js',
        body: 'window.ScrollTrigger = {};',
      },
      {
        url: '**/gsap/3.15.0/SplitText.min.js',
        body: 'window.SplitText = {};',
      },
      {
        url: '**/scripts/interaction/v3-heading-text-reveal.js',
        body: headingRevealSource,
      },
    ],
  });
  await activeV3HeadingPage.waitForFunction(
    () =>
      document
        .querySelector('[data-heading-reveal="true"]')
        ?.getAttribute('data-pattern-heading-reveal-initialized') === 'reduced-motion',
  );
  const activeV3Heading = await activeV3HeadingPage.evaluate(() => ({
    module: window.PatternVersionGateway
      .inspect()
      .modules.find((candidate) => candidate.id === 'v3-heading-text-reveal'),
    initialized: document
      .querySelector('[data-heading-reveal="true"]')
      .getAttribute('data-pattern-heading-reveal-initialized'),
    dependencyScripts: document.querySelectorAll(
      'script[data-pattern-pvg-asset^="dependency:"]',
    ).length,
    moduleScripts: document.querySelectorAll(
      'script[data-pattern-pvg-asset="module:v3-heading-text-reveal:script"]',
    ).length,
  }));
  assert.equal(activeV3Heading.module.status, 'ready');
  assert.equal(activeV3Heading.initialized, 'reduced-motion');
  assert.equal(activeV3Heading.dependencyScripts, 3);
  assert.equal(activeV3Heading.moduleScripts, 1);
  await activeV3HeadingPage.close();

  const activeV3Page = await createScenario({
    html: `
      <main class="page_main_v3">
        <div class="pattern-library-v3--video_player_wrap">
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog>
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      </main>
    `,
    config: { mode: 'active' },
    routes: [
      {
        url: '**/scripts/media/video-popup.js',
        body: videoPopupSource,
      },
    ],
  });
  await activeV3Page.waitForFunction(
    () =>
      document
        .querySelector('[class*="video_player_wrap"]')
        ?.hasAttribute('data-video-player-popup-initialized'),
  );
  await activeV3Page.click('[data-video-player-open]');
  const activeV3 = await activeV3Page.evaluate(() => ({
    inspect: window.PatternVersionGateway.inspect(),
    initialized: document
      .querySelector('[class*="video_player_wrap"]')
      .hasAttribute('data-video-player-popup-initialized'),
    dialogOpen: document.querySelector('dialog[data-video-player-dialog]').open,
    iframeSource: document.querySelector('dialog[data-video-player-dialog] iframe').src,
    managedScripts: document.querySelectorAll('script[data-pattern-pvg-asset]').length,
  }));
  assert.equal(activeV3.initialized, true);
  assert.equal(activeV3.dialogOpen, true);
  assert.match(activeV3.iframeSource, /^https:\/\/player\.vimeo\.com\/video\/1146670446/);
  assert.equal(activeV3.managedScripts, 1);
  assert.equal(
    activeV3.inspect.modules.find((module) => module.id === 'v3-video-popup').status,
    'ready',
  );
  await activeV3Page.close();

  const activeV3PreviewPage = await createScenario({
    html: `
      <main class="page_main_v3">
        <div class="video_player_wrap">
          <video
            data-src="https://pvg.test/video-preview.mp4"
            preload="none"
            muted
            playsinline
          ></video>
        </div>
      </main>
    `,
    config: { mode: 'active' },
    routes: [
      {
        url: '**/scripts/media/video-preview.js',
        body: videoPreviewSource,
      },
      {
        url: 'https://pvg.test/video-preview.mp4',
        contentType: 'video/mp4',
        body: '',
      },
    ],
  });
  await activeV3PreviewPage.waitForFunction(
    () =>
      window.PatternVersionGateway
        .inspect()
        .modules.find((module) => module.id === 'v3-video-preview')?.status === 'ready',
  );
  await activeV3PreviewPage.waitForFunction(() =>
    document.querySelector('video')?.hasAttribute('data-video-preview-hydrated'),
  );
  const activeV3Preview = await activeV3PreviewPage.evaluate(() => ({
    version: window.PatternVideoPreview.version,
    src: document.querySelector('video').getAttribute('src'),
    autoplay: document.querySelector('video').hasAttribute('autoplay'),
    popupModule: window.PatternVersionGateway
      .inspect()
      .modules.find((module) => module.id === 'v3-video-popup'),
  }));
  assert.equal(activeV3Preview.version, '1.0.0');
  assert.equal(activeV3Preview.src, 'https://pvg.test/video-preview.mp4');
  assert.equal(activeV3Preview.autoplay, false);
  assert.equal(activeV3Preview.popupModule.status, 'idle');
  await activeV3PreviewPage.close();

  const existingRuntimePage = await createScenario({
    html: `
      <script>
        window.__pvgExistingRuntimeInitCalls = 0;
        window.PatternRuntime = { version: '0.3.0' };
        window.PatternVideoPopup = {
          version: '1.1.3',
          init() {
            window.__pvgExistingRuntimeInitCalls += 1;
          },
        };
      </script>
      <main class="page_main_v3">
        <div class="pattern-library-v3--video_player_wrap">
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog>
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      </main>
    `,
    config: { mode: 'active' },
  });
  await existingRuntimePage.waitForFunction(
    () =>
      window.PatternVersionGateway
        .inspect()
        .modules.find((module) => module.id === 'v3-video-popup')?.status === 'ready',
  );
  const existingRuntime = await existingRuntimePage.evaluate(() => ({
    initCalls: window.__pvgExistingRuntimeInitCalls,
    managedModuleScripts: document.querySelectorAll(
      'script[data-pattern-pvg-asset="module:v3-video-popup:script"]',
    ).length,
    runtimeVersion: window.PatternRuntime.version,
  }));
  assert.equal(existingRuntime.initCalls, 1);
  assert.equal(existingRuntime.managedModuleScripts, 0);
  assert.equal(existingRuntime.runtimeVersion, '0.3.0');
  await existingRuntimePage.close();

  const consentGatedPage = await createScenario({
    html: `
      <main class="page_main_v3">
        <div class="pattern-library-v3--video_player_wrap">
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog data-consent-category="personalization">
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      </main>
    `,
    config: { mode: 'active' },
    routes: [
      {
        url: '**/scripts/media/video-popup.js',
        body: videoPopupSource,
      },
    ],
  });
  await consentGatedPage.waitForFunction(
    () =>
      document
        .querySelector('[class*="video_player_wrap"]')
        ?.hasAttribute('data-video-player-popup-initialized'),
  );
  await consentGatedPage.evaluate(() => {
    window.__pvgConsentState = { personalization: false };
    window.FinsweetConsentPro = {
      consents: {
        get: () => window.__pvgConsentState,
      },
      on(name, callback) {
        if (name === 'consent-updated') window.__pvgConsentUpdated = callback;
      },
    };
  });
  await consentGatedPage.click('[data-video-player-open]');
  assert.equal(
    await consentGatedPage.$eval('dialog[data-video-player-dialog]', (dialog) => dialog.open),
    false,
  );
  await consentGatedPage.evaluate(() => {
    window.__pvgConsentState = { personalization: true };
    window.__pvgConsentUpdated(
      new CustomEvent('consent-updated', {
        detail: {
          source: 'consent-pro',
        },
      }),
    );
  });
  await consentGatedPage.waitForFunction(
    () => document.querySelector('dialog[data-video-player-dialog]')?.open === true,
  );
  assert.equal(await consentGatedPage.evaluate(() => window.PatternVideoPopup.version), '1.1.3');
  await consentGatedPage.close();

  const failedModulePage = await createScenario({
    html: `
      <main class="page_main_v3">
        <p id="authored-content">Authored content remains readable.</p>
        <div class="pattern-library-v3--video_player_wrap">
          <button data-video-player-open>Play</button>
          <dialog data-video-player-dialog>
            <iframe data-video-src="https://vimeo.com/1146670446"></iframe>
            <button data-video-player-close>Close</button>
          </dialog>
        </div>
      </main>
    `,
    config: { mode: 'active' },
    routes: [
      {
        url: '**/scripts/media/video-popup.js',
        status: 500,
        body: '',
      },
    ],
  });
  await failedModulePage.waitForFunction(
    () =>
      window.PatternVersionGateway.inspect().modules.find(
        (module) => module.id === 'v3-video-popup',
      )?.status === 'error',
  );
  const failureState = await failedModulePage.evaluate(() => ({
    content: document.querySelector('#authored-content').textContent,
    module: window.PatternVersionGateway
      .inspect()
      .modules.find((candidate) => candidate.id === 'v3-video-popup'),
  }));
  assert.equal(failureState.content, 'Authored content remains readable.');
  assert.equal(failureState.module.status, 'error');
  await failedModulePage.close();

  console.log('Pattern Version Gateway: all tests passed.');
} finally {
  await browser.close();
}
