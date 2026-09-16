# Pattern Runtime 1.0 migration

No Webflow site is changed by committing these files. Domain attachment,
manifest activation, footer edits, and every Webflow publish remain separate
approved production actions.

## Permanent install contract

Each site installs one immutable bootstrap once:

- V3 Library: `profile="library-v3"` and channel `canary` during rollout.
- Staging consumer sites: `profile="consumer"` and channel `canary`.
- Production consumer sites: `profile="consumer"` and channel `stable`.

Future Runtime releases change only the centrally hosted channel manifest. The
bootstrap URL and SRI come from `pattern-runtime-loader.lock.json` and remain
unchanged.

## Pattern V3 Library

1. Keep the existing footer backup.
2. Replace only the existing Pattern Runtime script block with the generated
   `pattern-runtime-library-canary.html` snippet.
3. Do not add PVG.
4. Publish only after separate approval.
5. Verify representative component pages and confirm that no legacy assets
   load.

## Pattern US staging

Keep these existing footer sections unchanged:

- Autopilot SDK;
- Storylane;
- the `Execute registered page functions` block.

Remove:

- the old `Pattern Component Runtime` script block;
- the entire inline `Pattern Version Gateway legacy cutover loader` block.

Insert the generated `pattern-runtime-consumer-canary.html` snippet after the
page-functions executor. Publish staging only after separate approval, then run
the full V1/V2/V2L/V3 matrix.

## Pattern US production

After the exact canary Runtime URL and SRI have passed Library and staging:

1. promote that same Runtime object to `stable.json`;
2. replace the old Runtime and PVG blocks with the generated
   `pattern-runtime-consumer-stable.html` snippet;
3. publish production only after separate approval;
4. verify representative V1, V2, V2L, and V3 routes.

## All other production sites

Use the same generated consumer `stable` snippet. This is the final routine
footer update for Pattern Runtime. Later Runtime releases are promoted through
the central manifest and require no Webflow footer edit or site publish.

## Rollback

1. Fastest: deploy `enabled:false` to the affected central channel.
2. Normal: restore the last verified channel manifest.
3. Bootstrap failure only: restore the appropriate file under
   `webflow/pattern.com/scripts/runtime/rollback/` and publish the affected
   site.
4. If Designer state is also damaged, restore the user-created Webflow backup.
