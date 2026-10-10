---
scope: embed/**
tags: [coupling, hazard, wavesurfer]
priority: high
source: hand-written
---
The player depends on six wavesurfer.js 8.0.2 behaviours. Check each one when you upgrade it:

1. Create wavesurfer only with `peaks` + `duration`. Without peaks it fetches `src` itself,
   outside CONTRACT 6 (no Content-Length check, no `credentials: "omit"`).
2. `regions.addRegion()` clamps start and end to the duration it knows. Add regions only
   when `getDuration() > 0` (the player waits for "ready"); else every region becomes 0..0.
3. `src/styles.ts` `WAVE_CSS` is a copy of `renderer.js` `initHtml()` `<style>`. A strict
   CSP blocks that element; the copy keeps the layout. Diff it against the new renderer.
4. Regions are in wavesurfer's shadow root. `exportparts="region, active, range"` on its host and
   `.wave > div::part(...)` selectors depend on that structure.
5. `region.setOptions({ start | end })` and `setOptions({ id })` call `setPart()`, which writes
   `part="region {id}"` over ours. After each such call, `#markRange` writes `part="range"` again
   (the `range` attribute, CONTRACT 2.1).
6. `enableDragSelection` ignores a drag whose pointermove was `preventDefault`ed: a drag that starts
   on a region element (even with `drag: false`) never selects. While `range` is set, the story
   regions and the range itself get `pointer-events: none` (the range's two edge handles keep it),
   so a drag over a story or inside the range still chooses a range.

The tests in `embed/tests/` catch 1, 2 and 3 (request list, region count, CSP overflow), and 5
and 6 (contract 16.12: the attribute moves the range; a drag chooses a range).
