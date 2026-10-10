// The operator side of `stories` (Phase 5): `reject`, `review`, `counts`, `tagCounts`, and
// the project review rule `publish-at-once`. All through the module interface.

import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Stories } from '@/modules/stories'

import {
  BOAT,
  CONTAINER,
  FERRY,
  ORIGIN,
  PROJECT,
  T0,
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
  SUBJECT,
  topic,
  tallies,
} from './world'

let payload: Payload
let stories: Stories
const instance = { project: PROJECT, recording: '1' }

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
})

async function saved(input = draft()) {
  const result = await stories.saveDraft(leela, input)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result
}

describe('reject', () => {
  it('returns a draft with the reason: ownDrafts shows it, the queue loses it, a new save clears it', async () => {
    await saved()
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [1, 0] }))

    await stories.reject(operator, storyId(1), '  Please remove the full name.  ')

    const [own] = await stories.ownDrafts(leela, instance)
    expect(own.reviewState).toBe('draft')
    expect(own.rejection).toEqual({
      reason: 'Please remove the full name.',
      at: T0,
      automatic: false,
    })
    expect(await stories.counts()).toMatchObject(tallies({ returned: [1, 0] }))

    await stories.saveDraft(leela, {
      ...draft({ bodies: [{ kind: 'text', value: 'My grandmother sang on the ferry.' }] }),
      ifMatch: own.etag,
    })
    const [after] = await stories.ownDrafts(leela, instance)
    expect(after.rejection).toBeUndefined()
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [1, 0] }))
  })

  it('takes a published story down: visitors no longer see it', async () => {
    await publishDraft(stories, draft())
    expect((await readJson(stories, CONTAINER)).total).toBe(1)

    await stories.reject(operator, storyId(1), 'A visitor reported it.')

    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    const [own] = await stories.ownDrafts(leela, instance)
    expect(own).toMatchObject({
      reviewState: 'draft',
      rejection: { reason: 'A visitor reported it.' },
    })
  })

  it('returns a newer draft of a published story and keeps the published version visible', async () => {
    await publishDraft(stories, draft())
    const [own] = await stories.ownDrafts(leela, instance)
    await stories.saveDraft(leela, { ...draft({ start: 40 }), ifMatch: own.etag })

    await stories.reject(operator, storyId(1), 'Keep the old time range.')

    const container = await readJson(stories, CONTAINER)
    expect(container.total).toBe(1)
    expect(container.first.items[0].target.selector.value).toBe('t=42,51')
    const [after] = await stories.ownDrafts(leela, instance)
    expect(after).toMatchObject({
      start: 40,
      pendingRevision: true,
      rejection: { reason: 'Keep the old time range.' },
    })
  })

  it('a publish after a rejection clears it', async () => {
    await saved()
    await stories.reject(operator, storyId(1), 'Not now.')
    await stories.publish(operator, storyId(1))
    const [own] = await stories.ownDrafts(leela, instance)
    expect(own.reviewState).toBe('published')
    expect(own.rejection).toBeUndefined()
    expect(await stories.counts()).toMatchObject(tallies({ published: [1, 0] }))
  })

  it('needs a reason, an operator and a known story', async () => {
    await saved()
    await expect(stories.reject(operator, storyId(1), '   ')).rejects.toMatchObject({
      name: 'StoriesError',
      code: 'no-reason',
    })
    await expect(stories.reject({ operatorId: '' }, storyId(1), 'No.')).rejects.toMatchObject({
      code: 'forbidden',
    })
    await expect(stories.reject(operator, storyId(9), 'No.')).rejects.toMatchObject({
      code: 'not-found',
    })
    expect((await stories.ownDrafts(leela, instance))[0].rejection).toBeUndefined()
  })
})

describe('review', () => {
  it('gives the newest version in plain parts: text, tags with labels, range, member, instance', async () => {
    await saved(draft({ values: [topic(FERRY), topic(BOAT)] }))
    expect(await stories.review(operator, storyId(1))).toEqual({
      id: storyId(1),
      reviewState: 'draft',
      pendingRevision: false,
      member: { id: leela.memberId, nickname: 'Leela' },
      created: T0,
      modified: T0,
      start: 42,
      end: 51,
      texts: [{ value: 'My grandmother sang this on the ferry.', language: 'ml' }],
      media: [],
      replies: 0,
      values: [
        {
          property: SUBJECT,
          purpose: 'tagging',
          text: 'Ferry',
          language: 'en',
          object: { iri: FERRY },
        },
        {
          property: SUBJECT,
          purpose: 'tagging',
          text: 'Boat',
          language: 'en',
          object: { iri: BOAT },
        },
      ],
      project: { slug: PROJECT, name: 'River Voices' },
      recording: { id: '1', title: 'Ferry crossing, 1962', url: 'https://media.example/ferry.mp3' },
    })
  })

  it('reports a pending revision and a rejection; null for an unknown story; operator only', async () => {
    await publishDraft(stories, draft())
    const [own] = await stories.ownDrafts(leela, instance)
    await stories.saveDraft(leela, { ...draft({ end: 60 }), ifMatch: own.etag })
    await stories.reject(operator, storyId(1), 'Too long.')
    expect(await stories.review(operator, storyId(1))).toMatchObject({
      reviewState: 'draft',
      pendingRevision: true,
      end: 60,
      rejection: { reason: 'Too long.', at: T0 },
    })
    expect(await stories.review(operator, storyId(9))).toBeNull()
    await expect(stories.review({ operatorId: '' }, storyId(1))).rejects.toMatchObject({
      code: 'forbidden',
    })
  })
})

describe('counts and valueCounts', () => {
  it('projectReach: the recordings with stories and the members; leaveOut skips test members', async () => {
    await saved(draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), start: 1, end: 2 }))
    const byRavi = await stories.saveDraft(ravi, draft({ id: storyId(3), start: 3, end: 4 }))
    expect(byRavi.ok).toBe(true)
    expect(await stories.projectReach(PROJECT)).toEqual({
      recordings: [{ id: '1', stories: 3 }],
      members: 2,
    })
    expect(await stories.projectReach(PROJECT, { leaveOut: [ravi.memberId] })).toEqual({
      recordings: [{ id: '1', stories: 3 }],
      members: 1,
    })
  })

  it('count the stories of one recording by review state', async () => {
    await publishDraft(stories, draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), start: 1, end: 2 }))
    await saved(draft({ id: storyId(3), recording: '2', start: 1, end: 2 }))
    await stories.reject(operator, storyId(3), 'No.')
    expect(await stories.counts({ recording: '1' })).toMatchObject(
      tallies({ waiting: [1, 0], published: [1, 0] }),
    )
    expect(await stories.counts({ recording: '2' })).toMatchObject(tallies({ returned: [1, 0] }))
    expect(await stories.counts()).toMatchObject(
      tallies({ waiting: [1, 0], returned: [1, 0], published: [1, 0] }),
    )
  })

  it('count each concept once per story, in drafts and published versions', async () => {
    await publishDraft(stories, draft({ id: storyId(1), values: [topic(FERRY), topic(BOAT)] }))
    await saved(draft({ id: storyId(2), start: 1, end: 2, values: [topic(FERRY)] }))
    // A newer draft without BOAT: the published version still uses it.
    const own = (await stories.ownDrafts(leela, instance)).find((s) => s.id === storyId(1))!
    await stories.saveDraft(leela, {
      ...draft({ id: storyId(1), values: [topic(FERRY)] }),
      ifMatch: own.etag,
    })
    expect(Object.fromEntries(await stories.valueCounts(PROJECT))).toEqual({
      [FERRY]: 2,
      [BOAT]: 1,
    })
    expect((await stories.valueCounts('hill-songs')).size).toBe(0)
  })
})

describe('review rule publish-at-once', () => {
  it('saveDraft publishes at once, and visitors see the story', async () => {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { reviewRule: 'publish-at-once' },
    })

    const result = await saved()
    expect(result.reviewState).toBe('published')
    const container = await readJson(stories, CONTAINER)
    expect(container.first.items.map((item: { id: string }) => item.id)).toEqual([
      `${ORIGIN}${CONTAINER}${storyId(1)}`,
    ])
    // The ETag of the result still fits the next save.
    const next = await stories.saveDraft(leela, { ...draft({ end: 55 }), ifMatch: result.etag })
    expect(next).toMatchObject({ ok: true, reviewState: 'published' })
  })

  it('the default rule keeps a new story as a draft', async () => {
    expect((await saved()).reviewState).toBe('draft')
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
  })
})
