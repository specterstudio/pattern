import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const cssRoot = join(packageRoot, "css");

async function listCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listCssFiles(path));
    } else if (entry.name.endsWith(".css")) {
      files.push(path);
    }
  }

  return files.sort();
}

function contentType(path) {
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  }[extname(path)] || "application/octet-stream";
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/pilot-v1") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <body>
          <main data-pattern-version="v1" data-pattern-asset-pilot="phase4"></main>
          <script src="/js/loader.js"></script>
        </body>`);
      return;
    }

    if (request.url === "/pilot-v2") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <body>
          <main data-pattern-version="v2" data-pattern-asset-pilot="phase4"></main>
          <script src="/js/loader.js"></script>
        </body>`);
      return;
    }

    if (request.url === "/no-pilot") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
        <body>
          <main data-pattern-version="v1"></main>
          <script src="/js/loader.js"></script>
        </body>`);
      return;
    }

    const relativePath = decodeURIComponent(request.url || "/").replace(/^\/+/, "");
    const filePath = join(packageRoot, relativePath);
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

try {
  const cssFiles = await listCssFiles(cssRoot);
  const cssResults = [];

  for (const path of cssFiles) {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><body></body>");
    await page.addStyleTag({ content: await readFile(path, "utf8") });
    const rules = await page.evaluate(() =>
      Array.from(document.styleSheets).reduce(
        (total, sheet) => total + sheet.cssRules.length,
        0
      )
    );
    cssResults.push({
      path: path.replace(`${packageRoot}/`, ""),
      rules
    });
    await page.close();
  }

  const behaviorPage = await browser.newPage();
  await behaviorPage.setContent(`<!doctype html>
    <body>
      <main id="root">
        <div id="wrapper" data-wf--content-wrapper--variant="center-alignment">
          <p id="child">Test</p>
        </div>
      </main>
    </body>`);
  await behaviorPage.addStyleTag({
    content: await readFile(join(cssRoot, "shared.css"), "utf8")
  });
  await behaviorPage.addStyleTag({
    content: await readFile(join(cssRoot, "v1.css"), "utf8")
  });
  await behaviorPage.addStyleTag({
    content: await readFile(join(cssRoot, "v2.css"), "utf8")
  });

  async function markerBehavior(version) {
    return behaviorPage.evaluate((marker) => {
      const root = document.querySelector("#root");
      root.setAttribute("data-pattern-version", marker);
      const bodyStyle = getComputedStyle(document.body);
      const wrapperStyle = getComputedStyle(document.querySelector("#wrapper"));
      const childStyle = getComputedStyle(document.querySelector("#child"));
      return {
        columns: bodyStyle.getPropertyValue("--site--column-count").trim(),
        sharedGridAlias: bodyStyle.getPropertyValue("--grid-12").trim(),
        v1TypeAlias: bodyStyle.getPropertyValue("--d1--font-size").trim(),
        wrapperTextAlign: wrapperStyle.textAlign,
        wrapperJustifyItems: wrapperStyle.justifyItems,
        childTextAlign: childStyle.textAlign
      };
    }, version);
  }

  const markerV1 = await markerBehavior("v1");
  const markerV2 = await markerBehavior("v2");
  await behaviorPage.close();

  async function loaderState(path) {
    const page = await browser.newPage();
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    const state = await page.evaluate(() => window.__patternVersionSplit || null);
    await page.close();
    return state;
  }

  const loaderV1 = await loaderState("/pilot-v1");
  const loaderV2 = await loaderState("/pilot-v2");
  const loaderInactive = await loaderState("/no-pilot");

  const checks = [
    {
      check: "All CSS files parsed",
      passed: cssResults.length === 18 && cssResults.every(({ rules }) => rules > 0)
    },
    {
      check: "Shared container variables activate on both versions",
      passed: markerV1.columns === "12" && markerV2.columns === "12"
    },
    {
      check: "Shared grid aliases activate on both versions",
      passed:
        markerV1.sharedGridAlias === "repeat(12, minmax(0, 1fr))" &&
        markerV2.sharedGridAlias === "repeat(12, minmax(0, 1fr))"
    },
    {
      check: "V1-only type aliases activate only on V1",
      passed:
        markerV1.v1TypeAlias.includes("clamp(") &&
        markerV2.v1TypeAlias === ""
    },
    {
      check: "V2 alignment activates on V2",
      passed:
        markerV2.wrapperTextAlign === "center" &&
        markerV2.wrapperJustifyItems === "center" &&
        markerV2.childTextAlign === "center"
    },
    {
      check: "V2 alignment stays inactive on V1",
      passed:
        markerV1.wrapperTextAlign === "start" &&
        markerV1.childTextAlign === "start"
    },
    {
      check: "V1 pilot loads shared and V1 runtimes",
      passed:
        loaderV1?.version === "v1" &&
        loaderV1.loaded.includes("shared-runtime") &&
        loaderV1.loaded.includes("v1-runtime") &&
        loaderV1.failed.length === 0
    },
    {
      check: "V2 pilot loads shared and V2 runtimes",
      passed:
        loaderV2?.version === "v2" &&
        loaderV2.loaded.includes("shared-runtime") &&
        loaderV2.loaded.includes("v2-runtime") &&
        loaderV2.failed.length === 0
    },
    {
      check: "Loader stays inactive without pilot marker",
      passed: loaderInactive === null
    }
  ];

  const result = {
    cssFiles: cssResults.length,
    cssRules: cssResults.reduce((total, file) => total + file.rules, 0),
    markerV1,
    markerV2,
    loaderV1,
    loaderV2,
    loaderInactive,
    checks,
    failures: checks.filter(({ passed }) => !passed).length
  };

  console.log(JSON.stringify(result, null, 2));
  if (result.failures > 0) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
