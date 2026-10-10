// "Load a vocabulary file" (design/vocab.md §6, slice 8): an ontology in RDF/XML or Turtle,
// SKOS lists, the limits, the prefix rule, the preview that writes nothing, and the
// endpoint `POST /api/ontologies/import`. Through the interface:
// `createVocabulary(...).importFile`, `searchTerms`, `lists`, and the collection endpoint.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Endpoint, Payload, PayloadRequest } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createVocabulary, type Vocabulary } from '@/modules/vocabulary'
import config from '@/payload.config'

import { ORIGIN, PROJECT, operator, seed, startPayload } from '../stories/world'

let payload: Payload
let vocabulary: Vocabulary
const bytes = (text: string) => new TextEncoder().encode(text)
const drizzle = () => (payload.db as unknown as PostgresAdapter).drizzle

beforeAll(async () => {
  payload = await startPayload()
  vocabulary = createVocabulary({ payload, origin: ORIGIN })
})

beforeEach(async () => {
  await seed(payload)
  await vocabulary.ontologies() // the bundled ontologies are there
  await drizzle().execute(
    sql`delete from ontology_terms where ontology_id in (select id from ontologies where source = 'uploaded')`,
  )
  await drizzle().execute(sql`delete from ontologies where source = 'uploaded'`)
})

async function counts() {
  const { rows } = await drizzle().execute<{ o: string; t: string; l: string; c: string }>(sql`
    select (select count(*) from ontologies) as o, (select count(*) from ontology_terms) as t,
           (select count(*) from vocab_lists) as l, (select count(*) from concepts) as c`)
  return rows[0]
}

const BOATS = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix vann: <http://purl.org/vocab/vann/> .
@prefix ra: <https://archive.example/ns/ra#> .
<https://archive.example/ns/ra> a owl:Ontology ; rdfs:label "River Archive" ;
  vann:preferredNamespacePrefix "ra" ; vann:preferredNamespaceUri "https://archive.example/ns/ra#" .
ra:ferryRoute a owl:ObjectProperty ; rdfs:label "Ferry route"@en ; rdfs:comment "The route of a ferry."@en .
ra:boatName a owl:DatatypeProperty ; rdfs:label "Boat name"@en .
ra:noLabel a rdf:Property .
ra:Boat a owl:Class ; rdfs:label "Boat"@en .
<https://elsewhere.example/x> a owl:Class ; rdfs:label "Elsewhere" .
`

describe('an ontology', () => {
  it('FOAF in RDF/XML loads as an uploaded ontology; its properties show in the search', async () => {
    // FOAF is bundled: take it out first, as a stack without it.
    await drizzle().execute(
      sql`delete from ontology_terms where ontology_id in (select id from ontologies where prefix = 'foaf')`,
    )
    await drizzle().execute(sql`delete from ontologies where prefix = 'foaf'`)
    const foaf = readFileSync(path.join(process.cwd(), 'tests/int/vocabulary/files/foaf.rdf'))
    const preview = await vocabulary.importFile(
      operator,
      { name: 'foaf.rdf', bytes: foaf },
      { apply: false },
    )
    expect(preview).toMatchObject({
      ok: true,
      applied: false,
      report: {
        syntax: 'rdf-xml',
        ontology: {
          prefix: 'foaf',
          namespace: 'http://xmlns.com/foaf/0.1/',
          properties: 62,
          classes: 13,
          isNew: true,
        },
        lists: [],
      },
    })
    const applied = await vocabulary.importFile(
      operator,
      { name: 'foaf.rdf', bytes: foaf },
      { apply: true },
    )
    expect(applied.ok && applied.applied).toBe(true)
    const found = await vocabulary.searchTerms({ kind: 'class', text: 'person', ontology: 'foaf' })
    expect(found.map((t) => t.curie)).toContain('foaf:Person')
    const row = (await vocabulary.ontologies()).find((o) => o.prefix === 'foaf')
    expect(row).toMatchObject({ source: 'uploaded', terms: 75 })
  })

  it('a Turtle ontology: the preview counts and writes nothing; a new version shows the changes', async () => {
    const before = await counts()
    const preview = await vocabulary.importFile(
      operator,
      { name: 'ra.ttl', bytes: bytes(BOATS) },
      { apply: false },
    )
    expect(preview).toEqual({
      ok: true,
      applied: false,
      report: {
        syntax: 'turtle',
        ontology: {
          label: 'River Archive',
          prefix: 'ra',
          namespace: 'https://archive.example/ns/ra#',
          properties: 2,
          classes: 1,
          isNew: true,
          leftOut: { unlabelled: 1, outside: 1 },
        },
        lists: [],
        form: null,
      },
    })
    expect(await counts()).toEqual(before)
    await vocabulary.importFile(operator, { name: 'ra.ttl', bytes: bytes(BOATS) }, { apply: true })
    const route = await vocabulary.searchTerms({ kind: 'property', text: 'ferry route' })
    expect(route[0]).toMatchObject({ curie: 'ra:ferryRoute', ontology: { label: 'River Archive' } })

    const next = BOATS.replace('"Boat name"@en', '"Name of the boat"@en').replace(
      'ra:Boat a owl:Class ; rdfs:label "Boat"@en .',
      'ra:landing a rdf:Property ; rdfs:label "Landing"@en .',
    )
    const again = await vocabulary.importFile(
      operator,
      { name: 'ra.ttl', bytes: bytes(next) },
      { apply: false },
    )
    expect(again.ok && again.report.ontology).toMatchObject({
      isNew: false,
      changes: { added: 1, changed: 1, unchanged: 1, gone: 1 },
    })
  })

  it('refuses a prefix that anno.jsonld uses: a term, or a prefix of another namespace', async () => {
    for (const prefix of ['body', 'oa', 'schema']) {
      const text = BOATS.replace(
        'vann:preferredNamespacePrefix "ra"',
        `vann:preferredNamespacePrefix "${prefix}"`,
      )
      expect(
        await vocabulary.importFile(
          operator,
          { name: 'x.ttl', bytes: bytes(text) },
          { apply: false },
        ),
      ).toEqual({
        ok: false,
        error: 'prefix-clash',
        message: prefix,
      })
    }
    // The operator changes the prefix: it loads.
    const renamed = await vocabulary.importFile(
      operator,
      { name: 'x.ttl', bytes: bytes(BOATS.replace('"ra"', '"oa"')) },
      { apply: false, names: { prefix: 'river' } },
    )
    expect(renamed.ok && renamed.report.ontology?.prefix).toBe('river')
  })

  it('a 4 MB Turtle file passes; over 5 MB is refused; a remote context is refused', async () => {
    const pad = 'x'.repeat(180)
    const lines = [
      '@prefix big: <https://big.example/ns#> .',
      '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
      '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    ]
    for (let i = 0; lines.join('\n').length < 4_000_000; i++) {
      lines.push(`big:p${i} a rdf:Property ; rdfs:label "Property ${i}" ; rdfs:comment "${pad}" .`)
    }
    const four = bytes(lines.join('\n'))
    expect(four.byteLength).toBeGreaterThan(4_000_000)
    const ok = await vocabulary.importFile(
      operator,
      { name: 'big.ttl', bytes: four },
      { apply: false },
    )
    expect(ok.ok && ok.report.ontology?.properties).toBeGreaterThan(15_000)
    const six = new Uint8Array(6_000_000).fill(32)
    expect(
      await vocabulary.importFile(operator, { name: 'six.ttl', bytes: six }, { apply: false }),
    ).toEqual({
      ok: false,
      error: 'too-large',
    })
    const remote = JSON.stringify({
      '@context': 'https://example.org/c.jsonld',
      '@id': 'https://x.example/a',
    })
    expect(
      await vocabulary.importFile(
        operator,
        { name: 'r.jsonld', bytes: bytes(remote) },
        { apply: false },
      ),
    ).toMatchObject({
      ok: false,
      error: 'unreadable',
      message: expect.stringContaining('https://example.org/c.jsonld'),
    })
  })
})

describe('SKOS lists', () => {
  const SKOS = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
<https://archive.example/boats> a skos:ConceptScheme ; skos:prefLabel "Boat names"@en .
<https://archive.example/boats/kerala-queen> a skos:Concept ; skos:prefLabel "Kerala Queen"@en ; skos:inScheme <https://archive.example/boats> .
<https://archive.example/boats/sea-bird> a skos:Concept ; skos:prefLabel "Sea Bird"@en ; skos:inScheme <https://archive.example/boats> .
`
  it('a SKOS file gives a list with its items; a second load changes nothing', async () => {
    const before = await counts()
    const preview = await vocabulary.importFile(
      operator,
      { name: 'boats.ttl', bytes: bytes(SKOS) },
      { project: PROJECT, apply: false },
    )
    expect(preview).toMatchObject({
      ok: true,
      report: {
        ontology: null,
        lists: [
          {
            iri: 'https://archive.example/boats',
            label: 'Boat names',
            items: 2,
            exists: false,
            report: { added: 2 },
          },
        ],
      },
    })
    expect(await counts()).toEqual(before)
    await vocabulary.importFile(
      operator,
      { name: 'boats.ttl', bytes: bytes(SKOS) },
      { project: PROJECT, apply: true },
    )
    const lists = await vocabulary.lists(PROJECT)
    expect(lists.find((l) => l.iri === 'https://archive.example/boats')).toMatchObject({
      label: 'Boat names',
      kind: 'items',
      size: 2,
    })
    const again = await vocabulary.importFile(
      operator,
      { name: 'boats.ttl', bytes: bytes(SKOS) },
      { project: PROJECT, apply: true },
    )
    expect(again).toMatchObject({
      ok: true,
      report: { lists: [{ exists: true, report: { added: 0, unchanged: 2 } }] },
    })
    // The operator ticks nothing: nothing changes.
    const none = await vocabulary.importFile(
      operator,
      { name: 'boats.ttl', bytes: bytes(SKOS.replace('Sea Bird', 'Sea bird')) },
      { project: PROJECT, apply: true, accept: { lists: [] } },
    )
    expect(none.ok).toBe(true)
    expect((await vocabulary.choices(PROJECT, 'boat-names')).map((c) => c.label)).toContain(
      'Sea Bird',
    )
  })

  it('a file with nothing to load is refused with nothing', async () => {
    const text = '<https://a.example/x> <https://a.example/p> "y" .'
    expect(
      await vocabulary.importFile(operator, { name: 'n.nt', bytes: bytes(text) }, { apply: false }),
    ).toEqual({
      ok: false,
      error: 'nothing',
    })
  })
})

describe('POST /api/ontologies/import', () => {
  const endpoint = () =>
    (config as unknown as Promise<{ collections: { slug: string; endpoints: Endpoint[] }[] }>).then(
      (c) =>
        c.collections
          .find((one) => one.slug === 'ontologies')!
          .endpoints.find((e) => e.path === '/import')!,
    )
  const call = async (
    body: Uint8Array,
    query: string,
    user: unknown = { collection: 'users', id: 1 },
  ) => {
    const handler = (await endpoint()).handler
    const request = new Request(`${ORIGIN}/api/ontologies/import?${query}`, {
      method: 'POST',
      body,
    })
    const req = Object.assign(request, { payload, user }) as unknown as PayloadRequest
    return handler(req)
  }

  it('gives the preview to an operator, refuses others, and stops a body over 5 MB with 413', async () => {
    const ok = await call(bytes(BOATS), 'name=ra.ttl')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({
      ok: true,
      applied: false,
      report: { ontology: { prefix: 'ra' } },
    })
    expect((await call(bytes(BOATS), 'name=ra.ttl', null)).status).toBe(403)
    const big = await call(new Uint8Array(5_000_001), 'name=big.ttl')
    expect(big.status).toBe(413)
    expect(await big.json()).toEqual({ ok: false, error: 'too-large' })
    const applied = await call(bytes(BOATS), `name=ra.ttl&apply=1&project=${PROJECT}`)
    expect(await applied.json()).toMatchObject({ ok: true, applied: true })
  })
})
