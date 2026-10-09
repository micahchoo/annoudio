# annoudio-worker

The media worker of Annoudio. It takes the jobs `media.transcode` from Postgres (pg-boss). For each upload, it probes the raw file with ffprobe and makes the served file (the derived file) with ffmpeg:

- sound: AAC-LC in MP4 (`.m4a`), 48 kHz, mono, 64 kbit/s;
- video: H.264 + AAC in MP4 (`.mp4`), at most 1280 px on the longest side, at most 30 frames per second;
- image: the same format (JPEG, PNG or WebP), upright, at most 2048 px on the longest side, with no metadata.

It keeps the raw file. It writes no Payload table: it reports each result through two callbacks, `onDone` and `onFailed`. The container entry (`src/main.ts`) gives callbacks that send one job `media.settled` to the app (`settledReporter`, in `src/settled.ts`). Read `../design/media-interface.md` for the whole `media` interface.

## Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Postgres URL. pg-boss makes and uses the schema `pgboss` in this database. |
| `MEDIA_DIR` | The media volume. It holds `raw/`, `work/` and `derived/`. The app mounts the same volume. |
| `TZ` | Optional. The time zone of the daily review mail at 08:00 (default UTC). |

## Run

Start the worker in a container:

```sh
docker build -t annoudio-worker worker/
docker run -e DATABASE_URL=postgres://annoudio:annoudio@postgres:5432/annoudio \
  -e MEDIA_DIR=/media -v media:/media annoudio-worker
```

The log has one line when a transcode starts and one when it ends, for example `[media worker] 35c7af06-…: transcode done in 2.1 s (audio/mp4).` A failed attempt says `transcode failed in … (<code>: <message>)` and whether the job can run again. `startWorker` takes the option `log` to send these lines somewhere else (the tests use it).

To stop the worker, send SIGTERM (`docker stop`). The worker finishes the active job (at most 30 s) and exits with code 0.

Start the worker without Docker (you need Node 24, pnpm and ffmpeg 8 on the PATH):

```sh
pnpm install
pnpm build
DATABASE_URL=... MEDIA_DIR=... pnpm start
```

## Queue a job from the app

```ts
import { enqueueTranscode } from 'annoudio-worker'

await enqueueTranscode(boss, { mediaId, raw: `raw/${mediaId}.webm`, kind: 'sound' })
```

`boss` is a started `PgBoss` on the same database. `raw` is relative to `MEDIA_DIR`.

## Report to the app

The app works the queue `media.settled` (`app/src/modules/media/`, started by the Next server in `app/src/instrumentation.ts` with `ANNOUDIO_MEDIA_CONSUMER=1`). The queue policy has `expireInSeconds: 60`: a report that a stopped process took comes back after about one minute. The data of one job:

```ts
type Settled =
  | { mediaId: string; outcome: 'ready'; derived: { path; kind; format; durationSec?; width?; height? } }
  | { mediaId: string; outcome: 'failed'; error: { code: MediaErrorCode; message: string } }
```

```ts
import { settledReporter, startWorker, workSettled } from 'annoudio-worker'

await startWorker({ ...options, ...settledReporter(boss) })   // worker side: send
await workSettled(boss, async (message) => { /* set the row */ })   // app side: work
```

A job waits in the queue while the app is down. When the app handler throws, the job comes again (10 retries, from 5 s). So the handler must accept the same report two times.

The app imports this package as `annoudio-worker: file:../worker`, from `dist/`. After a change in `src/`, run `pnpm build` here, then `pnpm install --force` in `app/`.

## The daily review mail

At start, `src/main.ts` puts the job `mail.digest` on the schedule (`src/digest.ts`): every day at 08:00 in the time zone of this container (`TZ`, default UTC). The pg-boss of the worker sends the job at that time; the app works the queue and mails the operators who chose "once a day" (M6, `../design/ia.md` §2.3). A day when the stack was down gets no late mail. To change the time zone, set `TZ` on the worker container (for example `TZ=Asia/Kolkata`) and restart it.

## Test

The tests need ffmpeg 8 on the PATH and the dev Postgres on 127.0.0.1:5432.

1. Start Postgres, if it does not run. Always give the compose file with `-f`:

   ```sh
   docker compose -f deploy/docker-compose.dev.yml up -d --wait
   ```

2. Run the checks in `worker/`:

   ```sh
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

The tests make their fixture files with ffmpeg in a temporary folder. They make the database `annoudio_worker_test` when it does not exist, and they drop its schema `pgboss` before each jobs test. To use a different database, set `TEST_DATABASE_URL`.
