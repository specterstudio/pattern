import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, '').split('=');
    return [key, value.join('=') || true];
  }),
);
const requestedCommit = String(args.get('commit') || 'HEAD');
const channel = String(args.get('channel') || 'canary');
const outputRoot = path.resolve(
  projectRoot,
  String(args.get('output') || 'output/pattern-runtime-release'),
);
const releasedAt = String(args.get('released-at') || new Date().toISOString());
const allowedChannels = new Set(['canary', 'stable']);

if (!allowedChannels.has(channel)) {
  throw new Error(`Unsupported channel "${channel}". Use canary or stable.`);
}

const commit = execFileSync('git', ['rev-parse', requestedCommit], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();

if (!/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error(`Could not resolve a full Git commit from "${requestedCommit}".`);
}

const paths = {
  runtime: 'webflow/pattern.com/scripts/runtime/pattern-runtime.js',
  loader: 'webflow/pattern.com/scripts/runtime/pattern-runtime-loader.js',
  loaderLock:
    'webflow/pattern.com/scripts/runtime/pattern-runtime-loader.lock.json',
  libraryTemplate:
    'webflow/pattern.com/scripts/runtime/pattern-runtime-library-footer.template.html',
  consumerTemplate:
    'webflow/pattern.com/scripts/runtime/pattern-runtime-consumer-footer.template.html',
};

const readCommittedFile = (file) =>
  execFileSync('git', ['show', `${commit}:${file}`], {
    cwd: projectRoot,
  });
const readFileAtCommit = (targetCommit, file) =>
  execFileSync('git', ['show', `${targetCommit}:${file}`], {
    cwd: projectRoot,
  });
const sri = (buffer) =>
  `sha384-${crypto.createHash('sha384').update(buffer).digest('base64')}`;
const sha256 = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

const runtimeBytes = readCommittedFile(paths.runtime);
const runtimeSource = runtimeBytes.toString('utf8');
const runtimeVersionMatch = runtimeSource.match(
  /const\s+VERSION\s*=\s*['"]([^'"]+)['"]/,
);

if (!runtimeVersionMatch) {
  throw new Error(`Could not read the Runtime version from ${paths.runtime}.`);
}

let loaderCommit = commit;
try {
  const loaderLock = JSON.parse(readCommittedFile(paths.loaderLock).toString('utf8'));
  if (loaderLock.commit) loaderCommit = String(loaderLock.commit);
} catch (error) {
  if (!String(error.message).includes('does not exist')) throw error;
}
loaderCommit = execFileSync('git', ['rev-parse', loaderCommit], {
  cwd: projectRoot,
  encoding: 'utf8',
}).trim();

if (!/^[0-9a-f]{40}$/.test(loaderCommit)) {
  throw new Error(`The permanent loader lock does not contain a full Git commit.`);
}

const runtimeVersion = runtimeVersionMatch[1];
const loaderBytes = readFileAtCommit(loaderCommit, paths.loader);
const libraryTemplate = readCommittedFile(paths.libraryTemplate).toString('utf8');
const consumerTemplate = readCommittedFile(paths.consumerTemplate).toString('utf8');
const runtimeSRI = sri(runtimeBytes);
const loaderSRI = sri(loaderBytes);
const loaderUrl =
  `https://cdn.jsdelivr.net/gh/specterstudio/pattern@${loaderCommit}/` +
  paths.loader;
const runtimeUrl =
  `https://cdn.jsdelivr.net/gh/specterstudio/pattern@${commit}/` +
  paths.runtime;
const manifest = {
  schemaVersion: 1,
  channel,
  enabled: true,
  releasedAt,
  runtime: {
    version: runtimeVersion,
    src: runtimeUrl,
    integrity: runtimeSRI,
  },
};

const renderFooter = (template) =>
  template
    .replaceAll('__LOADER_URL__', loaderUrl)
    .replaceAll('__LOADER_SRI__', loaderSRI)
    .replaceAll('__CHANNEL__', channel);

const outputDir = path.join(outputRoot, commit, channel);
await fs.mkdir(outputDir, { recursive: true });
await Promise.all([
  fs.writeFile(
    path.join(outputDir, `${channel}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  ),
  fs.writeFile(
    path.join(outputDir, `pattern-runtime-library-${channel}.html`),
    renderFooter(libraryTemplate),
  ),
  fs.writeFile(
    path.join(outputDir, `pattern-runtime-consumer-${channel}.html`),
    renderFooter(consumerTemplate),
  ),
  fs.writeFile(
    path.join(outputDir, 'release.json'),
    `${JSON.stringify(
      {
        commit,
        loaderCommit,
        channel,
        releasedAt,
        loader: {
          url: loaderUrl,
          integrity: loaderSRI,
          sha256: sha256(loaderBytes),
          bytes: loaderBytes.length,
        },
        runtime: {
          version: runtimeVersion,
          url: runtimeUrl,
          integrity: runtimeSRI,
          sha256: sha256(runtimeBytes),
          bytes: runtimeBytes.length,
        },
      },
      null,
      2,
    )}\n`,
  ),
]);

console.log(
  JSON.stringify(
    {
      outputDir,
      commit,
      loaderCommit,
      channel,
      loaderUrl,
      loaderSRI,
      runtimeUrl,
      runtimeSRI,
    },
    null,
    2,
  ),
);
