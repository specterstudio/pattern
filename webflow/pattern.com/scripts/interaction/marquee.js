(() => {
  'use strict';

  const GLOBAL_NAME = 'PatternMarquee';
  const VERSION = '1.0.0';
  const ROOT_SELECTOR = '[data-marquee]';
  const VIEWPORT_SELECTOR = '[data-marquee-viewport]';
  const TRACK_SELECTOR = '[data-marquee-track]';
  const LIST_SELECTOR = '[data-marquee-list]';
  const CLONE_SELECTOR = '[data-marquee-clone]';
  const DEFAULT_SPEED = 45;
  const DEFAULT_GAP = 16;
  const MIN_SPEED = 1;
  const MAX_SPEED = 300;
  const MIN_GAP = 0;
  const MAX_GAP = 160;
  const MAX_CLONES = 100;

  if (window[GLOBAL_NAME]?.version) {
    window[GLOBAL_NAME].init(document);
    return;
  }

  const instances = new WeakMap();
  const roots = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pageObserver = null;

  const parseNumber = (value, fallback, min, max) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  };

  const getOriginalList = (track) =>
    [...track.children].find(
      (child) => child.matches?.(LIST_SELECTOR) && !child.matches(CLONE_SELECTOR),
    ) || null;

  const stripDuplicateIds = (clone) => {
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  };

  const makeCloneInert = (clone) => {
    clone.setAttribute('data-marquee-clone', '');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.inert = true;
    clone.style.pointerEvents = 'none';

    stripDuplicateIds(clone);

    clone
      .querySelectorAll(
        'a, button, input, select, textarea, summary, audio[controls], video[controls], [tabindex]',
      )
      .forEach((element) => element.setAttribute('tabindex', '-1'));

    clone.querySelectorAll('img').forEach((image) => {
      image.loading = 'eager';
      image.decoding = 'async';
    });
  };

  const setPlayState = (state) => {
    const shouldRun = state.ready && state.visible && !reducedMotion.matches;
    state.root.style.setProperty(
      '--pattern-marquee-play-state',
      shouldRun ? 'running' : 'paused',
    );
  };

  const removeClones = (state) => {
    state.track.querySelectorAll(`:scope > ${CLONE_SELECTOR}`).forEach((clone) => clone.remove());
  };

  const waitForImage = (image, signal) =>
    new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }

      const finish = () => {
        image.removeEventListener('load', finish);
        image.removeEventListener('error', finish);
        signal.removeEventListener('abort', finish);
        resolve();
      };

      if (image.complete) {
        const decode = image.decode?.();
        if (decode) {
          decode.catch(() => {}).finally(finish);
        } else {
          finish();
        }
        return;
      }

      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      signal.addEventListener('abort', finish, { once: true });
    });

  const build = async (state) => {
    state.buildId += 1;
    const buildId = state.buildId;
    state.imageAbort?.abort();
    state.imageAbort = new AbortController();

    state.frame = 0;
    state.root.removeAttribute('data-marquee-ready');
    state.ready = false;
    setPlayState(state);
    removeClones(state);

    const speed = parseNumber(
      state.root.getAttribute('data-marquee-speed'),
      DEFAULT_SPEED,
      MIN_SPEED,
      MAX_SPEED,
    );
    const gap = parseNumber(
      state.root.getAttribute('data-marquee-gap'),
      DEFAULT_GAP,
      MIN_GAP,
      MAX_GAP,
    );
    const moveRight = state.root.getAttribute('data-marquee-right') === 'true';

    state.root.setAttribute('data-marquee-speed', `${speed}`);
    state.root.setAttribute('data-marquee-gap', `${gap}`);
    state.root.setAttribute('data-marquee-right', `${moveRight}`);
    state.root.style.setProperty('--pattern-marquee-gap', `${gap}px`);

    if (!state.list.children.length) {
      state.root.style.removeProperty('--pattern-marquee-distance');
      state.root.style.removeProperty('--pattern-marquee-duration');
      return;
    }

    const listWidth = state.list.getBoundingClientRect().width;
    const viewportWidth = state.viewport.getBoundingClientRect().width;
    if (listWidth <= 0 || viewportWidth <= 0) return;

    const requiredWidth = viewportWidth + listWidth;
    const totalLists = Math.max(2, Math.ceil(requiredWidth / listWidth));
    const cloneCount = Math.min(totalLists - 1, MAX_CLONES);
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < cloneCount; index += 1) {
      const clone = state.list.cloneNode(true);
      makeCloneInert(clone);
      fragment.appendChild(clone);
    }

    state.track.appendChild(fragment);
    state.root.style.setProperty('--pattern-marquee-distance', `${listWidth}px`);
    state.root.style.setProperty(
      '--pattern-marquee-duration',
      `${Math.max(listWidth / speed, 0.1)}s`,
    );

    const cloneImages = state.track.querySelectorAll(
      `:scope > ${CLONE_SELECTOR} img`,
    );
    await Promise.all(
      [...cloneImages].map((image) => waitForImage(image, state.imageAbort.signal)),
    );

    if (buildId !== state.buildId || !state.root.isConnected) return;

    state.root.setAttribute('data-marquee-ready', '');
    state.ready = true;
    setPlayState(state);
  };

  const scheduleBuild = (state) => {
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(() => {
      void build(state);
    });
  };

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const state = instances.get(entry.target);
        if (!state) return;
        state.visible = entry.isIntersecting;
        setPlayState(state);
      });
    },
    { rootMargin: '200px 0px', threshold: 0 },
  );

  const initRoot = (root) => {
    if (instances.has(root) || root.closest(CLONE_SELECTOR)) return;

    const viewport = root.querySelector(VIEWPORT_SELECTOR);
    const track = viewport?.querySelector(TRACK_SELECTOR);
    const list = track ? getOriginalList(track) : null;
    if (!viewport || !track || !list) return;

    const state = {
      root,
      viewport,
      track,
      list,
      ready: false,
      visible: false,
      frame: 0,
      buildId: 0,
      imageAbort: null,
    };

    instances.set(root, state);
    roots.add(root);
    root.setAttribute('data-marquee-initialized', '');

    state.resizeObserver = new ResizeObserver(() => scheduleBuild(state));
    state.resizeObserver.observe(viewport);
    state.resizeObserver.observe(list);

    state.mutationObserver = new MutationObserver(() => scheduleBuild(state));
    state.mutationObserver.observe(list, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'src', 'srcset', 'sizes'],
    });

    state.handleLoad = () => scheduleBuild(state);
    list.addEventListener('load', state.handleLoad, true);
    intersectionObserver.observe(root);
    scheduleBuild(state);

    document.fonts?.ready?.then(() => scheduleBuild(state));
  };

  const init = (scope = document) => {
    if (scope.matches?.(ROOT_SELECTOR)) initRoot(scope);
    scope.querySelectorAll?.(ROOT_SELECTOR).forEach(initRoot);
  };

  const refresh = (root) => {
    if (root) {
      const state = instances.get(root);
      if (state) scheduleBuild(state);
      return;
    }

    roots.forEach((marqueeRoot) => {
      const state = instances.get(marqueeRoot);
      if (state) scheduleBuild(state);
    });
  };

  const destroyRoot = (root) => {
    const state = instances.get(root);
    if (!state) return;

    if (state.frame) cancelAnimationFrame(state.frame);
    state.imageAbort?.abort();
    state.resizeObserver?.disconnect();
    state.mutationObserver?.disconnect();
    state.list.removeEventListener('load', state.handleLoad, true);
    intersectionObserver.unobserve(root);
    removeClones(state);

    root.removeAttribute('data-marquee-initialized');
    root.removeAttribute('data-marquee-ready');
    root.style.removeProperty('--pattern-marquee-play-state');
    root.style.removeProperty('--pattern-marquee-distance');
    root.style.removeProperty('--pattern-marquee-duration');
    root.style.removeProperty('--pattern-marquee-gap');

    roots.delete(root);
    instances.delete(root);
  };

  const destroy = (scope = document) => {
    const matches = [];

    if (scope === document) {
      matches.push(...roots);
    } else {
      if (scope.matches?.(ROOT_SELECTOR)) matches.push(scope);
      scope.querySelectorAll?.(ROOT_SELECTOR).forEach((root) => matches.push(root));
    }

    matches.forEach(destroyRoot);

    if (scope === document) {
      pageObserver?.disconnect();
      pageObserver = null;
    }
  };

  const observeNewInstances = () => {
    if (!document.body || window.PatternRuntime?.managed || pageObserver) return;

    pageObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && !node.closest?.(CLONE_SELECTOR)) init(node);
        });
      });
    });

    pageObserver.observe(document.body, { childList: true, subtree: true });
  };

  const handleReducedMotionChange = () => {
    roots.forEach((root) => {
      const state = instances.get(root);
      if (state) setPlayState(state);
    });
  };

  reducedMotion.addEventListener?.('change', handleReducedMotionChange);

  window[GLOBAL_NAME] = {
    destroy,
    init,
    refresh,
    version: VERSION,
  };

  const start = () => {
    init(document);
    observeNewInstances();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
