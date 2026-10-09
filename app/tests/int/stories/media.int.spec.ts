// @vitest-environment node
// Stories with media bodies: `saveDraft` takes uploaded and ready bodies, `publish` needs
// every one ready, `ownDrafts` refills them. The media bodies come from the real `media`
// module: a tus upload, then a `media.settled` report as the worker sends it.

import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Media, SettledConsumer } from '@/modules/media'
import type { DraftInput, Stories } from '@/modules/stories'

import {
  PHOTO,
  headerSession,
  makeMedia,
  report,
  resetQueues,
  tempMediaDir,
  upload,
} from '../media/world'
import {
  CONTAINER,
  ORIGIN,
  PROJECT,
  draft,
  leela,
  makeStories,
  operator,
  ravi,
  readJson,
  seed,
  startPayload,
  storyId,
} from './world'

let payload: Payload
let stories: Stories
let media: Media
let consumer: SettledConsumer
const instance = { project: PROJECT, recording: '1' }
const settle = { timeout: 20_000, interval: 100 }

/** Upload a media body as this member. It stays `uploaded` until `ready()`. */
const uploaded = (kind: 'sound' | 'image' | 'video', type: string, member = leela.memberId) =>
  upload(media, { as: { 'x-test-member': member }, kind, type, bytes: PHOTO })

async function ready(id: string, format: string, kind: 'sound' | 'image' | 'video', ext: string) {
  await report({ mediaId: id, derived: { path: `derived/${id}.${ext}`, kind, format } })
  await vi.waitFor(
    async () => expect((await media.body(id, leela.memberId))?.ready).toBe(true),
    settle,
  )
}

const withMedia = (
  id: string,
  kind: 'sound' | 'image' | 'video' = 'image',
  overrides: Partial<DraftInput> = {},
) =>
  draft({
    bodies: [
      { kind: 'text', value: 'The ferry at dawn.' },
      { kind, media: id },
    ],
    ...overrides,
  })

beforeAll(async () => {
  payload = await startPayload()
  await resetQueues(payload)
  media = makeMedia(payload, tempMediaDir(), headerSession)
  consumer = await media.startSettledConsumer(payload)
})

afterAll(async () => {
  await consumer?.stop()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
})

describe('saveDraft with media bodies', () => {
  it('takes an uploaded body; a media body without a text body is media-needs-text', async () => {
    const id = await uploaded('image', 'image/jpeg')
    expect(await stories.saveDraft(leela, withMedia(id))).toMatchObject({ ok: true })
    const alone = await stories.saveDraft(
      leela,
      draft({ id: storyId(2), bodies: [{ kind: 'image', media: id }] }),
    )
    expect(alone).toEqual({ ok: false, error: { code: 'media-needs-text' } })
  })

  it("refuses another member's body and a body of another kind with unknown-media; a failed body with media-failed", async () => {
    const theirs = await uploaded('image', 'image/jpeg', ravi.memberId)
    expect(await stories.saveDraft(leela, withMedia(theirs))).toEqual({
      ok: false,
      error: { code: 'unknown-media', index: 1 },
    })
    const photo = await uploaded('image', 'image/jpeg')
    expect(await stories.saveDraft(leela, withMedia(photo, 'sound'))).toEqual({
      ok: false,
      error: { code: 'unknown-media', index: 1 },
    })
    await report({ mediaId: photo, failure: { code: 'unsupported', message: 'not an image' } })
    await vi.waitFor(
      async () => expect((await media.body(photo, leela.memberId))?.state).toBe('failed'),
      settle,
    )
    expect(await stories.saveDraft(leela, withMedia(photo))).toEqual({
      ok: false,
      error: { code: 'media-failed', index: 1 },
    })
  })
})

describe('publish with media bodies', () => {
  it('throws media-not-ready while a body processes and changes nothing; publishes when it is ready', async () => {
    const id = await uploaded('sound', 'audio/webm;codecs=opus')
    await stories.saveDraft(leela, withMedia(id, 'sound'))
    await expect(stories.publish(operator, storyId(1))).rejects.toMatchObject({
      name: 'StoriesError',
      code: 'media-not-ready',
    })
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    const [own] = await stories.ownDrafts(leela, instance)
    expect(own.reviewState).toBe('draft')

    await ready(id, 'audio/mp4', 'sound', 'm4a')
    await stories.publish(operator, storyId(1))
    const story = await readJson(stories, `${CONTAINER}${storyId(1)}`)
    expect(story.body.slice(0, 2)).toEqual([
      { type: 'TextualBody', value: 'The ferry at dawn.', format: 'text/plain', language: 'ml' },
      { id: `${ORIGIN}/media/${id}`, type: 'Sound', format: 'audio/mp4' },
    ])
  })

  it('with the review rule publish-at-once, a story with a processing body stays a draft', async () => {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { reviewRule: 'publish-at-once' },
    })
    const id = await uploaded('sound', 'audio/webm;codecs=opus')
    expect(await stories.saveDraft(leela, withMedia(id, 'sound'))).toMatchObject({
      ok: true,
      reviewState: 'draft',
    })
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    // With a ready body, the next save publishes, with the measured format.
    await ready(id, 'audio/mp4', 'sound', 'm4a')
    const [own] = await stories.ownDrafts(leela, instance)
    const again = await stories.saveDraft(leela, {
      ...withMedia(id, 'sound', { end: 50 }),
      ifMatch: own.etag,
    })
    expect(again).toMatchObject({ ok: true, reviewState: 'published' })
    const story = await readJson(stories, `${CONTAINER}${storyId(1)}`)
    expect(story.body[1]).toEqual({
      id: `${ORIGIN}/media/${id}`,
      type: 'Sound',
      format: 'audio/mp4',
    })
  })

  it('serves the format of the derived file, also when the upload declared another one', async () => {
    const id = await uploaded('image', 'image/jpeg')
    await stories.saveDraft(leela, withMedia(id))
    // The probe found a PNG in a file that the browser called JPEG.
    await ready(id, 'image/png', 'image', 'png')
    await stories.publish(operator, storyId(1))
    const story = await readJson(stories, `${CONTAINER}${storyId(1)}`)
    expect(story.body[1]).toEqual({
      id: `${ORIGIN}/media/${id}`,
      type: 'Image',
      format: 'image/png',
    })
  })

  it('the admin Publish path gives an operator a plain-language error and shows the media state in the list', async () => {
    const id = await uploaded('video', 'video/mp4')
    await stories.saveDraft(leela, withMedia(id, 'video'))
    const created = await payload.create({
      collection: 'users',
      data: { email: `op-${Date.now()}@example.org`, password: 'a-long-test-password' },
    })
    const user = { ...created, collection: 'users' as const }
    const column = async () =>
      (
        await payload.findByID({
          collection: 'stories',
          id: storyId(1),
          draft: true,
          user,
          overrideAccess: false,
        })
      ).mediaState

    expect(await column()).toBe('processing')
    await expect(
      payload.update({
        collection: 'stories',
        id: storyId(1),
        data: { _status: 'published' },
        user,
        overrideAccess: false,
      }),
    ).rejects.toThrow(
      'This story has a voice note, photo or video that is still processing. Wait some minutes, then publish again.',
    )

    await ready(id, 'video/mp4', 'video', 'mp4')
    expect(await column()).toBe('ready')
    // The module's own reads do not compute the column.
    expect(
      (await payload.findByID({ collection: 'stories', id: storyId(1), draft: true })).mediaState,
    ).toBeNull()
  })
})

describe('ownDrafts with media bodies', () => {
  it('gives the media id, so the same input saves again with no change and keeps the body', async () => {
    const id = await uploaded('image', 'image/webp')
    const first = await stories.saveDraft(leela, withMedia(id))
    const [own] = await stories.ownDrafts(leela, instance)
    expect(own.bodies).toEqual([
      { kind: 'text', value: 'The ferry at dawn.', language: 'ml' },
      { kind: 'image', media: id },
    ])
    const again = await stories.saveDraft(leela, {
      ...draft({ bodies: own.bodies, tags: own.tags, start: own.start, end: own.end }),
      ifMatch: own.etag,
    })
    expect(again).toMatchObject({ ok: true, etag: first.ok ? first.etag : '' })
  })
})
