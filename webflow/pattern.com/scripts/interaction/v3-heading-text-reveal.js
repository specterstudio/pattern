(() => {
  'use strict';

  const GLOBAL_NAME = 'PatternV3HeadingReveal';
  const VERSION = '1.0.0';
  const ROOT_SELECTOR = '[data-heading-reveal], [data-animate-heading]';
  const CONTENT_SELECTOR = ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > p';
  const FALLBACK_CONTENT_SELECTOR = 'h1, h2, h3, h4, h5, h6, p';
  const READY_ATTRIBUTE = 'data-pattern-heading-reveal-initialized';
  const PAGE_LOAD_CONTAINER_SELECTOR = '#page-hero';
  const VARIANT_ATTRIBUTE_SUFFIX = 'typography-heading--font-style';
  const ENABLED_VALUES = new Set(['', '1', 'true', 'yes', 'on']);
  const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

  if (window[GLOBAL_NAME]?.version) {
    window[GLOBAL_NAME].init(document);
    return;
  }

  const instances = new WeakMap();
  const initTokens = new WeakMap();
  const roots = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fontsReady = document.fonts?.ready || Promise.resolve();

  const getMarkerValue = (root) => {
    if (root.hasAttribute('data-heading-reveal')) {
      return root.getAttribute('data-heading-reveal');
    }

    if (root.hasAttribute('data-animate-heading')) {
      return root.getAttribute('data-animate-heading');
    }

    return null;
  };

  const isEnabled = (root) => {
    const value = getMarkerValue(root);
    if (value === null) return false;

    const normalized = String(value).trim().toLowerCase();
    if (DISABLED_VALUES.has(normalized)) return false;
    return ENABLED_VALUES.has(normalized);
  };

  const getVariantAttribute = (root) =>
    [...root.attributes].find(
      (attribute) =>
        attribute.name.startsWith('data-wf--') &&
        attribute.name.endsWith(VARIANT_ATTRIBUTE_SUFFIX),
    );

  const isH1Variant = (root) =>
    getVariantAttribute(root)?.value.trim().toLowerCase() === 'h1';

  const isPageLoadRoot = (root) => Boolean(root.closest(PAGE_LOAD_CONTAINER_SELECTOR));

  const isEligibleRoot = (root) =>
    isEnabled(root) &&
    (isH1Variant(root) || (isPageLoadRoot(root) && Boolean(getVariantAttribute(root))));

  const collectRoots = (scope = document) => {
    const matches = [];

    if (scope.matches?.(ROOT_SELECTOR)) matches.push(scope);
    scope.querySelectorAll?.(ROOT_SELECTOR).forEach((root) => matches.push(root));

    return [...new Set(matches)].filter(isEligibleRoot);
  };

  const getContentTarget = (root) =>
    root.matches(FALLBACK_CONTENT_SELECTOR)
      ? root
      : root.querySelector(CONTENT_SELECTOR) || root.querySelector(FALLBACK_CONTENT_SELECTOR);

  const restoreReadyAttribute = (root, originalValue) => {
    if (originalValue === null) root.removeAttribute(READY_ATTRIBUTE);
    else root.setAttribute(READY_ATTRIBUTE, originalValue);
  };

  const destroyRoot = (root) => {
    const state = instances.get(root);
    if (!state) return;

    state.animation?.scrollTrigger?.kill();
    state.animation?.kill();
    state.split?.revert();
    restoreReadyAttribute(root, state.originalReady);

    instances.delete(root);
    roots.delete(root);
  };

  const initializeRoot = (root) => {
    if (instances.has(root) || !root.isConnected || !isEligibleRoot(root)) return;

    const target = getContentTarget(root);
    if (!target) return;
    const playsOnPageLoad = isPageLoadRoot(root);

    const state = {
      animation: null,
      originalReady: root.getAttribute(READY_ATTRIBUTE),
      root,
      split: null,
      target,
    };

    instances.set(root, state);
    roots.add(root);

    if (reducedMotion.matches) {
      root.setAttribute(READY_ATTRIBUTE, 'reduced-motion');
      return;
    }

    if (
      typeof window.gsap === 'undefined' ||
      typeof window.SplitText === 'undefined' ||
      (!playsOnPageLoad && typeof window.ScrollTrigger === 'undefined')
    ) {
      instances.delete(root);
      roots.delete(root);
      console.warn(
        '[Pattern Heading Reveal] GSAP, ScrollTrigger, and SplitText are required. Authored text remains visible.',
      );
      return;
    }

    if (playsOnPageLoad) window.gsap.registerPlugin(window.SplitText);
    else window.gsap.registerPlugin(window.ScrollTrigger, window.SplitText);

    try {
      state.split = window.SplitText.create(target, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'pattern-heading-reveal-line',
        autoSplit: true,
        aria: 'auto',
        onSplit(self) {
          state.animation?.scrollTrigger?.kill();
          state.animation?.kill();

          window.gsap.set(self.lines, {
            yPercent: 110,
            force3D: true,
          });

          const animationOptions = {
            yPercent: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'expo.out',
            force3D: true,
            overwrite: false,
          };

          if (!playsOnPageLoad) {
            animationOptions.scrollTrigger = {
              trigger: root,
              start: () => 'clamp(top 75%)',
              scrub: false,
              once: true,
              invalidateOnRefresh: true,
              markers: false,
              toggleActions: 'play none none none',
            };
          }

          state.animation = window.gsap.to(self.lines, animationOptions);

          return state.animation;
        },
      });

      root.setAttribute(READY_ATTRIBUTE, 'true');
    } catch (error) {
      destroyRoot(root);
      console.warn(
        '[Pattern Heading Reveal] Initialization failed. Authored text remains visible.',
        error,
      );
    }
  };

  const init = async (scope = document) => {
    const token = Symbol('heading-reveal-init');
    initTokens.set(scope, token);

    await fontsReady;
    if (initTokens.get(scope) !== token) return;

    collectRoots(scope).forEach(initializeRoot);
  };

  const destroy = (scope = document) => {
    initTokens.delete(scope);
    [...roots].forEach((root) => {
      if (scope === document || scope === root || scope.contains?.(root)) destroyRoot(root);
    });
  };

  const reinitialize = async (scope = document) => {
    destroy(scope);
    await init(scope);
  };

  const api = {
    version: VERSION,
    init,
    destroy,
    reinitialize,
  };

  window[GLOBAL_NAME] = api;
  void init(document);
})();
