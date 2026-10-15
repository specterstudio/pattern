/* Build template. Each site's generated bundle is the sole version owner. */
(() => {
  'use strict';
  const SITE = __SITE__;
  const VERSION = __VERSION__;
  const BASE = __V3_BASE__;
  const V3_MODULES = __V3_MODULES__;
  const LEGACY = __LEGACY__;
  const BASELINE = new Set(__BASELINE__);
  const apiName = SITE.api;
  if (window[apiName]) return;
  const config = {mode:'observe', ...(window[apiName + 'Config'] || {})};
  let status = 'pending', reason = null, error = null, runtime = null, selected = null;
  const errors = new Map();
  const detect = () => {
    const markers = new Set();
    let invalid = false;
    document.querySelectorAll('[data-pattern-version]').forEach(root => {
      const value = root.getAttribute('data-pattern-version');
      if (['v1','v2','v2l','v3'].includes(value)) markers.add(value);
      else invalid = true;
    });
    for (const version of ['v1','v2','v2l','v3']) if (document.querySelector(`.page_main.cc-${version}`)) markers.add(version);
    if (document.querySelector('.page_main_v3,.pattern-library-v3--page_main_v3')) markers.add('v3');
    const correctSite = document.documentElement.dataset.wfSite === SITE.id;
    const pageId = document.documentElement.dataset.wfPage;
    const v3Evidence = !!document.querySelector('[class*="pattern-library-v3--"]');
    const version = markers.size === 1 ? [...markers][0] : markers.size === 0 && !v3Evidence && BASELINE.has(pageId) ? 'legacy-unmarked' : 'unknown';
    const mixedEvidence = v3Evidence && markers.size === 1 && version !== 'v3';
    const why = !correctSite ? 'wrong-site' : invalid ? 'invalid-marker' : markers.size > 1 ? 'conflicting-markers' : mixedEvidence ? 'mixed-version-evidence' : markers.size ? 'explicit-marker' : v3Evidence ? 'unmarked-v3-evidence' : version === 'legacy-unmarked' ? 'existing-page-baseline' : 'unmarked-new-page';
    return {correctSite,pageId,markers:[...markers],version,safe:correctSite && !invalid && !mixedEvidence && markers.size <= 1 && version !== 'unknown',reason:why};
  };
  const boundaryUnchanged = () => {
    const now = detect();
    return selected?.safe && now.safe && selected.version === now.version && selected.pageId === now.pageId;
  };
  const emit = () => document.dispatchEvent(new CustomEvent(`pattern:${SITE.key}-runtime:state`,{detail:{status,reason,error}}));
  window[apiName] = Object.freeze({version:VERSION,detect,
    scan:scope => boundaryUnchanged() && runtime ? runtime.scan(scope || document) : Promise.resolve([]),
    inspect:() => {
      const engine = runtime?.inspect() || null;
      return {version:VERSION,mode:config.mode,status:errors.size || engine?.modules.some(m=>m.status==='error') ? 'degraded' : status,reason,error,selected,current:detect(),featureErrors:Object.fromEntries(errors),engine};
    }
  });
  const globalValue = path => path?.split('.').reduce((value,key)=>value?.[key],window);
  const register = definition => runtime.register({...definition,async init(scope,engine) {
    if (!boundaryUnchanged()) {status='blocked';reason='page-version-changed';runtime.destroy();emit();return;}
    try {
      const api = definition.api || globalValue(definition.global);
      const init = definition.init || api?.[definition.initMethod || 'init'];
      if (typeof init === 'function') await init.call(api,scope,engine);
      errors.delete(definition.id);
    } catch (failure) {errors.set(definition.id,failure.message);throw failure;}
  }});
  const once = task => {
    let promise;
    return () => promise ||= Promise.resolve().then(task);
  };
  const loadLegacy = descriptor => runtime.loadScript(descriptor.src,{...descriptor,id:descriptor.id});
  const registerLegacy = () => {
    // The original CMS callback is installed only in the legacy branch.
    __CMS_CALLBACK__
    register({id:'legacy-heading-normalizer',selector:'h1',initScope:'document',init() {
      [...document.querySelectorAll('h1')].slice(1).forEach(h1 => {
        const h2 = document.createElement('h2');
        for(const attr of h1.attributes) h2.setAttribute(attr.name,attr.value);
        h2.innerHTML=h1.innerHTML;h1.replaceWith(h2);
      });
    }});
    const startup = [];
    for (const descriptor of LEGACY.assets) {
      const run = once(async () => {
        if (descriptor.skipComponentNav && document.querySelector('.js_nav')) return;
        for (const dependency of descriptor.dependencies || []) await runtime.loadDependency(dependency);
        for (const style of descriptor.styles || []) await runtime.loadStyle(style.src,style);
        await loadLegacy(descriptor);
        if (descriptor.globalInit) {
          const init = globalValue(descriptor.globalInit);
          if(typeof init !== 'function') throw new Error(`Missing ${descriptor.globalInit}`);
          init();
        }
      });
      register({id:descriptor.id,selector:descriptor.selector,init:run});
      if (document.querySelector(descriptor.selector)) startup.push(run());
    }
    for (const dependency of LEGACY.callbackDependencies || []) {
      if (document.querySelector(dependency.selector)) startup.push(runtime.loadDependency(dependency.id));
    }
    // Page callbacks include component-owned sliders and heroes. Their dependencies settle first.
    const execute = once(async () => {
      const results = await Promise.allSettled(startup);
      if (!boundaryUnchanged()) return;
      if(results.some(result=>result.status==='rejected')) throw new Error('Legacy startup dependency failed; callbacks held');
      const registry=window.pageFunctions;
      registry?.executeFunctions?.();
      for (const id of Object.keys(registry?.functions || {})) {
        if (!registry.executed?.[id]) throw new Error(`Legacy callback did not complete: ${id}`);
      }
    });
    register({id:'legacy-page-functions',selector:'body',init:execute});
  };
  const listFeature = (feature,selector) => {
    const seen = new WeakSet();let initialized=false,queue=Promise.resolve();
    return {init(scope=document) {
      const roots=[...(scope.querySelectorAll?.(selector)||[])];if(scope.matches?.(selector))roots.push(scope);
      if(!roots.some(root=>!seen.has(root)))return queue;
      roots.forEach(root=>seen.add(root));
      queue=queue.catch(()=>{}).then(async()=>{
        const manager=window.FinsweetAttributes;if(!manager?.load)throw new Error(`Finsweet ${feature} unavailable`);
        if(!initialized){await manager.load(feature);await manager.modules?.[feature]?.loading;initialized=true;}
        else await manager.modules?.[feature]?.restart?.();
      }).catch(failure=>{roots.forEach(root=>seen.delete(root));throw failure;});return queue;
    }};
  };
  const registerShared = () => {
    register({id:'dynamic-year',selector:'[data-dynamic-year],#copyright-year',api:{init(scope=document) {
      const selector='[data-dynamic-year],#copyright-year';const roots=[...(scope.querySelectorAll?.(selector)||[])];if(scope.matches?.(selector))roots.push(scope);
      roots.forEach(root=>{const year=String(new Date().getFullYear());if(root.textContent!==year)root.textContent=year;});
    }}});
    runtime.registerDependency({id:'finsweet-v2',global:'FinsweetAttributes',scripts:[{
      src:'https://cdn.jsdelivr.net/npm/@finsweet/attributes@2.7.1/attributes.js',type:'module',
      integrity:'sha384-xUNsiuzyRX1VYBNfbdrbjkq3Ti55JX/QAqCx7D88OakMPmepdkAsMj8bv1aa5fsj',crossOrigin:'anonymous',
      matchExisting:script=>/^https:\/\/cdn\.jsdelivr\.net\/npm\/@finsweet\/attributes@[^/]+\/attributes\.js(?:\?.*)?$/.test(script.src)
    }]});
    for(const [feature,selector] of [['list','[fs-list-element="list"]'],['scrolldisable','[fs-scrolldisable-element]']]) register({id:`finsweet-${feature}`,selector,dependencies:['finsweet-v2'],api:listFeature(feature,selector)});
    runtime.registerDependency({id:'social-share',global:'fsAttributes.socialshare',scripts:[{
      src:'https://cdn.jsdelivr.net/npm/@finsweet/attributes-socialshare@1.3.2/socialshare.js',
      integrity:'sha384-D2S3kvjqou2OO4E2xTXD1Pg9dxpLd68gdZr0CVgndB9Grh/lCwGqUsUe7vPZT/wC',crossOrigin:'anonymous',attributes:{'fs-attributes-preventload':''},
      matchExisting:script=>/^https:\/\/cdn\.jsdelivr\.net\/npm\/@finsweet\/attributes-socialshare@[^/]+\/socialshare\.js(?:\?.*)?$/.test(script.src)
    }]});
    const seen = new WeakSet();let initialized=false,queue=Promise.resolve();
    register({id:'social-share',selector:'[fs-socialshare-element]',dependencies:['social-share'],api:{init(scope=document) {
      const roots=[...(scope.querySelectorAll?.('[fs-socialshare-element]')||[])];if(scope.matches?.('[fs-socialshare-element]'))roots.push(scope);
      if(!roots.some(root=>!seen.has(root)))return queue;roots.forEach(root=>seen.add(root));
      queue=queue.catch(()=>{}).then(async()=>{
        const feature=window.fsAttributes?.socialshare;if(typeof feature?.init!=='function')throw new Error('Social Share unavailable');
        if(!initialized){if(document.querySelector('script[data-pattern-runtime-asset="social-share:script"][fs-attributes-preventload]'))await feature.init();else await feature.loading;initialized=true;}
        else {feature.destroy?.();await feature.init();}
      }).catch(failure=>{roots.forEach(root=>seen.delete(root));throw failure;});return queue;
    }}});
  };
  const registerV3 = () => {
    for(const definition of V3_MODULES) register({...definition,
      script:definition.script?{...definition.script,src:new URL(definition.script.src,BASE).href}:undefined,
      styles:(definition.styles||[]).map(style=>({...style,src:new URL(style.src,BASE).href}))});
    register({id:'toc',selector:'#toc',script:{
      src:'https://cdn.jsdelivr.net/gh/specterstudio/pattern@9b174800a295ad09a50e1b4d58d5004b853c81b6/webflow/pattern.com/scripts/content/toc.js',
      integrity:'sha384-wjnC/wsWOOSGDSAtJOC1n5wLCu6rWYUl6Mn7mafMUvUQX9zJrAXWdJGk4jyS47BU',crossOrigin:'anonymous'
    }});
  };
  const start = async () => {
    selected=detect();
    if(!selected.safe || config.mode!=='active'){status='blocked';reason=selected.safe?'observe-mode':selected.reason;emit();return;}
    if(window.PatternRuntime || window.PatternVersionGateway || window.PatternRuntimeConfig || window.__patternVersionSplit?.started){status='blocked';reason='existing-runtime-owner';emit();return;}
    status='loading';emit();
    window.PatternRuntimeConfig={baseUrl:BASE,disableDefaults:true,observe:true,debug:!!config.debug,permitScan:()=>{
      if(boundaryUnchanged())return true;
      status='blocked';reason='page-version-changed';runtime?.destroy();emit();return false;
    }};
    try {
      runtime=createTransitionEngine();
      for(const [id,global,file,deps] of [['gsap','gsap','gsap',[]],['scroll-trigger','ScrollTrigger','ScrollTrigger',['gsap']],['split-text','SplitText','SplitText',['gsap']]])runtime.registerDependency({id,global,dependencies:deps,scripts:[{src:`https://cdn.prod.website-files.com/gsap/3.15.0/${file}.min.js`,crossOrigin:'anonymous'}]});
      if(selected.version==='v3')registerV3();else registerLegacy();
      registerShared();runtime.start();await runtime.scan(document);status='ready';emit();
    } catch(failure) {status='error';error=failure.message;runtime?.destroy();emit();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
})();
