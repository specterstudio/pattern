 /**
 * Iframe Popup JS - Consent-safe generic iframe popup
 *
 * Important:
 * - Never assigns iframe src during initialization.
 * - Reads iframe URLs from data-consent-src, data-src, src, or fallback links.
 * - Stores iframe URLs in data-consent-src.
 * - Restores iframe src only after the required Consent Pro category is allowed.
 */
(function () {
  'use strict';

  var iframePopupOpenSteps = [{ opacity: '0' }, { opacity: '1' }];
  var iframePopupCloseSteps = [{ opacity: '1' }, { opacity: '0' }];

  var consentCallbacks = {};
  var consentState = {};
  var consentBridgeStarted = false;

  function startConsentBridge() {
    if (consentBridgeStarted) return;
    consentBridgeStarted = true;

    window.FinsweetConsentPro = window.FinsweetConsentPro || [];
    window.FinsweetConsentPro.push(function (consent) {
      function refreshConsentState() {
        consentState = consent.consents.get() || {};

        Object.keys(consentCallbacks).forEach(function (category) {
          if (!consentState[category]) return;

          var callbacks = consentCallbacks[category].slice();
          consentCallbacks[category] = [];

          callbacks.forEach(function (callback) {
            callback();
          });
        });
      }

      refreshConsentState();
      consent.on('consent-updated', refreshConsentState);
    });
  }

  function whenConsented(category, callback) {
    startConsentBridge();

    if (consentState[category]) {
      callback();
      return;
    }

    consentCallbacks[category] = consentCallbacks[category] || [];
    consentCallbacks[category].push(callback);
  }

  var scrollLockState = { active: false, scrollY: 0 };

  function lockScroll() {
    if (scrollLockState.active) return;
    scrollLockState.active = true;
    scrollLockState.scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollLockState.scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (!scrollLockState.active) return;
    scrollLockState.active = false;

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.documentElement.style.overflow = '';

    window.scrollTo(0, scrollLockState.scrollY);
  }

  function getIframeCategory(component, iframe, src) {
    var explicitCategory =
      (iframe && iframe.getAttribute('fs-consent-categories')) ||
      (component && component.getAttribute('fs-consent-categories'));

    if (explicitCategory) return explicitCategory;

    if (src && src.indexOf('storylane.io') !== -1) return 'analytics';
    if (src && src.indexOf('player.vimeo.com') !== -1) return 'personalization';
    if (src && src.indexOf('vimeo.com') !== -1) return 'personalization';
    if (src && src.indexOf('youtube.com') !== -1) return 'marketing';
    if (src && src.indexOf('youtu.be') !== -1) return 'marketing';

    return 'personalization';
  }

  function getIframeInfo(component) {
    if (!component) return null;

    var iframe = component.querySelector('iframe');
    if (!iframe) return null;

    var src =
      iframe.getAttribute('data-consent-src') ||
      iframe.getAttribute('data-src') ||
      iframe.getAttribute('src') ||
      '';

    if (!src) {
      var link = component.querySelector('a[href]');
      if (link) {
        src = link.getAttribute('href') || '';
      }
    }

    if (!src) return null;

    iframe.setAttribute('data-consent-src', src);
    iframe.removeAttribute('data-src');
    iframe.removeAttribute('src');

    return {
      iframe: iframe,
      src: src,
      category: getIframeCategory(component, iframe, src)
    };
  }

  function getPopupGroup(component) {
    var attr = (component && component.getAttribute('fc-iframe-popup')) || '';
    var match = attr.match(/^component(.*)$/);
    return match ? match[1] : '';
  }

  function findOpenButtons(component, group) {
    var g = group || '';
    return document.querySelectorAll('[fc-iframe-popup="open' + g + '"]');
  }

  function findCloseButtons(component) {
    return (
      component.querySelectorAll('[fc-iframe-popup="close"]') ||
      component.querySelectorAll('[fc-iframe-popup*="close"]')
    );
  }

  function getTiming(component) {
    var duration = parseFloat(component.getAttribute('duration'));
    var easing = component.getAttribute('easing');

    if (isNaN(duration)) duration = 300;
    if (!easing) easing = 'ease';

    return {
      duration: duration,
      timing: { duration: duration, fill: 'forwards', easing: easing }
    };
  }

  function setupIframePopup(component, openSteps, closeSteps) {
    if (!component) return;

    var info = getIframeInfo(component);
    if (!info) return;

    var group = getPopupGroup(component);

    var openButtons = findOpenButtons(component, group);
    var closeButtons = findCloseButtons(component);
    var timingInfo = getTiming(component);

    openButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        whenConsented(info.category, function () {
          if (!info.iframe.getAttribute('src')) {
            info.iframe.setAttribute('src', info.src);
          }

          component.style.display = 'flex';
          component.animate(openSteps, timingInfo.timing);
          lockScroll();
        });
      });
    });

    closeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        component.animate(closeSteps, timingInfo.timing);

        setTimeout(function () {
          component.style.display = 'none';
          unlockScroll();
        }, timingInfo.duration);
      });
    });
  }

  function initIframePopups() {
    startConsentBridge();

    var iframePopupComponents = document.querySelectorAll(
      '[fc-iframe-popup^="component"]'
    );

    if (!iframePopupComponents.length) return;

    for (var i = 0; i < iframePopupComponents.length; i++) {
      var component = iframePopupComponents[i];

      document.body.appendChild(component);

      setupIframePopup(
        component,
        iframePopupOpenSteps,
        iframePopupCloseSteps
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIframePopups);
  } else {
    initIframePopups();
  }
})();
