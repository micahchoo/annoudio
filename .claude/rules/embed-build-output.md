---
scope: app/public/embed/**
tags: [build-output, contract, cache]
priority: high
source: hand-written
---
`app/public/embed/` is build output of `embed/`. Never edit it by hand: change
`embed/src/`, then run `cd embed && pnpm build`. The build writes `v1.js` (the loader,
which names the current hash) and `v1/<hash>/player.js`.

Keep the two hash folders before the current one. A browser can use a cached `v1.js`
for up to 3900 s, and that loader names an older hash (CONTRACT.md §5.1). The build
deletes only older folders. Never delete a hash folder by hand, and commit the new
folder together with the new `v1.js`.

The cache and CORS headers of these files come from `app/next.config.ts` `headers()`.
The bundle rule matches only 12-hex folders, so `/embed/v1/themes/*.json` (a route in
the `projects` module) keeps its own 300 s rule. Do not widen that pattern.
