(function () {
  "use strict";

  var NAV_INIT_ATTR = "data-pattern-nav-ready";
  var DESKTOP_QUERY = "(min-width: 992px)";
  var NAV_TRANSITION_MS = 300;
  var transitionTimers = new WeakMap();

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function attrSelector(name, value) {
    return "[" + name + '="' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]';
  }

  function queryByAttr(root, name, value) {
    return root.querySelector(attrSelector(name, value));
  }

  function on(target, eventName, handler, options) {
    if (!target) return function () {};
    target.addEventListener(eventName, handler, options);
    return function () {
      target.removeEventListener(eventName, handler, options);
    };
  }

  function setClass(element, className, isActive) {
    if (!element) return;
    element.classList.toggle(className, Boolean(isActive));
  }

  function restoreAttribute(element, name, value) {
    if (value === null) {
      element.removeAttribute(name);
      return;
    }

    element.setAttribute(name, value);
  }

  function setTemporaryAttribute(cleanups, element, name, value) {
    if (!element) return;
    var previousValue = element.getAttribute(name);
    element.setAttribute(name, value);
    cleanups.push(function () {
      restoreAttribute(element, name, previousValue);
    });
  }

  function enhanceTrigger(cleanups, trigger) {
    if (!trigger) return;

    if (!trigger.hasAttribute("role")) {
      setTemporaryAttribute(cleanups, trigger, "role", "button");
    }

    if (!trigger.hasAttribute("tabindex")) {
      setTemporaryAttribute(cleanups, trigger, "tabindex", "0");
    }

    if (!trigger.hasAttribute("aria-expanded")) {
      setTemporaryAttribute(cleanups, trigger, "aria-expanded", "false");
    }
  }

  function setExpanded(trigger, isExpanded) {
    if (!trigger) return;
    trigger.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    setClass(trigger, "is-open", isExpanded);
  }

  function isActivationKey(event) {
    return event.key === "Enter" || event.key === " ";
  }

  function addMediaListener(query, handler) {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
      return function () {
        query.removeEventListener("change", handler);
      };
    }

    query.addListener(handler);
    return function () {
      query.removeListener(handler);
    };
  }

  function clearTransitionTimer(element) {
    if (!element) return;

    var timer = transitionTimers.get(element);
    if (timer) window.clearTimeout(timer);
    transitionTimers.delete(element);
  }

  function showPanel(element) {
    if (!element) return;

    clearTransitionTimer(element);
    element.classList.add("is-visible");

    window.requestAnimationFrame(function () {
      element.classList.add("is-open");
    });
  }

  function hidePanel(element) {
    if (!element) return;

    clearTransitionTimer(element);
    element.classList.remove("is-open");

    transitionTimers.set(
      element,
      window.setTimeout(function () {
        if (!element.classList.contains("is-open")) {
          element.classList.remove("is-visible");
        }
        transitionTimers.delete(element);
      }, NAV_TRANSITION_MS)
    );
  }

  function resetPanel(element) {
    if (!element) return;

    clearTransitionTimer(element);
    element.classList.remove("is-open", "is-visible");
  }

  function clearDesktopState(nav, items, immediate) {
    nav.classList.remove("is-desktop-nav-open", "is-nav-overlay-open");

    items.forEach(function (item) {
      setExpanded(item.trigger, false);
      immediate ? resetPanel(item.menu) : hidePanel(item.menu);
    });
  }

  function setupDesktop(nav) {
    var cleanups = [];
    var triggers = Array.prototype.slice.call(nav.querySelectorAll(".nav_bottom [linkName]"));
    var currentItem = null;

    var items = triggers
      .map(function (trigger) {
        var name = trigger.getAttribute("linkName");
        var menu = name ? queryByAttr(nav, "menuName", name) : null;
        if (!menu) return null;

        enhanceTrigger(cleanups, trigger);
        return { trigger: trigger, menu: menu };
      })
      .filter(Boolean);

    function openItem(item) {
      if (!item) return;
      if (currentItem && currentItem !== item) {
        setExpanded(currentItem.trigger, false);
        hidePanel(currentItem.menu);
      }

      currentItem = item;
      nav.classList.add("is-desktop-nav-open", "is-nav-overlay-open");
      setExpanded(item.trigger, true);
      showPanel(item.menu);
    }

    function closeAll() {
      currentItem = null;
      clearDesktopState(nav, items);
    }

    items.forEach(function (item) {
      cleanups.push(
        on(item.trigger, "mouseenter", function () {
          openItem(item);
        })
      );

      cleanups.push(
        on(item.trigger, "focus", function () {
          openItem(item);
        })
      );

      cleanups.push(
        on(item.trigger, "keydown", function (event) {
          if (event.key === "Escape") {
            closeAll();
            item.trigger.blur();
            return;
          }

          if (!isActivationKey(event)) return;
          event.preventDefault();
          currentItem === item ? closeAll() : openItem(item);
        })
      );
    });

    cleanups.push(on(nav, "mouseleave", closeAll));
    cleanups.push(
      on(nav, "focusout", function () {
        window.setTimeout(function () {
          if (!nav.contains(document.activeElement)) closeAll();
        }, 0);
      })
    );

    cleanups.push(
      on(nav.querySelector(".nav_overlay"), "click", function () {
        closeAll();
      })
    );

    cleanups.push(
      on(document, "keydown", function (event) {
        if (event.key === "Escape") closeAll();
      })
    );

    return function () {
      currentItem = null;
      clearDesktopState(nav, items, true);
      cleanups.forEach(function (cleanup) {
        cleanup();
      });
    };
  }

  function isWebflowMenuOpen(burger, navMenu) {
    if (burger && (burger.classList.contains("w--open") || burger.getAttribute("aria-expanded") === "true")) {
      return true;
    }

    if (navMenu && navMenu.classList.contains("w--open")) {
      return true;
    }

    if (!navMenu) return false;

    return window.getComputedStyle(navMenu).display !== "none";
  }

  function setupMobile(nav) {
    var cleanups = [];
    var burger = nav.querySelector(".w-nav-button");
    var navMenu = nav.querySelector(".w-nav-menu");
    var navBottom = nav.querySelector(".nav_bottom");
    var triggers = Array.prototype.slice.call(nav.querySelectorAll(".nav_bottom [linkName]"));
    var currentItem = null;

    var items = triggers
      .map(function (trigger) {
        var name = trigger.getAttribute("linkName");
        var dropdown = name ? queryByAttr(nav, "menuDropdown", name) : null;
        if (!dropdown) return null;

        enhanceTrigger(cleanups, trigger);
        return { trigger: trigger, dropdown: dropdown };
      })
      .filter(Boolean);

    function syncShellState() {
      var isOpen = isWebflowMenuOpen(burger, navMenu);
      setClass(nav, "is-mobile-nav-open", isOpen);
      setClass(nav, "is-nav-overlay-open", isOpen);
    }

    function closeDropdowns() {
      currentItem = null;
      items.forEach(function (item) {
        setExpanded(item.trigger, false);
        hidePanel(item.dropdown);
      });
    }

    function openDropdown(item) {
      if (!item) return;
      if (currentItem && currentItem !== item) {
        setExpanded(currentItem.trigger, false);
        resetPanel(currentItem.dropdown);
      }

      currentItem = item;
      setExpanded(item.trigger, true);
      showPanel(item.dropdown);
    }

    function toggleDropdown(item) {
      if (currentItem === item) {
        closeDropdowns();
        return;
      }

      openDropdown(item);
    }

    function closeWebflowMenu() {
      if (burger && isWebflowMenuOpen(burger, navMenu)) {
        burger.click();
      }

      window.requestAnimationFrame(syncShellState);
    }

    items.forEach(function (item) {
      cleanups.push(
        on(item.trigger, "click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          toggleDropdown(item);
        })
      );

      cleanups.push(
        on(item.trigger, "keydown", function (event) {
          if (event.key === "Escape") {
            closeDropdowns();
            item.trigger.blur();
            return;
          }

          if (!isActivationKey(event)) return;
          event.preventDefault();
          toggleDropdown(item);
        })
      );
    });

    cleanups.push(
      on(burger, "click", function () {
        window.requestAnimationFrame(syncShellState);
        window.setTimeout(syncShellState, 60);
      })
    );

    cleanups.push(
      on(navBottom, "click", function (event) {
        if (!event.target.closest("[linkName]")) closeDropdowns();
      })
    );

    cleanups.push(
      on(nav.querySelector(".nav_overlay"), "click", function () {
        closeDropdowns();
        closeWebflowMenu();
      })
    );

    cleanups.push(
      on(document, "click", function (event) {
        if (nav.contains(event.target)) return;
        closeDropdowns();
        closeWebflowMenu();
      })
    );

    cleanups.push(
      on(document, "keydown", function (event) {
        if (event.key !== "Escape") return;
        closeDropdowns();
        closeWebflowMenu();
      })
    );

    if (window.MutationObserver && (burger || navMenu)) {
      var observer = new MutationObserver(syncShellState);
      if (burger) observer.observe(burger, { attributes: true, attributeFilter: ["class", "aria-expanded"] });
      if (navMenu) observer.observe(navMenu, { attributes: true, attributeFilter: ["class", "style"] });
      cleanups.push(function () {
        observer.disconnect();
      });
    }

    syncShellState();

    return function () {
      currentItem = null;
      items.forEach(function (item) {
        setExpanded(item.trigger, false);
        resetPanel(item.dropdown);
      });
      nav.classList.remove("is-mobile-nav-open", "is-nav-overlay-open");
      cleanups.forEach(function (cleanup) {
        cleanup();
      });
    };
  }

  function createNavController(nav) {
    if (!nav || nav.hasAttribute(NAV_INIT_ATTR)) return;

    nav.setAttribute(NAV_INIT_ATTR, "true");

    var desktopQuery = window.matchMedia(DESKTOP_QUERY);
    var modeCleanup = null;

    function applyMode() {
      if (modeCleanup) modeCleanup();
      modeCleanup = desktopQuery.matches ? setupDesktop(nav) : setupMobile(nav);
    }

    applyMode();

    addMediaListener(desktopQuery, applyMode);
  }

  function initNav() {
    Array.prototype.slice.call(document.querySelectorAll(".nav_wrap")).forEach(createNavController);
  }

  if (window.pageFunctions && typeof window.pageFunctions.addFunction === "function") {
    window.pageFunctions.addFunction("nav", initNav);
    return;
  }

  ready(initNav);
})();
