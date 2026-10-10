// The bundled ontologies (design/vocab.md §2, slice 1): the seed, the term search, and
// the catalogue properties. Through the interface: `createVocabulary(...).searchTerms`,
// and the `ontologies` collection as the admin uses it.

import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { BUNDLED, CATALOGUE, createVocabulary, type Vocabulary } from '@/modules/vocabulary'

import { ORIGIN, startPayload } from '../stories/world'

let payload: Payload
let vocabulary: Vocabulary

beforeAll(async () => {
  payload = await startPayload()
  vocabulary = createVocabulary({ payload, origin: ORIGIN })
})

describe('the bundled ontologies', () => {
  it('are seeded once, with their prefixes and namespaces', async () => {
    await vocabulary.searchTerms({ kind: 'property', text: 'title' })
    // A second instance seeds again: nothing doubles.
    await createVocabulary({ payload, origin: ORIGIN }).searchTerms({ kind: 'class', text: 'x' })
    const { docs } = await payload.find({ collection: 'ontologies', sort: 'prefix', limit: 50 })
    expect(docs.map((doc) => [doc.prefix, doc.namespace, doc.source])).toEqual([
      ['dcterms', 'http://purl.org/dc/terms/', 'bundled'],
      ['dctypes', 'http://purl.org/dc/dcmitype/', 'bundled'],
      ['foaf', 'http://xmlns.com/foaf/0.1/', 'bundled'],
      ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'bundled'],
      ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#', 'bundled'],
      ['relators', 'http://id.loc.gov/vocabulary/relators/', 'bundled'],
      ['schema', 'http://schema.org/', 'bundled'],
      ['skos', 'http://www.w3.org/2004/02/skos/core#', 'bundled'],
    ])
    const terms = await payload.count({ collection: 'ontology-terms' })
    expect(terms.totalDocs).toBe(BUNDLED.reduce((n, o) => n + o.terms.length, 0))
  })

  it('give dcterms:spatial first for "place"', async () => {
    const found = await vocabulary.searchTerms({ kind: 'property', text: 'place' })
    expect(found[0]).toMatchObject({
      iri: 'http://purl.org/dc/terms/spatial',
      curie: 'dcterms:spatial',
      label: 'Spatial Coverage',
      ontology: { prefix: 'dcterms', label: 'Dublin Core' },
    })
  })

  it('search classes apart from properties, and in one ontology', async () => {
    const people = await vocabulary.searchTerms({ kind: 'class', text: 'person', ontology: 'foaf' })
    expect(people.map((t) => t.curie)).toContain('foaf:Person')
    expect(people.every((t) => t.kind === 'class' && t.ontology.prefix === 'foaf')).toBe(true)
    const places = await vocabulary.searchTerms({
      kind: 'class',
      text: 'Place',
      ontology: 'schema',
    })
    expect(places[0].iri).toBe('http://schema.org/Place')
  })

  it('have a term for each property of the catalogue', async () => {
    expect(CATALOGUE).toHaveLength(14)
    for (const entry of CATALOGUE) {
      const found = await vocabulary.searchTerms({ kind: 'property', text: entry.property })
      expect(
        found.map((t) => t.iri),
        entry.key,
      ).toContain(entry.property)
    }
    const speaker = await vocabulary.searchTerms({ kind: 'property', text: 'speaker' })
    expect(speaker[0]).toMatchObject({ curie: 'relators:spk', label: 'speaker' })
  })

  it('cannot be removed', async () => {
    const { docs } = await payload.find({
      collection: 'ontologies',
      where: { prefix: { equals: 'foaf' } },
    })
    await expect(payload.delete({ collection: 'ontologies', id: docs[0].id })).rejects.toThrow(
      'comes with Annoudio',
    )
  })
})
