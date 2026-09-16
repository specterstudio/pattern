import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "../../..");
const auditRoot = resolve(
  repoRoot,
  "audits/pattern-uk-version-split/2026-07-28/rollback/custom-code-active"
);

const release = Object.freeze({
  phase: 5,
  version: "0.5.2",
  tag: "uk-version-split-v0.5.2"
});

const cdnRoot = `https://cdn.jsdelivr.net/gh/specterstudio/pattern@${release.tag}/webflow/uk.pattern.com/version-split`;

const sourcePaths = {
  lumos: resolve(auditRoot, "01-text-style.html"),
  v1Bridge: resolve(auditRoot, "02-base.html"),
  siteOverrides: resolve(auditRoot, "03-color.html"),
  marketo: resolve(auditRoot, "04-responsive.html")
};

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(sourcePaths).map(async ([key, path]) => [
      key,
      await readFile(path, "utf8")
    ])
  )
);

const lines = Object.fromEntries(
  Object.entries(sources).map(([key, value]) => [
    key,
    value.replace(/\r\n?/g, "\n").split("\n")
  ])
);

function lineRange(sourceKey, start, end) {
  return lines[sourceKey].slice(start - 1, end).join("\n").trim();
}

function banner(name, classification, provenance) {
  return `/*
 * Pattern UK version split — ${name}
 * Classification: ${classification}
 * Phase ${release.phase} rollout asset. Active only through the canonical resource components.
 * Provenance: ${provenance}
 */`;
}

function scopeV1(css) {
  return css
    .replaceAll(
      ":where(body:has(:is(.page_code_wrap, .page_main.cc-v1)))",
      ':where(body:is([data-pattern-version="v1"], :has([data-pattern-version="v1"])))'
    )
    .replaceAll(
      ":root:has(body :is(.page_code_wrap, .page_main.cc-v1))",
      ':root:has([data-pattern-version="v1"])'
    )
    .replaceAll(
      "html:has(body :is(.page_code_wrap, .page_main.cc-v1))",
      'html:has([data-pattern-version="v1"])'
    )
    .replaceAll(
      "body:has(:is(.page_code_wrap, .page_main.cc-v1))",
      'body:is([data-pattern-version="v1"], :has([data-pattern-version="v1"]))'
    );
}

function unscopeSharedCompatibility(css) {
  return css
    .replaceAll(
      ":root:has(body :is(.page_code_wrap, .page_main.cc-v1))",
      ":root"
    )
    .replaceAll(
      ":where(body:has(:is(.page_code_wrap, .page_main.cc-v1))) ",
      ""
    )
    .replaceAll(
      "body:has(:is(.page_code_wrap, .page_main.cc-v1))",
      "body"
    );
}

const sharedGridAliases = `/* Shared unsuffixed grid aliases used by global Header and Footer components. */
:root {
  --grid-1: repeat(1, minmax(0, 1fr));
  --grid-2: repeat(2, minmax(0, 1fr));
  --grid-3: repeat(3, minmax(0, 1fr));
  --grid-4: repeat(4, minmax(0, 1fr));
  --grid-5: repeat(5, minmax(0, 1fr));
  --grid-6: repeat(6, minmax(0, 1fr));
  --grid-7: repeat(7, minmax(0, 1fr));
  --grid-8: repeat(8, minmax(0, 1fr));
  --grid-9: repeat(9, minmax(0, 1fr));
  --grid-10: repeat(10, minmax(0, 1fr));
  --grid-11: repeat(11, minmax(0, 1fr));
  --grid-12: repeat(12, minmax(0, 1fr));
}`;

const sharedFluidLegacyAliases = `/* Shared fluid aliases used by unsuffixed global Header and Footer utilities. */
:root {
  --type-size--d1: clamp(3.25rem, 1.7642857142857142rem + 6.095238095238095vw, 7.25rem);
  --type-size--d2: clamp(2.9375rem, 1.7535714285714286rem + 4.857142857142857vw, 6.125rem);
  --type-size--d3: clamp(2.6875rem, 1.7357142857142858rem + 3.9047619047619047vw, 5.25rem);
  --type-size--h1: clamp(2.4375rem, 1.6830357142857142rem + 3.0952380952380953vw, 4.46875rem);
  --type-size--h2: clamp(2.1875rem, 1.5839285714285714rem + 2.4761904761904763vw, 3.8125rem);
  --type-size--h3: clamp(2rem, 1.5357142857142858rem + 1.9047619047619049vw, 3.25rem);
  --type-size--h4: clamp(1.8125rem, 1.4642857142857142rem + 1.4285714285714286vw, 2.75rem);
  --type-size--h5: clamp(1.65rem, 1.3807142857142858rem + 1.1047619047619048vw, 2.375rem);
  --type-size--h6: clamp(1.5rem, 1.3142857142857143rem + 0.7619047619047619vw, 2rem);
  --type-size--text-xxlarge: clamp(1.5rem, 1.4303571428571429rem + 0.2857142857142857vw, 1.6875rem);
  --type-size--text-xlarge: clamp(1.25rem, 1.2035714285714285rem + 0.19047619047619047vw, 1.375rem);
  --type-size--text-large: clamp(1.1rem, 1.090714285714286rem + 0.03809523809523796vw, 1.125rem);
  --type-size--text-main: clamp(1rem, 1rem + 0vw, 1rem);
  --type-size--text-small: clamp(0.875rem, 0.875rem + 0vw, 0.875rem);
  --type-size--overline-large: clamp(1rem, 1rem + 0vw, 1rem);
  --type-size--oevrline-main: clamp(0.875rem, 0.875rem + 0vw, 0.875rem);
  --type-size--overline-small: clamp(0.75rem, 0.75rem + 0vw, 0.75rem);
  --site--margin: clamp(1.5rem, 0.38571428571428573rem + 4.571428571428571vw, 4.5rem);
  --_buttons---button--font-size: clamp(0.8125rem, 0.7892857142857143rem + 0.09523809523809523vw, 0.875rem);
}`;

const sharedCss = [
  banner(
    "Shared foundation",
    "shared",
    "active Custom Code 01, shared container tokens and generic compatibility foundation from 02, and shared global helpers from 03"
  ),
  lineRange("lumos", 2, 570),
  unscopeSharedCompatibility(lineRange("v1Bridge", 19, 74)),
  sharedGridAliases,
  sharedFluidLegacyAliases,
  unscopeSharedCompatibility(lineRange("v1Bridge", 77, 239)),
  lineRange("siteOverrides", 66, 77),
  lineRange("siteOverrides", 93, 100)
].join("\n\n");

const v1Css = [
  banner(
    "V1 compatibility",
    "v1",
    "version-specific active Custom Code 02 rules with explicit marker scoping and shared unsuffixed utility foundation extracted"
  ),
  scopeV1(
    [
      lineRange("v1Bridge", 4, 18),
      lineRange("v1Bridge", 240, 570),
      lineRange("v1Bridge", 595, 715)
    ].join("\n\n")
  )
].join("\n\n");

const v2Css = [
  banner(
    "V2 core",
    "v2",
    "Content Wrapper alignment repair from active Custom Code 03"
  ),
  'body:is([data-pattern-version="v2"], :has([data-pattern-version="v2"])) {',
  lineRange("siteOverrides", 101, 135),
  "}"
].join("\n\n");

const featureModules = {
  "icons.css": [
    banner(
      "Tabler icons",
      "feature",
      "active Custom Code 02 import"
    ),
    lineRange("v1Bridge", 2, 2)
  ].join("\n\n"),
  "cards-icons.css": [
    banner(
      "Cards and icons",
      "feature",
      "active Custom Code 03 section 2"
    ),
    lineRange("siteOverrides", 136, 198)
  ].join("\n\n"),
  "buttons-animations.css": [
    banner(
      "Buttons and animations",
      "feature",
      "active Custom Code 03 section 3"
    ),
    lineRange("siteOverrides", 199, 253)
  ].join("\n\n"),
  "gradients.css": [
    banner(
      "Gradients",
      "feature",
      "active Custom Code 03 section 4"
    ),
    lineRange("siteOverrides", 254, 438)
  ].join("\n\n"),
  "accordion-faq.css": [
    banner(
      "Accordion and FAQ",
      "feature",
      "active Custom Code 03 section 5"
    ),
    lineRange("siteOverrides", 439, 465)
  ].join("\n\n"),
  "swiper.css": [
    banner(
      "Swiper",
      "feature",
      "active Custom Code 03 section 6"
    ),
    lineRange("siteOverrides", 466, 480)
  ].join("\n\n"),
  "logos-designer.css": [
    banner(
      "Brand logos Designer state",
      "feature",
      "active Custom Code 03 section 7"
    ),
    lineRange("siteOverrides", 481, 490)
  ].join("\n\n"),
  "navigation.css": [
    banner(
      "Navigation details",
      "feature",
      "active Custom Code 03 section 8"
    ),
    lineRange("siteOverrides", 491, 502)
  ].join("\n\n"),
  "modal.css": [
    banner(
      "Modal state",
      "feature",
      "active Custom Code 03 global modal state and section 9"
    ),
    lineRange("siteOverrides", 78, 91),
    lineRange("siteOverrides", 503, 510)
  ].join("\n\n"),
  "lightbox.css": [
    banner(
      "Lightbox hover",
      "feature",
      "active Custom Code 03 section 10"
    ),
    lineRange("siteOverrides", 511, 531)
  ].join("\n\n"),
  "marquee.css": [
    banner(
      "Marquee animation",
      "feature",
      "active Custom Code 03 section 11"
    ),
    lineRange("siteOverrides", 532, 570)
  ].join("\n\n"),
  "grid-media.css": [
    banner(
      "Grid media",
      "feature",
      "active Custom Code 03 section 12"
    ),
    lineRange("siteOverrides", 570, 580)
  ].join("\n\n"),
  "rich-text.css": [
    banner(
      "Rich text",
      "feature",
      "active Custom Code 03 section 13"
    ),
    lineRange("siteOverrides", 581, 598)
  ].join("\n\n"),
  "marketo.css": [
    banner(
      "Marketo forms",
      "shared feature",
      "active Custom Code 04"
    ),
    lineRange("marketo", 2, 493)
  ].join("\n\n")
};

const featuresCss = [
  banner(
    "Feature bundle",
    "shared features",
    "concatenated Phase 3 feature modules in manifest order"
  ),
  ...Object.values(featureModules)
].join("\n\n");

const sharedJs = `/*
 * Pattern UK version split — shared runtime
 * Phase 5 rollout asset. Loaded only by the marker-based version loader.
 * Preserves the current pageFunctions registry and one-time DOM-ready runner.
 */
(function (global) {
  "use strict";

  global.pageFunctions = global.pageFunctions || {
    executed: {},
    functions: {},
    added: false,

    addFunction: function (id, fn) {
      if (!id || typeof fn !== "function") return;

      if (!this.functions[id]) {
        this.functions[id] = fn;
      }
    },

    executeFunctions: function () {
      if (this.added) return;
      this.added = true;

      for (var id in this.functions) {
        if (
          Object.prototype.hasOwnProperty.call(this.functions, id) &&
          !this.executed[id]
        ) {
          try {
            this.functions[id]();
            this.executed[id] = true;
          } catch (error) {
            console.error("Error executing page function " + id + ":", error);
          }
        }
      }
    }
  };

  function runPageFunctions() {
    if (
      global.pageFunctions &&
      typeof global.pageFunctions.executeFunctions === "function"
    ) {
      global.pageFunctions.executeFunctions();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runPageFunctions, {
      once: true
    });
  } else {
    runPageFunctions();
  }
})(window);
`;

const v1Js = `/*
 * Pattern UK version split — V1 runtime
 * Phase 5 rollout asset. Loaded only for data-pattern-version="v1".
 * The Phase 1 audit found no JavaScript that is exclusively V1.
 */
"use strict";
`;

const v2Js = `/*
 * Pattern UK version split — V2 runtime
 * Phase 5 rollout asset. Loaded only for data-pattern-version="v2".
 * The Phase 1 audit found no JavaScript that is exclusively V2.
 */
"use strict";
`;

const externalAssets = {
  schemaVersion: 1,
  active: true,
  note: "Phase 5 rollout inventory. JavaScript feature entries are compiled into js/loader.js.",
  shared: [
    {
      id: "consentpro",
      location: "head",
      url: "https://api.consentpro.com/v2/cdn/runtime/684987756493653cc7c5a406.js"
    },
    {
      id: "marketo-forms2",
      location: "head",
      url: "https://go.pattern.com/js/forms2/js/forms2.min.js"
    },
    {
      id: "nav-css",
      location: "head",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/styles/nav.css"
    },
    {
      id: "nav-js",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/nav/nav.js"
    }
  ],
  features: [
    {
      id: "splide-css",
      selector: ".splide",
      location: "head",
      url: "https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/css/splide.min.css"
    },
    {
      id: "splide-js",
      selector: ".splide",
      location: "footer",
      url: "https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js"
    },
    {
      id: "pagination-css",
      selector: "[class*='pagination']",
      location: "head",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/styles/pagination-fix.css"
    },
    {
      id: "pagination-js",
      selector: "[class*='pagination']",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/pagination-fix.js"
    },
    {
      id: "video-popup",
      selector: "[class*='video_popup'], [data-video-popup]",
      location: "head",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/media/video-popup.js"
    },
    {
      id: "logos",
      selector: "[class*='logo']",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/logos.js"
    },
    {
      id: "rich-text-heading-conversion",
      selector: ".w-richtext",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/rich-text-heading-conversion.js"
    },
    {
      id: "faq-schema",
      selector: "[class*='faq']",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/schema/faq-schema-generator.js"
    },
    {
      id: "accordion",
      selector: '[data-accordion-list], [class*="accordion_list"]',
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/accordion.js"
    },
    {
      id: "lazy-load",
      selector: "[loading='lazy'], [data-src]",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/lazy-load.js"
    },
    {
      id: "cta-inject",
      requiredSelectors: [
        '[fs-inject-element="target"]',
        '[fs-inject-element="element"]'
      ],
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/content/cta-inject.js"
    },
    {
      id: "iframe-popup",
      selector: "[data-iframe-popup], [class*='iframe_popup']",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.2/webflow/pattern.com/scripts/media/iframe-popup.js"
    },
    {
      id: "card-load-animations",
      selector: "[class*='card']",
      location: "footer",
      url: "https://cdn.jsdelivr.net/gh/specterstudio/pattern@v1.0.8/webflow/pattern.com/scripts/interaction/card-load-animations-v10.js"
    }
  ]
};

const loaderJs = `/*
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
      phase: ${release.phase},
      release: "${release.version}",
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
        phase: ${release.phase},
        release: "${release.version}",
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
    phase: ${release.phase},
    release: "${release.version}",
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

  var featureScripts = ${JSON.stringify(
    externalAssets.features
      .filter((asset) => asset.url.endsWith(".js"))
      .map(({ id, requiredSelectors, selector, url }) => ({
        id,
        ...(requiredSelectors ? { requiredSelectors } : { selector }),
        url
      })),
    null,
    2
  )};

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
          phase: ${release.phase},
          release: "${release.version}",
          status: state.status,
          version: version,
          loaded: state.loaded.slice(),
          skipped: state.skipped.slice(),
          failed: state.failed.slice()
        }
      }));
    });
})(window, document);
`;

const componentEmbeds = {
  "components/shared.html": `<!-- Pattern UK version split ${release.version} — Shared resource -->
<link rel="stylesheet" href="${cdnRoot}/css/shared.css" data-pattern-version-split="${release.version}" data-pattern-split-asset="shared">
<link rel="stylesheet" href="${cdnRoot}/css/features.css" data-pattern-version-split="${release.version}" data-pattern-split-asset="features">`,
  "components/v1.html": `<!-- Pattern UK version split ${release.version} — V1 resource -->
<link rel="stylesheet" href="${cdnRoot}/css/v1.css" data-pattern-version-split="${release.version}" data-pattern-split-asset="v1">`,
  "components/v2.html": `<!-- Pattern UK version split ${release.version} — V2 resource -->
<link rel="stylesheet" href="${cdnRoot}/css/v2.css" data-pattern-version-split="${release.version}" data-pattern-split-asset="v2">`
};

const packageManifest = {
  schemaVersion: 1,
  phase: release.phase,
  release: release.version,
  tag: release.tag,
  active: true,
  pilotOnly: false,
  rolloutReady: true,
  marker: {
    attribute: "data-pattern-version",
    values: ["v1", "v2"]
  },
  loadOrder: ["Shared component CSS", "version component CSS", "shared JS", "version JS", "feature JS"],
  css: {
    shared: "css/shared.css",
    featuresBundle: "css/features.css",
    versions: {
      v1: "css/v1.css",
      v2: "css/v2.css"
    },
    features: Object.keys(featureModules).map(
      (name) => `css/features/${name}`
    )
  },
  js: {
    loader: "js/loader.js",
    shared: "js/shared.js",
    versions: {
      v1: "js/v1.js",
      v2: "js/v2.js"
    }
  },
  designerComponents: {
    order: ["shared", "version"],
    shared: {
      name: "Custom Code / Shared",
      source: "components/shared.html",
      assets: ["css/shared.css", "css/features.css"]
    },
    v1: {
      name: "Custom Code / V1",
      source: "components/v1.html",
      assets: ["css/v1.css"]
    },
    v2: {
      name: "Custom Code / V2",
      source: "components/v2.html",
      assets: ["css/v2.css"]
    }
  },
  externalAssets: "external-assets.json"
};

function countBraces(content) {
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  let balance = 0;
  let quote = null;
  let escaped = false;

  for (const character of withoutComments) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") balance += 1;
    if (character === "}") balance -= 1;
    if (balance < 0) return balance;
  }

  return balance;
}

const files = new Map([
  ["css/shared.css", sharedCss],
  ["css/v1.css", v1Css],
  ["css/v2.css", v2Css],
  ["css/features.css", featuresCss],
  ...Object.entries(featureModules).map(([name, value]) => [
    `css/features/${name}`,
    value
  ]),
  ["js/loader.js", loaderJs.trim()],
  ["js/shared.js", sharedJs.trim()],
  ["js/v1.js", v1Js.trim()],
  ["js/v2.js", v2Js.trim()],
  ...Object.entries(componentEmbeds),
  ["external-assets.json", JSON.stringify(externalAssets, null, 2)],
  ["manifest.json", JSON.stringify(packageManifest, null, 2)]
]);

const validation = {
  generatedAt: new Date().toISOString(),
  phase: release.phase,
  release: release.version,
  tag: release.tag,
  active: true,
  pilotOnly: false,
  rolloutReady: true,
  checks: [],
  files: []
};

for (const [relativePath, content] of files) {
  const normalized = `${content.trim()}\n`;
  const targetPath = resolve(packageRoot, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, normalized, "utf8");

  validation.files.push({
    path: relativePath,
    bytes: Buffer.byteLength(normalized),
    sha256: createHash("sha256").update(normalized).digest("hex")
  });

  if (relativePath.endsWith(".css")) {
    validation.checks.push({
      check: `${relativePath}: no style tags`,
      passed: !/<\/?style\b/i.test(normalized)
    });
    validation.checks.push({
      check: `${relativePath}: balanced braces`,
      passed: countBraces(normalized) === 0
    });
  }
}

validation.checks.push(
  {
    check: "V1 CSS contains no page_code_wrap signal",
    passed: !files.get("css/v1.css").includes(".page_code_wrap")
  },
  {
    check: "V1 CSS contains explicit v1 marker",
    passed: files.get("css/v1.css").includes('[data-pattern-version="v1"]')
  },
  {
    check: "V2 CSS contains explicit v2 marker",
    passed: files.get("css/v2.css").includes('[data-pattern-version="v2"]')
  },
  {
    check: "V2 CSS excludes the duplicated V1 grid root",
    passed: !files.get("css/v2.css").includes("--site--column-count")
  },
  {
    check: "Shared CSS owns unsuffixed container tokens required by shared Header and Footer",
    passed:
      files.get("css/shared.css").includes("--site--column-count: 12;") &&
      files.get("css/shared.css").includes("--container--main:") &&
      files.get("css/shared.css").includes("--column-width--12:")
  },
  {
    check: "Shared CSS owns unsuffixed grid aliases required by shared Header and Footer",
    passed:
      files.get("css/shared.css").includes("--grid-3:") &&
      files.get("css/shared.css").includes("--grid-12:")
  },
  {
    check: "Shared CSS owns fluid aliases required by shared Header and Footer",
    passed:
      files.get("css/shared.css").includes("--type-size--h6:") &&
      files.get("css/shared.css").includes(
        "--site--margin: clamp(1.5rem, 0.38571428571428573rem + 4.571428571428571vw, 4.5rem);"
      ) &&
      files.get("css/shared.css").includes(
        "--_buttons---button--font-size:"
      ) &&
      !files.get("css/v1.css").includes(
        "--type-size--h6: clamp(1.5rem, 1.3142857142857143rem + 0.7619047619047619vw, 2rem);"
      )
  },
  {
    check: "Optional V1 production-fidelity boundary still requires cc-v1",
    passed:
      files.get("css/v1.css").includes(".page_main.cc-v1 {") &&
      !files.get("css/v1.css").includes(
        '[data-pattern-version="v1"] {\n  --site--column-count: 12;'
      )
  },
  {
    check: "Shared CSS owns semantic positioning required by shared Header and Footer",
    passed:
      files.get("css/shared.css").includes("section,") &&
      files.get("css/shared.css").includes("header,") &&
      files.get("css/shared.css").includes("footer {") &&
      files.get("css/shared.css").includes("position: relative;")
  },
  {
    check: "V1 CSS excludes the extracted generic compatibility foundation",
    passed: !files
      .get("css/v1.css")
      .includes('[data-pattern-version="v1"]))) footer')
  },
  {
    check: "Shared Marketo feature keeps rendered-form scope",
    passed: files
      .get("css/features/marketo.css")
      .includes('.mktoForm[id^="mktoForm_"]')
  },
  {
    check: "Feature bundle includes every feature module",
    passed: Object.values(featureModules).every((moduleCss) =>
      files.get("css/features.css").includes(moduleCss)
    )
  },
  {
    check: "Permanent loader activates from the explicit version marker",
    passed: files
      .get("js/loader.js")
      .includes('querySelectorAll("[data-pattern-version]")')
  },
  {
    check: "Permanent loader contains no Phase 4 pilot gate",
    passed: !files
      .get("js/loader.js")
      .includes("data-pattern-asset-pilot")
  },
  {
    check: "Shared Designer component owns Shared and Features links",
    passed:
      files.get("components/shared.html").includes("/css/shared.css") &&
      files.get("components/shared.html").includes("/css/features.css")
  },
  {
    check: "Version Designer components own only their matching CSS",
    passed:
      files.get("components/v1.html").includes("/css/v1.css") &&
      !files.get("components/v1.html").includes("/css/v2.css") &&
      files.get("components/v2.html").includes("/css/v2.css") &&
      !files.get("components/v2.html").includes("/css/v1.css")
  },
  {
    check: "Manifest is Phase 5 rollout-ready and not pilot-only",
    passed:
      packageManifest.phase === 5 &&
      packageManifest.rolloutReady === true &&
      packageManifest.pilotOnly === false
  },
  {
    check: "All generated structural checks passed",
    passed: true
  }
);

const failedChecks = validation.checks.filter((check) => !check.passed);
validation.checks.at(-1).passed = failedChecks.length === 0;

await writeFile(
  resolve(packageRoot, "validation.json"),
  `${JSON.stringify(validation, null, 2)}\n`,
  "utf8"
);

if (failedChecks.length > 0) {
  console.error(JSON.stringify({ failedChecks }, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        generatedFiles: files.size,
        cssFiles: [...files.keys()].filter((path) => path.endsWith(".css")).length,
        jsFiles: [...files.keys()].filter((path) => path.endsWith(".js")).length,
        checks: validation.checks.length,
        failedChecks: 0
      },
      null,
      2
    )
  );
}
