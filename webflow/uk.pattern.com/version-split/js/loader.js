/*
 * Pattern UK version split — Phase 5 marker-based loader
 * Runs on any page with one consistent data-pattern-version="v1" or "v2" marker.
 */
(function (global, document) {
  "use strict";

  if (
    global.__patternVersionSplit &&
    global.__patternVersionSplit.started
  ) {
    return;
  }

  var markerNodes = document.querySelectorAll("[data-pattern-version]");
  if (!markerNodes.length) return;

  var markerValues = Array.prototype.map.call(
    markerNodes,
    function (node) {
      return node.getAttribute("data-pattern-version");
    }
  );
  var invalidValues = markerValues.filter(function (value) {
    return value !== "v1" && value !== "v2";
  });
  var versions = markerValues.filter(function (value, index, values) {
    return values.indexOf(value) === index;
  });

  function block(reason) {
    global.__patternVersionSplit = {
      phase: 5,
      release: "0.5.2",
      status: "blocked",
      started: false,
      version: null,
      reason: reason,
      markerValues: markerValues.slice(),
      loaded: [],
      skipped: [],
      failed: []
    };
    document.dispatchEvent(new CustomEvent("pattern:version-split-blocked", {
      detail: {
        phase: 5,
        release: "0.5.2",
        reason: reason,
        markerValues: markerValues.slice()
      }
    }));
  }

  if (invalidValues.length) {
    block("invalid-version-marker");
    return;
  }

  if (versions.length !== 1) {
    block("conflicting-version-markers");
    return;
  }

  var version = versions[0];
  var currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) {
    block("loader-source-unavailable");
    return;
  }

  var packageRoot = new URL("../", currentScript.src);
  var state = global.__patternVersionSplit = {
    phase: 5,
    release: "0.5.2",
    status: "loading",
    started: true,
    version: version,
    markerCount: markerNodes.length,
    loaded: [],
    skipped: [],
    failed: []
  };

  function normalizedUrl(url) {
    return new URL(url, document.baseURI).href;
  }

  function hasScript(url) {
    var expected = normalizedUrl(url);
    return Array.prototype.some.call(
      document.querySelectorAll("script[src]"),
      function (script) {
        return normalizedUrl(script.src) === expected;
      }
    );
  }

  function loadScript(id, url) {
    return new Promise(function (resolve) {
      if (hasScript(url)) {
        state.skipped.push(id);
        resolve();
        return;
      }

      var script = document.createElement("script");
      script.src = url;
      script.defer = true;
      script.dataset.patternSplitAsset = id;
      script.addEventListener("load", function () {
        state.loaded.push(id);
        resolve();
      }, { once: true });
      script.addEventListener("error", function () {
        state.failed.push(id);
        resolve();
      }, { once: true });
      document.body.appendChild(script);
    });
  }

  var featureScripts = [
  {
    "id": "splide-js",
    "selector": ".splide",
    "url": "https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js"
  },
  {
    "id": "pagination-js",
    "selector": "[class*='pagination']",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/pagination-fix.js"
  },
  {
    "id": "video-popup",
    "selector": "[class*='video_popup'], [data-video-popup]",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/media/video-popup.js"
  },
  {
    "id": "logos",
    "selector": "[class*='logo']",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/logos.js"
  },
  {
    "id": "rich-text-heading-conversion",
    "selector": ".w-richtext",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/rich-text-heading-conversion.js"
  },
  {
    "id": "faq-schema",
    "selector": "[class*='faq']",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/schema/faq-schema-generator.js"
  },
  {
    "id": "accordion",
    "selector": "[data-accordion-list], [class*=\"accordion_list\"]",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/accordion.js"
  },
  {
    "id": "lazy-load",
    "selector": "[loading='lazy'], [data-src]",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/lazy-load.js"
  },
  {
    "id": "cta-inject",
    "requiredSelectors": [
      "[fs-inject-element=\"target\"]",
      "[fs-inject-element=\"element\"]"
    ],
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/cta-inject.js"
  },
  {
    "id": "iframe-popup",
    "selector": "[data-iframe-popup], [class*='iframe_popup']",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.2/webflow/pattern.com/scripts/media/iframe-popup.js"
  },
  {
    "id": "card-load-animations",
    "selector": "[class*='card']",
    "url": "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/card-load-animations-v10.js"
  }
];

  function hasFeatureMarkup(feature) {
    if (Array.isArray(feature.requiredSelectors)) {
      return feature.requiredSelectors.every(function (selector) {
        return Boolean(document.querySelector(selector));
      });
    }

    return Boolean(
      feature.selector && document.querySelector(feature.selector)
    );
  }

  loadScript("shared-runtime", new URL("js/shared.js", packageRoot).href)
    .then(function () {
      return loadScript(
        version + "-runtime",
        new URL("js/" + version + ".js", packageRoot).href
      );
    })
    .then(function () {
      return featureScripts.reduce(function (promise, feature) {
        if (!hasFeatureMarkup(feature)) return promise;
        return promise.then(function () {
          return loadScript(feature.id, feature.url);
        });
      }, Promise.resolve());
    })
    .then(function () {
      if (
        global.pageFunctions &&
        typeof global.pageFunctions.executeFunctions === "function"
      ) {
        global.pageFunctions.executeFunctions();
      }

      state.status = state.failed.length ? "degraded" : "ready";
      document.dispatchEvent(new CustomEvent("pattern:version-split-ready", {
        detail: {
          phase: 5,
          release: "0.5.2",
          status: state.status,
          version: version,
          loaded: state.loaded.slice(),
          skipped: state.skipped.slice(),
          failed: state.failed.slice()
        }
      }));
    });
})(window, document);
