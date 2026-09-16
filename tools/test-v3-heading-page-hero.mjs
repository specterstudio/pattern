import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const moduleSource = await read(
  '../webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js',
);
const runtimeSource = await read(
  '../webflow/pattern.com/scripts/runtime/pattern-runtime.js',
);
const libraryRuntimeSource = await read(
  '../webflow/pattern.com/scripts/runtime/pattern-runtime-library-0.3.1.js',
);
const gatewaySource = await read(
  '../webflow/pattern.com/scripts/runtime/pattern-version-gateway.js',
);

for (const source of [runtimeSource, libraryRuntimeSource, gatewaySource]) {
  assert.ok(source.includes('#page-hero [data-heading-reveal]'));
  assert.ok(source.includes('#page-hero [data-animate-heading]'));
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setContent(`
    <main class="page_main_v3">
      <section id="page-hero">
        <div
          id="hero-h2"
          data-heading-reveal="true"
          data-wf--pattern-library-v3--typography-heading--font-style="h2"
        ><h2>Hero H2</h2></div>
        <div
          id="hero-off"
          data-heading-reveal="false"
          data-wf--pattern-library-v3--typography-heading--font-style="h3"
        ><h3>Disabled hero H3</h3></div>
      </section>
      <div
        id="outside-h1"
        data-heading-reveal="true"
        data-wf--pattern-library-v3--typography-heading--font-style="h1"
      ><h1>Outside H1</h1></div>
      <div
        id="outside-h2"
        data-heading-reveal="true"
        data-wf--pattern-library-v3--typography-heading--font-style="h2"
      ><h2>Outside H2</h2></div>
    </main>
  `);

  await page.evaluate(() => {
    window.__headingRevealAnimations = [];
    window.ScrollTrigger = function ScrollTrigger() {};
    window.SplitText = {
      create(target, options) {
        const line = document.createElement('div');
        line.textContent = target.textContent;
        target.replaceChildren(line);
        const split = { lines: [line], revert() {} };
        options.onSplit(split);
        return split;
      },
    };
    window.gsap = {
      registerPlugin() {},
      set() {},
      to(targets, vars) {
        const record = {
          id: targets[0].closest('[data-heading-reveal]')?.id,
          hasScrollTrigger: Boolean(vars.scrollTrigger),
          start:
            typeof vars.scrollTrigger?.start === 'function'
              ? vars.scrollTrigger.start()
              : null,
        };
        window.__headingRevealAnimations.push(record);
        return {
          kill() {},
          ...(vars.scrollTrigger
            ? { scrollTrigger: { kill() {} } }
            : {}),
        };
      },
    };
  });

  await page.addScriptTag({ content: moduleSource });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-pattern-heading-reveal-initialized]').length === 2,
  );

  const result = await page.evaluate(() => ({
    initialized: [...document.querySelectorAll('[data-pattern-heading-reveal-initialized]')]
      .map((element) => element.id)
      .sort(),
    animations: window.__headingRevealAnimations,
  }));

  assert.deepEqual(result.initialized, ['hero-h2', 'outside-h1']);
  assert.deepEqual(result.animations, [
    { id: 'hero-h2', hasScrollTrigger: false, start: null },
    { id: 'outside-h1', hasScrollTrigger: true, start: 'clamp(top 75%)' },
  ]);

  console.log('V3 page-hero heading page-load tests passed.');
} finally {
  await browser.close();
}
