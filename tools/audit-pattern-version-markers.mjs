import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_SITEMAP = 'https://www.pattern.com/sitemap.xml';
const MAX_CONCURRENCY = 12;
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument?.slice('--output='.length);

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Pattern-PVG-read-only-audit/1.0',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
};

const extractLocations = (xml) =>
  [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) =>
    match[1]
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .trim(),
  );

const inspectHtml = (html) => {
  const explicitVersion = html.match(
    /<(?:html|body)\b[^>]*\bdata-pattern-version=["'](v1|v2|v2l|v3)["']/i,
  )?.[1]?.toLowerCase();

  const pageMainClassLists = [
    ...html.matchAll(/\bclass=["']([^"']*\bpage_main(?:_v3)?\b[^"']*)["']/gi),
  ]
    .map((match) => match[1].split(/\s+/));
  const pageMainClasses = pageMainClassLists.flat();
  const classTokens = new Set(pageMainClasses);
  const allClassTokens = new Set(
    [...html.matchAll(/\bclass=["']([^"']*)["']/gi)]
      .map((match) => match[1].split(/\s+/))
      .flat()
      .filter(Boolean),
  );
  const markerTokens = ['cc-v1', 'cc-v2', 'cc-v2l', 'cc-v3'].filter((token) =>
    allClassTokens.has(token),
  );
  const pageId = html.match(/\bdata-wf-page=["']([^"']+)["']/i)?.[1] || null;
  const count = (pattern) => [...html.matchAll(pattern)].length;
  const fingerprints = {
    v1: count(/pattern-library-v1--/gi),
    v2: count(/pattern-library-v2--/gi),
    v3: count(/pattern-library-v3--/gi),
  };

  let version = 'unknown';
  if (explicitVersion) version = explicitVersion;
  else if (classTokens.has('page_main_v3') || classTokens.has('cc-v3')) version = 'v3';
  else if (classTokens.has('cc-v2l')) version = 'v2l';
  else if (classTokens.has('cc-v2')) version = 'v2';
  else if (classTokens.has('cc-v1')) version = 'v1';
  else if (classTokens.has('page_main')) version = 'inferred-v2';

  return {
    version,
    pageId,
    markerTokens,
    fingerprints,
  };
};

const rootXml = await fetchText(ROOT_SITEMAP);
const rootLocations = extractLocations(rootXml);
const sitemapUrls = rootLocations.filter((url) => /\.xml(?:\?|$)/i.test(url));
const pageUrls = new Set(
  rootLocations.filter((url) => !/\.xml(?:\?|$)/i.test(url)),
);

for (const sitemapUrl of sitemapUrls) {
  const xml = await fetchText(sitemapUrl);
  extractLocations(xml)
    .filter((url) => !/\.xml(?:\?|$)/i.test(url))
    .forEach((url) => pageUrls.add(url));
}

const urls = [...pageUrls];
const results = new Array(urls.length);
let cursor = 0;

const worker = async () => {
  while (cursor < urls.length) {
    const index = cursor;
    cursor += 1;
    const url = urls[index];

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Pattern-PVG-read-only-audit/1.0',
        },
        redirect: 'follow',
      });
      const html = await response.text();
      const inspection = inspectHtml(html);
      results[index] = {
        url,
        finalUrl: response.url,
        status: response.status,
        ...inspection,
      };
    } catch (error) {
      results[index] = {
        url,
        finalUrl: null,
        status: null,
        version: 'error',
        error: error.message,
      };
    }
  }
};

await Promise.all(
  Array.from({ length: Math.min(MAX_CONCURRENCY, urls.length) }, worker),
);

const grouped = Object.groupBy(results, (result) => result.version);
const inferredV2Templates = Object.entries(
  Object.groupBy(grouped['inferred-v2'] || [], (result) => result.pageId || 'unknown'),
)
  .map(([pageId, rows]) => ({
    pageId,
    routes: rows.length,
    v1FingerprintHits: rows.reduce((total, row) => total + row.fingerprints.v1, 0),
    v2FingerprintHits: rows.reduce((total, row) => total + row.fingerprints.v2, 0),
    v3FingerprintHits: rows.reduce((total, row) => total + row.fingerprints.v3, 0),
  }))
  .sort((a, b) => b.routes - a.routes || a.pageId.localeCompare(b.pageId));
const report = {
  auditedAt: new Date().toISOString(),
  rootSitemap: ROOT_SITEMAP,
  total: results.length,
  counts: Object.fromEntries(
    Object.entries(grouped).map(([version, rows]) => [version, rows.length]),
  ),
  inferredV2Templates,
  routes: Object.fromEntries(
    Object.entries(grouped).map(([version, rows]) => [
      version,
      rows
        .map(({ error, finalUrl, fingerprints, markerTokens, pageId, status, url }) => ({
          url,
          finalUrl,
          status,
          pageId,
          markerTokens,
          fingerprints,
          ...(error ? { error } : {}),
        }))
        .sort((a, b) => a.url.localeCompare(b.url)),
    ]),
  ),
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (outputPath) {
  const resolvedOutput = path.resolve(outputPath);
  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, serialized, 'utf8');
  console.log(`Wrote ${results.length} routes to ${resolvedOutput}`);
} else {
  process.stdout.write(serialized);
}
