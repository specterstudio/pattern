import assert from "node:assert/strict";

import { renderToStaticMarkup } from "react-dom/server";

import { PatternIcon } from "../src/components/PatternIcon";
import {
  PATTERN_ICON_NAMES,
  PATTERN_ICON_SVGS,
} from "../src/generated";

assert.equal(PATTERN_ICON_NAMES.length, 1500, "Figma inventory should contain 1,500 unique icons");
assert.equal(new Set(PATTERN_ICON_NAMES).size, PATTERN_ICON_NAMES.length, "Icon names should be unique");
assert.deepEqual(Object.keys(PATTERN_ICON_SVGS), PATTERN_ICON_NAMES, "Icon map order should match the dropdown");

for (const name of PATTERN_ICON_NAMES) {
  const definition = PATTERN_ICON_SVGS[name];
  assert.ok(definition, `Missing SVG definition for ${name}`);
  assert.ok(definition.viewBox, `Missing viewBox for ${name}`);
  assert.ok(definition.body.length > 0, `Empty SVG body for ${name}`);
  assert.ok(!definition.body.includes("#FCF6F3"), `Figma display color was not normalized for ${name}`);
}

const inherited = renderToStaticMarkup(<PatternIcon name="arrow-right" size={32} />);
assert.match(inherited, /data-pattern-icon="arrow-right"/);
assert.match(inherited, /width:32px/);
assert.match(inherited, /aria-hidden="true"/);
assert.doesNotMatch(inherited, /aria-label=/);

const labelled = renderToStaticMarkup(
  <PatternIcon name="check" color="#006DFF" label="Complete" />,
);
assert.match(labelled, /color:#006DFF/);
assert.match(labelled, /aria-label="Complete"/);
assert.match(labelled, /role="img"/);

const fallback = renderToStaticMarkup(<PatternIcon name="not-a-real-icon" />);
assert.match(fallback, /data-pattern-icon="arrow-right"/);

console.log(`Verified ${PATTERN_ICON_NAMES.length} Pattern icons.`);
