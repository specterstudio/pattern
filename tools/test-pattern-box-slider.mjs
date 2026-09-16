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
assert.match(moduleSource, /duration: 0\.16/);
assert.match(moduleSource, /stagger: 0\.02/);
assert.match(moduleSource, /y: 24/);
assert.match(moduleSource, /duration: 0\.5/);
assert.match(moduleSource, /stagger: 0\.08/);
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

const slide = (index, variant = 'light') => `
  <article
    class="pattern-library-v3--box_slider_wrap swiper-slide${variant === 'reversed' ? ' w-variant-reversed' : ''}"
    data-wf--slider-alt-slide--variant="${variant}"
  >
    <div class="pattern-library-v3--box_slider_element">
      <div class="pattern-library-v3--box_slider_visual">Visual ${index}</div>
      <div class="pattern-library-v3--box_slider_content">
        <div class="pattern-library-v3--box_slider_icon">Icon ${index}</div>
        <div class="pattern-library-v3--box_slider_heading">Heading ${index}</div>
        <div class="pattern-library-v3--box_slider_text">Text ${index}</div>
        ${controls(index)}
      </div>
    </div>
  </article>
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setContent(`
  <main class="page_main_v3">
    <section class="pattern-library-v3--slider_wrap" id="multiple">
      <div class="pattern-library-v3--slider_element swiper">
        <div class="pattern-library-v3--slider_list swiper-wrapper" style="transform: translate3d(-1200px, 0, 0)">
          ${slide(1)}
          ${slide(2, 'reversed')}
          ${slide(3)}
        </div>
      </div>
    </section>
    <section class="pattern-library-v3--slider_wrap" id="single">
      <div class="pattern-library-v3--slider_element swiper">
        <div class="pattern-library-v3--slider_list swiper-wrapper">
          ${slide(1)}
        </div>
      </div>
    </section>
  </main>
`);

await page.evaluate(() => {
  window.__gsapCalls = [];
  const apply = (targets, vars) => {
    const elements = Array.isArray(targets) ? targets : [targets];
    elements.forEach((element) => {
      if (!element?.style) return;
      if ('autoAlpha' in vars) {
        element.style.opacity = String(vars.autoAlpha);
        element.style.visibility = vars.autoAlpha === 0 ? 'hidden' : 'visible';
      }
      if ('y' in vars) element.style.transform = `translateY(${vars.y}px)`;
    });
  };
  window.gsap = {
    set(targets, vars) {
      window.__gsapCalls.push({ method: 'set', vars: { ...vars } });
      apply(targets, vars);
    },
    timeline(options = {}) {
      let killed = false;
      return {
        to(targets, vars) {
          window.__gsapCalls.push({ method: 'to', vars: { ...vars } });
          setTimeout(() => {
            if (killed) return;
            apply(targets, vars);
            options.onComplete?.();
          }, 0);
          return this;
        },
        kill() {
          killed = true;
        },
      };
    },
  };

  const element = document.querySelector('#multiple [class*="slider_element"]');
  element.swiper = {
    allowTouchMove: true,
    params: { allowTouchMove: true },
    translate: -1200,
    navigation: { destroy() { this.destroyed = true; } },
    keyboard: { disable() { this.disabled = true; } },
    mousewheel: { disable() { this.disabled = true; } },
    detachEvents() { this.detached = true; },
    setTranslate(value) { this.translate = value; },
    attachEvents() { this.detached = false; },
  };
});

await page.addScriptTag({ content: moduleSource });
await page.waitForFunction(() => document.querySelector('[data-box-slider-slots-ready]'));

const initial = await page.evaluate(() => {
  const multiple = document.querySelector('#multiple');
  const single = document.querySelector('#single');
  const swiper = multiple.querySelector('[class*="slider_element"]').swiper;
  return {
    multipleReady: multiple.hasAttribute('data-box-slider-slots-ready'),
    stageCount: multiple.querySelectorAll('[data-box-slider-stage]').length,
    sourceCount: multiple.querySelectorAll('[data-box-slider-source]').length,
    listTransform: getComputedStyle(multiple.querySelector('[class*="slider_list"]')).transform,
    singleControlsHidden: single.querySelector('[data-case-study-controls]').hidden,
    firstHeading: multiple.querySelector('[data-box-slider-stage] [class*="box_slider_heading"]')
      .textContent.trim(),
    swiperDetached: swiper.detached,
    swiperTranslate: swiper.translate,
    swiperTouch: swiper.allowTouchMove,
  };
});

assert.deepEqual(initial, {
  multipleReady: true,
  stageCount: 1,
  sourceCount: 2,
  listTransform: 'none',
  singleControlsHidden: true,
  firstHeading: 'Heading 1',
  swiperDetached: true,
  swiperTranslate: 0,
  swiperTouch: false,
});

await page.evaluate(() => {
  document.querySelector('#multiple [data-box-slider-stage] [data-case-study-next]').click();
});
await page.waitForFunction(() => (
  document.querySelector('#multiple [data-box-slider-stage] [class*="box_slider_heading"]')
    ?.textContent.trim() === 'Heading 2'
));
await page.waitForFunction(() => document.querySelector('#multiple').getAttribute('aria-busy') === 'false');

const transitioned = await page.evaluate(() => {
  const multiple = document.querySelector('#multiple');
  const stage = multiple.querySelector('[data-box-slider-stage]');
  const list = multiple.querySelector('[class*="slider_list"]');
  const calls = window.__gsapCalls;
  return {
    heading: stage.querySelector('[class*="box_slider_heading"]').textContent.trim(),
    text: stage.querySelector('[class*="box_slider_text"]').textContent.trim(),
    variant: stage.getAttribute('data-wf--slider-alt-slide--variant'),
    reversedClass: stage.classList.contains('w-variant-reversed'),
    listTransform: getComputedStyle(list).transform,
    exit: calls.find((call) => call.method === 'to' && call.vars.y === -8)?.vars,
    entrance: calls.find((call) => call.method === 'to' && call.vars.y === 0)?.vars,
    set: calls.find((call) => call.method === 'set')?.vars,
  };
});

assert.equal(transitioned.heading, 'Heading 2');
assert.equal(transitioned.text, 'Text 2');
assert.equal(transitioned.variant, 'reversed');
assert.equal(transitioned.reversedClass, true);
assert.equal(transitioned.listTransform, 'none');
assert.deepEqual(transitioned.exit, {
  autoAlpha: 0,
  y: -8,
  duration: 0.16,
  stagger: 0.02,
  ease: 'power1.in',
});
assert.deepEqual(transitioned.set, { autoAlpha: 0, y: 24 });
assert.deepEqual(transitioned.entrance, {
  autoAlpha: 1,
  y: 0,
  duration: 0.5,
  stagger: 0.08,
  ease: 'power3.out',
});

await browser.close();
console.log('Pattern Slider Alt fixed-shell motion test passed.');
