import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const moduleSource = await read(
  '../webflow/pattern.com/scripts/content/box-slider-slot-controls.js',
);
const caseStudySource = await read(
  '../webflow/pattern.com/scripts/content/case-study-cms-slider.js',
);
const manifestSources = await Promise.all(
  [
    '../webflow/pattern.com/scripts/runtime/pattern-runtime-library-0.3.1.js',
    '../webflow/pattern.com/scripts/runtime/pattern-runtime-consumer-0.2.1.js',
    '../webflow/pattern.com/scripts/runtime/pattern-runtime.js',
    '../webflow/pattern.com/scripts/runtime/pattern-version-gateway.js',
  ].map(read),
);

assert.ok(!caseStudySource.includes('box_slider'));
manifestSources.forEach((source) => {
  assert.ok(source.includes('slider-alt-slots'));
  assert.ok(source.includes('box-slider-slot-controls.js'));
});

const controls = (index) => `
  <nav class="pattern-library-v3--box_slider_controls" data-case-study-controls aria-label="Case study navigation">
    <a data-case-study-prev aria-label="Previous case study">Previous ${index}</a>
    <a data-case-study-next aria-label="Next case study">Next ${index}</a>
  </nav>
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setContent(`
  <main class="page_main_v3">
    <section class="pattern-library-v3--slider_wrap" id="multiple">
      <div class="pattern-library-v3--slider_element swiper">
        <div class="pattern-library-v3--slider_list swiper-wrapper">
          <article class="pattern-library-v3--box_slider_wrap swiper-slide">${controls(1)}</article>
          <article class="pattern-library-v3--box_slider_wrap swiper-slide">${controls(2)}</article>
          <article class="pattern-library-v3--box_slider_wrap swiper-slide">${controls(3)}</article>
        </div>
      </div>
    </section>
    <section class="pattern-library-v3--slider_wrap" id="single">
      <div class="pattern-library-v3--slider_element swiper">
        <div class="pattern-library-v3--slider_list swiper-wrapper">
          <article class="pattern-library-v3--box_slider_wrap swiper-slide">${controls(1)}</article>
        </div>
      </div>
    </section>
  </main>
`);

await page.evaluate(() => {
  const element = document.querySelector('#multiple [class*="slider_element"]');
  element.swiper = {
    previousCalls: 0,
    nextCalls: 0,
    slidePrev() {
      this.previousCalls += 1;
    },
    slideNext() {
      this.nextCalls += 1;
    },
  };
});

await page.addScriptTag({ content: moduleSource });
await page.waitForFunction(() => document.querySelector('[data-box-slider-slots-ready]'));

const initial = await page.evaluate(() => {
  const multiple = document.querySelector('#multiple');
  const single = document.querySelector('#single');
  return {
    multipleReady: multiple.hasAttribute('data-box-slider-slots-ready'),
    multipleControlsHidden: Array.from(
      multiple.querySelectorAll('[data-case-study-controls]'),
    ).some((element) => element.hidden),
    singleControlsHidden: single.querySelector('[data-case-study-controls]').hidden,
    labels: Array.from(multiple.querySelectorAll('[data-case-study-prev], [data-case-study-next]'))
      .map((element) => element.getAttribute('aria-label')),
    roles: Array.from(multiple.querySelectorAll('[data-case-study-prev], [data-case-study-next]'))
      .map((element) => element.getAttribute('role')),
  };
});

assert.equal(initial.multipleReady, true);
assert.equal(initial.multipleControlsHidden, false);
assert.equal(initial.singleControlsHidden, true);
assert.deepEqual(initial.labels, [
  'Previous slide',
  'Next slide',
  'Previous slide',
  'Next slide',
  'Previous slide',
  'Next slide',
]);
assert.ok(initial.roles.every((role) => role === 'button'));

await page.evaluate(() => {
  const multiple = document.querySelector('#multiple');
  multiple.querySelectorAll('[data-case-study-next]')[1].click();
  multiple.querySelectorAll('[data-case-study-prev]')[2].click();
  multiple.querySelector('[data-case-study-next]').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
});

const calls = await page.evaluate(() => {
  const swiper = document.querySelector('#multiple [class*="slider_element"]').swiper;
  return {
    previous: swiper.previousCalls,
    next: swiper.nextCalls,
  };
});

assert.deepEqual(calls, { previous: 1, next: 2 });

await browser.close();
console.log('Pattern Slider Alt slot-control test passed.');
