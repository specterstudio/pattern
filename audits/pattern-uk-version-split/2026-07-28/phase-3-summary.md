# Phase 3 Results

Phase 3 is complete. The source split and inert Webflow component resources are prepared, but no production asset loading changed and nothing was published.

## Local source package

Location: `webflow/uk.pattern.com/version-split/`

- Shared foundation CSS
- Explicitly scoped V1 CSS
- Explicitly scoped V2 CSS
- 14 feature CSS modules
- Shared JavaScript runtime
- Intentionally empty V1 and V2 JavaScript entry files
- Declarative external-asset inventory
- Deterministic build script, hashes, and structural validation

The generated package contains 22 files totalling 102,826 bytes. All 40 structural checks passed.

Chromium parsed all 17 CSS files into 366 CSSOM rules. The marker behavior tests confirmed:

- Body `data-pattern-version="v1"` activates V1 variables.
- A `.page_main` V1 marker activates V1 variables.
- A `.page_wrap` V1 marker activates V1 variables.
- A V2 marker does not activate V1 variables.
- The V2 Content Wrapper alignment applies when a V2 marker exists.
- The same alignment rules remain inactive without a V2 marker.

## Dependency audit

The shared Header has 90 instances and the shared Footer has 66 instances. Both use unsuffixed V1 utility classes. The Footer also embeds the shared Marketo Form component.

Therefore:

- the Lumos/global foundation is Shared;
- V1 compatibility remains marker-scoped;
- Marketo remains a shared feature;
- the V2 Content Wrapper repair remains V2;
- interaction and content features are isolated from page version where possible.

## Webflow component resources

Three blank, inert definitions were created in the Global component group:

| Component | ID | Instances |
|---|---|---:|
| Custom Code / Shared | `7fb1f388-2033-4797-c2b9-7531a01b1123` | 0 |
| Custom Code / V1 | `9999a57b-0a5b-56ff-7e4f-a18301048ba2` | 0 |
| Custom Code / V2 | `7ad95ae4-857d-1514-8570-d351681e4bce` | 0 |

Each definition contains only its blank root block. They contain no HtmlEmbed, CSS, JavaScript, asset link, prop, or page instance.

## Unchanged production state

- No site custom code changed
- No page custom code changed
- No registered or applied script changed
- The existing active Custom Code component remains unchanged
- No new component instance was placed on a page
- No loader references the Phase 3 package
- Pattern UK last-published timestamp remains `2026-07-28T16:42:59.449Z`

Phase 4 is the first phase that would pilot actual asset selection, and it requires separate approval.
