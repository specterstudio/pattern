import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const assetRoot =
  "https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.4.3/" +
  "webflow/uk.pattern.com/version-split";
const useLocalCss = process.env.PHASE4_LOCAL_CSS === "1";
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../webflow/uk.pattern.com/version-split"
);

async function diagnosticState(page) {
  return page.evaluate(() => {
    function describe(element) {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const customProperties = [
        "--site--column-count",
        "--site--width",
        "--site--width-inner",
        "--site--margin",
        "--site--gutter",
        "--site--gutter-total",
        "--site--grid-width",
        "--column-width",
        "--container--full",
        "--container--small",
        "--container--main",
        "--container--main-old"
      ];
      return {
        tag: element.tagName.toLowerCase(),
        className:
          typeof element.className === "string"
            ? element.className
            : element.getAttribute("class") || "",
        rect: {
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100
        },
        display: style.display,
        position: style.position,
        width: style.width,
        maxWidth: style.maxWidth,
        minWidth: style.minWidth,
        transform: style.transform,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        customProperties: Object.fromEntries(
          customProperties.map((property) => [
            property,
            style.getPropertyValue(property).trim()
          ])
        )
      };
    }

    const accent = document.querySelector(".footer_accent");
    const footer = document.querySelector(".footer_wrap");
    const ancestors = [];
    let current = accent;
    while (current) {
      ancestors.push(describe(current));
      current = current.parentElement;
    }

    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      accentAncestors: ancestors,
      footer: describe(footer),
      footerContainer: describe(
        document.querySelector(".footer_contain.u-container")
      ),
      footerChildren: footer
        ? Array.from(footer.children).map(describe)
        : [],
      marketoForms: Array.from(document.querySelectorAll(".mktoForm")).map(
        (form) => ({
          id: form.id,
          state: describe(form),
          rows: Array.from(form.querySelectorAll(".mktoFormRow"))
            .slice(0, 8)
            .map(describe)
        })
      ),
      tallestFooterDescendants: footer
        ? Array.from(footer.querySelectorAll("*"))
            .map(describe)
            .filter(Boolean)
            .sort((a, b) => b.rect.height - a.rect.height)
            .slice(0, 12)
        : []
    };
  });
}

async function addCss(page) {
  await page.evaluate(() => {
      document.querySelectorAll(".page_code_wrap").forEach((element) => {
        element.remove();
      });
      const root =
        document.querySelector('[data-pattern-version="v2"]') ||
        document.querySelector(".page_main") ||
        document.body;
      root.setAttribute("data-pattern-version", "v2");
      root.setAttribute("data-pattern-asset-pilot", "phase4");
  });

  if (useLocalCss) {
    for (const path of ["css/shared.css", "css/v2.css", "css/features.css"]) {
      await page.addStyleTag({
        content: await readFile(resolve(packageRoot, path), "utf8")
      });
    }
  } else {
    await page.evaluate(
      async ({ assetRoot }) => {
      for (const path of ["css/shared.css", "css/v2.css", "css/features.css"]) {
        await new Promise((resolve, reject) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = `${assetRoot}/${path}`;
          link.onload = resolve;
          link.onerror = reject;
          document.head.appendChild(link);
        });
      }
      },
      { assetRoot }
    );
  }
  await page.waitForTimeout(1000);
}

async function addLoader(page) {
  await page.evaluate(
    async ({ assetRoot }) => {
      await new Promise((resolve, reject) => {
        document.addEventListener(
          "pattern:version-split-ready",
          resolve,
          { once: true }
        );
        const script = document.createElement("script");
        script.src = `${assetRoot}/js/loader.js`;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    },
    { assetRoot }
  );
  await page.waitForTimeout(1000);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1200 }
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(
      "https://uk.pattern.com/pattern-intelligence?phase4_overflow=20260728",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    await page.waitForTimeout(3500);
    const baseline = await diagnosticState(page);
    await addCss(page);
    const afterCss = await diagnosticState(page);
    await addLoader(page);
    const afterLoader = await diagnosticState(page);
    console.log(JSON.stringify({
      viewport: viewport.name,
      baseline,
      afterCss,
      afterLoader
    }, null, 2));
    await page.close();
  }
} finally {
  await browser.close();
}
