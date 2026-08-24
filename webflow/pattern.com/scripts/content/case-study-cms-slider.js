(function () {
  "use strict";

  const ROOT_SELECTOR = "[data-case-study-slider]";
  const ITEM_SELECTOR = ".w-dyn-item";
  const COMPONENT_SELECTOR = '[class*="case-study_slider_wrap"]';
  const STYLE_ID = "pattern-case-study-slider-styles";
  const DEFERRED_ROOT_MARGIN = "1200px 0px";
  const LEGACY_VERSIONS = new Set(["v1", "v2", "v2l"]);

  const SELECTORS = {
    visual: '[class*="case-study_slider_visual"]',
    logo: '[class*="case-study_slider_logo"]',
    quote: '[class*="case-study_slider_quote"]',
    avatar: '[class*="case-study_slider_avatar"]',
    author: '[class*="case-study_slider_name"]',
    content: '[class*="case-study_slider_content"]',
    cta: '[class*="u-button-wrapper"]',
    link: '[class*="clickable_link"][href]',
    stat: '[class*="case-study_slider_stat"]',
    statValue: '[class*="card_stats_top"] [class*="u-text"]',
    statLabel: '[class*="card_general_bottom"] [class*="u-text"]',
    controls: '[data-case-study-controls], [class*="case-study_slider_controls"]',
    previous: "[data-case-study-prev]",
    next: "[data-case-study-next]"
  };

  const state = window.PatternCaseStudyCMS = window.PatternCaseStudyCMS || {};
  if (!(state.instances instanceof WeakMap)) state.instances = new WeakMap();
  if (!(state.initialized instanceof WeakSet)) state.initialized = new WeakSet();
  if (!(state.deferred instanceof WeakMap)) state.deferred = new WeakMap();
  if (!(state.statTweens instanceof WeakMap)) state.statTweens = new WeakMap();

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-case-study-slider-ready] [class*="case-study_slider_visual"] {
        overflow: hidden;
      }

      [data-case-study-slider-ready] .case-study_slider_image_swiper,
      [data-case-study-slider-ready] .case-study_slider_image_list,
      [data-case-study-slider-ready] .case-study_slider_image_slide,
      [data-case-study-slider-ready] .case-study_slider_image_slide > [class*="u-image-wrapper"] {
        width: 100%;
        height: 100%;
      }

      [data-case-study-slider-ready] .case-study_slider_image_slide {
        overflow: hidden;
      }

      [data-case-study-slider-deferred] > .w-dyn-items > .w-dyn-item[hidden],
      [data-case-study-slider-deferred] > .w-dyn-item[hidden],
      [data-case-study-slider-static] > .w-dyn-items > .w-dyn-item[hidden],
      [data-case-study-slider-static] > .w-dyn-item[hidden],
      [data-case-study-slider-ready] > .w-dyn-items > .w-dyn-item[hidden],
      [data-case-study-slider-ready] > .w-dyn-item[hidden] {
        display: none !important;
      }

      [data-case-study-slider-deferred] [class*="case-study_slider_controls"],
      [data-case-study-slider-ready] [class*="case-study_slider_controls"][hidden],
      [data-case-study-slider-static] [class*="case-study_slider_controls"] {
        display: none !important;
      }

      @media (prefers-reduced-motion: reduce) {
        [data-case-study-slider-ready] .swiper-wrapper {
          transition-duration: 0ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findSliderRoots(root) {
    const scope = root || document;
    const explicit = [];

    if (scope.matches && scope.matches(ROOT_SELECTOR)) explicit.push(scope);
    explicit.push(...Array.from(scope.querySelectorAll(ROOT_SELECTOR)));
    if (explicit.length) return explicit;

    const dynamicLists = [];
    if (scope.matches && scope.matches(".w-dyn-list")) dynamicLists.push(scope);
    dynamicLists.push(...Array.from(scope.querySelectorAll(".w-dyn-list")));

    return dynamicLists.filter((list) => {
      return Boolean(list.querySelector(`${ITEM_SELECTOR} ${COMPONENT_SELECTOR}`));
    });
  }

  function getImageData(root) {
    const image = root && root.querySelector("img");
    if (!image) return null;

    return {
      src: image.getAttribute("src") || "",
      srcset: image.getAttribute("srcset") || "",
      sizes: image.getAttribute("sizes") || "",
      alt: image.getAttribute("alt") || ""
    };
  }

  function getText(root) {
    return root ? root.textContent.trim() : "";
  }

  function setText(root, value) {
    if (!root) return;

    const textNode = root.querySelector("span") || root;
    textNode.textContent = value || "";
    root.classList.remove("w-dyn-bind-empty");
  }

  function setImage(root, data) {
    const image = root && root.querySelector("img");
    if (!image || !data || !data.src) return;

    image.src = data.src;
    image.alt = data.alt || "";
    image.loading = "lazy";
    image.decoding = "async";

    if (data.srcset) image.setAttribute("srcset", data.srcset);
    else image.removeAttribute("srcset");

    if (data.sizes) image.setAttribute("sizes", data.sizes);
    else image.removeAttribute("sizes");
  }

  function readStat(stat) {
    return {
      value: getText(stat.querySelector(SELECTORS.statValue)),
      label: getText(stat.querySelector(SELECTORS.statLabel))
    };
  }

  function readRecord(item) {
    const component = item.querySelector(COMPONENT_SELECTOR);
    if (!component) return null;

    const visual = component.querySelector(SELECTORS.visual);
    const imageWrapper = visual && visual.querySelector('[class*="u-image-wrapper"]');
    const author = component.querySelector(SELECTORS.author);
    const authorLines = author ? Array.from(author.querySelectorAll('[class*="u-text"]')) : [];
    const link = component.querySelector(SELECTORS.link);

    return {
      imageWrapper: imageWrapper ? imageWrapper.cloneNode(true) : null,
      logo: getImageData(component.querySelector(SELECTORS.logo)),
      quote: getText(component.querySelector(SELECTORS.quote)),
      avatar: getImageData(component.querySelector(SELECTORS.avatar)),
      authorName: getText(authorLines[0]),
      authorTitle: getText(authorLines[1]),
      href: link ? link.getAttribute("href") || "#" : "#",
      stats: Array.from(component.querySelectorAll(SELECTORS.stat)).map(readStat)
    };
  }

  function collectRecords(root) {
    return Array.from(root.querySelectorAll(`:scope > .w-dyn-items > ${ITEM_SELECTOR}, :scope > ${ITEM_SELECTOR}`))
      .map(readRecord)
      .filter((record) => record && record.imageWrapper);
  }

  function getItems(root) {
    return Array.from(root.querySelectorAll(`:scope > .w-dyn-items > ${ITEM_SELECTOR}, :scope > ${ITEM_SELECTOR}`));
  }

  function getTarget(component) {
    const author = component.querySelector(SELECTORS.author);
    const authorLines = author ? Array.from(author.querySelectorAll('[class*="u-text"]')) : [];
    const stats = Array.from(component.querySelectorAll(SELECTORS.stat));

    return {
      component,
      visual: component.querySelector(SELECTORS.visual),
      content: component.querySelector(SELECTORS.content),
      logo: component.querySelector(SELECTORS.logo),
      quote: component.querySelector(SELECTORS.quote),
      avatar: component.querySelector(SELECTORS.avatar),
      author,
      authorName: authorLines[0] || null,
      authorTitle: authorLines[1] || null,
      cta: component.querySelector(SELECTORS.cta),
      link: component.querySelector(SELECTORS.link),
      stats: stats.map((stat) => ({
        root: stat,
        value: stat.querySelector(SELECTORS.statValue),
        label: stat.querySelector(SELECTORS.statLabel)
      })),
      controls: component.querySelector(SELECTORS.controls),
      previous: component.querySelector(SELECTORS.previous),
      next: component.querySelector(SELECTORS.next)
    };
  }

  function buildImageSwiper(target, records) {
    const viewport = document.createElement("div");
    viewport.className = "case-study_slider_image_swiper swiper";
    viewport.setAttribute("data-case-study-image-swiper", "");

    const wrapper = document.createElement("div");
    wrapper.className = "case-study_slider_image_list swiper-wrapper";

    records.forEach((record, index) => {
      const slide = document.createElement("div");
      slide.className = "case-study_slider_image_slide swiper-slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-label", `${index + 1} of ${records.length}`);
      slide.appendChild(record.imageWrapper.cloneNode(true));
      wrapper.appendChild(slide);
    });

    viewport.appendChild(wrapper);
    target.visual.replaceChildren(viewport);
    return viewport;
  }

  function parseNumber(rawValue) {
    const raw = String(rawValue || "").trim();
    const match = raw.match(/^(\D*?)([-+]?\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!match) return null;

    const token = match[2];
    const explicitPlus = token.startsWith("+");
    const unsignedToken = explicitPlus ? token.slice(1) : token;
    const value = Number(unsignedToken.replace(/,/g, ""));
    if (!Number.isFinite(value)) return null;

    return {
      raw,
      prefix: `${match[1]}${explicitPlus ? "+" : ""}`,
      suffix: match[3],
      value,
      decimals: (unsignedToken.split(".")[1] || "").length,
      grouped: unsignedToken.includes(",")
    };
  }

  function formatNumber(parts, value) {
    const absoluteValue = Object.is(value, -0) ? 0 : value;
    let formatted = absoluteValue.toFixed(parts.decimals);

    if (parts.grouped) {
      const pieces = formatted.split(".");
      pieces[0] = Number(pieces[0]).toLocaleString("en-US");
      formatted = pieces.join(".");
    }

    return `${parts.prefix}${formatted}${parts.suffix}`;
  }

  function tweenStat(element, fromRaw, toRaw, reduceMotion) {
    if (!element) return;

    state.statTweens.get(element)?.kill();
    state.statTweens.delete(element);

    const from = parseNumber(fromRaw);
    const to = parseNumber(toRaw);
    if (reduceMotion || !from || !to || !window.gsap) {
      element.textContent = toRaw || "";
      return;
    }

    const proxy = { value: from.value };
    element.textContent = formatNumber(to, proxy.value);

    const tween = window.gsap.to(proxy, {
      value: to.value,
      duration: 0.6,
      ease: "power3.out",
      overwrite: true,
      onUpdate() {
        element.textContent = formatNumber(to, proxy.value);
      },
      onComplete() {
        element.textContent = to.raw;
        state.statTweens.delete(element);
      }
    });

    state.statTweens.set(element, tween);
  }

  function applyRecord(target, record) {
    setImage(target.logo, record.logo);
    setText(target.quote, record.quote);
    setImage(target.avatar, record.avatar);
    setText(target.authorName, record.authorName);
    setText(target.authorTitle, record.authorTitle);

    if (target.link) target.link.setAttribute("href", record.href || "#");

    target.stats.forEach((stat, index) => {
      const nextStat = record.stats[index] || {};
      const hasContent = Boolean(nextStat.value || nextStat.label);
      stat.root.hidden = !hasContent;
      if (!hasContent) return;
      setText(stat.label, nextStat.label);
    });
  }

  function getMotionElements(target) {
    return [
      target.logo,
      target.quote,
      target.avatar,
      target.authorName,
      target.authorTitle,
      target.cta,
      ...target.stats.map((stat) => stat.label)
    ].filter(Boolean);
  }

  function transitionContent(instance, nextIndex) {
    const { target, records, reduceMotion } = instance;
    const previousRecord = records[instance.currentIndex];
    const nextRecord = records[nextIndex];
    if (!nextRecord || nextIndex === instance.currentIndex) return;

    if (instance.timeline) instance.timeline.kill();

    const motionElements = getMotionElements(target);
    const update = () => {
      applyRecord(target, nextRecord);

      target.stats.forEach((stat, index) => {
        const previousStat = previousRecord.stats[index] || {};
        const nextStat = nextRecord.stats[index] || {};
        tweenStat(stat.value, previousStat.value, nextStat.value, reduceMotion);
      });

      instance.currentIndex = nextIndex;
    };

    if (reduceMotion || !window.gsap) {
      update();
      return;
    }

    // The previous transition timeline is killed above, so child tweens do not
    // need overwrite. Enabling it here causes the enter tween to cancel the
    // exit tween and the initial hidden/y-offset state during construction.
    instance.timeline = window.gsap.timeline();

    instance.timeline
      .to(motionElements, {
        autoAlpha: 0,
        y: -8,
        duration: 0.16,
        stagger: 0.02,
        ease: "power1.in"
      })
      .call(update)
      .set(motionElements, { autoAlpha: 0, y: 24 })
      .to(motionElements, {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power3.out"
      });
  }

  function setControlsBusy(target, busy) {
    [target.previous, target.next].filter(Boolean).forEach((button) => {
      button.disabled = busy;
      button.setAttribute("aria-disabled", busy ? "true" : "false");
    });

    target.component.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function prepareControl(control) {
    if (!control || control.tagName === "BUTTON") return;

    control.setAttribute("role", "button");
    control.setAttribute("tabindex", "0");
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (control.getAttribute("aria-disabled") === "true") return;

      event.preventDefault();
      control.click();
    });
  }

  function hideSourceItems(items) {
    items.slice(1).forEach((item) => {
      item.hidden = true;
      item.inert = true;
      item.setAttribute("aria-hidden", "true");
    });
  }

  function initializeStatic(root, component) {
    root.setAttribute("data-case-study-slider-static", "");
    root.removeAttribute("data-case-study-slider-ready");
    root.removeAttribute("role");
    root.removeAttribute("aria-roledescription");

    const controls = component.querySelector(SELECTORS.controls);
    if (controls) controls.hidden = true;
  }

  function initializeSlider(root, cachedRecords) {
    if (state.initialized.has(root)) return;

    const items = getItems(root);
    if (!items.length) return;

    const component = items[0].querySelector(COMPONENT_SELECTOR);
    if (!component) return;

    const records = cachedRecords && cachedRecords.length
      ? cachedRecords
      : collectRecords(root);
    if (records.length < 2) {
      initializeStatic(root, component);
      state.initialized.add(root);
      return;
    }

    if (!window.Swiper) return;

    const target = getTarget(component);
    if (!target.visual || !target.content) return;

    const originalVisualChildren = Array.from(target.visual.childNodes).map((node) =>
      node.cloneNode(true)
    );
    const viewport = buildImageSwiper(target, records);
    const reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.removeAttribute("data-case-study-slider-static");
    root.setAttribute("data-case-study-slider-ready", "");
    root.setAttribute("role", "region");
    root.setAttribute("aria-roledescription", "carousel");
    root.setAttribute("aria-label", root.getAttribute("aria-label") || "Case studies");
    target.content.setAttribute("aria-live", "polite");
    target.content.setAttribute("aria-atomic", "false");
    if (target.controls) target.controls.hidden = false;
    prepareControl(target.previous);
    prepareControl(target.next);

    hideSourceItems(items);

    const instance = {
      root,
      target,
      records,
      currentIndex: 0,
      reduceMotion,
      timeline: null,
      swiper: null,
      originalVisualChildren
    };

    const swiper = new window.Swiper(viewport, {
      slidesPerView: 1,
      speed: reduceMotion ? 0 : 700,
      loop: true,
      allowTouchMove: true,
      preventInteractionOnTransition: true,
      navigation: {
        prevEl: target.previous,
        nextEl: target.next
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true
      },
      a11y: {
        enabled: true,
        prevSlideMessage: "Previous case study",
        nextSlideMessage: "Next case study",
        slideLabelMessage: "{{index}} / {{slidesLength}}"
      },
      on: {
        slideChangeTransitionStart(swiperInstance) {
          const nextIndex = swiperInstance.realIndex || 0;
          if (nextIndex === instance.currentIndex) return;
          setControlsBusy(target, true);
          transitionContent(instance, nextIndex);
        },
        transitionEnd() {
          setControlsBusy(target, false);
        }
      }
    });

    instance.swiper = swiper;
    state.instances.set(root, instance);
    state.initialized.add(root);
  }

  function cancelDeferredInitialization(root) {
    const deferred = state.deferred.get(root);
    if (!deferred) return;

    deferred.active = false;
    deferred.observer?.disconnect();
    root.removeEventListener("pointerenter", deferred.start);
    root.removeEventListener("focusin", deferred.start);
    root.removeAttribute("data-case-study-slider-deferred");
    root.removeAttribute("data-case-study-slider-loading");
    state.deferred.delete(root);
  }

  function deferSlider(root, runtime) {
    if (state.initialized.has(root) || state.deferred.has(root)) return;

    const items = getItems(root);
    if (!items.length) return;

    const component = items[0].querySelector(COMPONENT_SELECTOR);
    if (!component) return;

    const records = collectRecords(root);
    if (records.length < 2) {
      initializeStatic(root, component);
      state.initialized.add(root);
      return;
    }

    const deferred = {
      active: true,
      started: false,
      observer: null,
      start: null
    };

    const start = async () => {
      if (!deferred.active || deferred.started || state.initialized.has(root)) return;
      deferred.started = true;

      deferred.observer?.disconnect();
      root.removeEventListener("pointerenter", start);
      root.removeEventListener("focusin", start);
      root.setAttribute("data-case-study-slider-loading", "");

      try {
        await Promise.all([
          runtime.loadDependency("gsap"),
          runtime.loadDependency("swiper")
        ]);

        if (!deferred.active) return;
        initializeSlider(root, records);

        if (!state.initialized.has(root)) {
          initializeStatic(root, component);
          hideSourceItems(items);
          console.warn(
            "[Case Study CMS] Dependencies loaded, but the slider markup could not be initialized."
          );
        }
      } catch (error) {
        initializeStatic(root, component);
        hideSourceItems(items);
        console.warn(
          "[Case Study CMS] Deferred dependencies could not load; the first static CMS item remains visible.",
          error
        );
      } finally {
        if (deferred.active) {
          root.removeAttribute("data-case-study-slider-deferred");
          root.removeAttribute("data-case-study-slider-loading");
        }
        if (state.deferred.get(root) === deferred) state.deferred.delete(root);
      }
    };

    deferred.start = start;
    state.deferred.set(root, deferred);
    root.setAttribute("data-case-study-slider-deferred", "");
    hideSourceItems(items);
    root.addEventListener("pointerenter", start, { once: true });
    root.addEventListener("focusin", start, { once: true });

    if ("IntersectionObserver" in window) {
      deferred.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void start();
        },
        { rootMargin: DEFERRED_ROOT_MARGIN }
      );
      deferred.observer.observe(root);
    } else {
      void start();
    }
  }

  function init(root, runtime) {
    const detectedVersion = runtime?.detectVersion?.(document)?.version;
    if (LEGACY_VERSIONS.has(detectedVersion)) return;

    injectStyles();
    findSliderRoots(root).forEach((sliderRoot) => {
      if (runtime?.managed && typeof runtime.loadDependency === "function") {
        deferSlider(sliderRoot, runtime);
      } else {
        initializeSlider(sliderRoot);
      }
    });
  }

  function destroy(root) {
    findSliderRoots(root).forEach((sliderRoot) => {
      cancelDeferredInitialization(sliderRoot);
      const instance = state.instances.get(sliderRoot);

      if (instance) {
        instance.timeline?.kill();
        instance.swiper?.destroy(true, true);

        instance.target.stats.forEach((stat) => {
          state.statTweens.get(stat.value)?.kill();
          state.statTweens.delete(stat.value);
        });

        if (instance.target.visual && instance.originalVisualChildren) {
          instance.target.visual.replaceChildren(
            ...instance.originalVisualChildren.map((node) => node.cloneNode(true))
          );
        }

        instance.target.content?.removeAttribute("aria-live");
        instance.target.content?.removeAttribute("aria-atomic");
        if (instance.target.controls) instance.target.controls.hidden = true;
        state.instances.delete(sliderRoot);
      }

      getItems(sliderRoot).forEach((item) => {
        item.hidden = false;
        item.inert = false;
        item.removeAttribute("aria-hidden");
      });

      sliderRoot.removeAttribute("data-case-study-slider-ready");
      sliderRoot.removeAttribute("data-case-study-slider-static");
      sliderRoot.removeAttribute("data-case-study-slider-deferred");
      sliderRoot.removeAttribute("data-case-study-slider-loading");
      sliderRoot.removeAttribute("role");
      sliderRoot.removeAttribute("aria-roledescription");
      sliderRoot.removeAttribute("aria-busy");
      state.initialized.delete(sliderRoot);
    });
  }

  function boot() {
    if (window.PatternRuntime?.managed) return;

    let attempts = 0;
    const waitForSwiper = () => {
      const roots = findSliderRoots(document);
      const needsSwiper = roots.some((root) => getItems(root).length > 1);

      if (!needsSwiper || window.Swiper) {
        init(document);
        return;
      }

      attempts += 1;
      if (attempts < 100) window.setTimeout(waitForSwiper, 50);
      else console.warn("[Case Study CMS] Swiper 8 was not available; the static CMS fallback remains visible.");
    };

    waitForSwiper();
  }

  state.init = init;
  state.destroy = destroy;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
