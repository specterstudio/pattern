# Pattern Runtime video popup and preview repair

Status: local Runtime work and saved Webflow changes are complete. This agent
did not publish the V3 Library or Pattern US.

## Targets

- V3 Library: `pattern-l3`, site `6a655c67e1cc8b4be41b96d5`
- Library reference page: `/cc/video`, page `6a655c67e1cc8b4be41b9930`
- Canonical component: `• Video Player`, component `e00c82e2-2093-dee1-0d40-7c885d2205d5`
- Center variant: `With Button Only (Center)`, variant `76d91310-d4e8-49f0-381a-9825b60635a6`
- Pattern US Home V3: page `6a656092be4c857f62571add`
- Home Video Player instance: `ccb777f7-ddf1-6c12-9ab9-7f34fa70506e`
- Home section: `#what-we-do`

## Local source state

### Popup

`webflow/pattern.com/scripts/media/video-popup.js` is now version `1.1.3`.
Its root selector explicitly supports:

- `.video_player_wrap`
- prefixed classes ending in `--video_player_wrap`

The popup continues to:

- wait for the authored Consent Pro category;
- assign the iframe `src` only after opening;
- remove iframe `src` after closing;
- support the close button, overlay close control, Escape/cancel, keyboard open;
- lock and restore page scrolling;
- focus the close control on open and restore trigger focus on close.

### Preview hydration

`webflow/pattern.com/scripts/media/video-preview.js` is a separate Runtime
module. It accepts only `video[data-src]` inside a prefixed or unprefixed Video
Player root. It removes migration-time `src`/`autoplay`, enforces
`preload="none"`, waits for the authored `fs-consent-categories` value, and
hydrates when the video enters the viewport.

Popup iframe loading and preview-video hydration do not call each other.

### Runtime modules

- `v3-video-popup` requires one complete root containing
  `[data-video-player-open]`, `dialog[data-video-player-dialog]`,
  `iframe[data-video-src]`, and `[data-video-player-close]`.
- `v3-video-preview` matches a Video Player root containing `video[data-src]`.
- Both modules support Runtime DOM rescans and prefixed/unprefixed roots.

Final local hashes:

| File | SHA-256 | SRI |
| --- | --- | --- |
| `video-popup.js` | `504dc7f4c66699da5070434c83001b56e6197325434e47e23f8e08c681e9203f` | `sha384-V4sdBPl9LCUpScdMBwHAdo/2SU0XWve1/EKhf4MmMSnUVbwDtCAiGgKcHi+1VuS0` |
| `video-preview.js` | `1286245b90d0387fc75379c545a7852a4ac125e219cc36958676c08f45d7453c` | `sha384-chLfIt1Cm0PzKy6+62JMrZXl+UUFPV8YY5HkqEsGDWI2unAuosUbx7uP+SktbCwR` |
| `pattern-runtime.js` | `2720cef270f49fe018d59fb33d584f2f61a4b40078b19be11e7c6f31e29a97fa` | `sha384-RT5TpBX+gupOfjAudkmO9d/C9C9Y/H2eSX8PrvTilnPJzBRkRMJKiR+awS1WG/39` |
| `pattern-version-gateway.js` | `aa4c35e008e2deec74331debbb5df83648cfedd243feabde2f04ecb9ab1f5622` | `sha384-DUFhYfQAjdCVsuegt3FCVs7XlaUhtR5FO+dYXG6dkDq8uj1tp8IusKR9pvcVDDAI` |

## Saved Webflow state

### V3 Library

The existing shared popup subtree was retained; it was not rebuilt or copied
as unrelated markup. Its saved dialog element is
`eb84a3bc-09ea-a7c6-936a-ef598d176fd6`.

Saved readback confirms:

- dialog tag: `dialog`;
- `data-video-player-dialog=""`;
- `data-duration="300"`;
- `aria-label="Video"`;
- saved visibility: `true`, which makes the same subtree available to the
  centered variant;
- overlay and close button both retain `[data-video-player-close]`;
- iframe element `f082c949-918f-1a41-49d2-70aebbe5e61c` binds the Video URL
  prop to `data-video-src` and has no authored `src` setting.

The Video Player safe preview defaults now read:

- `URL Source`: `false`;
- `Autoplay`: empty;
- `Attribute Name`: `preload`;
- `Attribute Value`: `none`;
- `Consent Pro`: still `true` by default.

The dialog remains closed and inert in the Video Only variant because that
variant has no `[data-video-player-open]`; Runtime therefore does not initialize
a popup controller for it.

### Pattern US Home V3

Saved instance readback confirms:

- variant: `With Button Only (Center)`;
- Consent Pro: `true`;
- thumbnail video: `https://assets.pattern.com/WQ71necbZXNVhu9OrFcJN`;
- popup video: `https://vimeo.com/1146670446`;
- `URL Source`: `false`;
- `Autoplay`: empty;
- custom attribute: `preload="none"`.

The shared popup structure must still be received through the V3 Library
component update workflow; the Home instance was not detached or patched with a
page-only dialog.

## Verification

`node tools/test-pattern-runtime-1.mjs` passed all 19 Runtime tests, including:

- prefixed and unprefixed popup roots;
- Consent Pro approval before opening;
- iframe load on open and unload on close;
- focus and scroll restoration;
- preview zero-request initial state;
- viewport hydration after consent;
- late-DOM Runtime rescanning;
- existing Finsweet, V1, V2, V2L, V3, case-study, Marketo, and bootstrap tests.

`PVG_ALLOW_UNRELEASED_RUNTIME=1 node tools/test-pattern-version-gateway.mjs`
passed the complete compatibility suite.

The controlled saved-state browser check exercised three popup-enabled
variants on `/cc/video` and the Home V3 centered variant. It recorded:

- zero preview requests during initial 390×844 Home load;
- one preview request after the video entered the viewport;
- popup and preview modules matched and ready;
- iframe `src` assigned only on open and removed on close;
- no duplicate Runtime video scripts;
- no console/page errors.

Evidence:
`audits/pattern-runtime/2026-07-31-video-popup-saved-state-injection.json`.

## Published state

No publish operation was issued by this agent.

- V3 Library last published: `2026-07-31T14:05:36.827Z`. Its current published
  `/cc/video` still has no dialog in the centered variant and still authors
  preview `src` plus `autoplay`.
- Pattern US was published externally during this work at
  `2026-07-31T15:06:25.862Z`, before the saved preview-property readback. The
  current published Home now contains a dialog, but the preview still has
  authored `src`/`autoplay` and requests the Pattern video on initial mobile
  load. The saved `data-src` repair is not live.

## Required next actions

1. Release the merged Pattern Runtime candidate using the immutable Runtime
   release workflow and its final SRI.
2. Push the V3 Library component update to Production so consumers receive the
   corrected Video Player definition.
3. Accept/update the V3 Library component in Pattern US.
4. Publish Pattern US Home V3 after confirming its saved Video Player renders
   `data-src`, no `src`, no `autoplay`, `preload="none"`, and the complete popup
   subtree.
5. Re-run the published mobile network and open/close verification.

Do not remove or alter Consent Pro or any `[fs-consent-*]` attribute during
those actions.
