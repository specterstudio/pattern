/**
 * Card Load Animation Library | Pattern Library V2
 * Version: 10
 *
 * ATTRIBUTES
 * ---------------------------------------------------------------------------
 * [card-grid]             Grid component wrapper - groups cards, ScrollTrigger
 * [card-load="drop-in"]   .s_card_number - whole unit clips in from above
 * [card-load="fade-in"]   .s_card_number - char stagger from below
 * [card-load="count-up"]  .cs_stat_card_heading - odometer slot-machine spin
 *
 * COUNT-UP TARGET RESOLUTION
 *   1. [stat-count-up] child -> Case Study / Stat Card
 *   2. .u-text span          -> Card / Stat
 *   3. element itself        -> fallback
 *
 * DEPENDENCIES: GSAP + ScrollTrigger + optional SplitText via Webflow GSAP module
 *
 * PERFORMANCE NOTES
 *   - Safe to load globally: exits immediately when no [card-load] targets exist.
 *   - Lazily initializes each [card-grid] only when it is near the viewport.
 *   - Preserves the existing attribute contract for Webflow authors.
 */

(function () {
  "use strict";

  const CFG = {
    scrollStart: "top 78%",
    observerRootMargin: "600px 0px",
    idleTimeout: 1500,
    cardStagger: 0.12,
    dropIn: { duration: 0.65, ease: "power3.out" },
    fadeIn: {
      duration: 0.55,
      charStagger: 0.03,
      ease: "power2.out",
      yOffset: 16,
    },
    countUp: {
      totalDuration: 1.4,
      ease: "power3.out",
      // Delay offset per column indexed by distance-from-right (0=ones, 1=tens, ...)
      // All columns end at totalDuration simultaneously.
      colDelayOffsets: [0, 0.18, 0.38, 0.55],
    },
  };

  function init() {
    const grids = findTargetGrids();
    if (!grids.length) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      grids.forEach(revealGrid);
      return;
    }

    if (typeof window.gsap === "undefined" || typeof window.ScrollTrigger === "undefined") {
      console.warn("[card-load] GSAP / ScrollTrigger not found.");
      grids.forEach(revealGrid);
      return;
    }

    window.gsap.registerPlugin(window.ScrollTrigger);
    if (typeof window.SplitText !== "undefined") {
      window.gsap.registerPlugin(window.SplitText);
    }

    observeGrids(grids);
  }

  function findTargetGrids() {
    if (!document.querySelector("[card-load]")) return [];

    return Array.from(document.querySelectorAll("[card-grid]")).filter((grid) =>
      grid.querySelector("[card-load]")
    );
  }

  function observeGrids(grids) {
    if (!("IntersectionObserver" in window)) {
      grids.forEach(initGrid);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          initGrid(entry.target);
        });
      },
      { rootMargin: CFG.observerRootMargin, threshold: 0 }
    );

    grids.forEach((grid) => observer.observe(grid));
  }

  function initGrid(grid) {
    if (!grid || grid.dataset.cardGridInit === "true") return;
    grid.dataset.cardGridInit = "true";

    const cards = Array.from(grid.querySelectorAll("[card-load]"));
    if (!cards.length) return;

    const animFns = cards.map(buildAnim).filter(Boolean);
    if (!animFns.length) {
      revealElements(cards);
      return;
    }

    window.ScrollTrigger.create({
      trigger: grid,
      start: CFG.scrollStart,
      once: true,
      onEnter: () => animFns.forEach((fn, i) => fn(i * CFG.cardStagger)),
    });
  }

  function revealGrid(grid) {
    revealElements(Array.from(grid.querySelectorAll("[card-load]")));
  }

  function revealElements(elements) {
    elements.forEach((el) => {
      el.style.opacity = "";
      el.style.visibility = "";
      el.style.transform = "";
      el.style.translate = "";
      el.style.rotate = "";
      el.style.scale = "";
    });
  }

  function resolveTarget(el) {
    return (
      el.querySelector("[stat-count-up]") ||
      el.querySelector(".u-text span") ||
      el.querySelector(".u-text") ||
      el
    );
  }

  function buildAnim(el) {
    const type = el.getAttribute("card-load");
    const target = resolveTarget(el);

    if (type === "drop-in") return buildDropIn(el, target);
    if (type === "fade-in") return buildFadeIn(el, target);
    if (type === "count-up") return buildCountUp(el, target);

    console.warn("[card-load] Unknown type:", type);
    return null;
  }

  function buildDropIn(el, target) {
    const clipEl = target.parentElement || el;

    clipEl.style.overflow = "clip";
    window.gsap.set(target, { y: "-100%", opacity: 0 });

    return (delay) => {
      window.gsap.to(target, {
        y: "0%",
        opacity: 1,
        duration: CFG.dropIn.duration,
        delay,
        ease: CFG.dropIn.ease,
        onComplete() {
          clipEl.style.overflow = "";
          clearMotionStyles(target);
          target.style.opacity = "";
        },
      });
    };
  }

  function buildFadeIn(el, target) {
    const hasGradientClip = hasGradientClipAncestor(el);

    if (typeof window.SplitText === "undefined") {
      window.gsap.set(target, { opacity: 0, y: CFG.fadeIn.yOffset });
      return (delay) =>
        window.gsap.to(target, {
          opacity: 1,
          y: 0,
          duration: CFG.fadeIn.duration,
          delay,
          ease: CFG.fadeIn.ease,
          onComplete() {
            clearMotionStyles(target);
            target.style.opacity = "";
          },
        });
    }

    if (hasGradientClip) {
      window.gsap.set(target, { opacity: 0 });
      return (delay) =>
        window.gsap.to(target, {
          opacity: 1,
          duration: CFG.fadeIn.duration,
          delay,
          ease: CFG.fadeIn.ease,
          onComplete() {
            target.style.opacity = "";
          },
        });
    }

    const split = new window.SplitText(target, { type: "chars", charsClass: "cl-char" });

    // Keep display:inline-block after animation so Lumos .u-text > * width rules
    // do not turn each character into a full-width block.
    window.gsap.set(split.chars, {
      display: "inline-block",
      opacity: 0,
      y: CFG.fadeIn.yOffset,
    });

    return (delay) => {
      window.gsap.to(split.chars, {
        opacity: 1,
        y: 0,
        duration: CFG.fadeIn.duration,
        delay,
        ease: CFG.fadeIn.ease,
        stagger: { each: CFG.fadeIn.charStagger, from: "start" },
        onComplete() {
          split.chars.forEach((ch) => {
            clearMotionStyles(ch);
            ch.style.opacity = "";
          });
        },
      });
    };
  }

  function hasGradientClipAncestor(el) {
    let node = el.parentElement;

    while (node && !hasClassContaining(node, "stat_card_wrap")) {
      const styles = getComputedStyle(node);
      if (styles.backgroundClip === "text" || styles.webkitBackgroundClip === "text") {
        return true;
      }
      node = node.parentElement;
    }

    return false;
  }

  function hasClassContaining(el, value) {
    return Array.from(el.classList || []).some((className) => className.includes(value));
  }

  function buildCountUp(el, target) {
    const originalText = target.textContent.trim();
    const { tokens, hasDigits } = tokenize(originalText);
    if (!hasDigits) return null;

    target.textContent = "";
    target.style.display = "inline-flex";
    target.style.flexDirection = "row";
    target.style.flexWrap = "nowrap";
    target.style.alignItems = "baseline";
    target.style.whiteSpace = "nowrap";

    const reelJobs = [];

    tokens.forEach((token) => {
      if (token.type === "static") {
        const span = document.createElement("span");
        span.textContent = token.value;
        span.style.display = "inline-block";
        span.style.flex = "0 0 auto";
        span.style.width = "auto";
        span.style.whiteSpace = "pre";
        target.appendChild(span);
        return;
      }

      const run = token.digits;
      const digitCount = run.length;

      run.forEach((targetDigit, i) => {
        const posFromRight = digitCount - 1 - i;
        const wrapper = document.createElement("span");
        const reel = document.createElement("span");

        wrapper.style.display = "inline-block";
        wrapper.style.flex = "0 0 1ch";
        wrapper.style.overflow = "hidden";
        wrapper.style.width = "1ch";
        wrapper.style.height = "1em";
        wrapper.style.verticalAlign = "text-bottom";
        wrapper.style.textAlign = "center";

        reel.style.display = "flex";
        reel.style.flexDirection = "column";
        reel.style.transform = "translateY(0)";

        for (let d = 0; d <= targetDigit; d++) {
          const cell = document.createElement("span");
          cell.textContent = String(d);
          cell.style.display = "block";
          cell.style.height = "1em";
          cell.style.lineHeight = "1";
          cell.style.textAlign = "center";
          reel.appendChild(cell);
        }

        wrapper.appendChild(reel);
        target.appendChild(wrapper);

        if (targetDigit > 0) {
          reelJobs.push({ reel, targetDigit, posFromRight });
        }
      });
    });

    return (baseDelay) => {
      reelJobs.forEach(({ reel, targetDigit, posFromRight }) => {
        const offset =
          CFG.countUp.colDelayOffsets[
            Math.min(posFromRight, CFG.countUp.colDelayOffsets.length - 1)
          ];
        const duration = CFG.countUp.totalDuration - offset;
        const ticker = { v: 0 };

        window.gsap.to(ticker, {
          v: targetDigit,
          duration,
          delay: baseDelay + offset,
          ease: CFG.countUp.ease,
          onUpdate() {
            reel.style.transform = `translateY(calc(${-ticker.v} * 1em))`;
          },
          onComplete() {
            reel.style.transform = `translateY(calc(${-targetDigit} * 1em))`;
          },
        });
      });
    };
  }

  function tokenize(text) {
    const tokens = [];
    const regex = /\d+/g;
    let lastIdx = 0;
    let hasDigits = false;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        tokens.push({ type: "static", value: text.slice(lastIdx, match.index) });
      }

      tokens.push({ type: "digits", digits: match[0].split("").map(Number) });
      hasDigits = true;
      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
      tokens.push({ type: "static", value: text.slice(lastIdx) });
    }

    return { tokens, hasDigits };
  }

  function clearMotionStyles(el) {
    el.style.transform = "";
    el.style.translate = "";
    el.style.rotate = "";
    el.style.scale = "";
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
