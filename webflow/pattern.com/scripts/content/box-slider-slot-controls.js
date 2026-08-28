(function () {
  "use strict";

  const STYLE_ID = "pattern-box-slider-slot-motion-styles";
  const MAX_SLIDES = 5;
  const SWIPE_THRESHOLD = 48;
  const LEGACY_VERSIONS = new Set(["v1", "v2", "v2l"]);

  const PARENT_SELECTOR = [
    '[class~="slider_wrap"]',
    '[class*="--slider_wrap "]',
    '[class$="--slider_wrap"]'
  ].join(", ");
  const LIST_SELECTOR = [
    '[class~="slider_list"]',
    '[class*="--slider_list "]',
    '[class$="--slider_list"]'
  ].join(", ");
  const ELEMENT_SELECTOR = [
    '[class~="slider_element"]',
    '[class*="--slider_element "]',
    '[class$="--slider_element"]'
  ].join(", ");
  const SLIDE_SELECTOR = [
    '[class~="box_slider_wrap"]',
    '[class*="--box_slider_wrap "]',
    '[class$="--box_slider_wrap"]'
  ].join(", ");
  const CONTROLS_SELECTOR = [
    '[class~="box_slider_controls"]',
    '[class*="--box_slider_controls "]',
    '[class$="--box_slider_controls"]',
    '[data-case-study-controls]'
  ].join(", ");
  const PREVIOUS_SELECTOR =
    '[data-box-slider-prev], [data-case-study-prev], [data-slider="previous"]';
  const NEXT_SELECTOR =
    '[data-box-slider-next], [data-case-study-next], [data-slider="next"]';
  const MOTION_SELECTORS = [
    '[class*="box_slider_visual"]',
    '[class*="box_slider_icon"]',
    '[class*="box_slider_heading"]',
    '[class*="box_slider_text"]',
    '[class*="box_slider_stat"]'
  ];
  const READY_SELECTOR = "[data-box-slider-slots-ready]";

  function scopeSelectors(selectorList, suffix = "") {
    return selectorList
      .split(", ")
      .map((selector) => `${READY_SELECTOR} ${selector}${suffix}`)
      .join(",\n");
  }

  const state = window.PatternBoxSliderSlots = window.PatternBoxSliderSlots || {};
  if (!(state.instances instanceof WeakMap)) state.instances = new WeakMap();
  if (!(state.controls instanceof WeakMap)) state.controls = new WeakMap();

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      ${scopeSelectors(LIST_SELECTOR)} {
        transform: none !important;
        transition-duration: 0ms !important;
      }

      [data-box-slider-slots-ready] [data-box-slider-stage] {
        width: 100% !important;
        flex-basis: 100% !important;
      }

      [data-box-slider-slots-ready] [data-box-slider-source] {
        display: none !important;
      }

      ${scopeSelectors(ELEMENT_SELECTOR)} {
        touch-action: pan-y;
      }

      ${scopeSelectors(CONTROLS_SELECTOR, "[hidden]")} {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findParents(scope) {
    const parents = new Set();
    const root = scope || document;

    if (root.matches?.(PARENT_SELECTOR) && root.querySelector(SLIDE_SELECTOR)) {
      parents.add(root);
    }

    root.querySelectorAll?.(SLIDE_SELECTOR).forEach((slide) => {
      const parent = slide.closest(PARENT_SELECTOR);
      if (parent) parents.add(parent);
    });

    return Array.from(parents);
  }

  function getSlides(parent) {
    const list = parent.querySelector(LIST_SELECTOR);
    if (!list) return [];

    const directSlides = Array.from(list.children).filter((child) =>
      child.matches(SLIDE_SELECTOR)
    );
    if (directSlides.length) return directSlides;

    return Array.from(list.querySelectorAll(SLIDE_SELECTOR)).filter(
      (slide) => slide.closest(PARENT_SELECTOR) === parent
    );
  }

  function getSwiper(parent) {
    return parent.querySelector(ELEMENT_SELECTOR)?.swiper || null;
  }

  function getMotionElements(slide) {
    return MOTION_SELECTORS.map((selector) => slide.querySelector(selector)).filter(Boolean);
  }

  function cleanSlideClassName(className) {
    return String(className || "")
      .split(/\s+/)
      .filter(Boolean)
      .filter((name) => name !== "is-active" && !name.startsWith("swiper-slide-"))
      .join(" ");
  }

  function captureRecord(slide) {
    const clone = slide.cloneNode(true);
    clone.querySelectorAll("[data-box-slider-slot-control-ready]").forEach((control) => {
      control.removeAttribute("data-box-slider-slot-control-ready");
      control.removeAttribute("aria-disabled");
    });

    return {
      className: cleanSlideClassName(slide.className),
      variantAttributes: Array.from(slide.attributes)
        .filter((attribute) =>
          attribute.name.startsWith("data-wf--slider-alt-slide--")
        )
        .map((attribute) => [attribute.name, attribute.value]),
      html: clone.innerHTML
    };
  }

  function applyRecord(instance, index) {
    const record = instance.records[index];
    if (!record) return;

    const { stage } = instance;
    stage.innerHTML = record.html;
    stage.className = record.className;
    stage.removeAttribute("style");
    Array.from(stage.attributes).forEach((attribute) => {
      if (attribute.name.startsWith("data-wf--slider-alt-slide--")) {
        stage.removeAttribute(attribute.name);
      }
    });
    record.variantAttributes.forEach(([name, value]) => stage.setAttribute(name, value));
    stage.setAttribute("data-box-slider-stage", "");
    stage.removeAttribute("aria-hidden");
    stage.inert = false;

    const content = stage.querySelector('[class*="box_slider_content"]');
    if (content) {
      content.setAttribute("aria-live", "polite");
      content.setAttribute("aria-atomic", "false");
    }

    instance.currentIndex = index;
    prepareInstanceControls(instance);
  }

  function setControlsBusy(instance, busy) {
    instance.busy = busy;
    instance.stage
      .querySelectorAll(`${PREVIOUS_SELECTOR}, ${NEXT_SELECTOR}`)
      .forEach((control) => {
        control.setAttribute("aria-disabled", busy ? "true" : "false");
      });
    instance.parent.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function restoreControlFocus(instance, direction) {
    if (!direction) return;
    const selector = direction === "previous" ? PREVIOUS_SELECTOR : NEXT_SELECTOR;
    instance.stage.querySelector(selector)?.focus({ preventScroll: true });
  }

  function transitionTo(instance, nextIndex, focusDirection) {
    if (instance.busy || nextIndex === instance.currentIndex) return;
    if (!instance.records[nextIndex]) return;

    instance.timeline?.kill();
    setControlsBusy(instance, true);

    const update = () => {
      applyRecord(instance, nextIndex);
      setControlsBusy(instance, true);
      restoreControlFocus(instance, focusDirection);
    };

    if (instance.reduceMotion || !window.gsap) {
      update();
      setControlsBusy(instance, false);
      return;
    }

    const outgoing = getMotionElements(instance.stage);
    instance.timeline = window.gsap.timeline({
      onComplete() {
        update();

        const incoming = getMotionElements(instance.stage);
        window.gsap.set(incoming, { autoAlpha: 0, y: 24 });
        instance.timeline = window.gsap.timeline({
          onComplete() {
            setControlsBusy(instance, false);
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

  function move(instance, direction, focusDirection) {
    const length = instance.records.length;
    if (length < 2) return;

    const nextIndex = (instance.currentIndex + direction + length) % length;
    transitionTo(instance, nextIndex, focusDirection);
  }

  function prepareControl(control, instance, direction) {
    if (!control || state.controls.has(control)) return;

    const click = (event) => {
      if (control.getAttribute("aria-disabled") === "true") return;
      event.preventDefault();
      move(instance, direction === "previous" ? -1 : 1, direction);
    };

    const keydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      click(event);
    };

    if (control.tagName !== "BUTTON") {
      control.setAttribute("role", "button");
      control.setAttribute("tabindex", "0");
      control.addEventListener("keydown", keydown);
    }

    control.setAttribute(
      "aria-label",
      direction === "previous" ? "Previous slide" : "Next slide"
    );
    control.removeAttribute("aria-disabled");
    control.setAttribute("data-box-slider-slot-control-ready", "");
    control.addEventListener("click", click);
    state.controls.set(control, { click, keydown });
  }

  function prepareInstanceControls(instance) {
    const hasMultipleSlides = instance.records.length > 1;
    instance.stage.querySelectorAll(CONTROLS_SELECTOR).forEach((controls) => {
      controls.hidden = !hasMultipleSlides;
      controls.setAttribute("aria-label", "Slider navigation");
    });
    instance.parent
      .querySelectorAll(PREVIOUS_SELECTOR)
      .forEach((control) => prepareControl(control, instance, "previous"));
    instance.parent
      .querySelectorAll(NEXT_SELECTOR)
      .forEach((control) => prepareControl(control, instance, "next"));
  }

  function neutralizeNativeSlider(instance) {
    const swiper = getSwiper(instance.parent);
    if (!swiper || swiper === instance.swiper) return Boolean(swiper);

    instance.swiper = swiper;
    swiper.allowTouchMove = false;
    if (swiper.params) swiper.params.allowTouchMove = false;
    swiper.navigation?.destroy?.();
    swiper.keyboard?.disable?.();
    swiper.mousewheel?.disable?.();
    swiper.detachEvents?.();
    swiper.setTranslate?.(0);
    return true;
  }

  function prepareGestures(instance) {
    const element = instance.parent.querySelector(ELEMENT_SELECTOR);
    if (!element) return;

    const pointerdown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest("a, button, input, select, textarea")) return;
      instance.pointer = { x: event.clientX, y: event.clientY };
    };
    const pointerup = (event) => {
      if (!instance.pointer || instance.busy) return;
      const deltaX = event.clientX - instance.pointer.x;
      const deltaY = event.clientY - instance.pointer.y;
      instance.pointer = null;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      move(instance, deltaX < 0 ? 1 : -1);
    };
    const pointercancel = () => {
      instance.pointer = null;
    };

    element.addEventListener("pointerdown", pointerdown);
    element.addEventListener("pointerup", pointerup);
    element.addEventListener("pointercancel", pointercancel);
    instance.gestures = { element, pointerdown, pointerup, pointercancel };
  }

  function initializeParent(parent) {
    if (state.instances.has(parent)) return;

    const list = parent.querySelector(LIST_SELECTOR);
    const allSlides = getSlides(parent);
    const slides = allSlides.slice(0, MAX_SLIDES);
    if (!list || !slides.length) return;

    const instance = {
      parent,
      list,
      slides,
      stage: slides[0],
      records: slides.map(captureRecord),
      currentIndex: 0,
      reduceMotion: Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
      busy: false,
      timeline: null,
      swiper: null,
      pointer: null,
      gestures: null
    };

    slides.forEach((slide, index) => {
      if (index === 0) {
        slide.setAttribute("data-box-slider-stage", "");
        slide.removeAttribute("aria-hidden");
        slide.inert = false;
        return;
      }
      slide.setAttribute("data-box-slider-source", "");
      slide.setAttribute("aria-hidden", "true");
      slide.inert = true;
    });
    allSlides.slice(MAX_SLIDES).forEach((slide) => {
      slide.setAttribute("data-box-slider-source", "");
      slide.setAttribute("aria-hidden", "true");
      slide.inert = true;
    });

    parent.setAttribute("data-box-slider-slots-ready", "");
    parent.setAttribute("role", "region");
    parent.setAttribute("aria-roledescription", "carousel");
    parent.setAttribute("aria-label", parent.getAttribute("aria-label") || "Slider");
    list.style.setProperty("transform", "none", "important");
    list.style.setProperty("transition-duration", "0ms", "important");

    state.instances.set(parent, instance);
    neutralizeNativeSlider(instance);
    window.requestAnimationFrame(() => neutralizeNativeSlider(instance));
    prepareGestures(instance);
    prepareInstanceControls(instance);
  }

  function init(scope, runtime) {
    const detectedVersion = runtime?.detectVersion?.(document)?.version;
    if (LEGACY_VERSIONS.has(detectedVersion)) return;

    injectStyles();
    const initialize = () => findParents(scope).forEach(initializeParent);
    if (window.gsap || !runtime?.loadDependency) {
      initialize();
      return;
    }

    runtime.loadDependency("gsap").then(initialize).catch(initialize);
  }

  function destroy(scope) {
    findParents(scope).forEach((parent) => {
      const instance = state.instances.get(parent);
      if (!instance) return;

      instance.timeline?.kill();
      instance.gestures?.element.removeEventListener(
        "pointerdown",
        instance.gestures.pointerdown
      );
      instance.gestures?.element.removeEventListener("pointerup", instance.gestures.pointerup);
      instance.gestures?.element.removeEventListener(
        "pointercancel",
        instance.gestures.pointercancel
      );
      instance.swiper?.attachEvents?.();

      parent.querySelectorAll(`${PREVIOUS_SELECTOR}, ${NEXT_SELECTOR}`).forEach((control) => {
        const handlers = state.controls.get(control);
        if (!handlers) return;
        control.removeEventListener("click", handlers.click);
        control.removeEventListener("keydown", handlers.keydown);
        control.removeAttribute("data-box-slider-slot-control-ready");
        control.removeAttribute("aria-disabled");
        state.controls.delete(control);
      });
      parent.querySelectorAll("[data-box-slider-stage], [data-box-slider-source]").forEach((slide) => {
        slide.removeAttribute("data-box-slider-stage");
        slide.removeAttribute("data-box-slider-source");
        slide.removeAttribute("aria-hidden");
        slide.inert = false;
      });
      parent.removeAttribute("data-box-slider-slots-ready");
      parent.removeAttribute("aria-busy");
      state.instances.delete(parent);
    });
  }

  function boot() {
    if (window.PatternRuntime?.managed) return;
    init(document);
  }

  state.init = init;
  state.destroy = destroy;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
