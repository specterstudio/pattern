# V3 grid responsive display repair

The scoped utility bridge forced local `u-grid` elements to `display: grid`, overriding Foundation column attributes such as `data-medium-columns="1"`. The new version moves only that base display declaration to a zero-specificity fallback. Sizing, gaps, flex direction, variants, other utilities, and the existing stylesheet are unchanged.

## Rollout

The existing bridge is pinned to commit `84b9726d25c17b1fd1f594fbe53039946ef504ba`. Keep it available for rollback. Update only the CSS URL and integrity value in Library V3 `Global / Foundation → Global / Styles`, embed `81d4d0c5-9d0b-d276-f24f-1b61738356a3`. Preserve all other embed content. Then verify the saved embed and complete Library adoption and staged page checks before production publication.

Webflow saving is currently blocked by expired Pattern authorization. No Library or production publication is included in this change.

## Validation

- 68 browser fixture cases with actual deployed bridge and Foundation responsive rules: old version passes 55; repaired version passes 68.
- Covers column counts 1–12 at medium/small/xsmall, exact container breakpoints, desktop defaults, re-expansion at narrower breakpoints, prefixed Library grids, outside-V3 controls, and hidden/legacy controls.
- Current Case Studies (Golf Pride) section captured from Designer and rendered locally: at 1440px, both versions show four columns and two rows; at 820px, 667px, and 393px, the repair stacks all eight cards into one column.
- These are local browser checks, not staging or published-site verification.

## Integrity

`sha384-RZUSOOZ+q8q0JHR43M93fTpUh/CBwm9gY6iqGVDg3NInww9gUtrgcdaaQBQgBqz7`

## Rollback

Restore the original URL and SRI in the Library embed. Original URL:

`https://cdn.jsdelivr.net/gh/specterstudio/pattern@84b9726d25c17b1fd1f594fbe53039946ef504ba/webflow/pattern.com/styles/v3-utility-bridge.css`

Original SRI:

`sha384-zqajVArUKUVUmVxUIlfXOksOqb0QS0OJ4N1D58RFhmqP+a9XOwo1r5GYvN7mR1e2`
