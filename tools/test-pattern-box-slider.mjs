import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const moduleSource = await read(
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

manifestSources.forEach((source) => assert.ok(source.includes('box_slider_wrap')));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.setContent(`
  <main class="page_main_v3">
    <div class="w-dyn-list">
      <div class="w-dyn-items">
        <div class="w-dyn-item">
          <article class="pattern-library-v3--box_slider_wrap">
            <div class="pattern-library-v3--box_slider_element">
              <div class="pattern-library-v3--box_slider_main">
                <div class="pattern-library-v3--box_slider_visual">
                  <div class="pattern-library-v3--u-image-wrapper">
                    <img src="https://example.com/one.jpg" alt="First visual">
                  </div>
                </div>
                <div class="pattern-library-v3--box_slider_content">
                  <div class="pattern-library-v3--box_slider_icon">
                    <div class="pattern-library-v3--u-image-wrapper">
                      <img src="https://example.com/icon-one.svg" alt="First icon">
                    </div>
                  </div>
                  <div class="pattern-library-v3--box_slider_heading">
                    <div class="pattern-library-v3--u-text">First heading</div>
                  </div>
                  <div class="pattern-library-v3--box_slider_text">
                    <div class="pattern-library-v3--u-text">First body</div>
                  </div>
                  <nav class="pattern-library-v3--box_slider_controls" data-case-study-controls aria-label="Case study navigation">
                    <a class="pattern-library-v3--box_slider_arrow" data-case-study-prev aria-label="Previous case study"></a>
                    <a class="pattern-library-v3--box_slider_arrow" data-case-study-next aria-label="Next case study"></a>
                  </nav>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div class="w-dyn-item">
          <article class="pattern-library-v3--box_slider_wrap">
            <div class="pattern-library-v3--box_slider_element">
              <div class="pattern-library-v3--box_slider_main">
                <div class="pattern-library-v3--box_slider_visual">
                  <div class="pattern-library-v3--u-image-wrapper">
                    <img src="https://example.com/two.jpg" alt="Second visual">
                  </div>
                </div>
                <div class="pattern-library-v3--box_slider_content">
                  <div class="pattern-library-v3--box_slider_icon">
                    <div class="pattern-library-v3--u-image-wrapper">
                      <img src="https://example.com/icon-two.svg" alt="Second icon">
                    </div>
                  </div>
                  <div class="pattern-library-v3--box_slider_heading">
                    <div class="pattern-library-v3--u-text">Second heading</div>
                  </div>
                  <div class="pattern-library-v3--box_slider_text">
                    <div class="pattern-library-v3--u-text">Second body</div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </main>
`);

await page.evaluate(() => {
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.Swiper = class Swiper {
    constructor(element, options) {
      this.element = element;
      this.options = options;
      this.realIndex = 0;
      this.length = element.querySelectorAll('.swiper-slide').length;
      options.navigation.nextEl?.addEventListener('click', () => {
        this.realIndex = (this.realIndex + 1) % this.length;
        options.on.slideChangeTransitionStart(this);
        options.on.transitionEnd(this);
      });
      options.navigation.prevEl?.addEventListener('click', () => {
        this.realIndex = (this.realIndex - 1 + this.length) % this.length;
        options.on.slideChangeTransitionStart(this);
        options.on.transitionEnd(this);
      });
    }

    destroy() {}
  };
});

await page.addScriptTag({ content: moduleSource });
await page.waitForFunction(() => document.querySelector('[data-case-study-slider-ready]'));

const initial = await page.evaluate(() => {
  const root = document.querySelector('.w-dyn-list');
  const component = root.querySelector('[class*="box_slider_wrap"]');
  return {
    rootLabel: root.getAttribute('aria-label'),
    slides: component.querySelectorAll('.case-study_slider_image_slide').length,
    controlsLabel: component.querySelector('[data-case-study-controls]').getAttribute('aria-label'),
    previousLabel: component.querySelector('[data-case-study-prev]').getAttribute('aria-label'),
    nextLabel: component.querySelector('[data-case-study-next]').getAttribute('aria-label'),
    secondHidden: root.querySelectorAll('.w-dyn-item')[1].hidden,
  };
});

assert.deepEqual(initial, {
  rootLabel: 'Featured content',
  slides: 2,
  controlsLabel: 'Slider navigation',
  previousLabel: 'Previous slide',
  nextLabel: 'Next slide',
  secondHidden: true,
});

await page.evaluate(() => document.querySelector('[data-case-study-next]').click());

const updated = await page.evaluate(() => ({
  heading: document.querySelector('[class*="box_slider_heading"] [class*="u-text"]').textContent,
  body: document.querySelector('[class*="box_slider_text"] [class*="u-text"]').textContent,
  icon: document.querySelector('[class*="box_slider_icon"] img').getAttribute('src'),
  headingClass: document
    .querySelector('[class*="box_slider_heading"] [class*="u-text"]')
    .getAttribute('class'),
}));

assert.equal(updated.heading, 'Second heading');
assert.equal(updated.body, 'Second body');
assert.equal(updated.icon, 'https://example.com/icon-two.svg');
assert.ok(updated.headingClass.includes('u-text'));

await browser.close();
console.log('Pattern Box Slider runtime test passed.');
