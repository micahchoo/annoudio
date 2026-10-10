// @vitest-environment node
// The one story lifecycle (design/ia.md §2.1) at the `stories` interface: `lifecycle` of
// what `ownDrafts` and `review` give, for each stored state, the change states of a
// published story and a reply; `counts` agrees. Then every input of `lifecycle`.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  lifecycle,
  type Lifecycle,
  type LifecycleRow,
  type MediaState,
  type Stories,
} from '@/modules/stories'

import {
  PROJECT,
  draft,
  leela,
  makeStories,
  operator,
  publishDraft,
  ravi,
  seed,
  startPayload,
  storyId,
  tallies,
} from './world'

let payload: Payload
let stories: Stories
const instance = { project: PROJECT, recording: '1' }
const PHOTO_ID = '0192f3a4-aa01-7000-8000-00000000f001'

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  const db = payload.db as unknown as PostgresAdapter
  await db.drizzle.execute(sql`truncate media cascade`)
  stories = makeStories(payload)
})

/** A photo of Leela, in the state that the worker would give it. */
async function photo(state: 'uploaded' | 'ready' | 'failed') {
  const exists = await payload.findByID({
    collection: 'media',
    id: PHOTO_ID,
    depth: 0,
    disableErrors: true,
  })
  const data = { state, ...(state === 'ready' ? { derived: `derived/${PHOTO_ID}.jpg` } : {}) }
  if (exists) await payload.update({ collection: 'media', id: PHOTO_ID, data, depth: 0 })
  else {
    await payload.create({
      collection: 'media',
      data: {
        id: PHOTO_ID,
        member: leela.memberId,
        kind: 'image',
        size: 100,
        raw: `raw/${PHOTO_ID}.jpg`,
        format: 'image/jpeg',
        ...data,
      },
    })
  }
}

const withPhoto = (overrides = {}) =>
  draft({
    bodies: [
      { kind: 'text', value: 'The ferry at dawn.' },
      { kind: 'image', media: PHOTO_ID },
    ],
    ...overrides,
  })

async function saved(input = draft(), session = leela) {
  const result = await stories.saveDraft(session, input)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
}

/** The lifecycle of story `n` as the member sees it and as the operator sees it. */
async function both(n: number, session = leela): Promise<Lifecycle> {
  const own = (await stories.ownDrafts(session, instance)).find((s) => s.id === storyId(n))!
  const review = (await stories.review(operator, storyId(n)))!
  expect(lifecycle(review)).toEqual(lifecycle(own))
  return lifecycle(own)
}

const state = (
  value: Lifecycle['state'],
  change: Lifecycle['change'] = null,
  automatic = false,
): Lifecycle => ({ state: value, change, automatic })

describe('lifecycle of stored stories', () => {
  it('Waiting for review: a draft that nobody returned, with no media body', async () => {
    await saved()
    expect(await both(1)).toEqual(state('waiting'))
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [1, 0] }))
  })

  it('Processing: a draft whose photo is not ready; then Waiting when it is ready', async () => {
    await photo('uploaded')
    await saved(withPhoto())
    expect(await both(1)).toEqual(state('processing'))
    expect(await stories.counts()).toMatchObject(tallies({ processing: [1, 0] }))
    await photo('ready')
    expect(await both(1)).toEqual(state('waiting'))
  })

  it('Returned: an operator returned the draft', async () => {
    await saved()
    await stories.reject(operator, storyId(1), 'Please remove the full name.')
    expect(await both(1)).toEqual(state('returned'))
    expect(await stories.counts()).toMatchObject(tallies({ returned: [1, 0] }))
  })

  it('Returned (automatic): the photo failed', async () => {
    await photo('uploaded')
    await saved(withPhoto())
    await photo('failed')
    expect(await both(1)).toEqual(state('returned', null, true))
    // `counts` reads the rejection that the consumer writes: actions.int.spec.ts.
  })

  it('Published: visitors see it, and no newer draft waits', async () => {
    await publishDraft(stories, draft())
    expect(await both(1)).toEqual(state('published'))
    expect(await stories.counts()).toMatchObject(tallies({ published: [1, 0] }))
  })

  it('Published · change waiting: the change has its own state (waiting, processing, returned)', async () => {
    await publishDraft(stories, draft())
    const etag = async () => (await stories.ownDrafts(leela, instance))[0].etag
    await saved({ ...draft({ start: 40 }), ifMatch: await etag() })
    expect(await both(1)).toEqual(state('published', 'waiting'))
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [1, 0], published: [1, 0] }))

    await photo('uploaded')
    await saved({ ...withPhoto({ start: 40 }), ifMatch: await etag() })
    expect(await both(1)).toEqual(state('published', 'processing'))

    await stories.reject(operator, storyId(1), 'Keep the old time range.')
    expect(await both(1)).toEqual(state('published', 'returned'))
    expect(await stories.counts()).toMatchObject(tallies({ returned: [1, 0], published: [1, 0] }))
  })

  it('Returned, after a return of a published story with no newer draft: visitors stop seeing it', async () => {
    await publishDraft(stories, draft())
    await stories.reject(operator, storyId(1), 'A visitor reported it.')
    expect(await both(1)).toEqual(state('returned'))
    expect(await stories.counts()).toMatchObject(tallies({ returned: [1, 0] }))
  })

  it('a reply has the same states, and counts as a reply', async () => {
    await publishDraft(stories, draft())
    const reply = {
      id: storyId(2),
      project: PROJECT,
      recording: '1',
      replyTo: storyId(1),
      bodies: [{ kind: 'text' as const, value: 'My uncle steered that ferry.' }],
    }
    await saved(reply, ravi)
    expect(await both(2, ravi)).toEqual(state('waiting'))
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [0, 1], published: [1, 0] }))
    await stories.publish(operator, storyId(2))
    expect(await both(2, ravi)).toEqual(state('published'))
    expect(await stories.counts()).toMatchObject(tallies({ published: [1, 1] }))
  })

  it('counts of one member: the stories that the member page shows', async () => {
    await saved(draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), start: 1, end: 2 }), ravi)
    await stories.publish(operator, storyId(2))
    expect(await stories.counts({ member: leela.memberId })).toMatchObject(
      tallies({ waiting: [1, 0] }),
    )
    expect(await stories.counts({ member: ravi.memberId })).toMatchObject(
      tallies({ published: [1, 0] }),
    )
    expect(await stories.counts({ member: 'm-nobody' })).toMatchObject(tallies({}))
  })

  it('counts of one project and of one recording, and the age of the oldest waiting story', async () => {
    await saved(draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2), recording: '2', start: 1, end: 2 }))
    expect(await stories.counts({ project: PROJECT })).toMatchObject(tallies({ waiting: [2, 0] }))
    expect(await stories.counts({ project: 'hill-songs' })).toMatchObject(tallies({}))
    expect(await stories.counts({ recording: '2' })).toMatchObject(tallies({ waiting: [1, 0] }))
    const { oldestWaiting } = await stories.counts()
    expect(Date.parse(oldestWaiting!)).not.toBeNaN()
    await stories.publish(operator, storyId(1))
    await stories.publish(operator, storyId(2))
    expect((await stories.counts()).oldestWaiting).toBeNull()
  })
})

describe('Sent again, and the State column of the review list', () => {
  it('a change after a return waits "sent again"; a return or a publish clears it', async () => {
    await saved()
    await stories.reject(operator, storyId(1), 'Please say where the boat was.')
    const change = async (end: number) => {
      const [own] = await stories.ownDrafts(leela, instance)
      await saved({ ...draft({ end }), ifMatch: own.etag })
    }
    await change(50)
    expect(await both(1)).toEqual({ ...state('waiting'), again: true })
    expect((await stories.ownDrafts(leela, instance))[0].sentAgain).toBe(true)
    // A second change before the review: still sent again.
    await change(49)
    expect(await both(1)).toEqual({ ...state('waiting'), again: true })
    // A return: Returned, not sent again; the next change is sent again once more.
    await stories.reject(operator, storyId(1), 'And the year?')
    expect(await both(1)).toEqual(state('returned'))
    await change(48)
    expect(await both(1)).toEqual({ ...state('waiting'), again: true })
    await stories.publish(operator, storyId(1))
    expect(await both(1)).toEqual(state('published'))
    expect((await stories.ownDrafts(leela, instance))[0]).not.toHaveProperty('sentAgain')
    // A change to the published story is a change, not a story sent again.
    await change(47)
    expect(await both(1)).toEqual(state('published', 'waiting'))
  })

  it('every row of the operator list has its state, not only the first (recordings audit, 1)', async () => {
    await saved()
    await saved(draft({ id: storyId(2), start: 3, end: 4 }), ravi)
    await saved(draft({ id: storyId(3), start: 5, end: 6 }))
    await publishDraft(stories, draft({ id: storyId(4), start: 7, end: 8 }))
    const user = await payload.create({
      collection: 'users',
      data: { email: 'list-reader@example.org', password: 'list-reader-pass-1' },
    })
    const { docs } = await payload.find({
      collection: 'stories',
      draft: true,
      sort: 'createdAt',
      depth: 0,
      user: { ...user, collection: 'users' },
    })
    expect(docs.map((doc) => doc.lifecycle)).toEqual([
      state('waiting'),
      state('waiting'),
      state('waiting'),
      state('published'),
    ])
  })
})

describe('lifecycle of every input', () => {
  const rejections: (LifecycleRow['rejection'] | undefined)[] = [
    undefined,
    { automatic: false },
    { automatic: true },
  ]
  const media: (MediaState | undefined)[] = [undefined, 'ready', 'processing', 'failed']

  /** The rules of design/ia.md §2.1, written out once more. */
  function expected(row: LifecycleRow): Lifecycle {
    if (row.reviewState === 'published') return state('published')
    const draftState: [Lifecycle['change'], boolean] = row.rejection
      ? ['returned', row.rejection.automatic]
      : row.mediaState === 'failed'
        ? ['returned', true]
        : row.mediaState === 'processing'
          ? ['processing', false]
          : ['waiting', false]
    return row.pendingRevision
      ? state('published', draftState[0], draftState[1])
      : state(draftState[0]!, null, draftState[1])
  }

  for (const reviewState of ['draft', 'published'] as const) {
    // `pendingRevision` is true only for a draft.
    for (const pendingRevision of reviewState === 'draft' ? [false, true] : [false]) {
      for (const rejection of rejections) {
        for (const mediaState of media) {
          const row: LifecycleRow = {
            reviewState,
            pendingRevision,
            ...(rejection ? { rejection } : {}),
            ...(mediaState ? { mediaState } : {}),
          }
          it(JSON.stringify(row), () => {
            expect(lifecycle(row)).toEqual(expected(row))
          })
        }
      }
    }
  }
})
