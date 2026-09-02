import fs from "node:fs/promises";

const ORIGIN = new URL(
  process.env.PVG_ORIGIN ?? "https://pattern-us.webflow.io",
);
const OUTPUT =
  process.env.PVG_OUTPUT ??
  "/Users/kenneth/_Projects/pattern/audits/pvg/2026-07-30-us-staging-pvg-0.2.4-international-correction.json";
const PREVIOUS_CRAWL =
  "/Users/kenneth/_Projects/pattern/audits/pvg/2026-07-30-us-staging-pvg-0.2.4-route-crawl.json";
const INTERNATIONAL_PATH = "/resources/international-expansion-videos";
const EXPECTED = {
  version: "0.2.4",
  runtimeCommit: "7bb2b6f2fc7ae258285fbafcd643e717b64009e1",
  runtimeIntegrity:
    "sha384-HBYB8fSqocEljJAPTrEeai0HbLKdhRDfgFfu/4cslT7DnF6MRKxYcbVu/U0Z8sBp",
};

async function fetchText(path) {
  const response = await fetch(
    new URL(
      `${path}${path.includes("?") ? "&" : "?"}pvg-check=${Date.now()}`,
      ORIGIN,
    ),
    {
      headers: {
        "cache-control": "no-cache",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
      },
      redirect: "follow",
    },
  );
  return {
    status: response.status,
    finalUrl: response.url,
    text: await response.text(),
  };
}

const home = await fetchText("/");
const sitemap = await fetchText("/sitemap.xml");
const international = await fetchText(INTERNATIONAL_PATH);
const publishedAt =
  home.text.match(/Last Published:\s*([^<]+?)\s*-->/i)?.[1]?.trim() ?? null;
const sitemapPaths = [
  ...sitemap.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
].map((match) => new URL(match[1].replaceAll("&amp;", "&")).pathname);
let previousPaths = [];
try {
  const previous = JSON.parse(await fs.readFile(PREVIOUS_CRAWL, "utf8"));
  previousPaths = previous.routes.map((route) => route.path);
} catch {
  // The correction check can run independently of the earlier full crawl.
}
const addedSinceCrawl = sitemapPaths.filter(
  (path) => !previousPaths.includes(path),
);
const removedSinceCrawl = previousPaths.filter(
  (path) => !sitemapPaths.includes(path),
);
const loader = {
  version:
    home.text.match(/patternPvgLoader\s*=\s*'([^']+)'/)?.[1] ?? null,
  runtimeCommit:
    home.text.match(
      /pattern@([0-9a-f]{40})\/webflow\/pattern\.com\/scripts\/runtime\/pattern-version-gateway\.js/,
    )?.[1] ?? null,
  runtimeIntegrity:
    home.text.match(/script\.integrity\s*=\s*\n?\s*'([^']+)'/)?.[1] ?? null,
  modeActive:
    home.text.includes("pvgMode = 'active'") &&
    home.text.includes("dataset.pvgMode = 'active'"),
  legacyGateway:
    home.text.includes("legacyPolicy: 'gateway'") &&
    home.text.includes("dataset.pvgLegacyPolicy = 'gateway'"),
};
const failures = [];

if (home.status !== 200) failures.push(`Homepage HTTP ${home.status}`);
if (sitemap.status !== 200) failures.push(`Sitemap HTTP ${sitemap.status}`);
if (international.status === 200) {
  failures.push("International Expansion Videos still returns HTTP 200");
}
if (sitemapPaths.includes(INTERNATIONAL_PATH)) {
  failures.push("International Expansion Videos remains in the sitemap");
}
if (loader.version !== EXPECTED.version) failures.push("Wrong PVG version");
if (loader.runtimeCommit !== EXPECTED.runtimeCommit) {
  failures.push("Wrong PVG runtime commit");
}
if (loader.runtimeIntegrity !== EXPECTED.runtimeIntegrity) {
  failures.push("Wrong PVG runtime SRI");
}
if (!loader.modeActive) failures.push("PVG mode is not active");
if (!loader.legacyGateway) failures.push("PVG legacy policy is not gateway");

const output = {
  checkedAt: new Date().toISOString(),
  origin: ORIGIN.origin,
  publishedAt,
  homeStatus: home.status,
  sitemapStatus: sitemap.status,
  sitemapUrlCount: sitemapPaths.length,
  sitemapDiffFromInitialCrawl: {
    added: addedSinceCrawl,
    removed: removedSinceCrawl,
  },
  international: {
    path: INTERNATIONAL_PATH,
    status: international.status,
    finalUrl: international.finalUrl,
    inSitemap: sitemapPaths.includes(INTERNATIONAL_PATH),
  },
  loader,
  expected: EXPECTED,
  failures,
};

await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...output, output: OUTPUT }, null, 2)}\n`);

if (failures.length) process.exitCode = 1;
