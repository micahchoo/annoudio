// @vitest-environment node
// The story actions of Phase 5c at the `stories` interface: `remove`, `nextWaiting`,
// `ownStories`, and `mediaSettled` through the real `media.settled` path (a pg-boss
// report, the consumer of `media`, then `stories`).

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { body, createMedia, type SettledConsumer } from '@/modules/media'
import { lifecycle, type Stories } from '@/modules/stories'

import { DATABASE_URL, headerSession, report, resetQueues, tempMediaDir } from '../media/world'
import {
  CONTAINER,
  ORIGIN,
  PROJECT,
  draft,
  leela,
  makeStories,
  operator,
  publishDraft,
  ravi,
  readJson,
  seed,
  startPayload,
  storyId,
  tallies,
} from './world'

let payload: Payload
let stories: Stories
let consumer: SettledConsumer
const instance = { project: PROJECT, recording: '1' }
const settle = { timeout: 20_000, interval: 100 }
const photoId = (n: number) => `0192f3a4-aa01-7000-8000-00000000f00${n}`

beforeAll(async () => {
  payload = await startPayload()
  await resetQueues(payload)
  const media = createMedia({
    payload,
    origin: ORIGIN,
    mediaDir: tempMediaDir(),
    databaseUrl: DATABASE_URL,
    sessionFromRequest: headerSession,
    onSettled: (mediaId) => stories.mediaSettled(mediaId),
  })
  consumer = await media.startSettledConsumer(payload)
})

afterAll(async () => {
  await consumer?.stop()
})

beforeEach(async () => {
  await seed(payload)
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(sql`truncate media cascade`)
  stories = makeStories(payload)
})

/** An uploaded photo of the member, as the tus upload leaves it. */
async function photo(n: number, member = leela.memberId) {
  await payload.create({
    collection: 'media',
    data: {
      id: photoId(n),
      member,
      kind: 'image',
      state: 'uploaded',
      size: 100,
      raw: `raw/${photoId(n)}.jpg`,
      format: 'image/jpeg',
    },
  })
}

const withPhoto = (n: number, overrides = {}) =>
  draft({
    bodies: [
      { kind: 'text', value: 'The ferry at dawn.' },
      { kind: 'image', media: photoId(n) },
    ],
    ...overrides,
  })

async function saved(input = draft(), session = leela) {
  const result = await stories.saveDraft(session, input)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
}

const reply = (n: number) => ({
  id: storyId(n),
  project: PROJECT,
  recording: '1',
  replyTo: storyId(1),
  bodies: [{ kind: 'text' as const, value: `Reply number ${n}.` }],
})

const ready = (n: number) =>
  report({
    mediaId: photoId(n),
    derived: { path: `derived/${photoId(n)}.jpg`, kind: 'image', format: 'image/jpeg' },
  })
const failed = (n: number) =>
  report({ mediaId: photoId(n), failure: { code: 'unsupported', message: 'not a photo' } })

async function setReviewRule(rule: 'review' | 'publish-at-once') {
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: PROJECT } },
  })
  await payload.update({ collection: 'projects', id: docs[0].id, data: { reviewRule: rule } })
}

const ownState = async (n: number, session = leela) =>
  lifecycle((await stories.ownDrafts(session, instance)).find((s) => s.id === storyId(n))!)

describe('remove', () => {
  it('removes a published story with its replies; visitors and members no longer see them', async () => {
    await publishDraft(stories, draft())
    await publishDraft(stories, reply(2), ravi)
    await saved(reply(3), ravi)
    expect((await readJson(stories, CONTAINER)).total).toBe(1)

    await stories.remove(operator, storyId(1), 'A complaint.')

    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    expect(await stories.ownDrafts(leela, instance)).toEqual([])
    expect(await stories.ownDrafts(ravi, instance)).toEqual([])
    expect(await stories.review(operator, storyId(2))).toBeNull()
    expect(await stories.counts()).toMatchObject(tallies({}))
  })

  it('removes a reply only, and the story keeps its other replies', async () => {
    await publishDraft(stories, draft())
    await publishDraft(stories, reply(2), ravi)
    await publishDraft(stories, reply(3), ravi)
    await stories.remove(operator, storyId(2))
    const [item] = (await readJson(stories, CONTAINER)).first.items
    expect(item['annoudio:replies'].map((r: { id: string }) => r.id)).toEqual([
      `${ORIGIN}${CONTAINER}${storyId(3)}`,
    ])
  })

  it('deletes the media bodies of the removed story', async () => {
    await photo(1)
    await saved(withPhoto(1))
    await stories.remove(operator, storyId(1))
    expect(await body({ payload, origin: ORIGIN }, photoId(1), leela.memberId)).toBeNull()
  })

  it('needs an operator and a known story', async () => {
    await saved()
    await expect(stories.remove({ operatorId: '' }, storyId(1))).rejects.toMatchObject({
      code: 'forbidden',
    })
    await expect(stories.remove(operator, storyId(9))).rejects.toMatchObject({
      name: 'StoriesError',
      code: 'not-found',
    })
  })
})

describe('nextWaiting', () => {
  it('goes through the Waiting for review tab, oldest first, and skips other states', async () => {
    await saved(draft({ id: storyId(1) }))
    await photo(1)
    await saved(withPhoto(1, { id: storyId(2), start: 1, end: 2 })) // processing
    await saved(draft({ id: storyId(3), start: 3, end: 4 }))
    await saved(draft({ id: storyId(4), start: 5, end: 6 }))
    await stories.reject(operator, storyId(4), 'No.')
    await publishDraft(stories, draft({ id: storyId(5), start: 7, end: 8 }), ravi)
    const own = (await stories.ownDrafts(ravi, instance))[0]
    await saved({ ...draft({ id: storyId(5), start: 7, end: 9 }), ifMatch: own.etag }, ravi)

    expect(await stories.nextWaiting()).toBe(storyId(1))
    expect(await stories.nextWaiting(storyId(1))).toBe(storyId(3))
    // A change to a published story waits too.
    expect(await stories.nextWaiting(storyId(3))).toBe(storyId(5))
    // After the newest waiting story: the oldest other one (Return and Publish alike).
    expect(await stories.nextWaiting(storyId(5))).toBe(storyId(1))

    // After a publish, the story has left the tab; the next one is the same.
    await stories.publish(operator, storyId(1))
    expect(await stories.nextWaiting(storyId(1))).toBe(storyId(3))
    // An id that is gone gives the oldest.
    expect(await stories.nextWaiting(storyId(9))).toBe(storyId(3))
    // The one waiting story has no next story.
    await stories.publish(operator, storyId(3))
    expect(await stories.nextWaiting(storyId(5))).toBeNull()
  })
})

describe('ownStories', () => {
  it('gives the stories and replies of the member in every project, newest first', async () => {
    await publishDraft(stories, draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), recording: '2', start: 1, end: 2, values: [] }))
    await saved(reply(3), ravi)
    const own = await stories.ownStories(leela)
    expect(own.map((s) => [s.id, s.project, s.recording])).toEqual([
      [storyId(2), PROJECT, '2'],
      [storyId(1), PROJECT, '1'],
    ])
    expect(lifecycle(own[1]).state).toBe('published')
    expect((await stories.ownStories(ravi)).map((s) => s.replyTo)).toEqual([storyId(1)])
  })
})

describe('mediaSettled through the media.settled consumer', () => {
  it('a failed file returns the story to its member: Returned (automatic)', async () => {
    await photo(1)
    await saved(withPhoto(1))
    expect((await ownState(1)).state).toBe('processing')
    await failed(1)
    await vi.waitFor(async () => expect((await ownState(1)).state).toBe('returned'), settle)
    const [own] = await stories.ownDrafts(leela, instance)
    expect(lifecycle(own)).toEqual({ state: 'returned', change: null, automatic: true })
    expect(own.rejection).toMatchObject({
      reason: 'We could not use your file. Attach a different file.',
      automatic: true,
    })
    expect(await stories.counts()).toMatchObject(tallies({ returned: [1, 0], automatic: 1 }))
    expect(await stories.nextWaiting()).toBeNull()
  })

  it('with publish-at-once, the story is published when its file is ready', async () => {
    await setReviewRule('publish-at-once')
    await photo(1)
    await saved(withPhoto(1))
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    await ready(1)
    await vi.waitFor(async () => expect((await ownState(1)).state).toBe('published'), settle)
    expect((await readJson(stories, CONTAINER)).total).toBe(1)
  })

  it('with review, the story goes from Processing to Waiting for review; a second report changes nothing', async () => {
    await photo(1)
    await saved(withPhoto(1))
    expect(await stories.counts()).toMatchObject(tallies({ processing: [1, 0] }))
    await ready(1)
    await vi.waitFor(
      async () => expect(await stories.counts()).toMatchObject(tallies({ waiting: [1, 0] })),
      settle,
    )
    expect(await stories.nextWaiting()).toBe(storyId(1))
    await stories.mediaSettled(photoId(1))
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [1, 0] }))
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
  })
})

it('has no unpublish: a return or a removal takes a story down', () => {
  expect('unpublish' in stories).toBe(false)
})

describe('the reads of the Today page', () => {
  it('counts give the last member save and the stories with a host page', async () => {
    expect(await stories.counts()).toMatchObject({ newest: null, onSites: 0 })
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { siteOrigins: [{ origin: 'https://rivervoices.example.org' }] },
    })
    await saved(draft({ id: storyId(1), toldOn: 'https://rivervoices.example.org/ferry' }))
    await saved(draft({ id: storyId(2), start: 1, end: 2 }))
    const counts = await stories.counts()
    expect(counts.onSites).toBe(1)
    expect(Date.parse(counts.newest!)).not.toBeNaN()
  })

  it('recent counts what came in, what was published and what was returned', async () => {
    const before = new Date(Date.now() - 1000)
    await publishDraft(stories, draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), start: 1, end: 2 }))
    await stories.reject(operator, storyId(2), 'No.')
    expect(await stories.recent(before)).toEqual({ told: 2, published: 1, returned: 1 })
    expect(await stories.recent(new Date(Date.now() + 60_000))).toEqual({
      told: 0,
      published: 0,
      returned: 0,
    })
  })
})

describe('history', () => {
  it('gives each version newest first: who did what, and the reason of a return', async () => {
    const ravi = { operatorId: 'op-2', name: 'Ravi' }
    await saved()
    await stories.reject(ravi, storyId(1), 'Please remove the full name.')
    const [own] = await stories.ownDrafts(leela, instance)
    await saved({ ...draft({ start: 40 }), ifMatch: own.etag })
    await stories.publish(ravi, storyId(1))
    const lines = await stories.history(operator, storyId(1))
    expect(
      lines.map(({ action, by, nickname, reason }) => ({ action, by, nickname, reason })),
    ).toEqual([
      { action: 'published', by: 'Ravi', nickname: 'Leela', reason: undefined },
      { action: 'saved', by: 'member', nickname: 'Leela', reason: undefined },
      { action: 'returned', by: 'Ravi', nickname: 'Leela', reason: 'Please remove the full name.' },
      { action: 'saved', by: 'member', nickname: 'Leela', reason: undefined },
    ])
    await expect(stories.history({ operatorId: '' }, storyId(1))).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('a failed file gives the line "returned-automatically" by the system', async () => {
    await photo(1)
    await saved(withPhoto(1))
    await failed(1)
    await vi.waitFor(
      async () =>
        expect((await stories.history(operator, storyId(1)))[0]).toMatchObject({
          action: 'returned-automatically',
          by: 'system',
        }),
      settle,
    )
  })
})
