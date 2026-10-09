# `media` interface

Date: 2026-10-09. Phase 4. Read `CONTEXT.md` first; this file uses its words. Phase 4a builds `worker/` (probe, transcode, jobs). Phase 4b wires it into Payload.

## Interface

```ts
// app/src/modules/media/index.ts (Phase 4b) — the only import path for the app
export const mediaCollection: CollectionConfig          // implementation; only `media` reads it
export function tusHandler(ctx): (req: Request) => Promise<Response>   // POST/PATCH/HEAD /media/uploads
export function body(ctx, mediaId: MediaId, memberId: string): Promise<MediaBody | null>
export function servedFile(ctx, name: string): Promise<Response>        // GET /media/<id>.<ext>

type MediaId = string   // UUID that the tus server makes for the upload
interface MediaBody { url: string; format: string; kind: 'sound' | 'image' | 'video'; ready: boolean; state: MediaState }
type MediaState = 'uploaded' | 'ready' | 'failed'

// worker/ (Phase 4a) — package `annoudio-worker`
export function startWorker(options: WorkerOptions): Promise<{ stop(): Promise<void> }>  // graceful, 30 s
export function enqueueTranscode(boss: PgBoss, job: TranscodeJob): Promise<string>
export const LIMITS: Record<Kind, { bytes: number; seconds?: number; pixels?: number }>
interface TranscodeJob { mediaId: MediaId; raw: string /* relative to MEDIA_DIR */; kind: Kind }
interface WorkerOptions { databaseUrl; mediaDir; transcoder: Transcoder; prober: Prober; retryDelaySeconds?: number /* 10 */;
  onDone(mediaId, derived: Derived): Promise<void>; onFailed(mediaId, failure: { code: MediaErrorCode; message }): Promise<void> }
interface Derived extends Probe { path: string /* relative, e.g. derived/<id>.m4a */ }   // the probe of the derived file
// Ports, two adapters each: ffmpegTranscoder + fakeTranscoder, ffprobeProber + fakeProber
interface Transcoder { derive(input: string, output: string, source: Probe): Promise<void> }  // format from source, not from the name
interface Prober { probe(path: string): Promise<Probe>; probeUrl(url: string): Promise<Probe> }
interface Probe { kind: Kind; format: string /* MIME */; durationSec?; width?; height? }
```

## Flow and states

1. The Annotate page uploads with Uppy + tus. Metadata: `kind`, `filetype`. The tus server refuses a body larger than `LIMITS[kind].bytes` from `Upload-Length`, before it stores a byte.
2. On the last chunk, 4b moves the file to `raw/<id>.<ext>`, makes the `media` row (`member`, `kind`, `state: 'uploaded'`) and calls `enqueueTranscode`. The tus response gives the `MediaId`.
3. The job `media.transcode` probes the raw file, checks kind and limits, derives the served file in `work/`, probes it, checks the limits again (a Chrome WebM has no duration in its header), moves it to `derived/`, and calls `onDone` (state `ready`). A permanent error skips the retries. pg-boss moves every job that fails for the last time to the dead letter queue `media.transcode.failed`; its handler calls `onFailed` (state `failed`). So a job that expires because the worker stopped also reaches `onFailed`.

`uploaded` → `ready` | `failed`. No other move. A new upload is a new `MediaId`.

## Invariants

1. The raw blob stays in `raw/` for ever. The worker never writes or deletes it. Visitors never get it.
2. A body is `ready` only when its derived file exists at its final path. The worker writes it in `work/` and renames it into `derived/`, so a reader never sees half a file. `onDone` runs after the rename.
3. Each derived file plays in current Chrome, Firefox and Safari: sound is AAC-LC in MP4 (`.m4a`); video is H.264 + AAC-LC in MP4 (`.mp4`); an image is JPEG, PNG or WebP.
4. A derived image has no metadata (no EXIF, no GPS). The pixels are turned upright first, because the EXIF orientation is lost.
5. `body(mediaId, memberId)` gives `null` when the media does not exist or another member uploaded it. So a member can put only their own uploads in a story.
6. The declared kind and the probed kind agree, or the job fails with `kind-mismatch`.
7. The worker owns no Payload table. It reports through `onDone` and `onFailed`. pg-boss keeps its tables in the schema `pgboss`.

## Error modes (`MediaErrorCode`)

| Code | When | Retry |
|---|---|---|
| `unsupported` | ffprobe cannot read the file, or its format is not on the list below | no |
| `kind-mismatch` | the declared kind is not the probed kind | no |
| `too-large` | the raw file, or the image size in pixels, is over the limit | no |
| `too-long` | the duration is over the limit | no |
| `missing-raw` | the raw file is not there | no |
| `transcode-failed` | ffmpeg failed, the job expired (worker stopped), or `onDone` threw | 3 attempts in all, backoff from 10 s |

Formats accepted: sound — WebM, Ogg, MP4/M4A, MP3, WAV, FLAC; video — WebM, MP4, QuickTime; image — JPEG, PNG, WebP.

## Limits (defaults, in `LIMITS`)

| Kind | Raw size | Duration | Pixels |
|---|---|---|---|
| sound | 100 MB | 15 min | |
| video | 250 MB | 3 min | |
| image | 25 MB | | 50 MP |

## Storage layout (`MEDIA_DIR`, one volume, shared by app and worker)

```
MEDIA_DIR/uploads/<id>          tus FileStore (4b), removed after the move
MEDIA_DIR/raw/<id>.<ext>        raw blob, ext from the upload's MIME type (webm, ogg, m4a, jpg …)
MEDIA_DIR/derived/<id>.m4a      sound
MEDIA_DIR/derived/<id>.mp4      video
MEDIA_DIR/derived/<id>.jpg|png|webp   image
MEDIA_DIR/work/<id>.<ext>       the derived file while ffmpeg writes it; moved to derived/
```

Job data holds paths relative to `MEDIA_DIR`, so the two containers can mount the volume at different paths.

## What Phase 4b adds

- The `media` collection (`member`, `kind`, `state`, `raw`, `derived`, `format`, `durationSec`, `width`, `height`, `error`). Operators can read it; nobody edits it in the admin.
- The tus endpoint (`@tus/server` with `FileStore`), member session required, size limit from `LIMITS`.
- `body()` from the collection. `url` = `${origin}/media/<id>` (Phase 4b: no extension, so the URL is stable before the transcode; see `phase4b-notes.md`).
- `GET /media/<id>`: serves `derived/` only, with `Access-Control-Allow-Origin: *`, `Accept-Ranges` (Safari needs ranges for audio), long `Cache-Control` (a derived file never changes).
- `onDone` / `onFailed` that update the collection. The worker container runs `startWorker`; see `phase4a-notes.md` for where the callbacks run.
- `stories`: `saveDraft` accepts `uploaded` and `ready` bodies; `publish` needs `ready` for every media body; a media body needs a short text.
