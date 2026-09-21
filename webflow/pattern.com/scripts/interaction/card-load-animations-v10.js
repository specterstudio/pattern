/**
 * Card Load Animation Loader | Pattern Library V2
 * Version: 10
 *
 * Keep this file safe to load globally. It only fetches the full animation
 * library when the page actually has [card-load] targets inside [card-grid].
 */

(function () {
  "use strict";

  const CFG = {
    selector: "[card-grid]",
    targetSelector: "[card-load]",
    fullScriptSuffix: ".full.js",
    observerRootMargin: "600px 0px",
    idleTimeout: 1500,
  };

  let loaded = false;

  function init() {
    const grids = findTargetGrids();
    if (!grids.length) return;

    observeGrids(grids);
  }

  function findTargetGrids() {
    if (!document.querySelector(CFG.targetSelector)) return [];

    return Array.from(document.querySelectorAll(CFG.selector)).filter((grid) =>
      grid.querySelector(CFG.targetSelector)
    );
  }

  function observeGrids(grids) {
    if (!("IntersectionObserver" in window)) {
      loadFullScript();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (loaded) {
          observer.disconnect();
          return;
        }

        if (!entries.some((entry) => entry.isIntersecting)) return;

        observer.disconnect();
        loadFullScript();
      },
      { rootMargin: CFG.observerRootMargin, threshold: 0 }
    );

    grids.forEach((grid) => observer.observe(grid));
  }

  function loadFullScript() {
    if (loaded) return;
    loaded = true;

    const currentScript = document.currentScript || findCurrentScript();
    const src = currentScript && currentScript.src ? getFullScriptSrc(currentScript.src) : "";

    if (!src) return;

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.cardLoadFull = "true";

    document.head.appendChild(script);
  }

  function findCurrentScript() {
    const scripts = Array.from(document.scripts);

    return scripts.find((script) =>
      /card-load-animations-v10(?:\.min)?\.js(?:[?#].*)?$/.test(script.src || "")
    );
  }

  function getFullScriptSrc(src) {
    return src.replace(/(?:\.min)?\.js([?#].*)?$/, `${CFG.fullScriptSuffix}$1`);
  }

  function scheduleInit() {
    const run = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(init, { timeout: CFG.idleTimeout });
      } else {
        window.setTimeout(init, 250);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  scheduleInit();
})();
