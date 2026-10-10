// @vitest-environment node
// Replies (Phase 5b): a story whose target is the IRI of a published story of the same
// instance. All through the module interface.

import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { DraftInput, Stories } from '@/modules/stories'

import {
  CONTAINER,
  FERRY,
  ORIGIN,
  PROJECT,
  T0,
  draft,
  leela,
  makeStories,
  manualClock,
  operator,
  publishDraft,
  ravi,
  read,
  readJson,
  seed,
  startPayload,
  storyId,
  topic,
  tallies,
} from './world'

const ANNO = 'http://www.w3.org/ns/anno.jsonld'
const LDP = 'http://www.w3.org/ns/ldp.jsonld'
const EXTENSION = { 'annoudio:replies': { '@reverse': 'oa:hasTarget' } }
const PARENT = storyId(1)
const PARENT_IRI = `${ORIGIN}${CONTAINER}${PARENT}`
const instance = { project: PROJECT, recording: '1' }

let payload: Payload
let stories: Stories
let clock: ReturnType<typeof manualClock>

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  clock = manualClock()
  stories = makeStories(payload, { now: clock.now })
})

/** A reply input: no range, no tags. */
function reply(n: number, overrides: Partial<DraftInput> = {}): DraftInput {
  return {
    id: storyId(n),
    project: PROJECT,
    recording: '1',
    replyTo: PARENT,
    bodies: [{ kind: 'text', value: `Reply number ${n}.` }],
    ...overrides,
  }
}

async function saved(input: DraftInput, session = ravi) {
  const result = await stories.saveDraft(session, input)
  if (!result.ok) throw new Error(`saveDraft failed: ${JSON.stringify(result.error)}`)
  return result
}

/** The published parent story (Leela) and two published replies (Ravi), one second apart. */
async function thread() {
  await publishDraft(stories, draft())
  for (const n of [3, 2]) {
    clock.advance(1)
    await publishDraft(stories, reply(n), ravi)
  }
}

/** The WADM of reply `n`, as `buildAnnotation` makes it, at the time `created`. */
function replyAnnotation(n: number, created: string) {
  return {
    '@context': ANNO,
    id: `${ORIGIN}${CONTAINER}${storyId(n)}`,
    type: 'Annotation',
    motivation: 'replying',
    created,
    modified: created,
    creator: { id: `${ORIGIN}/members/${ravi.memberId}`, type: 'Person', nickname: 'Ravi' },
    rights: 'https://creativecommons.org/licenses/by-nc/4.0/',
    body: [
      { type: 'TextualBody', value: `Reply number ${n}.`, format: 'text/plain', language: 'ml' },
    ],
    target: PARENT_IRI,
  }
}

const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString()
const withoutContext = ({ '@context': _context, ...item }: Record<string, unknown>) => item

describe('saveDraft with replyTo', () => {
  it('stores a WADM reply: motivation replying, the parent IRI as a plain target, no scope', async () => {
    await publishDraft(stories, draft())
    const result = await saved(reply(2))
    expect(result).toEqual({
      ok: true,
      id: storyId(2),
      iri: `${ORIGIN}${CONTAINER}${storyId(2)}`,
      etag: expect.stringMatching(/^"[A-Za-z0-9_-]{43}"$/),
      reviewState: 'draft',
    })
    const stored = await payload.findByID({ collection: 'stories', id: storyId(2), draft: true })
    expect(stored.wadm).toEqual(replyAnnotation(2, T0))
    expect(stored).toMatchObject({ project: PROJECT, recording: '1', start: null, end: null })
  })

  it('refuses a reply with a time range or with values', async () => {
    await publishDraft(stories, draft())
    expect(await stories.saveDraft(ravi, reply(2, { start: 1, end: 2 }))).toEqual({
      ok: false,
      error: { code: 'reply-and-range' },
    })
    expect(await stories.saveDraft(ravi, reply(2, { end: 2 }))).toEqual({
      ok: false,
      error: { code: 'reply-and-range' },
    })
    expect(await stories.saveDraft(ravi, reply(2, { values: [topic(FERRY)] }))).toEqual({
      ok: false,
      error: { code: 'reply-and-values' },
    })
  })

  it('refuses a parent that is unknown, a draft, or in a different instance: unknown-parent', async () => {
    await saved(draft(), leela) // a draft parent
    await publishDraft(stories, draft({ id: storyId(5), recording: '2', start: 1, end: 2 }))
    for (const replyTo of [PARENT, storyId(9), storyId(5), 'not-an-id']) {
      expect(await stories.saveDraft(ravi, reply(2, { replyTo }))).toEqual({
        ok: false,
        error: { code: 'unknown-parent' },
      })
    }
  })

  it('refuses a reply to a reply: reply-depth', async () => {
    await thread()
    expect(await stories.saveDraft(leela, reply(4, { replyTo: storyId(2) }))).toEqual({
      ok: false,
      error: { code: 'reply-depth' },
    })
  })

  it('needs a text body, and takes the other body rules of a story', async () => {
    await publishDraft(stories, draft())
    expect(await stories.saveDraft(ravi, reply(2, { bodies: [] }))).toEqual({
      ok: false,
      error: { code: 'no-body' },
    })
    expect(
      await stories.saveDraft(ravi, reply(2, { bodies: [{ kind: 'sound', media: 'nope' }] })),
    ).toEqual({ ok: false, error: { code: 'media-needs-text' } })
  })

  it('a story never becomes a reply, and a reply never moves to a different story', async () => {
    await publishDraft(stories, draft())
    await publishDraft(stories, draft({ id: storyId(4), start: 60, end: 70 }))
    const first = await saved(reply(2))
    const moved = await stories.saveDraft(
      ravi,
      reply(2, { replyTo: storyId(4), ifMatch: first.etag }),
    )
    expect(moved).toEqual({ ok: false, error: { code: 'instance-changed' } })
    const story = await stories.saveDraft(ravi, {
      ...draft({ id: storyId(2) }),
      ifMatch: first.etag,
    })
    expect(story).toEqual({ ok: false, error: { code: 'instance-changed' } })
    const own = (await stories.ownDrafts(leela, instance)).find((s) => s.id === PARENT)!
    const toReply = await stories.saveDraft(
      leela,
      reply(1, { replyTo: storyId(4), ifMatch: own.etag }),
    )
    expect(toReply).toEqual({ ok: false, error: { code: 'instance-changed' } })
  })

  it('the project rule publish-at-once publishes a reply at once', async () => {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { reviewRule: 'publish-at-once' },
    })
    await saved(draft(), leela)
    expect((await saved(reply(2))).reviewState).toBe('published')
    const container = await readJson(stories, CONTAINER)
    expect(container.first.items[0]['annoudio:replies']).toHaveLength(1)
  })
})

describe('the container serves replies inside the item of their story', () => {
  it('embeds the published replies in created order, each a complete WADM annotation', async () => {
    await thread()
    const container = await readJson(stories, CONTAINER)
    expect(container['@context']).toEqual([ANNO, LDP, EXTENSION])
    expect(container.total).toBe(1)
    expect(container.modified).toBe(at(2))
    const [item] = container.first.items
    expect(item.id).toBe(PARENT_IRI)
    expect(item.motivation).toBe('commenting')
    expect(item['annoudio:replies']).toEqual([
      withoutContext(replyAnnotation(3, at(1))),
      withoutContext(replyAnnotation(2, at(2))),
    ])

    const page = await readJson(stories, `${CONTAINER}?page=0`)
    expect(page['@context']).toEqual([ANNO, EXTENSION])
    expect(page.items).toEqual(container.first.items)
  })

  it('keeps the plain context on a page with no replies, and IRI pages list the stories only', async () => {
    await publishDraft(stories, draft())
    expect((await readJson(stories, CONTAINER))['@context']).toEqual([ANNO, LDP])
    expect((await readJson(stories, `${CONTAINER}?page=0`))['@context']).toBe(ANNO)

    clock.advance(1)
    await publishDraft(stories, reply(2), ravi)
    const iris = await readJson(stories, `${CONTAINER}?iris=1`)
    expect(iris['@context']).toEqual([ANNO, LDP])
    expect(iris.first.items).toEqual([PARENT_IRI])
    const minimal = await readJson(stories, CONTAINER, {
      headers: {
        Prefer: 'return=representation; include="http://www.w3.org/ns/ldp#PreferMinimalContainer"',
      },
    })
    expect(minimal['@context']).toEqual([ANNO, LDP])
  })

  it('serves each published reply at its own IRI, and the parent story without replies', async () => {
    await thread()
    const response = await read(stories, `${CONTAINER}${storyId(2)}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(JSON.stringify(replyAnnotation(2, at(2))))
    const parent = await readJson(stories, `${CONTAINER}${PARENT}`)
    expect(parent).not.toHaveProperty('annoudio:replies')
    expect(parent['@context']).toBe(ANNO)
  })

  it('never serves a draft reply', async () => {
    await publishDraft(stories, draft())
    await saved(reply(2))
    expect((await read(stories, `${CONTAINER}${storyId(2)}`)).status).toBe(404)
    const [item] = (await readJson(stories, CONTAINER)).first.items
    expect(item).not.toHaveProperty('annoudio:replies')
  })

  it('a publish of a reply changes the container and page ETags, not the ETag of the parent', async () => {
    await publishDraft(stories, draft())
    const etags = async () =>
      Promise.all(
        [CONTAINER, `${CONTAINER}?page=0`, `${CONTAINER}${PARENT}`].map(async (path) =>
          (await read(stories, path)).headers.get('ETag'),
        ),
      )
    const before = await etags()
    await saved(reply(2))
    expect(await etags()).toEqual(before) // a draft changes nothing
    await stories.publish(operator, storyId(2))
    const after = await etags()
    expect(after[0]).not.toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(after[2]).toBe(before[2])

    await stories.reject(operator, storyId(2), 'Please be kind.')
    expect(await etags()).toEqual(before)
  })

  it('hides the replies of a story that is not published, and shows them again after a publish', async () => {
    await thread()
    await stories.reject(operator, PARENT, 'A visitor reported it.')
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    expect((await read(stories, `${CONTAINER}${storyId(2)}`)).status).toBe(404)
    // The replies keep their review state; the story is returned to its member.
    expect(await stories.counts()).toMatchObject(tallies({ returned: [1, 0], published: [0, 2] }))

    await stories.publish(operator, PARENT)
    const [item] = (await readJson(stories, CONTAINER)).first.items
    expect(item['annoudio:replies']).toHaveLength(2)
  })

  it('a reject of a published reply takes it out of the page', async () => {
    await thread()
    await stories.reject(operator, storyId(2), 'Please be kind.')
    const [item] = (await readJson(stories, CONTAINER)).first.items
    expect(item['annoudio:replies'].map((r: { id: string }) => r.id)).toEqual([
      `${ORIGIN}${CONTAINER}${storyId(3)}`,
    ])
    const own = (await stories.ownDrafts(ravi, instance)).find((s) => s.id === storyId(2))
    expect(own).toMatchObject({ reviewState: 'draft', rejection: { reason: 'Please be kind.' } })
  })
})

describe('the member and operator reads of a reply', () => {
  it('ownDrafts gives a reply with replyTo and no range, after the stories', async () => {
    await publishDraft(stories, draft({ id: storyId(7), start: 60, end: 70 }), ravi)
    await publishDraft(stories, draft())
    await saved(reply(2))
    const own = await stories.ownDrafts(ravi, instance)
    expect(own.map((s) => s.id)).toEqual([storyId(7), storyId(2)])
    expect(own[1]).toEqual({
      id: storyId(2),
      iri: `${ORIGIN}${CONTAINER}${storyId(2)}`,
      etag: expect.any(String),
      reviewState: 'draft',
      pendingRevision: false,
      modified: expect.any(String),
      replyTo: PARENT,
      bodies: [{ kind: 'text', value: 'Reply number 2.', language: 'ml' }],
      values: [],
    })
    // The ETag fits the next save.
    const next = await stories.saveDraft(ravi, {
      ...reply(2, { bodies: [{ kind: 'text', value: 'A better reply.' }] }),
      ifMatch: own[1].etag,
    })
    expect(next.ok).toBe(true)
  })

  it('review gives the excerpt and the nickname of the parent; the queue counts the reply', async () => {
    await publishDraft(stories, draft())
    await saved(reply(2))
    expect(await stories.counts()).toMatchObject(tallies({ waiting: [0, 1], published: [1, 0] }))
    const review = await stories.review(operator, storyId(2))
    expect(review).toMatchObject({
      id: storyId(2),
      reviewState: 'draft',
      replyTo: { id: PARENT, excerpt: 'My grandmother sang this on the ferry.', nickname: 'Leela' },
      texts: [{ value: 'Reply number 2.', language: 'ml' }],
      values: [],
    })
    expect(review).not.toHaveProperty('start')
  })

  it('publishedStory gives a published story of the instance, and null for anything else', async () => {
    await thread()
    expect(await stories.publishedStory(instance, PARENT)).toEqual({
      id: PARENT,
      nickname: 'Leela',
      start: 42,
      end: 51,
      texts: [{ value: 'My grandmother sang this on the ferry.', language: 'ml' }],
    })
    await saved(draft({ id: storyId(8), start: 1, end: 2 }), leela)
    for (const [where, id] of [
      [instance, storyId(2)], // a reply
      [instance, storyId(8)], // a draft
      [instance, storyId(9)], // no story
      [{ project: PROJECT, recording: '2' }, PARENT], // a different instance
    ] as const) {
      expect(await stories.publishedStory(where, id)).toBeNull()
    }
  })
})
