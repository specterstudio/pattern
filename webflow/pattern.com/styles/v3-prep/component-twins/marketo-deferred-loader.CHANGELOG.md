# Marketo deferred loader — consent changes

This file is a **source copy** of the inline HTML Embed in the Pattern Library v3 Webflow component `• Global / Marketo Form`. Changing the Git copy does not change the live site. The matching Webflow embed update is not published yet and needs owner sign-off.

## Problem

The live loader wrote a 90-day `pattern_marketo_attribution` cookie and ran a Marketo known-lead prefill with no consent check. It also overwrote hidden fields that already had values.

That is a UK PECR / EU ePrivacy problem: marketing storage and known-lead lookup ran before the visitor had a chance to refuse.

## What changed

The loader now reads Finsweet Consent Pro **marketing** consent (`fs-consent` cookie, `choices.marketing`):

- **Reject always blocks.** No attribution cookie is written, any stored cookie is deleted, prefill does not run, and Facebook click IDs (`_fbp` / `_fbc`) are not copied into the form.
- **Opt-out banner, no choice yet** counts as consent. That matches the live US page attribution script: until the visitor decides, the opt-out default is allowed.
- **Opt-in banner, no choice yet** does not count as consent (UK behaviour).
- **Consent Pro missing or silent for 10 seconds** is treated as no consent, and the stored cookie is then deleted.
- A stored cookie is **not** deleted until consent is known, so a returning opt-out visitor keeps it while Consent Pro loads.
- Prefill (the SimpleDTO known-lead iframe) only starts when marketing consent is granted. If the visitor accepts later, prefill can start then.
- Attribution still fills landing page, referrer, user agent, and URL UTMs in memory without consent, but it **only writes the cookie when consent is granted**.
- Attribution **only fills empty fields**. Existing values, including non-empty hidden fields, are left alone.

## Tests

`tools/test-marketo-visible-prefill.mjs` lived next to the original loader (commit `9288380`) and was removed with the rest of `v3-prep`. It still describes the right visible-field prefill rule (do not apply known-lead values to hidden fields), but it would not pass against this revision without updates: it expects prefill to start immediately and waits for FormsPlus even when marketing consent is absent. It was not restored or rewritten here.

Headless Chrome checks of this consent build (US opt-out vs UK opt-in; no form submits) confirmed: no-choice writes the cookie and prefills on opt-out only; Reject deletes the cookie and blocks prefill; Accept writes the cookie and prefills; a returning opt-out visitor keeps a stored cookie.
