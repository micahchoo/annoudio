# Phase 4a notes

Date: 2026-10-09. Scope: `worker/` (probe, transcode, jobs). Interface: `media-interface.md`.

## Result

`worker/` is a separate package (`annoudio-worker`). 77 tests pass (`pnpm test`, about 55 s): 44 contract tests (22 per adapter pair), 21 ffmpeg/ffprobe tests, 12 jobs tests against Postgres `annoudio_worker_test`. `pnpm typecheck` and `pnpm lint` are clean. The Docker image (310 MB) ran a real job against the dev Postgres: a Chrome-style WebM became a 3.000 s AAC mono 48 kHz `.m4a`.

## ffmpeg flags

Before every input (ffmpeg and ffprobe): `-protocol_whitelist file -format_whitelist matroska,ogg,mov,mp3,wav,flac,image2,jpeg_pipe,png_pipe,webp_pipe` and the input as `file:<path>`. `probeUrl` uses `-protocol_whitelist http,https,tcp,tls -rw_timeout 15000000`.

All outputs: `-nostdin -y -map_metadata -1 -map_chapters -1`.

| Kind | Output flags |
|---|---|
| sound | `-map 0:a:0 -c:a aac -profile:a aac_low -b:a 64k -ar 48000 -ac 1 -movflags +faststart -f ipod` |
| video | `-map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -crf 23 -profile:v high -pix_fmt yuv420p -vf scale=…(fit 1280, even sides, no upscale) -fpsmax 30` + the sound audio flags, `-movflags +faststart -f mp4` |
| image | `-map 0:v:0 -frames:v 1 -vf scale=w='min(2048,iw)':h='min(2048,ih)':force_original_aspect_ratio=decrease`, then JPEG `-c:v mjpeg -q:v 3 -f image2 -update 1`, PNG `-c:v png -f image2 -update 1`, WebP `-c:v libwebp -quality 85 -f webp` |

Each flag was checked against `ffmpeg -h encoder=aac`, `-h muxer=ipod` and `-h full` (ffmpeg 8.0.1), and the tests check the output with an independent ffprobe call.

## Decisions

1. **Images are re-encoded, not passed through.** A phone photo has EXIF with the GPS position, and the stories are public. Re-encoding removes it: ffmpeg's image encoders write no EXIF (a test proved this: the EXIF test passes even without `-map_metadata -1`). ffmpeg 8 turns the pixels upright from the EXIF orientation when it decodes, so the photo does not turn on its side when the EXIF goes. No `sharp`: ffmpeg is already there.
2. **`-map_metadata -1` is for the container tags** of sound and video (an iPhone video keeps its position in a tag). Tests with a `title=LeakyPhone` tag fail without the flag.
3. **The input guard is needed.** An upload can be an HLS playlist. Without the guard, ffprobe fetched 29 KB from the URL in the playlist (a test proves the guard stops it). This also closes a server-side request path from member uploads.
4. **Permanent errors skip the retries** (`unsupported`, `kind-mismatch`, `too-large`, `too-long`, `missing-raw`). `transcode-failed` gets 3 attempts (pg-boss `retryLimit: 2`, `retryBackoff`, `retryDelay: 10`).
5. **`onFailed` runs from a dead letter queue** (`media.transcode.failed`), not from the last attempt. So a job that expires (the worker died during ffmpeg) also reaches `onFailed`. The error comes from pg-boss's `sourceOutput`.
6. **No LISTEN/NOTIFY.** With it, pg-boss polls a notify queue every 30 s, and retries and dead letters send no NOTIFY. Found when the failure tests waited 20 s for nothing. The 2 s poll is enough for media.
7. **The duration comes from the derived file.** Chrome's MediaRecorder WebM has no duration in its header (the fixture copies this with `-live 1`). The job checks the limits on the raw probe and again on the derived probe.
8. **pg-boss 12.37.0, not 12.37.1.** pnpm's `minimumReleaseAge` refused 12.37.1 (released 2026-10-08). I did not add the exclusion that pnpm offered.
9. **Alpine 3.24 `apk add ffmpeg` (8.1.2)** in the image, not the static ffmpeg image (308 MB alone). The tests ran on the host's ffmpeg 8.0.1, not in the image.

## Deviations from the brief

- `Transcoder` has one method, `derive(input, output, source: Probe)`, not `toM4a` + `imageDerivative`. One method covers sound, video and image; the job selects nothing. It returns nothing: the `Prober` is the one place that measures, and it measures the derived file (decision 7).
- The brief named `onReady?`; the options have `onDone` and `onFailed`, both required, as the brief also says.
- Job data has `raw` relative to `MEDIA_DIR`, not an absolute `rawPath`, so the app and the worker can mount the volume at different paths. A path out of `MEDIA_DIR` fails with `missing-raw`.
- `startWorker` takes `retryDelaySeconds` (default 10). The tests set 1. The queue policy is in the worker; `startWorker` writes it with `updateQueue` at each start.
- `src/main.ts` (the container entry) logs one JSON line for each result. Phase 4b replaces the two callbacks.

## Open for Phase 4b

- **Where the callbacks run.** The worker is its own container, and it must not write Payload tables. Proposal: the worker's `onDone`/`onFailed` send a job `media.settled`, and the app works that queue and updates the `media` collection with Payload. The other choice is to run `startWorker` in the app process (Payload `onInit`); then the app image needs ffmpeg.
- `stories`: what `saveDraft` and `publish` do with an `uploaded` body (proposal in `media-interface.md`).
- `probeUrl` gives `unsupported` also when the URL cannot be reached. Phase 5 (`catalogue`) may want a separate code for that.

## Not verified

- Playback in real browsers. Playwright's Chromium has no AAC or H.264, so a test there proves nothing. The Phase 4 "done when" check (record in Safari, play in Chrome and Firefox) stays for 4b.
- Firefox without system AAC (research §3 risk). Not tested.
- The tests did not run in the Docker image (ffmpeg 8.1.2); only the smoke test did.
- Real MediaRecorder files. The fixtures copy their codecs and containers, and the missing WebM duration, but they are not browser output.
- Transcode time and memory of a 3-minute 1080p video on a small VPS. The 10-minute ffmpeg timeout is a guess.
