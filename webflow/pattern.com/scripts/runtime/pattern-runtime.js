(() => {
  'use strict';

  const GLOBAL_NAME = 'PatternRuntime';
  const VERSION = '1.0.0';
  const EVENT_PREFIX = 'pattern:runtime';
  const ALL_VERSIONS = ['v1', 'v2', 'v2l', 'v3'];
  const LEGACY_VERSIONS = ['v1', 'v2', 'v2l'];
  const PROFILES = ['library-v3', 'consumer'];
  const DYNAMIC_YEAR_SELECTOR = '[data-dynamic-year]';
  const V3_HEADING_REVEAL_SELECTOR = [
    '[data-heading-reveal="true"][data-wf--typography-heading--font-style="h1"]',
    '[data-heading-reveal="true"][data-wf--pattern-library-v3--typography-heading--font-style="h1"]',
    '#page-hero [data-heading-reveal][data-wf--typography-heading--font-style]',
    '#page-hero [data-heading-reveal][data-wf--pattern-library-v3--typography-heading--font-style]',
    '#page-hero [data-animate-heading][data-wf--typography-heading--font-style]',
    '#page-hero [data-animate-heading][data-wf--pattern-library-v3--typography-heading--font-style]',
  ].join(',');
  const FINSWEET_LIST_SELECTOR = '[fs-list-element="list"]';
  const FINSWEET_SCROLL_DISABLE_SELECTOR = '[fs-scrolldisable-element]';
  const FINSWEET_SOCIAL_SHARE_SELECTOR = '[fs-socialshare-element]';
  const V3_VIDEO_PLAYER_ROOT_SELECTOR = [
    '[class~="video_player_wrap"]',
    '[class*="--video_player_wrap "]',
    '[class$="--video_player_wrap"]',
  ].join(',');
  const currentScript = document.currentScript;
  const existingRuntime = window[GLOBAL_NAME];

  if (existingRuntime?.version) {
    existingRuntime.scan(document);
    return;
  }

  const scriptConfig = {
    profile: currentScript?.dataset.patternRuntimeProfile,
    mode: currentScript?.dataset.patternRuntimeMode,
    version: currentScript?.dataset.patternRuntimeVersion,
    legacyPolicy: currentScript?.dataset.patternRuntimeLegacyPolicy,
    manifestVersion: currentScript?.dataset.patternRuntimeManifestVersion,
    debug: currentScript?.hasAttribute('data-pattern-runtime-debug') || undefined,
  };

  const config = {
    profile: 'consumer',
    mode: 'observe',
    legacyPolicy: 'preserve',
    observeMutations: true,
    version: '',
    routes: [],
    pageFunctions: ['nav', 'splideSlider'],
    disableDefaults: false,
    debug: new URLSearchParams(window.location.search).has('pattern-runtime-debug'),
    ...(window.PatternRuntimeConfig || {}),
    ...Object.fromEntries(
      Object.entries(scriptConfig).filter(([, value]) => value !== undefined && value !== ''),
    ),
  };

  config.profile = PROFILES.includes(config.profile) ? config.profile : 'consumer';
  if (typeof config.pageFunctions === 'string') {
    config.pageFunctions = config.pageFunctions
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(config.pageFunctions)) config.pageFunctions = [];
  if (typeof config.observe === 'boolean') config.observeMutations = config.observe;

  const baseUrl = config.baseUrl || (currentScript?.src ? new URL('.', currentScript.src).href : '');
  const LEGACY_BASE =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com';
  const LEGACY_IFRAME_BASE =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.2/webflow/pattern.com';
  const CARD_LOAD_BASE =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6/webflow/pattern.com';
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
  let detection = null;

  const debug = (...args) => {
    if (config.debug) console.info('[Pattern Runtime]', ...args);
  };

  const warn = (...args) => {
    console.warn('[Pattern Runtime]', ...args);
  };

  const emit = (name, detail = {}) => {
    document.dispatchEvent(
      new CustomEvent(`${EVENT_PREFIX}:${name}`, {
        detail: {
          runtime: api,
          ...detail,
        },
      }),
    );
  };

  const normalizeVersion = (value) => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^version[-_\s]*/, 'v');

    if (normalized === '1') return 'v1';
    if (normalized === '2') return 'v2';
    if (normalized === '2l') return 'v2l';
    if (normalized === '3') return 'v3';
    return ALL_VERSIONS.includes(normalized) ? normalized : '';
  };

  const getFamily = (version) => {
    if (version === 'v2l') return 'v2';
    return version || 'unknown';
  };

  const routeMatches = (pathname, matcher) => {
    if (typeof matcher === 'function') return Boolean(matcher(pathname));
    if (matcher instanceof RegExp) return matcher.test(pathname);

    const value = String(matcher || '').trim();
    if (!value) return false;
    if (value.endsWith('*')) return pathname.startsWith(value.slice(0, -1));
    return pathname === value;
  };

  const findRouteVersion = () => {
    const pathname = window.location.pathname || '/';
    const routes = Array.isArray(config.routes)
      ? config.routes
      : Object.entries(config.routes || {}).map(([match, version]) => ({ match, version }));
    const matchedRoute = routes.find((route) =>
      routeMatches(pathname, route.match || route.path || route.pathname),
    );
    const version = normalizeVersion(matchedRoute?.version);

    return version
      ? {
          version,
          source: 'route-registry',
          evidence: matchedRoute.match || matchedRoute.path || matchedRoute.pathname,
          confidence: 'high',
        }
      : null;
  };

  const VERSION_MARKERS = [
    {
      version: 'v3',
      selectors: [
        'html[data-pattern-version="v3"]',
        'body[data-pattern-version="v3"]',
        '.page_main[data-pattern-version="v3"]',
        '.page_main_v3[data-pattern-version="v3"]',
        '.page_main_v3',
        '.page_main.cc-v3',
      ],
    },
    {
      version: 'v2l',
      selectors: [
        'html[data-pattern-version="v2l"]',
        'body[data-pattern-version="v2l"]',
        '.page_main[data-pattern-version="v2l"]',
        '.page_main.cc-v2l',
      ],
    },
    {
      version: 'v2',
      selectors: [
        'html[data-pattern-version="v2"]',
        'body[data-pattern-version="v2"]',
        '.page_main[data-pattern-version="v2"]',
        '.page_main.cc-v2',
      ],
    },
    {
      version: 'v1',
      selectors: [
        'html[data-pattern-version="v1"]',
        'body[data-pattern-version="v1"]',
        '.page_main[data-pattern-version="v1"]',
        '.page_main.cc-v1',
      ],
    },
  ];

  const detectVersion = (scope = document) => {
    if (config.profile === 'library-v3') {
      return {
        version: 'v3',
        family: 'v3',
        source: 'library-v3-profile',
        evidence: 'library-v3',
        confidence: 'high',
        conflicts: [],
        safe: true,
      };
    }

    const configuredVersion = normalizeVersion(config.version);
    const explicitMatches = VERSION_MARKERS.flatMap((marker) =>
      marker.selectors
        .filter((selector) => scope.querySelector?.(selector))
        .map((selector) => ({
          version: marker.version,
          selector,
        })),
    );
    const matchedVersions = [...new Set(explicitMatches.map((match) => match.version))];

    if (matchedVersions.length) {
      const version = matchedVersions[0];
      const conflicts = [
        ...matchedVersions.slice(1),
        ...(configuredVersion && configuredVersion !== version ? [configuredVersion] : []),
      ];

      return {
        version,
        family: getFamily(version),
        source: configuredVersion ? 'page-marker+configuration' : 'page-marker',
        evidence: explicitMatches
          .filter((match) => match.version === version)
          .map((match) => match.selector),
        confidence: conflicts.length ? 'low' : 'high',
        conflicts: [...new Set(conflicts)],
        safe: conflicts.length === 0,
      };
    }

    if (configuredVersion) {
      return {
        version: configuredVersion,
        family: getFamily(configuredVersion),
        source: 'configuration',
        evidence: configuredVersion,
        confidence: 'high',
        conflicts: [],
        safe: true,
      };
    }

    const routeVersion = findRouteVersion();
    if (routeVersion) {
      return {
        ...routeVersion,
        family: getFamily(routeVersion.version),
        conflicts: [],
        safe: true,
      };
    }

    if (scope.querySelector?.('.page_main')) {
      return {
        version: 'v2',
        family: 'v2',
        source: 'unmarked-page-main-fallback',
        evidence: '.page_main',
        confidence: 'medium',
        conflicts: [],
        safe: false,
      };
    }

    return {
      version: 'unknown',
      family: 'unknown',
      source: 'unresolved',
      evidence: null,
      confidence: 'none',
      conflicts: [],
      safe: false,
    };
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

  const hasMatch = (scope, definition) => {
    if (!scope || !definition) return false;
    if (typeof definition.match === 'function') return Boolean(definition.match(scope));
    if (!definition.selector) return false;
    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches?.(definition.selector)) {
      return true;
    }
    return Boolean(scope.querySelector?.(definition.selector));
  };

  const collectMatches = (scope, selector) => {
    const matches = [];
    if (scope?.nodeType === Node.ELEMENT_NODE && scope.matches?.(selector)) {
      matches.push(scope);
    }
    scope?.querySelectorAll?.(selector).forEach((element) => matches.push(element));
    return matches;
  };

  const collectVideoPlayerRoots = (scope) => {
    const roots = collectMatches(scope, V3_VIDEO_PLAYER_ROOT_SELECTOR);
    const closest =
      scope?.nodeType === Node.ELEMENT_NODE
        ? scope.closest?.(V3_VIDEO_PLAYER_ROOT_SELECTOR)
        : null;
    if (closest && !roots.includes(closest)) roots.unshift(closest);
    return roots;
  };

  const appliesToVersion = (definition, version) => {
    const versions = definition.versions || ALL_VERSIONS;
    return versions === '*' || versions.includes(version);
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

  const normalizeLegacyHeadings = () => {
    const headings = [...document.querySelectorAll('h1')];
    if (headings.length < 2) return;

    headings.slice(1).forEach((heading) => {
      const replacement = document.createElement('h2');
      [...heading.attributes].forEach((attribute) =>
        replacement.setAttribute(attribute.name, attribute.value),
      );
      replacement.innerHTML = heading.innerHTML;
      heading.replaceWith(replacement);
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

  const initializeRegisteredPageFunction = (id) => {
    const registry = window.pageFunctions;
    const registeredFunction = registry?.functions?.[id];

    if (typeof registeredFunction !== 'function' || registry.executed?.[id]) return;

    registeredFunction();

    if (registry.executed && typeof registry.executed === 'object') {
      registry.executed[id] = true;
    }
  };

  const installPageFunctionsBridge = () => {
    if (config.profile !== 'consumer' || !config.pageFunctions.length) return;

    const registry = window.pageFunctions;
    if (
      !registry ||
      typeof registry.executeFunctions !== 'function' ||
      registry.__patternRuntimeOriginalExecuteFunctions
    ) {
      return;
    }

    const originalExecuteFunctions = registry.executeFunctions;
    registry.__patternRuntimeOriginalExecuteFunctions = originalExecuteFunctions;
    registry.executeFunctions = function executeNonRuntimeFunctions() {
      const parkedFunctions = new Map();

      config.pageFunctions.forEach((id) => {
        if (typeof this.functions?.[id] !== 'function') return;
        parkedFunctions.set(id, this.functions[id]);
        delete this.functions[id];
      });

      try {
        return originalExecuteFunctions.call(this);
      } finally {
        parkedFunctions.forEach((fn, id) => {
          this.functions[id] = fn;
        });
      }
    };
  };

  installPageFunctionsBridge();

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

      if (existing?.dataset.patternRuntimeLoaded === 'true') {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement('script');
      const finish = () => {
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

      for (const dependency of definition.dependencies || []) {
        await loadDependency(dependency);
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
    if (!definition.selector && typeof definition.match !== 'function') {
      throw new Error(`Module "${definition.id}" needs a selector or match function.`);
    }

    return {
      versions: ALL_VERSIONS,
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

  const getActivationDecision = () => {
    detection = detectVersion(document);

    if (config.mode !== 'active') {
      return {
        allowed: false,
        reason: 'observe-mode',
      };
    }

    if (!detection.safe) {
      return {
        allowed: false,
        reason: detection.conflicts.length
          ? 'conflicting-version-markers'
          : 'unresolved-version',
      };
    }

    if (LEGACY_VERSIONS.includes(detection.version) && config.legacyPolicy !== 'gateway') {
      return {
        allowed: false,
        reason: 'legacy-preserved',
      };
    }

    return {
      allowed: true,
      reason: 'active',
    };
  };

  const getPlan = (scope = document) => {
    detection = detectVersion(document);

    return [...modules.values()]
      .filter(
        (definition) =>
          appliesToVersion(definition, detection.version) && hasMatch(scope, definition),
      )
      .map((definition) => ({
        id: definition.id,
        dependencies: [...definition.dependencies],
        scripts: definition.script
          ? [resolveUrl(definition.script.src || definition.script)]
          : [],
        styles: definition.styles.map((style) => resolveUrl(style.src || style)),
      }));
  };

  const scan = async (scope = document) => {
    const plan = getPlan(scope);
    const decision = getActivationDecision();

    if (!decision.allowed) {
      plan.forEach(({ id }) => {
        const state = moduleStates.get(id);
        if (!state || state.status === 'ready' || state.status === 'error') return;
        state.status = decision.reason === 'observe-mode' ? 'planned' : 'preserved';
      });

      emit('scan-complete', {
        scope,
        detection,
        decision,
        matched: plan.map((item) => item.id),
      });
      return plan;
    }

    const results = [];

    for (const item of plan) {
      const definition = modules.get(item.id);
      try {
        await initializeModule(definition, scope);
        results.push({ id: item.id, status: 'fulfilled' });
      } catch (error) {
        results.push({ id: item.id, status: 'rejected', error });
      }
    }

    emit('scan-complete', {
      scope,
      detection,
      decision,
      matched: plan.map((item) => item.id),
      results,
    });
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

  const startObserver = () => {
    if (!config.observeMutations || observer || !document.body) return;

    observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach(queueScan);
        record.removedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE || node.isConnected) return;
          modules.forEach((definition) => {
            if (hasMatch(node, definition)) cleanupModule(definition, node);
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

  const inspect = () => {
    const currentDetection = detectVersion(document);
    const decision = getActivationDecision();

    return {
      version: VERSION,
      profile: config.profile,
      mode: config.mode,
      legacyPolicy: config.legacyPolicy,
      manifestVersion: config.manifestVersion || null,
      baseUrl,
      detection: currentDetection,
      activation: decision,
      observing: Boolean(observer),
      plan: getPlan(document),
      modules: [...modules.values()].map((definition) => {
        const state = moduleStates.get(definition.id);
        return {
          id: definition.id,
          versions:
            definition.versions === '*' ? [...ALL_VERSIONS] : [...definition.versions],
          selector: definition.selector || null,
          status: state?.status || 'idle',
          matched:
            appliesToVersion(definition, currentDetection.version) &&
            hasMatch(document, definition),
          dependencies: [...definition.dependencies],
          error: state?.error?.message || null,
        };
      }),
      dependencies: [...dependencies.keys()].map((id) => ({
        id,
        status: dependencyPromises.has(id) ? 'requested' : 'idle',
      })),
    };
  };

  const activate = (options = {}) => {
    if (options.profile && PROFILES.includes(options.profile)) {
      config.profile = options.profile;
    }
    if (options.legacyPolicy) config.legacyPolicy = options.legacyPolicy;
    if (options.version) config.version = options.version;
    config.mode = 'active';
    return scan(document);
  };

  const observeOnly = () => {
    config.mode = 'observe';
    return inspect();
  };

  const api = {
    version: VERSION,
    managed: true,
    config,
    register,
    registerDependency,
    loadDependency,
    loadScript,
    loadStyle,
    detectVersion,
    plan: getPlan,
    scan,
    activate,
    observe: observeOnly,
    destroy,
    inspect,
  };

  window[GLOBAL_NAME] = api;

  registerDependency({
    id: 'gsap',
    global: 'gsap',
    scripts: [
      {
        src: 'https://cdn.prod.website-files.com/gsap/3.15.0/gsap.min.js',
        crossOrigin: 'anonymous',
      },
    ],
  });

  registerDependency({
    id: 'scroll-trigger',
    global: 'ScrollTrigger',
    dependencies: ['gsap'],
    scripts: [
      {
        src: 'https://cdn.prod.website-files.com/gsap/3.15.0/ScrollTrigger.min.js',
        crossOrigin: 'anonymous',
      },
    ],
  });

  registerDependency({
    id: 'split-text',
    global: 'SplitText',
    dependencies: ['gsap'],
    scripts: [
      {
        src: 'https://cdn.prod.website-files.com/gsap/3.15.0/SplitText.min.js',
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
    id: 'splide',
    global: 'Splide',
    styles: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/css/splide.min.css',
        crossOrigin: 'anonymous',
      },
    ],
    scripts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js',
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
      versions: ALL_VERSIONS,
      selector: DYNAMIC_YEAR_SELECTOR,
      api: {
        init: updateDynamicYears,
      },
    });

    register({
      id: 'finsweet-list',
      versions: ALL_VERSIONS,
      selector: FINSWEET_LIST_SELECTOR,
      dependencies: ['finsweet-attributes-v2'],
      api: createFinsweetV2Feature('list', FINSWEET_LIST_SELECTOR),
    });

    register({
      id: 'finsweet-scroll-disable',
      versions: ALL_VERSIONS,
      selector: FINSWEET_SCROLL_DISABLE_SELECTOR,
      dependencies: ['finsweet-attributes-v2'],
      api: createFinsweetV2Feature('scrolldisable', FINSWEET_SCROLL_DISABLE_SELECTOR),
    });

    register({
      id: 'finsweet-social-share',
      versions: ALL_VERSIONS,
      selector: FINSWEET_SOCIAL_SHARE_SELECTOR,
      dependencies: ['finsweet-social-share-v1'],
      api: createFinsweetSocialShareFeature(),
    });

    register({
      id: 'legacy-heading-normalizer',
      versions: LEGACY_VERSIONS,
      match: () => document.querySelectorAll('h1').length > 1,
      api: {
        init: normalizeLegacyHeadings,
      },
    });

    register({
      id: 'legacy-nav',
      versions: LEGACY_VERSIONS,
      selector: '.nav_wrap',
      script: {
        src: `${LEGACY_BASE}/scripts/nav/nav.js`,
      },
      styles: [
        {
          src: `${LEGACY_BASE}/styles/nav.css`,
        },
      ],
      api: {
        init: () => initializeRegisteredPageFunction('nav'),
      },
    });

    register({
      id: 'legacy-video-popup',
      // Pattern US Home V3 still contains the pre-V3 fc-video-popup markup.
      // Keep that authored component working until it is rebuilt with the V3
      // data-video-player contract. The selectors are disjoint, so this does
      // not compete with v3-video-popup.
      versions: ALL_VERSIONS,
      selector: '[fc-video-popup^="component"], [fc-video-popup^="open"]',
      script: {
        src: `${LEGACY_BASE}/scripts/media/video-popup.js`,
      },
    });

    register({
      id: 'brand-logos',
      versions: ALL_VERSIONS,
      selector: '[brand-logo]',
      script: {
        src: `${LEGACY_BASE}/scripts/content/logos.js`,
      },
    });

    register({
      id: 'faq-schema',
      versions: LEGACY_VERSIONS,
      selector:
        '[data-faq-schema] [data-faq-item], .faq_card, .pattern-library-v2--accordion_component',
      script: {
        src: `${LEGACY_BASE}/scripts/schema/faq-schema-generator.js`,
      },
    });

    register({
      id: 'legacy-lazy-load',
      versions: LEGACY_VERSIONS,
      selector: 'img',
      script: {
        src: `${LEGACY_BASE}/scripts/interaction/lazy-load.js`,
      },
    });

    register({
      id: 'cta-inject',
      versions: ALL_VERSIONS,
      match: () =>
        Boolean(
          document.querySelector('[fs-inject-element="target"]') &&
            document.querySelector('[fs-inject-element="element"]'),
        ),
      script: {
        src: `${LEGACY_BASE}/scripts/content/cta-inject.js`,
      },
    });

    register({
      id: 'table-of-contents',
      versions: ALL_VERSIONS,
      match: () =>
        Boolean(
          document.querySelector('#toc') &&
            document.querySelector('#single-article, .pattern-library-v3--u-rich-text'),
        ),
      script: {
        src: '../content/toc.js',
      },
    });

    register({
      id: 'iframe-popup',
      versions: ALL_VERSIONS,
      selector: '[fc-iframe-popup^="component"], [fc-iframe-popup^="open"]',
      script: {
        src: `${LEGACY_IFRAME_BASE}/scripts/media/iframe-popup.js`,
      },
    });

    register({
      id: 'pagination',
      versions: ALL_VERSIONS,
      selector: '.w-pagination-next, .w-pagination-previous',
      script: {
        src: `${LEGACY_BASE}/scripts/interaction/pagination-fix.js`,
      },
      styles: [
        {
          src: `${LEGACY_BASE}/styles/pagination-fix.css`,
        },
      ],
    });

    register({
      id: 'card-load-animations',
      versions: ALL_VERSIONS,
      selector: '[card-grid] [card-load]',
      script: {
        src: `${CARD_LOAD_BASE}/scripts/interaction/card-load-animations-v10.js`,
      },
      dependencies: ['scroll-trigger'],
    });

    register({
      id: 'splide',
      versions: LEGACY_VERSIONS,
      selector: '.splide',
      dependencies: ['splide'],
      api: {
        init: () => initializeRegisteredPageFunction('splideSlider'),
      },
    });

    register({
      id: 'marquee',
      versions: ['v3'],
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
      versions: ['v3'],
      selector: [
        '[data-home-anchor-nav]',
        '[class~="home_anchor_nav"]',
        '[class*="--home_anchor_nav "]',
        '[class$="--home_anchor_nav"]',
      ].join(','),
      global: 'PatternHomeAnchorNav',
      script: {
        src: '../nav/home-anchor-nav.js',
        integrity: 'sha384-+bulB/ErAq91xjHfWMdjJwNh1rDrDuc6IKjQs2va5JvNFZ38ANZsfqPrJI1F/mqo',
      },
      styles: [
        {
          src: '../../styles/home-anchor-nav.css',
          integrity: 'sha384-RUaz1Jn+63M7ZXAaXGmUepoAHeH/9j0oVibGueTB9V2TQ780anM9ubza4osuCod0',
        },
      ],
    });

    register({
      id: 'v3-heading-text-reveal',
      versions: ['v3'],
      selector: V3_HEADING_REVEAL_SELECTOR,
      global: 'PatternV3HeadingReveal',
      script: {
        src: '../interaction/v3-heading-text-reveal.js',
        integrity: 'sha384-5JU5U+5AYlH5Xw/xo393S6W+Rhy+R22voDkoriNhX7MAVVu5CEtdPkBufm5jSrDR',
      },
      dependencies: ['scroll-trigger', 'split-text'],
    });

    register({
      id: 'case-study',
      versions: ['v3'],
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
      // The module requests Swiper and GSAP when its V3 root approaches the
      // viewport, keeping both dependencies out of the initial page scan.
      initScope: 'document',
    });

    register({
      id: 'slider-alt-slots',
      versions: ['v3'],
      selector: '[class*="slider_wrap"] [class*="box_slider_wrap"]',
      global: 'PatternBoxSliderSlots',
      script: {
        src: '../content/box-slider-slot-controls.js',
        integrity: 'sha384-2eEsJQFEJOPf1J+jGzHxOhPgoywZIigDtDeW6okcAMvgwWpVOfABi75ujUMM+16m',
      },
      initScope: 'document',
    });

    register({
      id: 'accordion',
      versions: ALL_VERSIONS,
      selector: [
        '[data-accordion]',
        '[class~="accordion_wrap"]',
        '[class*="--accordion_wrap "]',
        '[class$="--accordion_wrap"]',
      ].join(','),
      global: 'PatternAccordion',
      script: {
        src: '../interaction/accordion.js',
        integrity: 'sha384-EFg0P5l1NeVQxGzun6SnQdALBCSs680cLLhYUFbMXZJqRr7T+8tGuiemc7KwQOBG',
      },
      dependencies: ['gsap'],
    });

    register({
      id: 'v3-video-popup',
      versions: ['v3'],
      match: (scope) =>
        collectVideoPlayerRoots(scope).some((root) => {
          const dialog = root.querySelector('dialog[data-video-player-dialog]');
          return Boolean(
            root.querySelector('[data-video-player-open]') &&
              dialog?.querySelector('iframe[data-video-src]') &&
              dialog.querySelector('[data-video-player-close]'),
          );
        }),
      global: 'PatternVideoPopup',
      script: {
        src: '../media/video-popup.js',
        integrity: 'sha384-V4sdBPl9LCUpScdMBwHAdo/2SU0XWve1/EKhf4MmMSnUVbwDtCAiGgKcHi+1VuS0',
      },
    });

    register({
      id: 'v3-video-preview',
      versions: ['v3'],
      match: (scope) =>
        collectVideoPlayerRoots(scope).some((root) =>
          root.querySelector('video[data-src]'),
        ),
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
    installPageFunctionsBridge();
    detection = detectVersion(document);
    void scan(document);
    startObserver();
    emit('ready', { detection });
    debug('Ready.', inspect());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
