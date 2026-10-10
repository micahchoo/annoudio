// Values of a story (design/vocab.md §3, slice 3): `saveDraft` stores one value body per
// value, and RDF tools read each value body as one `rdf:Statement`. Through the interface:
// `stories.saveDraft`, `stories.publish`, the read route; jsonld.js and
// jsonld-streaming-parser read the served record with a local copy of `anno.jsonld`.

import jsonldjs from 'jsonld'
import { JsonLdParser } from 'jsonld-streaming-parser'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import anno from '@/modules/stories/context/anno.json'
import { createVocabulary, type Vocabulary } from '@/modules/vocabulary'
import type { Stories } from '@/modules/stories'

import { ORIGIN, PROJECT, makeStories, operator, seed, startPayload } from './world'

const ANNO = 'http://www.w3.org/ns/anno.jsonld'
const DC = 'http://purl.org/dc/terms/'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const SPEAKER = 'http://id.loc.gov/vocabulary/relators/spk'
const ID = '0192a3b4-7c1d-7e00-8000-000000000001'
const SEGMENT = `${ORIGIN}/recordings/1#t=62,95`
const asha = { memberId: 'm-100', nickname: 'Asha' }

// The calls of jsonld.js 9 that the test uses. `@types/jsonld` describes version 1.5.
type Options = { documentLoader: unknown; [key: string]: unknown }
const jsonld = jsonldjs as unknown as {
  toRDF(doc: unknown, options: Options): Promise<string>
  expand(doc: unknown, options: Options): Promise<unknown>
  compact(doc: unknown, context: string, options: Options): Promise<unknown>
  canonize(doc: unknown, options: Record<string, unknown>): Promise<string>
}

let payload: Payload
let stories: Stories
let vocabulary: Vocabulary
const items = { place: '', person: '' }

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  // The project of §3.3: English stories under CC BY 4.0.
  await payload.update({
    collection: 'projects',
    where: { slug: { equals: PROJECT } },
    data: { language: 'en', rights: 'cc-by-4.0' },
  })
  stories = makeStories(payload, { now: () => new Date('2026-10-09T10:00:00Z') })
  vocabulary = createVocabulary({ payload, origin: ORIGIN })
  for (const key of ['title', 'when', 'place', 'speaker']) {
    const added = await vocabulary.addField(operator, PROJECT, { from: 'catalogue', key })
    if (!added.ok) throw new Error(added.error)
  }
  const place = await vocabulary.addItem(operator, PROJECT, 'places', { label: 'Fort Kochi' })
  const person = await vocabulary.addItem(operator, PROJECT, 'people', { label: 'K. Joseph' })
  if (!place.ok || !person.ok) throw new Error('addItem failed')
  await payload.update({
    collection: 'concepts',
    where: { iri: { equals: place.iri } },
    data: { language: 'en' },
  })
  items.place = place.iri
  items.person = person.iri
})

const input = (values: Parameters<Stories['saveDraft']>[1]['values']) => ({
  id: ID,
  project: PROJECT,
  recording: '1',
  start: 62,
  end: 95,
  bodies: [{ kind: 'text' as const, value: 'My father ran this ferry from Fort Kochi.' }],
  values,
})

const FOUR = () => [
  { property: `${DC}title`, text: 'The last ferry' },
  { property: `${DC}temporal`, date: { year: 1962 } },
  { property: `${DC}spatial`, item: items.place },
  { property: SPEAKER, item: items.person },
]

/** Save and publish, then read the served record. */
async function served(values: ReturnType<typeof FOUR>) {
  const saved = await stories.saveDraft(asha, input(values))
  if (!saved.ok) throw new Error(JSON.stringify(saved.error))
  await stories.publish(operator, ID)
  const response = await stories.handleRead(new Request(`${ORIGIN}/stories/${PROJECT}/1/${ID}`))
  return response.json()
}

const documentLoader = async (url: string) => {
  if (url !== ANNO) throw new Error(`no fetch: ${url}`)
  return { contextUrl: undefined, document: anno, documentUrl: url }
}

/** The quads of a JSON-LD document, as jsonld-streaming-parser reads it, in N-Quads. */
function streamed(doc: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const lines: string[] = []
    const parser = new JsonLdParser({
      documentLoader: {
        load: async (url: string) => (await documentLoader(url)).document as never,
      },
    })
    const term = (t: {
      termType: string
      value: string
      language?: string
      datatype?: { value: string }
    }) =>
      t.termType === 'NamedNode'
        ? `<${t.value}>`
        : t.termType === 'BlankNode'
          ? `_:${t.value}`
          : `${JSON.stringify(t.value)}${t.language ? `@${t.language}` : t.datatype && t.datatype.value !== `http://www.w3.org/2001/XMLSchema#string` ? `^^<${t.datatype.value}>` : ''}`
    parser.on('data', (q) =>
      lines.push(`${term(q.subject)} ${term(q.predicate)} ${term(q.object)} .`),
    )
    parser.on('error', reject)
    parser.on('end', () => resolve(lines.join('\n') + '\n'))
    parser.end(JSON.stringify(doc))
  })
}

/** The statements of a set of N-Quads: subject, predicate and object of each rdf:Statement. */
function statements(nquads: string) {
  const triples = nquads
    .trim()
    .split('\n')
    .map((line) => /^(\S+) (\S+) (.+) \.$/.exec(line)!.slice(1))
  const of = (node: string, predicate: string) =>
    triples.filter(([s, p]) => s === node && p === `<${predicate}>`).map(([, , o]) => o)
  return triples
    .filter(([, p, o]) => p === `<${RDF}type>` && o === `<${RDF}Statement>`)
    .map(([node]) => ({
      subject: of(node, `${RDF}subject`),
      predicate: of(node, `${RDF}predicate`),
      object: of(node, `${RDF}object`).map((o) =>
        o.startsWith('_:')
          ? {
              type: of(o, `${RDF}type`),
              label: of(o, 'http://www.w3.org/2000/01/rdf-schema#label'),
            }
          : o,
      ),
    }))
    .sort((a, b) => (a.predicate[0] < b.predicate[0] ? -1 : 1))
}

describe('saveDraft with four values', () => {
  it('stores the record of design/vocab.md §3.3 (key order aside)', async () => {
    const saved = await stories.saveDraft(asha, input(FOUR()))
    expect(saved.ok).toBe(true)
    const stored = await payload.findByID({ collection: 'stories', id: ID, draft: true })
    expect(stored.wadm).toEqual({
      '@context': ANNO,
      id: `${ORIGIN}/stories/${PROJECT}/1/${ID}`,
      type: 'Annotation',
      motivation: 'commenting',
      created: '2026-10-09T10:00:00.000Z',
      // Not in §3.3: every story has `modified` since Phase 1.
      modified: '2026-10-09T10:00:00.000Z',
      creator: { id: `${ORIGIN}/members/m-100`, type: 'Person', nickname: 'Asha' },
      rights: 'https://creativecommons.org/licenses/by/4.0/',
      body: [
        {
          type: 'TextualBody',
          value: 'My father ran this ferry from Fort Kochi.',
          format: 'text/plain',
          language: 'en',
        },
        {
          type: ['TextualBody', 'rdf:Statement'],
          purpose: 'describing',
          value: 'The last ferry',
          language: 'en',
          'rdf:subject': { id: SEGMENT },
          'rdf:predicate': { id: `${DC}title` },
          'rdf:object': { '@value': 'The last ferry', '@language': 'en' },
        },
        {
          type: ['TextualBody', 'rdf:Statement'],
          purpose: 'describing',
          value: '1962',
          'rdf:subject': { id: SEGMENT },
          'rdf:predicate': { id: `${DC}temporal` },
          'rdf:object': { '@value': '1962', type: 'xsd:gYear' },
        },
        {
          type: ['TextualBody', 'rdf:Statement'],
          purpose: 'tagging',
          value: 'Fort Kochi',
          language: 'en',
          'rdf:subject': { id: SEGMENT },
          'rdf:predicate': { id: `${DC}spatial` },
          'rdf:object': { id: `${ORIGIN}/vocab/${PROJECT}/c/fort-kochi` },
        },
        {
          type: ['TextualBody', 'rdf:Statement'],
          purpose: 'describing',
          value: 'K. Joseph',
          'rdf:subject': { id: SEGMENT },
          'rdf:predicate': { id: SPEAKER },
          'rdf:object': { id: `${ORIGIN}/vocab/${PROJECT}/c/k-joseph` },
        },
      ],
      target: {
        type: 'SpecificResource',
        source: `${ORIGIN}/recordings/1`,
        scope: `${ORIGIN}/projects/${PROJECT}`,
        selector: {
          type: 'FragmentSelector',
          conformsTo: 'http://www.w3.org/TR/media-frags/',
          value: 't=62,95',
        },
      },
    })
  })

  it('jsonld.js and jsonld-streaming-parser read four rdf:Statements about the segment', async () => {
    const doc = await served(FOUR())
    const nquads = (await jsonld.toRDF(doc, {
      format: 'application/n-quads',
      documentLoader,
    })) as unknown as string
    // In predicate order: relators (id.loc.gov) sorts before dcterms (purl.org).
    const expected = [
      { subject: [`<${SEGMENT}>`], predicate: [`<${SPEAKER}>`], object: [`<${items.person}>`] },
      { subject: [`<${SEGMENT}>`], predicate: [`<${DC}spatial>`], object: [`<${items.place}>`] },
      {
        subject: [`<${SEGMENT}>`],
        predicate: [`<${DC}temporal>`],
        object: ['"1962"^^<http://www.w3.org/2001/XMLSchema#gYear>'],
      },
      { subject: [`<${SEGMENT}>`], predicate: [`<${DC}title>`], object: ['"The last ferry"@en'] },
    ]
    expect(statements(nquads)).toEqual(expected)
    // Each value body is also an oa:TextualBody with its purpose and its text.
    expect(nquads).toContain(
      '<http://www.w3.org/ns/oa#hasPurpose> <http://www.w3.org/ns/oa#tagging>',
    )
    expect(nquads).toContain(`<${RDF}value> "Fort Kochi"`)
    expect(nquads.match(/<http:\/\/www\.w3\.org\/ns\/oa#hasBody>/g)).toHaveLength(5)
    // The second parser gives the same graph.
    const other = await streamed(doc)
    const canon = (text: string) =>
      jsonld.canonize(text, {
        algorithm: 'URDNA2015',
        inputFormat: 'application/n-quads',
        format: 'application/n-quads',
      })
    expect(await canon(other)).toBe(await canon(nquads))
  })

  it('an own answer is a blank node with the class of the list and a label', async () => {
    const doc = await served([{ property: SPEAKER, text: 'Ravi' }] as never)
    expect(doc.body[1]['rdf:object']).toEqual({
      type: 'http://xmlns.com/foaf/0.1/Person',
      'rdfs:label': { '@value': 'Ravi', '@language': 'en' },
    })
    const expected = [
      {
        subject: [`<${SEGMENT}>`],
        predicate: [`<${SPEAKER}>`],
        object: [{ type: ['<http://xmlns.com/foaf/0.1/Person>'], label: ['"Ravi"@en'] }],
      },
    ]
    const nquads = (await jsonld.toRDF(doc, {
      format: 'application/n-quads',
      documentLoader,
    })) as unknown as string
    expect(statements(nquads)).toEqual(expected)
    expect(statements(await streamed(doc))).toEqual(expected)
  })

  it('compacts back to the stored record, with CURIEs for known predicates; the graph is the same', async () => {
    const doc = await served(FOUR())
    const expanded = await jsonld.expand(doc, { documentLoader })
    const compacted = await jsonld.compact(expanded, ANNO, { documentLoader })
    expect(await jsonld.expand(compacted, { documentLoader })).toEqual(expanded)
    // jsonld.js writes an `{ id }` IRI as a CURIE when anno.jsonld has its prefix. The
    // stored record keeps full IRIs (design/vocab.md §3.2 rule 3); nothing else differs.
    const curie = (iri: string) => iri.replace(DC, 'dcterms:')
    expect(compacted).toEqual({
      ...doc,
      body: doc.body.map((body: Record<string, { id: string }>) =>
        body['rdf:predicate']
          ? { ...body, 'rdf:predicate': { id: curie(body['rdf:predicate'].id) } }
          : body,
      ),
    })
  })

  it('a reply with values gives reply-and-values', async () => {
    await served(FOUR())
    const reply = await stories.saveDraft(asha, {
      id: '0192a3b4-7c1d-7e00-8000-000000000002',
      project: PROJECT,
      recording: '1',
      replyTo: ID,
      bodies: [{ kind: 'text', value: 'Yes.' }],
      values: [{ property: `${DC}title`, text: 'No' }],
    })
    expect(reply).toEqual({ ok: false, error: { code: 'reply-and-values' } })
  })

  it('refills the form: ownDrafts gives the values, inputsOf the input', async () => {
    await stories.saveDraft(asha, input(FOUR()))
    const [own] = await stories.ownDrafts(asha, { project: PROJECT, recording: '1' })
    expect(await vocabulary.inputsOf(PROJECT, own.values)).toEqual(FOUR())
  })
})
