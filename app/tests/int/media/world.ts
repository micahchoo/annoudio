// The test world of the `media` tests: a `media` instance on a temporary MEDIA_DIR and
// the test database, tus requests as a browser sends them, and the real worker with
// its fake adapters (it copies the raw file and reads the kind from the extension).

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { PgBoss } from 'pg-boss'
import type { Payload } from 'payload'

import {
  fakeProber,
  fakeTranscoder,
  settledReporter,
  startWorker,
  type Derived,
  type Failure,
  type Worker,
} from 'annoudio-worker'

import { createMedia, type Media, type MediaConfig } from '@/modules/media'

export const ORIGIN = 'https://org.example'
export const DATABASE_URL = process.env.DATABASE_URL!

/**
 * Drop the pg-boss schema. Jobs of an earlier test file name raw files in its own
 * temporary MEDIA_DIR; the worker of this file must not spend its time on them.
 */
export async function resetQueues(payload: Payload): Promise<void> {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(sql`drop schema if exists pgboss cascade`)
}

export function tempMediaDir(): string {
  return mkdtempSync(join(tmpdir(), 'annoudio-app-media-'))
}

export function makeMedia(
  payload: Payload,
  mediaDir: string,
  sessionFromRequest: MediaConfig['sessionFromRequest'],
): Media {
  return createMedia({
    payload,
    origin: ORIGIN,
    mediaDir,
    databaseUrl: DATABASE_URL,
    sessionFromRequest,
  })
}

/**
 * A session lookup for tests that need no sign-in: the header `x-test-member` names the
 * member. The `media` tests use the real `membership` instead.
 */
export const headerSession: MediaConfig['sessionFromRequest'] = async (request) => {
  const memberId = request.headers.get('x-test-member')
  return memberId ? { memberId, nickname: memberId } : null
}

const base64 = (value: string) => Buffer.from(value).toString('base64')

export interface UploadOptions {
  /** Headers that identify the member: a `cookie` or `x-test-member`. */
  as: Record<string, string>
  kind: string
  type: string
  bytes: Uint8Array
  /** Bytes per PATCH request. Default: all in one. */
  chunk?: number
}

export function creation(options: Omit<UploadOptions, 'bytes'> & { length: number }): Request {
  return new Request(`${ORIGIN}/media/upload`, {
    method: 'POST',
    headers: {
      ...options.as,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(options.length),
      'Upload-Metadata': `kind ${base64(options.kind)},filetype ${base64(options.type)},filename ${base64('file')}`,
    },
  })
}

export function patch(
  location: string,
  as: Record<string, string>,
  offset: number,
  bytes: Uint8Array,
): Request {
  return new Request(new URL(location, ORIGIN), {
    method: 'PATCH',
    headers: {
      ...as,
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': String(offset),
      'Content-Type': 'application/offset+octet-stream',
    },
    body: bytes,
  })
}

/** Upload with the tus protocol through `handleUpload`. Gives the media id. */
export async function upload(media: Media, options: UploadOptions): Promise<string> {
  const created = await media.handleUpload(creation({ ...options, length: options.bytes.length }))
  if (created.status !== 201)
    throw new Error(`POST gave ${created.status}: ${await created.text()}`)
  const location = created.headers.get('Location')!
  const chunk = options.chunk ?? options.bytes.length
  for (let offset = 0; offset < options.bytes.length; offset += chunk) {
    const part = options.bytes.subarray(offset, offset + chunk)
    const response = await media.handleUpload(patch(location, options.as, offset, part))
    if (response.status !== 204)
      throw new Error(`PATCH gave ${response.status}: ${await response.text()}`)
  }
  return location.split('/').at(-1)!
}

/** A small JPEG-like payload. The fake prober reads only the extension. */
export const PHOTO = new Uint8Array(Buffer.from('fake jpeg bytes '.repeat(64)))

/** The real worker with its fake adapters, reporting through `media.settled`. */
export async function startFakeWorker(mediaDir: string): Promise<{ stop(): Promise<void> }> {
  const reporter = await startedBoss()
  const worker: Worker = await startWorker({
    databaseUrl: DATABASE_URL,
    mediaDir,
    transcoder: fakeTranscoder(),
    prober: fakeProber(),
    retryDelaySeconds: 1,
    ...settledReporter(reporter),
  })
  return {
    async stop() {
      await worker.stop()
      await reporter.stop()
    },
  }
}

/** Send one `media.settled` report, as the worker container does. */
export async function report(
  outcome: { mediaId: string; derived: Derived } | { mediaId: string; failure: Failure },
): Promise<void> {
  const boss = await startedBoss()
  const reporter = settledReporter(boss)
  if ('derived' in outcome) await reporter.onDone(outcome.mediaId, outcome.derived)
  else await reporter.onFailed(outcome.mediaId, outcome.failure)
  await boss.stop()
}

async function startedBoss(): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: DATABASE_URL, supervise: false, schedule: false })
  boss.on('error', (error) => console.error(error))
  return boss.start()
}
