(() => {
  'use strict';

  const GLOBAL_NAME = 'PatternRuntime';
  const VERSION = '0.2.1';
  const EVENT_PREFIX = 'pattern:runtime';
  const DYNAMIC_YEAR_SELECTOR = '[data-dynamic-year]';
  const FINSWEET_LIST_SELECTOR = '[fs-list-element="list"]';
  const FINSWEET_SCROLL_DISABLE_SELECTOR = '[fs-scrolldisable-element]';
  const FINSWEET_SOCIAL_SHARE_SELECTOR = '[fs-socialshare-element]';
  const VIDEO_PLAYER_ROOT_SELECTOR = [
    '[class~="video_player_wrap"]',
    '[class*="--video_player_wrap "]',
    '[class$="--video_player_wrap"]',
  ].join(',');
  const VIDEO_PREVIEW_SELECTOR = VIDEO_PLAYER_ROOT_SELECTOR.split(',')
    .map((selector) => `${selector} video[data-src]`)
    .join(',');
  const currentScript = document.currentScript;
  const existingRuntime = window[GLOBAL_NAME];

  if (existingRuntime?.version) {
    existingRuntime.scan(document);
    return;
  }

  const config = {
    debug:
      currentScript?.hasAttribute('data-pattern-runtime-debug') ||
      new URLSearchParams(window.location.search).has('pattern-runtime-debug'),
    observe: true,
    disableDefaults: false,
    ...(window.PatternRuntimeConfig || {}),
  };

  const baseUrl = config.baseUrl || (currentScript?.src ? new URL('.', currentScript.src).href : '');
  const modules = new Map();
  const moduleStates = new Map();
  const dependencies = new Map();
  const dependencyPromises = new Map();
  const scriptPromises = new Map();
  const stylePromises = new Map();
  const queuedScopes = new Set();
  let observer = null;
  let scanFrame = 0;
  let booted = false;

  const debug = (...args) => {
    if (config.debug) console.info('[Pattern Runtime]', ...args);
  };

  const warn = (...args) => {
    console.warn('[Pattern Runtime]', ...args);
  };

  const emit = (name, detail) => {
    document.dispatchEvent(
      new CustomEvent(`${EVENT_PREFIX}:${name}`, {
        detail,
      }),
    );
  };

  const resolveUrl = (value) => {
    if (!value) return '';

    try {
      return new URL(value, baseUrl || window.location.href).href;
    } catch (error) {
      warn('Invalid asset URL:', value, error);
      return '';
    }
  };

  const getGlobal = (path) => {
    if (!path) return null;

    return String(path)
      .split('.')
      .reduce((value, key) => value?.[key], window);
  };

  const hasMatch = (scope, selector) => {
    if (!scope || !selector) return false;
    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches?.(selector)) return true;
    return Boolean(scope.querySelector?.(selector));
  };

  const collectMatches = (scope, selector) => {
    const matches = [];
    if (scope?.nodeType === Node.ELEMENT_NODE && scope.matches?.(selector)) {
      matches.push(scope);
    }
    scope?.querySelectorAll?.(selector).forEach((element) => matches.push(element));
    return matches;
  };

  const updateDynamicYears = (scope = document) => {
    const year = String(new Date().getFullYear());
    const elements = [];

    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches?.(DYNAMIC_YEAR_SELECTOR)) {
      elements.push(scope);
    }

    scope.querySelectorAll?.(DYNAMIC_YEAR_SELECTOR).forEach((element) => {
      elements.push(element);
    });

    elements.forEach((element) => {
      if (element.textContent !== year) element.textContent = year;
    });
  };

  const createFinsweetV2Feature = (feature, selector) => {
    const seen = new WeakSet();
    let initialized = false;
    let restartPromise = null;

    return {
      async init(scope = document) {
        const matches = collectMatches(scope, selector);
        const hasNewMatches = matches.some((element) => {
          if (seen.has(element)) return false;
          seen.add(element);
          return true;
        });
        if (!hasNewMatches) return;

        const manager = window.FinsweetAttributes;
        if (!manager?.load) {
          throw new Error(`Finsweet Attributes is unavailable for "${feature}".`);
        }

        if (!initialized) {
          await manager.load(feature);
          await manager.modules?.[feature]?.loading;
          initialized = true;
          return;
        }

        const restart = manager.modules?.[feature]?.restart;
        if (typeof restart !== 'function') return;

        if (!restartPromise) {
          restartPromise = Promise.resolve(restart()).finally(() => {
            restartPromise = null;
          });
        }
        await restartPromise;
      },
    };
  };

  const createFinsweetSocialShareFeature = () => {
    const seen = new WeakSet();
    let initialized = false;
    let restartPromise = null;

    return {
      async init(scope = document) {
        const matches = collectMatches(scope, FINSWEET_SOCIAL_SHARE_SELECTOR);
        const hasNewMatches = matches.some((element) => {
          if (seen.has(element)) return false;
          seen.add(element);
          return true;
        });
        if (!hasNewMatches) return;

        const socialShare = window.fsAttributes?.socialshare;
        if (typeof socialShare?.init !== 'function') {
          throw new Error('Finsweet Social Share is unavailable.');
        }

        const runtimeOwnedScript = document.querySelector(
          'script[data-pattern-runtime-asset="finsweet-social-share-v1:script"]' +
            '[fs-attributes-preventload]',
        );

        if (!initialized) {
          if (runtimeOwnedScript) await socialShare.init();
          else await socialShare.loading;
          initialized = true;
          return;
        }

        if (!restartPromise) {
          restartPromise = (async () => {
            socialShare.destroy?.();
            await socialShare.init();
          })().finally(() => {
            restartPromise = null;
          });
        }
        await restartPromise;
      },
    };
  };

  const setAssetAttributes = (element, options = {}) => {
    element.setAttribute('data-pattern-runtime-asset', options.id || '');

    if (options.type) element.type = options.type;

    Object.entries(options.attributes || {}).forEach(([name, value]) => {
      if (value === false || value == null) return;
      element.setAttribute(name, value === true ? '' : String(value));
    });

    if (options.integrity) {
      element.integrity = options.integrity;
      element.crossOrigin = options.crossOrigin || 'anonymous';
    } else if (options.crossOrigin) {
      element.crossOrigin = options.crossOrigin;
    }

    if (options.referrerPolicy) element.referrerPolicy = options.referrerPolicy;
  };

  const loadScript = (source, options = {}) => {
    const url = resolveUrl(source);
    if (!url) return Promise.reject(new Error(`Invalid script URL: ${source}`));
    if (scriptPromises.has(url)) return scriptPromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(
        (script) =>
          script.src === url ||
          (typeof options.matchExisting === 'function' &&
            options.matchExisting(script, url)),
      );

      if (
        existing?.dataset.patternAssetLoaded === 'true' ||
        existing?.dataset.patternRuntimeLoaded === 'true'
      ) {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement('script');
      const finish = () => {
        script.dataset.patternAssetLoaded = 'true';
        script.dataset.patternRuntimeLoaded = 'true';
        resolve(script);
      };
      const fail = () => reject(new Error(`Failed to load script: ${url}`));

      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', fail, { once: true });

      if (existing) return;

      script.src = url;
      script.async = true;
      setAssetAttributes(script, options);
      document.head.appendChild(script);
    });

    scriptPromises.set(url, promise);
    return promise;
  };

  const loadStyle = (source, options = {}) => {
    const url = resolveUrl(source);
    if (!url) return Promise.reject(new Error(`Invalid stylesheet URL: ${source}`));
    if (stylePromises.has(url)) return stylePromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(
        (link) =>
          link.href === url ||
          (options.integrity && link.integrity === options.integrity),
      );

      if (existing?.dataset.patternRuntimeLoaded === 'true' || existing?.sheet) {
        existing.dataset.patternAssetLoaded = 'true';
        existing.dataset.patternRuntimeLoaded = 'true';
        resolve(existing);
        return;
      }

      const link = existing || document.createElement('link');
      const finish = () => {
        link.dataset.patternAssetLoaded = 'true';
        link.dataset.patternRuntimeLoaded = 'true';
        resolve(link);
      };
      const fail = () => reject(new Error(`Failed to load stylesheet: ${url}`));

      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', fail, { once: true });

      if (existing) return;

      link.rel = 'stylesheet';
      link.href = url;
      setAssetAttributes(link, options);
      document.head.appendChild(link);
    });

    stylePromises.set(url, promise);
    return promise;
  };

  const registerDependency = (definition) => {
    if (!definition?.id) throw new Error('A dependency id is required.');
    dependencies.set(definition.id, { ...definition });
  };

  const loadDependency = (id) => {
    if (dependencyPromises.has(id)) return dependencyPromises.get(id);

    const definition = dependencies.get(id);
    if (!definition) return Promise.reject(new Error(`Unknown dependency: ${id}`));

    const promise = (async () => {
      if (definition.global && getGlobal(definition.global)) {
        debug(`Dependency "${id}" already exists.`);
        return getGlobal(definition.global);
      }

      await Promise.all(
        (definition.styles || []).map((style) =>
          loadStyle(style.src || style, {
            ...style,
            id: `${id}:style`,
          }),
        ),
      );

      for (const script of definition.scripts || []) {
        await loadScript(script.src || script, {
          ...script,
          id: `${id}:script`,
        });
      }

      const value = definition.global ? getGlobal(definition.global) : true;
      if (!value) throw new Error(`Dependency "${id}" loaded without ${definition.global}.`);

      debug(`Dependency "${id}" is ready.`);
      return value;
    })().catch((error) => {
      dependencyPromises.delete(id);
      emit('dependency-error', { dependency: id, error });
      throw error;
    });

    dependencyPromises.set(id, promise);
    return promise;
  };

  const normalizeModule = (definition) => {
    if (!definition?.id) throw new Error('A module id is required.');
    if (!definition.selector) throw new Error(`Module "${definition.id}" needs a selector.`);

    return {
      dependencies: [],
      styles: [],
      initMethod: 'init',
      destroyMethod: 'destroy',
      initScope: 'scope',
      ...definition,
    };
  };

  const register = (definition) => {
    const normalized = normalizeModule(definition);
    modules.set(normalized.id, normalized);

    if (!moduleStates.has(normalized.id)) {
      moduleStates.set(normalized.id, {
        status: 'idle',
        error: null,
        promise: null,
      });
    }

    if (booted) void scan(document);
    return api;
  };

  const resolveModuleApi = (definition) =>
    definition.api || getGlobal(definition.global);

  const ensureModule = (definition) => {
    const state = moduleStates.get(definition.id);
    if (state.promise) return state.promise;

    state.status = 'loading';
    state.error = null;
    emit('module-loading', { module: definition.id });

    state.promise = (async () => {
      await Promise.all(definition.dependencies.map(loadDependency));
      await Promise.all(
        definition.styles.map((style) =>
          loadStyle(style.src || style, {
            ...style,
            id: `${definition.id}:style`,
          }),
        ),
      );

      if (definition.script && !resolveModuleApi(definition)) {
        await loadScript(definition.script.src || definition.script, {
          ...definition.script,
          id: `${definition.id}:script`,
        });
      }

      const moduleApi = resolveModuleApi(definition);
      if (definition.global && !moduleApi) {
        throw new Error(`Module "${definition.id}" loaded without ${definition.global}.`);
      }

      state.status = 'ready';
      emit('module-ready', { module: definition.id });
      debug(`Module "${definition.id}" is ready.`);
      return moduleApi;
    })().catch((error) => {
      state.status = 'error';
      state.error = error;
      state.promise = null;
      emit('module-error', { module: definition.id, error });
      warn(`Module "${definition.id}" failed. Static content remains available.`, error);
      throw error;
    });

    return state.promise;
  };

  const initializeModule = async (definition, scope) => {
    const moduleApi = await ensureModule(definition);
    const init = definition.init || moduleApi?.[definition.initMethod];
    if (typeof init !== 'function') return;

    const initScope = definition.initScope === 'document' ? document : scope;
    await init(initScope, api);
  };

  const cleanupModule = (definition, scope) => {
    const state = moduleStates.get(definition.id);
    if (state?.status !== 'ready') return;

    const moduleApi = resolveModuleApi(definition);
    const destroy = definition.destroy || moduleApi?.[definition.destroyMethod];
    if (typeof destroy !== 'function') return;

    try {
      destroy(scope, api);
    } catch (error) {
      warn(`Module "${definition.id}" cleanup failed.`, error);
    }
  };

  const scan = async (scope = document) => {
    const jobs = [];

    modules.forEach((definition) => {
      if (!hasMatch(scope, definition.selector)) return;
      jobs.push(initializeModule(definition, scope));
    });

    const results = await Promise.allSettled(jobs);
    emit('scan-complete', { scope, matched: jobs.length });
    return results;
  };

  const flushQueuedScopes = () => {
    scanFrame = 0;
    const scopes = [...queuedScopes];
    queuedScopes.clear();
    scopes.forEach((scope) => void scan(scope));
  };

  const queueScan = (scope) => {
    if (!scope || scope.nodeType !== Node.ELEMENT_NODE) return;
    queuedScopes.add(scope);
    if (!scanFrame) scanFrame = window.requestAnimationFrame(flushQueuedScopes);
  };

  const observe = () => {
    if (!config.observe || observer || !document.body) return;

    observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach(queueScan);
        record.removedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE || node.isConnected) return;
          modules.forEach((definition) => {
            if (hasMatch(node, definition.selector)) cleanupModule(definition, node);
          });
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const destroy = (scope = document) => {
    modules.forEach((definition) => cleanupModule(definition, scope));

    if (scope === document) {
      observer?.disconnect();
      observer = null;
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      scanFrame = 0;
      queuedScopes.clear();
    }
  };

  const inspect = () => ({
    version: VERSION,
    baseUrl,
    observing: Boolean(observer),
    modules: [...modules.values()].map((definition) => {
      const state = moduleStates.get(definition.id);
      return {
        id: definition.id,
        selector: definition.selector,
        status: state?.status || 'idle',
        matched: hasMatch(document, definition.selector),
        dependencies: [...definition.dependencies],
        error: state?.error?.message || null,
      };
    }),
    dependencies: [...dependencies.keys()].map((id) => ({
      id,
      status: dependencyPromises.has(id) ? 'requested' : 'idle',
    })),
  });

  const api = {
    version: VERSION,
    managed: true,
    config,
    register,
    registerDependency,
    loadDependency,
    loadScript,
    loadStyle,
    scan,
    destroy,
    inspect,
  };

  window[GLOBAL_NAME] = api;

  registerDependency({
    id: 'gsap',
    global: 'gsap',
    scripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js',
        crossOrigin: 'anonymous',
      },
    ],
  });

  registerDependency({
    id: 'swiper',
    global: 'Swiper',
    styles: [
      {
        src: 'https://cdn.jsdelivr.net/npm/swiper@8.4.7/swiper-bundle.min.css',
        crossOrigin: 'anonymous',
      },
    ],
    scripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/swiper@8.4.7/swiper-bundle.min.js',
        crossOrigin: 'anonymous',
      },
    ],
  });

  registerDependency({
    id: 'finsweet-attributes-v2',
    global: 'FinsweetAttributes',
    scripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@finsweet/attributes@2.7.1/attributes.js',
        type: 'module',
        integrity:
          'sha384-xUNsiuzyRX1VYBNfbdrbjkq3Ti55JX/QAqCx7D88OakMPmepdkAsMj8bv1aa5fsj',
        crossOrigin: 'anonymous',
        matchExisting: (script) => {
          try {
            const url = new URL(script.src);
            return (
              url.hostname === 'cdn.jsdelivr.net' &&
              url.pathname.startsWith('/npm/@finsweet/attributes@') &&
              url.pathname.endsWith('/attributes.js')
            );
          } catch {
            return false;
          }
        },
      },
    ],
  });

  registerDependency({
    id: 'finsweet-social-share-v1',
    global: 'fsAttributes.socialshare',
    scripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@finsweet/attributes-socialshare@1.3.2/socialshare.js',
        integrity:
          'sha384-D2S3kvjqou2OO4E2xTXD1Pg9dxpLd68gdZr0CVgndB9Grh/lCwGqUsUe7vPZT/wC',
        crossOrigin: 'anonymous',
        attributes: {
          'fs-attributes-preventload': '',
        },
        matchExisting: (script) => {
          try {
            const url = new URL(script.src);
            return (
              url.hostname === 'cdn.jsdelivr.net' &&
              url.pathname.startsWith('/npm/@finsweet/attributes-socialshare@') &&
              url.pathname.endsWith('/socialshare.js')
            );
          } catch {
            return false;
          }
        },
      },
    ],
  });

  if (!config.disableDefaults) {
    register({
      id: 'dynamic-year',
      selector: DYNAMIC_YEAR_SELECTOR,
      api: {
        init: updateDynamicYears,
      },
    });

    register({
      id: 'finsweet-list',
      selector: FINSWEET_LIST_SELECTOR,
      dependencies: ['finsweet-attributes-v2'],
      api: createFinsweetV2Feature('list', FINSWEET_LIST_SELECTOR),
    });

    register({
      id: 'finsweet-scroll-disable',
      selector: FINSWEET_SCROLL_DISABLE_SELECTOR,
      dependencies: ['finsweet-attributes-v2'],
      api: createFinsweetV2Feature('scrolldisable', FINSWEET_SCROLL_DISABLE_SELECTOR),
    });

    register({
      id: 'finsweet-social-share',
      selector: FINSWEET_SOCIAL_SHARE_SELECTOR,
      dependencies: ['finsweet-social-share-v1'],
      api: createFinsweetSocialShareFeature(),
    });

    register({
      id: 'marquee',
      selector: '[data-marquee]',
      global: 'PatternMarquee',
      script: {
        src: '../interaction/marquee.js',
        integrity: 'sha384-CUDP6vv0eZ3XQQvD0Wn6Osr4Tm6vKXZNq7DnCtlsWYpDkvfJFWHbcTO06d8AtPPT',
      },
      styles: [
        {
          src: '../../styles/marquee.css',
          integrity: 'sha384-AmEK1fi+66pyjxnbxtHuCV0BHx0uBH5U2fBj8aFVKE8ut+PH6qVBGom9170D2Wbn',
        },
      ],
    });

    register({
      id: 'home-anchor-nav',
      selector: [
        '[data-home-anchor-nav]',
        '[class~="home_anchor_nav"]',
        '[class*="--home_anchor_nav "]',
        '[class$="--home_anchor_nav"]',
      ].join(','),
      global: 'PatternHomeAnchorNav',
      script: {
        src: '../nav/home-anchor-nav.js',
        integrity: 'sha384-N+zkGeyVjcSRZYMUGUINy5NRlwu3B/GC/THABPGgj1aLI2YwqEQCMT7edc2K0THk',
      },
      styles: [
        {
          src: '../../styles/home-anchor-nav.css',
          integrity: 'sha384-ARO/NRKecnIc+LAa8Lf4ZbOVm/UsvIWOcU3OJyQXoQAze6jQDhrSXQ9cTpkAlupf',
        },
      ],
    });

    register({
      id: 'case-study',
      selector: [
        '[data-case-study-slider]',
        '[class~="case-study_slider_wrap"]',
        '[class*="--case-study_slider_wrap "]',
        '[class$="--case-study_slider_wrap"]',
      ].join(','),
      global: 'PatternCaseStudyCMS',
      script: {
        src: '../content/case-study-cms-slider.js',
        integrity: 'sha384-Nf6NYJqQnnQBY2YEp1iIzrYLTLAMr9gUxGnhscFz5EDQbm/8jz0tE0yoTaaoTBph',
      },
      initScope: 'document',
    });

    register({
      id: 'accordion',
      selector: '[data-accordion], [class*="accordion_wrap"]',
      global: 'PatternAccordion',
      script: {
        src: '../interaction/accordion.js',
        integrity: 'sha384-EFg0P5l1NeVQxGzun6SnQdALBCSs680cLLhYUFbMXZJqRr7T+8tGuiemc7KwQOBG',
      },
      dependencies: ['gsap'],
    });

    register({
      id: 'video-popup',
      selector: VIDEO_PLAYER_ROOT_SELECTOR,
      global: 'PatternVideoPopup',
      script: {
        src: '../media/video-popup.js',
        integrity: 'sha384-V4sdBPl9LCUpScdMBwHAdo/2SU0XWve1/EKhf4MmMSnUVbwDtCAiGgKcHi+1VuS0',
      },
    });

    register({
      id: 'video-preview',
      selector: VIDEO_PREVIEW_SELECTOR,
      global: 'PatternVideoPreview',
      script: {
        src: '../media/video-preview.js',
        integrity: 'sha384-chLfIt1Cm0PzKy6+62JMrZXl+UUFPV8YY5HkqEsGDWI2unAuosUbx7uP+SktbCwR',
      },
    });
  }

  const boot = () => {
    if (booted) return;
    booted = true;
    void scan(document);
    observe();
    emit('ready', { runtime: api });
    debug('Ready.', inspect());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
