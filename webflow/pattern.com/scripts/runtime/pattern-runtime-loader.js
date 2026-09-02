/**
 * Pattern Runtime permanent bootstrap
 *
 * Install this immutable loader once per Webflow site. Routine Runtime
 * releases update the central stable/canary manifest, not the site footer.
 */
(() => {
  'use strict';

  const LOADER_VERSION = '1.0.0';
  const GLOBAL_NAME = 'PatternRuntime';
  const EVENT_PREFIX = 'pattern:runtime';
  const currentScript = document.currentScript;

  if (!currentScript) {
    console.warn('[Pattern Runtime] The permanent bootstrap needs a script element.');
    return;
  }

  const profile = currentScript.dataset.patternRuntimeProfile || 'consumer';
  const channel = currentScript.dataset.patternRuntimeChannel || 'stable';
  const mode = currentScript.dataset.patternRuntimeMode || 'active';
  const legacyPolicy =
    currentScript.dataset.patternRuntimeLegacyPolicy ||
    (profile === 'consumer' ? 'gateway' : 'preserve');
  const pageFunctions = String(
    currentScript.dataset.patternRuntimePageFunctions || 'nav,splideSlider',
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const debug =
    currentScript.hasAttribute('data-pattern-runtime-debug') ||
    new URLSearchParams(window.location.search).has('pattern-runtime-debug');
  const defaultManifestUrl = new URL(`./${channel}.json`, currentScript.src).href;
  const manifestUrl =
    currentScript.dataset.patternRuntimeManifest || defaultManifestUrl;

  const log = (...args) => {
    if (debug) console.info('[Pattern Runtime Loader]', ...args);
  };

  const warn = (...args) => {
    console.warn('[Pattern Runtime Loader]', ...args);
  };

  const emit = (name, detail = {}) => {
    document.dispatchEvent(
      new CustomEvent(`${EVENT_PREFIX}:${name}`, {
        detail: {
          loaderVersion: LOADER_VERSION,
          profile,
          channel,
          manifestUrl,
          ...detail,
        },
      }),
    );
  };

  const installPageFunctionsBridge = () => {
    if (profile !== 'consumer' || !pageFunctions.length) return;

    const registry = window.pageFunctions;
    if (
      !registry ||
      typeof registry.executeFunctions !== 'function' ||
      registry.__patternRuntimeOriginalExecuteFunctions
    ) {
      return;
    }

    const originalExecuteFunctions = registry.executeFunctions;
    registry.__patternRuntimeOriginalExecuteFunctions = originalExecuteFunctions;
    registry.executeFunctions = function executeNonRuntimeFunctions() {
      const parkedFunctions = new Map();

      pageFunctions.forEach((id) => {
        if (typeof this.functions?.[id] !== 'function') return;
        parkedFunctions.set(id, this.functions[id]);
        delete this.functions[id];
      });

      try {
        return originalExecuteFunctions.call(this);
      } finally {
        parkedFunctions.forEach((fn, id) => {
          this.functions[id] = fn;
        });
      }
    };
  };

  const validateManifest = (manifest) => {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('The release manifest is not an object.');
    }

    if (manifest.schemaVersion !== 1) {
      throw new Error(`Unsupported manifest schema: ${manifest.schemaVersion}.`);
    }

    if (manifest.enabled === false) return manifest;

    if (!manifest.runtime || typeof manifest.runtime !== 'object') {
      throw new Error('The release manifest has no Runtime entry.');
    }

    if (!manifest.runtime.version || !manifest.runtime.src) {
      throw new Error('The Runtime version and source are required.');
    }

    if (!/^sha384-[A-Za-z0-9+/=]+$/.test(manifest.runtime.integrity || '')) {
      throw new Error('The Runtime integrity value must be a SHA-384 SRI string.');
    }

    return manifest;
  };

  const loadRuntime = (manifest) => {
    if (manifest.enabled === false) {
      emit('loader-disabled', {
        manifest,
      });
      log('The active manifest is disabled. Authored Webflow content remains available.');
      return Promise.resolve(null);
    }

    const runtimeUrl = new URL(manifest.runtime.src, manifestUrl).href;
    const existingRuntime = window[GLOBAL_NAME];

    if (existingRuntime?.version) {
      void existingRuntime.scan(document);
      emit('loader-ready', {
        runtimeVersion: existingRuntime.version,
        runtimeUrl,
        reused: true,
      });
      return Promise.resolve(existingRuntime);
    }

    const existingScript = [...document.scripts].find(
      (script) => script.dataset.patternRuntimePayload === manifest.runtime.version,
    );

    if (existingScript) {
      return new Promise((resolve, reject) => {
        existingScript.addEventListener(
          'load',
          () => resolve(window[GLOBAL_NAME] || null),
          { once: true },
        );
        existingScript.addEventListener(
          'error',
          () => reject(new Error(`Failed to load Pattern Runtime: ${runtimeUrl}`)),
          { once: true },
        );
      });
    }

    window.PatternRuntimeConfig = {
      ...(window.PatternRuntimeConfig || {}),
      profile,
      mode,
      legacyPolicy,
      pageFunctions,
      manifestVersion: manifest.runtime.version,
    };

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = runtimeUrl;
      script.async = true;
      script.integrity = manifest.runtime.integrity;
      script.crossOrigin = 'anonymous';
      script.dataset.patternRuntimePayload = manifest.runtime.version;
      script.dataset.patternRuntimeProfile = profile;
      script.dataset.patternRuntimeMode = mode;
      script.dataset.patternRuntimeLegacyPolicy = legacyPolicy;
      script.dataset.patternRuntimeManifestVersion = manifest.runtime.version;
      script.addEventListener(
        'load',
        () => {
          const runtime = window[GLOBAL_NAME];
          if (!runtime?.version) {
            reject(
              new Error(
                `Pattern Runtime ${manifest.runtime.version} loaded without ${GLOBAL_NAME}.`,
              ),
            );
            return;
          }

          emit('loader-ready', {
            runtimeVersion: runtime.version,
            runtimeUrl,
            reused: false,
          });
          resolve(runtime);
        },
        { once: true },
      );
      script.addEventListener(
        'error',
        () => reject(new Error(`Failed to load Pattern Runtime: ${runtimeUrl}`)),
        { once: true },
      );
      document.head.appendChild(script);
    });
  };

  if (window[GLOBAL_NAME]?.version) {
    void window[GLOBAL_NAME].scan(document);
    return;
  }

  installPageFunctionsBridge();
  currentScript.dataset.patternRuntimeLoader = LOADER_VERSION;

  if (!window.__patternRuntimeLoaderPromise) {
    window.__patternRuntimeLoaderPromise = fetch(manifestUrl, {
      cache: 'no-store',
      credentials: 'omit',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Manifest request failed with HTTP ${response.status}.`);
        }
        return response.json();
      })
      .then(validateManifest)
      .then(loadRuntime)
      .catch((error) => {
        emit('loader-error', { error });
        warn('The Runtime could not load. Authored Webflow content remains available.', error);
        return null;
      });
  }

  void window.__patternRuntimeLoaderPromise.then((runtime) => {
    log('Ready.', {
      runtimeVersion: runtime?.version || null,
      profile,
      channel,
      manifestUrl,
    });
  });
})();
