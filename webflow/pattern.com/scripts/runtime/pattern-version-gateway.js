/**
 * Pattern Version Gateway
 *
 * Detects the authored page version, identifies Pattern components, and loads
 * only the assets required by that version/component combination.
 *
 * Safety defaults:
 * - observe mode: report the load plan without changing the page
 * - legacy preservation: V1, V2, and V2L keep their existing delivery path
 * - ambiguous/unknown pages: never activate automatically
 */
(() => {
  'use strict';

  const GLOBAL_NAME = 'PatternVersionGateway';
  const VERSION = '0.2.5';
  const EVENT_PREFIX = 'pattern:pvg';
  const ALL_VERSIONS = ['v1', 'v2', 'v2l', 'v3'];
  const LEGACY_VERSIONS = ['v1', 'v2', 'v2l'];
  const V3_HEADING_REVEAL_SELECTOR = [
    '[data-heading-reveal="true"][data-wf--typography-heading--font-style="h1"]',
    '[data-heading-reveal="true"][data-wf--pattern-library-v3--typography-heading--font-style="h1"]',
    '#page-hero [data-heading-reveal][data-wf--typography-heading--font-style]',
    '#page-hero [data-heading-reveal][data-wf--pattern-library-v3--typography-heading--font-style]',
    '#page-hero [data-animate-heading][data-wf--typography-heading--font-style]',
    '#page-hero [data-animate-heading][data-wf--pattern-library-v3--typography-heading--font-style]',
  ].join(',');
  const V3_VIDEO_PLAYER_ROOT_SELECTOR = [
    '[class~="video_player_wrap"]',
    '[class*="--video_player_wrap "]',
    '[class$="--video_player_wrap"]',
  ].join(',');
  const currentScript = document.currentScript;
  const existingGateway = window[GLOBAL_NAME];

  if (existingGateway?.version) {
    existingGateway.scan(document);
    return;
  }

  const scriptConfig = {
    mode: currentScript?.dataset.pvgMode,
    version: currentScript?.dataset.pvgVersion,
    legacyPolicy: currentScript?.dataset.pvgLegacyPolicy,
    debug: currentScript?.hasAttribute('data-pvg-debug') || undefined,
  };

  const config = {
    mode: 'observe',
    legacyPolicy: 'preserve',
    observeMutations: true,
    version: '',
    routes: [],
    baseUrl: currentScript?.src ? new URL('.', currentScript.src).href : '',
    debug: new URLSearchParams(window.location.search).has('pattern-pvg-debug'),
    ...window.PatternVersionGatewayConfig,
    ...Object.fromEntries(
      Object.entries(scriptConfig).filter(([, value]) => value !== undefined && value !== ''),
    ),
  };

  const LEGACY_BASE =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com';
  const LEGACY_IFRAME_BASE =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.2/webflow/pattern.com';
  const CARD_LOAD_BASE =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@aa2e661b1aad8fa6d3fcc1d7c0a0aa3347cff1b6/webflow/pattern.com';
  const states = new Map();
  const dependencyPromises = new Map();
  const scriptPromises = new Map();
  const stylePromises = new Map();
  const queuedScopes = new Set();
  let observer = null;
  let scanFrame = 0;
  let booted = false;
  let detection = null;

  const debug = (...args) => {
    if (config.debug) console.info('[Pattern PVG]', ...args);
  };

  const warn = (...args) => {
    console.warn('[Pattern PVG]', ...args);
  };

  const emit = (name, detail = {}) => {
    document.dispatchEvent(
      new CustomEvent(`${EVENT_PREFIX}:${name}`, {
        detail: {
          gateway: api,
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
        evidence: explicitMatches.filter((match) => match.version === version).map((match) => match.selector),
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
      return new URL(value, config.baseUrl || window.location.href).href;
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
    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches?.(definition.selector)) return true;
    return Boolean(scope.querySelector?.(definition.selector));
  };

  const appliesToVersion = (definition, version) => {
    const versions = definition.versions || ALL_VERSIONS;
    return versions === '*' || versions.includes(version);
  };

  const setAssetAttributes = (element, asset = {}, id = '') => {
    element.dataset.patternPvgAsset = id;

    if (asset.integrity) {
      element.integrity = asset.integrity;
      element.crossOrigin = asset.crossOrigin || 'anonymous';
    } else if (asset.crossOrigin) {
      element.crossOrigin = asset.crossOrigin;
    }

    if (asset.referrerPolicy) element.referrerPolicy = asset.referrerPolicy;
  };

  const loadScript = (source, options = {}) => {
    const asset = typeof source === 'string' ? { src: source } : source;
    const url = resolveUrl(asset.src);

    if (!url) return Promise.reject(new Error(`Invalid script URL: ${asset.src}`));
    if (scriptPromises.has(url)) return scriptPromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src === url);

      if (
        existing?.dataset.patternAssetLoaded === 'true' ||
        existing?.dataset.patternRuntimeLoaded === 'true'
      ) {
        resolve(existing);
        return;
      }

      const script = existing || document.createElement('script');
      script.addEventListener(
        'load',
        () => {
          script.dataset.patternAssetLoaded = 'true';
          script.dataset.patternPvgLoaded = 'true';
          resolve(script);
        },
        { once: true },
      );
      script.addEventListener(
        'error',
        () => reject(new Error(`Failed to load script: ${url}`)),
        { once: true },
      );

      if (existing) return;

      script.src = url;
      script.async = asset.async ?? false;
      setAssetAttributes(script, asset, options.id);
      document.head.appendChild(script);
    });

    scriptPromises.set(url, promise);
    return promise;
  };

  const loadStyle = (source, options = {}) => {
    const asset = typeof source === 'string' ? { src: source } : source;
    const url = resolveUrl(asset.src);

    if (!url) return Promise.reject(new Error(`Invalid stylesheet URL: ${asset.src}`));
    if (stylePromises.has(url)) return stylePromises.get(url);

    const promise = new Promise((resolve, reject) => {
      const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(
        (link) =>
          link.href === url ||
          (asset.integrity && link.integrity === asset.integrity),
      );

      if (
        existing?.dataset.patternAssetLoaded === 'true' ||
        existing?.dataset.patternRuntimeLoaded === 'true' ||
        existing?.sheet
      ) {
        existing.dataset.patternAssetLoaded = 'true';
        existing.dataset.patternPvgLoaded = 'true';
        resolve(existing);
        return;
      }

      const link = existing || document.createElement('link');
      const finish = () => {
        link.dataset.patternAssetLoaded = 'true';
        link.dataset.patternPvgLoaded = 'true';
        resolve(link);
      };
      const fail = () => reject(new Error(`Failed to load stylesheet: ${url}`));

      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', fail, { once: true });

      if (existing) return;

      link.rel = 'stylesheet';
      link.href = url;
      setAssetAttributes(link, asset, options.id);
      document.head.appendChild(link);
    });

    stylePromises.set(url, promise);
    return promise;
  };

  const dependencies = new Map([
    [
      'gsap',
      {
        global: 'gsap',
        scripts: [
          {
            src: 'https://cdn.prod.website-files.com/gsap/3.15.0/gsap.min.js',
            crossOrigin: 'anonymous',
          },
        ],
      },
    ],
    [
      'split-text',
      {
        global: 'SplitText',
        dependencies: ['gsap'],
        scripts: [
          {
            src: 'https://cdn.prod.website-files.com/gsap/3.15.0/SplitText.min.js',
            crossOrigin: 'anonymous',
          },
        ],
      },
    ],
    [
      'scroll-trigger',
      {
        global: 'ScrollTrigger',
        dependencies: ['gsap'],
        scripts: [
          {
            src: 'https://cdn.prod.website-files.com/gsap/3.15.0/ScrollTrigger.min.js',
            crossOrigin: 'anonymous',
          },
        ],
      },
    ],
    [
      'swiper',
      {
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
      },
    ],
    [
      'splide',
      {
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
      },
    ],
  ]);

  const loadDependency = (id) => {
    if (dependencyPromises.has(id)) return dependencyPromises.get(id);

    const definition = dependencies.get(id);
    if (!definition) return Promise.reject(new Error(`Unknown dependency: ${id}`));

    const promise = (async () => {
      if (definition.global && getGlobal(definition.global)) return getGlobal(definition.global);

      for (const dependency of definition.dependencies || []) {
        await loadDependency(dependency);
      }

      await Promise.all(
        (definition.styles || []).map((style) =>
          loadStyle(style, {
            id: `dependency:${id}:style`,
          }),
        ),
      );

      for (const script of definition.scripts || []) {
        await loadScript(script, {
          id: `dependency:${id}:script`,
        });
      }

      const value = definition.global ? getGlobal(definition.global) : true;
      if (!value) throw new Error(`Dependency "${id}" loaded without ${definition.global}.`);
      return value;
    })().catch((error) => {
      dependencyPromises.delete(id);
      emit('dependency-error', { dependency: id, error });
      throw error;
    });

    dependencyPromises.set(id, promise);
    return promise;
  };

  const updateDynamicYears = (scope = document) => {
    const year = String(new Date().getFullYear());
    const elements = [];

    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches?.('[data-dynamic-year]')) {
      elements.push(scope);
    }

    scope.querySelectorAll?.('[data-dynamic-year]').forEach((element) => elements.push(element));
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

  const initializeRegisteredPageFunction = (id) => {
    const registry = window.pageFunctions;
    const registeredFunction = registry?.functions?.[id];

    if (typeof registeredFunction !== 'function' || registry.executed?.[id]) return;

    registeredFunction();

    if (registry.executed && typeof registry.executed === 'object') {
      registry.executed[id] = true;
    }
  };

  const modules = [
    {
      id: 'dynamic-year',
      versions: ALL_VERSIONS,
      selector: '[data-dynamic-year]',
      init: updateDynamicYears,
    },
    {
      id: 'legacy-heading-normalizer',
      versions: LEGACY_VERSIONS,
      match: () => document.querySelectorAll('h1').length > 1,
      init: normalizeLegacyHeadings,
    },
    {
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
      init: () => initializeRegisteredPageFunction('nav'),
    },
    {
      id: 'legacy-video-popup',
      versions: LEGACY_VERSIONS,
      selector: '[fc-video-popup^="component"], [fc-video-popup^="open"]',
      script: {
        src: `${LEGACY_BASE}/scripts/media/video-popup.js`,
      },
    },
    {
      id: 'brand-logos',
      versions: ALL_VERSIONS,
      selector: '[brand-logo]',
      script: {
        src: `${LEGACY_BASE}/scripts/content/logos.js`,
      },
    },
    {
      id: 'faq-schema',
      versions: LEGACY_VERSIONS,
      selector:
        '[data-faq-schema] [data-faq-item], .faq_card, .pattern-library-v2--accordion_component',
      script: {
        src: `${LEGACY_BASE}/scripts/schema/faq-schema-generator.js`,
      },
    },
    {
      id: 'legacy-lazy-load',
      versions: LEGACY_VERSIONS,
      selector: 'img',
      script: {
        src: `${LEGACY_BASE}/scripts/interaction/lazy-load.js`,
      },
    },
    {
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
    },
    {
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
    },
    {
      id: 'iframe-popup',
      versions: ALL_VERSIONS,
      selector: '[fc-iframe-popup^="component"], [fc-iframe-popup^="open"]',
      script: {
        src: `${LEGACY_IFRAME_BASE}/scripts/media/iframe-popup.js`,
      },
    },
    {
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
    },
    {
      id: 'card-load-animations',
      versions: ALL_VERSIONS,
      selector: '[card-grid] [card-load]',
      script: {
        src: `${CARD_LOAD_BASE}/scripts/interaction/card-load-animations-v10.js`,
      },
      dependencies: ['scroll-trigger'],
    },
    {
      id: 'splide',
      versions: LEGACY_VERSIONS,
      selector: '.splide',
      dependencies: ['splide'],
      init: () => initializeRegisteredPageFunction('splideSlider'),
    },
    {
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
    },
    {
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
          integrity: 'sha384-ARO/NRKecnIc+LAa8Lf4ZbOVm/UsvIWOcU3OJyQXoQAze6jQDhrSXQ9cTpkAlupf',
        },
      ],
    },
    {
      id: 'v3-heading-text-reveal',
      versions: ['v3'],
      selector: V3_HEADING_REVEAL_SELECTOR,
      global: 'PatternV3HeadingReveal',
      script: {
        src: '../interaction/v3-heading-text-reveal.js',
        integrity: 'sha384-5JU5U+5AYlH5Xw/xo393S6W+Rhy+R22voDkoriNhX7MAVVu5CEtdPkBufm5jSrDR',
      },
      dependencies: ['scroll-trigger', 'split-text'],
    },
    {
      id: 'case-study',
      versions: ['v3'],
      selector: '[data-case-study-slider], [class*="case-study_slider_wrap"]',
      global: 'PatternCaseStudyCMS',
      script: {
        src: '../content/case-study-cms-slider.js',
        integrity: 'sha384-Nf6NYJqQnnQBY2YEp1iIzrYLTLAMr9gUxGnhscFz5EDQbm/8jz0tE0yoTaaoTBph',
      },
      initScope: 'document',
    },
    {
      id: 'accordion',
      versions: ALL_VERSIONS,
      selector: '[data-accordion], [class*="accordion_wrap"]',
      global: 'PatternAccordion',
      script: {
        src: '../interaction/accordion.js',
        integrity: 'sha384-EFg0P5l1NeVQxGzun6SnQdALBCSs680cLLhYUFbMXZJqRr7T+8tGuiemc7KwQOBG',
      },
      dependencies: ['gsap'],
    },
    {
      id: 'v3-video-popup',
      versions: ['v3'],
      match: (scope) => {
        const roots = [];
        const closest =
          scope.nodeType === Node.ELEMENT_NODE
            ? scope.closest?.(V3_VIDEO_PLAYER_ROOT_SELECTOR)
            : null;
        if (closest) roots.push(closest);
        if (
          scope.nodeType === Node.ELEMENT_NODE &&
          scope.matches?.(V3_VIDEO_PLAYER_ROOT_SELECTOR) &&
          !roots.includes(scope)
        ) {
          roots.push(scope);
        }
        scope.querySelectorAll?.(V3_VIDEO_PLAYER_ROOT_SELECTOR).forEach((root) => {
          roots.push(root);
        });

        return roots.some((root) => {
          const dialog = root.querySelector('dialog[data-video-player-dialog]');
          return Boolean(
            root.querySelector('[data-video-player-open]') &&
              dialog?.querySelector('iframe[data-video-src]') &&
              dialog.querySelector('[data-video-player-close]'),
          );
        });
      },
      global: 'PatternVideoPopup',
      script: {
        src: '../media/video-popup.js',
        integrity: 'sha384-V4sdBPl9LCUpScdMBwHAdo/2SU0XWve1/EKhf4MmMSnUVbwDtCAiGgKcHi+1VuS0',
      },
    },
    {
      id: 'v3-video-preview',
      versions: ['v3'],
      match: (scope) => {
        const roots = [];
        const closest =
          scope.nodeType === Node.ELEMENT_NODE
            ? scope.closest?.(V3_VIDEO_PLAYER_ROOT_SELECTOR)
            : null;
        if (closest) roots.push(closest);
        if (
          scope.nodeType === Node.ELEMENT_NODE &&
          scope.matches?.(V3_VIDEO_PLAYER_ROOT_SELECTOR) &&
          !roots.includes(scope)
        ) {
          roots.push(scope);
        }
        scope.querySelectorAll?.(V3_VIDEO_PLAYER_ROOT_SELECTOR).forEach((root) => {
          roots.push(root);
        });
        return roots.some((root) => root.querySelector('video[data-src]'));
      },
      global: 'PatternVideoPreview',
      script: {
        src: '../media/video-preview.js',
        integrity: 'sha384-chLfIt1Cm0PzKy6+62JMrZXl+UUFPV8YY5HkqEsGDWI2unAuosUbx7uP+SktbCwR',
      },
    },
  ];

  const getState = (id) => {
    if (!states.has(id)) {
      states.set(id, {
        status: 'idle',
        error: null,
        promise: null,
      });
    }

    return states.get(id);
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
        reason: detection.conflicts.length ? 'conflicting-version-markers' : 'unresolved-version',
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

  const ensureModule = (definition) => {
    const state = getState(definition.id);
    if (state.promise) return state.promise;

    state.status = 'loading';
    state.error = null;
    emit('module-loading', { module: definition.id });

    state.promise = (async () => {
      for (const dependency of definition.dependencies || []) {
        await loadDependency(dependency);
      }

      await Promise.all(
        (definition.styles || []).map((style) =>
          loadStyle(style, {
            id: `module:${definition.id}:style`,
          }),
        ),
      );

      if (definition.script && !(definition.global && getGlobal(definition.global))) {
        await loadScript(definition.script, {
          id: `module:${definition.id}:script`,
        });
      }

      const moduleApi = definition.global ? getGlobal(definition.global) : true;
      if (definition.global && !moduleApi) {
        throw new Error(`Module "${definition.id}" loaded without ${definition.global}.`);
      }

      state.status = 'ready';
      emit('module-ready', { module: definition.id });
      return moduleApi;
    })().catch((error) => {
      state.status = 'error';
      state.error = error;
      state.promise = null;
      emit('module-error', { module: definition.id, error });
      warn(`Module "${definition.id}" failed. Authored Webflow content remains available.`, error);
      throw error;
    });

    return state.promise;
  };

  const initializeModule = async (definition, scope) => {
    const moduleApi = await ensureModule(definition);
    const init = definition.init || moduleApi?.init;
    if (typeof init !== 'function') return;
    await init(definition.initScope === 'document' ? document : scope, api);
  };

  const getPlan = (scope = document) => {
    detection = detectVersion(document);

    return modules
      .filter(
        (definition) =>
          appliesToVersion(definition, detection.version) && hasMatch(scope, definition),
      )
      .map((definition) => ({
        id: definition.id,
        dependencies: [...(definition.dependencies || [])],
        scripts: definition.script ? [resolveUrl(definition.script.src)] : [],
        styles: (definition.styles || []).map((style) => resolveUrl(style.src)),
      }));
  };

  const scan = async (scope = document) => {
    const plan = getPlan(scope);
    const decision = getActivationDecision();

    if (!decision.allowed) {
      plan.forEach(({ id }) => {
        const state = getState(id);
        if (state.status === 'ready' || state.status === 'error') return;
        state.status = decision.reason === 'observe-mode' ? 'planned' : 'preserved';
      });

      emit('scan-complete', {
        detection,
        decision,
        matched: plan.map((item) => item.id),
      });
      return plan;
    }

    const results = [];

    for (const item of plan) {
      const definition = modules.find((candidate) => candidate.id === item.id);
      try {
        await initializeModule(definition, scope);
        results.push({ id: item.id, status: 'fulfilled' });
      } catch (error) {
        results.push({ id: item.id, status: 'rejected', error });
      }
    }

    emit('scan-complete', {
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
      records.forEach((record) => record.addedNodes.forEach(queueScan));
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const inspect = () => {
    const currentDetection = detectVersion(document);
    const decision = getActivationDecision();

    return {
      version: VERSION,
      mode: config.mode,
      legacyPolicy: config.legacyPolicy,
      detection: currentDetection,
      activation: decision,
      observing: Boolean(observer),
      plan: getPlan(document),
      modules: modules.map((definition) => {
        const state = getState(definition.id);
        return {
          id: definition.id,
          versions: [...definition.versions],
          matched:
            appliesToVersion(definition, currentDetection.version) &&
            hasMatch(document, definition),
          status: state.status,
          error: state.error?.message || null,
        };
      }),
      dependencies: [...dependencies.keys()].map((id) => ({
        id,
        status: dependencyPromises.has(id) ? 'requested' : 'idle',
      })),
    };
  };

  const activate = (options = {}) => {
    if (options.legacyPolicy) config.legacyPolicy = options.legacyPolicy;
    config.mode = 'active';
    return scan(document);
  };

  const observeOnly = () => {
    config.mode = 'observe';
    return inspect();
  };

  const destroy = () => {
    observer?.disconnect();
    observer = null;
    if (scanFrame) window.cancelAnimationFrame(scanFrame);
    scanFrame = 0;
    queuedScopes.clear();
  };

  const api = {
    version: VERSION,
    managed: true,
    config,
    detectVersion,
    loadDependency,
    plan: getPlan,
    scan,
    inspect,
    activate,
    observe: observeOnly,
    destroy,
  };

  window[GLOBAL_NAME] = api;

  const boot = () => {
    if (booted) return;
    booted = true;
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
