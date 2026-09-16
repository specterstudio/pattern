(() => {
  const GLOBAL_NAME = 'PatternAccordion';
  const VERSION = '1.1.0';

  if (window[GLOBAL_NAME]?.version) {
    window[GLOBAL_NAME].init(document);
    return;
  }

  const selectors = {
    wrap: '[data-accordion], [class*="accordion_wrap"]',
    list: '[data-accordion-list], [class*="accordion_list"]',
    card: '[data-accordion-item], [class*="accordion_component"]',
    button: '[data-accordion-trigger], [class*="accordion_toggle_button"]',
    heading: '[class*="accordion_toggle_heading"]',
    contentWrap: '[data-accordion-panel], [class*="accordion_content_wrap"]',
    content: '[class*="accordion_content"]',
    buttonBar: '[class*="u-btn-bar"][class*="cc-vertical"]',
    buttonWrap: '[class*="accordion_toggle_btn_wrap"]',
  };

  const legacyActiveClass = 'pattern-library-v2--is-active';

  const hasClassFragment = (element, fragment) =>
    Boolean(element && [...element.classList].some((className) => className.includes(fragment)));

  const isActive = (card) =>
    card.classList.contains('is-active') || card.classList.contains(legacyActiveClass);

  const setActive = (card, active) => {
    card.classList.toggle('is-active', active);

    if (card.hasAttribute('data-accordion-item')) {
      card.classList.remove(legacyActiveClass);
    } else {
      card.classList.toggle(legacyActiveClass, active);
    }
  };

  const getBooleanAttribute = (element, name, fallback) => {
    const value = element.getAttribute(name);
    if (value === null) return fallback;
    return value.trim().toLowerCase() !== 'false';
  };

  function initAccordions(scope = document) {
    const components = [];

    if (scope.matches?.(selectors.wrap)) components.push(scope);
    scope.querySelectorAll?.(selectors.wrap).forEach((component) => components.push(component));

    components.forEach((component) => {
      if (component.dataset.accordionInitialized === 'true') return;

      const list = component.querySelector(selectors.list);
      if (!list) {
        console.warn('Accordion list not found:', component);
        return;
      }
      if (typeof gsap === 'undefined') {
        console.warn('GSAP is required for accordions:', component);
        return;
      }

      component.dataset.accordionInitialized = 'true';
      component.dataset.scriptInitialized = 'true';

      const accordionUid = (window.__patternAccordionUid =
        (window.__patternAccordionUid || 0) + 1);
      const closePrevious = getBooleanAttribute(component, 'data-close-previous', true);
      const closeOnSecondClick = getBooleanAttribute(
        component,
        'data-close-on-second-click',
        true,
      );
      const openOnHover = getBooleanAttribute(component, 'data-open-on-hover', false);
      const openByDefaultValue = component.getAttribute('data-open-by-default');
      const openByDefault =
        openByDefaultValue !== null && !Number.isNaN(Number(openByDefaultValue))
          ? Number(openByDefaultValue)
          : 0;
      let previousIndex = null;
      const closeFunctions = [];

      function flattenDisplayContents(slot) {
        let child = slot.firstElementChild;
        while (child && hasClassFragment(child, 'u-display-contents')) {
          while (child.firstChild) slot.insertBefore(child.firstChild, child);
          child.remove();
          child = slot.firstElementChild;
        }
      }

      function removeCMSList(slot) {
        const dynList = [...slot.children].find((child) => child.classList.contains('w-dyn-list'));
        if (!dynList) return;

        const nestedItems = dynList.querySelector('.w-dyn-items')?.children;
        if (!nestedItems) return;

        const staticWrapper = [...slot.children];
        [...nestedItems].forEach((item) => {
          const visibleChild = [...item.children].find(
            (child) => !child.classList.contains('w-condition-invisible'),
          );
          if (visibleChild) slot.appendChild(visibleChild);
        });
        staticWrapper.forEach((element) => element.remove());
      }

      flattenDisplayContents(list);
      removeCMSList(list);

      const cards = [...list.querySelectorAll(selectors.card)].filter(
        (card) => card.closest(selectors.wrap) === component,
      );

      cards.forEach((card, cardIndex) => {
        let button = card.querySelector(selectors.button);
        if (!button) {
          const heading = card.querySelector(selectors.heading);
          if (heading) {
            button = heading;
            if (heading.tagName !== 'BUTTON') {
              heading.style.cursor = 'pointer';
              heading.setAttribute('role', 'button');
              heading.setAttribute('tabindex', '0');
            }
          }
        }

        let content = card.querySelector(selectors.contentWrap);
        if (!content) content = card.querySelector(selectors.content);
        if (!content) {
          const headingOrButton = card.querySelector(`${selectors.heading}, ${selectors.button}`);
          let nextSibling = headingOrButton?.nextElementSibling;
          while (nextSibling && hasClassFragment(nextSibling, 'u-display-contents')) {
            nextSibling = nextSibling.nextElementSibling;
          }
          if (nextSibling) content = nextSibling;
        }

        if (!button || !content) {
          console.warn('Accordion is missing a button or content element:', card);
          return;
        }

        const buttonBars = card.querySelectorAll(selectors.buttonBar);
        const buttonWraps = card.querySelectorAll(selectors.buttonWrap);
        const buttonId = `accordion-trigger-${accordionUid}-${cardIndex}`;
        const contentId = `accordion-panel-${accordionUid}-${cardIndex}`;

        setActive(card, false);
        button.setAttribute('aria-expanded', 'false');
        button.id = buttonId;
        content.id = contentId;
        button.setAttribute('aria-controls', contentId);
        content.setAttribute('aria-labelledby', buttonId);
        content.style.display = 'none';
        content.style.height = '0px';

        const refresh = () => {
          timeline.invalidate();
          if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        };

        const timeline = gsap.timeline({
          paused: true,
          defaults: { duration: 0.3, ease: 'power1.inOut' },
          onComplete: () => {
            content.style.height = 'auto';
            refresh();
          },
          onReverseComplete: () => {
            content.style.display = 'none';
            content.style.height = '0px';
            refresh();
          },
        });
        timeline.fromTo(content, { height: 0 }, { height: 'auto' });

        const closeAccordion = () => {
          if (!isActive(card)) return;

          setActive(card, false);
          button.setAttribute('aria-expanded', 'false');
          timeline.reverse();
          buttonBars.forEach((bar) => {
            bar.style.opacity = '';
            bar.style.display = '';
          });
          buttonWraps.forEach((wrap) => {
            wrap.style.pointerEvents = '';
          });
        };
        closeFunctions[cardIndex] = closeAccordion;

        const openAccordion = (instant = false) => {
          if (closePrevious && previousIndex !== null && previousIndex !== cardIndex) {
            closeFunctions[previousIndex]?.();
          }

          previousIndex = cardIndex;
          content.style.display = 'block';
          button.setAttribute('aria-expanded', 'true');
          setActive(card, true);
          buttonBars.forEach((bar) => {
            bar.style.opacity = '0';
          });
          buttonWraps.forEach((wrap) => {
            wrap.style.pointerEvents = 'none';
          });

          if (instant) {
            timeline.progress(1);
            content.style.height = 'auto';
          } else {
            timeline.play();
          }
        };

        const handleToggle = () => {
          if (isActive(card) && closeOnSecondClick) {
            closeAccordion();
            previousIndex = null;
          } else if (!isActive(card)) {
            openAccordion();
          }
        };

        button.addEventListener('click', handleToggle);
        if (button.tagName !== 'BUTTON') {
          button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleToggle();
            }
          });
        }
        if (openOnHover) button.addEventListener('mouseenter', () => openAccordion());

        if (openByDefault === cardIndex + 1) openAccordion(true);
      });
    });
  }

  window[GLOBAL_NAME] = {
    init: initAccordions,
    version: VERSION,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccordions, { once: true });
  } else {
    initAccordions();
  }
})();
