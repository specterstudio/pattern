/**
 * Dynamic FAQ Schema Generator for Webflow
 * 
 * This script automatically generates FAQ schema markup from
 * visible FAQ content on the page.
 * 
 * Usage:
 * 1. Add this script to your page's Custom Code -> <head> section
 * 2. Update the selectors below to match your FAQ structure
 * 3. The schema will be automatically generated and injected
 */

(function () {
  'use strict';

  // Track if schema has been generated to avoid duplicates
  let schemaGenerated = false;

  // CONFIGURATION: FAQ structures for Pattern.com and UK Pattern.
  // Legacy FAQ cards are already specific enough. Generic accordion/toggle
  // components require an FAQ heading or explicit data/class opt-in nearby.
  const FAQ_CONFIGS = [
    {
      name: 'attribute-marked FAQ items',
      cardSelector: '[data-faq-item][data-faq-schema], [data-faq-schema] [data-faq-item]',
      questionSelector: '[data-faq-question]',
      answerSelector: '[data-faq-answer]',
      requiresFAQContext: false
    },
    {
      name: 'legacy FAQ cards',
      cardSelector: '.faq_card',
      questionSelector: '.faq_question',
      answerSelector: '.faq_answer',
      requiresFAQContext: false
    },
    {
      name: 'Pattern accordion FAQs',
      cardSelector: '[class*="accordion_component"]',
      questionSelector: '[class*="accordion_toggle_heading"], [class*="accordion_toggle_button"]',
      answerSelector: '[class*="accordion_content_wrap"], [class*="accordion_content"]',
      contextSelector: '[class*="accordion_wrap"]',
      requiresFAQContext: true
    }
  ];

  const FAQ_HEADING_PATTERN = /\b(faqs?|frequently asked questions|common questions)\b/i;

  /**
   * Extract text content from an element, cleaning HTML tags
   */
  function getTextContent(element) {
    if (!element) return '';
    return element.textContent.trim().replace(/\s+/g, ' ');
  }

  /**
   * Get a safe class string from normal HTMLElement and SVG elements.
   */
  function getClassText(element) {
    if (!element) return '';
    if (typeof element.className === 'string') return element.className;
    if (element.className && typeof element.className.baseVal === 'string') {
      return element.className.baseVal;
    }
    return '';
  }

  /**
   * Check whether a generic accordion/toggle is intentionally being used as FAQ content.
   */
  function hasFAQContext(element, config) {
    const component = config.contextSelector ? element.closest(config.contextSelector) : null;
    let current = component || element;

    while (current && current !== document.documentElement) {
      const faqSchema = current.getAttribute('data-faq-schema');
      const schemaType = (current.getAttribute('data-schema') || current.getAttribute('data-schema-type') || '').toLowerCase();
      const classText = getClassText(current).toLowerCase();

      if (current.hasAttribute('data-faq-schema') && faqSchema !== 'false') return true;
      if (schemaType === 'faq' || schemaType === 'faqpage') return true;
      if (/(^|[\s_-])faqs?($|[\s_-])/.test(classText)) return true;

      current = current.parentElement;
    }

    const scope = (component || element).closest('section, main, article, body') || document.body;
    const headings = scope.querySelectorAll('h1, h2, h3, h4, [class*="heading"], [class*="title"]');

    return Array.from(headings).some(heading => FAQ_HEADING_PATTERN.test(getTextContent(heading)));
  }

  /**
   * Extract FAQs for one configured component shape.
   */
  function extractFAQsForConfig(config) {
    const faqs = [];
    const cardElements = document.querySelectorAll(config.cardSelector);

    cardElements.forEach(card => {
      if (config.requiresFAQContext && !hasFAQContext(card, config)) return;

      const questionEl = card.querySelector(config.questionSelector);
      const answerEl = card.querySelector(config.answerSelector);

      const question = getTextContent(questionEl);
      const answer = getTextContent(answerEl);

      if (question && answer) {
        faqs.push({ question, answer });
      }
    });

    return faqs;
  }

  /**
   * Extract FAQs from the page
   */
  function extractFAQs() {
    const faqs = [];
    const seen = new Set();

    FAQ_CONFIGS.forEach(config => {
      extractFAQsForConfig(config).forEach(faq => {
        const key = (faq.question + '\n' + faq.answer).toLowerCase();
        if (seen.has(key)) return;

        seen.add(key);
        faqs.push(faq);
      });
    });

    return faqs;
  }

  /**
   * Generate FAQ schema JSON-LD
   */
  function generateFAQSchema(faqs) {
    if (faqs.length === 0) return null;

    // Filter out any FAQs with empty or invalid content
    const validFAQs = faqs.filter(faq =>
      faq.question && faq.question.length > 3 &&
      faq.answer && faq.answer.length > 10
    );

    if (validFAQs.length === 0) return null;

    const mainEntity = validFAQs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }));

    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": mainEntity
    };
  }

  /**
   * Inject the schema into the page head
   */
  function injectSchema(schema) {
    if (!schema) return;

    try {
      // Remove any existing FAQ schema
      const existing = document.querySelector('script[data-faq-schema]');
      if (existing) {
        existing.remove();
      }

      // Create and inject new schema
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-faq-schema', 'true');
      script.textContent = JSON.stringify(schema, null, 2);
      document.head.appendChild(script);

      console.log('FAQ Schema injected successfully', schema);
    } catch (error) {
      console.error('Error injecting FAQ schema:', error);
    }
  }

  /**
   * Check if page already has FAQ schema
   */
  function hasExistingFAQSchema() {
    // Check for any existing FAQPage schema in script tags
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (let script of scripts) {
      try {
        const content = JSON.parse(script.textContent);
        const nodes = Array.isArray(content['@graph']) ? content['@graph'] : [content];
        const hasFAQ = nodes.some(node =>
          node['@type'] === 'FAQPage' ||
          (node.mainEntity && Array.isArray(node.mainEntity) &&
            node.mainEntity.some(item => item['@type'] === 'Question'))
        );

        if (hasFAQ) {
          console.log('Page already has FAQ schema, skipping generation');
          return true;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    return false;
  }

  /**
   * Main function to generate and inject schema
   */
  function generateSchema() {
    if (schemaGenerated) {
      console.log('FAQ Schema already generated, skipping duplicate run');
      return;
    }

    // Check if page already has FAQ schema (either static or dynamic)
    if (hasExistingFAQSchema()) {
      schemaGenerated = true;
      return;
    }

    const faqs = extractFAQs();
    const schema = generateFAQSchema(faqs);

    if (schema && schema.mainEntity.length > 0) {
      injectSchema(schema);
      console.log('FAQ Schema generated for', schema.mainEntity.length, 'questions');
      schemaGenerated = true;
    }
  }

  /**
   * Initialize the FAQ schema generator
   */
  function init() {
    // Wait for CMS content to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () { init(); }, 200);
      });
      return;
    }

    // If Webflow CMS is present, wait for it to render
    if (typeof Webflow !== 'undefined') {
      Webflow.push(function () {
        // Give more time for CMS content to render
        setTimeout(generateSchema, 500);
      });
    } else {
      // If no Webflow CMS, still give a small delay
      setTimeout(generateSchema, 300);
    }
  }

  // Start the process
  init();

  // Re-run if FAQ content is added after the first render, but only until schema exists.
  function observeDynamicFAQs() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;

    const observer = new MutationObserver(function (mutations) {
      if (schemaGenerated) return; // Don't re-run if already generated

      let hasFAQs = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && (
              FAQ_CONFIGS.some(config => (
                node.matches && node.matches(config.cardSelector) ||
                node.querySelector && node.querySelector(config.cardSelector)
              ))
            )) {
              hasFAQs = true;
            }
          });
        }
      });
      if (hasFAQs && !schemaGenerated) {
        setTimeout(function () {
          if (!schemaGenerated) {
            generateSchema();
          }
        }, 100);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeDynamicFAQs, { once: true });
  } else {
    observeDynamicFAQs();
  }
})();
