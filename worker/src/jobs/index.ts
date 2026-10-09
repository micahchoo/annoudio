import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { PgBoss, type Job, type JobResult, type JobWithMetadata } from 'pg-boss'
import { derivedFormat, LIMITS, MEDIA_ERROR_CODES, MediaError, type Kind, type MediaErrorCode, type Probe } from '../media.ts'
import type { Prober } from '../probe/index.ts'
import type { Transcoder } from '../transcode/index.ts'

/** The data of one `media.transcode` job. `raw` is relative to MEDIA_DIR, for example `raw/<id>.webm`. */
export interface TranscodeJob {
  mediaId: string
  raw: string
  /** The kind that the member declared at upload. The probe must agree. */
  kind: Kind
}

/** What `onDone` gets. `path` is relative to MEDIA_DIR, for example `derived/<id>.m4a`. */
export interface Derived extends Probe {
  path: string
}

export interface Failure {
  code: MediaErrorCode
  message: string
}

export interface WorkerOptions {
  databaseUrl: string
  mediaDir: string
  transcoder: Transcoder
  prober: Prober
  /** Called once when the derived file is in place. If it throws, the job retries. */
  onDone(mediaId: string, derived: Derived): Promise<void>
  /** Called once when the job cannot succeed. If it throws, the call retries. */
  onFailed(mediaId: string, failure: Failure): Promise<void>
  /** The first delay before a retry. Each next delay is about two times longer. Default 10. */
  retryDelaySeconds?: number
  /** Gets one line when a job starts and one when it is done or failed. Default `console.log`. */
  log?: (line: string) => void
}

export interface Worker {
  /** Stop taking jobs, let the active job finish (at most 30 s), and close the pool. */
  stop(): Promise<void>
}

const TRANSCODE = 'media.transcode'
/** The dead letter queue. pg-boss moves a job here when it fails for the last time. */
const FAILED = 'media.transcode.failed'

/** 3 attempts. The job expires after 15 minutes; the ffmpeg timeout is 10 minutes. */
const TRANSCODE_POLICY = { retryLimit: 2, retryBackoff: true, retryDelay: 10, expireInSeconds: 15 * 60 }
const FAILED_POLICY = { retryLimit: 5, retryBackoff: true, retryDelay: 10 }

const prepared = new WeakSet<PgBoss>()

async function prepareQueues(boss: PgBoss): Promise<void> {
  if (prepared.has(boss)) return
  // createQueue does nothing when the queue exists. The dead letter queue must exist first.
  await boss.createQueue(FAILED, FAILED_POLICY)
  await boss.createQueue(TRANSCODE, { ...TRANSCODE_POLICY, deadLetter: FAILED })
  prepared.add(boss)
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Queue a transcode for the app side. `boss` must be started.
 * Gives the job id. The worker reports the result through `onDone` or `onFailed`.
 */
export async function enqueueTranscode(boss: PgBoss, job: TranscodeJob): Promise<string> {
  if (!SAFE_ID.test(job.mediaId)) throw new TypeError(`mediaId ${JSON.stringify(job.mediaId)} is not a safe file name`)
  if (!Object.hasOwn(LIMITS, job.kind)) throw new TypeError(`kind ${JSON.stringify(job.kind)} is not sound, image or video`)
  await prepareQueues(boss)
  const id = await boss.send(TRANSCODE, { mediaId: job.mediaId, raw: job.raw, kind: job.kind })
  if (!id) throw new Error('pg-boss did not create the job')
  return id
}

/**
 * Start the media worker. It takes one job at a time. pg-boss keeps its tables in the
 * schema `pgboss` and makes them when they do not exist.
 */
export async function startWorker(options: WorkerOptions): Promise<Worker> {
  // No LISTEN/NOTIFY: retries and dead letters send no NOTIFY, and pg-boss then polls a notify
  // queue only every 30 s. The default poll (2 s) finds every job.
  const boss = new PgBoss({ connectionString: options.databaseUrl })
  // pg-boss emits `error` for problems in its background loops. Without a listener, Node stops the process.
  boss.on('error', (error) => console.error('[media worker] pg-boss:', error))
  await boss.start()
  await prepareQueues(boss)
  await boss.updateQueue(TRANSCODE, {
    ...TRANSCODE_POLICY,
    retryDelay: options.retryDelaySeconds ?? TRANSCODE_POLICY.retryDelay,
  })

  await boss.work(TRANSCODE, { perJobResults: true }, async (jobs: Job<TranscodeJob>[]) => {
    const results: JobResult[] = []
    for (const job of jobs) results.push(await settle(job, options))
    return results
  })

  await boss.work(FAILED, { includeMetadata: true }, async (jobs: JobWithMetadata<TranscodeJob>[]) => {
    for (const job of jobs) await options.onFailed(job.data.mediaId, failure(job.sourceOutput))
  })

  return { stop: () => boss.stop({ graceful: true, timeout: 30_000 }) }
}

/** Run one job. A permanent error skips the retries and goes to the dead letter queue. */
async function settle(job: Job<TranscodeJob>, options: WorkerOptions): Promise<JobResult> {
  const log = options.log ?? console.log
  const { mediaId, kind } = job.data
  const started = performance.now()
  const seconds = () => `${((performance.now() - started) / 1000).toFixed(1)} s`
  log(`[media worker] ${mediaId}: transcode started (${kind}).`)
  try {
    const derived = await transcode(job.data, options)
    await options.onDone(mediaId, derived)
    log(`[media worker] ${mediaId}: transcode done in ${seconds()} (${derived.format}).`)
    return { id: job.id, status: 'completed' }
  } catch (error) {
    const media =
      error instanceof MediaError
        ? error
        : new MediaError('transcode-failed', error instanceof Error ? error.message : String(error))
    const output: Failure = { code: media.code, message: media.message }
    const next = media.permanent ? 'It does not run again.' : 'It can run again.'
    log(`[media worker] ${mediaId}: transcode failed in ${seconds()} (${media.code}: ${media.message}). ${next}`)
    return { id: job.id, status: media.permanent ? 'deadletter' : 'failed', output }
  }
}

async function transcode(job: TranscodeJob, options: WorkerOptions): Promise<Derived> {
  const { mediaDir, prober, transcoder } = options
  if (!SAFE_ID.test(job.mediaId)) throw new MediaError('unsupported', `mediaId ${job.mediaId} is not a safe file name`)
  const raw = inside(mediaDir, job.raw)
  const { size } = await stat(raw).catch(() => {
    throw new MediaError('missing-raw', `no raw file at ${job.raw}`)
  })
  const limit = LIMITS[job.kind]
  if (size > limit.bytes) throw new MediaError('too-large', `${size} bytes; the ${job.kind} limit is ${limit.bytes}`)

  const source = await prober.probe(raw)
  if (source.kind !== job.kind) {
    throw new MediaError('kind-mismatch', `declared ${job.kind}, but the file is ${source.kind} (${source.format})`)
  }
  checkLimits(source)

  // Write in work/, then move into derived/. Both are on the MEDIA_DIR volume, so the move is atomic.
  const target = derivedFormat(source)
  const name = `${job.mediaId}.${target.ext}`
  const work = join(mediaDir, 'work', name)
  await mkdir(join(mediaDir, 'work'), { recursive: true })
  await mkdir(join(mediaDir, 'derived'), { recursive: true })
  try {
    await transcoder.derive(raw, work, source)
    const result = await prober.probe(work)
    if (result.format !== target.format) {
      throw new MediaError('transcode-failed', `the derived file is ${result.format}, not ${target.format}`)
    }
    // A raw file can have no duration in its header (Chrome's WebM). The derived file always has one.
    checkLimits(result)
    await rename(work, join(mediaDir, 'derived', name))
    return { ...result, path: `derived/${name}` }
  } finally {
    await rm(work, { force: true })
  }
}

function checkLimits(probe: Probe): void {
  const limit = LIMITS[probe.kind]
  if (limit.seconds !== undefined && probe.durationSec !== undefined && probe.durationSec > limit.seconds) {
    throw new MediaError('too-long', `${probe.durationSec} s; the ${probe.kind} limit is ${limit.seconds} s`)
  }
  const pixels = (probe.width ?? 0) * (probe.height ?? 0)
  if (limit.pixels !== undefined && pixels > limit.pixels) {
    throw new MediaError('too-large', `${pixels} pixels; the ${probe.kind} limit is ${limit.pixels}`)
  }
}

/** Resolve `relative` in `root`. A path that goes out of `root` is a missing raw file. */
function inside(root: string, relative: string): string {
  const base = resolve(root)
  const path = resolve(base, relative)
  if (!path.startsWith(base + sep)) throw new MediaError('missing-raw', `${relative} is not in MEDIA_DIR`)
  return path
}

const CODES = new Set<string>(MEDIA_ERROR_CODES)

/** Read the output of the failed job: our Failure, or pg-boss's own (for example `job timed out`). */
function failure(output: unknown): Failure {
  const o = (output ?? {}) as { code?: string; message?: string; value?: { message?: string } }
  if (o.code && CODES.has(o.code) && typeof o.message === 'string') return { code: o.code as MediaErrorCode, message: o.message }
  return { code: 'transcode-failed', message: o.message ?? o.value?.message ?? 'the job failed' }
}
