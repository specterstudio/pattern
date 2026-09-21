(() => {
  "use strict";

  const script = document.currentScript;
  const component = script?.closest('[data-page-anchor="component"]');

  if (!component || component.dataset.pageAnchorInitialized === "true") return;

  const viewport = component.querySelector('[data-page-anchor="viewport"]');
  const track = component.querySelector('[data-page-anchor="track"]');
  const items = track
    ? Array.from(track.querySelectorAll('[data-page-anchor="item"]'))
    : [];

  if (!viewport || !track || items.length < 2) return;

  component.dataset.pageAnchorInitialized = "true";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const parsedDelay = Number.parseFloat(component.dataset.pageAnchorDelay || "4");
  const delay = Math.max(Number.isFinite(parsedDelay) ? parsedDelay : 4, 1) * 1000;

  let activeIndex = 0;
  let focusInside = false;
  let pointerDown = false;
  let pointerInside = false;
  let programmaticIndex = null;
  let scrollFrame = 0;
  let scrollTimer = 0;
  let timer = 0;

  const isMobile = () => window.getComputedStyle(track).display === "flex";

  const autoplayEnabled = () =>
    component.dataset.pageAnchorAutoplay !== "false";

  const isPaused = () =>
    !autoplayEnabled() ||
    !isMobile() ||
    reducedMotion.matches ||
    document.hidden ||
    focusInside ||
    pointerDown ||
    pointerInside;

  const clearTimer = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = 0;
  };

  const setActive = (nextIndex) => {
    activeIndex = nextIndex;
    items.forEach((item, index) => {
      item.classList.toggle("is-active", index === activeIndex);
    });
  };

  const nearestIndex = () => {
    let nextIndex = 0;
    let shortestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item, index) => {
      const distance = Math.abs(item.offsetLeft - viewport.scrollLeft);
      if (distance >= shortestDistance) return;
      shortestDistance = distance;
      nextIndex = index;
    });

    return nextIndex;
  };

  const moveTo = (nextIndex) => {
    const item = items[nextIndex];
    if (!item) return;

    programmaticIndex = nextIndex;
    setActive(nextIndex);
    viewport.scrollTo({
      behavior: reducedMotion.matches ? "auto" : "smooth",
      left: item.offsetLeft,
      top: 0,
    });
  };

  const schedule = () => {
    clearTimer();
    if (isPaused()) return;

    timer = window.setTimeout(() => {
      moveTo((activeIndex + 1) % items.length);
      schedule();
    }, delay);
  };

  const scheduleAfterInteraction = () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      if (programmaticIndex !== null) {
        setActive(nearestIndex());
        programmaticIndex = null;
      }
      schedule();
    }, 180);
  };

  const updateFromScroll = () => {
    if (scrollFrame) return;

    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      setActive(programmaticIndex ?? nearestIndex());
      scheduleAfterInteraction();
    });
  };

  const resetForLayout = () => {
    clearTimer();

    if (!isMobile()) {
      programmaticIndex = null;
      setActive(0);
      viewport.scrollTo({ behavior: "auto", left: 0, top: 0 });
    }

    schedule();
  };

  component.addEventListener("pointerenter", () => {
    pointerInside = true;
    clearTimer();
  });

  component.addEventListener("pointerleave", () => {
    pointerInside = false;
    pointerDown = false;
    schedule();
  });

  component.addEventListener("pointerdown", () => {
    programmaticIndex = null;
    pointerDown = true;
    clearTimer();
  });

  component.addEventListener("pointerup", () => {
    pointerDown = false;
    schedule();
  });

  component.addEventListener("pointercancel", () => {
    pointerDown = false;
    schedule();
  });

  component.addEventListener("focusin", () => {
    focusInside = true;
    clearTimer();
  });

  component.addEventListener("focusout", (event) => {
    if (component.contains(event.relatedTarget)) return;
    focusInside = false;
    schedule();
  });

  viewport.addEventListener("scroll", updateFromScroll, { passive: true });
  window.addEventListener("resize", resetForLayout);
  document.addEventListener("visibilitychange", schedule);
  reducedMotion.addEventListener("change", resetForLayout);

  const resizeObserver = new ResizeObserver(resetForLayout);
  resizeObserver.observe(viewport);
  resizeObserver.observe(track);

  setActive(0);
  schedule();
})();
