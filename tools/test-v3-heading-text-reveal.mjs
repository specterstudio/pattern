import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const moduleSource = await fs.readFile(
  new URL(
    '../webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js',
    import.meta.url,
  ),
  'utf8',
);
const runtimeSource = await fs.readFile(
  new URL('../webflow/pattern.com/scripts/runtime/pattern-runtime.js', import.meta.url),
  'utf8',
);

const browser = await chromium.launch({ headless: true });

const installPluginStubs = async (page) => {
  await page.evaluate(() => {
    window.__headingRevealAnimations = [];
    window.__headingRevealSets = [];

    window.ScrollTrigger = function ScrollTrigger() {};
    window.SplitText = {
      create(target, options) {
        const originalHtml = target.innerHTML;
        const line = document.createElement('div');
        line.className = options.linesClass;
        line.textContent = target.textContent;
        target.replaceChildren(line);

        const split = {
          lines: [line],
          revert() {
            target.innerHTML = originalHtml;
          },
        };

        split.animation = options.onSplit(split);
        return split;
      },
    };

    window.gsap = {
      registerPlugin() {},
      set(targets, vars) {
        const normalizedTargets =
          targets instanceof Element || targets === window
            ? [targets]
            : [...targets];
        window.__headingRevealSets.push({
          targets: normalizedTargets,
          vars,
        });
      },
      to(targets, toVars) {
        const normalizedTargets =
          targets instanceof Element || targets === window
            ? [targets]
            : [...targets];
        const initialSet = [...window.__headingRevealSets]
          .reverse()
          .find((entry) => entry.targets[0] === normalizedTargets[0]);
        const record = {
          targets: normalizedTargets,
          fromVars: initialSet?.vars || {},
          toVars,
          killed: false,
          triggerKilled: false,
        };
        const animation = {
          vars: toVars,
          scrollTrigger: {
            kill() {
              record.triggerKilled = true;
            },
          },
          kill() {
            record.killed = true;
          },
        };

        window.__headingRevealAnimations.push(record);
        return animation;
      },
    };
  });
};

const markup = `
  <main>
    <div
      id="enabled-installed"
      data-heading-reveal="true"
      data-wf--pattern-library-v3--typography-heading--font-style="h1"
    ><h1>Enabled installed heading</h1></div>
    <div
      id="enabled-source"
      data-animate-heading=""
      data-wf--typography-heading--font-style="h1"
    ><h2>Enabled source heading</h2></div>
    <div
      id="wrong-variant"
      data-heading-reveal="true"
      data-wf--pattern-library-v3--typography-heading--font-style="h2"
    ><h2>Wrong variant</h2></div>
    <div
      id="toggle-off"
      data-heading-reveal="false"
      data-wf--pattern-library-v3--typography-heading--font-style="h1"
    ><h1>Toggle off</h1></div>
    <div
      id="unmarked"
      data-wf--pattern-library-v3--typography-heading--font-style="h1"
    ><h1>Unmarked</h1></div>
  </main>
`;

const nonH1Markup = `
  <main>
    <div
      id="marked-non-h1"
      data-heading-reveal="true"
      data-wf--pattern-library-v3--typography-heading--font-style="h2"
    ><h2>Marked non-H1 heading</h2></div>
  </main>
`;

try {
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setContent(markup);
  await installPluginStubs(page);
  await page.addScriptTag({ content: moduleSource });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length === 2,
  );

  const initialized = await page.evaluate(() => ({
    version: window.PatternV3HeadingReveal?.version,
    ready: [...document.querySelectorAll('[data-pattern-heading-reveal-initialized]')].map(
      (element) => element.id,
    ),
    animations: window.__headingRevealAnimations.map((record) => ({
      fromY: record.fromVars.yPercent,
      toY: record.toVars.yPercent,
      duration: record.toVars.duration,
      stagger: record.toVars.stagger,
      ease: record.toVars.ease,
      start:
        typeof record.toVars.scrollTrigger.start === 'function'
          ? record.toVars.scrollTrigger.start()
          : record.toVars.scrollTrigger.start,
      once: record.toVars.scrollTrigger.once,
      scrub: record.toVars.scrollTrigger.scrub,
    })),
  }));

  assert.equal(initialized.version, '1.0.0');
  assert.deepEqual(initialized.ready.sort(), ['enabled-installed', 'enabled-source']);
  assert.equal(initialized.animations.length, 2);
  initialized.animations.forEach((animation) => {
    assert.equal(animation.fromY, 110);
    assert.equal(animation.toY, 0);
    assert.equal(animation.duration, 0.8);
    assert.equal(animation.stagger, 0.1);
    assert.equal(animation.ease, 'expo.out');
    assert.equal(animation.start, 'clamp(top 75%)');
    assert.equal(animation.once, true);
    assert.equal(animation.scrub, false);
  });

  await page.evaluate(() => window.PatternV3HeadingReveal.destroy(document));
  const destroyed = await page.evaluate(() => ({
    readyCount: document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length,
    restoredHeading: document.querySelector('#enabled-installed h1')?.textContent,
    records: window.__headingRevealAnimations.map((record) => ({
      killed: record.killed,
      triggerKilled: record.triggerKilled,
    })),
  }));
  assert.equal(destroyed.readyCount, 0);
  assert.equal(destroyed.restoredHeading, 'Enabled installed heading');
  destroyed.records.forEach((record) => {
    assert.equal(record.killed, true);
    assert.equal(record.triggerKilled, true);
  });
  await page.close();

  const reducedPage = await browser.newPage();
  await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
  await reducedPage.setContent(markup);
  await installPluginStubs(reducedPage);
  await reducedPage.addScriptTag({ content: moduleSource });
  await reducedPage.waitForFunction(
    () => document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length === 2,
  );
  const reduced = await reducedPage.evaluate(() => ({
    states: [...document.querySelectorAll('[data-pattern-heading-reveal-initialized]')].map(
      (element) => element.getAttribute('data-pattern-heading-reveal-initialized'),
    ),
    animations: window.__headingRevealAnimations.length,
    text: document.querySelector('#enabled-installed h1')?.textContent,
  }));
  assert.deepEqual(reduced.states, ['reduced-motion', 'reduced-motion']);
  assert.equal(reduced.animations, 0);
  assert.equal(reduced.text, 'Enabled installed heading');
  await reducedPage.close();

  const runtimePage = await browser.newPage();
  await runtimePage.emulateMedia({ reducedMotion: 'no-preference' });
  await runtimePage.route('**/scripts/interaction/v3-heading-text-reveal.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: moduleSource,
      headers: {
        'access-control-allow-origin': '*',
      },
    });
  });
  await runtimePage.setContent(markup);
  await installPluginStubs(runtimePage);
  await runtimePage.evaluate(() => {
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await runtimePage.addScriptTag({ content: runtimeSource });
  await runtimePage.waitForFunction(
    () =>
      window.PatternRuntime?.inspect().modules.find(
        (module) => module.id === 'v3-heading-text-reveal',
      )?.status === 'ready' &&
      document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length === 2,
  );
  const runtime = await runtimePage.evaluate(() => ({
    version: window.PatternRuntime.version,
    module: window.PatternRuntime
      .inspect()
      .modules.find((candidate) => candidate.id === 'v3-heading-text-reveal'),
    initialized: document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length,
  }));
  assert.equal(runtime.version, '0.3.0');
  assert.equal(runtime.module.matched, true);
  assert.equal(runtime.module.status, 'ready');
  assert.equal(runtime.initialized, 2);
  await runtimePage.close();

  const nonH1RuntimePage = await browser.newPage();
  await nonH1RuntimePage.emulateMedia({ reducedMotion: 'no-preference' });
  await nonH1RuntimePage.setContent(nonH1Markup);
  await installPluginStubs(nonH1RuntimePage);
  await nonH1RuntimePage.evaluate(() => {
    delete window.PatternV3HeadingReveal;
    window.PatternRuntimeConfig = {
      baseUrl: 'https://runtime.test/webflow/pattern.com/scripts/runtime/',
    };
  });
  await nonH1RuntimePage.addScriptTag({ content: runtimeSource });
  await nonH1RuntimePage.waitForFunction(() => window.PatternRuntime?.version === '0.3.0');
  const nonH1Runtime = await nonH1RuntimePage.evaluate(() => ({
    module: window.PatternRuntime
      .inspect()
      .modules.find((candidate) => candidate.id === 'v3-heading-text-reveal'),
    globalLoaded: Boolean(window.PatternV3HeadingReveal),
    initialized: document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length,
    animations: window.__headingRevealAnimations.length,
  }));
  assert.equal(nonH1Runtime.module.matched, false);
  assert.equal(nonH1Runtime.module.status, 'idle');
  assert.equal(nonH1Runtime.globalLoaded, false);
  assert.equal(nonH1Runtime.initialized, 0);
  assert.equal(nonH1Runtime.animations, 0);
  await nonH1RuntimePage.close();

  console.log('V3 heading text reveal tests passed.');
} finally {
  await browser.close();
}
