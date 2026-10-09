// The job runner, end to end against Postgres (database annoudio_worker_test).
// The fake adapters stand in for ffmpeg; the tests that need a failure or a delay give
// their own Transcoder, through the same port.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { PgBoss } from 'pg-boss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueTranscode,
  fakeProber,
  fakeTranscoder,
  startWorker,
  type Derived,
  type Failure,
  type Kind,
  type Prober,
  type Transcoder,
  type Worker,
  type WorkerOptions,
} from '../src/index.ts'
import { fixture } from './helpers.ts'

const databaseUrl = process.env.TEST_DATABASE_URL!

let mediaDir: string
let producer: PgBoss
let workers: Worker[]
let done: [string, Derived][]
let failed: [string, Failure][]

beforeEach(async () => {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  await client.query('DROP SCHEMA IF EXISTS pgboss CASCADE')
  await client.end()

  mediaDir = mkdtempSync(join(tmpdir(), 'annoudio-media-'))
  mkdirSync(join(mediaDir, 'raw'))
  producer = new PgBoss(databaseUrl)
  producer.on('error', (error) => console.error(error))
  await producer.start()
  workers = []
  done = []
  failed = []
})

afterEach(async () => {
  await Promise.all(workers.map((w) => w.stop()))
  await producer.stop()
})

async function start(options: Partial<WorkerOptions> = {}): Promise<Worker> {
  const worker = await startWorker({
    databaseUrl,
    mediaDir,
    transcoder: fakeTranscoder(),
    prober: fakeProber(),
    onDone: async (id, derived) => void done.push([id, derived]),
    onFailed: async (id, failure) => void failed.push([id, failure]),
    retryDelaySeconds: 1,
    ...options,
  })
  workers.push(worker)
  return worker
}

/** Put a fixture in MEDIA_DIR/raw/ and queue it. */
async function upload(mediaId: string, name: string, kind: Kind): Promise<void> {
  const raw = `raw/${mediaId}.${name.split('.').pop()}`
  copyFileSync(fixture(name), join(mediaDir, raw))
  await enqueueTranscode(producer, { mediaId, raw, kind })
}

/** A transcoder that counts its calls and throws on the first `failures` of them. */
function flaky(failures: number): Transcoder & { calls: number } {
  const real = fakeTranscoder()
  const t = {
    calls: 0,
    async derive(input: string, output: string, source: Parameters<Transcoder['derive']>[2]) {
      t.calls += 1
      if (t.calls <= failures) throw new Error(`disk full (call ${t.calls})`)
      await real.derive(input, output, source)
    },
  }
  return t
}

const settle = { timeout: 20_000, interval: 100 }

describe('media.transcode', () => {
  it('derives a queued upload and calls onDone once', async () => {
    await start()
    await upload('m1', 'chrome.webm', 'sound')
    await vi.waitFor(() => expect(done).toHaveLength(1), settle)

    expect(done[0]).toEqual(['m1', { path: 'derived/m1.m4a', kind: 'sound', format: 'audio/mp4', durationSec: 3 }])
    expect(existsSync(join(mediaDir, 'derived/m1.m4a'))).toBe(true)
    expect(existsSync(join(mediaDir, 'raw/m1.webm'))).toBe(true)
    expect(readdirSync(join(mediaDir, 'work'))).toEqual([])
    expect(failed).toEqual([])
  })

  it('logs one line when a job starts and one when it is done or failed', async () => {
    const lines: string[] = []
    await start({ transcoder: flaky(1), log: (line) => void lines.push(line) })
    await upload('m9', 'firefox.ogg', 'sound')
    await vi.waitFor(() => expect(done).toHaveLength(1), settle)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('[media worker] m9: transcode started (sound).')
    expect(lines[1]).toMatch(
      /^\[media worker\] m9: transcode failed in \d+\.\d s \(transcode-failed: disk full \(call 1\)\)\. It can run again\.$/,
    )
    expect(lines[2]).toBe('[media worker] m9: transcode started (sound).')
    expect(lines[3]).toMatch(/^\[media worker\] m9: transcode done in \d+\.\d s \(audio\/mp4\)\.$/)
  })

  it('derives an image to the same format', async () => {
    await start()
    await upload('m2', 'photo.jpg', 'image')
    await vi.waitFor(() => expect(done).toHaveLength(1), settle)
    expect(done[0]![1]).toEqual({ path: 'derived/m2.jpg', kind: 'image', format: 'image/jpeg', width: 320, height: 240 })
  })

  it('retries a transient error and then succeeds', async () => {
    const transcoder = flaky(1)
    await start({ transcoder })
    await upload('m3', 'firefox.ogg', 'sound')
    await vi.waitFor(() => expect(done).toHaveLength(1), settle)
    expect(transcoder.calls).toBe(2)
    expect(failed).toEqual([])
  })

  it('calls onFailed once after 3 failed attempts', async () => {
    const transcoder = flaky(Infinity)
    await start({ transcoder })
    await upload('m4', 'firefox.ogg', 'sound')
    await vi.waitFor(() => expect(failed).toHaveLength(1), settle)

    expect(transcoder.calls).toBe(3)
    expect(failed[0]).toEqual(['m4', { code: 'transcode-failed', message: 'disk full (call 3)' }])
    expect(done).toEqual([])
    expect(existsSync(join(mediaDir, 'derived/m4.m4a'))).toBe(false)
    expect(readdirSync(join(mediaDir, 'work'))).toEqual([])
  })

  it.each([
    ['kind-mismatch', 'a sound declared as an image', 'firefox.ogg', 'image', {}],
    ['too-long', 'a sound of 16 minutes', 'firefox.ogg', 'sound', { durationSec: 16 * 60 }],
    ['too-large', 'an image of 60 megapixels', 'photo.jpg', 'image', { width: 10_000, height: 6_000 }],
    ['unsupported', 'a text file', 'notes.txt', 'sound', {}],
  ] as const)('fails %s (%s) at once, without a retry', async (code, _what, name, kind, sizes) => {
    const real = fakeProber(sizes)
    let probes = 0
    const prober: Prober = { probe: (path) => (probes++, real.probe(path)), probeUrl: real.probeUrl }
    await start({ prober })
    await upload('m5', name, kind)
    await vi.waitFor(() => expect(failed).toHaveLength(1), settle)
    expect(failed[0]).toEqual(['m5', { code, message: expect.any(String) }])
    // One attempt probes the raw file once. A retry would probe it again.
    expect(probes).toBe(1)
  })

  it.each([
    ['a raw file that is not there', 'raw/absent.webm'],
    ['a path out of MEDIA_DIR', '../../etc/passwd'],
  ])('fails missing-raw for %s', async (_what, raw) => {
    await start()
    await enqueueTranscode(producer, { mediaId: 'm6', raw, kind: 'sound' })
    await vi.waitFor(() => expect(failed).toEqual([['m6', expect.objectContaining({ code: 'missing-raw' })]]), settle)
  })

  it('refuses to queue a media id that is not a safe file name, or an unknown kind', async () => {
    await expect(enqueueTranscode(producer, { mediaId: '../x', raw: 'raw/x.webm', kind: 'sound' })).rejects.toThrow(TypeError)
    const kind = 'toString' as Kind
    await expect(enqueueTranscode(producer, { mediaId: 'x', raw: 'raw/x.webm', kind })).rejects.toThrow(TypeError)
  })

  it('lets the active job finish when it stops, then takes no more jobs', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const started = vi.fn()
    const real = fakeTranscoder()
    const worker = await start({
      transcoder: {
        async derive(input, output, source) {
          started()
          await gate
          await real.derive(input, output, source)
        },
      },
    })
    await upload('m7', 'firefox.ogg', 'sound')
    await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(1), settle)

    const stopped = worker.stop().then(() => done.length)
    release()
    // The job finished (onDone ran) before stop() resolved.
    expect(await stopped).toBe(1)

    await upload('m8', 'firefox.ogg', 'sound')
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    expect(started).toHaveBeenCalledTimes(1)
    expect(done.map(([id]) => id)).toEqual(['m7'])
  })
})
