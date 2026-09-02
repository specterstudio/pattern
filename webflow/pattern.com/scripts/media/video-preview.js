/**
 * Video Player preview hydration
 *
 * Authored contract:
 * - a prefixed or unprefixed Video Player root
 * - video[data-src]
 * - no authored src or autoplay attribute
 * - preload="none"
 *
 * The preview lifecycle is intentionally separate from popup iframe loading.
 */
(function () {
  'use strict';

  var GLOBAL_NAME = 'PatternVideoPreview';
  var VERSION = '1.0.0';
  var ROOT_SELECTOR = [
    '[class~="video_player_wrap"]',
    '[class*="--video_player_wrap "]',
    '[class$="--video_player_wrap"]'
  ].join(',');
  var VIDEO_SELECTOR = 'video[data-src]';
  var HYDRATED_ATTRIBUTE = 'data-video-preview-hydrated';
  var observed = new WeakSet();
  var observer = null;

  if (window[GLOBAL_NAME] && window[GLOBAL_NAME].version) {
    window[GLOBAL_NAME].init(document);
    return;
  }

  function getConsentState(api) {
    if (!api || !api.consents) return {};
    if (typeof api.consents.get === 'function') return api.consents.get() || {};
    return api.consents;
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

  function hydrate(video) {
    if (!video || video.hasAttribute(HYDRATED_ATTRIBUTE)) return;

    var source = video.getAttribute('data-src');
    if (!source) return;

    var category = (video.getAttribute('fs-consent-categories') || '').trim();

    runAfterConsent(category, function () {
      if (video.hasAttribute(HYDRATED_ATTRIBUTE)) return;

      video.setAttribute('src', source);
      video.setAttribute(HYDRATED_ATTRIBUTE, '');

      try {
        video.load();
      } catch (error) {
        // Loading can throw when a video is detached during a Runtime rescan.
      }

      var playPromise;

      try {
        playPromise = video.play();
      } catch (error) {
        return;
      }

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          // Muted preview playback may still be blocked by browser policy.
        });
      }
    });
  }

  function prepare(video) {
    if (!video || observed.has(video)) return;
    observed.add(video);

    var source = video.getAttribute('data-src') || video.getAttribute('src') || '';
    if (!source) return;

    video.setAttribute('data-src', source);
    video.removeAttribute('src');
    video.removeAttribute('autoplay');
    video.setAttribute('preload', 'none');

    if (!('IntersectionObserver' in window)) {
      hydrate(video);
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            hydrate(entry.target);
          });
        },
        { rootMargin: '0px', threshold: 0 }
      );
    }

    observer.observe(video);
  }

  function collectVideos(scope) {
    var target = scope || document;
    var videos = [];

    if (
      target.matches &&
      target.matches(VIDEO_SELECTOR) &&
      target.closest(ROOT_SELECTOR)
    ) {
      videos.push(target);
    }

    if (target.matches && target.matches(ROOT_SELECTOR)) {
      target.querySelectorAll(VIDEO_SELECTOR).forEach(function (video) {
        videos.push(video);
      });
    }

    if (target.querySelectorAll) {
      target.querySelectorAll(ROOT_SELECTOR).forEach(function (root) {
        root.querySelectorAll(VIDEO_SELECTOR).forEach(function (video) {
          videos.push(video);
        });
      });
    }

    return videos;
  }

  function init(scope) {
    collectVideos(scope).forEach(prepare);
  }

  window[GLOBAL_NAME] = {
    init: init,
    version: VERSION
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    }, { once: true });
  } else {
    init(document);
  }
})();
