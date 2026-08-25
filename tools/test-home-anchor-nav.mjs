import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const [scriptSource, styleSource] = await Promise.all([
  read('../webflow/pattern.com/scripts/nav/home-anchor-nav.js'),
  read('../webflow/pattern.com/styles/home-anchor-nav.css'),
]);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  reducedMotion: 'reduce',
});

await page.setContent(`
  <main class="v3_home_track">
    <div class="hero">Hero</div>
    <nav data-home-anchor-nav>
      <a data-home-anchor-link href="#section-a">Section A</a>
      <a data-home-anchor-link href="#section-b">Section B</a>
      <a data-home-anchor-link href="#section-c">Section C</a>
    </nav>
    <section id="section-a">Section A</section>
    <section id="section-b">Section B</section>
    <section id="section-c">Section C</section>
  </main>
`);

await page.addStyleTag({
  content: `${styleSource}
    * { box-sizing: border-box; }
    html { scroll-behavior: auto; }
    body { margin: 0; }
    .v3_home_track { position: relative; }
    .hero { height: 1000px; }
    [data-home-anchor-nav] {
      position: sticky;
      top: 80px;
      display: flex;
      width: 100%;
      height: 78px;
      overflow: clip;
    }
    [data-home-anchor-link] {
      flex: 0 0 180px;
      min-width: 180px;
      display: grid;
      place-items: center;
    }
    section { height: 1000px; }
  `,
});

await page.evaluate(() => {
  window.__webflowAnchorHandlerCalled = false;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented) return;

    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;

    window.__webflowAnchorHandlerCalled = true;
    event.preventDefault();
    window.scrollTo({ top: target.offsetTop, behavior: 'auto' });
  });
});

await page.addScriptTag({ content: scriptSource });
await page.waitForTimeout(50);

const initial = await page.evaluate(() => ({
  ready: document.querySelector('[data-home-anchor-nav]').dataset.homeAnchorReady,
  version: window.PatternHomeAnchorNav?.version,
}));
assert.equal(initial.ready, 'true');
assert.equal(initial.version, '1.0.1');

await page.locator('a[href="#section-b"]').click();
await page.waitForTimeout(50);

const clickResult = await page.evaluate(() => {
  const nav = document.querySelector('[data-home-anchor-ready="true"]');
  const target = document.getElementById('section-b');
  const active = nav.querySelector('.w--current');
  const expectedTop = Number.parseFloat(getComputedStyle(nav).top) + nav.offsetHeight + 16;

  return {
    activeHref: active?.getAttribute('href'),
    expectedTop,
    hash: location.hash,
    horizontalScrollLeft: nav.scrollLeft,
    targetTop: target.getBoundingClientRect().top,
    webflowHandlerCalled: window.__webflowAnchorHandlerCalled,
  };
});

assert.equal(clickResult.hash, '#section-b');
assert.equal(clickResult.activeHref, '#section-b');
assert.equal(clickResult.webflowHandlerCalled, false);
assert.ok(clickResult.horizontalScrollLeft > 0);
assert.ok(Math.abs(clickResult.targetTop - clickResult.expectedTop) <= 1);

await page.evaluate(() => {
  window.location.hash = '#section-c';
});
await page.waitForTimeout(50);

const hashResult = await page.evaluate(() => {
  const nav = document.querySelector('[data-home-anchor-ready="true"]');
  const target = document.getElementById('section-c');
  const expectedTop = Number.parseFloat(getComputedStyle(nav).top) + nav.offsetHeight + 16;

  return {
    activeHref: nav.querySelector('.w--current')?.getAttribute('href'),
    expectedTop,
    targetTop: target.getBoundingClientRect().top,
  };
});

assert.equal(hashResult.activeHref, '#section-c');
assert.ok(Math.abs(hashResult.targetTop - hashResult.expectedTop) <= 1);

await page.evaluate(() => window.PatternHomeAnchorNav.destroy(document));
const destroyed = await page.evaluate(() => {
  const nav = document.querySelector('[data-home-anchor-nav]');
  return {
    layerCount: document.querySelectorAll('.v3_home_anchor_sticky_layer').length,
    ready: nav.getAttribute('data-home-anchor-ready'),
    role: nav.getAttribute('role'),
  };
});

assert.deepEqual(destroyed, {
  layerCount: 0,
  ready: null,
  role: null,
});

await browser.close();
console.log('PASS home anchor navigation offset');
