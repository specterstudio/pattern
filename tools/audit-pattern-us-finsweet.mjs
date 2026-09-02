import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_SITEMAP = 'https://www.pattern.com/sitemap.xml';
const MAX_CONCURRENCY = 10;
const TARGETS = {
  list: 'fs-list-element',
  scrollDisable: 'fs-scrolldisable-element',
  socialShare: 'fs-socialshare-element',
};
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument?.slice('--output='.length);

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Pattern-Runtime-Finsweet-read-only-audit/1.0',
    },
    redirect: 'follow',
  });
  const text = await response.text();
  return { response, text };
};

const decodeXml = (value) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();

const extractLocations = (xml) =>
  [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeXml(match[1]));

const stripNonMarkupContent = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

const extractAttributeValues = (markup, attribute) => {
  const pattern = new RegExp(
    `\\s${attribute}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`,
    'gi',
  );
  return [...markup.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
};

const extractFinsweetScripts = (html) => {
  const headEnd = html.search(/<\/head>/i);
  return [...html.matchAll(/<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi)]
    .map((match) => ({
      tag: match[0].replace(/\s+/g, ' ').trim(),
      src: match[1] || match[2] || match[3],
      location: headEnd !== -1 && match.index < headEnd ? 'head' : 'body',
    }))
    .filter(({ src }) => /@finsweet\/attributes|finsweet.*socialshare/i.test(src));
};

const inspectHtml = (html) => {
  const markup = stripNonMarkupContent(html);
  const features = Object.fromEntries(
    Object.entries(TARGETS).map(([key, attribute]) => {
      const values = extractAttributeValues(markup, attribute);
      return [key, { selector: `[${attribute}]`, count: values.length, values: [...new Set(values)] }];
    }),
  );
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
  const pageId = html.match(/\bdata-wf-page=["']([^"']+)["']/i)?.[1] || null;
  const version = html.match(/\bdata-pattern-version=["'](v1|v2|v2l|v3)["']/i)?.[1] || null;

  return {
    title,
    pageId,
    version,
    features,
    finsweetScripts: extractFinsweetScripts(html),
  };
};

const { response: rootResponse, text: rootXml } = await fetchText(ROOT_SITEMAP);
if (!rootResponse.ok) throw new Error(`${ROOT_SITEMAP} returned ${rootResponse.status}`);

const rootLocations = extractLocations(rootXml);
const sitemapUrls = rootLocations.filter((url) => /\.xml(?:\?|$)/i.test(url));
const pageUrls = new Set(rootLocations.filter((url) => !/\.xml(?:\?|$)/i.test(url)));

for (const sitemapUrl of sitemapUrls) {
  const { response, text } = await fetchText(sitemapUrl);
  if (!response.ok) throw new Error(`${sitemapUrl} returned ${response.status}`);
  extractLocations(text)
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
      const { response, text } = await fetchText(url);
      results[index] = {
        url,
        finalUrl: response.url,
        pathname: new URL(response.url || url).pathname,
        status: response.status,
        ...inspectHtml(text),
      };
    } catch (error) {
      results[index] = {
        url,
        finalUrl: null,
        pathname: new URL(url).pathname,
        status: null,
        error: error.message,
        features: Object.fromEntries(
          Object.entries(TARGETS).map(([key, attribute]) => [
            key,
            { selector: `[${attribute}]`, count: 0, values: [] },
          ]),
        ),
        finsweetScripts: [],
      };
    }
  }
};

await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, urls.length) }, worker));

const pagesByFeature = Object.fromEntries(
  Object.keys(TARGETS).map((feature) => [
    feature,
    results
      .filter((result) => result.features[feature].count > 0)
      .map(({ finalUrl, features, pageId, pathname, status, title, url, version }) => ({
        url,
        finalUrl,
        pathname,
        status,
        pageId,
        version,
        title,
        count: features[feature].count,
        values: features[feature].values,
      }))
      .sort((a, b) => a.pathname.localeCompare(b.pathname)),
  ]),
);

const globalScriptTags = [
  ...new Map(
    results
      .flatMap((result) => result.finsweetScripts)
      .map((script) => [script.tag, script]),
  ).values(),
].sort((a, b) => a.src.localeCompare(b.src));

const homeV3 = results.find((result) => result.pathname === '/home-v3') || null;
const errors = results
  .filter((result) => result.error || !result.status || result.status >= 400)
  .map(({ error, finalUrl, pathname, status, url }) => ({
    url,
    finalUrl,
    pathname,
    status,
    ...(error ? { error } : {}),
  }));

const report = {
  auditedAt: new Date().toISOString(),
  rootSitemap: ROOT_SITEMAP,
  totalRoutes: results.length,
  successfulRoutes: results.length - errors.length,
  errors,
  selectors: Object.fromEntries(
    Object.entries(TARGETS).map(([key, attribute]) => [key, `[${attribute}]`]),
  ),
  counts: Object.fromEntries(
    Object.entries(pagesByFeature).map(([feature, pages]) => [feature, pages.length]),
  ),
  pagesByFeature,
  homeV3: homeV3
    ? {
        url: homeV3.url,
        finalUrl: homeV3.finalUrl,
        status: homeV3.status,
        pageId: homeV3.pageId,
        version: homeV3.version,
        features: homeV3.features,
        finsweetScripts: homeV3.finsweetScripts,
      }
    : null,
  globalScriptTags,
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
