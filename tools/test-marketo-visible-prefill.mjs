import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loaderPath = path.join(
  projectRoot,
  'webflow/pattern.com/styles/v3-prep/component-twins/marketo-deferred-loader.html',
);
const loaderSource = await fs.readFile(loaderPath, 'utf8');
const loaderScript = loaderSource.match(/<script>\s*([\s\S]*?)<\/script>/u)?.[1];
const formsPlusSource = await fs.readFile(
  path.join(
    projectRoot,
    'webflow/pattern.com/archive/legacy-root/teknkl-formsplus-core-1.0.8.js',
  ),
  'utf8',
);
const helperStart = loaderSource.indexOf('const getNamedFields = ');
const helperEnd = loaderSource.indexOf('\n\n    const loadForm', helperStart);

assert.ok(loaderScript, 'The V3 loader script could not be extracted.');
assert.doesNotThrow(() => new Function(loaderScript), 'The V3 loader must parse.');
assert.notEqual(helperStart, -1, 'The V3 loader must define its field filters.');
assert.notEqual(helperEnd, -1, 'The V3 loader prefill helper could not be extracted.');
assert.doesNotMatch(
  loaderSource,
  /setValuesCoerced\(mktoFields\)/u,
  'SimpleDTO values must not be applied to hidden fields without filtering.',
);
assert.match(
  loaderSource,
  /setValuesCoerced\(safePrefill\)/u,
  'The V3 loader must apply only the filtered prefill payload.',
);
assert.match(loaderSource, /rdt_cid: "Reddit_Click_ID__c"/u);
assert.match(loaderSource, /values\.FBP__c = fbp/u);
assert.match(loaderSource, /values\.FBC__c = fbc/u);
assert.match(loaderSource, /values\.Landing_Page__c = window\.location\.href/u);
assert.match(loaderSource, /values\.Client_User_Agent__c = navigator\.userAgent/u);
assert.match(loaderSource, /existing\?\.remove\(\)/u);
assert.match(loaderSource, /isReady: \(\) => Boolean\(window\.FormsPlus\)/u);
assert.match(loaderSource, /warnEnhancementFailure\("returning-visitor prefill", error\)/u);
assert.ok(
  loaderSource.indexOf('setStatus("ready")') <
    loaderSource.indexOf('void initializePrefill(form, dependenciesReady)'),
  'A successful base form must be marked ready before optional prefill starts.',
);

const helperDeclaration = loaderSource.slice(helperStart, helperEnd);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.setContent(`
    <form id="marketo-fixture">
      <input name="FirstName" value="">
      <select name="Region__c">
        <option value=""></option>
        <option value="EMEA">EMEA</option>
      </select>
      <input type="hidden" name="Product_Interest__c" value="Fulfillment">
      <input type="hidden" name="Contact_Us_Routing_Trigger__c" value="true">
      <input type="radio" name="Preferred_Channel__c" value="Email">
      <input type="radio" name="Preferred_Channel__c" value="Phone">
    </form>
  `);
  await page.addScriptTag({
    content: `
      (() => {
        const formElement = document.getElementById('marketo-fixture');
        ${helperDeclaration}
        window.__filterPrefillFields = filterPrefillFields;
        window.__filterFieldsForForm = filterFieldsForForm;
      })();
    `,
  });

  const result = await page.evaluate(() => {
    const root = document.getElementById('marketo-fixture');
    const form = {
      getFormElem() {
        return [root];
      },
      setValuesCoerced(values) {
        Object.entries(values).forEach(([name, value]) => {
          const control = root.elements.namedItem(name);

          if (control instanceof RadioNodeList) {
            control.value = value;
          } else if (control) {
            control.value = value;
          }
        });
      },
    };
    const dtoValues = {
      FirstName: 'Ada',
      Region__c: 'EMEA',
      Product_Interest__c: 'Other',
      Contact_Us_Routing_Trigger__c: 'false',
      Preferred_Channel__c: 'Email',
      Unknown_Field__c: 'ignored',
    };
    const safePrefill = window.__filterPrefillFields(form, dtoValues);
    const supportedAttribution = window.__filterFieldsForForm(form, dtoValues);

    form.setValuesCoerced(safePrefill);

    return {
      safePrefill,
      supportedAttribution,
      firstName: root.elements.namedItem('FirstName').value,
      region: root.elements.namedItem('Region__c').value,
      productInterest: root.elements.namedItem('Product_Interest__c').value,
      routingTrigger: root.elements.namedItem('Contact_Us_Routing_Trigger__c').value,
      preferredChannel: root.elements.namedItem('Preferred_Channel__c').value,
    };
  });

  assert.deepEqual(result.safePrefill, {
    FirstName: 'Ada',
    Region__c: 'EMEA',
    Preferred_Channel__c: 'Email',
  });
  assert.deepEqual(result.supportedAttribution, {
    FirstName: 'Ada',
    Region__c: 'EMEA',
    Product_Interest__c: 'Other',
    Contact_Us_Routing_Trigger__c: 'false',
    Preferred_Channel__c: 'Email',
  });
  assert.equal(result.firstName, 'Ada');
  assert.equal(result.region, 'EMEA');
  assert.equal(result.preferredChannel, 'Email');
  assert.equal(result.productInterest, 'Fulfillment');
  assert.equal(result.routingTrigger, 'true');

  const formsPlusUrl =
    'https://cdn.jsdelivr.net/gh/specterstudio/pattern@c2386d587e9213612a86fd11f3b064a916d4d9fa/webflow/pattern.com/archive/legacy-root/teknkl-formsplus-core-1.0.8.js';
  const staleScriptPage = await browser.newPage();
  await staleScriptPage.route(formsPlusUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: formsPlusSource,
    }),
  );
  await staleScriptPage.setContent(`
    <script>
      window.SimpleDTO = class SimpleDTO {
        constructor(options) {
          this.cleanup = () => {};
          options.cb(this, {});
        }
      };
      window.MktoForms2 = {
        getForm() {
          const element = document.querySelector('[data-pattern-marketo-form]');
          return {
            getFormElem: () => [element],
            setValues: () => {},
            setValuesCoerced: () => {},
            onSubmit: () => {},
          };
        }
      };
    </script>
    <script id="teknkl-FormsPlus-Core-1.x"></script>
    <div data-marketo-form-id="232">
      ${loaderSource}
    </div>
  `);
  await staleScriptPage.evaluate(() => {
    document
      .querySelector('[data-marketo-form-id="232"]')
      .dispatchEvent(new Event('pointerenter'));
  });
  await staleScriptPage.waitForFunction(
    () => Boolean(window.FormsPlus) &&
      document.getElementById('teknkl-FormsPlus-Core-1.x')?.dataset.loaded === 'true',
  );
  const staleScriptResult = await staleScriptPage.evaluate(() => {
    const root = document.querySelector('[data-marketo-form-id="232"]');
    const status = root.querySelector('[data-pattern-marketo-status]');
    return {
      state: root.dataset.marketoState,
      statusHidden: status.hidden,
      matchingScripts: document.querySelectorAll(
        '[id="teknkl-FormsPlus-Core-1.x"]',
      ).length,
    };
  });
  assert.deepEqual(staleScriptResult, {
    state: 'ready',
    statusHidden: true,
    matchingScripts: 1,
  });

  const dependencyFailurePage = await browser.newPage();
  await dependencyFailurePage.route(formsPlusUrl, (route) => route.abort());
  await dependencyFailurePage.setContent(`
    <script>
      window.__marketoUnhandledRejections = [];
      window.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        window.__marketoUnhandledRejections.push(String(event.reason));
      });
      window.SimpleDTO = class SimpleDTO {};
      window.MktoForms2 = {
        getForm: () => null,
        loadForm(host, account, formId, callback) {
          window.setTimeout(() => {
            const element = document.querySelector('[data-pattern-marketo-form]');
            callback({
              getFormElem: () => [element],
              setValues: () => {},
              setValuesCoerced: () => {},
              onSubmit: () => {},
            });
          }, 500);
        }
      };
    </script>
    <div data-marketo-form-id="232">
      ${loaderSource}
    </div>
  `);
  await dependencyFailurePage.evaluate(() => {
    document
      .querySelector('[data-marketo-form-id="232"]')
      .dispatchEvent(new Event('pointerenter'));
  });
  await dependencyFailurePage.waitForFunction(
    () => document.querySelector('[data-marketo-form-id="232"]')
      ?.dataset.marketoState === 'ready',
  );
  await dependencyFailurePage.waitForTimeout(100);
  const dependencyFailureResult = await dependencyFailurePage.evaluate(() => {
    const root = document.querySelector('[data-marketo-form-id="232"]');
    const status = root.querySelector('[data-pattern-marketo-status]');
    return {
      state: root.dataset.marketoState,
      statusHidden: status.hidden,
      unhandledRejections: window.__marketoUnhandledRejections,
    };
  });
  assert.deepEqual(dependencyFailureResult, {
    state: 'ready',
    statusHidden: true,
    unhandledRejections: [],
  });

  console.log('Marketo visible-field prefill and loader resilience regressions: passed');
} finally {
  await browser.close();
}
