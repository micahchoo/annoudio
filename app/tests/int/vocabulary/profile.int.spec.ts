// Fields and lists of a project, and `resolve` (design/vocab.md §2, §3.1, §9.2, slice 2).
// Through the interface: `createVocabulary(...)`.

import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createVocabulary, type ValueInput, type Vocabulary } from '@/modules/vocabulary'

import { ORIGIN, PROJECT, operator, seed, startPayload } from '../stories/world'

const DC = 'http://purl.org/dc/terms/'
const SUBJECT = `${DC}subject`
const SPATIAL = `${DC}spatial`
const TEMPORAL = `${DC}temporal`
const TITLE = `${DC}title`
const SPEAKER = 'http://id.loc.gov/vocabulary/relators/spk'
const LINK = 'http://www.w3.org/2000/01/rdf-schema#seeAlso'
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const FOAF_PERSON = 'http://xmlns.com/foaf/0.1/Person'
const SKOS_CONCEPT = 'http://www.w3.org/2004/02/skos/core#Concept'

let payload: Payload
let vocabulary: Vocabulary

beforeAll(async () => {
  payload = await startPayload()
  vocabulary = createVocabulary({ payload, origin: ORIGIN })
})

beforeEach(async () => {
  await seed(payload)
})

const add = (key: string) => vocabulary.addField(operator, PROJECT, { from: 'catalogue', key })

/** Add the four fields of §3.3, an item "Fort Kochi" in Places and "K. Joseph" in People. */
async function riverVoices() {
  for (const key of ['title', 'when', 'place', 'speaker']) expect((await add(key)).ok).toBe(true)
  const place = await vocabulary.addItem(operator, PROJECT, 'places', { label: 'Fort Kochi' })
  const person = await vocabulary.addItem(operator, PROJECT, 'people', { label: 'K. Joseph' })
  if (!place.ok || !person.ok) throw new Error('addItem failed')
  return { place: place.iri, person: person.iri }
}

describe('fields', () => {
  it('a catalogue question makes the field and its list; a second one reuses the list', async () => {
    const place = await add('place')
    expect(place).toEqual({
      ok: true,
      field: {
        property: SPATIAL,
        curie: 'dcterms:spatial',
        label: 'Place',
        help: 'Where did this happen?',
        valueType: 'list',
        list: {
          key: 'places',
          iri: `${ORIGIN}/vocab/${PROJECT}/s/places`,
          label: 'Places',
          kind: 'items',
          size: 0,
        },
        required: false,
        max: 3,
        showAs: 'line',
        allowOwn: true,
        hidden: false,
        usage: 0,
      },
    })
    await add('speaker')
    await add('interviewer')
    const lists = await vocabulary.lists(PROJECT)
    // The seed has two items in river-voices: they are in the list Topics, and the project
    // asks the question Topics (as the migration does).
    expect(
      lists.map(({ key, kind, class: c, askedBy }) => ({ key, kind, class: c, askedBy })),
    ).toEqual([
      { key: 'topics', kind: 'items', class: undefined, askedBy: ['Topics'] },
      { key: 'places', kind: 'items', class: undefined, askedBy: ['Place'] },
      {
        key: 'people',
        kind: 'entities',
        class: FOAF_PERSON,
        askedBy: ['Who is speaking', 'Who asks the questions'],
      },
    ])
    const kinds = await add('kind')
    expect(kinds.ok && kinds.field.list?.size).toBe(4)
    // Label order is the database collation; the test reads the set.
    expect(
      (await vocabulary.choices(PROJECT, 'kinds-of-sound')).map((c) => c.label).sort(),
    ).toEqual(['Music', 'Song', 'Sounds of a place', 'Speech'])
  })

  it('one property has one field in a project', async () => {
    await add('place')
    expect(await add('place')).toEqual({ ok: false, error: 'property-taken' })
    expect(
      await vocabulary.addField(operator, PROJECT, {
        from: 'term',
        property: SPATIAL,
        label: 'Where',
        valueType: 'text',
      }),
    ).toEqual({ ok: false, error: 'property-taken' })
    // Another project can have it.
    expect(
      (await vocabulary.addField(operator, 'hill-songs', { from: 'catalogue', key: 'place' })).ok,
    ).toBe(true)
  })

  it('a field from an ontology needs a property and a list that fits; an own question mints a property', async () => {
    expect(
      await vocabulary.addField(operator, PROJECT, {
        from: 'term',
        property: FOAF_PERSON,
        label: 'X',
        valueType: 'text',
      }),
    ).toEqual({ ok: false, error: 'not-a-property' })
    expect(
      await vocabulary.addField(operator, PROJECT, {
        from: 'term',
        property: `${DC}nothing`,
        label: 'X',
        valueType: 'text',
      }),
    ).toEqual({ ok: false, error: 'unknown-term' })
    expect(
      await vocabulary.addField(operator, PROJECT, {
        from: 'term',
        property: `${DC}coverage`,
        label: 'X',
        valueType: 'list',
      }),
    ).toEqual({ ok: false, error: 'bad-list' })
    const boat = await vocabulary.addField(operator, PROJECT, {
      from: 'own',
      label: 'Boat name',
      help: 'The name on the boat.',
      valueType: 'text',
    })
    expect(boat).toMatchObject({
      ok: true,
      field: {
        property: `${ORIGIN}/vocab/${PROJECT}/p/boat-name`,
        curie: `${ORIGIN}/vocab/${PROJECT}/p/boat-name`,
        label: 'Boat name',
      },
    })
    expect((await vocabulary.searchTerms({ kind: 'property', text: 'boat name' })).length).toBe(0)
  })

  it('move, change and hide; the profile for new stories leaves hidden fields out', async () => {
    for (const key of ['title', 'when', 'place']) await add(key)
    await vocabulary.moveField(operator, PROJECT, SPATIAL, 1)
    expect((await vocabulary.profile(PROJECT))?.fields.map((f) => f.label)).toEqual([
      'Place',
      'Topics',
      'Short title',
      'When it happened',
    ])
    await vocabulary.removeField(operator, PROJECT, SUBJECT)
    const changed = await vocabulary.updateField(operator, PROJECT, TITLE, {
      label: 'Title',
      required: true,
      hidden: true,
    })
    expect(changed).toMatchObject({
      ok: true,
      field: { label: 'Title', required: true, hidden: true },
    })
    expect(
      (await vocabulary.profile(PROJECT, { forNewStories: true }))?.fields.map((f) => f.label),
    ).toEqual(['Place', 'When it happened'])
    expect(await vocabulary.labels(PROJECT)).toEqual([
      { property: SPATIAL, label: 'Place', showAs: 'line', valueType: 'list' },
      { property: TITLE, label: 'Title', showAs: 'line', valueType: 'text' },
      { property: TEMPORAL, label: 'When it happened', showAs: 'line', valueType: 'date' },
    ])
    expect(await vocabulary.updateField(operator, PROJECT, TITLE, { valueType: 'list' })).toEqual({
      ok: false,
      error: 'bad-list',
    })
    expect((await vocabulary.removeField(operator, PROJECT, TITLE)).ok).toBe(true)
    expect((await vocabulary.profile(PROJECT))?.fields.map((f) => f.label)).toEqual([
      'Place',
      'When it happened',
    ])
  })
})

describe('resolve', () => {
  it('gives the objects of design/vocab.md §3.3', async () => {
    const { place, person } = await riverVoices()
    const result = await vocabulary.resolve(PROJECT, [
      { property: TITLE, text: ' The last ferry ' },
      { property: TEMPORAL, date: { year: 1962 } },
      { property: SPATIAL, item: place },
      { property: SPEAKER, item: person },
    ])
    expect(result).toEqual({
      ok: true,
      values: [
        {
          property: TITLE,
          purpose: 'describing',
          text: 'The last ferry',
          language: 'ml',
          object: { literal: 'The last ferry', language: 'ml' },
        },
        {
          property: TEMPORAL,
          purpose: 'describing',
          text: '1962',
          object: { literal: '1962', datatype: `${XSD}gYear` },
        },
        { property: SPATIAL, purpose: 'tagging', text: 'Fort Kochi', object: { iri: place } },
        { property: SPEAKER, purpose: 'describing', text: 'K. Joseph', object: { iri: person } },
      ],
    })
  })

  it('gives own answers with the class of the list, the date datatypes and links', async () => {
    await riverVoices()
    await add('link')
    const result = await vocabulary.resolve(PROJECT, [
      { property: SPEAKER, text: 'Ravi' },
      { property: SPATIAL, text: 'North landing' },
      { property: TEMPORAL, date: { year: 1962, month: 5, day: 4 } },
      { property: LINK, link: { href: 'https://archive.example/ferry', label: 'Archive' } },
    ])
    expect(result.ok && result.values.map((v) => v.object)).toEqual([
      { literal: '1962-05-04', datatype: `${XSD}date` },
      { own: { label: 'North landing', language: 'ml', class: SKOS_CONCEPT } },
      { own: { label: 'Ravi', language: 'ml', class: FOAF_PERSON } },
      { iri: 'https://archive.example/ferry' },
    ])
    const month = await vocabulary.resolve(PROJECT, [
      { property: TEMPORAL, date: { year: 1962, month: 5 } },
    ])
    expect(month.ok && month.values[0].object).toEqual({
      literal: '1962-05',
      datatype: `${XSD}gYearMonth`,
    })
    // The form gets the same input back.
    if (!result.ok) throw new Error('resolve failed')
    expect(await vocabulary.inputsOf(PROJECT, result.values)).toEqual([
      { property: TEMPORAL, date: { year: 1962, month: 5, day: 4 } },
      { property: SPATIAL, text: 'North landing' },
      { property: SPEAKER, text: 'Ravi' },
      { property: LINK, link: { href: 'https://archive.example/ferry', label: 'Archive' } },
    ])
  })

  describe('refuses with a code per field', () => {
    const cases: [string, (ids: { place: string; person: string }) => ValueInput[], string][] = [
      ['unknown-field', () => [{ property: `${DC}coverage`, text: 'x' }], `${DC}coverage`],
      [
        'too-many',
        () => [
          { property: TITLE, text: 'a' },
          { property: TITLE, text: 'b' },
        ],
        TITLE,
      ],
      [
        'unknown-item',
        () => [{ property: SPATIAL, item: `${ORIGIN}/vocab/${PROJECT}/c/nowhere` }],
        SPATIAL,
      ],
      ['unknown-item', ({ person }) => [{ property: SPATIAL, item: person }], SPATIAL],
      [
        'own-not-allowed',
        () => [{ property: 'http://purl.org/dc/terms/subject', text: 'Boats' }],
        `${DC}subject`,
      ],
      [
        'bad-date',
        () => [{ property: TEMPORAL, date: { year: 1962, month: 2, day: 30 } }],
        TEMPORAL,
      ],
      ['bad-date', () => [{ property: TEMPORAL, date: { year: 1962, day: 3 } }], TEMPORAL],
      ['bad-link', () => [{ property: LINK, link: { href: 'javascript:alert(1)' } }], LINK],
      ['bad-link', () => [{ property: LINK, link: { href: 'http://archive.example/' } }], LINK],
      ['too-long', () => [{ property: TITLE, text: 'x'.repeat(501) }], TITLE],
    ]
    for (const [code, input, property] of cases) {
      it(code, async () => {
        const ids = await riverVoices()
        await add('link')
        await add('topics')
        expect(await vocabulary.resolve(PROJECT, input(ids))).toEqual({
          ok: false,
          errors: [{ property, code }],
        })
      })
    }

    it('required, bad-number, hidden-field and hidden-item', async () => {
      const { place } = await riverVoices()
      await vocabulary.updateField(operator, PROJECT, SPATIAL, { required: true })
      expect(await vocabulary.resolve(PROJECT, [])).toEqual({
        ok: false,
        errors: [{ property: SPATIAL, code: 'required' }],
      })

      const count = await vocabulary.addField(operator, PROJECT, {
        from: 'own',
        label: 'Boats',
        valueType: 'number',
      })
      if (!count.ok) throw new Error('addField failed')
      expect(
        await vocabulary.resolve(PROJECT, [
          { property: SPATIAL, item: place },
          { property: count.field.property, text: '2 or 3' },
        ]),
      ).toEqual({
        ok: false,
        errors: [{ property: count.field.property, code: 'bad-number' }],
      })

      await vocabulary.updateField(operator, PROJECT, TITLE, { hidden: true })
      const kept = {
        property: TITLE,
        purpose: 'describing' as const,
        text: 'Old',
        object: { literal: 'Old', language: 'ml' },
      }
      expect(
        await vocabulary.resolve(PROJECT, [
          { property: SPATIAL, item: place },
          { property: TITLE, text: 'New' },
        ]),
      ).toEqual({
        ok: false,
        errors: [{ property: TITLE, code: 'hidden-field' }],
      })
      // A stored value of a hidden field carries over.
      const carried = await vocabulary.resolve(PROJECT, [{ property: SPATIAL, item: place }], {
        keep: [kept],
      })
      expect(carried.ok && carried.values.map((v) => v.text)).toEqual(['Old', 'Fort Kochi'])

      await payload.update({
        collection: 'concepts',
        where: { iri: { equals: place } },
        data: { hidden: true },
      })
      expect(await vocabulary.resolve(PROJECT, [{ property: SPATIAL, item: place }])).toEqual({
        ok: false,
        errors: [{ property: SPATIAL, code: 'hidden-item' }],
      })
      // A story that has the hidden item keeps it.
      const stored = {
        property: SPATIAL,
        purpose: 'tagging' as const,
        text: 'Fort Kochi',
        object: { iri: place },
      }
      expect(
        (
          await vocabulary.resolve(PROJECT, [{ property: SPATIAL, item: place }], {
            keep: [stored],
          })
        ).ok,
      ).toBe(true)
    })
  })
})
