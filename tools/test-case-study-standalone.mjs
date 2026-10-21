import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = await fs.readFile(new URL('../webflow/pattern.com/scripts/content/case-study-cms-slider.js', import.meta.url), 'utf8');
const swiper = await fs.readFile(process.env.SWIPER_TEST_SOURCE || new URL('../work/slider-loop-2026-09-05/swiper.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
const results = [];
const component = (name, prefix = '') => `<article class="${prefix}case-study_slider_wrap" role="article" aria-label="${name}">
  <div class="${prefix}case-study_slider_visual"><div class="${prefix}u-image-wrapper"><img alt="${name}"></div></div>
  <div class="${prefix}case-study_slider_content"><div class="${prefix}case-study_slider_quote">${name}</div>
    <a class="${prefix}clickable_link" href="/${name}">Read case study</a></div>
  <div data-case-study-controls class="${prefix}case-study_slider_controls"><button data-case-study-prev>Previous</button><button data-case-study-next>Next</button></div>
</article>`;
const cms = (names, prefix = '') => `<div data-case-study-slider><div class="w-dyn-items">${names.map(name => `<div class="w-dyn-item">${component(name, prefix)}</div>`).join('')}</div></div>`;
const run = async (name, fn) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(5000);
  try { await fn(page); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error(name, error.message); }
  finally { await page.close(); }
};
const load = async (page, html, managed = false) => {
  await page.setContent(`<style>.case-study_slider_visual,[class*="--case-study_slider_visual"]{height:150px} [hidden]{display:none!important}</style>${html}`);
  await page.addScriptTag({ content: swiper });
  if (managed) await page.evaluate(() => { window.PatternRuntime = { managed: true }; });
  await page.addScriptTag({ content: source });
  if (managed) await page.evaluate(() => window.PatternCaseStudyCMS.init(document, { managed: true, detectVersion: () => ({ version: 'v3' }) }));
};

try {
  const expectedSRI = `sha384-${crypto.createHash('sha384').update(source).digest('base64')}`;
  for (const file of ['pattern-version-gateway.js', 'pattern-runtime-library-0.3.1.js', 'pattern-runtime-consumer-0.2.1.js']) {
    const runtime = await fs.readFile(new URL(`../webflow/pattern.com/scripts/runtime/${file}`, import.meta.url), 'utf8');
    assert.ok(runtime.includes(expectedSRI), `${file} must pin the candidate module's actual bytes`);
  }
  for (const prefix of ['', 'pattern-library-v3--']) {
    for (const count of [0, 1, 2]) {
      await run(`${prefix || 'unprefixed'}: ${count} standalone components hide independently`, async page => {
        await load(page, Array.from({ length: count }, (_, i) => component(`standalone-${i}`, prefix)).join(''));
        const state = await page.evaluate(() => [...document.querySelectorAll('[class*="case-study_slider_wrap"]')].map(e => ({
          hidden: e.querySelector('[data-case-study-controls]').hidden,
          static: e.hasAttribute('data-case-study-slider-static'), role: e.getAttribute('role'),
          quote: e.querySelector('[class*="case-study_slider_quote"]').textContent,
          href: e.querySelector('a').getAttribute('href'), swiper: !!e.querySelector('.swiper')
        })));
        assert.equal(state.length, count);
        state.forEach((e, i) => assert.deepEqual(e, { hidden: true, static: true, role: 'article', quote: `standalone-${i}`, href: `/standalone-${i}`, swiper: false }));
      });
      await run(`${prefix || 'unprefixed'}: ${count} CMS items retain existing behavior`, async page => {
        await load(page, cms(Array.from({ length: count }, (_, i) => `cms-${i}`), prefix));
        const state = await page.evaluate(() => {
          const root = document.querySelector('[data-case-study-slider]');
          return { static: root.hasAttribute('data-case-study-slider-static'), ready: root.hasAttribute('data-case-study-slider-ready'),
            hidden: root.querySelector('[data-case-study-controls]')?.hidden ?? null,
            standalone: [...root.querySelectorAll('[class*="case-study_slider_wrap"]')].some(e => window.PatternCaseStudyCMS.standalone.has(e)) };
        });
        assert.equal(state.standalone, false);
        assert.deepEqual(state, { static: count === 1, ready: count > 1, hidden: count ? count === 1 : null, standalone: false });
        if (count > 1) {
          await page.getByRole('button', { name: 'Next case study', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[class*="case-study_slider_quote"]').textContent === 'cms-1');
          await page.getByRole('button', { name: 'Previous case study', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('[class*="case-study_slider_quote"]').textContent === 'cms-0');
        }
      });
    }
  }

  await run('CMS and standalone components can coexist', async page => {
    await load(page, component('solo') + cms(['one', 'two', 'three']));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-case-study-controls]')].map(c => c.hidden)), [true, false, false, false]);
    await page.getByRole('button', { name: 'Next case study', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-case-study-slider] [class*="case-study_slider_quote"]').textContent === 'two');
  });

  await run('A standalone inside an explicit wrapper without CMS items is still static', async page => {
    await load(page, `<div data-case-study-slider>${component('solo')}</div>`);
    assert.equal(await page.locator('[data-case-study-controls]').evaluate(c => c.hidden), true);
  });

  await run('Scoped init is idempotent and destroy restores authored state', async page => {
    await load(page, component('solo'), true);
    const state = await page.evaluate(() => {
      const c = document.querySelector('article'), controls = c.querySelector('[data-case-study-controls]');
      window.PatternCaseStudyCMS.init(c); window.PatternCaseStudyCMS.init(c);
      const hidden = controls.hidden;
      window.PatternCaseStudyCMS.destroy(c);
      return { hidden, restored: controls.hidden, static: c.hasAttribute('data-case-study-slider-static'), role: c.getAttribute('role') };
    });
    assert.deepEqual(state, { hidden: true, restored: false, static: false, role: 'article' });
  });

  await run('Destroy preserves an authored hidden control and static marker', async page => {
    await load(page, component('solo').replace('role="article"', 'role="article" data-case-study-slider-static').replace('data-case-study-controls ', 'data-case-study-controls hidden '));
    assert.deepEqual(await page.evaluate(() => { const c = document.querySelector('article'); window.PatternCaseStudyCMS.destroy(document); return [c.querySelector('[data-case-study-controls]').hidden, c.hasAttribute('data-case-study-slider-static')]; }), [true, true]);
  });

  await run('A standalone component moved into a multi-item CMS slider regains controls', async page => {
    await load(page, component('solo') + '<div data-case-study-slider><div class="w-dyn-items"></div></div>');
    await page.evaluate(html => {
      const c = document.querySelector('article'), item = document.createElement('div'); item.className = 'w-dyn-item'; item.append(c);
      const list = document.querySelector('.w-dyn-items'); list.append(item); list.insertAdjacentHTML('beforeend', `<div class="w-dyn-item">${html}</div>`);
      window.PatternCaseStudyCMS.init(document);
    }, component('second'));
    assert.deepEqual(await page.evaluate(() => { const c = document.querySelector('article'); return [c.querySelector('[data-case-study-controls]').hidden, c.hasAttribute('data-case-study-slider-static'), document.querySelector('[data-case-study-slider]').hasAttribute('data-case-study-slider-ready')]; }), [false, false, true]);
  });

  await run('A late-added control is hidden and restored on destroy', async page => {
    await load(page, '<article class="case-study_slider_wrap"></article>');
    assert.deepEqual(await page.evaluate(() => { const c = document.querySelector('article'); c.insertAdjacentHTML('beforeend', '<div data-case-study-controls></div>'); window.PatternCaseStudyCMS.init(c); const controls = c.firstElementChild, hidden = controls.hidden; window.PatternCaseStudyCMS.destroy(c); return [hidden, controls.hidden]; }), [true, false]);
  });

  for (const version of ['v1', 'v2', 'v2l']) await run(`${version} remains excluded`, async page => {
    await page.setContent(component(version));
    await page.evaluate(() => { window.PatternRuntime = { managed: true }; });
    await page.addScriptTag({ content: source });
    await page.evaluate(version => window.PatternCaseStudyCMS.init(document, { detectVersion: () => ({ version }) }), version);
    assert.equal(await page.locator('[data-case-study-controls]').getAttribute('hidden'), null);
  });

  if (process.env.CASE_STUDY_LIVE_FIXTURES) {
    for (const region of ['uk', 'us']) await run(`${region.toUpperCase()} published markup retains content, assets and links`, async page => {
      const capture = JSON.parse(await fs.readFile(`${process.env.CASE_STUDY_LIVE_FIXTURES}/${region}-live-before.json`, 'utf8'));
      const html = region === 'uk' ? capture.cases.map(c => c.html).join('') : capture.roots.join('');
      await page.setContent(html);
      const before = await page.locator('body').evaluate(b => ({ text: b.textContent, images: [...b.querySelectorAll('img')].map(i => i.getAttribute('src')), links: [...b.querySelectorAll('a')].map(i => i.getAttribute('href')) }));
      await page.addScriptTag({ content: source });
      const after = await page.locator('body').evaluate(b => ({ text: [...b.childNodes].filter(n => n.nodeName !== 'SCRIPT').map(n => n.textContent).join(''), images: [...b.querySelectorAll('img')].map(i => i.getAttribute('src')), links: [...b.querySelectorAll('a')].map(i => i.getAttribute('href')) }));
      assert.deepEqual(after, before);
      assert.equal(await page.locator('[data-case-study-controls]').evaluate(c => c.hidden), true);
      if (region === 'us') assert.equal(await page.locator('[class*="case-study_slider_wrap"]').evaluate(c => window.PatternCaseStudyCMS.standalone.has(c)), false);
    });
  }
} finally { await browser.close(); }

console.log(JSON.stringify({ passed: results.filter(r => r.passed).length, total: results.length, results }, null, 2));
if (results.some(r => !r.passed)) process.exitCode = 1;
