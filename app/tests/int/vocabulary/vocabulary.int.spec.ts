// The `vocabulary` module (Phase 5): IRI minting, the tree rules, hidden concepts, the
// delete guard, the relabel hook, and the SKOS export and import. Through the interface:
// the concepts collection (as the admin uses it), `conceptsOf`, `exportSkos`, `importSkos`.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Stories } from '@/modules/stories'
import { conceptsOf, exportSkos, importSkos } from '@/modules/vocabulary'

import {
  BOAT,
  CONTAINER,
  FERRY,
  ORIGIN,
  PROJECT,
  draft,
  leela,
  makeStories,
  publishDraft,
  readJson,
  seed,
  startPayload,
  storyId,
} from '../stories/world'

let payload: Payload
let stories: Stories
let river: number | string
let hill: number | string
const site = () => ({ payload, origin: ORIGIN })
const BASE = `${ORIGIN}/vocab/${PROJECT}/c/`

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
  const projects = await payload.find({ collection: 'projects', sort: 'id' })
  ;[river, hill] = projects.docs.map((doc) => doc.id)
})

// The generated type says `iri` is required; the collection hook makes it, as in the admin.
const add = (data: { label: string; parent?: number | string; project?: number | string }) =>
  payload.create({ collection: 'concepts', data: { project: river as number, ...data } as never })

const idOf = async (iri: string) =>
  (await payload.find({ collection: 'concepts', where: { iri: { equals: iri } } })).docs[0].id

const tree = async () =>
  (await conceptsOf({ payload }, PROJECT)).map(({ iri, label, parent, hidden, language }) => ({
    iri,
    label,
    ...(parent ? { parent } : {}),
    ...(language ? { language } : {}),
    hidden,
  }))

describe('concepts', () => {
  it('get an IRI that the app makes from the label, unique, and never changed', async () => {
    const market = await add({ label: 'Fish market' })
    const again = await add({ label: 'Fish  Market!' })
    const malayalam = await add({ label: 'മീൻ ചന്ത' })
    expect(market.iri).toBe(`${BASE}fish-market`)
    expect(again.iri).toBe(`${BASE}fish-market-2`)
    expect(malayalam.iri).toMatch(new RegExp(`^${BASE}[0-9a-f]{8}$`))

    const renamed = await payload.update({
      collection: 'concepts',
      id: market.id,
      data: { label: 'Market', iri: `${BASE}other` },
    })
    expect(renamed.iri).toBe(`${BASE}fish-market`)
  })

  it('refuse a parent of another project, a cycle, and a move to another project', async () => {
    const goat = await idOf(`${ORIGIN}/vocab/hill-songs/c/goat`)
    const refused = (pattern: RegExp) => ({
      data: { errors: [expect.objectContaining({ message: expect.stringMatching(pattern) })] },
    })
    await expect(add({ label: 'Kid', parent: goat })).rejects.toMatchObject(refused(/same project/))

    const transport = await add({ label: 'Transport' })
    const ferry = await idOf(FERRY)
    await payload.update({ collection: 'concepts', id: ferry, data: { parent: transport.id } })
    await expect(
      payload.update({ collection: 'concepts', id: transport.id, data: { parent: ferry } }),
    ).rejects.toMatchObject(refused(/under itself/))
    await expect(
      payload.update({ collection: 'concepts', id: ferry, data: { project: hill as number } }),
    ).rejects.toMatchObject(refused(/stays in its project/))
    expect((await tree()).find((c) => c.iri === FERRY)?.parent).toBe(transport.iri)
  })

  it('a label change relabels the published stories in the same change', async () => {
    await publishDraft(stories, draft({ tags: [FERRY] }))
    await payload.update({
      collection: 'concepts',
      id: await idOf(FERRY),
      data: { label: 'Ferry boat' },
    })
    const body = (await readJson(stories, `${CONTAINER}${storyId(1)}`)).body
    expect(body.at(-1)).toMatchObject({ value: 'Ferry boat', purpose: 'tagging' })
  })

  it('a concept that a story uses cannot be deleted; hidden, it leaves the picker list only', async () => {
    await publishDraft(stories, draft({ tags: [BOAT] }))
    const boat = await idOf(BOAT)
    await expect(payload.delete({ collection: 'concepts', id: boat })).rejects.toThrow(
      /1 story uses this concept/,
    )
    await payload.update({ collection: 'concepts', id: boat, data: { hidden: true } })
    expect((await tree()).find((c) => c.iri === BOAT)?.hidden).toBe(true)
    // A story that has the hidden concept keeps it, also on the next save.
    const [own] = await stories.ownDrafts(leela, { project: PROJECT, recording: '1' })
    const again = await stories.saveDraft(leela, {
      ...draft({ tags: [BOAT], end: 50 }),
      ifMatch: own.etag,
    })
    expect(again.ok).toBe(true)
  })

  it('a concept with narrower concepts cannot be deleted; an unused leaf can', async () => {
    const transport = await add({ label: 'Transport' })
    const raft = await add({ label: 'Raft', parent: transport.id })
    await expect(payload.delete({ collection: 'concepts', id: transport.id })).rejects.toThrow(
      /narrower concepts/,
    )
    await payload.delete({ collection: 'concepts', id: raft.id })
    await payload.delete({ collection: 'concepts', id: transport.id })
    expect((await tree()).map((c) => c.label)).toEqual(['Boat', 'Ferry'])
  })
})

describe('SKOS', () => {
  async function hierarchy() {
    const transport = await add({ label: 'Transport' })
    await payload.update({
      collection: 'concepts',
      id: await idOf(FERRY),
      data: { parent: transport.id },
    })
    await payload.update({ collection: 'concepts', id: await idOf(BOAT), data: { hidden: true } })
    return tree()
  }

  async function emptyVocabulary() {
    const db = payload.db as unknown as PostgresAdapter
    await db.drizzle.execute(sql`delete from concepts where project_id = ${river}`)
  }

  for (const format of ['turtle', 'json-ld'] as const) {
    it(`a ${format} export imports back to the same tree, with parents and hidden concepts`, async () => {
      const before = await hierarchy()
      const file = await exportSkos(site(), PROJECT, format)
      expect(file?.filename).toBe(format === 'turtle' ? `${PROJECT}.ttl` : `${PROJECT}.jsonld`)
      await emptyVocabulary()

      const preview = await importSkos(site(), PROJECT, file!.body, { apply: false })
      expect(preview).toEqual({
        ok: true,
        applied: false,
        report: {
          concepts: 3,
          added: 3,
          changed: 0,
          unchanged: 0,
          skipped: [],
          ignoredParents: [],
        },
      })
      expect(await tree()).toEqual([])

      const applied = await importSkos(site(), PROJECT, file!.body, { apply: true })
      expect(applied).toMatchObject({ ok: true, applied: true, report: { added: 3 } })
      expect(await tree()).toEqual(before)
      // A second import of the same file changes nothing.
      expect(await importSkos(site(), PROJECT, file!.body, { apply: true })).toMatchObject({
        report: { added: 0, changed: 0, unchanged: 3 },
      })
    })
  }

  it('the Turtle export is a SKOS concept scheme', async () => {
    await hierarchy()
    const { body } = (await exportSkos(site(), PROJECT, 'turtle'))!
    expect(body).toContain('@prefix skos: <http://www.w3.org/2004/02/skos/core#>.')
    expect(body).toContain(`<${ORIGIN}/vocab/${PROJECT}> a skos:ConceptScheme`)
    expect(body).toContain(`<${FERRY}> a skos:Concept`)
    expect(body).toMatch(/skos:broader <[^>]+transport>/)
    expect(body).toContain('owl:deprecated true')
    expect(await exportSkos(site(), 'nope', 'turtle')).toBeNull()
  })

  it('merges by IRI: a known IRI takes the new label and parent; nothing is removed', async () => {
    const turtle = `
      @prefix skos: <http://www.w3.org/2004/02/skos/core#>.
      <${FERRY}> a skos:Concept; skos:prefLabel "Ferry boat"@en, "കടത്തുവള്ളം"@ml; skos:broader <${BASE}water>.
      <${BASE}water> a skos:Concept; skos:prefLabel "Water"@en.
      <${ORIGIN}/vocab/hill-songs/c/goat> a skos:Concept; skos:prefLabel "Goat".
      _:b a skos:Concept; skos:prefLabel "Blank".
      <${BASE}nolabel> a skos:Concept.`
    const preview = await importSkos(site(), PROJECT, turtle, { apply: false })
    expect(preview).toEqual({
      ok: true,
      applied: false,
      report: {
        concepts: 5,
        added: 1,
        changed: 1,
        unchanged: 0,
        skipped: [
          { iri: `${ORIGIN}/vocab/hill-songs/c/goat`, reason: 'other-project' },
          { iri: expect.stringMatching(/^_:/), reason: 'not-a-web-address' },
          { iri: `${BASE}nolabel`, reason: 'no-label' },
        ],
        ignoredParents: [],
      },
    })
    await importSkos(site(), PROJECT, turtle, { apply: true })
    // The project language is ml, so the Malayalam label wins. Boat stays.
    expect(await tree()).toEqual([
      { iri: BOAT, label: 'Boat', language: 'en', hidden: false },
      { iri: `${BASE}water`, label: 'Water', language: 'en', hidden: false },
      { iri: FERRY, label: 'കടത്തുവള്ളം', language: 'ml', parent: `${BASE}water`, hidden: false },
    ])
  })

  it('ignores a parent that makes a cycle', async () => {
    const turtle = `
      @prefix skos: <http://www.w3.org/2004/02/skos/core#>.
      <${FERRY}> a skos:Concept; skos:prefLabel "Ferry"@en; skos:broader <${BOAT}>.
      <${BOAT}> a skos:Concept; skos:prefLabel "Boat"@en; skos:broader <${FERRY}>.`
    const result = await importSkos(site(), PROJECT, turtle, { apply: true })
    expect(result).toMatchObject({
      report: { changed: 1, ignoredParents: [{ iri: BOAT, parent: FERRY }] },
    })
    const parents = (await tree()).map((c) => [c.label, c.parent ?? null])
    expect(parents).toEqual([
      ['Boat', null],
      ['Ferry', BOAT],
    ])
  })

  it('refuses a file that is not SKOS, a remote JSON-LD context, an unknown project', async () => {
    expect(
      await importSkos(site(), PROJECT, 'this is not turtle <', { apply: false }),
    ).toMatchObject({
      ok: false,
      error: 'not-skos',
    })
    expect(await importSkos(site(), PROJECT, '<a:b> <c:d> "e".', { apply: false })).toMatchObject({
      ok: false,
      error: 'not-skos',
    })
    const remote = JSON.stringify({ '@context': 'https://example.org/skos.jsonld', '@id': FERRY })
    expect(await importSkos(site(), PROJECT, remote, { apply: false })).toMatchObject({
      ok: false,
      error: 'not-skos',
      message: expect.stringContaining('https://example.org/skos.jsonld'),
    })
    expect(await importSkos(site(), 'nope', '', { apply: false })).toEqual({
      ok: false,
      error: 'unknown-project',
    })
  })
})
