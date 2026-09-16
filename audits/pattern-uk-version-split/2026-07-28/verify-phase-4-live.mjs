import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const repoRoot = resolve(import.meta.dirname, "../../..");
const outputRoot = resolve(repoRoot, "output/playwright/pattern-uk-phase4");
const packageRoot = resolve(
  repoRoot,
  "webflow/uk.pattern.com/version-split"
);
const useLocalCss = process.env.PHASE4_LOCAL_CSS === "1";
const assetRoot =
  "https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.4.3/" +
  "webflow/uk.pattern.com/version-split";

const viewports = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "tablet", width: 991, height: 1100 },
  { name: "mobile-landscape", width: 767, height: 1000 },
  { name: "mobile-portrait", width: 479, height: 900 }
];

const targets = [
  {
    name: "pattern-intelligence",
    version: "v2",
    url: "https://uk.pattern.com/pattern-intelligence?phase4_verify=20260728"
  },
  {
    name: "our-story",
    version: "v1",
    url: "https://uk.pattern.com/about/our-story?phase4_verify=20260728"
  }
];

const reference = {
  name: "pattern-intelligence-reference",
  url: "https://pattern.com/pi?phase4_verify=20260728"
};

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function rectDelta(before, after) {
  if (!before || !after) return null;
  return {
    x: rounded(after.x - before.x),
    y: rounded(after.y - before.y),
    width: rounded(after.width - before.width),
    height: rounded(after.height - before.height)
  };
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
      scroll-behavior: auto !important;
    }`
  });
}

async function openCustomersMenu(page) {
  const trigger = page
    .getByText(/^(Customers|Success Stories)$/i, { exact: true })
    .first();

  if (await trigger.count() === 0) return false;

  try {
    await trigger.hover({ timeout: 3000 });
    await page.waitForTimeout(300);
    return true;
  } catch {
    return false;
  }
}

async function collect(page) {
  return page.evaluate(() => {
    function toRect(element) {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        display: style.display,
        maxWidth: style.maxWidth,
        textAlign: style.textAlign,
        justifyItems: style.justifyItems,
        marginLeft: style.marginLeft,
        marginRight: style.marginRight
      };
    }

    function first(selectors) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
      return null;
    }

    function summarize(selector, limit = 12) {
      return Array.from(document.querySelectorAll(selector))
        .slice(0, limit)
        .map((element, index) => ({
          index,
          tag: element.tagName.toLowerCase(),
          className:
            typeof element.className === "string"
              ? element.className
              : element.getAttribute("class") || "",
          rect: toRect(element)
        }));
    }

    const versionRoot = document.querySelector("[data-pattern-version]");
    const centerWrapper = document.querySelector(
      '[data-wf--content-wrapper--variant="center-alignment"]'
    );
    const visibleDropdowns = Array.from(
      document.querySelectorAll('[class*="dropdown"], [class*="Dropdown"]')
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    const splitLinks = Array.from(
      document.querySelectorAll(
        '[data-pattern-version-split="phase4"][data-pattern-split-asset]'
      )
    );

    return {
      path: location.pathname,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        horizontalOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth
      },
      version: versionRoot?.getAttribute("data-pattern-version") || null,
      pilot: versionRoot?.getAttribute("data-pattern-asset-pilot") || null,
      legacyBridgeCount: document.querySelectorAll(".page_code_wrap").length,
      splitAssets: splitLinks.map((link) => ({
        asset: link.getAttribute("data-pattern-split-asset"),
        href: link.href || "inline-local-verification",
        loaded: Boolean(link.sheet)
      })),
      loaderState: window.__patternVersionSplit || null,
      columns: getComputedStyle(document.body)
        .getPropertyValue("--site--column-count")
        .trim(),
      pageWrap: toRect(document.querySelector(".page_wrap")),
      pageMain: toRect(document.querySelector(".page_main")),
      header: toRect(
        first(["header", ".header_wrap", ".nav_wrap", '[class*="header"]'])
      ),
      footer: toRect(
        first(["footer", ".footer_wrap", '[class*="footer"]'])
      ),
      footerContainer: toRect(
        first([
          ".footer_contain.u-container",
          ".footer_contain.u-container-2",
          ".footer_contain"
        ])
      ),
      centerWrapper: toRect(centerWrapper),
      containers: summarize(
        ".u-container, .u-container-2, .container, [class*='_container']",
        16
      ),
      sections: summarize("section, [class*='section']", 12),
      visibleDropdowns: visibleDropdowns.slice(0, 8).map((element) => ({
        className:
          typeof element.className === "string"
            ? element.className
            : element.getAttribute("class") || "",
        rect: toRect(element)
      })),
      marketo: {
        forms: document.querySelectorAll(".mktoForm").length,
        renderedForms: document.querySelectorAll('.mktoForm[id^="mktoForm_"]').length,
        firstRendered: toRect(
          document.querySelector('.mktoForm[id^="mktoForm_"]')
        )
      }
    };
  });
}

async function injectSplit(page, version) {
  await page.evaluate((pageVersion) => {
    document.querySelectorAll(".page_code_wrap").forEach((element) => {
      element.remove();
    });

    const root =
      document.querySelector(`[data-pattern-version="${pageVersion}"]`) ||
      document.querySelector(".page_main") ||
      document.body;
    root.setAttribute("data-pattern-version", pageVersion);
    root.setAttribute("data-pattern-asset-pilot", "phase4");
  }, version);

  const assets = [
    { name: "shared", path: "css/shared.css" },
    { name: version, path: `css/${version}.css` },
    { name: "features", path: "css/features.css" }
  ];

  if (useLocalCss) {
    for (const asset of assets) {
      const style = await page.addStyleTag({
        content: await readFile(resolve(packageRoot, asset.path), "utf8")
      });
      await style.evaluate((element, assetName) => {
        element.dataset.patternVersionSplit = "phase4";
        element.dataset.patternSplitAsset = assetName;
      }, asset.name);
    }
  } else {
    await page.evaluate(
      async ({ assetRoot, assets }) => {
        await Promise.all(
          assets.map(
            (asset) =>
              new Promise((resolve, reject) => {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = `${assetRoot}/${asset.path}`;
                link.dataset.patternVersionSplit = "phase4";
                link.dataset.patternSplitAsset = asset.name;
                link.addEventListener("load", resolve, { once: true });
                link.addEventListener(
                  "error",
                  () => reject(new Error(`Unable to load ${asset.name}`)),
                  { once: true }
                );
                document.head.appendChild(link);
              })
          )
        );
      },
      { assetRoot, assets }
    );
  }

  await page.evaluate(
    async ({ assetRoot }) => {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Phase 4 loader timed out")),
          12000
        );
        document.addEventListener(
          "pattern:version-split-ready",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
        const script = document.createElement("script");
        script.src = `${assetRoot}/js/loader.js`;
        script.defer = true;
        script.dataset.patternVersionSplit = "phase4";
        script.addEventListener(
          "error",
          () => {
            clearTimeout(timeout);
            reject(new Error("Unable to load Phase 4 loader"));
          },
          { once: true }
        );
        document.body.appendChild(script);
      });
    },
    { assetRoot }
  );

  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

async function inspectState(browser, target, viewport) {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  const assetFailures = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("version-split")) {
      assetFailures.push({
        url: request.url(),
        error: request.failure()?.errorText || "unknown"
      });
    }
  });

  await page.goto(target.url, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await settle(page);
  await openCustomersMenu(page);
  const baseline = await collect(page);
  await page.screenshot({
    path: resolve(outputRoot, `${target.name}-${viewport.name}-baseline.png`),
    fullPage: false
  });

  await injectSplit(page, target.version);
  await openCustomersMenu(page);
  const split = await collect(page);
  await page.screenshot({
    path: resolve(outputRoot, `${target.name}-${viewport.name}-split.png`),
    fullPage: false
  });

  await page.close();

  return {
    page: target.name,
    version: target.version,
    viewport: viewport.name,
    baseline,
    split,
    delta: {
      pageWrap: rectDelta(baseline.pageWrap, split.pageWrap),
      pageMain: rectDelta(baseline.pageMain, split.pageMain),
      header: rectDelta(baseline.header, split.header),
      footer: rectDelta(baseline.footer, split.footer),
      footerContainer: rectDelta(
        baseline.footerContainer,
        split.footerContainer
      ),
      marketoFirstRendered: rectDelta(
        baseline.marketo.firstRendered,
        split.marketo.firstRendered
      ),
      centerWrapper: rectDelta(baseline.centerWrapper, split.centerWrapper)
    },
    consoleErrors,
    assetFailures
  };
}

async function inspectReference(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(reference.url, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await settle(page);
  await openCustomersMenu(page);
  const state = await collect(page);
  await page.screenshot({
    path: resolve(outputRoot, `${reference.name}-${viewport.name}.png`),
    fullPage: false
  });
  await page.close();
  return {
    page: reference.name,
    viewport: viewport.name,
    state
  };
}

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const results = [];
  const references = [];

  for (const viewport of viewports) {
    references.push(await inspectReference(browser, viewport));
    for (const target of targets) {
      results.push(await inspectState(browser, target, viewport));
    }
  }

  const checks = [];
  for (const result of results) {
    checks.push(
      {
        check: `${result.page} ${result.viewport}: legacy bridge removed`,
        passed: result.baseline.legacyBridgeCount === 1 &&
          result.split.legacyBridgeCount === 0
      },
      {
        check: `${result.page} ${result.viewport}: correct three CSS assets`,
        passed:
          result.split.splitAssets.length === 3 &&
          result.split.splitAssets.every((asset) => asset.loaded) &&
          result.split.splitAssets.some(
            (asset) => asset.asset === result.version
          ) &&
          !result.split.splitAssets.some(
            (asset) =>
              asset.asset === (result.version === "v1" ? "v2" : "v1")
          )
      },
      {
        check: `${result.page} ${result.viewport}: loader selected ${result.version}`,
        passed:
          result.split.loaderState?.version === result.version &&
          result.split.loaderState?.failed?.length === 0
      },
      {
        check: `${result.page} ${result.viewport}: no split asset failures`,
        passed: result.assetFailures.length === 0
      },
      {
        check: `${result.page} ${result.viewport}: no horizontal overflow`,
        passed: result.split.viewport.horizontalOverflow <= 1
      },
      {
        check: `${result.page} ${result.viewport}: shared footer geometry preserved`,
        passed:
          Math.abs(result.delta.footer?.x || 0) <= 1 &&
          Math.abs(result.delta.footer?.width || 0) <= 1 &&
          Math.abs(result.delta.footer?.height || 0) <= 1 &&
          Math.abs(result.delta.footerContainer?.x || 0) <= 1 &&
          Math.abs(result.delta.footerContainer?.width || 0) <= 1 &&
          Math.abs(result.delta.footerContainer?.height || 0) <= 1
      },
      {
        check: `${result.page} ${result.viewport}: shared container tokens active`,
        passed: result.split.columns === "12"
      },
      {
        check: `${result.page} ${result.viewport}: no console errors`,
        passed: result.consoleErrors.length === 0
      }
    );

    if (result.baseline.marketo.firstRendered) {
      checks.push({
        check: `${result.page} ${result.viewport}: rendered Marketo form geometry preserved`,
        passed:
          result.split.marketo.renderedForms ===
            result.baseline.marketo.renderedForms &&
          Math.abs(result.delta.marketoFirstRendered?.width || 0) <= 1 &&
          Math.abs(result.delta.marketoFirstRendered?.height || 0) <= 1
      });
    }

    if (result.version === "v1") {
      checks.push({
        check: `${result.page} ${result.viewport}: V1 main width preserved`,
        passed:
          Math.abs(result.delta.pageMain?.x || 0) <= 1 &&
          Math.abs(result.delta.pageMain?.width || 0) <= 1
      });
    }

    if (result.version === "v2") {
      if (result.split.centerWrapper) {
        checks.push({
          check: `${result.page} ${result.viewport}: V2 content wrapper centered`,
          passed:
            result.split.centerWrapper.textAlign === "center" &&
            result.split.centerWrapper.justifyItems === "center"
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    assetRoot,
    localCss: useLocalCss,
    publishedWebflow: false,
    viewports,
    checks,
    failures: checks.filter((check) => !check.passed),
    results,
    references
  };

  await writeFile(
    resolve(outputRoot, "phase-4-live-simulation.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(
    JSON.stringify(
      {
        checks: checks.length,
        failures: report.failures,
        resultSets: results.length,
        referenceSets: references.length,
        report: resolve(outputRoot, "phase-4-live-simulation.json")
      },
      null,
      2
    )
  );

  if (report.failures.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
