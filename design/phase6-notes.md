# Phase 6 notes: packaging and operations

Date: 2026-10-09. Scope: `deploy/`, the root `README.md`, this file. `app/`, `embed/` and `worker/` were read, not changed. Read `CONTEXT.md` first.

## Files

| File | Is |
|---|---|
| `deploy/docker-compose.yml` | The production stack, `name: annoudio-prod`: `app`, `worker`, `postgres`, `media-init` |
| `deploy/docker-compose.override.example.yml` | Publishes the app on `127.0.0.1:${ANNOUDIO_PORT:-3000}` for a run without a proxy |
| `deploy/.env.example` | Every variable, one STE line each |
| `deploy/app.Dockerfile` + `app.Dockerfile.dockerignore` | The app image (context: repository root) |
| `deploy/app/entrypoint.sh`, `deploy/app/migrate.ts` | Start command of the app: migrations under a lock, then `next start` |
| `deploy/seed/README.md`, `deploy/seed/first-operator.ts` | What a new stack has; first operator by screen (default) or by CLI (staging) |
| `deploy/GUIDE-dokploy.md`, `GUIDE-coolify.md`, `BACKUP.md`, `UPGRADE.md` | Operator guides |
| `deploy/docker-compose.demo.yml`, `deploy/demo.env`, `deploy/DEMO.md` | The local demo stack `annoudio-demo` with Mailpit |

## Decisions

1. **A new app Dockerfile in `deploy/`, not `app/Dockerfile`.** The template needs `output: 'standalone'` (not set in `next.config.ts`), uses Node 22 (the stack uses 24), and its `COPY . .` with no `.dockerignore` sends `app/.env` (the secret) and the host `node_modules` into the image. `deploy/app.Dockerfile` has four stages: embed (builds the player), worker (builds the package `annoudio-worker`, which the app imports through `file:../worker` since Phase 4b), build, runtime. Node 24.21.0 on Alpine 3.24 and pnpm 11.25.0, the same as the worker. Proposal to the owner of `app/`: delete `app/Dockerfile`, so nobody builds the wrong one.
2. **Not standalone yet.** The runtime has the pruned production `node_modules` and runs `next start`. Image 956–964 MB; `node_modules` is 795 MB of it (next 198 MB, monaco 98 MB, swc 91 MB). With `output: 'standalone'` in `next.config.ts` (an `app/` change) the image can lose about 600 MB, but then the Payload CLI for the migrations needs a second look. Deferred, not blocked.
3. **The embed is built in the image.** The committed `app/public/embed` goes in first, so the build keeps the two bundles before the new one (CONTRACT 5.1). So `app/public/embed` must be in git.
4. **Build-time placeholders.** `next build` evaluates `payload.config.ts`, and `createStories` throws on an empty `ANNOUDIO_ORIGIN`. The build gets `https://build.invalid` and a placeholder secret on its one `RUN` line; a `grep` then fails the build if either string is in `.next`. Runtime values come from the environment.
5. **Migrations at start, under a lock** (asked by the coordinator after the gap below). `entrypoint.sh` runs `payload run deploy/migrate.ts`, then `exec next start`. `migrate.ts` holds `pg_advisory_lock` on its own pool connection and calls `payload.db.migrate()`. Payload 3.90 takes no lock itself (`@payloadcms/drizzle/dist/migrate.js`), but runs each migration in a transaction and exits 1 on failure. The server listens only after the migrations, so the healthcheck is red until they finish; `start_period` is 120 s. **`prodMigrations` must stay unset** in `payload.config.ts`: it would migrate again in each process, without the lock.
6. **Healthcheck** = `GET /api/users/init` with Node's `fetch` (no curl in the image). It reads the `users` table, so it is red on an empty schema. That is how the gap below showed.
7. **`media-init`.** A new named volume copies the image's folder at the mount point. Alpine's `/media` holds `cdrom/`, `floppy/`, `usb/`, owned by root. App and worker run as `node` (uid 1000), so both got `Permission denied` on `/media` (seen in the first run). `media-init` (alpine:3.24, root) removes the three empty folders and does `find /media ! -user 1000 -exec chown 1000:1000 {} +`; app and worker wait for `service_completed_successfully`. Proposal to `worker/`: `RUN install -d -o node -g node /media` in its Dockerfile too (the init job is still needed for restored volumes).
8. **Environment in `environment:`, not `env_file:`.** Each service gets only its own variables (the worker never sees `PAYLOAD_SECRET`); Dokploy's `.env` lines (`APP_NAME`, `COMPOSE_PROJECT_NAME`, `DOCKER_CONFIG`) stay out of the containers. Required values use `${X:?message}`, so compose refuses to start without them (tested with an empty env file). `DATABASE_URL` is built from `POSTGRES_PASSWORD` unless set.
9. **Optional limits as names with no value** (`STORIES_PAGE_SIZE:`). Compose then leaves the variable unset (verified in the container: only the set one appeared). An empty value would be worse than nothing: `optionalNumber` reads `""` as `0`. Proposal to `app/`: treat `""` as unset.
10. **`SMTP_URL` is required in production.** Without it, members cannot sign in (the code goes to the log).
11. **No image tags in the compose file.** With `image: annoudio-app:local`, two stacks on one Dokploy server (staging and live) would share the tag. Compose now names the images `<project>-app`. A rollback is a redeploy of an older git branch, not an image tag.
12. **Limits for a 4 GB server**: app 768 MB / 1.5 CPU (heap `--max-old-space-size=512`), worker 768 MB / 1 CPU, Postgres 512 MB / 1 CPU, `shm_size: 128m`. Measured at rest: app 118 MB, worker 30 MB, Postgres 41 MB. Logs: json-file, 5 × 10 MB per service. `stop_grace_period`: worker 40 s (it finishes a job in 30 s), Postgres 30 s.
13. **Postgres `17-alpine`** (17.11 at test time). The Dokploy backup runs `bash -c 'pg_dump …'` in the container; `postgres:17-alpine` has bash (checked). Major version pinned; a major upgrade is a dump and restore.
14. **Dokploy facts read from the source (v0.30.8), not only the docs:**
    - Deploy command: `docker compose -p <appName> --env-file <dir of compose>/.env -f <path> up -d --build --remove-orphans`. So `-p` wins over `name:`, `.env` lands in `deploy/`, and the volume names are `<appName>_media`, `<appName>_pgdata`.
    - The compose **Backups** tab has a compose mode: Database Type, Service Name, Database, Database User. It finds the container by the labels `com.docker.compose.project=<appName>` and `com.docker.compose.service=postgres` and runs `pg_dump -Fc --no-acl --no-owner … | gzip`.
    - Its restore runs `pg_restore -O --clean --if-exists` into the running database.
    - **Volume Backups**: `docker run ubuntu tar` of the named volume, to S3. The restore refuses a volume that any container uses, also a stopped one, so an in-place media restore is not possible from the screens. A restore into a volume that does not exist yet works: hence "Case B" in the guide (new service, restore before the first deploy).
    - "Deploy with Fresh Volumes" runs `down --volumes`. The guide warns.
    - Self-update: the source has a "Web Server Update" dialog with "Check for updates". The research note said "only the install script"; that is out of date.
    - Isolated deployment is marked deprecated in v0.30.8. The guide leaves it off. Only `app` joins `dokploy-network` (Dokploy adds it for the domain); `postgres` stays on the stack's own network, so the name `postgres` cannot resolve to another stack's database.

## The gap: a production stack had an empty database

`@payloadcms/db-postgres` pushes the schema only when `NODE_ENV !== 'production'` (`connect.js` line 110); in production it runs only `prodMigrations`. `app/` has no `src/migrations`. So a fresh production stack starts with no tables: `relation "users" does not exist`, `/api/users/init` 500, the healthcheck red, `up --wait` fails ("container annoudio-prodtest-app-1 is unhealthy"). Reproduced twice.

My first-operator check could not pass on the image as it is. It passed only because I made a migration **inside a throwaway container** (`payload migrate:create bootstrap` + `payload migrate`, written to the container's file system, never to `app/`). That is a test bridge, not a release path: a migration made at build or start would get a new name each time and break every upgrade.

Division of work (coordinator): the owner of `app/` (Phase 4b) commits the migration files to `app/src/migrations` and adds a `migrate` script. This module runs them at start (decision 5). After 4b lands, re-run the end-to-end check in "Still to do".

## Verification log (what ran, 2026-10-09)

Host: Docker 29.7.2, Compose v5.4.0, buildx 0.36.1. Project name `annoudio-prodtest`, port 3300, env file in the scratchpad (no `deploy/.env` was written). `docker compose ls` checked before every `down -v`; `down -v` ran only with `-p annoudio-prodtest`.

| # | Step | Result |
|---|---|---|
| 1 | `docker build -t annoudio-worker:prodtest worker/` | Pass (cached). **310 MB.** |
| 2 | App image, first try with `app/tests` ignored | Fail: `playwright.config.ts` imports `tests/e2e/env`. Fixed the ignore file. |
| 3 | App image, second try | Fail: `createStories` throws on an empty `ANNOUDIO_ORIGIN` during `next build`. Fixed with decision 4. |
| 4 | App image, placeholder `grep` with `--include` | Passed by mistake: BusyBox grep has no `--include`, so it printed usage and `!` inverted the error. Rewritten as `grep …; test $? -eq 1`. |
| 5 | App image | Pass. **927 MB.** |
| 6 | `up -d --build --wait` on a fresh volume | App **unhealthy**: no tables (the gap). Worker and Postgres healthy. |
| 7 | Bootstrap migration in a throwaway container, then health | Healthy. `/admin` 200 with "Create first user"; `/api/users/init` 200 `{"initialized":false}`; `/stories/unknown/unknown/` 404; `/stories/` 404; `/embed/v1.js` 200 with `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=300, stale-while-revalidate=3600`. In the container: `STORIES_PAGE_SIZE=20` set, the other limits absent. |
| 8 | `POST /api/users/first-register` (the call of the first-user form) | 200, operator made; `initialized:true`; a second call: "You are not allowed to perform this action." |
| 9 | Project `river` and one recording through the REST API | Made. |
| 10 | Postgres round 1: `pg_dump -Fc --no-acl --no-owner \| gzip` (17 KB) and a plain dump (85 KB); `delete from projects`; stop app+worker; `pg_restore -O --clean --if-exists` (the Dokploy command) | **Exit 1**: three errors "cannot drop inherited constraint" on `pgboss.queue_stats_20261009/10` and `pgboss.job_common`. Data back (`river`, 1 user, 1 recording); worker restarted clean; 13 `pgboss` tables. |
| 11 | Plain dump into a new database with `psql -v ON_ERROR_STOP=1` | Exit 0; `river` and `payload_migrations` present. |
| 12 | Postgres round 2: drop schemas `pgboss` and `public`, `pg_restore -O --exit-on-error` | **Exit 0**; app healthy; `initialized:true`. This is the procedure in `BACKUP.md`. |
| 13 | Media writes | **Fail**: `Permission denied` for app and worker (root-owned volume). Fixed with `media-init` (decision 7). Rerun: both write. |
| 14 | Media round: tar of `<stack>_media` with alpine, untar into a new volume | Files and uid 1000 kept. |
| 15 | App image after Phase 4b added `annoudio-worker: file:../worker` | Fail: `ENOENT scandir /src/worker`. Added the worker stage. Rebuilt: pass, **964 MB**; `import('annoudio-worker')` works in the runtime. |
| 16 | Fresh run of 15 with the bootstrap bridge; CLI seed | Healthy; `[seed] made the first operator: seed@example.org`; login works; second seed run: "Nothing done". |
| 17 | App image with `deploy/app/entrypoint.sh` | **Fail: the `app/` build is broken mid-change** (Phase 4b: `actions.ts(113,31)` TS2322, `"media-failed"` not in the error union). Recorded, not fixed (outside `deploy/`). |
| 18 | Entrypoint on the last good image (step 15 image + the two deploy files + test-only migration files, all in the scratchpad) | Two concurrent `payload run deploy/migrate.ts` on an empty DB: one migrated, the other waited for the lock and ran nothing; both exit 0. Fresh `up --wait`: healthy in 12 s; log order `[migrate] waiting…`, `Migrating`, `Migrated`, `[migrate] done`, `▲ Next.js`. Restart: no migration, `done`, server up. `/admin` shows "Create first user". |
| 19 | `docker compose -p annoudio-prodtest down -v` | Done. Test images removed. |

Not mine, left running: `annoudio-demo` (uses `deploy/docker-compose.yml` and the image `annoudio-app:prodtest`), `annoudio-dev`, `annoudio-hosts`.

## Unverified

- Every Dokploy and Coolify step on a real server: the guides were written from the docs and, for Dokploy, from the v0.30.8 source of its screens. Button names marked "Unverified" in the guides were not found in the source.
- How Dokploy shows a database restore that exits 1 (the three `pgboss` errors): failed or done.
- Whether a Next build fits on a 4 GB VPS with Dokploy running. Not measured. Mitigations: swap, or images built by CI and pulled (see "Proposals").
- Coolify: database backup for a git compose application; how it parses value-less environment keys; how it shows the exited `media-init`.
- The Annotate page, uploads and `/media/<id>.<ext>` in the production image: Phase 4b is not finished. The restore test in `BACKUP.md` names the media URL for when it is.
- Operator password reset: Payload logs "No email adapter provided"; operator mails go to the log. Proposal to `app/`: a Payload email adapter on `SMTP_URL`.

## Proposals (outside `deploy/`)

1. `app/`: commit migrations; never set `prodMigrations`; a CI check that `payload migrate:create` makes no new file.
2. `app/`: `output: 'standalone'`, then a smaller runtime stage.
3. `app/`: delete `app/Dockerfile`.
4. `app/`: treat an empty limit variable as unset.
5. `app/`: Payload email adapter for operator mails.
6. `worker/`: create `/media` owned by `node` in its Dockerfile.
7. Releases as fixed git branches or tags (`release-1.0`), so the Dokploy **Branch** field gives upgrade and rollback without a terminal.
8. Later: build both images in CI and push them to a registry; the compose file then uses `image:` and the server does not build. This removes the build-memory risk and makes Coolify's "Docker Compose Empty" Service (with its database backup screen) possible.

## Re-run after Phase 4b (2026-10-09, no bridge)

Phase 4b committed `app/src/migrations/20261009_092954_initial`. Images from the current tree: `annoudio-app:demo` **972 MB**, `annoudio-worker:demo` **310 MB**. The prodtest run used them through a scratchpad override (`build: !reset null`), so a later change in `app/` could not change the test.

| # | Step | Result |
|---|---|---|
| R1 | Build both images | Pass. Coordinator told "images built". |
| R2 | Fresh `up -d --wait`, project `annoudio-prodtest`, port 3300 | Healthy in 11.5 s. App log: `[migrate] waiting…`, `Migrating: 20261009_092954_initial`, `Migrated`, `[migrate] done`, `▲ Next.js`. `/admin` 200, `/admin/create-first-user` 200, `/api/users/init` `{"initialized":false}`, `/stories/unknown/unknown/` 404, `/stories/` 404, `/embed/v1.js` 200. |
| R3 | First operator in headless Chromium (Playwright 1.64, `--mute-audio`) on `/admin/create-first-user` | Pass: `POST /api/users/first-register` 200, then the dashboard ("Collections"). First try failed: the script clicked **Create** before React hydrated, so nothing was sent. The script now waits for `networkidle`. |
| R4 | Postgres round per `BACKUP.md`: `pg_dump -Fc` (17.7 KB), `delete from projects`, stop app+worker, drop the two schemas, `pg_restore -O --exit-on-error` | Exit 0. Project `river` and the operator back. App healthy; the migration step found nothing to run. |
| R5 | Media round per `BACKUP.md`: tar of the volume, change `derived/demo.m4a`, untar with app+worker stopped | The file has its old content again, owner uid 1000. Worker started clean. |
| R6 | `docker compose ls`, then `docker compose -p annoudio-prodtest down -v` | Done. No `prodtest` volume is left. |

Note: a test command that ran `rm` inside `sh -c` was refused by the Claude Code safety check. The media round changed the file in place (`tee`) instead of deleting it.

## The demo stack

`deploy/DEMO.md`. Project `annoudio-demo` (`deploy/docker-compose.demo.yml` + `deploy/demo.env`), images `:demo`, app on `127.0.0.1:3500`, `ANNOUDIO_ORIGIN=http://127.0.0.1:3500`, its own volumes.

Login codes: the production build ignores `ANNOUDIO_TEST_MAILBOX` (`payload.config.ts`: only when `NODE_ENV !== 'production'`), and with `SMTP_URL` set the codes do not go to the log. So the demo adds **Mailpit** (`axllent/mailpit:v1.29.0`): `SMTP_URL=smtp://mailpit:1025`, inbox on `127.0.0.1:8025`. Verified: a code requested on the Annotate page in Chromium arrived in Mailpit ("Your login code: …").

Seed: operator `operator@example.org` made through the first-user screen in Chromium; project `river-voices` (site origin `http://127.0.0.1:4620`, rights line, `colorAccent` + `radius`), recording 1 "Ferry crossing, 1962" (`http://127.0.0.1:4610/media/tone.m4a`, 10 s), concepts Ferry, Horn, River, all through REST with the operator token. `/stories/river-voices/1/` gives an empty container; the theme route and `/annotate?…` give 200.
