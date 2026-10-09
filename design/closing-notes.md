# Closing pass notes

Date: 2026-10-09. Scope: `app/`, `worker/`, `embed/` and the root docs. `plugins/` and `deploy/` did not change. Read `CONTEXT.md` first; this file uses its words.

## 1 Fixes

### 1.1 The delete of a project or a recording

The bug (design/phase6b-notes.md): after `delete from projects`, `/stories/{project}/{id}/` still served the story. The representations are rows of their own, and nothing removed them.

Now, through the admin and the local API:

- A project or a recording with stories or replies, in any review state, is not deleted. The admin shows one line, for example "This project has 1 story and 1 reply. Remove its 1 story first." (`removeFirstLine` in `app/src/plural.ts`). A removed story takes its replies with it, so the line names the stories. The API error has the code `project-has-stories` or `recording-has-stories`.
- A project or a recording with none is deleted, and its served representations go in the same transaction. Every read of its instances then gives 404.
- A project also takes its concepts with it. **Second bug, found by the first test:** before this pass, no project with concepts could be deleted at all. `concepts.project` is required, and the delete failed with a Postgres not-null error (`UPDATE concepts SET project_id = NULL`). The vocabulary is part of the project (CONTEXT: "Project: one configuration set: vocabulary, …"), so it goes with the project. With no stories, no concept is in use.

Interface changes:

| Module | Change |
|---|---|
| `stories` | New method `forgetInstances({ project } \| { recording }, { req })` → `Tally`. It counts the stories and replies of the project or recording. With none, it deletes the representations of its instances. Raw SQL in `rebuild.ts`; `.claude/rules/stories-raw-sql.md` names it. |
| `projects` | `projectsCollection` is now `projectsCollection(deps)`, as `conceptsCollection` and `recordingsCollection` are. `deps.stories` gives `forgetInstances`; `deps.removeVocabulary` removes the concepts. |
| `catalogue` | `CatalogueDeps.stories` also gives `forgetInstances`. |
| `vocabulary` | New `removeVocabulary(context, projectId)`: it clears every `parent`, then deletes the concepts, so each delete passes the concept guard. |

Why an empty instance needed the clean-up too: a rebuild with no published story still stores the empty container (`representations(info, [], …)`). After the operator removed the last story and deleted the recording, the container answered 200. The test "goes through after the operator removes the stories; then every read gives 404" failed for that reason before the change.

Tests: `app/tests/int/projects/delete.int.spec.ts` (9 tests: both refusals, a draft-only story counts, 404 after a clean delete, the Phase 6b case with rows truncated outside the app, concepts with a hierarchy go, the other project and the other recording stay served). `app/tests/e2e/delete.e2e.spec.ts` (3 tests: the admin shows the line for a project and for a recording; a recording with no stories is deleted in the admin and its container gives 404). With the two hooks off, 8 of the 9 int tests fail.

Not changed: the rename of a project slug after the first story. The field description warns against it; nothing stops it.

### 1.2 The worker log

`startWorker` takes a new option `log` (default `console.log`). Each attempt of a `media.transcode` job gives one line when it starts and one when it ends:

```
[media worker] m9: transcode started (sound).
[media worker] m9: transcode failed in 0.0 s (transcode-failed: disk full (call 1)). It can run again.
[media worker] m9: transcode started (sound).
[media worker] m9: transcode done in 0.4 s (audio/mp4).
```

A permanent error ends with "It does not run again." Test: `worker/tests/jobs.test.ts`, "logs one line when a job starts and one when it is done or failed". After the change: `cd worker && pnpm build`, then `cd app && pnpm install --force --offline` (the app keeps a copy of `worker/dist`; `.claude/rules/media-settled-contract.md`).

## 2 The green run

Machine: this workstation, dev Postgres `annoudio-dev-postgres-1` on :5432. Each part ran in one sequence, after the last code change of that part. The demo and test-host stacks kept running.

| Part | Command (from the part's folder) | Result |
|---|---|---|
| app | `pnpm tsc --noEmit` | exit 0 |
| app | `pnpm lint` | exit 0; 0 errors, 3 warnings (unused names in the scaffold files `src/app/my-route/route.ts` and `tests/e2e/admin.e2e.spec.ts`; not new) |
| app | `pnpm test:int` | 19 files, **279 passed** (270 before; +9) |
| app | `pnpm test:e2e` | **58 passed** (2.1 min, Chromium, muted; 55 before; +3) |
| app | `pnpm build` | exit 0 |
| embed | `pnpm typecheck` | exit 0 |
| embed | `pnpm lint` | exit 0 |
| embed | `pnpm test` | **293 passed, 4 skipped** (Chromium, Firefox, WebKit; muted) |
| embed | `pnpm build` | exit 0. `v1.js` 756 B gzip, `v1/31d277eeda2f/player.js` 32 296 B gzip. The hash set did not change (`2abd9368ad56`, `6b4bd18c8a1a`, `31d277eeda2f`), and `sha256sum` of every file is the same as before the run. |
| worker | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` | exit 0; 5 files, **85 passed** (84 before; +1) |
| deploy | `sh deploy/tests/compose-check.sh` (repo root; it runs only `docker compose config`) | `compose-check: ok` |

Plugins were not run in this pass (another agent works in `plugins/`). Their last count is 13 (design/phase7b-notes.md).

## 3 Documentation mismatches found and fixed

| File | Mismatch | Fix |
|---|---|---|
| ROADMAP.md | No phase had a status; the header said "draft". | A status line under each phase: "Built 2026-10-09 (see …)", or "Owner: not started" for the team trial, the pilot and the Phase 6 done-when test on a VPS. |
| ROADMAP.md | Phase 3: "Payload auth collection `members`". A member is never a Payload user (Phase 3 decision). | Says a `members` collection with a cookie session table. |
| ROADMAP.md | Phase 4: "pg-boss worker running ffmpeg" did not say the worker is its own container that reports with `media.settled`. "Uppy + tus" is correct (`annotate/MediaField.tsx` uses `@uppy/core` and `@uppy/tus`); kept, with the in-app `@tus/server`. | Text names the worker container, `media.settled` and `ffprobe` in the worker. |
| ROADMAP.md | Phase 5: "duration probe" did not say it runs in the browser, and "recording catalogue" did not say there is no upload. | Both added (decision 1 of design/phase5-notes.md). |
| ROADMAP.md | Phase 7: "register a recording via the API and write the snippet from the CMS media ID". 7a decided that the plugins do not register recordings; 7b reads the recording JSON route. | Text says the plugins write the snippet from a recording ID and read `/embed/v1/recordings/{project}/{id}.json`. |
| ROADMAP.md | Phase 6 done-when: nobody ran an upgrade (there is one release). | The status line says so. |
| CONTEXT.md | Module map, `stories`: "`saveDraft`, `publish` for writing". The interface has 19 methods. | Row lists them by caller. |
| CONTEXT.md | `projects`: missing `projectsCollection(deps)`, `byId`, `allProjects`, `create`, `THEME_TOKENS`; "in-process" only. | Added; dependencies name `deps`. |
| CONTEXT.md | `vocabulary`: missing `conceptsCollection(deps)`, `concept`, `conceptsOf`, `IMPORT_LIMITS`, `removeVocabulary`. | Added. |
| CONTEXT.md | `catalogue`: missing `register`, `list`, `firstRecording`, `snippet`, `checkAudioUrl`, `handleRecording` (the public route of CONTRACT §5.2). | Added. |
| CONTEXT.md | `membership`: missing `sessionFromRequest`, `signOut`, `contact`, the `nickname` argument of `verifyCode`, the collections. | Added. |
| CONTEXT.md | `mail`: missing `mailerEmailAdapter`, `addressOf`; the digest is `Notices.digest`. | Added. |
| CONTEXT.md | `media`: "`upload` (tus)" is not an export (`createMedia` → `handleUpload`, `handleFile`, `body`, `startSettledConsumer`). The row said it hides transcoding and depends on ffmpeg; transcoding is in `worker/`. | Row fixed; new `worker` row with its ports `Prober` and `Transcoder`. |
| CONTEXT.md | No rule for `deps`. | Seam rule: a module gets another module's instance through `deps`; imports stay one way. |
| README.md | Did not say what is built, had no plugins, no doc index. | Rewritten: what it is, what is built, how to run, where the docs are. |
| app/README.md | Module table: same gaps as CONTEXT for `projects`, `vocabulary`, `stories`. | Rows updated. |
| HANDOFF.md | Suite counts of 5c; "in flight: 6b and 7b". | Counts of this pass; in flight: the plugins agent only. |
| STATUS.md | First 5 lines described Phase 1 to 5c in one line and "Next: Phase 4b". | First 5 lines: final state, next (owner), suites, blocked, git. |

## 4 Flags (not changed, outside this pass)

- `app/src/app/my-route/route.ts` is the Payload scaffold example route. It answers `GET /my-route` in production. Proposal: delete it (and its two lint warnings).
- Worker test output is noisier now: the tests that do not pass `log` print the lines to stdout. They stay green.

## 5 Unverified

design/UNVERIFIED.md: 54 open items in 8 surfaces (player 10, Annotate page 7, admin 7, media pipeline 5, mail 4, read API 4, deploy 6, CMS plugins 11), 4 known-and-not-fixed items, 9 items closed by later phases. Of the 54: 30 need only this machine ("here"), the rest need a device, a server, a person or a wait.
