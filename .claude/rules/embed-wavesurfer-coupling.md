---
scope: embed/**
tags: [coupling, hazard, wavesurfer]
priority: high
source: hand-written
---
The player depends on four wavesurfer.js 8.0.2 behaviours. Check each one when you upgrade it:

1. Create wavesurfer only with `peaks` + `duration`. Without peaks it fetches `src` itself,
   outside CONTRACT 6 (no Content-Length check, no `credentials: "omit"`).
2. `regions.addRegion()` clamps start and end to the duration it knows. Add regions only
   when `getDuration() > 0` (the player waits for "ready"); else every region becomes 0..0.
3. `src/styles.ts` `WAVE_CSS` is a copy of `renderer.js` `initHtml()` `<style>`. A strict
   CSP blocks that element; the copy keeps the layout. Diff it against the new renderer.
4. Regions are in wavesurfer's shadow root. `exportparts="region, active"` on its host and
   `.wave > div::part(...)` selectors depend on that structure.

The tests in `embed/tests/` catch 1, 2 and 3 (request list, region count, CSP overflow).
