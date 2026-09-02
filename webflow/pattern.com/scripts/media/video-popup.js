/**
 * Video Player popup
 *
 * Required structure per component instance:
 * - [class*="video_player_wrap"]
 * - [data-video-player-open]
 * - dialog[data-video-player-dialog]
 * - iframe[data-video-src] (data-consent-src is supported during migration)
 * - [data-video-player-close]
 */
(function () {
  'use strict';

  var GLOBAL_NAME = 'PatternVideoPopup';
  var VERSION = '1.1.3';
  var ROOT_SELECTOR = [
    '[class~="video_player_wrap"]',
    '[class*="--video_player_wrap "]',
    '[class$="--video_player_wrap"]'
  ].join(',');
  var OPEN_SELECTOR = '[data-video-player-open]';
  var DIALOG_SELECTOR = 'dialog[data-video-player-dialog]';
  var CLOSE_SELECTOR = '[data-video-player-close]';
  var INIT_ATTRIBUTE = 'data-video-player-popup-initialized';

  if (window[GLOBAL_NAME] && window[GLOBAL_NAME].version) {
    window[GLOBAL_NAME].init(document);
    return;
  }

  var activeController = null;
  var scrollLock = null;
  var instances = new WeakMap();

  function getDuration(dialog) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;

    var value = parseFloat(dialog.getAttribute('data-duration'));
    return Number.isFinite(value) ? Math.max(0, value) : 300;
  }

  function normalizeVideoUrl(value) {
    if (!value) return '';

    var url;

    try {
      url = new URL(value, window.location.href);
    } catch (error) {
      return '';
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';

    var host = url.hostname.replace(/^www\./, '');
    var youtubeId = '';
    var vimeoMatch;

    if (host === 'youtu.be') {
      youtubeId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') youtubeId = url.searchParams.get('v') || '';
      if (url.pathname.indexOf('/embed/') === 0) youtubeId = url.pathname.split('/')[2] || '';
      if (url.pathname.indexOf('/shorts/') === 0) youtubeId = url.pathname.split('/')[2] || '';
    }

    if (youtubeId) {
      url = new URL('https://www.youtube.com/embed/' + encodeURIComponent(youtubeId));
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('playsinline', '1');
      url.searchParams.set('rel', '0');
      return url.toString();
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      vimeoMatch = url.pathname.match(/(?:\/video)?\/(\d+)/);

      if (vimeoMatch) {
        var vimeoUrl = new URL('https://player.vimeo.com/video/' + vimeoMatch[1]);
        var privateHash = url.searchParams.get('h');

        if (privateHash) vimeoUrl.searchParams.set('h', privateHash);
        vimeoUrl.searchParams.set('autoplay', '1');
        vimeoUrl.searchParams.set('dnt', '1');
        return vimeoUrl.toString();
      }
    }

    url.searchParams.set('autoplay', '1');
    return url.toString();
  }

  function getStoredSource(iframe) {
    if (!iframe) return '';

    return (
      iframe.getAttribute('data-video-src') ||
      iframe.getAttribute('data-consent-src') ||
      iframe.getAttribute('fs-consent-src') ||
      iframe.getAttribute('data-src') ||
      iframe.getAttribute('src') ||
      ''
    );
  }

  function makeSourceInert(iframe) {
    var source = getStoredSource(iframe);

    if (!iframe || !source) return '';

    iframe.setAttribute('data-video-src', source);
    iframe.removeAttribute('data-consent-src');
    iframe.removeAttribute('fs-consent-src');
    iframe.removeAttribute('data-src');
    iframe.removeAttribute('src');

    return source;
  }

  function getConsentState(api) {
    if (!api || !api.consents) return {};
    if (typeof api.consents.get === 'function') return api.consents.get() || {};
    return api.consents;
  }

  function getConsentCategory(dialog, iframe) {
    return (
      dialog.getAttribute('data-consent-category') ||
      (iframe && iframe.getAttribute('fs-consent-categories')) ||
      ''
    ).trim();
  }

  function runAfterConsent(category, callback) {
    if (!category) {
      callback();
      return;
    }

    var consentPro = window.FinsweetConsentPro;

    if (!consentPro) {
      consentPro = [];
      window.FinsweetConsentPro = consentPro;
    }

    var completed = false;

    function connect(api) {
      function proceedIfAllowed(detail) {
        var state = getConsentState(api);
        var detailState =
          detail &&
          (detail.consents ||
            (detail.detail && (detail.detail.consents || detail.detail)));

        if (
          (!state || !state[category]) &&
          detailState &&
          typeof detailState === 'object' &&
          Object.prototype.hasOwnProperty.call(detailState, category)
        ) {
          state = detailState;
        }

        if (completed || !state || !state[category]) return;
        completed = true;
        callback();
      }

      proceedIfAllowed();

      if (!completed && api && typeof api.on === 'function') {
        api.on('consent-updated', proceedIfAllowed);
      }
    }

    if (Array.isArray(consentPro)) {
      consentPro.push(connect);
      return;
    }

    connect(consentPro);
  }

  function lockPageScroll() {
    if (scrollLock) return;

    var body = document.body;
    var html = document.documentElement;
    var scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);

    scrollLock = {
      scrollY: window.scrollY,
      body: {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight
      },
      htmlOverflow: html.style.overflow
    };

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = '-' + scrollLock.scrollY + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    if (scrollbarWidth) body.style.paddingRight = scrollbarWidth + 'px';
  }

  function unlockPageScroll() {
    if (!scrollLock) return;

    var body = document.body;
    var html = document.documentElement;
    var saved = scrollLock;

    scrollLock = null;
    html.style.overflow = saved.htmlOverflow;
    body.style.overflow = saved.body.overflow;
    body.style.position = saved.body.position;
    body.style.top = saved.body.top;
    body.style.left = saved.body.left;
    body.style.right = saved.body.right;
    body.style.width = saved.body.width;
    body.style.paddingRight = saved.body.paddingRight;
    window.scrollTo(0, saved.scrollY);
  }

  function createController(root) {
    if (instances.has(root)) return instances.get(root);

    var trigger = root.querySelector(OPEN_SELECTOR);
    var dialog = root.querySelector(DIALOG_SELECTOR);

    // Video Only intentionally has neither a trigger nor a dialog.
    if (!trigger || !dialog || typeof dialog.showModal !== 'function') return null;

    var iframe = dialog.querySelector('iframe');
    var storedSource = makeSourceInert(iframe);

    if (!storedSource) {
      var sourceElement = root.querySelector('[data-video-player-source]');
      storedSource = makeSourceInert(sourceElement);
    }
    var opener = null;
    var closeTimer = null;
    var waitingForConsent = false;
    var consentCategory = getConsentCategory(dialog, iframe);

    function finishClose(options) {
      var settings = options || {};

      window.clearTimeout(closeTimer);
      closeTimer = null;

      if (iframe) iframe.removeAttribute('src');
      dialog.classList.remove('is-active');
      dialog.removeAttribute('data-state');
      dialog.style.display = '';
      dialog.style.opacity = '';

      if (dialog.open) dialog.close();
      if (activeController === controller) activeController = null;
      if (!settings.keepScrollLocked) unlockPageScroll();

      if (settings.restoreFocus !== false && opener && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }

      opener = null;
    }

    function close(options) {
      var settings = options || {};

      if (!dialog.open) return;

      dialog.classList.remove('is-active');
      dialog.setAttribute('data-state', 'inactive');
      dialog.style.opacity = '0';

      if (settings.immediate || getDuration(dialog) === 0) {
        finishClose(settings);
        return;
      }

      closeTimer = window.setTimeout(function () {
        finishClose(settings);
      }, getDuration(dialog));
    }

    function reveal() {
      if (dialog.open) return;

      if (activeController && activeController !== controller) {
        activeController.close({
          immediate: true,
          keepScrollLocked: true,
          restoreFocus: false
        });
      }

      var source = normalizeVideoUrl(storedSource);

      if (!source) {
        console.warn('[video-player] A valid Video URL is required.');
        return;
      }

      activeController = controller;
      opener = trigger;
      lockPageScroll();

      try {
        dialog.showModal();
      } catch (error) {
        activeController = null;
        unlockPageScroll();
        console.warn('[video-player] The popup could not be opened.', error);
        return;
      }

      dialog.style.display = 'flex';
      dialog.style.opacity = '0';
      dialog.setAttribute('data-state', 'active');
      if (iframe) iframe.setAttribute('src', source);

      window.requestAnimationFrame(function () {
        dialog.classList.add('is-active');
        dialog.style.opacity = '1';

        var closeButton = dialog.querySelector(CLOSE_SELECTOR);
        if (closeButton) closeButton.focus({ preventScroll: true });
      });
    }

    function open() {
      if (dialog.open || waitingForConsent) return;
      waitingForConsent = true;

      runAfterConsent(consentCategory, function () {
        waitingForConsent = false;
        reveal();
      });
    }

    var controller = { close: close, open: open };

    trigger.addEventListener('click', open);

    trigger.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });

    dialog.addEventListener('click', function (event) {
      if (!event.target.closest(CLOSE_SELECTOR)) return;
      event.preventDefault();
      close();
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key !== ' ' || !event.target.closest(CLOSE_SELECTOR)) return;
      event.preventDefault();
      close();
    });

    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      close();
    });

    dialog.addEventListener('close', function () {
      if (activeController === controller) finishClose();
    });

    root.setAttribute(INIT_ATTRIBUTE, '');
    instances.set(root, controller);
    return controller;
  }

  function initVideoPlayers(scope) {
    var target = scope || document;
    var roots = [];

    if (target.matches && target.matches(ROOT_SELECTOR)) roots.push(target);
    if (target.querySelectorAll) {
      target.querySelectorAll(ROOT_SELECTOR).forEach(function (root) {
        roots.push(root);
      });
    }

    roots.forEach(createController);
  }

  window[GLOBAL_NAME] = {
    init: initVideoPlayers,
    version: VERSION
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoPlayers, { once: true });
  } else {
    initVideoPlayers();
  }
})();
