// Files for other systems (design/vocab.md §3.4, §6, slice 10): the questions as SHACL and
// as an Omeka S template round-trip (export, import, no change); the linked data of
// §3.3 as TriG has one named graph with five triples; only published stories export.
// Through the interface: `vocabulary.exportFile`, `importFile`, `describe`, `profile`,
// `stories.exportQuads`, and `writeQuads`.

import { Parser } from 'n3'
import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Stories } from '@/modules/stories'
import { createVocabulary, writeQuads, type Field, type Vocabulary } from '@/modules/vocabulary'

import { ORIGIN, PROJECT, makeStories, operator, seed, startPayload } from '../stories/world'

const DC = 'http://purl.org/dc/terms/'
const SPEAKER = 'http://id.loc.gov/vocabulary/relators/spk'
const ID = '0192a3b4-7c1d-7e00-8000-000000000001'

let payload: Payload
let stories: Stories
let vocabulary: Vocabulary

beforeAll(async () => {
  payload = await startPayload()
})

beforeEach(async () => {
  await seed(payload)
  stories = makeStories(payload)
  vocabulary = createVocabulary({ payload, origin: ORIGIN, stories: () => stories })
  for (const key of ['title', 'when', 'place', 'speaker', 'link']) {
    const added = await vocabulary.addField(operator, PROJECT, { from: 'catalogue', key })
    if (!added.ok) throw new Error(added.error)
  }
  const boats = await vocabulary.addField(operator, PROJECT, {
    from: 'own',
    label: 'Boats',
    help: 'How many boats you hear.',
    valueType: 'number',
  })
  if (!boats.ok) throw new Error(boats.error)
  await vocabulary.updateField(operator, PROJECT, `${DC}spatial`, { required: true })
})

/** The keys that a file for other systems keeps. */
const shape = (fields: Field[]) =>
  fields.map(({ property, label, help, valueType, required, list }) => ({
    property,
    label,
    help,
    valueType,
    required,
    list: list?.key,
  }))

async function roundTrip(format: 'shacl-turtle' | 'shacl-jsonld' | 'omeka') {
  const before = (await vocabulary.profile(PROJECT))!.fields
  const file = (await vocabulary.exportFile(PROJECT, { kind: 'profile', format }))!
  const bytes = new TextEncoder().encode(file.body)
  // The same project: every question is known; nothing changes.
  const same = await vocabulary.importFile(
    operator,
    { name: file.filename, bytes },
    { project: PROJECT, apply: true },
  )
  expect(same.ok && same.report.form?.fields.every((f) => f.status === 'known')).toBe(true)
  expect((await vocabulary.profile(PROJECT))!.fields).toEqual(before)
  // With no questions: the file gives them back, in order.
  for (const field of before) await vocabulary.removeField(operator, PROJECT, field.property)
  const back = await vocabulary.importFile(
    operator,
    { name: file.filename, bytes },
    { project: PROJECT, apply: true },
  )
  expect(back.ok && back.report.form?.fields.map((f) => f.status)).toEqual(before.map(() => 'new'))
  return { before, after: (await vocabulary.profile(PROJECT))!.fields, file }
}

describe('the questions as a file', () => {
  it('SHACL in Turtle round-trips: export, import, no change', async () => {
    const { before, after, file } = await roundTrip('shacl-turtle')
    expect(file.body).toContain('a sh:NodeShape')
    expect(file.body).toContain('sh:path dcterms:spatial')
    expect(shape(after)).toEqual(shape(before))
    expect(after.map((f) => f.max)).toEqual(before.map((f) => f.max))
  })

  it('SHACL in JSON-LD round-trips', async () => {
    const { before, after } = await roundTrip('shacl-jsonld')
    expect(shape(after)).toEqual(shape(before))
  })

  it('an Omeka S resource template round-trips', async () => {
    const { before, after, file } = await roundTrip('omeka')
    const template = JSON.parse(file.body)
    // The seed gives River Voices the question Topics first.
    expect(template['o:resource_template_property'][1]).toMatchObject({
      vocabulary_namespace_uri: DC,
      local_name: 'title',
      'o:alternate_label': 'Short title',
      data_types: [{ name: 'literal' }],
    })
    expect(
      template['o:resource_template_property'].map(
        (p: { data_types: { name: string }[] }) => p.data_types[0].name,
      ),
    ).toEqual([
      'customvocab:Topics',
      'literal',
      'numeric:timestamp',
      'customvocab:Places',
      'customvocab:People',
      'uri',
      'numeric:integer',
    ])
    expect(shape(after)).toEqual(shape(before))
  })

  it('a form into a project without the lists leaves those questions out, and says why', async () => {
    const file = (await vocabulary.exportFile(PROJECT, {
      kind: 'profile',
      format: 'shacl-turtle',
    }))!
    const other = await vocabulary.importFile(
      operator,
      { name: file.filename, bytes: new TextEncoder().encode(file.body) },
      { project: 'hill-songs', apply: false },
    )
    expect(other.ok && other.report.form?.fields.map((f) => [f.label, f.status, f.reason])).toEqual(
      [
        // Hill Songs asks Topics already (its own list).
        ['Topics', 'known', undefined],
        ['Short title', 'new', undefined],
        ['When it happened', 'new', undefined],
        ['Place', 'left-out', 'unknown-list'],
        ['Who is speaking', 'left-out', 'unknown-list'],
        ['Link to more', 'new', undefined],
        // An own property of River Voices is not for another project.
        ['Boats', 'left-out', 'unknown-term'],
      ],
    )
  })
})

describe('linked data', () => {
  it('the TriG of §3.3 has one named graph with five triples; a draft does not export', async () => {
    const place = await vocabulary.addItem(operator, PROJECT, 'places', { label: 'Fort Kochi' })
    const person = await vocabulary.addItem(operator, PROJECT, 'people', { label: 'K. Joseph' })
    if (!place.ok || !person.ok) throw new Error('addItem failed')
    const input = (id: string, start: number) => ({
      id,
      project: PROJECT,
      recording: '1',
      start,
      end: start + 33,
      bodies: [{ kind: 'text' as const, value: 'My father ran this ferry from Fort Kochi.' }],
      values: [
        { property: `${DC}title`, text: 'The last ferry' },
        { property: `${DC}temporal`, date: { year: 1962 } },
        { property: `${DC}spatial`, item: place.iri },
        { property: SPEAKER, item: person.iri },
      ],
    })
    const asha = { memberId: 'm-100', nickname: 'Asha' }
    expect((await stories.saveDraft(asha, input(ID, 62))).ok).toBe(true)
    await stories.publish(operator, ID)
    // A second story that waits for review: not in the export.
    expect(
      (await stories.saveDraft(asha, input('0192a3b4-7c1d-7e00-8000-000000000002', 10))).ok,
    ).toBe(true)

    const quads = []
    for await (const q of stories.exportQuads(operator, { project: PROJECT })) quads.push(q)
    quads.push(...(await vocabulary.describe(PROJECT)))
    const trig = writeQuads(quads, 'trig')
    const parsed = new Parser({ format: 'application/trig' }).parse(trig)
    const graphs = new Map<string, string[]>()
    for (const q of parsed) {
      if (q.graph.termType === 'DefaultGraph') continue
      graphs.set(q.graph.value, [
        ...(graphs.get(q.graph.value) ?? []),
        `${q.predicate.value} ${q.object.value}`,
      ])
    }
    const story = `${ORIGIN}/stories/${PROJECT}/1/${ID}`
    expect([...graphs.keys()]).toEqual([story])
    expect(graphs.get(story)!.sort()).toEqual(
      [
        `${DC}isPartOf ${ORIGIN}/recordings/1`,
        `${DC}spatial ${place.iri}`,
        `${DC}temporal 1962`,
        `${DC}title The last ferry`,
        `${SPEAKER} ${person.iri}`,
      ].sort(),
    )
    // Every quad of the graph is about the segment.
    expect(
      parsed
        .filter((q) => q.graph.value === story)
        .every((q) => q.subject.value === `${ORIGIN}/recordings/1#t=62,95`),
    ).toBe(true)
    // Layer 1 has the stored WADM; layer 3 the shape and the items.
    expect(
      parsed.some(
        (q) => q.subject.value === story && q.object.value === 'http://www.w3.org/ns/oa#Annotation',
      ),
    ).toBe(true)
    expect(
      parsed.some((q) => q.subject.value === place.iri && q.predicate.value.endsWith('prefLabel')),
    ).toBe(true)
    expect(parsed.some((q) => q.object.value === 'http://www.w3.org/ns/shacl#NodeShape')).toBe(true)
    expect(trig).not.toContain('0192a3b4-7c1d-7e00-8000-000000000002')
    // Turtle merges the graph into the default graph; JSON-LD keeps it as a @graph.
    const turtle = new Parser({ format: 'text/turtle' }).parse(writeQuads(quads, 'turtle'))
    expect(turtle.every((q) => q.graph.termType === 'DefaultGraph')).toBe(true)
    const jsonld = JSON.parse(writeQuads(quads, 'jsonld'))
    expect(
      jsonld.find((node: { '@id': string }) => node['@id'] === story && '@graph' in node)['@graph'],
    ).toHaveLength(1)
  })
})
