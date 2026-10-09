// @vitest-environment node
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Annotation, DraftInput, OperatorSession, SaveError, Stories } from '@/modules/stories'

import {
  BOAT,
  CONTAINER,
  FERRY,
  GOAT,
  ORIGIN,
  PROJECT,
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
} from './world'

let payload: Payload
let stories: Stories
const instance = { project: PROJECT, recording: '1' }
const storyPath = (n: number) => `${CONTAINER}${storyId(n)}`

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
})

async function saved(input = draft(), session = leela) {
  const result = await stories.saveDraft(session, input)
  if (!result.ok) throw new Error(`saveDraft failed: ${JSON.stringify(result.error)}`)
  return result
}

async function collect(iterable: AsyncIterable<Annotation>) {
  const out: Annotation[] = []
  for await (const item of iterable) out.push(item)
  return out
}

describe('saveDraft', () => {
  it('first save creates a draft and returns its IRI and ETag', async () => {
    const result = await stories.saveDraft(leela, draft())
    expect(result).toEqual({
      ok: true,
      id: storyId(1),
      iri: `${ORIGIN}${storyPath(1)}`,
      etag: expect.stringMatching(/^"[A-Za-z0-9_-]{43}"$/),
      reviewState: 'draft',
    })
  })

  it('second save with the same id updates the draft and returns a new ETag', async () => {
    const first = await saved()
    const second = await saved(draft({ start: 10, ifMatch: first.etag }))
    expect(second.etag).not.toBe(first.etag)
    const own = await stories.ownDrafts(leela, instance)
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ start: 10, etag: second.etag })
  })

  it('same id and same input twice gives one story and the same ETag', async () => {
    const at = manualClock()
    const writer = makeStories(payload, { now: at.now })
    const first = await writer.saveDraft(leela, draft())
    at.advance(5)
    const second = await writer.saveDraft(leela, draft())
    expect(second).toEqual(first)
    expect(await writer.ownDrafts(leela, instance)).toHaveLength(1)
  })

  it('save with a stale ifMatch returns stale with the current ETag', async () => {
    const first = await saved()
    const second = await saved(draft({ start: 10, ifMatch: first.etag }))
    const late = await stories.saveDraft(leela, draft({ start: 20, ifMatch: first.etag }))
    expect(late).toEqual({ ok: false, error: { code: 'stale', etag: second.etag } })
    const missing = await stories.saveDraft(leela, draft({ start: 20 }))
    expect(missing).toEqual({ ok: false, error: { code: 'stale', etag: second.etag } })
  })

  it("save with another member's id returns not-owner", async () => {
    const first = await saved()
    const result = await stories.saveDraft(ravi, draft({ start: 1, ifMatch: first.etag }))
    expect(result).toEqual({ ok: false, error: { code: 'not-owner' } })
  })

  it('save that changes the project or the recording returns instance-changed', async () => {
    const first = await saved()
    for (const change of [{ recording: '2' }, { project: 'hill-songs', tags: [] }]) {
      const result = await stories.saveDraft(leela, draft({ ...change, ifMatch: first.etag }))
      expect(result).toEqual({ ok: false, error: { code: 'instance-changed' } })
    }
  })

  it('unknown project or recording returns unknown-instance', async () => {
    for (const change of [{ project: 'nowhere' }, { recording: '99' }, { recording: 'rec' }]) {
      const result = await stories.saveDraft(leela, draft(change))
      expect(result).toEqual({ ok: false, error: { code: 'unknown-instance' } })
    }
  })

  it('end <= start, start < 0 and end > duration return invalid-range with the field', async () => {
    const cases = [
      [{ start: -1 }, 'start'],
      [{ start: Number.NaN }, 'start'],
      [{ start: 51, end: 51 }, 'end'],
      [{ start: 51, end: 50 }, 'end'],
      [{ end: 120.001 }, 'end'],
    ] as const
    for (const [change, field] of cases) {
      const result = await stories.saveDraft(leela, draft(change))
      expect(result, JSON.stringify(change)).toEqual({
        ok: false,
        error: { code: 'invalid-range', field },
      })
    }
    // Recording 2 has no duration, so only the order of start and end counts.
    expect((await stories.saveDraft(leela, draft({ recording: '2', end: 9999 }))).ok).toBe(true)
  })

  it('zero bodies or an empty text returns no-body; too many bodies or tags are refused', async () => {
    const small = makeStories(payload, { limits: { bodies: 2, tags: 1 } })
    const text = (value: string) => ({ kind: 'text' as const, value })
    const cases: [Partial<DraftInput>, SaveError][] = [
      [{ bodies: [] }, { code: 'no-body' }],
      [{ bodies: [text('  ')] }, { code: 'no-body' }],
      [{ bodies: [text('a'), text('b'), text('c')] }, { code: 'too-many-bodies' }],
      [{ tags: [FERRY, BOAT] }, { code: 'too-many-tags' }],
    ]
    for (const [change, error] of cases) {
      expect(await small.saveDraft(leela, draft(change))).toEqual({ ok: false, error })
    }
  })

  it('text over the limit returns text-too-long with the index', async () => {
    const small = makeStories(payload, { limits: { text: 5 } })
    const result = await small.saveDraft(
      leela,
      draft({
        bodies: [
          { kind: 'text', value: 'ഫെറി' },
          { kind: 'text', value: 'sixsix' },
        ],
      }),
    )
    expect(result).toEqual({ ok: false, error: { code: 'text-too-long', index: 1 } })
  })

  it('media id that the media module does not know returns unknown-media', async () => {
    const result = await stories.saveDraft(
      leela,
      draft({
        bodies: [
          { kind: 'text', value: 'Listen.' },
          { kind: 'sound', media: 'm-1' },
        ],
      }),
    )
    expect(result).toEqual({ ok: false, error: { code: 'unknown-media', index: 1 } })
  })

  it("concept from another project's vocabulary returns unknown-concept", async () => {
    const result = await stories.saveDraft(leela, draft({ tags: [FERRY, GOAT] }))
    expect(result).toEqual({ ok: false, error: { code: 'unknown-concept', iri: GOAT } })
  })

  it('text body with HTML is stored and served as plain text', async () => {
    const value = '<img src=x onerror=alert(1)> & "quotes"'
    await publishDraft(stories, draft({ bodies: [{ kind: 'text', value, language: 'en' }] }))
    const body = await readJson(stories, storyPath(1))
    expect(body.body[0]).toEqual({
      type: 'TextualBody',
      value,
      format: 'text/plain',
      language: 'en',
    })
  })
})

describe('ownDrafts', () => {
  it("returns only the caller's stories in the instance, with the input that refills the form", async () => {
    await saved(draft({ id: storyId(1), tags: [FERRY, BOAT] }))
    await saved(draft({ id: storyId(2) }), ravi)
    await saved(draft({ id: storyId(3), recording: '2' }))
    const own = await stories.ownDrafts(leela, instance)
    expect(own).toEqual([
      {
        id: storyId(1),
        iri: `${ORIGIN}${storyPath(1)}`,
        etag: expect.any(String),
        reviewState: 'draft',
        pendingRevision: false,
        start: 42,
        end: 51,
        bodies: [{ kind: 'text', value: 'My grandmother sang this on the ferry.', language: 'ml' }],
        tags: [FERRY, BOAT],
      },
    ])
    expect(await stories.ownDrafts(ravi, { project: PROJECT, recording: '2' })).toEqual([])
  })

  it('reports pendingRevision when a published story has a newer draft', async () => {
    await publishDraft(stories, draft())
    const [published] = await stories.ownDrafts(leela, instance)
    expect(published).toMatchObject({ reviewState: 'published', pendingRevision: false })

    await saved(draft({ start: 10, ifMatch: published.etag }))
    const [revised] = await stories.ownDrafts(leela, instance)
    expect(revised).toMatchObject({ reviewState: 'draft', pendingRevision: true, start: 10 })
  })
})

describe('review', () => {
  it('publish makes the story appear in the container read that follows', async () => {
    await saved()
    const before = await read(stories, CONTAINER)
    await stories.publish(operator, storyId(1))
    const after = await read(stories, CONTAINER)
    expect(after.headers.get('ETag')).not.toBe(before.headers.get('ETag'))
    expect((await after.json()).first.items[0].id).toBe(`${ORIGIN}${storyPath(1)}`)
    expect((await read(stories, storyPath(1))).status).toBe(200)
  })

  it('a return of a published story removes it from the container read that follows', async () => {
    await publishDraft(stories, draft())
    await stories.reject(operator, storyId(1), 'A visitor reported it.')
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    expect((await read(stories, storyPath(1))).status).toBe(404)
    expect((await read(stories, `${CONTAINER}?page=0`)).status).toBe(404)
  })

  // Amendment 5: a Payload draft save leaves the published version unchanged.
  it('published story stays unchanged in reads while its member saves a new draft', async () => {
    await publishDraft(stories, draft())
    const story = await read(stories, storyPath(1))
    const container = await read(stories, CONTAINER)
    const [own] = await stories.ownDrafts(leela, instance)
    const revision = draft({ bodies: [{ kind: 'text', value: 'A new text.' }], ifMatch: own.etag })
    expect((await stories.saveDraft(leela, revision)).ok).toBe(true)

    const storyAfter = await read(stories, storyPath(1))
    expect(await storyAfter.text()).toBe(await story.text())
    expect(storyAfter.headers.get('ETag')).toBe(story.headers.get('ETag'))
    expect((await read(stories, CONTAINER)).headers.get('ETag')).toBe(container.headers.get('ETag'))
    const [exported] = await collect(stories.exportStories(operator, { reviewState: 'published' }))
    expect(exported.body[0]).toMatchObject({ value: 'My grandmother sang this on the ferry.' })

    // The next publish shows the new text.
    await stories.publish(operator, storyId(1))
    const published = await readJson(stories, storyPath(1))
    expect(published.body[0]).toMatchObject({ value: 'A new text.' })
  })

  it('publish through the Payload local API gives the same container bytes as publish()', async () => {
    await publishDraft(stories, draft())
    const byFunction = await (await read(stories, CONTAINER)).text()
    await seed(payload)
    await saved()
    // The admin Publish button makes this update.
    await payload.update({ collection: 'stories', id: storyId(1), data: { _status: 'published' } })
    expect(await (await read(stories, CONTAINER)).text()).toBe(byFunction)
  })

  it('delete of a published story in the admin removes it from the container', async () => {
    await publishDraft(stories, draft())
    await payload.delete({ collection: 'stories', id: storyId(1) })
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
    expect((await read(stories, storyPath(1))).status).toBe(404)
  })

  it('two concurrent publishes in one instance give a container with both stories', async () => {
    await saved(draft({ id: storyId(1) }))
    await saved(draft({ id: storyId(2) }))
    await Promise.all([
      stories.publish(operator, storyId(1)),
      stories.publish(operator, storyId(2)),
    ])
    expect((await readJson(stories, CONTAINER)).total).toBe(2)
  })

  it('publish by a member session throws forbidden; an unknown id throws not-found', async () => {
    await saved()
    const member = leela as unknown as OperatorSession
    await expect(stories.publish(member, storyId(1))).rejects.toMatchObject({
      name: 'StoriesError',
      code: 'forbidden',
    })
    await expect(stories.remove(operator, storyId(9))).rejects.toMatchObject({
      name: 'StoriesError',
      code: 'not-found',
    })
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
  })
})

describe('coupling and export', () => {
  it('conceptChanged updates the tag label in every published story that uses the concept', async () => {
    await publishDraft(stories, draft({ id: storyId(1) }))
    await publishDraft(stories, draft({ id: storyId(2), start: 1, end: 2, tags: [FERRY, BOAT] }))
    const { docs } = await payload.find({
      collection: 'concepts',
      where: { iri: { equals: FERRY } },
    })
    await payload.update({ collection: 'concepts', id: docs[0].id, data: { label: 'Ferry boat' } })
    await stories.conceptChanged(FERRY)

    const container = await readJson(stories, CONTAINER)
    const labels = container.first.items.map((item: Annotation) =>
      item.body.filter((body) => 'purpose' in body && body.type === 'TextualBody'),
    )
    expect(labels).toEqual([
      [
        { type: 'TextualBody', value: 'Ferry boat', purpose: 'tagging', language: 'en' },
        { type: 'TextualBody', value: 'Boat', purpose: 'tagging', language: 'en' },
      ],
      [{ type: 'TextualBody', value: 'Ferry boat', purpose: 'tagging', language: 'en' }],
    ])
    expect((await readJson(stories, storyPath(1))).body[2].value).toBe('Ferry boat')
  })

  it('exportStories with reviewState published yields only published stories in id order', async () => {
    await publishDraft(stories, draft({ id: storyId(3), start: 1, end: 2 }))
    await publishDraft(stories, draft({ id: storyId(1), start: 5, end: 6 }))
    await saved(draft({ id: storyId(2) }))
    const ids = (await collect(stories.exportStories(operator))).map((story) => story.id)
    expect(ids).toEqual([storyId(1), storyId(3)].map((id) => `${ORIGIN}${CONTAINER}${id}`))
    const drafts = await collect(stories.exportStories(operator, { reviewState: 'draft' }))
    expect(drafts.map((story) => story.id)).toEqual([`${ORIGIN}${storyPath(2)}`])
    const other = await collect(stories.exportStories(operator, { project: 'hill-songs' }))
    expect(other).toEqual([])
  })

  it('exportStories yields the same WADM as the single-story GET', async () => {
    await publishDraft(stories, draft())
    const [exported] = await collect(stories.exportStories(operator))
    expect(JSON.stringify(exported)).toBe(await (await read(stories, storyPath(1))).text())
  })

  it('exportStories by a member session throws forbidden', async () => {
    const member = leela as unknown as OperatorSession
    await expect(collect(stories.exportStories(member))).rejects.toMatchObject({
      code: 'forbidden',
    })
  })
})

describe('toldOn: the host page of the story', () => {
  const page = 'https://rivervoices.example.org/ferry?part=2'

  beforeEach(async () => {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { slug: { equals: PROJECT } },
    })
    await payload.update({
      collection: 'projects',
      id: docs[0].id,
      data: { siteOrigins: [{ origin: 'https://rivervoices.example.org' }] },
    })
  })

  it('keeps a return URL on a site of the project; operators and the member see it, WADM never has it', async () => {
    await saved(draft({ toldOn: `${page}#annoudio-t=4` }))
    expect((await stories.ownDrafts(leela, instance))[0].toldOn).toBe(page)
    expect((await stories.review(operator, storyId(1)))?.toldOn).toBe(page)

    await stories.publish(operator, storyId(1))
    const served = JSON.stringify(await readJson(stories, CONTAINER))
    expect(served).not.toContain('rivervoices.example.org')
    const exported = JSON.stringify(await collect(stories.exportStories(operator)))
    expect(exported).not.toContain('rivervoices.example.org')
  })

  it('drops a return URL on another origin, and a later save without one keeps the earlier value', async () => {
    await saved(draft({ toldOn: 'https://evil.example/x' }))
    expect((await stories.ownDrafts(leela, instance))[0].toldOn).toBeUndefined()

    await saved({
      ...draft({ toldOn: page }),
      ifMatch: (await stories.ownDrafts(leela, instance))[0].etag,
    })
    const [own] = await stories.ownDrafts(leela, instance)
    expect(own.toldOn).toBe(page)
    await saved({ ...draft({ start: 40, toldOn: null }), ifMatch: own.etag })
    expect((await stories.ownDrafts(leela, instance))[0].toldOn).toBe(page)
  })
})
