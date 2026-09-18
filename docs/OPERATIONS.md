# Operations

## Release rules

- Treat every published Git commit and release tag as immutable.
- Never use `main` as a production asset URL.
- Do not delete the last branch or tag that makes a production-pinned commit
  reachable.
- Test the exact commit that will be referenced; do not rebuild between
  validation and promotion.
- A repository change does not authorize a Webflow publish.

## Standard workflow

1. Create a descriptive branch from current `main`.
2. Change only the required assets and update their tests.
3. Run `npm test`.
4. Commit the candidate and calculate the final immutable jsDelivr URL and SRI.
5. Test that exact URL on a safe Webflow page or staging site.
6. Obtain approval for the Webflow change.
7. Publish the approved site and verify representative routes.
8. Retain the previous commit URL and Webflow backup as the rollback target.

## Runtime release package

After committing a runtime candidate:

```bash
npm run build:runtime-release -- --commit=HEAD --channel=canary
```

The generated output belongs under `output/` and must not be committed.

## Verification baseline

For Pattern US, check at least one representative page from every active page
generation plus any page that directly exercises the changed module. Verify
console errors, network failures, keyboard behavior, consent behavior, and the
absence of duplicate initialization.

For Pattern UK, run `npm run test:uk` and follow the rollout boundary in its
package README.

## Rollback

Rollback should restore the previously verified immutable URL and integrity
value, then republish the affected Webflow site. Do not move a tag or replace
the contents behind an existing release identifier.

If a runtime channel manifest is in use, point it back to the last verified
runtime object or disable the channel. Restoring Webflow custom code is reserved
for bootstrap failures.

## Repository transfer

Before transferring ownership, confirm that the destination organization can
serve every commit and tag referenced by production. Existing jsDelivr URLs
contain the repository owner and name, so the transfer must include a URL
migration plan and a period where both old and new URLs remain available.
