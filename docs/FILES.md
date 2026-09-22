# File reference

Plain-English descriptions of every tracked file on `main`. Links open the files themselves. Descriptions reflect their contents; they do not mean every file is loaded on every site.

For the dated evidence of production use, see [Production sources](PRODUCTION-SOURCES.md). Historical copies and embedded Webflow code are identified below. Existing sites may use older saved versions of a path.

## Repository and documentation

| File | Purpose |
| --- | --- |
| [.gitignore](../.gitignore) | Keeps installed packages, build output, exports, local tool settings and temporary reports out of Git. |
| [README.md](../README.md) | Introduces the repository, its folders and the distinction between saving source code and updating a published website. |
| [docs/FILES.md](../docs/FILES.md) | This file: a description and link for every tracked file on main. |
| [docs/PRODUCTION-SOURCES.md](../docs/PRODUCTION-SOURCES.md) | September 21, 2026 record of selected US and UK production dependencies, inline code copies, component sources and known limitations. It is a dated verification record, not a complete current inventory. |
| [docs/production-sources.json](../docs/production-sources.json) | Machine-readable companion to the September 21 record: 45 source paths, their origins, content fingerprints and verification references. |
| [docs/SCRIPTS.md](../docs/SCRIPTS.md) | Historical June 2026 inventory of Flowdrive scripts copied into GitHub, with original URLs, file fingerprints and proposed v1.0.1 replacements. |
| [docs/WEBFLOW-FOOTER-CODE.md](../docs/WEBFLOW-FOOTER-CODE.md) | Historical v1.0.1 footer migration candidate and its validation checklist. It is not the current installation recipe for every site. |

## Content scripts

Folder: `webflow/pattern.com/scripts/content/`

These files control page content. The Pi slider and Page Anchor source copies are used as inline Webflow code; a JavaScript extension does not by itself mean a file is loaded from a CDN.

| File | Purpose |
| --- | --- |
| [box-slider-slot-controls.js](../webflow/pattern.com/scripts/content/box-slider-slot-controls.js) | Controls the authored Box Slider / Slider Alt slides, previous/next controls, swipe gestures and animated content transitions; skips marked legacy page versions. |
| [case-study-cms-slider.js](../webflow/pattern.com/scripts/content/case-study-cms-slider.js) | Reads case-study records from Webflow CMS items and coordinates their images, text, statistics and controls in a Swiper-based slider. |
| [cta-inject.js](../webflow/pattern.com/scripts/content/cta-inject.js) | Clones a marked call-to-action block into a marked rich-text article immediately before its third H2 heading, using a wrapper to isolate its styling. |
| [logos.js](../webflow/pattern.com/scripts/content/logos.js) | Rotates the brand logos in six marked groups, showing one logo per group and suppressing initial flashes and conflicting older transitions. |
| [pi-welcome-slider-controller.js](../webflow/pattern.com/scripts/content/pi-welcome-slider-controller.js) | Controls the Pi feature slider, including its text, visual, theme and playback state. Keeps authored slides mounted and plays the active Pi animation scene. |
| [rich-text-heading-conversion.js](../webflow/pattern.com/scripts/content/rich-text-heading-conversion.js) | Keeps the first H1 on the page and converts subsequent H1 elements to H2, including headings added later. Its selection is page-wide despite the filename. |
| [toc.js](../webflow/pattern.com/scripts/content/toc.js) | Builds an article table of contents from headings, creates usable heading IDs, handles scrolling and active-link highlighting, and hides the table when there is no usable article content. |

## Interaction scripts

Folder: `webflow/pattern.com/scripts/interaction/`

| File | Purpose |
| --- | --- |
| [accordion.js](../webflow/pattern.com/scripts/interaction/accordion.js) | Initializes Pattern accordion groups, prepares nested Webflow/CMS wrappers, and opens or closes panels while updating their state and accessibility attributes. |
| [card-load-animations-v10.js](../webflow/pattern.com/scripts/interaction/card-load-animations-v10.js) | Small loader that watches marked card grids and fetches the matching .full.js animation file only when a relevant grid approaches the viewport. |
| [card-load-animations-v10.full.js](../webflow/pattern.com/scripts/interaction/card-load-animations-v10.full.js) | Full card-animation implementation: drop-in, fade-in and rolling count-up effects, using GSAP and ScrollTrigger with optional SplitText. |
| [lazy-load.js](../webflow/pattern.com/scripts/interaction/lazy-load.js) | Applies browser lazy-loading hints to selected images, with exclusions for marked brand logos, hero content and other prioritized images in its selection rules. |
| [marquee.js](../webflow/pattern.com/scripts/interaction/marquee.js) | Builds repeating scrolling rows from marked content, measures and clones items to fill the track, and manages resizing, visibility and reduced-motion preferences. Pairs with styles/marquee.css. |
| [pagination-fix.js](../webflow/pattern.com/scripts/interaction/pagination-fix.js) | Prevents a pagination link destination from changing during a click, addressing the Finsweet/Safari navigation timing issue; blocks disabled pagination links. |
| [v3-heading-text-reveal.js](../webflow/pattern.com/scripts/interaction/v3-heading-text-reveal.js) | Animates opted-in V3 heading text with GSAP/SplitText, waiting for fonts and applying separate eligibility rules to page-hero headings. Handles cleanup and reduced-motion preferences. |

## Media scripts

Folder: `webflow/pattern.com/scripts/media/`

| File | Purpose |
| --- | --- |
| [iframe-popup.js](../webflow/pattern.com/scripts/media/iframe-popup.js) | Opens and closes generic iframe popups, locks page scrolling and assigns the iframe URL only after the required consent category is allowed. |
| [video-popup.js](../webflow/pattern.com/scripts/media/video-popup.js) | Controls the Video Player dialog, normalizes video URLs, waits for required consent, manages focus and page scrolling, and stops the embedded player when closed. |
| [video-preview.js](../webflow/pattern.com/scripts/media/video-preview.js) | Loads and attempts to play marked inline video previews when they enter the viewport and any required consent is allowed. This is separate from the popup player. |

## Navigation scripts

Folder: `webflow/pattern.com/scripts/nav/`

| File | Purpose |
| --- | --- |
| [home-anchor-nav.js](../webflow/pattern.com/scripts/nav/home-anchor-nav.js) | Positions the homepage section navigation, handles offset-aware scrolling to linked sections, and highlights the active section as the page scrolls. Pairs with styles/home-anchor-nav.css. |
| [nav.js](../webflow/pattern.com/scripts/nav/nav.js) | Controls the nav_wrap navigation system across desktop and mobile: dropdown panels, overlay state, keyboard activation and synchronization with the Webflow mobile menu. |
| [page-anchor.js](../webflow/pattern.com/scripts/nav/page-anchor.js) | Inline controller for the Page Anchor component: scrolls horizontally between its items in the mobile layout and pauses automatic movement during interaction or reduced-motion mode. It does not implement the homepage sticky section navigation. |
| [v1-nav-desktop.js](../webflow/pattern.com/scripts/nav/v1-nav-desktop.js) | GSAP-based desktop behavior for older navigation structures, including overlays and dropdowns in the nav_bottom and navbar_wrap systems. |
| [v1-nav-mobile.js](../webflow/pattern.com/scripts/nav/v1-nav-mobile.js) | GSAP-based mobile behavior for older navigation structures, including dropdowns, the menu shell and cleanup when the layout changes. |
| [v1-nav-mobile-block.js](../webflow/pattern.com/scripts/nav/v1-nav-mobile-block.js) | Prevents clicks on the mobile navigation overlay from closing the menu while leaving the menu links interactive. |

## Shared script loaders

Folder: `webflow/pattern.com/scripts/runtime/`

A runtime is a shared loader that finds supported components on a page and starts the scripts they need. Sites can use different saved versions of these files.

| File | Purpose |
| --- | --- |
| [pattern-runtime-consumer-0.2.1.js](../webflow/pattern.com/scripts/runtime/pattern-runtime-consumer-0.2.1.js) | Consumer-site runtime: detects supported markup, loads component dependencies, starts modules and watches for new content. Includes dynamic-year and selected Finsweet integrations. |
| [pattern-runtime-library-0.3.1.js](../webflow/pattern.com/scripts/runtime/pattern-runtime-library-0.3.1.js) | Library runtime: detects supported components and loads their scripts/styles, including the V3 heading reveal and video modules. The copy on main is not a declaration that every live Library page loads this exact revision. |
| [pattern-version-gateway.js](../webflow/pattern.com/scripts/runtime/pattern-version-gateway.js) | Detects V1, V2, V2L or V3 page markers and plans or loads the matching component assets. Defaults to observation, preserves legacy delivery and avoids automatic activation for ambiguous page versions. |

## Search-engine metadata

Folder: `webflow/pattern.com/scripts/schema/`

| File | Purpose |
| --- | --- |
| [faq-schema-generator.js](../webflow/pattern.com/scripts/schema/faq-schema-generator.js) | Reads recognized FAQ questions and answers from the page and creates structured FAQ data for search engines. Generic accordions need FAQ context or an explicit marker. |

## Hosted stylesheets

Folder: `webflow/pattern.com/styles/`

| File | Purpose |
| --- | --- |
| [home-anchor-nav.css](../webflow/pattern.com/styles/home-anchor-nav.css) | Styles the homepage section navigation, its active link, positioning layer and compact scrolling layout. |
| [marquee.css](../webflow/pattern.com/styles/marquee.css) | Defines the marquee scrolling animation, edge fades, track layout and playback states used by the marquee script. |
| [nav.css](../webflow/pattern.com/styles/nav.css) | Defines overlays, underlines and panel visibility/transitions for the nav_wrap controller in scripts/nav/nav.js. |
| [pagination-fix.css](../webflow/pattern.com/styles/pagination-fix.css) | Hides next/previous pagination controls marked as disabled and prevents pointer interaction with them. |
| [v3-utility-bridge.css](../webflow/pattern.com/styles/v3-utility-bridge.css) | Scopes V3 layout and typography utilities to approved V3 boundaries so they can coexist with older page styles; includes compatibility adjustments for those utilities. |

## Webflow embed source copies

Folder: `webflow/pattern.com/embeds/`

These HTML files contain script or style blocks copied into Webflow. Editing their GitHub copies alone does not change the embedded code on a website.

| File | Purpose |
| --- | --- |
| [global-layout-styles.html](../webflow/pattern.com/embeds/global-layout-styles.html) | Shared layout and typography foundation: grid variables, element resets, spacing/alignment helpers, text trimming, focus styles and component utility rules. |
| [home-hero-script.html](../webflow/pattern.com/embeds/home-hero-script.html) | Controls the homepage hero slides, navigation/progress indicators, automatic playback, responsive posters and deferred background-video loading. |
| [legacy-compatibility-styles.html](../webflow/pattern.com/embeds/legacy-compatibility-styles.html) | Keeps older V1 layouts and typography working during the V3 transition by mapping legacy variables and utilities to the localized design-system values. |
| [marketo-footer-styles.html](../webflow/pattern.com/embeds/marketo-footer-styles.html) | Styles the footer Marketo form, including its layout, dark field appearance, autofill and related compatibility overrides. |
| [marketo-global-styles.html](../webflow/pattern.com/embeds/marketo-global-styles.html) | Styles forms inside V3 data-marketo-form-id components: labels, inputs, consent text, submit buttons and validation messages. Excludes legacy forms and Marketo measurement forms. |
| [slider-script.html](../webflow/pattern.com/embeds/slider-script.html) | Prepares installed Library slider markup for the existing Swiper initializer by adding class aliases and flattening display-contents wrappers; configures responsive looping for eligible sliders. |
| [tab-styles.html](../webflow/pattern.com/embeds/tab-styles.html) | Styles horizontal tab layout and Pi Tab link hover/selected states. |
| [v3-navigation.html](../webflow/pattern.com/embeds/v3-navigation.html) | Controls V3 nested navigation levels and responsive menu state, remembers banner dismissal for the session, and moves focus to main content through the skip link. |

## Pi animation application assets

Folder: `webflow/pattern.com/scripts/components/pi-welcome/`

These compiled application assets are inputs to the Pi Welcome code component. The original upstream animation application source is outside this repository.

| File | Purpose |
| --- | --- |
| [pi-welcome-elements.js](../webflow/pattern.com/scripts/components/pi-welcome/pi-welcome-elements.js) | Compiled Pi animation application that registers the pi-welcome-animation custom element and implements its scene, play, pause and replay behavior. |
| [pi-welcome-elements.css](../webflow/pattern.com/scripts/components/pi-welcome/pi-welcome-elements.css) | Compiled visual styles and animations used inside the Pi custom element, including its internal root sizing. The component build retains it as a separate stylesheet file. |

## Code component package

Folder: `webflow/pattern.com/code-components/`

| File | Purpose |
| --- | --- |
| [README.md](../webflow/pattern.com/code-components/README.md) | Describes the Pattern Icon and Pi Welcome components, their required source assets, local validation/build commands and separate Webflow upload step. |
| [package.json](../webflow/pattern.com/code-components/package.json) | Defines the component package, minimum Node version, dependencies and commands for type checking, icon verification, previewing, bundling and importing into Webflow. |
| [package-lock.json](../webflow/pattern.com/code-components/package-lock.json) | Records the exact dependency versions and integrity values used for repeatable package installation. |
| [tsconfig.json](../webflow/pattern.com/code-components/tsconfig.json) | Sets strict TypeScript checking for the component source and tests, including browser APIs and React JSX. Does not emit compiled files. |
| [webflow.json](../webflow/pattern.com/code-components/webflow.json) | Declares the Webflow code library, component discovery pattern and custom bundle configuration. |
| [webpack.webflow.cjs](../webflow/pattern.com/code-components/webpack.webflow.cjs) | Customizes bundling so the Pi stylesheet remains a real file usable inside its shadow root, and suppresses the known dynamic-import warning from the compiled Pi export. |
| [src/components/PatternIcon.tsx](../webflow/pattern.com/code-components/src/components/PatternIcon.tsx) | Renders an icon from the local SVG registry with size, color and accessible-label options; falls back to arrow-right for unknown names. |
| [src/components/PatternIcon.webflow.tsx](../webflow/pattern.com/code-components/src/components/PatternIcon.webflow.tsx) | Registers Pattern Icon with Webflow and exposes its icon, size, color and accessible-label controls in the Designer. |
| [src/components/PiWelcomeAnimation.tsx](../webflow/pattern.com/code-components/src/components/PiWelcomeAnimation.tsx) | React wrapper that loads the Pi custom element in the browser, chooses its scene and playback state, and scales it to fit the available width. |
| [src/components/PiWelcomeAnimation.webflow.tsx](../webflow/pattern.com/code-components/src/components/PiWelcomeAnimation.webflow.tsx) | Registers Pi Welcome Animation with Webflow and exposes scene selection and autoplay controls; disables server-side rendering for this component. |
| [tests/render-preview.tsx](../webflow/pattern.com/code-components/tests/render-preview.tsx) | Creates a local HTML preview of six sample Pattern icons at different sizes and colors. |
| [tests/verify-icons.tsx](../webflow/pattern.com/code-components/tests/verify-icons.tsx) | Checks the 1,500-icon inventory, unique names, drawing definitions, accessible rendering, color/size options and the unknown-name fallback. |
| [src/generated/index.ts](../webflow/pattern.com/code-components/src/generated/index.ts) | Combines the 75 icon data files into one registry and exports the available icon names and name type used by the component. |
| [src/generated/types.ts](../webflow/pattern.com/code-components/src/generated/types.ts) | Defines the TypeScript shapes for an SVG drawing definition and a map of icon names to drawings. |

## Generated icon data files

Folder: `webflow/pattern.com/code-components/src/generated/`

Each file holds 20 icon drawings. Together they supply all 1,500 icons; these are required component data, not disposable build output. The names below identify the first and last entries in each file.

| File | Purpose |
| --- | --- |
| [icons-00.ts](../webflow/pattern.com/code-components/src/generated/icons-00.ts) | SVG drawing data for 20 icons, from `12hr-clock` through `ai-bot`; combined by `index.ts` for Pattern Icon. |
| [icons-01.ts](../webflow/pattern.com/code-components/src/generated/icons-01.ts) | SVG drawing data for 20 icons, from `ai-document` through `align-centre-vertical`; combined by `index.ts` for Pattern Icon. |
| [icons-02.ts](../webflow/pattern.com/code-components/src/generated/icons-02.ts) | SVG drawing data for 20 icons, from `align-horizontal-centre` through `apple-watch-ultra`; combined by `index.ts` for Pattern Icon. |
| [icons-03.ts](../webflow/pattern.com/code-components/src/generated/icons-03.ts) | SVG drawing data for 20 icons, from `apps` through `arrow-down-circle-attached`; combined by `index.ts` for Pattern Icon. |
| [icons-04.ts](../webflow/pattern.com/code-components/src/generated/icons-04.ts) | SVG drawing data for 20 icons, from `arrow-down-left` through `arrow-up-right`; combined by `index.ts` for Pattern Icon. |
| [icons-05.ts](../webflow/pattern.com/code-components/src/generated/icons-05.ts) | SVG drawing data for 20 icons, from `arrow-up-right-circle` through `balance-sheet`; combined by `index.ts` for Pattern Icon. |
| [icons-06.ts](../webflow/pattern.com/code-components/src/generated/icons-06.ts) | SVG drawing data for 20 icons, from `ball` through `battery-error`; combined by `index.ts` for Pattern Icon. |
| [icons-07.ts](../webflow/pattern.com/code-components/src/generated/icons-07.ts) | SVG drawing data for 20 icons, from `battery-full` through `bicycle`; combined by `index.ts` for Pattern Icon. |
| [icons-08.ts](../webflow/pattern.com/code-components/src/generated/icons-08.ts) | SVG drawing data for 20 icons, from `binary` through `book-2`; combined by `index.ts` for Pattern Icon. |
| [icons-09.ts](../webflow/pattern.com/code-components/src/generated/icons-09.ts) | SVG drawing data for 20 icons, from `book-open` through `bowl`; combined by `index.ts` for Pattern Icon. |
| [icons-10.ts](../webflow/pattern.com/code-components/src/generated/icons-10.ts) | SVG drawing data for 20 icons, from `bowling` through `brightness-medium`; combined by `index.ts` for Pattern Icon. |
| [icons-11.ts](../webflow/pattern.com/code-components/src/generated/icons-11.ts) | SVG drawing data for 20 icons, from `bring-forward` through `bulb-check`; combined by `index.ts` for Pattern Icon. |
| [icons-12.ts](../webflow/pattern.com/code-components/src/generated/icons-12.ts) | SVG drawing data for 20 icons, from `bulb-cross` through `calendar-plus`; combined by `index.ts` for Pattern Icon. |
| [icons-13.ts](../webflow/pattern.com/code-components/src/generated/icons-13.ts) | SVG drawing data for 20 icons, from `calendar-timer` through `car-door`; combined by `index.ts` for Pattern Icon. |
| [icons-14.ts](../webflow/pattern.com/code-components/src/generated/icons-14.ts) | SVG drawing data for 20 icons, from `car-engine` through `chart-3`; combined by `index.ts` for Pattern Icon. |
| [icons-15.ts](../webflow/pattern.com/code-components/src/generated/icons-15.ts) | SVG drawing data for 20 icons, from `chart-left-arrow-up` through `chevron-down`; combined by `index.ts` for Pattern Icon. |
| [icons-16.ts](../webflow/pattern.com/code-components/src/generated/icons-16.ts) | SVG drawing data for 20 icons, from `chevron-down-large` through `circle-dotted`; combined by `index.ts` for Pattern Icon. |
| [icons-17.ts](../webflow/pattern.com/code-components/src/generated/icons-17.ts) | SVG drawing data for 20 icons, from `circle-intersect` through `cloud-off`; combined by `index.ts` for Pattern Icon. |
| [icons-18.ts](../webflow/pattern.com/code-components/src/generated/icons-18.ts) | SVG drawing data for 20 icons, from `clubs` through `comment-check`; combined by `index.ts` for Pattern Icon. |
| [icons-19.ts](../webflow/pattern.com/code-components/src/generated/icons-19.ts) | SVG drawing data for 20 icons, from `comment-love` through `crop`; combined by `index.ts` for Pattern Icon. |
| [icons-20.ts](../webflow/pattern.com/code-components/src/generated/icons-20.ts) | SVG drawing data for 20 icons, from `crosshair` through `data-transfer`; combined by `index.ts` for Pattern Icon. |
| [icons-21.ts](../webflow/pattern.com/code-components/src/generated/icons-21.ts) | SVG drawing data for 20 icons, from `data-transfer-check` through `dice-4`; combined by `index.ts` for Pattern Icon. |
| [icons-22.ts](../webflow/pattern.com/code-components/src/generated/icons-22.ts) | SVG drawing data for 20 icons, from `dice-5` through `dollar`; combined by `index.ts` for Pattern Icon. |
| [icons-23.ts](../webflow/pattern.com/code-components/src/generated/icons-23.ts) | SVG drawing data for 20 icons, from `dollar-2` through `double-chevron-left`; combined by `index.ts` for Pattern Icon. |
| [icons-24.ts](../webflow/pattern.com/code-components/src/generated/icons-24.ts) | SVG drawing data for 20 icons, from `double-chevron-right` through `ear`; combined by `index.ts` for Pattern Icon. |
| [icons-25.ts](../webflow/pattern.com/code-components/src/generated/icons-25.ts) | SVG drawing data for 20 icons, from `ear-off` through `emoji-plus`; combined by `index.ts` for Pattern Icon. |
| [icons-26.ts](../webflow/pattern.com/code-components/src/generated/icons-26.ts) | SVG drawing data for 20 icons, from `emoji-sad` through `face-big-smile`; combined by `index.ts` for Pattern Icon. |
| [icons-27.ts](../webflow/pattern.com/code-components/src/generated/icons-27.ts) | SVG drawing data for 20 icons, from `face-check` through `fast-forward`; combined by `index.ts` for Pattern Icon. |
| [icons-28.ts](../webflow/pattern.com/code-components/src/generated/icons-28.ts) | SVG drawing data for 20 icons, from `fast-train` through `file-text`; combined by `index.ts` for Pattern Icon. |
| [icons-29.ts](../webflow/pattern.com/code-components/src/generated/icons-29.ts) | SVG drawing data for 20 icons, from `file-text-2` through `fish`; combined by `index.ts` for Pattern Icon. |
| [icons-30.ts](../webflow/pattern.com/code-components/src/generated/icons-30.ts) | SVG drawing data for 20 icons, from `fishes` through `folder-check`; combined by `index.ts` for Pattern Icon. |
| [icons-31.ts](../webflow/pattern.com/code-components/src/generated/icons-31.ts) | SVG drawing data for 20 icons, from `folder-cross` through `forbid-2`; combined by `index.ts` for Pattern Icon. |
| [icons-32.ts](../webflow/pattern.com/code-components/src/generated/icons-32.ts) | SVG drawing data for 20 icons, from `fork` through `gbp`; combined by `index.ts` for Pattern Icon. |
| [icons-33.ts](../webflow/pattern.com/code-components/src/generated/icons-33.ts) | SVG drawing data for 20 icons, from `gemini` through `golf`; combined by `index.ts` for Pattern Icon. |
| [icons-34.ts](../webflow/pattern.com/code-components/src/generated/icons-34.ts) | SVG drawing data for 20 icons, from `golf-ball` through `hairdryer`; combined by `index.ts` for Pattern Icon. |
| [icons-35.ts](../webflow/pattern.com/code-components/src/generated/icons-35.ts) | SVG drawing data for 20 icons, from `half-circle-bottom` through `headphones-2`; combined by `index.ts` for Pattern Icon. |
| [icons-36.ts](../webflow/pattern.com/code-components/src/generated/icons-36.ts) | SVG drawing data for 20 icons, from `headphones-3` through `highlighter-2`; combined by `index.ts` for Pattern Icon. |
| [icons-37.ts](../webflow/pattern.com/code-components/src/generated/icons-37.ts) | SVG drawing data for 20 icons, from `home` through `incognito`; combined by `index.ts` for Pattern Icon. |
| [icons-38.ts](../webflow/pattern.com/code-components/src/generated/icons-38.ts) | SVG drawing data for 20 icons, from `indent-left` through `jetski`; combined by `index.ts` for Pattern Icon. |
| [icons-39.ts](../webflow/pattern.com/code-components/src/generated/icons-39.ts) | SVG drawing data for 20 icons, from `journal` through `lamp-ceiling`; combined by `index.ts` for Pattern Icon. |
| [icons-40.ts](../webflow/pattern.com/code-components/src/generated/icons-40.ts) | SVG drawing data for 20 icons, from `landscape` through `layout-bottom`; combined by `index.ts` for Pattern Icon. |
| [icons-41.ts](../webflow/pattern.com/code-components/src/generated/icons-41.ts) | SVG drawing data for 20 icons, from `layout-left` through `lightning`; combined by `index.ts` for Pattern Icon. |
| [icons-42.ts](../webflow/pattern.com/code-components/src/generated/icons-42.ts) | SVG drawing data for 20 icons, from `line-height` through `magic-wand`; combined by `index.ts` for Pattern Icon. |
| [icons-43.ts](../webflow/pattern.com/code-components/src/generated/icons-43.ts) | SVG drawing data for 20 icons, from `magnet` through `merge`; combined by `index.ts` for Pattern Icon. |
| [icons-44.ts](../webflow/pattern.com/code-components/src/generated/icons-44.ts) | SVG drawing data for 20 icons, from `message` through `money-bag`; combined by `index.ts` for Pattern Icon. |
| [icons-45.ts](../webflow/pattern.com/code-components/src/generated/icons-45.ts) | SVG drawing data for 20 icons, from `monitor` through `new-hire`; combined by `index.ts` for Pattern Icon. |
| [icons-46.ts](../webflow/pattern.com/code-components/src/generated/icons-46.ts) | SVG drawing data for 20 icons, from `new-window` through `nut`; combined by `index.ts` for Pattern Icon. |
| [icons-47.ts](../webflow/pattern.com/code-components/src/generated/icons-47.ts) | SVG drawing data for 20 icons, from `octagon` through `parking`; combined by `index.ts` for Pattern Icon. |
| [icons-48.ts](../webflow/pattern.com/code-components/src/generated/icons-48.ts) | SVG drawing data for 20 icons, from `party` through `periodic-table`; combined by `index.ts` for Pattern Icon. |
| [icons-49.ts](../webflow/pattern.com/code-components/src/generated/icons-49.ts) | SVG drawing data for 20 icons, from `person` through `phone-call-outgoing`; combined by `index.ts` for Pattern Icon. |
| [icons-50.ts](../webflow/pattern.com/code-components/src/generated/icons-50.ts) | SVG drawing data for 20 icons, from `phone-check` through `pin`; combined by `index.ts` for Pattern Icon. |
| [icons-51.ts](../webflow/pattern.com/code-components/src/generated/icons-51.ts) | SVG drawing data for 20 icons, from `pin-circle` through `plus`; combined by `index.ts` for Pattern Icon. |
| [icons-52.ts](../webflow/pattern.com/code-components/src/generated/icons-52.ts) | SVG drawing data for 20 icons, from `plus-circle` through `private-wifi`; combined by `index.ts` for Pattern Icon. |
| [icons-53.ts](../webflow/pattern.com/code-components/src/generated/icons-53.ts) | SVG drawing data for 20 icons, from `professor` through `receive-money`; combined by `index.ts` for Pattern Icon. |
| [icons-54.ts](../webflow/pattern.com/code-components/src/generated/icons-54.ts) | SVG drawing data for 20 icons, from `rectangle-face` through `rotate`; combined by `index.ts` for Pattern Icon. |
| [icons-55.ts](../webflow/pattern.com/code-components/src/generated/icons-55.ts) | SVG drawing data for 20 icons, from `rotate-2` through `safe-flash`; combined by `index.ts` for Pattern Icon. |
| [icons-56.ts](../webflow/pattern.com/code-components/src/generated/icons-56.ts) | SVG drawing data for 20 icons, from `safety-pin` through `sd-card`; combined by `index.ts` for Pattern Icon. |
| [icons-57.ts](../webflow/pattern.com/code-components/src/generated/icons-57.ts) | SVG drawing data for 20 icons, from `search` through `settings-2`; combined by `index.ts` for Pattern Icon. |
| [icons-58.ts](../webflow/pattern.com/code-components/src/generated/icons-58.ts) | SVG drawing data for 20 icons, from `settings-sliders` through `shipment-arrow-down`; combined by `index.ts` for Pattern Icon. |
| [icons-59.ts](../webflow/pattern.com/code-components/src/generated/icons-59.ts) | SVG drawing data for 20 icons, from `shirt` through `signature`; combined by `index.ts` for Pattern Icon. |
| [icons-60.ts](../webflow/pattern.com/code-components/src/generated/icons-60.ts) | SVG drawing data for 20 icons, from `single-bed` through `snapchat`; combined by `index.ts` for Pattern Icon. |
| [icons-61.ts](../webflow/pattern.com/code-components/src/generated/icons-61.ts) | SVG drawing data for 20 icons, from `sneaker` through `speaker-mute`; combined by `index.ts` for Pattern Icon. |
| [icons-62.ts](../webflow/pattern.com/code-components/src/generated/icons-62.ts) | SVG drawing data for 20 icons, from `speaker-mute-2` through `split-cells-vertical`; combined by `index.ts` for Pattern Icon. |
| [icons-63.ts](../webflow/pattern.com/code-components/src/generated/icons-63.ts) | SVG drawing data for 20 icons, from `spoon` through `steering-wheel`; combined by `index.ts` for Pattern Icon. |
| [icons-64.ts](../webflow/pattern.com/code-components/src/generated/icons-64.ts) | SVG drawing data for 20 icons, from `stethoscope` through `t-shirt`; combined by `index.ts` for Pattern Icon. |
| [icons-65.ts](../webflow/pattern.com/code-components/src/generated/icons-65.ts) | SVG drawing data for 20 icons, from `table-columns` through `tetris`; combined by `index.ts` for Pattern Icon. |
| [icons-66.ts](../webflow/pattern.com/code-components/src/generated/icons-66.ts) | SVG drawing data for 20 icons, from `text` through `timer-2`; combined by `index.ts` for Pattern Icon. |
| [icons-67.ts](../webflow/pattern.com/code-components/src/generated/icons-67.ts) | SVG drawing data for 20 icons, from `timer-3` through `train-arriving`; combined by `index.ts` for Pattern Icon. |
| [icons-68.ts](../webflow/pattern.com/code-components/src/generated/icons-68.ts) | SVG drawing data for 20 icons, from `train-departing` through `truck`; combined by `index.ts` for Pattern Icon. |
| [icons-69.ts](../webflow/pattern.com/code-components/src/generated/icons-69.ts) | SVG drawing data for 20 icons, from `truck-2` through `union-mask`; combined by `index.ts` for Pattern Icon. |
| [icons-70.ts](../webflow/pattern.com/code-components/src/generated/icons-70.ts) | SVG drawing data for 20 icons, from `unordered-list` through `users`; combined by `index.ts` for Pattern Icon. |
| [icons-71.ts](../webflow/pattern.com/code-components/src/generated/icons-71.ts) | SVG drawing data for 20 icons, from `users-check` through `virus`; combined by `index.ts` for Pattern Icon. |
| [icons-72.ts](../webflow/pattern.com/code-components/src/generated/icons-72.ts) | SVG drawing data for 20 icons, from `vision-pro` through `weed`; combined by `index.ts` for Pattern Icon. |
| [icons-73.ts](../webflow/pattern.com/code-components/src/generated/icons-73.ts) | SVG drawing data for 20 icons, from `west` through `wine`; combined by `index.ts` for Pattern Icon. |
| [icons-74.ts](../webflow/pattern.com/code-components/src/generated/icons-74.ts) | SVG drawing data for 20 icons, from `wink` through `zoom-out`; combined by `index.ts` for Pattern Icon. |

## UK version-specific styles

Folder: `webflow/uk.pattern.com/version-split/css/`

These files separate shared styling from older V1 and V2 page styling. Their filenames describe roles; the source record documents which saved versions were observed on the UK site.

| File | Purpose |
| --- | --- |
| [shared.css](../webflow/uk.pattern.com/version-split/css/shared.css) | Shared UK foundation: layout variables, resets, typography and general utility rules used across the supported page versions. |
| [features.css](../webflow/uk.pattern.com/version-split/css/features.css) | UK feature styling, including the Tabler icon-font import and rules for cards, icons and other shared components. |
| [v1.css](../webflow/uk.pattern.com/version-split/css/v1.css) | UK V1 compatibility styles: legacy layout, typography and theme aliases plus V1-specific spacing and fidelity adjustments. |
| [v2.css](../webflow/uk.pattern.com/version-split/css/v2.css) | UK V2 content-wrapper alignment and related rich-text alignment corrections, scoped to V2 page markers. |

## UK version-specific scripts

Folder: `webflow/uk.pattern.com/version-split/js/`

| File | Purpose |
| --- | --- |
| [loader.js](../webflow/uk.pattern.com/version-split/js/loader.js) | Reads the page version marker and loads shared and V1/V2 scripts plus selected feature scripts when their markup is present. Refuses conflicting or invalid markers and records loaded, skipped and failed dependencies. |
| [shared.js](../webflow/uk.pattern.com/version-split/js/shared.js) | Preserves the shared pageFunctions registry and runs registered page functions once when the document is ready. |
| [v1.js](../webflow/uk.pattern.com/version-split/js/v1.js) | Intentional V1 placeholder containing only strict mode and explanatory comments; currently adds no V1-specific behavior. |
| [v2.js](../webflow/uk.pattern.com/version-split/js/v2.js) | Intentional V2 placeholder containing only strict mode and explanatory comments; currently adds no V2-specific behavior. |

## Archived former root files

Folder: `webflow/pattern.com/archive/legacy-root/`

These files previously lived at the repository root. Archive does not mean safe to delete: the two TEKNKL libraries are recorded as production dependencies. The other entries are historical implementations, not the default choice for new work.

| File | Purpose |
| --- | --- |
| [copyright.js](../webflow/pattern.com/archive/legacy-root/copyright.js) | Updates the element with ID copyright-year to the current year when the page loads. |
| [nav.js](../webflow/pattern.com/archive/legacy-root/nav.js) | Earlier GSAP navigation implementation with desktop/mobile dropdown and overlay behavior plus verbose loading diagnostics. |
| [nav_overlay.js](../webflow/pattern.com/archive/legacy-root/nav_overlay.js) | Earlier pageFunctions-registered desktop hover behavior that fades the navigation overlay and changes the navigation background/text colors. |
| [teknkl-formsplus-core-1.0.8.js](../webflow/pattern.com/archive/legacy-root/teknkl-formsplus-core-1.0.8.js) | Third-party FormsPlus utilities used by form integrations, including cookie/URL helpers and a form-input value lock. Supplies utilities required by SimpleDTO. |
| [teknkl-simpledto-2.0.4.js](../webflow/pattern.com/archive/legacy-root/teknkl-simpledto-2.0.4.js) | Third-party SimpleDTO library for transferring Marketo prefill data through a hidden iframe and document or message transport. Depends on FormsPlus. |

## Archived May 28 source snapshot

Folder: `webflow/pattern.com/archive/pattern-2026-05-28/`

Retained historical source and debugging material. Descriptions explain the contents; they do not establish that these exact copies are currently loaded by a production page.

| File | Purpose |
| --- | --- |
| [CSS Merge/Untitled-2](../webflow/pattern.com/archive/pattern-2026-05-28/CSS%20Merge/Untitled-2) | Unextended CSS snippet defining dark and light product/hero background gradients. |
| [CSS Merge/v1_base.css](../webflow/pattern.com/archive/pattern-2026-05-28/CSS%20Merge/v1_base.css) | Historical V1 foundation stylesheet with grid and font variables, responsive spacing, resets and utility rules. |
| [CSS Merge/v2_base.css](../webflow/pattern.com/archive/pattern-2026-05-28/CSS%20Merge/v2_base.css) | Historical V2 foundation stylesheet with typography, resets, component states, utilities and feature styling. |
| [accordion-pattern-library-v2.js](../webflow/pattern.com/archive/pattern-2026-05-28/accordion-pattern-library-v2.js) | Earlier accordion implementation for Pattern Library V2 class names, including CMS wrapper preparation and panel toggling. |
| [animation_video-bkg.js](../webflow/pattern.com/archive/pattern-2026-05-28/animation_video-bkg.js) | Historical HTML script block that uses GSAP/ScrollTrigger to move, enlarge and square off a section video background during scrolling. Despite its extension, it includes script tags. |
| [claude_merge.css](../webflow/pattern.com/archive/pattern-2026-05-28/claude_merge.css) | Historical combined stylesheet containing shared rules plus separate V1 and V2 sections. |
| [claude_shared.css](../webflow/pattern.com/archive/pattern-2026-05-28/claude_shared.css) | Historical shared reset section from the split stylesheet set. |
| [claude_v1.css](../webflow/pattern.com/archive/pattern-2026-05-28/claude_v1.css) | Historical V1 section with layout, typography, theme and legacy utility rules. |
| [claude_v2.css](../webflow/pattern.com/archive/pattern-2026-05-28/claude_v2.css) | Historical V2 section with layout and component rules for both ordinary and Library-prefixed classes. |
| [nav-link-underline-animation.css](../webflow/pattern.com/archive/pattern-2026-05-28/nav-link-underline-animation.css) | Adds a left-to-right underline animation when a nav_links_link is hovered. |
| [pattern-us.shared.css](../webflow/pattern.com/archive/pattern-2026-05-28/pattern-us.shared.css) | Archived generated Pattern US stylesheet containing Webflow foundations and site class rules. |
| [performance-center_modal_mask.js](../webflow/pattern.com/archive/pattern-2026-05-28/performance-center_modal_mask.js) | Historical HTML script block that shows or hides the Performance Center popup bottom fade according to content overflow and scroll position. Includes script tags. |
| [u-bg-gradients.css](../webflow/pattern.com/archive/pattern-2026-05-28/u-bg-gradients.css) | Historical background-gradient utility classes for dark product, light hero and section backgrounds. |
| [v1-nav-desktop.js](../webflow/pattern.com/archive/pattern-2026-05-28/v1-nav-desktop.js) | Earlier V1 desktop navigation with dropdown/overlay behavior and homepage top-of-page versus scrolled color changes. |
| [video-popup-diagnostic.js](../webflow/pattern.com/archive/pattern-2026-05-28/video-popup-diagnostic.js) | Browser-console diagnostic snippet that inspects video-popup markup and reports information useful for troubleshooting. |
| [video-popup-external.js](../webflow/pattern.com/archive/pattern-2026-05-28/video-popup-external.js) | Earlier external popup controller for Vimeo and YouTube, including embed-URL normalization and player open/close behavior. |
