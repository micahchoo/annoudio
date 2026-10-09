---
scope: plugins/**
tags: [contract]
priority: high
source: hand-written
---
Only the `Stack` class in each plugin knows the stack's routes (`/embed/v1/themes/{project}.json`,
`/embed/v1/recordings/{project}/{id}.json`, `/embed/v1.js`). Add a route there, never in a block or a
form. The routes are part of CONTRACT.md; a change there is a change here.
