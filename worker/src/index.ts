// The processing core of the `media` module. This file is the only import path.
// Read design/media-interface.md for the whole interface.

export { LIMITS, MediaError, derivedFormat, type Kind, type MediaErrorCode, type Probe } from './media.ts'
export { ffprobeProber, fakeProber, type Prober } from './probe/index.ts'
export { ffmpegTranscoder, fakeTranscoder, type Transcoder } from './transcode/index.ts'
export {
  enqueueTranscode,
  startWorker,
  type Derived,
  type Failure,
  type TranscodeJob,
  type Worker,
  type WorkerOptions,
} from './jobs/index.ts'
export { SETTLED, settledReporter, workSettled, type Settled } from './settled.ts'
export { DIGEST, DIGEST_CRON, scheduleDigest, stackTimeZone, workDigest } from './digest.ts'
