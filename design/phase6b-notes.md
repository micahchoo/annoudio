# Phase 6b notes: re-package and re-verify after Phase 5c

Date: 2026-10-09. Scope: `deploy/` and this file. `app/`, `embed/`, `worker/` were read, not changed. Read `design/phase5c-notes.md` and `design/phase6-notes.md` first.

## Result

| Check | Result |
|---|---|
| Images from the current tree | `annoudio-app:demo` = `:prodtest` **967 MB** (`fd79371dd6c4`, 966 842 192 B). `annoudio-worker:demo` = `:prodtest` **310 MB** (`181937371a4c`, 309 849 668 B). Phase 6 re-run: 972 MB and 310 MB. |
| Fresh prodtest stack (`annoudio-prodtest`, :3300) | Pass: three migrations at start, healthy in 11 s, the whole member-to-publish walk with a photo, M1, M3 and M7 through real SMTP (Mailpit), one Postgres and one media restore round. Removed with `down -v`. |
| Demo stack (`annoudio-demo`, :3500) | Rebuilt on fresh volumes. Seed exit 0: the photo story is published. M6 (the digest) arrived in Mailpit after one `mail.digest` job by hand. |
| `sh deploy/tests/compose-check.sh` | ok (also with `TZ` set in the shell). |

## Changes in `deploy/`

| File | Change |
|---|---|
| `docker-compose.yml` | The switch keeps its name `ANNOUDIO_MEDIA_CONSUMER`: `app/src/instrumentation.ts` reads only that name. One comment line: the switch also starts the `mail.digest` consumer. `TZ: ${TZ:-UTC}` on `app` (the admin dates, `admin/format.ts` `shortDate`) and on `worker` (the 08:00 cron of `mail.digest`). |
| `.env.example` | `# TZ=UTC` with the line "The time zone of the 08:00 operator digest, e.g. Asia/Kolkata. …". `SMTP_URL` and `EMAIL_FROM` lines now say that they carry all mail (login codes, story mails, digest, operator password reset). |
| `tests/compose-check.sh` | Two new checks: `TZ: UTC` on app and worker when no `TZ` is set (the check removes `TZ` from its own environment first, so a shell `TZ` cannot change the result), and `TZ: Asia/Kolkata` on both when it is set. |
| `GUIDE-dokploy.md` | SMTP need names all mails; `TZ` row in the settings table and in the Environment paste; "Forgot password?" after the first operator; the "password reset does not work" gap replaced by a mail-delivery note. |
| `GUIDE-coolify.md` | `TZ` in the Environment Variables step. |
| `UPGRADE.md` | Check 5 includes the worker line `the review mail is on the schedule: 08:00 <tz>`. New section "Release notes: the lifecycle release": no manual step, not breaking, operator mail now on `SMTP_URL`, optional `TZ`, switch unchanged, rollback needs the database restore. |
| `BACKUP.md` | `TZ` in the settings row. The restore-test stack has the live `SMTP_URL`, so it can send the 08:00 digest to real operators: delete it before 08:00 or give it a test `SMTP_URL`. |
| `test-hosts/seed-demo-stories.mjs` | Updated for the 5c Annotate page and admin: "Start"/"End" text boxes, "Attach a photo or a video", "Send for review" → status "Sent.", `.member-menu` as the signed-in sign, own stories read on `/annotate/mine`, Publish → dialog "Publish this story?" → "Publish the story", and a wait while the Publish button is off. Without these changes the seed fails on the old "Start (seconds)" spin button. |
| `DEMO.md` | Rights as "Other" + text + licence address; stories table with the last run; "Operator mails" section (digest at 08:00 `TZ`, UTC in the demo; reset mail; a command to send one digest now); recording made through **Add a player** (REST cannot create a recording since 5c); every command now has `-f`. |

## Verification log

Host: Docker 29.7.2, Compose v5.4.0. Env and override for prodtest in the scratchpad (`build: !reset null`, images `:prodtest`, app `127.0.0.1:3300`, Mailpit `127.0.0.1:8325`, `TZ=Asia/Kolkata`). `docker compose ls` before each `down -v`; `down -v` only on `annoudio-prodtest` and `annoudio-demo`.

| # | Step | Result |
|---|---|---|
| 1 | `docker build -t annoudio-worker:demo worker/` | Pass, 2 s (cached layers; `dist/digest.js` present). |
| 2 | `docker build -f deploy/app.Dockerfile -t annoudio-app:demo .` | Pass, 55 s. Image has `src/instrumentation.ts`, `.next/server/instrumentation.js`, the three migrations. Re-tagged both as `:prodtest`. |
| 3 | TZ in Alpine Node (no tzdata) | `TZ=Asia/Kolkata` resolves through Node's ICU: `Asia/Calcutta`, +05:30. No `tzdata` package needed. |
| 4 | Fresh `up -d --wait` (prodtest) | Healthy in 11.1 s. App log: `[migrate] waiting…`, `Migrating/Migrated` for `20261009_092954_initial`, `20261009_101056_phase5_admin`, `20261009_163307_phase5c_lifecycle`, `[migrate] done`, `▲ Next.js 16.3.3`, `Ready`, then `[jobs] The media.settled and mail.digest consumers are started.` with no request (the 5c fix works in the image). Worker: `[media worker] started`, `the review mail is on the schedule: 08:00 Asia/Calcutta`. `pgboss.schedule`: `mail.digest`, `0 8 * * *`, `Asia/Calcutta`. `printenv TZ` = `Asia/Kolkata` in app and worker. |
| 5 | First operator, Chromium (Playwright 1.64 from `plugins/tests`, `--mute-audio`), `/admin/create-first-user` | Pass. Today shows "Put your first player on a site". |
| 6 | **Add a player**: title, audio `http://127.0.0.1:4610/media/tone.m4a` (fixture server was up, so no local tone server was needed), project "Prodtest Voices", site `http://127.0.0.1:4620`, **Copy the snippet**, **Done**, **I pasted it** | Pass. Snippet: `<script async src="http://127.0.0.1:3300/embed/v1.js"></script> <annoudio-player project="prodtest-voices" recording="1" src="http://127.0.0.1:4610/media/tone.m4a"></annoudio-player>`. |
| 7 | Member `mira@example.org` on the Annotate page: code from Mailpit (M1 "Your login code for Prodtest Voices"), name, photo (`app/tests/e2e/fixtures/photo.jpg`), 0:02–0:04, text, **Send for review** | Pass: status "Sent.". |
| 8 | Worker transcodes; app consumer sets the row ready | Today showed "1 story waits for review." **1.3 s** after the send. App log: exactly one line, `[media] media.settled: 2cd5f258-… is ready.` `pgboss.job`: `media.transcode` completed 1, `media.settled` completed 1. Media row `image`, `ready`. |
| 9 | **Start reviewing** → panel "Photo: Ready" → **Publish** → dialog "Publish this story?" → **Publish the story** | Pass: "Published. Visitors see it within one minute." |
| 10 | `GET /stories/prodtest-voices/1/` | `total: 1`; body = `TextualBody` "The prodtest ferry at dawn." + `Image` `http://127.0.0.1:3300/media/2cd5f258-…` `image/jpeg`. `GET` of the image: 200 `image/jpeg`, 1 624 B. |
| 11 | M3 in Mailpit | "Your story is published": "Your story about “Prodtest crossing”, 0:02–0:04 is published. …". |
| 12 | M7: `POST /api/users/forgot-password` for the operator | Mailpit: "Reset your Annoudio password" from `Annoudio <stories@example.org>`, link `http://127.0.0.1:3300/admin/reset/<token>`. The Phase 6 gap (reset only in the log) is closed. |
| 13 | Postgres round per `BACKUP.md`: `pg_dump -Fc` (22.4 KB), `delete from projects`, stop app+worker, drop the two schemas, `pg_restore -O --exit-on-error`, start | Exit 0. Project row back (1), story 1, operator 1, `mail.digest` schedule back. App healthy, migrate step ran nothing, consumers started again. |
| 14 | Media round per `BACKUP.md`: tar (8.7 KB), overwrite `derived/<id>.jpg` with `tee`, stop, untar, start | Served image sha256 `b24497d3…` before, `cdd6c109…` after the damage, `b24497d3…` after the restore. Owner uid 1000. |
| 15 | `docker compose ls`, then `down -v` of `annoudio-prodtest` | Done; no `prodtest` volume left. |
| 16 | Demo: `down -v`, then `up -d --wait` | Healthy in 11.6 s; three migrations at start; consumers started. `down` kept the network `annoudio-demo_default` ("Resource is still in use") because `annoudio-hosts-wordpress-1` and `annoudio-hosts-omeka-1` are attached to it; they stay attached after `up`. |
| 17 | Demo base data (scratchpad script): operator through the first-user screen; project + recording 1 through **Add a player**; rights, theme tokens, concepts Ferry/Horn/River through REST | Pass. Theme route gives `color-accent #0b6e4f`, `radius 12px`, the rights line and IRI. Concept IRIs `…/vocab/river-voices/c/ferry|horn|river`. |
| 18 | `node deploy/test-hosts/seed-demo-stories.mjs` | **Exit 0** in 6.5 s, first run: two published (text + photo), Ravi's waits. App log: one `media.settled: 35c7af06-… is ready.` line. Second run: exit 0, every story skipped. "demo rebuilt" sent to main. |
| 19 | M6 in the demo: one `mail.digest` job sent by hand with pg-boss in the worker container | Mailpit: "1 story waits for review", "River Voices: 1 story", link to `/admin/collections/stories`. The operator's `review_mail` is `daily` (the default). |

## Gaps and unverified

- **The real 08:00 trigger** was not waited for. Verified: the schedule row (cron and time zone), and the app side of a `mail.digest` job through SMTP. Not verified: that pg-boss fires the cron at 08:00 `Asia/Calcutta`.
- **The worker logs nothing per job.** "One line per report" is the app's line (`[media] media.settled: <id> is ready.`). An operator who reads only the worker log sees no transcode. Proposal to `worker/`: one line per finished job.
- **Photo only.** The walk used a photo. Voice note and video were not run through the image in this phase (5c e2e covers them with a fake transcoder; Phase 6 did not either).
- **The player on a host page with the published photo** was not opened in this phase. Checked: the WADM container and the served image file.
- **Deleting a project leaves its stories served.** In step 13, after `delete from projects`, `/stories/prodtest-voices/1/` still answered 200 with the story (the story rows keep the project as text). The restore round proved the project row came back, not a visible change. Not a deploy issue; noted for `app/` (is a container without a project meant to answer 200?).
- **`TZ` takes an IANA name only.** A wrong name (for example `IST`) is not checked by compose; Node falls back silently. Not tested.
- **Dokploy and Coolify** steps stay unverified on a real server (as in Phase 6). The new `TZ` line in the Dokploy Environment paste is an example value; the guide says to leave it out for UTC.
- **Image size**: 967 MB; `output: 'standalone'` (Phase 6 proposal 2) is still open.
