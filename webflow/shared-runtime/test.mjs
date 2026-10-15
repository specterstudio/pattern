import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const read=p=>fs.readFile(new URL(p,root),'utf8');
const out='webflow/shared-runtime/artifacts/';
await fs.mkdir(new URL(out,root),{recursive:true});
const manifests=await Promise.all(['in.pattern.com','uk.pattern.com'].map(async domain=>JSON.parse(await read('webflow/'+domain+'/scripts/runtime/runtime.config.json'))));
const assets=JSON.parse(await read('webflow/shared-runtime/tests/asset-manifest.json'));
const bodies=new Map(await Promise.all(assets.map(async a=>[a.url,await read('webflow/shared-runtime/.cache/'+a.file)])));
const oldUK=bodies.get('https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.5.2/webflow/uk.pattern.com/version-split/js/loader.js');
const browser=await chromium.launch({headless:true});
const results=[];
async function run(name,task){try{await task();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
const registry=`window.events=[];window.pageFunctions={executed:{},functions:{},added:false,addFunction(id,fn){this.functions[id] ||= fn},executeFunctions(){if(this.added)return;this.added=true;for(const id in this.functions){try{this.functions[id]();this.executed[id]=true}catch(e){window.events.push(e.message)}}}};`;
async function fixture(manifest,{html='<main data-pattern-version="v1"><h1>Hero</h1><h1>Other</h1></main>',pageId,siteId,mode='active',setup='',fail='',delay=''}={}){
  const site=manifest.site;
  const baseline=manifest.legacyPageIds;
  const runtime=await read(`webflow/${site.directory}/scripts/runtime/pattern-${site.key}-transition-runtime.js`);
  const page=await browser.newPage();const requests=[];const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url.endsWith('/__transition_fixture')){
      const head=`<script>window.${site.api}Config=${JSON.stringify({mode})};${registry}${setup}</script>`;
      const footer=`<script>${runtime}</script>`;
      return route.fulfill({contentType:'text/html',body:`<html data-wf-site="${siteId||site.id}" data-wf-page="${pageId||baseline[0]}"><head>${head}</head><body>${html}${footer}</body></html>`});
    }
    requests.push(url);
    if(url===fail)return route.abort();
    if(url===delay)await new Promise(resolve=>setTimeout(resolve,150));
    if(bodies.has(url))return route.fulfill({contentType:url.endsWith('.css')?'text/css':'text/javascript',body:bodies.get(url),headers:{'access-control-allow-origin':'*'}});
    // Services are deliberately inert in generated-global-code preservation tests.
    return route.fulfill({contentType:route.request().resourceType()==='stylesheet'?'text/css':'text/javascript',body:'',headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto(`https://${site.key==='uk'?'uk':'in'}.pattern.com/__transition_fixture`);
  await page.waitForFunction(name=>['ready','degraded','blocked','error'].includes(window[name]?.inspect().status),site.api);
  return {page,requests,errors,runtime};
}
try {
  await run('Installed UK 0.5.2 loader rejects a V3 marker',async()=>{
    const page=await browser.newPage();const requests=[];
    await page.route('**/*',async route=>{
      requests.push(route.request().url());
      await route.fulfill({contentType:'text/html',body:'<main data-pattern-version="v3"></main>'});
    });
    await page.goto('https://uk.pattern.com/__old_loader');await page.addScriptTag({content:oldUK});
    const state=await page.evaluate(()=>window.__patternVersionSplit);
    assert.equal(state.status,'blocked');assert.equal(state.reason,'invalid-version-marker');assert.equal(requests.length,1);await page.close();
  });
  for(const manifest of manifests){
    const name=manifest.site.key;const api=manifest.site.api;
    await run(`${name}: release hash and hosted install template match the generated regional bundle`,async()=>{
      const crypto=await import('node:crypto');
      const folder='webflow/'+manifest.site.directory+'/scripts/runtime/';
      const release=JSON.parse(await read(folder+'release.json'));
      const runtime=await read(release.runtimePath);
      const snippet=await read(folder+'install.template.html');
      const integrity='sha384-'+crypto.createHash('sha384').update(runtime).digest('base64');
      assert.equal(release.version,manifest.version);assert.equal(release.integrity,integrity);
      assert.ok(snippet.includes(integrity));assert.ok(snippet.includes('@REPLACE_WITH_COMMIT_SHA/'+release.runtimePath));
      assert.ok(snippet.includes(manifest.site.api+'Config'));assert.ok(!release.runtimePath.includes('webflow/pattern.com/'));
    });
    for(const version of ['v1','v2','v2l'])await run(`${name}: ${version} uses one legacy owner, heading repair and delayed callbacks`,async()=>{
      const {page,requests,errors}=await fixture(manifest,{html:`<main data-pattern-version="${version}"><h1>Hero</h1><h1>Other</h1><div class="nav_wrap"></div><span id="copyright-year">2000</span></main>`,setup:`window.pageFunctions.addFunction('slider',()=>{if(!window.Splide)throw new Error('Missing Splide');window.events.push('slider')});`,delay:manifest.legacy.assets[0].src});
      const state=await page.evaluate(api=>window[api].inspect(),api);
      assert.equal(state.status,'ready');assert.equal(state.selected.version,version);
      assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('h2').count(),1);
      assert.deepEqual(await page.evaluate(()=>window.events),['slider']);
      assert.equal(await page.locator('#copyright-year').textContent(),String(new Date().getFullYear()));
      assert.ok(requests.some(u=>u.includes('/nav/nav.js')));assert.ok(!requests.some(u=>u.includes('/version-split/')));
      assert.ok(!state.engine.modules.some(m=>m.id==='v3-heading-text-reveal'));assert.deepEqual(errors,[]);await page.close();
    });
    await run(`${name}: V3 retains headings and uses current Library modules without legacy assets`,async()=>{
      const {page,requests,errors}=await fixture(manifest,{html:'<main data-pattern-version="v3"><h1>Hero</h1><h1>Second</h1><span data-dynamic-year>2000</span><div class="nav_wrap"></div></main>'});
      const state=await page.evaluate(api=>window[api].inspect(),api);
      assert.equal(state.status,'ready');assert.equal(state.engine.modules.length,13);assert.equal(await page.locator('h1').count(),2);
      assert.equal(requests.length,0);assert.deepEqual(errors,[]);assert.equal(await page.locator('[data-dynamic-year]').textContent(),String(new Date().getFullYear()));await page.close();
    });
    await run(`${name}: known unmarked pages keep legacy without inventing V1/V2 classification`,async()=>{
      const {page}=await fixture(manifest,{html:'<main><h1>Hero</h1></main>'});const state=await page.evaluate(api=>window[api].inspect(),api);assert.equal(state.selected.version,'legacy-unmarked');assert.equal(state.status,'ready');await page.close();
    });
    for(const [label,options,reason]of [
      ['unknown unmarked page',{pageId:'000000000000000000000000',html:'<main></main>'},'unmarked-new-page'],
      ['unmarked V3 evidence',{html:'<div class="pattern-library-v3--card_wrap"></div>'},'unmarked-v3-evidence'],
      ['conflicting markers',{html:'<main class="page_main_v3" data-pattern-version="v1"></main>'},'conflicting-markers'],
      ['legacy marker with V3 content',{html:'<main data-pattern-version="v1"><div class="pattern-library-v3--card_wrap"></div></main>'},'mixed-version-evidence'],
      ['invalid nested marker',{html:'<main data-pattern-version="v3"><div data-pattern-version="banana"></div></main>'},'invalid-marker'],
      ['wrong site',{siteId:'other'},'wrong-site'],
      ['observe mode',{mode:'observe'},'observe-mode'],
      ['existing loader',{setup:'window.__patternVersionSplit={started:true};'},'existing-runtime-owner']
    ])await run(`${name}: ${label} blocks safely`,async()=>{
      const {page,requests}=await fixture(manifest,options);assert.equal(await page.evaluate(api=>window[api].inspect().reason,api),reason);assert.equal(requests.length,0);await page.close();
    });
    await run(`${name}: an explicit V3 marker overrides the old-page baseline`,async()=>{
      const {page}=await fixture(manifest,{html:'<div class="page_wrap" data-pattern-version="v3"></div>'});assert.equal(await page.evaluate(api=>window[api].inspect().selected.version,api),'v3');await page.close();
    });
    await run(`${name}: dynamic legacy headings still repair after startup`,async()=>{
      const {page}=await fixture(manifest);await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<h1>Dynamic</h1>'));await page.waitForFunction(()=>document.querySelectorAll('h1').length===1);await page.close();
    });
    await run(`${name}: duplicate insertion does not duplicate asset delivery`,async()=>{
      const {page,requests,runtime}=await fixture(manifest);const before=requests.length;await page.addScriptTag({content:runtime});assert.equal(requests.length,before);await page.close();
    });
    await run(`${name}: legacy dependency failure holds callbacks and reports degradation`,async()=>{
      const {page}=await fixture(manifest,{fail:manifest.legacy.assets[0].src,setup:"window.pageFunctions.addFunction('slider',()=>window.events.push('slider'));"});
      await page.waitForFunction(api=>window[api].inspect().engine.modules.some(m=>m.id==='legacy-page-functions'&&window[api].inspect().featureErrors[m.id]),api);
      assert.equal(await page.evaluate(api=>window[api].inspect().status,api),'degraded');assert.deepEqual(await page.evaluate(()=>window.events),[]);await page.close();
    });
    await run(`${name}: mid-session version change cannot activate another family`,async()=>{
      const {page,requests}=await fixture(manifest,{html:'<main data-pattern-version="v3"></main>'});await page.evaluate(()=>{document.querySelector('main').dataset.patternVersion='v1';document.body.insertAdjacentHTML('beforeend','<div class="nav_wrap"></div>')});
      await page.waitForFunction(api=>window[api].inspect().reason==='page-version-changed',api);assert.equal(requests.length,0);await page.close();
    });
    await run(`${name}: existing Finsweet APIs are reused on V3`,async()=>{
      const setup=`window.FinsweetAttributes={modules:{list:{loading:Promise.resolve()}},load:async feature=>window.events.push(feature)};window.fsAttributes={socialshare:{loading:Promise.resolve(),init:()=>window.events.push('share-init')}};`;
      const {page,requests,errors}=await fixture(manifest,{setup,html:'<main data-pattern-version="v3"><div fs-list-element="list"></div><a fs-socialshare-element="share"></a></main>'});
      assert.equal(requests.length,0);assert.deepEqual(await page.evaluate(()=>window.events),['list']);assert.deepEqual(errors,[]);await page.close();
    });
    await run(`${name}: actual current V3 video controllers initialize under the installed prefix`,async()=>{
      const html='<main data-pattern-version="v3"><div class="pattern-library-v3--video_player_wrap"><video data-src="https://example.com/video.mp4"></video></div></main>';
      const {page,requests,errors}=await fixture(manifest,{html});const state=await page.evaluate(api=>window[api].inspect(),api);
      assert.equal(state.status,'ready');assert.ok(requests.some(u=>u.endsWith('/media/video-popup.js')));assert.ok(requests.some(u=>u.endsWith('/media/video-preview.js')));
      assert.ok(!requests.some(u=>u.includes('@v1.0.8/')));assert.deepEqual(errors,[]);await page.close();
    });
    await run(`${name}: transitive GSAP dependencies load before current V3 heading reveal`,async()=>{
      const html='<main data-pattern-version="v3"><h1 data-heading-reveal="true" data-wf--pattern-library-v3--typography-heading--font-style="h1">Heading</h1></main>';
      const {page,requests,errors}=await fixture(manifest,{html});const state=await page.evaluate(api=>window[api].inspect(),api);
      assert.equal(state.status,'ready');assert.ok(requests.some(u=>u.endsWith('/gsap.min.js')));assert.ok(requests.some(u=>u.endsWith('/SplitText.min.js')));assert.ok(requests.some(u=>u.endsWith('/ScrollTrigger.min.js')));assert.deepEqual(errors,[]);await page.close();
    });
    await run(`${name}: the real legacy Splide dependency mounts a component slider`,async()=>{
      const html='<main data-pattern-version="v2"><div class="splide" id="slider"><div class="splide__track"><ul class="splide__list"><li class="splide__slide">One</li><li class="splide__slide">Two</li></ul></div></div></main>';
      const {page,errors}=await fixture(manifest,{html,setup:"window.pageFunctions.addFunction('slider',()=>{window.testSlider=new Splide('#slider',{arrows:false,pagination:false}).mount()});"});
      assert.ok((await page.locator('#slider').getAttribute('class')).includes('is-initialized'));await page.evaluate(()=>window.testSlider.go(1));assert.equal(await page.evaluate(()=>window.testSlider.index),1);assert.deepEqual(errors,[]);await page.close();
    });
    await run(`${name}: retained navigation responds on desktop and mobile`,async()=>{
      const html='<main data-pattern-version="v1"><nav class="nav_wrap"><div class="nav_bottom"><button linkName="products">Products</button></div><div menuName="products">Desktop</div><div menuDropdown="products">Mobile</div></nav></main>';
      const {page,errors}=await fixture(manifest,{html});assert.equal(await page.locator('.nav_wrap').getAttribute('data-pattern-nav-ready'),'true');
      await page.locator('[linkName]').dispatchEvent('mouseenter');assert.equal(await page.locator('[linkName]').getAttribute('aria-expanded'),'true');
      await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('[linkName]').getAttribute('aria-expanded')==='false');await page.locator('[linkName]').click();assert.equal(await page.locator('[linkName]').getAttribute('aria-expanded'),'true');assert.deepEqual(errors,[]);await page.close();
    });
  }
  await run('UK legacy cards load their current full controller after GSAP dependencies',async()=>{
    const manifest=manifests.find(m=>m.site.key==='uk');const {page,requests,errors}=await fixture(manifest,{html:'<main data-pattern-version="v2"><div card-grid><div card-load="fade-in">Card</div></div></main>'});
    await page.waitForFunction(()=>document.querySelector('[card-grid]')?.dataset.cardGridInit==='true');assert.ok(requests.some(u=>u.endsWith('/gsap.min.js')));assert.ok(requests.some(u=>u.endsWith('/ScrollTrigger.min.js')));assert.deepEqual(errors,[]);await page.close();
  });
  await run('India retains the component navigation owner and skips the extra legacy nav controller',async()=>{
    const manifest=manifests.find(m=>m.site.key==='india');const {page,requests}=await fixture(manifest,{html:'<main data-pattern-version="v1"><div class="nav_wrap js_nav"></div></main>'});assert.ok(!requests.some(u=>u.endsWith('/nav/nav.js')));await page.close();
  });
  await run('India legacy hero waits for the actual SplitText dependency before callbacks execute',async()=>{
    const manifest=manifests.find(m=>m.site.key==='india');
    const {page,requests,errors}=await fixture(manifest,{html:'<main data-pattern-version="v1"><h1 class="section_hero_h1">Hero</h1></main>',setup:"window.pageFunctions.addFunction('hero',()=>{window.heroSplit=new SplitText('.section_hero_h1',{type:'chars'});window.events.push('hero')});"});
    assert.deepEqual(await page.evaluate(()=>window.events),['hero']);assert.ok(await page.evaluate(()=>window.heroSplit.chars.length>0));
    assert.ok(requests.some(u=>u.endsWith('/SplitText.min.js')));await page.evaluate(api=>window[api].scan(document),manifest.site.api);assert.deepEqual(await page.evaluate(()=>window.events),['hero']);assert.deepEqual(errors,[]);await page.close();
  });
  await run('UK actual fc-video-popup attribute loads its controller once and respects declined consent',async()=>{
    const manifest=manifests.find(m=>m.site.key==='uk');
    const setup="window.FinsweetConsentPro={push(callback){if(typeof callback==='function')callback({consents:{get:()=>({personalization:false})},on(){}})}};";
    const html='<main data-pattern-version="v2"><button fc-video-popup="open">Open</button><div fc-video-popup="component" class="popup-overlay" style="display:none"><button fc-video-popup="close">Close</button><iframe data-consent-src="https://vimeo.com/1194248611"></iframe></div></main>';
    const {page,requests,errors}=await fixture(manifest,{html,setup});
    assert.equal(await page.evaluate(api=>window[api].inspect().engine.modules.find(m=>m.id==='legacy-video-popup').status,manifest.site.api),'ready');
    await page.locator('[fc-video-popup="open"]').click();assert.equal(await page.locator('iframe').getAttribute('src'),null);
    await page.evaluate(async api=>{await window[api].scan(document);await window[api].scan(document)},manifest.site.api);
    assert.equal(requests.filter(u=>u.endsWith('/media/video-popup.js')).length,1);assert.deepEqual(errors,[]);await page.close();
  });
  await run('UK actual fc-iframe-popup attribute loads its controller without preloading an iframe',async()=>{
    const manifest=manifests.find(m=>m.site.key==='uk');
    const {page,requests,errors}=await fixture(manifest,{html:'<main data-pattern-version="v1"><button fc-iframe-popup="open">Open</button><div fc-iframe-popup="component" style="display:none"><button fc-iframe-popup="close">Close</button><iframe data-consent-src="https://example.com/embed"></iframe></div></main>'});
    assert.equal(await page.evaluate(api=>window[api].inspect().engine.modules.find(m=>m.id==='legacy-iframe-popup').status,manifest.site.api),'ready');assert.equal(await page.locator('iframe').getAttribute('src'),null);
    await page.evaluate(api=>window[api].scan(document),manifest.site.api);assert.equal(requests.filter(u=>u.endsWith('/media/iframe-popup.js')).length,1);assert.deepEqual(errors,[]);await page.close();
  });
}finally{await browser.close();}
await fs.writeFile(new URL(out+'fixture-results.json',root),JSON.stringify(results,null,2)+'\n');
for(const r of results)console.log(`${r.passed?'PASS':'FAIL'} ${r.name}${r.error?'\n'+r.error:''}`);
assert.ok(results.every(r=>r.passed),'Transition runtime browser checks failed');
