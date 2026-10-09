// @vitest-environment node
// The `media` module through its interface: tus requests into `handleUpload`, the real
// worker (fake adapters) and the `media.settled` consumer on the test database, and GET
// requests into `handleFile`.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { LIMITS } from 'annoudio-worker'

import { type Media, type SettledConsumer } from '@/modules/media'
import { memoryMailer } from '@/modules/mail'
import { createMembership, type Membership } from '@/modules/membership'
import config from '@/payload.config'

import {
  ORIGIN,
  PHOTO,
  creation,
  makeMedia,
  patch,
  report,
  resetQueues,
  startFakeWorker,
  tempMediaDir,
  upload,
} from './world'

let payload: Payload
let membership: Membership
let media: Media
let mediaDir: string
let consumer: SettledConsumer
const mailer = memoryMailer({ echo: false })
let leela: Record<string, string>
let ravi: Record<string, string>
let leelaId: string

async function signIn(email: string, nickname: string): Promise<Record<string, string>> {
  await membership.requestCode(email)
  const code = /\b(\d{6})\b/.exec(mailer.lastTo(email)?.text ?? '')![1]
  const result = await membership.verifyCode(email, code, nickname)
  if (!result.ok) throw new Error(result.error)
  return { cookie: `${result.cookie.name}=${result.cookie.value}` }
}

const get = (id: string, headers: Record<string, string> = {}, method = 'GET') =>
  media.handleFile(new Request(`${ORIGIN}/media/${id}`, { method, headers }))

const settle = { timeout: 20_000, interval: 100 }
const stateOf = async (id: string) =>
  (await payload.findByID({ collection: 'media', id, depth: 0, disableErrors: true }))?.state

beforeAll(async () => {
  payload = await getPayload({ config })
  membership = createMembership({ payload, origin: ORIGIN, secret: 'test-secret', mailer })
  await resetQueues(payload)
  mediaDir = tempMediaDir()
  media = makeMedia(payload, mediaDir, (request) => membership.sessionFromRequest(request))
  consumer = await media.startSettledConsumer(payload)
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(
    sql`truncate members, member_sessions, login_codes restart identity cascade`,
  )
  leela = await signIn('leela@example.org', 'Leela')
  ravi = await signIn('ravi@example.org', 'Ravi')
  leelaId = (await membership.sessionFromRequest({ headers: new Headers(leela) }))!.memberId
})

afterAll(async () => {
  await consumer?.stop()
})

beforeEach(async () => {
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(sql`truncate media cascade`)
})

describe('handleUpload (tus)', () => {
  it('takes a creation and two PATCH requests; makes the raw file and an uploaded row', async () => {
    const id = await upload(media, {
      as: leela,
      kind: 'image',
      type: 'image/jpeg',
      bytes: PHOTO,
      chunk: 500,
    })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(readFileSync(join(mediaDir, `raw/${id}.jpg`))).toEqual(Buffer.from(PHOTO))
    expect(existsSync(join(mediaDir, `uploads/${id}`))).toBe(false)
    const row = await payload.findByID({ collection: 'media', id, depth: 0 })
    expect(row).toMatchObject({
      member: leelaId,
      kind: 'image',
      state: 'uploaded',
      size: PHOTO.length,
      raw: `raw/${id}.jpg`,
      format: 'image/jpeg',
    })
  })

  it('gives 401 without a session, and 404 to another member for HEAD and PATCH', async () => {
    const anonymous = await media.handleUpload(
      creation({ as: {}, kind: 'image', type: 'image/jpeg', length: 10 }),
    )
    expect(anonymous.status).toBe(401)

    const created = await media.handleUpload(
      creation({ as: leela, kind: 'image', type: 'image/jpeg', length: PHOTO.length }),
    )
    const location = created.headers.get('Location')!
    expect(location).toMatch(/^\/media\/upload\/[0-9a-f-]{36}$/)
    const head = (as: Record<string, string>) =>
      media.handleUpload(
        new Request(new URL(location, ORIGIN), {
          method: 'HEAD',
          headers: { ...as, 'Tus-Resumable': '1.0.0' },
        }),
      )
    expect((await head(ravi)).status).toBe(404)
    expect((await media.handleUpload(patch(location, ravi, 0, PHOTO))).status).toBe(404)
    const own = await head(leela)
    expect(own.status).toBe(200)
    expect(own.headers.get('Upload-Offset')).toBe('0')
  })

  it('refuses a body over the limit of its kind, a wrong type, no kind and a deferred length, before it stores a byte', async () => {
    const send = (kind: string, type: string, length: number) =>
      media.handleUpload(creation({ as: leela, kind, type, length }))
    expect((await send('image', 'image/jpeg', LIMITS.image.bytes + 1)).status).toBe(413)
    expect((await send('image', 'image/jpeg', LIMITS.image.bytes)).status).toBe(201)
    expect((await send('sound', 'audio/webm;codecs=opus', LIMITS.sound.bytes + 1)).status).toBe(413)
    expect((await send('video', 'video/mp4', LIMITS.video.bytes)).status).toBe(201)
    expect((await send('image', 'image/svg+xml', 10)).status).toBe(415)
    expect((await send('sound', 'image/jpeg', 10)).status).toBe(415)
    expect((await send('file', 'image/jpeg', 10)).status).toBe(400)

    const deferred = await media.handleUpload(
      new Request(`${ORIGIN}/media/upload`, {
        method: 'POST',
        headers: {
          ...leela,
          'Tus-Resumable': '1.0.0',
          'Upload-Defer-Length': '1',
          'Upload-Metadata': `kind ${btoa('image')},filetype ${btoa('image/jpeg')}`,
        },
      }),
    )
    expect(deferred.status).toBe(411)
    expect(await payload.count({ collection: 'media' })).toEqual({ totalDocs: 0 })
  })

  it('sets the member from the session, not from the client metadata', async () => {
    const response = await media.handleUpload(
      new Request(`${ORIGIN}/media/upload`, {
        method: 'POST',
        headers: {
          ...leela,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': String(PHOTO.length),
          'Upload-Metadata': `kind ${btoa('image')},filetype ${btoa('image/jpeg')},member ${btoa('m-other')}`,
        },
      }),
    )
    const location = response.headers.get('Location')!
    expect((await media.handleUpload(patch(location, leela, 0, PHOTO))).status).toBe(204)
    const row = await payload.findByID({
      collection: 'media',
      id: location.split('/').at(-1)!,
      depth: 0,
    })
    expect(row.member).toBe(leelaId)
  })
})

describe('body', () => {
  it('gives the stable URL, the kind and the state to the member who uploaded; null to anyone else', async () => {
    const id = await upload(media, {
      as: leela,
      kind: 'sound',
      type: 'audio/webm;codecs=opus',
      bytes: PHOTO,
    })
    expect(await media.body(id, leelaId)).toEqual({
      url: `${ORIGIN}/media/${id}`,
      format: 'audio/mp4',
      kind: 'sound',
      ready: false,
      state: 'uploaded',
    })
    const raviId = (await membership.sessionFromRequest({ headers: new Headers(ravi) }))!.memberId
    expect(await media.body(id, raviId)).toBeNull()
    expect(await media.body('0192f3a4-0000-7000-8000-000000000000', leelaId)).toBeNull()
    expect(await media.body('../etc/passwd', leelaId)).toBeNull()
  })
})

describe('the worker reports through media.settled', () => {
  it('makes the body ready; then handleFile serves it with CORS, a year of cache and byte ranges', async () => {
    const worker = await startFakeWorker(mediaDir)
    try {
      const id = await upload(media, { as: leela, kind: 'image', type: 'image/jpeg', bytes: PHOTO })
      const early = await get(id)
      expect(early.status).toBe(404)
      expect(early.headers.get('Cache-Control')).toBe('no-store')
      expect(early.headers.get('Access-Control-Allow-Origin')).toBe('*')

      await vi.waitFor(async () => expect(await stateOf(id)).toBe('ready'), settle)
      const row = await payload.findByID({ collection: 'media', id, depth: 0 })
      expect(row).toMatchObject({
        derived: `derived/${id}.jpg`,
        format: 'image/jpeg',
        width: 320,
        height: 240,
      })
      expect(await media.body(id, leelaId)).toMatchObject({ ready: true, state: 'ready' })

      const full = await get(id)
      expect(full.status).toBe(200)
      expect(Object.fromEntries(full.headers)).toMatchObject({
        'access-control-allow-origin': '*',
        'cross-origin-resource-policy': 'cross-origin',
        'x-content-type-options': 'nosniff',
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': 'image/jpeg',
        'accept-ranges': 'bytes',
        'content-length': String(PHOTO.length),
      })
      expect(Buffer.from(await full.arrayBuffer())).toEqual(Buffer.from(PHOTO))

      const part = await get(id, { Range: 'bytes=10-19' })
      expect(part.status).toBe(206)
      expect(part.headers.get('Content-Range')).toBe(`bytes 10-19/${PHOTO.length}`)
      expect(Buffer.from(await part.arrayBuffer())).toEqual(Buffer.from(PHOTO.subarray(10, 20)))

      const tail = await get(id, { Range: 'bytes=-5' })
      expect(tail.status).toBe(206)
      expect(Buffer.from(await tail.arrayBuffer())).toEqual(Buffer.from(PHOTO.subarray(-5)))

      const open = await get(id, { Range: `bytes=${PHOTO.length - 3}-` })
      expect(open.headers.get('Content-Range')).toBe(
        `bytes ${PHOTO.length - 3}-${PHOTO.length - 1}/${PHOTO.length}`,
      )

      const beyond = await get(id, { Range: `bytes=${PHOTO.length}-` })
      expect(beyond.status).toBe(416)
      expect(beyond.headers.get('Content-Range')).toBe(`bytes */${PHOTO.length}`)

      const head = await get(id, {}, 'HEAD')
      expect(head.status).toBe(200)
      expect(head.headers.get('Content-Length')).toBe(String(PHOTO.length))
      expect(await head.text()).toBe('')
    } finally {
      await worker.stop()
    }
  })

  it('makes the body failed with the code; a second report changes nothing', async () => {
    const id = await upload(media, { as: leela, kind: 'video', type: 'video/mp4', bytes: PHOTO })
    await report({
      mediaId: id,
      failure: { code: 'too-long', message: '200 s; the video limit is 180 s' },
    })
    await vi.waitFor(async () => expect(await stateOf(id)).toBe('failed'), settle)
    const row = await payload.findByID({ collection: 'media', id, depth: 0 })
    expect(row.error).toBe('too-long: 200 s; the video limit is 180 s')

    await report({
      mediaId: id,
      derived: { path: `derived/${id}.mp4`, kind: 'video', format: 'video/mp4' },
    })
    await report({
      mediaId: '0192f3a4-0000-7000-8000-00000000dead',
      failure: { code: 'unsupported', message: 'gone' },
    })
    // The consumer takes the reports in order; wait until the queue is empty.
    await new Promise((resolve) => setTimeout(resolve, 5_000))
    expect(await stateOf(id)).toBe('failed')
    expect((await get(id)).status).toBe(404)
  }, 30_000)
})

describe('the media collection', () => {
  it('is closed to visitors and members; an operator delete removes the files', async () => {
    const worker = await startFakeWorker(mediaDir)
    try {
      const id = await upload(media, { as: leela, kind: 'image', type: 'image/png', bytes: PHOTO })
      await vi.waitFor(async () => expect(await stateOf(id)).toBe('ready'), settle)
      await expect(payload.find({ collection: 'media', overrideAccess: false })).rejects.toThrow()

      const operator = await payload.create({
        collection: 'users',
        data: { email: `op-${Date.now()}@example.org`, password: 'a-long-test-password' },
      })
      const user = { ...operator, collection: 'users' as const }
      expect(
        (await payload.find({ collection: 'media', overrideAccess: false, user })).totalDocs,
      ).toBe(1)
      await expect(
        payload.update({
          collection: 'media',
          id,
          data: { state: 'failed' },
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow()

      await payload.delete({ collection: 'media', id, overrideAccess: false, user })
      expect(existsSync(join(mediaDir, `raw/${id}.png`))).toBe(false)
      expect(existsSync(join(mediaDir, `derived/${id}.png`))).toBe(false)
      expect((await get(id)).status).toBe(404)
    } finally {
      await worker.stop()
    }
  })
})
