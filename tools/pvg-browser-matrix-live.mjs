import fs from "node:fs/promises";
import { chromium } from "playwright";

// Read-only live staging verifier. It does not call Webflow APIs or publish.
const PVG_VERSION = "0.2.4";
const ORIGIN =
  process.env.PVG_ORIGIN ?? "https://pattern-us.webflow.io";
const OUTPUT =
  process.env.PVG_OUTPUT ??
  "/Users/kenneth/_Projects/pattern/audits/pvg/2026-07-30-us-staging-pvg-0.2.4-browser-matrix.json";
const SCREENSHOT_DIR =
  process.env.PVG_SCREENSHOT_DIR ??
  "/Users/kenneth/_Projects/pattern/output/playwright/pvg-0.2.4-v1-v2-v3";

const ROUTES = [
  {
    path: "/software",
    expectedVersion: "v1",
    role: "V1 core product page and legacy navigation",
  },
  {
    path: "/products/marketplace-accelerator-china",
    expectedVersion: "v1",
    role: "V1 accordion and marquee",
  },
  {
    path: "/resources/blog",
    expectedVersion: "v1",
    role: "V1 CMS listing",
  },
  {
    path: "/about/leadership",
    expectedVersion: "v1",
    role: "V1 people listing",
  },
  {
    path: "/category/marketplaces",
    expectedVersion: "v1",
    role: "V1 category template",
  },
  {
    path: "/",
    expectedVersion: "v2",
    role: "V2 homepage, count-up, accordion, video popup, marquee",
    exerciseCountup: true,
  },
  {
    path: "/products/fulfillment/middle-mile",
    expectedVersion: "v2",
    role: "V2 product, count-up, accordion, video popup",
    exerciseCountup: true,
  },
  {
    path: "/pi",
    expectedVersion: "v2",
    role: "V2 product with five count-up cards",
    exerciseCountup: true,
  },
  {
    path: "/pattern-intelligence-korea",
    expectedVersion: "v2",
    role: "V2 localized product with five count-up cards",
    exerciseCountup: true,
  },
  {
    path: "/beauty",
    expectedVersion: "v2",
    role: "V2 landing page with three count-up cards",
    exerciseCountup: true,
  },
  {
    path: "/agentic-commerce",
    expectedVersion: "v2",
    role: "V2 landing page with nine card-load animations",
    exerciseCountup: true,
  },
  {
    path: "/products/the-portal-studio",
    expectedVersion: "v2",
    role: "V2 product with shared Splide ownership and card-load animations",
    exerciseCountup: true,
    exerciseSplide: true,
  },
  {
    path: "/blog/converses-revenue-increased-by-50-with-a-pattern-partnership",
    expectedVersion: "v2",
    role: "V2 CMS article with table of contents",
  },
  {
    path: "/blog/analysis-americas-obsession-with-junk-food",
    expectedVersion: "v2",
    role: "V2 CMS article that returned a transient 500 during the full crawl",
  },
  {
    path: "/blog/the-halo-effect",
    expectedVersion: "v2",
    role: "V2 CMS article that returned a transient 500 during the full crawl",
  },
  {
    path: "/case-study/gaia",
    expectedVersion: "v2",
    role: "V2 case-study template with count-up cards",
    exerciseCountup: true,
  },
  {
    path: "/case-study/flannels",
    expectedVersion: "v2",
    role: "New staging V2 case-study item discovered after the corrective publish",
    exerciseCountup: true,
  },
  {
    path: "/case-study/sports-direct",
    expectedVersion: "v2",
    role: "New production V2 case-study item discovered after the production publish",
    exerciseCountup: true,
  },
  {
    path: "/contact",
    expectedVersion: "v2",
    role: "V2 form route outside the sitemap",
  },
  {
    path: "/performance-review",
    expectedVersion: "v2",
    role: "Newly explicit V2 route with count-up",
    exerciseCountup: true,
  },
  {
    path: "/login",
    expectedVersion: "v2",
    role: "Newly explicit V2 login page",
  },
  {
    path: "/news/31-of-aussie-online-shoppers-have-access-to-amazon-prime-up-by-63-in-less",
    expectedVersion: "v2",
    role: "Newly explicit V2 News template",
  },
  {
    path: "/topics/3pl-fulfillment",
    expectedVersion: "v2",
    role: "Newly explicit V2 Topics template",
  },
  {
    path: "/reports/2026-state-of-fulfillment",
    expectedVersion: "v2",
    role: "Newly explicit V2 Reports template",
  },
  {
    path: "/whitepaper/fulfillment-pet-brands",
    expectedVersion: "v2",
    role: "Newly explicit V2 Whitepaper template",
  },
  {
    path: "/partnership/asgtg",
    expectedVersion: "v1",
    role: "V1 partnership card animation",
    exerciseCountup: true,
  },
  {
    path: "/home-v3",
    expectedVersion: "v3",
    role: "Staging-only V3 control",
    exerciseCountup: true,
  },
];

function summarizeConsole(entries) {
  const unique = new Map();
  for (const entry of entries) {
    const key = `${entry.type}|${entry.text}|${entry.url}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  return [...unique.values()];
}

const browser = await chromium.launch({ headless: true });
await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
});

const results = [];
let rateLimited = false;

for (const route of ROUTES) {
  const page = await context.newPage();
  const consoleEntries = [];
  const requestFailures = [];
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    consoleEntries.push({
      type: message.type(),
      text: message.text(),
      url: message.location().url || null,
    });
  });
  page.on("pageerror", (error) => {
    consoleEntries.push({
      type: "pageerror",
      text: error.message,
      url: null,
    });
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (
      url.includes("pattern-version-gateway") ||
      url.includes("card-load-animations-v10")
    ) {
      requestFailures.push({
        url,
        error: request.failure()?.errorText ?? "unknown",
      });
    }
  });

  const started = Date.now();
  let response;
  try {
    response = await page.goto(`${ORIGIN}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  } catch (error) {
    results.push({
      ...route,
      status: 0,
      elapsedMs: Date.now() - started,
      navigationError: error.message,
    });
    await page.close();
    continue;
  }

  const status = response?.status() ?? 0;
  if (status === 429) {
    rateLimited = true;
    results.push({
      ...route,
      status,
      elapsedMs: Date.now() - started,
      title: await page.title(),
      rateLimited: true,
    });
    await page.close();
    break;
  }

  try {
    await page.waitForFunction(
      (version) => window.PatternVersionGateway?.version === version,
      PVG_VERSION,
      { timeout: 12_000 },
    );
  } catch {
    // The detailed page-state read below records the absent runtime.
  }

  await page.waitForTimeout(2_000);

  const before = await page.evaluate(() => {
    const inspection = window.PatternVersionGateway?.inspect?.() ?? null;
    const countups = [...document.querySelectorAll('[card-load="count-up"]')];
    return {
      title: document.title,
      pageMainClasses:
        document.querySelector(".page_main, .page_main_v3")?.className ?? null,
      runtimeVersion: window.PatternVersionGateway?.version ?? null,
      inspection,
      managedAssets: [...document.querySelectorAll("[data-pattern-pvg-asset]")].map(
        (element) => ({
          tag: element.tagName,
          module: element.getAttribute("data-pattern-pvg-module"),
          src: element.getAttribute("src") || element.getAttribute("href"),
        }),
      ),
      scripts: [...document.scripts]
        .map((script) => script.src)
        .filter(
          (src) =>
            src.includes("pattern-version-gateway") ||
            src.includes("card-load-animations-v10") ||
            src.includes("pattern-runtime"),
        ),
      unmanagedLegacyAssets: [
        ...document.querySelectorAll("script[src], link[href]"),
      ]
        .filter((element) => {
          const src = element.getAttribute("src") || element.getAttribute("href") || "";
          const versionOwned =
            /specterstudio\/pattern@v1\.0\.(?:2|8)\/webflow\/pattern\.com\/(?:scripts\/(?:nav\/nav|media\/(?:video|iframe)-popup|content\/(?:logos|rich-text-heading-conversion|cta-inject|toc)|schema\/faq-schema-generator|interaction\/(?:accordion|lazy-load|pagination-fix))\.js|styles\/(?:nav|pagination-fix)\.css)/.test(
              src,
            ) ||
            /card-load-animations-v10\.js/.test(src) ||
            /@splidejs\/splide@4\.1\.4\/dist\/(?:css\/splide\.min\.css|js\/splide\.min\.js)/.test(
              src,
            );
          return versionOwned && !element.hasAttribute("data-pattern-pvg-asset");
        })
        .map((element) => element.getAttribute("src") || element.getAttribute("href")),
      duplicateOwnedAssets: Object.entries(
        [...document.querySelectorAll("script[src], link[href]")]
          .map((element) => element.getAttribute("src") || element.getAttribute("href"))
          .filter((src) =>
            /pattern-version-gateway|card-load-animations-v10|specterstudio\/pattern@v1\.0\.(?:2|8)\/webflow\/pattern\.com\/(?:scripts\/(?:nav\/nav|media\/(?:video|iframe)-popup|content\/(?:logos|rich-text-heading-conversion|cta-inject|toc)|schema\/faq-schema-generator|interaction\/(?:accordion|lazy-load|pagination-fix))\.js|styles\/(?:nav|pagination-fix)\.css)|@splidejs\/splide@4\.1\.4\/dist\/(?:css\/splide\.min\.css|js\/splide\.min\.js)/.test(
              src,
            ),
          )
          .reduce((counts, src) => {
            counts[src] = (counts[src] || 0) + 1;
            return counts;
          }, {}),
      ).filter(([, count]) => count > 1),
      countup: {
        total: countups.length,
        inGrid: countups.filter((element) => element.closest("[card-grid]")).length,
        orphaned: countups.filter((element) => !element.closest("[card-grid]"))
          .length,
        grids: new Set(
          countups
            .map((element) => element.closest("[card-grid]"))
            .filter(Boolean),
        ).size,
      },
      elements: {
        accordions: document.querySelectorAll(
          '[class*="accordion"], [data-accordion]',
        ).length,
        videoPopupTriggers: document.querySelectorAll(
          '[data-video-popup], [class*="video_popup"], [class*="video-popup"]',
        ).length,
        forms: document.querySelectorAll("form").length,
        navs: document.querySelectorAll("nav, .w-nav").length,
        splides: document.querySelectorAll(".splide").length,
        marquees: document.querySelectorAll('[class*="marquee"]').length,
        toc: document.querySelectorAll(
          '[data-toc], [class*="table-of-contents"], [class*="toc_"]',
        ).length,
      },
    };
  });

  if (route.exerciseCountup && before.countup.total > 0) {
    const gridCount = await page
      .locator('[card-grid]:has([card-load="count-up"])')
      .count();
    for (let index = 0; index < gridCount; index += 1) {
      await page
        .locator('[card-grid]:has([card-load="count-up"])')
        .nth(index)
        .scrollIntoViewIfNeeded();
      await page.waitForTimeout(1_900);
    }
  }

  const countupBehavior = await page.evaluate(() =>
    [...document.querySelectorAll('[card-load="count-up"]')].map(
      (element, index) => {
        const target =
          element.querySelector("[stat-count-up]") ||
          element.querySelector(".u-text span") ||
          element.querySelector(".u-text") ||
          element;
        const children = [...target.children];
        const digitWrappers = children.filter(
          (child) => child.style.width === "1ch",
        );
        const reels = digitWrappers
          .map((wrapper) => wrapper.firstElementChild)
          .filter(Boolean);
        const childRects = children.map((child) => {
          const rect = child.getBoundingClientRect();
          return { left: rect.left, top: rect.top, width: rect.width };
        });
        const animatedReels = reels.filter(
          (reel) =>
            reel.children.length <= 1 ||
            (reel.style.transform &&
              reel.style.transform !== "translateY(0)" &&
              reel.style.transform !== "translateY(0px)"),
        ).length;
        const computed = getComputedStyle(target);
        const horizontal =
          ["flex", "inline-flex"].includes(computed.display) &&
          computed.flexDirection === "row" &&
          (childRects.length < 2 ||
            childRects.every(
              (rect, childIndex) =>
                childIndex === 0 ||
                rect.left >
                  childRects[childIndex - 1].left +
                    Math.min(childRects[childIndex - 1].width, 1) -
                    0.5,
            ));
        return {
          index,
          text: element.innerText.trim(),
          inGrid: Boolean(element.closest("[card-grid]")),
          targetTag: target.tagName,
          initialized: digitWrappers.length > 0,
          horizontal,
          display: computed.display,
          flexDirection: computed.flexDirection,
          whiteSpace: computed.whiteSpace,
          digitColumns: digitWrappers.length,
          reelCount: reels.length,
          animatedReels,
        };
      },
    ),
  );
  let splideBehavior = null;
  if (route.exerciseSplide) {
    await page.locator("#splideSlider").scrollIntoViewIfNeeded();
    const first = await page.evaluate(() => {
      const root = document.querySelector("#splideSlider");
      const list = root?.querySelector(".splide__list");
      return {
        initialized:
          root?.dataset.patternSliderImagesInitialized === "true",
        trackCount: root?.querySelectorAll(":scope > .splide__track").length ?? 0,
        listCount: root?.querySelectorAll(".splide__list").length ?? 0,
        transform: list?.style.transform ?? "",
      };
    });
    await page.waitForTimeout(700);
    const secondTransform = await page.evaluate(
      () =>
        document.querySelector("#splideSlider .splide__list")?.style.transform ??
        "",
    );
    splideBehavior = {
      ...first,
      secondTransform,
      moving:
        Boolean(first.transform) &&
        Boolean(secondTransform) &&
        first.transform !== secondTransform,
    };
  }
  const screenshot =
    route.path === "/pi"
      ? `${SCREENSHOT_DIR}/pi-countup-horizontal.png`
      : null;
  if (screenshot) {
    await page.screenshot({ path: screenshot, fullPage: false });
  }

  const inspection = before.inspection;
  const moduleErrors = inspection?.modules?.filter(
    (module) => module.status === "error",
  );
  const pvgConsole = consoleEntries.filter(
    (entry) =>
      /Pattern PVG|PatternVersionGateway|pattern-version-gateway/i.test(
        `${entry.text} ${entry.url}`,
      ),
  );

  results.push({
    ...route,
    status,
    finalUrl: page.url(),
    elapsedMs: Date.now() - started,
    title: before.title,
    pageMainClasses: before.pageMainClasses,
    runtimeVersion: before.runtimeVersion,
    detection: inspection?.detection ?? null,
    activation: inspection?.activation ?? null,
    managedAssets: before.managedAssets,
    unmanagedLegacyAssets: before.unmanagedLegacyAssets,
    duplicateOwnedAssets: before.duplicateOwnedAssets,
    moduleErrors: moduleErrors ?? null,
    runtimeScripts: before.scripts,
    countup: {
      ...before.countup,
      behavior: countupBehavior,
    },
    splide: splideBehavior,
    screenshot,
    elements: before.elements,
    pvgConsole,
    requestFailures,
    otherConsole: summarizeConsole(
      consoleEntries.filter((entry) => !pvgConsole.includes(entry)),
    ),
  });

  process.stdout.write(
    `Checked ${route.path}: ${status} ${before.runtimeVersion ?? "no-pvg"} ${inspection?.activation?.reason ?? "no-activation"}\n`,
  );
  await page.close();
}

await browser.close();

const routeFailures = results.filter(
  (result) =>
    result.status !== 200 ||
    result.runtimeVersion !== PVG_VERSION ||
    result.detection?.version !== result.expectedVersion ||
    result.activation?.reason !== "active" ||
    result.moduleErrors?.length ||
    result.pvgConsole?.length ||
    result.requestFailures?.length ||
    result.unmanagedLegacyAssets?.length ||
    result.duplicateOwnedAssets?.length ||
    (result.exerciseSplide &&
      (!result.splide?.initialized ||
        result.splide.trackCount !== 1 ||
        result.splide.listCount !== 1 ||
        !result.splide.moving)),
);
const explicitLegacy = results.filter((result) =>
  ["v1", "v2", "v3"].includes(result.expectedVersion),
);
const countupResults = results.filter((result) => result.countup?.total > 0);
const countupFailures = countupResults.flatMap((result) =>
  (result.countup?.behavior ?? [])
    .filter(
      (counter) =>
        counter.inGrid &&
        (!counter.initialized ||
          !counter.horizontal ||
          !["flex", "inline-flex"].includes(counter.display) ||
          counter.flexDirection !== "row" ||
          counter.whiteSpace !== "nowrap" ||
          counter.animatedReels < counter.reelCount),
    )
    .map((counter) => ({ path: result.path, ...counter })),
);

const output = {
  checkedAt: new Date().toISOString(),
  scope: `Read-only real-browser compatibility matrix for PVG ${PVG_VERSION} on representative Pattern US V1/V2/V3 routes at ${ORIGIN}`,
  origin: ORIGIN,
  rateLimited,
  summary: {
    routesPlanned: ROUTES.length,
    routesChecked: results.length,
    statuses: Object.fromEntries(
      [...new Set(results.map((result) => result.status))].map((status) => [
        String(status),
        results.filter((result) => result.status === status).length,
      ]),
    ),
    explicitVersionRoutes: explicitLegacy.length,
    explicitVersionActive: explicitLegacy.filter(
      (result) =>
        result.activation?.reason === "active" &&
        result.detection?.version === result.expectedVersion,
    ).length,
    routeFailures: routeFailures.length,
    countupRoutes: countupResults.length,
    countupCounters: countupResults.reduce(
      (total, result) => total + result.countup.total,
      0,
    ),
    countupFailures: countupFailures.length,
  },
  routeFailures,
  countupFailures,
  results,
};

await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      checkedAt: output.checkedAt,
      rateLimited,
      summary: output.summary,
      routeFailures: routeFailures.map((result) => result.path),
      countupFailures,
      output: OUTPUT,
    },
    null,
    2,
  )}\n`,
);

if (rateLimited) process.exitCode = 75;
