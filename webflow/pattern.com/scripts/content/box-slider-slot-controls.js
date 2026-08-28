(function () {
  "use strict";

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
  const PREVIOUS_SELECTOR = "[data-box-slider-prev], [data-case-study-prev]";
  const NEXT_SELECTOR = "[data-box-slider-next], [data-case-study-next]";
  const LEGACY_VERSIONS = new Set(["v1", "v2", "v2l"]);

  const state = window.PatternBoxSliderSlots = window.PatternBoxSliderSlots || {};
  if (!(state.parents instanceof WeakSet)) state.parents = new WeakSet();
  if (!(state.controls instanceof WeakMap)) state.controls = new WeakMap();

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

  function prepareControl(control, parent, direction) {
    if (!control || state.controls.has(control)) return;

    const click = (event) => {
      if (control.getAttribute("aria-disabled") === "true") return;
      const swiper = getSwiper(parent);
      if (!swiper) return;

      event.preventDefault();
      if (direction === "previous") swiper.slidePrev();
      else swiper.slideNext();
    };

    const keydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      control.click();
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

  function initializeParent(parent) {
    const slides = getSlides(parent);
    if (!slides.length) return;

    const hasMultipleSlides = slides.length > 1;
    slides.forEach((slide) => {
      slide.querySelectorAll(CONTROLS_SELECTOR).forEach((controls) => {
        controls.hidden = !hasMultipleSlides;
        controls.setAttribute("aria-label", "Slider navigation");
      });

      slide.querySelectorAll(PREVIOUS_SELECTOR).forEach((control) => {
        prepareControl(control, parent, "previous");
      });
      slide.querySelectorAll(NEXT_SELECTOR).forEach((control) => {
        prepareControl(control, parent, "next");
      });
    });

    parent.setAttribute("data-box-slider-slots-ready", "");
    state.parents.add(parent);
  }

  function init(scope, runtime) {
    const detectedVersion = runtime?.detectVersion?.(document)?.version;
    if (LEGACY_VERSIONS.has(detectedVersion)) return;

    findParents(scope).forEach(initializeParent);
  }

  function destroy(scope) {
    findParents(scope).forEach((parent) => {
      parent.querySelectorAll(`${PREVIOUS_SELECTOR}, ${NEXT_SELECTOR}`).forEach((control) => {
        const handlers = state.controls.get(control);
        if (!handlers) return;
        control.removeEventListener("click", handlers.click);
        control.removeEventListener("keydown", handlers.keydown);
        control.removeAttribute("data-box-slider-slot-control-ready");
        state.controls.delete(control);
      });
      parent.removeAttribute("data-box-slider-slots-ready");
      state.parents.delete(parent);
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
