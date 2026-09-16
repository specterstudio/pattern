(() => {
  'use strict';

  const GLOBAL_NAME = 'PatternHomeAnchorNav';
  const VERSION = '1.0.1';
  const DESTINATION_GAP = 16;
  const TRACK_SELECTOR = '[data-home-anchor-track], .v3_home_track';
  const NAV_SELECTOR = [
    '[data-home-anchor-nav]',
    '[class~="home_anchor_nav"]',
    '[class*="--home_anchor_nav "]',
    '[class$="--home_anchor_nav"]',
  ].join(',');
  const LINK_SELECTOR = [
    '[data-home-anchor-link]',
    '[class~="home_anchor_link"]',
    '[class*="--home_anchor_link "]',
    '[class$="--home_anchor_link"]',
  ].join(',');
  const READY_ATTRIBUTE = 'data-home-anchor-ready';
  const CSS_VARIABLES = [
    '--v3-home-anchor-offset',
    '--v3-home-anchor-leading-space',
    '--v3-home-anchor-trailing-space',
  ];

  if (window[GLOBAL_NAME]?.version) {
    window[GLOBAL_NAME].init(document);
    return;
  }

  const instances = new WeakMap();
  const roots = new Set();
  let pageObserver = null;

  const collectRoots = (scope = document) => {
    const matches = [];

    if (scope.matches?.(NAV_SELECTOR)) matches.push(scope);
    scope.querySelectorAll?.(NAV_SELECTOR).forEach((root) => matches.push(root));

    return [...new Set(matches)];
  };

  const captureProperty = (element, property) => ({
    priority: element.style.getPropertyPriority(property),
    value: element.style.getPropertyValue(property),
  });

  const restoreProperty = (element, property, snapshot) => {
    if (snapshot.value) {
      element.style.setProperty(property, snapshot.value, snapshot.priority);
    } else {
      element.style.removeProperty(property);
    }
  };

  const createLinkRecords = (nav) =>
    [...nav.querySelectorAll(LINK_SELECTOR)]
      .map((link) => {
        const href = link.getAttribute('href');
        if (!href?.startsWith('#')) return null;

        const id = href.slice(1);
        const section = id ? document.getElementById(id) : null;
        return section ? { href, link, section } : null;
      })
      .filter(Boolean);

  const getDestinationOffset = (state) => {
    const computedTop = Number.parseFloat(window.getComputedStyle(state.nav).top);
    const stickyTop = Number.isFinite(computedTop) ? computedTop : 0;

    return stickyTop + state.nav.getBoundingClientRect().height + DESTINATION_GAP;
  };

  const scrollToRecord = (state, record, immediate = false) => {
    const targetTop =
      record.section.getBoundingClientRect().top +
      window.scrollY -
      getDestinationOffset(state);

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: immediate || state.reducedMotion.matches ? 'auto' : 'smooth',
    });
  };

  const findHashRecord = (state) =>
    state.links.find(({ href }) => href === window.location.hash);

  const navigateToRecord = (
    state,
    record,
    { immediate = false, updateHistory = false } = {},
  ) => {
    setActiveLink(state, record.link, immediate);

    if (updateHistory && window.location.hash !== record.href) {
      window.history.pushState(null, '', record.href);
    }

    scrollToRecord(state, record, immediate);
  };

  const setActiveLink = (state, link, immediate = false) => {
    if (!link) return;

    state.links.forEach(({ link: candidate }) => {
      const active = candidate === link;
      candidate.classList.toggle('w--current', active);

      if (active) candidate.setAttribute('aria-current', 'location');
      else candidate.removeAttribute('aria-current');
    });

    if (state.activeLink === link && !immediate) return;
    state.activeLink = link;

    if (!state.mobile.matches) {
      state.nav.scrollLeft = 0;
      return;
    }

    const targetLeft = link.offsetLeft - (state.nav.clientWidth - link.offsetWidth) / 2;
    state.nav.scrollTo({
      left: targetLeft,
      behavior: immediate || state.reducedMotion.matches ? 'auto' : 'smooth',
    });
  };

  const updateActiveLink = (state, immediate = false) => {
    const navRect = state.nav.getBoundingClientRect();
    const threshold = Math.min(
      window.innerHeight * 0.45,
      Math.max(navRect.bottom + 16, window.innerHeight * 0.25),
    );
    let active = state.links[0];

    state.links.forEach((record) => {
      if (record.section.getBoundingClientRect().top <= threshold) active = record;
    });

    setActiveLink(state, active?.link, immediate);
  };

  const updateLayout = (state, immediate = false) => {
    if (
      !state.track.isConnected ||
      !state.nav.isConnected ||
      !state.placeholder.isConnected
    ) {
      return;
    }

    const trackRect = state.track.getBoundingClientRect();
    const placeholderRect = state.placeholder.getBoundingClientRect();

    state.layer.style.left = `${placeholderRect.left - trackRect.left}px`;
    state.layer.style.width = `${placeholderRect.width}px`;
    state.nav.style.setProperty(
      '--v3-home-anchor-offset',
      `${placeholderRect.top - trackRect.top}px`,
    );
    state.placeholder.style.height = `${state.nav.getBoundingClientRect().height}px`;

    const firstLink = state.links[0]?.link;
    const lastLink = state.links[state.links.length - 1]?.link;
    const leadingSpace = firstLink
      ? Math.max(0, (state.nav.clientWidth - firstLink.offsetWidth) / 2)
      : 0;
    const trailingSpace = lastLink
      ? Math.max(0, (state.nav.clientWidth - lastLink.offsetWidth) / 2)
      : 0;

    state.nav.style.setProperty('--v3-home-anchor-leading-space', `${leadingSpace}px`);
    state.nav.style.setProperty('--v3-home-anchor-trailing-space', `${trailingSpace}px`);
    updateActiveLink(state, immediate);
  };

  const scheduleActiveUpdate = (state) => {
    if (state.activeFrame) return;

    state.activeFrame = window.requestAnimationFrame(() => {
      state.activeFrame = 0;
      updateActiveLink(state);
    });
  };

  const scheduleLayoutUpdate = (state, immediate = true) => {
    if (state.layoutFrame) window.cancelAnimationFrame(state.layoutFrame);

    state.layoutFrame = window.requestAnimationFrame(() => {
      state.layoutFrame = 0;
      updateLayout(state, immediate);
    });
  };

  const initializeRoot = (nav) => {
    if (
      instances.has(nav) ||
      nav.closest('[data-home-anchor-clone]') ||
      nav.getAttribute(READY_ATTRIBUTE) === 'true'
    ) {
      return;
    }

    const track = nav.closest(TRACK_SELECTOR);
    const links = createLinkRecords(nav);
    if (!track || !links.length) return;

    const navRect = nav.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'v3_home_anchor_placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = `${navRect.height}px`;
    nav.before(placeholder);

    const placeholderRect = placeholder.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'v3_home_anchor_sticky_layer';
    layer.style.left = `${placeholderRect.left - trackRect.left}px`;
    layer.style.width = `${placeholderRect.width}px`;
    track.prepend(layer);
    layer.appendChild(nav);

    const state = {
      activeFrame: 0,
      activeLink: null,
      controller: new AbortController(),
      cssVariables: new Map(
        CSS_VARIABLES.map((property) => [property, captureProperty(nav, property)]),
      ),
      hadAriaLabel: nav.hasAttribute('aria-label'),
      hadRole: nav.hasAttribute('role'),
      layer,
      layoutFrame: 0,
      links,
      linkSnapshots: new Map(
        links.map(({ link }) => [
          link,
          {
            ariaCurrent: link.getAttribute('aria-current'),
            current: link.classList.contains('w--current'),
          },
        ]),
      ),
      mobile: window.matchMedia('(max-width: 767px)'),
      nav,
      originalAriaLabel: nav.getAttribute('aria-label'),
      originalReady: nav.getAttribute(READY_ATTRIBUTE),
      originalRole: nav.getAttribute('role'),
      placeholder,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      track,
    };

    instances.set(nav, state);
    roots.add(nav);
    nav.setAttribute(READY_ATTRIBUTE, 'true');
    nav.setAttribute('role', 'navigation');
    if (!state.hadAriaLabel) nav.setAttribute('aria-label', 'Page sections');

    links.forEach((record) => {
      record.link.addEventListener(
        'click',
        (event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          navigateToRecord(state, record, { updateHistory: true });
        },
        {
          signal: state.controller.signal,
        },
      );
    });

    window.addEventListener('scroll', () => scheduleActiveUpdate(state), {
      passive: true,
      signal: state.controller.signal,
    });
    window.addEventListener('resize', () => scheduleLayoutUpdate(state), {
      signal: state.controller.signal,
    });
    window.addEventListener(
      'hashchange',
      () => {
        const record = findHashRecord(state);
        if (record) navigateToRecord(state, record);
        else scheduleActiveUpdate(state);
      },
      {
        signal: state.controller.signal,
      },
    );
    state.mobile.addEventListener(
      'change',
      () => scheduleLayoutUpdate(state),
      { signal: state.controller.signal },
    );

    state.resizeObserver = new ResizeObserver(() => scheduleLayoutUpdate(state));
    state.resizeObserver.observe(track);
    if (placeholder.parentElement) state.resizeObserver.observe(placeholder.parentElement);

    updateLayout(state, true);
    const initialHashRecord = findHashRecord(state);
    if (initialHashRecord) {
      window.requestAnimationFrame(() => {
        if (instances.has(nav)) {
          navigateToRecord(state, initialHashRecord, { immediate: true });
        }
      });
    }
    document.fonts?.ready?.then(() => {
      if (instances.has(nav)) scheduleLayoutUpdate(state);
    });
  };

  const init = (scope = document) => {
    collectRoots(scope).forEach(initializeRoot);
  };

  const destroyRoot = (nav) => {
    const state = instances.get(nav);
    if (!state) return;

    state.controller.abort();
    state.resizeObserver?.disconnect();
    if (state.activeFrame) window.cancelAnimationFrame(state.activeFrame);
    if (state.layoutFrame) window.cancelAnimationFrame(state.layoutFrame);

    if (state.placeholder.isConnected) {
      state.placeholder.replaceWith(nav);
    } else if (state.layer.isConnected) {
      state.layer.before(nav);
    }
    state.layer.remove();

    if (state.hadRole) nav.setAttribute('role', state.originalRole);
    else nav.removeAttribute('role');

    if (state.hadAriaLabel) nav.setAttribute('aria-label', state.originalAriaLabel);
    else nav.removeAttribute('aria-label');

    if (state.originalReady === null) nav.removeAttribute(READY_ATTRIBUTE);
    else nav.setAttribute(READY_ATTRIBUTE, state.originalReady);

    state.cssVariables.forEach((snapshot, property) => {
      restoreProperty(nav, property, snapshot);
    });

    state.linkSnapshots.forEach((snapshot, link) => {
      link.classList.toggle('w--current', snapshot.current);
      if (snapshot.ariaCurrent === null) link.removeAttribute('aria-current');
      else link.setAttribute('aria-current', snapshot.ariaCurrent);
    });

    roots.delete(nav);
    instances.delete(nav);
  };

  const destroy = (scope = document) => {
    const matches = scope === document ? [...roots] : collectRoots(scope);
    matches.forEach(destroyRoot);

    if (scope === document) {
      pageObserver?.disconnect();
      pageObserver = null;
    }
  };

  const refresh = (scope = document) => {
    collectRoots(scope).forEach((nav) => {
      const state = instances.get(nav);
      if (state) scheduleLayoutUpdate(state);
      else initializeRoot(nav);
    });
  };

  const observeNewInstances = () => {
    if (!document.body || window.PatternRuntime?.managed || pageObserver) return;

    pageObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) init(node);
        });
        record.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) destroy(node);
        });
      });
    });

    pageObserver.observe(document.body, { childList: true, subtree: true });
  };

  window[GLOBAL_NAME] = {
    destroy,
    init,
    refresh,
    selector: NAV_SELECTOR,
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
