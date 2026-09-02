import { chromium } from "playwright";

const assetRoot =
  "https://cdn.jsdelivr.net/gh/specterstudio/pattern@uk-version-split-v0.4.3/" +
  "webflow/uk.pattern.com/version-split";
const viewport = {
  width: Number(process.env.PHASE4_WIDTH || 1440),
  height: 1200
};

function rounded(value) {
  return Math.round(value * 100) / 100;
}

async function snapshot(page) {
  return page.evaluate(() => {
    function describe(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        id: element.dataset.phase4DiagnosticId,
        tag: element.tagName.toLowerCase(),
        className:
          typeof element.className === "string"
            ? element.className
            : element.getAttribute("class") || "",
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        rect: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100
        },
        style: {
          display: style.display,
          position: style.position,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          gridTemplateColumns: style.gridTemplateColumns,
          columnGap: style.columnGap,
          rowGap: style.rowGap,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom
        }
      };
    }

    return Array.from(
      document.querySelectorAll("[data-phase4-diagnostic-id]")
    ).map(describe);
  });
}

async function injectSplit(page) {
  await page.evaluate(
    async ({ assetRoot }) => {
      document.querySelectorAll(".page_code_wrap").forEach((element) => {
        element.remove();
      });
      const root = document.querySelector(".page_main") || document.body;
      root.setAttribute("data-pattern-version", "v1");
      root.setAttribute("data-pattern-asset-pilot", "phase4");

      for (const path of ["css/shared.css", "css/v1.css", "css/features.css"]) {
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
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport });
  await page.goto(
    "https://uk.pattern.com/about/our-story?phase4_v1_diagnostic=20260728",
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    document.querySelectorAll(".page_main *, .footer_wrap *").forEach(
      (element, index) => {
        element.dataset.phase4DiagnosticId = String(index);
      }
    );
  });

  const baseline = await snapshot(page);
  await injectSplit(page);
  const split = await snapshot(page);
  const splitById = new Map(split.map((item) => [item.id, item]));
  const changes = baseline
    .map((before) => {
      const after = splitById.get(before.id);
      if (!after) return null;
      const delta = {
        x: rounded(after.rect.x - before.rect.x),
        y: rounded(after.rect.y - before.rect.y),
        width: rounded(after.rect.width - before.rect.width),
        height: rounded(after.rect.height - before.rect.height)
      };
      const styleChanges = Object.fromEntries(
        Object.keys(before.style)
          .filter((key) => before.style[key] !== after.style[key])
          .map((key) => [key, [before.style[key], after.style[key]]])
      );
      return {
        tag: before.tag,
        className: before.className,
        text: before.text,
        before: before.rect,
        after: after.rect,
        delta,
        styleChanges
      };
    })
    .filter(Boolean)
    .filter(
      ({ delta, styleChanges }) =>
        Math.abs(delta.x) > 1 ||
        Math.abs(delta.y) > 1 ||
        Math.abs(delta.width) > 1 ||
        Math.abs(delta.height) > 1 ||
        Object.keys(styleChanges).length > 0
    )
    .sort(
      (a, b) =>
        Math.abs(b.delta.height) -
          Math.abs(a.delta.height) ||
        Math.abs(b.delta.width) -
          Math.abs(a.delta.width) ||
        Math.abs(b.delta.y) -
          Math.abs(a.delta.y)
    )
    .slice(0, 400);

  console.log(JSON.stringify({ viewport, changes }, null, 2));
} finally {
  await browser.close();
}
