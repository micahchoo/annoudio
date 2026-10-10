// @vitest-environment node
import { readFileSync } from 'node:fs'

import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Stories } from '@/modules/stories'

import {
  CONTAINER,
  FERRY,
  ORIGIN,
  draft,
  leela,
  makeStories,
  manualClock,
  operator,
  publishDraft,
  read,
  readJson,
  seed,
  startPayload,
  storyId,
} from './world'

const handWrittenText = readFileSync(new URL('./hand-written.wadm.json', import.meta.url), 'utf8')
const handWritten = JSON.parse(handWrittenText)
const HAND_WRITTEN_ID = '0192f3a4-7c1e-7b10-9d55-3e1f0a2b4c6d'
// The voice note of the hand-written record. A publish needs it ready.
const VOICE_NOTE = '0192f3a4-aa01-7000-8000-000000000001'
const CONTENT_TYPE = 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"'
const PREFER = (...iris: string[]) => ({
  Prefer: `return=representation;include="${iris.join(' ')}"`,
})
const MINIMAL = 'http://www.w3.org/ns/ldp#PreferMinimalContainer'
const IRIS = 'http://www.w3.org/ns/oa#PreferContainedIRIs'

let payload: Payload
let stories: Stories

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
})

describe('the hand-written record', () => {
  // The state that the worker's report gives to a transcoded voice note of Leela.
  beforeEach(async () => {
    await payload.delete({ collection: 'media', where: { id: { equals: VOICE_NOTE } } })
    await payload.create({
      collection: 'media',
      data: {
        id: VOICE_NOTE,
        member: 'm-118',
        kind: 'sound',
        state: 'ready',
        size: 1000,
        raw: `raw/${VOICE_NOTE}.webm`,
        derived: `derived/${VOICE_NOTE}.m4a`,
        format: 'audio/mp4',
      },
    })
  })

  // The admin GUI path: an operator stores the record in the stories collection.
  async function storeHandWritten() {
    await payload.create({
      collection: 'stories',
      data: { id: HAND_WRITTEN_ID, wadm: handWritten },
      draft: true,
    })
    await stories.publish(operator, HAND_WRITTEN_ID)
  }

  it('is served byte-equal by the single-story route', async () => {
    await storeHandWritten()
    const response = await read(stories, `${CONTAINER}${HAND_WRITTEN_ID}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(JSON.stringify(handWritten))
  })

  it('is served byte-equal as an item of the container', async () => {
    await storeHandWritten()
    const { '@context': _context, ...item } = handWritten
    const body = await (await read(stories, CONTAINER)).text()
    expect(body).toContain(`"items":[${JSON.stringify(item)}]`)
  })

  it('is stored as the same JSON, compared parsed because jsonb reorders keys', async () => {
    await storeHandWritten()
    const stored = await payload.findByID({ collection: 'stories', id: HAND_WRITTEN_ID })
    expect(stored.wadm).toEqual(handWritten)
  })

  it('has the same shape as a story that saveDraft makes from domain input', async () => {
    const at = manualClock('2026-10-08T19:02:11Z')
    const writer = makeStories(payload, { now: at.now })
    const first = await writer.saveDraft(
      leela,
      draft({ id: HAND_WRITTEN_ID, bodies: [{ kind: 'text', value: 'First words.' }] }),
    )
    at.advance(15 * 3600 + 11 * 60 + 49) // to 2026-10-09T10:14:00Z
    const { bodies } = draft()
    await writer.saveDraft(leela, {
      ...draft({ id: HAND_WRITTEN_ID, bodies: [...bodies, { kind: 'sound', media: VOICE_NOTE }] }),
      ifMatch: first.ok ? first.etag : undefined,
    })
    await writer.publish(operator, HAND_WRITTEN_ID)
    expect(await readJson(writer, `${CONTAINER}${HAND_WRITTEN_ID}`)).toEqual({
      ...handWritten,
      created: '2026-10-08T19:02:11.000Z',
      modified: '2026-10-09T10:14:00.000Z',
    })
  })
})

describe('container', () => {
  it('of a known instance with no stories is 200 with total 0 and no first', async () => {
    const response = await read(stories, CONTAINER)
    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toMatch(/^"[A-Za-z0-9_-]{43}"$/)
    const body = await response.json()
    expect(body).toEqual({
      '@context': ['http://www.w3.org/ns/anno.jsonld', 'http://www.w3.org/ns/ldp.jsonld'],
      id: `${ORIGIN}${CONTAINER}`,
      type: ['BasicContainer', 'AnnotationCollection'],
      label: 'River Voices: Ferry crossing, 1962',
      total: 0,
    })
  })

  it('of an unknown project or recording is 404', async () => {
    for (const path of [
      '/stories/nowhere/1/',
      '/stories/river-voices/99/',
      '/stories/river-voices/x/',
    ]) {
      const response = await read(stories, path)
      expect(response.status, path).toBe(404)
      expect(response.headers.get('Content-Type')).toBe('application/problem+json')
    }
  })

  it('embeds the first page with complete stories when no Prefer is sent', async () => {
    await publishDraft(stories, draft())
    const body = await readJson(stories, CONTAINER)
    expect(body.total).toBe(1)
    expect(body.modified).toBe('2026-10-09T10:14:00.000Z')
    expect(body.first).toMatchObject({
      id: `${ORIGIN}${CONTAINER}?page=0`,
      type: 'AnnotationPage',
      startIndex: 0,
    })
    expect(body.first.items[0]).toMatchObject({ id: `${ORIGIN}${CONTAINER}${storyId(1)}` })
    expect(body.first.items[0]['@context']).toBeUndefined()
    expect(body.last).toBe(`${ORIGIN}${CONTAINER}?page=0`)
  })

  it('sends the type and constrainedBy links, Allow, Vary, the content type and Cache-Control', async () => {
    const response = await read(makeStories(payload, { maxAge: 30 }), CONTAINER)
    expect(response.headers.get('Content-Type')).toBe(CONTENT_TYPE)
    expect(response.headers.get('Link')).toBe(
      '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type", ' +
        '<http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"',
    )
    expect(response.headers.get('Allow')).toBe('GET, HEAD, OPTIONS')
    expect(response.headers.get('Vary')).toBe('Prefer')
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=30, stale-while-revalidate=86400',
    )
  })

  it('items are in start order, then created, then id', async () => {
    const at = manualClock()
    const writer = makeStories(payload, { now: at.now })
    const save = async (n: number, start: number) => {
      await publishDraft(writer, draft({ id: storyId(n), start, end: start + 1 }))
      at.advance(1)
    }
    await save(3, 10) // created T0+0
    await save(2, 5) // created T0+1
    await save(5, 10) // created T0+2
    await save(4, 10) // created T0+3
    at.advance(-10)
    await save(9, 10) // created T0-6: before story 3
    await save(1, 10) // created T0-5: same start as 3, created before it
    const body = await readJson(writer, `${CONTAINER}?iris=1`)
    const ids = [2, 9, 1, 3, 5, 4].map((n) => `${ORIGIN}${CONTAINER}${storyId(n)}`)
    expect(body.first.items).toEqual(ids)
  })

  it('with pageSize 2 and 5 stories has 3 linked pages', async () => {
    const small = makeStories(payload, { pageSize: 2 })
    for (let n = 1; n <= 5; n++) {
      await publishDraft(small, draft({ id: storyId(n), start: n, end: n + 1 }))
    }
    const base = `${ORIGIN}${CONTAINER}`
    const container = await readJson(small, CONTAINER)
    expect(container.total).toBe(5)
    expect(container.first.items.map((item: { id: string }) => item.id)).toEqual([
      `${base}${storyId(1)}`,
      `${base}${storyId(2)}`,
    ])
    expect(container.first.next).toBe(`${base}?page=1`)
    expect(container.first.prev).toBeUndefined()
    expect(container.last).toBe(`${base}?page=2`)

    const page1 = await readJson(small, `${CONTAINER}?page=1`)
    expect(page1).toMatchObject({
      id: `${base}?page=1`,
      type: 'AnnotationPage',
      partOf: { id: base, total: 5, modified: '2026-10-09T10:14:00.000Z' },
      startIndex: 2,
      prev: `${base}?page=0`,
      next: `${base}?page=2`,
    })
    expect(page1.items.map((item: { id: string }) => item.id)).toEqual([
      `${base}${storyId(3)}`,
      `${base}${storyId(4)}`,
    ])

    const page2 = await readJson(small, `${CONTAINER}?page=2`)
    expect(page2.startIndex).toBe(4)
    expect(page2.prev).toBe(`${base}?page=1`)
    expect(page2.next).toBeUndefined()
    expect(page2.items).toHaveLength(1)

    const page = await read(small, `${CONTAINER}?page=1`)
    expect(page.headers.get('Link')).toBe(
      '<http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"',
    )
  })

  it('page out of range or not a number is 404', async () => {
    await publishDraft(stories, draft())
    for (const query of ['?page=1', '?page=-1', '?page=abc', '?page=01']) {
      expect((await read(stories, `${CONTAINER}${query}`)).status, query).toBe(404)
    }
  })

  it('iris=1 gives story IRIs only, and ?iris=1&page=0 gives the IRI page', async () => {
    await publishDraft(stories, draft())
    const container = await readJson(stories, `${CONTAINER}?iris=1`)
    expect(container.first.items).toEqual([`${ORIGIN}${CONTAINER}${storyId(1)}`])
    expect(container.first.id).toBe(`${ORIGIN}${CONTAINER}?iris=1&page=0`)
    const page = await readJson(stories, `${CONTAINER}?iris=1&page=0`)
    expect(page.items).toEqual([`${ORIGIN}${CONTAINER}${storyId(1)}`])
  })

  it('PreferContainedIRIs gives the same bytes as iris=1', async () => {
    await publishDraft(stories, draft())
    const byHeader = await (await read(stories, CONTAINER, { headers: PREFER(IRIS) })).text()
    const byQuery = await (await read(stories, `${CONTAINER}?iris=1`)).text()
    expect(byHeader).toBe(byQuery)
  })

  it('PreferMinimalContainer gives first and last links and no items', async () => {
    await publishDraft(stories, draft())
    const minimal = await readJson(stories, CONTAINER, { headers: PREFER(MINIMAL) })
    expect(minimal.first).toBe(`${ORIGIN}${CONTAINER}?page=0`)
    expect(minimal.last).toBe(`${ORIGIN}${CONTAINER}?page=0`)
    expect(JSON.stringify(minimal)).not.toContain('items')
    const minimalIris = await readJson(stories, CONTAINER, { headers: PREFER(MINIMAL, IRIS) })
    expect(minimalIris.first).toBe(`${ORIGIN}${CONTAINER}?iris=1&page=0`)
  })
})

describe('protocol', () => {
  it('HEAD gives the GET headers and no body', async () => {
    await publishDraft(stories, draft())
    const get = await read(stories, CONTAINER)
    const head = await read(stories, CONTAINER, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(Object.fromEntries(head.headers)).toEqual(Object.fromEntries(get.headers))
    expect(head.body).toBeNull()
  })

  it('OPTIONS is 204 with the CORS preflight headers and max-age 86400', async () => {
    const response = await read(stories, CONTAINER, { method: 'OPTIONS' })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Accept, Prefer, If-None-Match',
    )
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
  })

  it('POST, PUT and DELETE are 405 with Allow', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await read(stories, CONTAINER, { method })
      expect(response.status, method).toBe(405)
      expect(response.headers.get('Allow')).toBe('GET, HEAD, OPTIONS')
    }
  })

  it('every response carries Access-Control-Allow-Origin * and exposes ETag and Link', async () => {
    await publishDraft(stories, draft())
    const etag = (await read(stories, CONTAINER)).headers.get('ETag')!
    const responses = [
      await read(stories, CONTAINER), // 200
      await read(stories, `${CONTAINER}${storyId(1)}`), // 200
      await read(stories, CONTAINER, { headers: { 'If-None-Match': etag } }), // 304
      await read(stories, '/stories/nowhere/1/'), // 404
      await read(stories, CONTAINER, { method: 'POST' }), // 405
      await read(stories, CONTAINER, { method: 'OPTIONS' }), // 204
    ]
    expect(responses.map((r) => r.status)).toEqual([200, 200, 304, 404, 405, 204])
    for (const response of responses) {
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Expose-Headers')).toBe('ETag, Link, Allow, Vary')
    }
  })
})

describe('caching', () => {
  it('If-None-Match with the current ETag gives 304 without a body', async () => {
    await publishDraft(stories, draft())
    for (const path of [CONTAINER, `${CONTAINER}?page=0`, `${CONTAINER}${storyId(1)}`]) {
      const etag = (await read(stories, path)).headers.get('ETag')!
      const response = await read(stories, path, { headers: { 'If-None-Match': etag } })
      expect(response.status, path).toBe(304)
      expect(response.headers.get('ETag')).toBe(etag)
      expect(response.body).toBeNull()
    }
  })

  it('If-None-Match with an old ETag gives 200', async () => {
    const response = await read(stories, CONTAINER, { headers: { 'If-None-Match': '"old"' } })
    expect(response.status).toBe(200)
  })

  it('ETag changes after a publish in the instance and not after a publish in another', async () => {
    const etag = async (path: string) => (await read(stories, path)).headers.get('ETag')
    const other = '/stories/river-voices/2/'
    const before = { here: await etag(CONTAINER), there: await etag(other) }
    await publishDraft(stories, draft())
    expect(await etag(CONTAINER)).not.toBe(before.here)
    expect(await etag(other)).toBe(before.there)
  })

  it('a fixed clock gives a stable created and ETag', async () => {
    const run = async () => {
      await seed(payload)
      await publishDraft(stories, draft())
      const response = await read(stories, `${CONTAINER}${storyId(1)}`)
      return { etag: response.headers.get('ETag'), body: await response.json() }
    }
    const first = await run()
    const second = await run()
    expect(second.etag).toBe(first.etag)
    expect(first.body.created).toBe('2026-10-09T10:14:00.000Z')
  })
})

describe('one story', () => {
  it('published story has the WADM shape with FragmentSelector, scope, rights and creator', async () => {
    await publishDraft(stories, draft())
    const response = await read(stories, `${CONTAINER}${storyId(1)}`)
    expect(response.headers.get('Link')).toBe('<http://www.w3.org/ns/ldp#Resource>; rel="type"')
    expect(response.headers.get('Vary')).toBeNull()
    expect(await response.json()).toEqual({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      id: `${ORIGIN}${CONTAINER}${storyId(1)}`,
      type: 'Annotation',
      motivation: 'commenting',
      created: '2026-10-09T10:14:00.000Z',
      modified: '2026-10-09T10:14:00.000Z',
      creator: { id: `${ORIGIN}/members/m-118`, type: 'Person', nickname: 'Leela' },
      rights: 'https://creativecommons.org/licenses/by-nc/4.0/',
      body: [
        {
          type: 'TextualBody',
          value: 'My grandmother sang this on the ferry.',
          format: 'text/plain',
          language: 'ml',
        },
        {
          type: ['TextualBody', 'rdf:Statement'],
          purpose: 'tagging',
          value: 'Ferry',
          language: 'en',
          'rdf:subject': { id: `${ORIGIN}/recordings/1#t=42,51` },
          'rdf:predicate': { id: 'http://purl.org/dc/terms/subject' },
          'rdf:object': { id: FERRY },
        },
      ],
      target: {
        type: 'SpecificResource',
        source: `${ORIGIN}/recordings/1`,
        scope: `${ORIGIN}/projects/river-voices`,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: 't=42,51',
        },
      },
    })
  })

  it('fractional seconds format as t=42.5,51.125 with no trailing zeros', async () => {
    await publishDraft(stories, draft({ start: 42.5, end: 51.125 }))
    const body = await readJson(stories, `${CONTAINER}${storyId(1)}`)
    expect(body.target.selector.value).toBe('t=42.5,51.125')
  })

  it('draft story is 404, and the container does not count it', async () => {
    const saved = await stories.saveDraft(leela, draft())
    expect(saved.ok).toBe(true)
    expect((await read(stories, `${CONTAINER}${storyId(1)}`)).status).toBe(404)
    expect((await readJson(stories, CONTAINER)).total).toBe(0)
  })

  it('unknown story id is 404', async () => {
    expect((await read(stories, `${CONTAINER}${storyId(77)}`)).status).toBe(404)
  })
})
