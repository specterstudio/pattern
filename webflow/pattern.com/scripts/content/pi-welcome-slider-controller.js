/*
 * Pattern Intelligence feature slider
 *
 * Keeps every authored slide and Webflow code component mounted. Transitions
 * animate the visual, title, body, and CTA independently, then replay only the
 * active Pi scene. No slide markup is cloned or replaced.
 */
(function () {
  "use strict";

  function portableClassSelector(className) {
    return [
      `[class~="${className}"]`,
      `[class*="--${className} "]`,
      `[class$="--${className}"]`
    ].join(",");
  }

  const rootSelector = portableClassSelector("pi_feature_slider_wrap");
  const slideSelector = portableClassSelector("pi_feature_slide_wrap");
  const controlSelector = portableClassSelector("pi_feature_slider_button");
  const statusSelector = portableClassSelector("pi_feature_slider_status");
  const listSelector = portableClassSelector("pi_feature_slider_list");
  const controlsSelector = portableClassSelector("pi_feature_slider_controls");
  const copySelector = portableClassSelector("pi_feature_slide_copy_wrap");
  const titleSelector = [
    portableClassSelector("pi_feature_slide_title"),
    `:is(${copySelector}) > :first-child`
  ].join(",");
  const textSelector = [
    portableClassSelector("pi_feature_slide_text"),
    `:is(${copySelector}) > :nth-child(2)`
  ].join(",");
  const motionSelectors = [
    portableClassSelector("pi_feature_slide_visual_inner"),
    titleSelector,
    textSelector,
    portableClassSelector("pi_feature_slide_action")
  ];
  const swipeThreshold = 48;
  const state = window.PatternPiFeatureSlider = window.PatternPiFeatureSlider || {};

  if (!(state.instances instanceof WeakMap)) state.instances = new WeakMap();

  function getSlides(root) {
    return Array.from(root.querySelectorAll(slideSelector)).filter(
      (slide) => slide.closest(rootSelector) === root
    );
  }

  function getMotionElements(slide) {
    return motionSelectors
      .map((selector) => slide.querySelector(selector))
      .filter(Boolean);
  }

  function normalizeSlideLayout(slides) {
    const list = slides[0]?.closest(listSelector);
    if (!list) return;

    const host = Array.from(list.children).find((child) =>
      slides.every((slide) => child.contains(slide))
    ) || list;

    host.style.display = "grid";
    host.style.gridTemplateColumns = "minmax(0, 1fr)";
    slides.forEach((slide) => {
      let stageItem = slide;
      while (stageItem.parentElement && stageItem.parentElement !== host) {
        stageItem = stageItem.parentElement;
      }
      stageItem.style.gridArea = "1 / 1";
      stageItem.style.width = "100%";
      slide.style.gridArea = "1 / 1";
      slide.style.width = "100%";
    });
  }

  function getScenePlayers(slide) {
    const players = new Set(slide.querySelectorAll("pi-welcome-animation"));

    slide.querySelectorAll("code-island").forEach((island) => {
      island.shadowRoot
        ?.querySelectorAll("pi-welcome-animation")
        .forEach((player) => players.add(player));
    });

    return Array.from(players);
  }

  function setScenePlayback(slide, active, replay) {
    getScenePlayers(slide).forEach((player) => {
      if (active) {
        if (replay && typeof player.replay === "function") player.replay();
        else if (typeof player.play === "function") player.play();
      } else if (typeof player.pause === "function") {
        player.pause();
      }
    });
  }

  function observeSceneIslands(instance) {
    instance.slides.forEach((slide) => {
      slide.querySelectorAll("code-island").forEach((island) => {
        if (island.dataset.piFeatureObserved === "true") return;
        island.dataset.piFeatureObserved = "true";

        const connectObserver = () => {
          if (!island.shadowRoot) return false;

          const observer = new MutationObserver(() => {
            const active = instance.slides[instance.currentIndex] === slide;
            setScenePlayback(slide, active, false);
          });
          observer.observe(island.shadowRoot, { childList: true, subtree: true });
          instance.sceneObservers.push(observer);
          return true;
        };

        if (connectObserver()) return;

        let attempts = 0;
        const waitForShadowRoot = () => {
          attempts += 1;
          if (connectObserver() || attempts >= 120) return;
          window.requestAnimationFrame(waitForShadowRoot);
        };
        window.requestAnimationFrame(waitForShadowRoot);
      });
    });
  }

  function slideLabel(slide, index, length) {
    const title = slide.querySelector(titleSelector)?.textContent?.trim();
    const position = `Slide ${index + 1} of ${length}`;
    return title ? `${position}: ${title}` : position;
  }

  function hasDarkForeground(color) {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length < 3) return false;
    const [red, green, blue] = channels;
    return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
  }

  function syncTheme(instance) {
    const activeSlide = instance.slides[instance.currentIndex];
    if (!activeSlide) return;
    const foreground = window.getComputedStyle(activeSlide).color;
    instance.root.dataset.piFeatureTheme = hasDarkForeground(foreground)
      ? "light"
      : "dark";
  }

  function setSlideState(instance, index, active, replay) {
    const slide = instance.slides[index];
    if (!slide) return;

    slide.classList.toggle("is-active", active);
    slide.setAttribute("aria-hidden", String(!active));
    slide.setAttribute("aria-label", slideLabel(slide, index, instance.slides.length));
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.inert = !active;
    slide.style.opacity = active ? "1" : "0";
    slide.style.visibility = active ? "visible" : "hidden";
    slide.style.pointerEvents = active ? "auto" : "none";

    setScenePlayback(slide, active, replay);
  }

  function updateStatus(instance) {
    const text = `Slide ${instance.currentIndex + 1} of ${instance.slides.length}`;
    if (instance.status) instance.status.textContent = text;
    instance.root.setAttribute("aria-label", `Pattern Intelligence features, ${text}`);

    if (instance.previous) {
      const disabled = instance.busy || (!instance.loop && instance.currentIndex === 0);
      instance.previous.setAttribute("aria-disabled", String(disabled));
      instance.previous.tabIndex = disabled ? -1 : 0;
    }

    if (instance.next) {
      const disabled = instance.busy || (
        !instance.loop && instance.currentIndex === instance.slides.length - 1
      );
      instance.next.setAttribute("aria-disabled", String(disabled));
      instance.next.tabIndex = disabled ? -1 : 0;
    }
  }

  function setBusy(instance, busy) {
    instance.busy = busy;
    instance.root.setAttribute("aria-busy", String(busy));
    updateStatus(instance);
  }

  function move(instance, direction) {
    if (instance.busy || instance.slides.length < 2) return;

    const rawIndex = instance.currentIndex + direction;
    const nextIndex = instance.loop
      ? (rawIndex + instance.slides.length) % instance.slides.length
      : Math.max(0, Math.min(instance.slides.length - 1, rawIndex));

    if (nextIndex === instance.currentIndex) return;
    transitionTo(instance, nextIndex);
  }

  function transitionTo(instance, nextIndex) {
    const currentIndex = instance.currentIndex;
    const currentSlide = instance.slides[currentIndex];
    const nextSlide = instance.slides[nextIndex];
    if (!currentSlide || !nextSlide) return;

    instance.timeline?.kill();
    setBusy(instance, true);

    const swapSlides = () => {
      setSlideState(instance, currentIndex, false, false);
      instance.currentIndex = nextIndex;
      setSlideState(instance, nextIndex, true, true);
      syncTheme(instance);
      updateStatus(instance);
    };

    if (instance.reduceMotion || !window.gsap) {
      swapSlides();
      setBusy(instance, false);
      restartAutoplay(instance);
      return;
    }

    const outgoing = getMotionElements(currentSlide);
    instance.timeline = window.gsap.timeline({
      onComplete() {
        swapSlides();

        const incoming = getMotionElements(nextSlide);
        window.gsap.set(incoming, { autoAlpha: 0, y: 24 });
        instance.timeline = window.gsap.timeline({
          onComplete() {
            window.gsap.set(incoming, { clearProps: "transform,opacity,visibility" });
            setSlideState(instance, nextIndex, true, false);
            setBusy(instance, false);
            restartAutoplay(instance);
          }
        });
        instance.timeline.to(incoming, {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: "power3.out"
        });
      }
    });
    instance.timeline.to(outgoing, {
      autoAlpha: 0,
      y: -8,
      duration: 0.16,
      stagger: 0.02,
      ease: "power1.in"
    });
  }

  function stopAutoplay(instance) {
    if (!instance.autoplayTimer) return;
    window.clearTimeout(instance.autoplayTimer);
    instance.autoplayTimer = 0;
  }

  function restartAutoplay(instance) {
    stopAutoplay(instance);
    if (!instance.autoplay || instance.reduceMotion || instance.paused) return;
    instance.autoplayTimer = window.setTimeout(() => move(instance, 1), instance.interval);
  }

  function bindControls(instance) {
    instance.previous?.addEventListener("click", (event) => {
      event.preventDefault();
      if (instance.previous.getAttribute("aria-disabled") === "true") return;
      move(instance, -1);
    });

    instance.next?.addEventListener("click", (event) => {
      event.preventDefault();
      if (instance.next.getAttribute("aria-disabled") === "true") return;
      move(instance, 1);
    });

    instance.root.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target?.matches?.("input, textarea, select, [contenteditable='true']")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      move(instance, event.key === "ArrowLeft" ? -1 : 1);
    });

    instance.root.addEventListener("pointerdown", (event) => {
      instance.pointerStart = event.clientX;
    }, { passive: true });

    instance.root.addEventListener("pointerup", (event) => {
      if (instance.pointerStart === null) return;
      const distance = event.clientX - instance.pointerStart;
      instance.pointerStart = null;
      if (Math.abs(distance) < swipeThreshold) return;
      move(instance, distance > 0 ? -1 : 1);
    }, { passive: true });

    instance.root.addEventListener("mouseenter", () => {
      instance.paused = true;
      stopAutoplay(instance);
    });

    instance.root.addEventListener("mouseleave", () => {
      instance.paused = false;
      restartAutoplay(instance);
    });

    instance.root.addEventListener("focusin", () => {
      instance.paused = true;
      stopAutoplay(instance);
    });

    instance.root.addEventListener("focusout", (event) => {
      if (instance.root.contains(event.relatedTarget)) return;
      instance.paused = false;
      restartAutoplay(instance);
    });
  }

  function initialize(root) {
    const slides = getSlides(root);
    if (!slides.length) return;

    normalizeSlideLayout(slides);

    if (state.instances.has(root)) {
      const instance = state.instances.get(root);
      instance.slides = slides;
      syncTheme(instance);
      return;
    }

    const controls = Array.from(root.querySelectorAll(controlSelector)).filter(
      (control) => control.closest(rootSelector) === root
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = Number.parseInt(root.dataset.piFeatureInterval || "8000", 10);
    const instance = {
      root,
      slides,
      previous: controls[0] || null,
      next: controls[1] || null,
      status: root.querySelector(statusSelector),
      currentIndex: 0,
      busy: false,
      loop: root.dataset.piFeatureLoop !== "false",
      autoplay: root.dataset.piFeatureAutoplay === "true",
      interval: Number.isFinite(interval) ? Math.max(3000, interval) : 8000,
      reduceMotion,
      paused: false,
      pointerStart: null,
      autoplayTimer: 0,
      timeline: null,
      sceneObservers: []
    };

    state.instances.set(root, instance);
    root.dataset.piFeatureSliderInitialized = "true";
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");

    slides.forEach((slide, index) => setSlideState(instance, index, index === 0, index === 0));
    syncTheme(instance);

    if (slides.length < 2) {
      root.querySelector(controlsSelector)?.setAttribute("hidden", "");
    }

    observeSceneIslands(instance);
    bindControls(instance);
    updateStatus(instance);
    restartAutoplay(instance);
  }

  function initializeAll(scope) {
    const roots = [];
    if (scope?.matches?.(rootSelector)) roots.push(scope);
    scope?.querySelectorAll?.(rootSelector).forEach((root) => roots.push(root));
    roots.forEach(initialize);
  }

  function syncDocumentVisibility() {
    document.querySelectorAll(rootSelector).forEach((root) => {
      const instance = state.instances.get(root);
      if (!instance) return;

      const activeSlide = instance.slides[instance.currentIndex];
      if (document.hidden) {
        stopAutoplay(instance);
        setScenePlayback(activeSlide, false, false);
      } else {
        setScenePlayback(activeSlide, true, true);
        restartAutoplay(instance);
      }
    });
  }

  function boot() {
    initializeAll(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) initializeAll(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("visibilitychange", syncDocumentVisibility);
    customElements.whenDefined("pi-welcome-animation").then(() => {
      document.querySelectorAll(rootSelector).forEach((root) => {
        const instance = state.instances.get(root);
        if (!instance) return;
        instance.slides.forEach((slide, index) => {
          setScenePlayback(slide, index === instance.currentIndex, index === instance.currentIndex);
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
