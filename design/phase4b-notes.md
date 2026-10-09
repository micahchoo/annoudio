# Phase 4b notes: media bodies in the app

Date: 2026-10-09. Scope: the `media` module in `app/`, the media rules of `stories`, the media UI of the Annotate page, media bodies in the player, the worker's report, and the first Payload migration. Read `CONTEXT.md` and `media-interface.md` first. This file uses their words. `deploy/` did not change here.

## Result

| Check | Result |
|---|---|
| `app`: `pnpm test:int` | 127 pass (9 files). Phase 3b: 113. New: `tests/int/media/media.int.spec.ts` (8), `tests/int/stories/media.int.spec.ts` (6). |
| `app`: `pnpm test:e2e` | 17 pass (Chromium). Phase 3b: 14. New: `tests/e2e/media.e2e.spec.ts` (3). |
| `embed`: `pnpm test` | 254 pass, 4 skipped (Chromium, Firefox, WebKit). New: 5 media body tests per browser. |
| `worker`: `pnpm test` | 80 pass. New: `tests/settled.test.ts` (3). |
| `tsc`, `lint` | Pass in the three packages. `app` lint keeps the 5 warnings of the Payload template files. |
| `app`: `pnpm build` | Passes. |
| `embed`: `pnpm build` | Bundle `2abd9368ad56`, 30 994 B gzip (limit 81 920). Loader 758 B gzip. `482bfd5f80e9` and `0a45a8367040` stay. |
| Migration on an empty database | `20261009_092954_initial` makes all 20 tables on `annoudio_fresh_test`. `next start` on that database: `/api/users/init` gives `{"initialized":false}`, `/admin/create-first-user` 200. |

## What changed

| Part | Where | What |
|---|---|---|
| `media` module | `app/src/modules/media/` | `index.ts` (interface), `collection.ts`, `create.ts` (`createMedia`), `upload.ts` (tus), `file.ts` (`/media/<id>`), `settled.ts` (consumer), `lookup.ts` (`body`, `mediaIdOf`), `formats.ts`, `paths.ts`. |
| Routes | `app/src/app/(frontend)/media/upload/[[...id]]/route.ts`, `media/[id]/route.ts` | Thin: they call `media.handleUpload` and `media.handleFile`. |
| `stories` | `validate.ts`, `create.ts`, `collection.ts`, `shape.ts`, `types.ts` | `media-needs-text`, `media-failed`, `media-not-ready`; the publish hook; `ownDrafts` gives `MediaId`; the admin column **Media**. |
| Annotate page | `MediaField.tsx` (new), `StoryForm.tsx`, `page.tsx`, `actions.ts` (`mediaState`), `state.ts`, `strings.ts`, `annotate.css` | Recorder, file button, upload state, poll, hidden `media` fields. |
| Player | `embed/src/stories.ts`, `element.ts`, `text.ts`, `styles.ts` | Part `story-media`: `<audio controls preload="none">`, `<img loading="lazy">`, `<video controls preload="metadata">`. |
| Worker | `worker/src/settled.ts` (new), `index.ts` (one export line), `main.ts` | `media.settled`: `settledReporter`, `workSettled`, `SETTLED`, type `Settled`. |
| Contract | `CONTRACT.md` §3.3, §6 | Part `story-media`, request 7 timing, rule 11. All marked "2026-10-09, additive". |
| Migrations | `app/src/migrations/`, `payload.config.ts`, `package.json` | `20261009_092954_initial.ts` + `.json`, `index.ts`; `migrationDir`; `push` off in production; scripts `migrate`, `migrate:create`, `migrate:status`. |
| Rules | `.claude/rules/app-migrations.md`, `.claude/rules/media-settled-contract.md` | A schema change needs a migration; the settled contract lives in the worker. |

## Decisions

1. **`@tus/server` 2.4.5 in the app process.** `Server.handleWeb(request)` takes a web `Request` and gives a `Response`; its hooks get the same `Request` object. `BaseHandler.writeToStore` reads `request.body` with `Readable.fromWeb`, so the body is a stream, not a buffer. Checked under Next 16.3.3: the e2e test sends a 6 MB PATCH through `next dev` and gets `204` with `Upload-Offset: 6291456`. Uppy sends 8 MB chunks. tusd (a second container) is not needed.
2. **The session check is before tus.** `handleUpload` reads the member session, gives `401` without one, and keeps the session in a `WeakMap` keyed by the request. `onUploadCreate` sets the metadata `member` from the session (a client value is replaced). `onIncomingRequest` gives `404` for HEAD, PATCH and DELETE of an upload of another member.
3. **The limits are checked before a byte is stored**: `onUploadCreate` refuses no kind (400), a type that the kind does not accept (415), a deferred length (411), and a size over `LIMITS[kind].bytes` (413). `maxSize` is the largest limit, as a backstop for the PATCH body. The type table is in `formats.ts`; the worker probes the content again.
4. **The body URL is `{origin}/media/<id>`, with no extension.** `media-interface.md` said `/media/<id>.<ext>`. The format of an image is known only after the probe (a "JPEG" can be a PNG), and the URL goes into the draft before the transcode. So the URL has no extension, and the route sends `Content-Type` from the row.
5. **The served format comes from the derived file.** The draft stores the expected format (`derivedFormat` of the declared type). The publish hook writes the format of the ready body into the record. A test publishes a "JPEG" that the probe found to be a PNG; the story says `image/png`.
6. **The publish check is a `beforeChange` hook**, so the admin **Publish** button and `stories.publish()` run the same check (stories amendment 3). It throws Payload's `APIError` with `data.code = 'media-not-ready'` and a public message in plain language; `publish()` turns it into `StoriesError` `media-not-ready`. Two messages: "still processing" and "cannot play: the processing failed or the file was deleted".
7. **`saveDraft` gives `media-failed`** (new code) for a `failed` body, and `unknown-media` for an unknown id, another member's id, or another kind.
8. **The `media.settled` contract is in the worker** (`worker/src/settled.ts`), and the app imports it. Queue policy: 10 retries from 5 s, with backoff. The consumer changes only a row in the state `uploaded`, so a second report and a report for a deleted row do nothing. The app's pg-boss has `supervise: false` and `schedule: false`; the worker container does the queue maintenance.
9. **The consumer runs only with `ANNOUDIO_MEDIA_CONSUMER=1`**, from Payload `onInit`, once per process (a `globalThis` guard). `next build`, the integration tests and the e2e test process do not set it. The same process deletes unfinished uploads older than one day, once per hour (`FileStore.deleteExpired`).
10. **An operator delete removes the row, the derived file and the raw file.** It is the only path that deletes a raw file. Moderation needs it: a delete must take the content down. `handleFile` reads the row on each request, so the URL gives 404 at once. A cache can keep a copy for up to one year (`immutable`).
11. **The admin column `Media` is a virtual field.** It is computed only when an operator reads (`req.user` is an operator), so the module's own reads (rebuild, `ownDrafts`, export) make no extra lookups.
12. **Uppy without the Dashboard**: `@uppy/core` 6.2.0 and `@uppy/tus` 6.0.0 with one file button and one recorder. The Dashboard brings its own UI, text and CSS for sources that the page does not use, and its text is not in `strings.ts`. `allowedMetaFields: ['kind', 'type', 'name']`: Uppy copies `type` and `name` to `filetype` and `filename` only when they are allowed; with `['kind']`, the server got no type (found in the e2e test).
13. **The recorder** picks the first type that `MediaRecorder.isTypeSupported` accepts: `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4`. Record → stop → listen → attach, record again, or discard. The blob goes through the same Uppy and tus path as a file.
14. **The page polls with a Server Action** (`mediaState`) every 3 s while a body is `uploaded`. The save button waits while an upload runs, because the form needs the id. A story with a processing body saves as a draft.
15. **No-JS path.** The media controls show only after hydration (`useSyncExternalStore`). The hidden `media` fields of an own story render on the server, so a save without JavaScript keeps its media bodies.
16. **Player.** A media body is a `story-media` part after the text. An image has the first text body of its story as `alt`. Playing a sound or video body pauses the recording. Only `http:` and `https:` body URLs become a `src` (a fixture body with `javascript:` proves it).
17. **One pg-boss pool and one `media` instance per process** on `globalThis`, as the mailer: Next can bundle each route with its own copy of `payload.config.ts`.
18. **Migrations.** `push` is off when `NODE_ENV` is `production` (the adapter already did this; the config now says it). No `prodMigrations`: the image runs `payload migrate` under an advisory lock before `next start` (Phase 6, `deploy/app/entrypoint.sh`).

## Deviations from the brief

- **Worker package: one new file and one export line** (`worker/src/settled.ts`, `worker/src/index.ts`), not only the callbacks in `main.ts`. The message type, the queue name and the queue policy must have one home that both sides import; `main.ts` runs on import, so it cannot be that home.
- **The app depends on `annoudio-worker: file:../worker`** (and on `pg-boss` 12.37.0, so pnpm keeps one copy; `PgBoss` has `#private` members, so two copies give two incompatible types). Phase 6 added a worker stage to `deploy/app.Dockerfile` for this.
- **`MediaBody` has `state`** as `media-interface.md` says, besides `ready`. `stories` needs it for `media-failed`.
- **`body` is also a free lookup** `body({ payload, origin, req? }, id, memberId)`, as the other sibling lookups (CONTEXT, fixed decisions). `createMedia(...).body(id, memberId)` uses it. The publish hook needs the `req` form, so it reads inside the publish transaction.
- **A media body URL that is not a body URL of this origin** (only the admin path can store one) is not in the `ownDrafts` input, and `publish` refuses it.
- **Fixture changes.** `app/tests/int/stories/hand-written.wadm.json`: the Sound URL is now a body URL (`…/media/0192f3a4-aa01-7000-8000-000000000001`); `read.int.spec.ts` (its only user) seeds a ready media row, and the "same shape as `saveDraft`" test now makes the Sound body through `saveDraft`. `embed/tests/fixture/data.mjs`: the Sound body of `rec-0042` points at the new `media/voice.m4a`; new recording `rec-media`. New files `embed/tests/fixture/media/{voice.m4a,photo.jpg,clip.mp4}` and `app/tests/e2e/fixtures/photo.jpg`.
- **Contract tests changed by the new part**: 16.1 ignores `blob:` URLs (WebKit draws its media controls with them) and allows `/media/voice.m4a` in WebKit; 16.8 tabs through the voice note controls.
- `next.config.ts`: the template `images.localPatterns` for `/api/media/file/**` is gone; it named an upload collection that never existed here.

## Known gaps

- **WebKit ignores `preload="none"`**: it gets the voice note once when the story list shows. Chromium and Firefox get nothing before play. The test allows at most one request in WebKit; CONTRACT §6 request 7 says so.
- **A raw file without a row**: if the row or the job fails after the move to `raw/`, the member uploads again (new id) and the old raw file stays. The upload deletes the row when the job fails; the delete hook then removes the raw file. Only a crash between the move and the row leaves a file.
- **A draft body is public by URL** once it is ready. Only the member knows the URL until review. The URL is a random UUID.
- **The 15-minute limit of a voice note** is checked by the worker after the upload, not by the recorder.
- The Annotate page in Firefox and WebKit is still not tested (app e2e is Chromium only).

## Not verified

- **Real Safari recording** (`audio/mp4` from MediaRecorder) and real iOS. WebKit in Playwright is not Safari, and the recorder test uses Chromium's fake microphone.
- **Real playback of the derived `.m4a` and `.mp4` in Firefox on Linux** without system AAC/H.264 (research §3 risk). The embed tests play the AAC fixtures in Playwright's Firefox, which has its own codecs.
- The tus path behind Traefik (Dokploy): body size limits and timeouts of the proxy.
- `FileStore.deleteExpired` on a real volume (no test waits one day).
- The admin GUI in a browser: the **Media** column and the Publish error toast. The int tests use the local API with an operator `user`, which runs the same hooks.
