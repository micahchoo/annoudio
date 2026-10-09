---
scope: worker/src/settled.ts, app/src/modules/media/**
tags: [contract, coupling, queue]
priority: high
source: hand-written
---
`media.settled` is the only bus from the worker container to the app. The message
type, the queue name and the queue policy live in `worker/src/settled.ts`; the app
imports them from `annoudio-worker` (a `file:../worker` dependency). Never copy them
into the app.

After a change in `worker/src/`, run `cd worker && pnpm build`, then
`cd app && pnpm install --force`: pnpm copies `worker/dist` at install time, so the app
keeps the old build until then. `deploy/app.Dockerfile` builds the worker stage for the
same reason.

The consumer (`applySettled`) must accept the same report two times and a report for a
deleted row: pg-boss gives a report again when the handler throws.
