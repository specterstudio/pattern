# Pattern Runtime distribution

This Cloudflare Workers Static Assets project owns the two mutable release
pointers used by every installed Pattern Runtime bootstrap:

- `https://runtime.pattern.com/channels/canary.json`
- `https://runtime.pattern.com/channels/stable.json`

The Runtime JavaScript itself is never served from a mutable URL. Each channel
manifest points to an immutable Git commit and includes that file's SHA-384
integrity value.

## Why this exists

Webflow sites install one commit-pinned bootstrap once. Routine Runtime
releases change a central channel manifest, so they do not require footer edits
or Webflow publishes on every consumer site.

The initial `canary` and `stable` manifests are intentionally disabled. A
deployment cannot activate Runtime code until a reviewed release manifest
replaces one of them.

## First deployment

1. Authenticate Wrangler with the Cloudflare account that owns `pattern.com`.
2. From this directory, run `npx wrangler deploy --dry-run`.
3. Deploy to its `workers.dev` preview URL.
4. Verify CORS, content type, cache control, `ETag`, and the disabled manifests.
5. Confirm that `runtime.pattern.com` does not already have a DNS record.
6. Attach `runtime.pattern.com` as the Worker's Custom Domain.
7. Verify both channel URLs again before installing a bootstrap on any site.

Cloudflare Custom Domains require an active Cloudflare zone and cannot replace
an existing CNAME. Domain attachment is therefore a separate, approved
production action; it is deliberately not present in `wrangler.jsonc`.

## Release

1. Commit the tested Runtime and bootstrap.
2. Run `tools/build-pattern-runtime-release.mjs` against that commit.
3. Copy the generated `canary.json` over
   `public/channels/canary.json`.
4. Run the manifest validation and complete the Library/staging canary gates.
5. Deploy this static-assets project.
6. Verify the public canary manifest and Runtime SRI.

## Promote

Copy the already-tested Runtime object from `canary.json` to `stable.json`,
keeping `"channel": "stable"`, then deploy and verify. Do not rebuild the
Runtime during promotion.

## Roll back

- Normal rollback: restore the prior `stable.json` and deploy.
- Emergency disable: copy `disabled.json` over `stable.json` and deploy.
- Bootstrap rollback: restore each site's backed-up footer only if the
  immutable bootstrap itself is defective.

The `_headers` file enables cross-origin reads, prevents MIME sniffing and
indexing, and requires channel manifests to be revalidated instead of being
served as long-lived browser cache entries.
