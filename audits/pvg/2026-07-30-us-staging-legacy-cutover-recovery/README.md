# Pattern US pre-cutover recovery milestone

This directory captures the saved Webflow state immediately before the Pattern
US PVG 0.2.4 legacy cutover.

The site header, site footer, Portal Studio page head/footer, and both shared
`Slider / Images` embeds preserve the content returned by Webflow MCP, with a
final newline added where needed for repository consistency. The manifest
records SHA-256 hashes, resolved IDs, publish timestamps, custom domains, seven
verified V2 roots, and the excluded blank International Expansion Videos page.

Rollback must restore the site code and the Portal component/page initializer
as one unit. A rollback publish is limited to `pattern-us.webflow.io`; the
custom production domains are not part of this milestone or this rollout.
