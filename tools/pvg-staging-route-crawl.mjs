import fs from "node:fs/promises";

const ORIGIN = new URL(
  process.env.PVG_ORIGIN ?? "https://pattern-us.webflow.io",
);
const OUTPUT =
  process.env.PVG_OUTPUT ??
  "/Users/kenneth/_Projects/pattern/audits/pvg/2026-07-30-us-staging-pvg-0.2.4-route-crawl.json";
const CONCURRENCY = Number(process.env.PVG_CONCURRENCY ?? 4);
const EXPECTED = {
  version: "0.2.4",
  runtimeCommit: "7bb2b6f2fc7ae258285fbafcd643e717b64009e1",
  runtimeIntegrity:
    "sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp",
  mode: "active",
  legacyPolicy: "gateway",
};
const APPROVED_EXCLUDED_UTILITY_PATHS = new Set([
  "/resources/prep-calculator",
  "/admin/consent-pro",
  "/catalog-offer",
]);
const INTERNATIONAL_PATH = "/resources/international-expansion-videos";
const REMOVED_GLOBAL_ASSETS = [
  "v1.0.8/webflow/pattern.com/styles/nav.css",
  "v1.0.8/webflow/pattern.com/styles/pagination-fix.css",
  "@splidejs/splide@4.1.4/dist/css/splide.min.css",
  "v1.0.8/webflow/pattern.com/scripts/media/video-popup.js",
  "@splidejs/splide@4.1.4/dist/js/splide.min.js",
  "v1.0.8/webflow/pattern.com/scripts/nav/nav.js",
  "v1.0.8/webflow/pattern.com/scripts/content/logos.js",
  "v1.0.8/webflow/pattern.com/scripts/content/rich-text-heading-conversion.js",
  "v1.0.8/webflow/pattern.com/scripts/schema/faq-schema-generator.js",
  "v1.0.8/webflow/pattern.com/scripts/interaction/accordion.js",
  "v1.0.8/webflow/pattern.com/scripts/interaction/lazy-load.js",
  "v1.0.8/webflow/pattern.com/scripts/content/cta-inject.js",
  "v1.0.8/webflow/pattern.com/scripts/content/toc.js",
  "v1.0.2/webflow/pattern.com/scripts/media/iframe-popup.js",
  "v1.0.8/webflow/pattern.com/scripts/interaction/pagination-fix.js",
  "card-load-animations-v10.js",
];

class RateLimitError extends Error {
  constructor(url, retryAfter) {
    super(`HTTP 429 for ${url}`);
    this.name = "RateLimitError";
    this.url = url;
    this.retryAfter = retryAfter;
  }
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizePath(value) {
  const url = new URL(value, ORIGIN);
  return `${url.pathname}${url.search}` || "/";
}

function detectVersion(html) {
  const rootClasses = [...html.matchAll(/class=(["'])(.*?)\1/gis)]
    .map((match) => match[2].split(/\s+/).filter(Boolean))
    .filter((tokens) =>
      tokens.some(
        (token) => token === "page_main" || token === "page_main_v3",
      ),
    );
  const root = rootClasses[0] ?? [];
  const versions = new Set();
  if (root.includes("page_main_v3")) versions.add("v3");
  if (root.includes("cc-v1")) versions.add("v1");
  if (root.includes("cc-v2")) versions.add("v2");
  if (root.includes("cc-v2l")) versions.add("v2l");
  if (root.includes("cc-v3")) versions.add("v3");

  if (versions.size > 1) {
    return {
      version: "conflict",
      versionMarker: root.join(" "),
      explicitVersionMarkers: [...versions],
    };
  }
  if (versions.size === 1) {
    return {
      version: [...versions][0],
      versionMarker: root.join(" "),
      explicitVersionMarkers: [...versions],
    };
  }
  if (root.includes("page_main")) {
    return {
      version: "inferred-v2",
      versionMarker: root.join(" "),
      explicitVersionMarkers: [],
    };
  }
  return {
    version: "unknown",
    versionMarker: root.join(" ") || null,
    explicitVersionMarkers: [],
  };
}

function inspectHtml(html) {
  const version = detectVersion(html);
  const removedGlobalAssets = REMOVED_GLOBAL_ASSETS.filter((asset) =>
    html.includes(asset),
  );
  return {
    ...version,
    pageId:
      html.match(/data-wf-page=(["'])(.*?)\1/i)?.[2] ??
      null,
    siteId:
      html.match(/data-wf-site=(["'])(.*?)\1/i)?.[2] ??
      null,
    pvg: {
      present: html.includes("data-pattern-pvg-loader"),
      version: html.match(/patternPvgLoader\s*=\s*'([^']+)'/)?.[1] ?? null,
      runtimeCommit: html.match(
        /pattern@([0-9a-f]{40})\/webflow\/pattern\.com\/scripts\/runtime\/pattern-version-gateway\.js/,
      )?.[1] ?? null,
      runtimeIntegrity:
        html.match(
          /script\.integrity\s*=\s*\n?\s*'([^']+)'/,
        )?.[1] ?? null,
      modeActive:
        html.includes("pvgMode = 'active'") &&
        html.includes("dataset.pvgMode = 'active'"),
      legacyGateway:
        html.includes("legacyPolicy: 'gateway'") &&
        html.includes("dataset.pvgLegacyPolicy = 'gateway'"),
    },
    removedGlobalAssets,
  };
}

async function fetchText(url, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        "cache-control": "no-cache",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new RateLimitError(
        url,
        Number(response.headers.get("retry-after") ?? 65),
      );
    }
    const text = await response.text();
    return {
      status: response.status,
      finalUrl: response.url,
      elapsedMs: Date.now() - started,
      text,
      attempts: attempt,
    };
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      return fetchText(url, attempt + 1);
    }
    return {
      status: 0,
      finalUrl: url,
      elapsedMs: Date.now() - started,
      text: "",
      attempts: attempt,
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const sitemapUrl = new URL("/sitemap.xml", ORIGIN).href;
const sitemapResponse = await fetchText(sitemapUrl);
if (sitemapResponse.status !== 200) {
  throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`);
}
const sitemapPaths = [
  ...new Set(
    [...sitemapResponse.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(
      (match) => normalizePath(decodeXml(match[1])),
    ),
  ),
];

const routes = new Array(sitemapPaths.length);
let cursor = 0;
let completed = 0;
let rateLimit = null;

async function worker() {
  while (!rateLimit) {
    const index = cursor;
    cursor += 1;
    if (index >= sitemapPaths.length) return;
    const path = sitemapPaths[index];
    const url = new URL(path, ORIGIN).href;
    try {
      const response = await fetchText(url);
      routes[index] = {
        path,
        url,
        status: response.status,
        finalUrl: response.finalUrl,
        elapsedMs: response.elapsedMs,
        attempts: response.attempts,
        error: response.error ?? null,
        ...inspectHtml(response.text),
      };
      completed += 1;
      if (completed % 100 === 0 || completed === sitemapPaths.length) {
        process.stdout.write(
          `Checked ${completed}/${sitemapPaths.length} sitemap routes\n`,
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        rateLimit = {
          url: error.url,
          retryAfter: error.retryAfter,
          completed,
        };
        return;
      }
      throw error;
    }
  }
}

await Promise.all(
  Array.from(
    { length: Math.max(1, Math.min(CONCURRENCY, sitemapPaths.length)) },
    () => worker(),
  ),
);

const completedRoutes = routes.filter(Boolean);
const internationalResponse = await fetchText(
  new URL(INTERNATIONAL_PATH, ORIGIN).href,
);
const international = {
  path: INTERNATIONAL_PATH,
  status: internationalResponse.status,
  finalUrl: internationalResponse.finalUrl,
  inSitemap: sitemapPaths.includes(INTERNATIONAL_PATH),
  ...inspectHtml(internationalResponse.text),
};

const exceptions = {
  non200: completedRoutes.filter((route) => route.status !== 200),
  missingPvg: completedRoutes.filter((route) => !route.pvg.present),
  wrongPvgVersion: completedRoutes.filter(
    (route) => route.pvg.version !== EXPECTED.version,
  ),
  wrongRuntimeCommit: completedRoutes.filter(
    (route) => route.pvg.runtimeCommit !== EXPECTED.runtimeCommit,
  ),
  wrongRuntimeIntegrity: completedRoutes.filter(
    (route) => route.pvg.runtimeIntegrity !== EXPECTED.runtimeIntegrity,
  ),
  wrongMode: completedRoutes.filter((route) => !route.pvg.modeActive),
  wrongLegacyPolicy: completedRoutes.filter(
    (route) => !route.pvg.legacyGateway,
  ),
  removedGlobalAssets: completedRoutes.filter(
    (route) => route.removedGlobalAssets.length > 0,
  ),
  inferredVersions: completedRoutes.filter(
    (route) => route.version === "inferred-v2",
  ),
  unknownVersions: completedRoutes.filter(
    (route) =>
      route.version === "unknown" &&
      !APPROVED_EXCLUDED_UTILITY_PATHS.has(route.path),
  ),
  conflicts: completedRoutes.filter((route) => route.version === "conflict"),
};

const versions = Object.fromEntries(
  [...new Set(completedRoutes.map((route) => route.version))]
    .sort()
    .map((version) => [
      version,
      completedRoutes.filter((route) => route.version === version).length,
    ]),
);
const exceptionCounts = Object.fromEntries(
  Object.entries(exceptions).map(([key, value]) => [key, value.length]),
);
const failures = [];
if (rateLimit) failures.push("Webflow staging rate limit encountered");
for (const [key, count] of Object.entries(exceptionCounts)) {
  if (count > 0) failures.push(`${key}: ${count}`);
}
if (international.inSitemap) {
  failures.push("International Expansion Videos remains in the sitemap");
}
if (international.status === 200) {
  failures.push("International Expansion Videos remains published on staging");
}

const output = {
  checkedAt: new Date().toISOString(),
  scope: `Read-only sitemap and saved-loader audit for PVG ${EXPECTED.version} on Pattern US staging`,
  origin: ORIGIN.origin,
  expected: EXPECTED,
  concurrency: CONCURRENCY,
  sitemap: {
    url: sitemapUrl,
    status: sitemapResponse.status,
    urlCount: sitemapPaths.length,
  },
  rateLimit,
  summary: {
    routesPlanned: sitemapPaths.length,
    routesAudited: completedRoutes.length,
    statusCounts: Object.fromEntries(
      [...new Set(completedRoutes.map((route) => route.status))]
        .sort((a, b) => a - b)
        .map((status) => [
          String(status),
          completedRoutes.filter((route) => route.status === status).length,
        ]),
    ),
    versions,
    exceptionCounts,
    international: {
      status: international.status,
      inSitemap: international.inSitemap,
    },
    failures,
  },
  international,
  exceptions,
  routes: completedRoutes,
};

await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      checkedAt: output.checkedAt,
      sitemap: output.sitemap,
      rateLimit,
      summary: output.summary,
      output: OUTPUT,
    },
    null,
    2,
  )}\n`,
);

if (rateLimit) {
  process.exitCode = 75;
} else if (failures.length) {
  process.exitCode = 1;
}
