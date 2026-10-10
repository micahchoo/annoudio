// SKOS serialisation and parsing. Pure: no Payload. The module interface (`exportSkos`,
// `importSkos`) is the only caller; tests go through it.

import { JsonLdParser } from 'jsonld-streaming-parser'
import { DataFactory, Parser, Writer, type Quad, type Quad_Object } from 'n3'

export const SKOS = 'http://www.w3.org/2004/02/skos/core#'
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const OWL_DEPRECATED = 'http://www.w3.org/2002/07/owl#deprecated'
const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean'

export type SkosFormat = 'turtle' | 'json-ld'

/** One concept as SKOS sees it. `hidden` is `owl:deprecated true`. */
export interface SkosConcept {
  iri: string
  label: string
  language?: string
  /** The IRI of the broader concept. */
  parent?: string
  hidden: boolean
  /** The same thing in a different system: `skos:exactMatch`, for an entity `owl:sameAs`. */
  sameAs?: string
}

export interface SkosScheme {
  iri: string
  label: string
  concepts: SkosConcept[]
  /** An entity list: each entity is an instance of `class`, labelled with `rdfs:label`. */
  entities?: { class: string }
}

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs'

/** The scheme as Turtle or as JSON-LD with an inline context. Same triples in both. */
export function serialise(scheme: SkosScheme, format: SkosFormat): string {
  return format === 'turtle' ? turtle(scheme) : JSON.stringify(jsonLd(scheme), null, 2)
}

/** The triples of a scheme: the same in the SKOS file and in the linked data export. */
export function schemeQuads(scheme: SkosScheme): Quad[] {
  const { namedNode, literal, quad } = DataFactory
  const out: Quad[] = []
  const s = namedNode(scheme.iri)
  const add = (subject: string, predicate: string, object: Quad_Object) =>
    out.push(quad(namedNode(subject), namedNode(predicate), object))
  add(scheme.iri, RDF_TYPE, namedNode(`${SKOS}ConceptScheme`))
  add(scheme.iri, `${SKOS}prefLabel`, literal(scheme.label))
  for (const concept of scheme.concepts) {
    if (!concept.parent) add(scheme.iri, `${SKOS}hasTopConcept`, namedNode(concept.iri))
  }
  for (const concept of scheme.concepts) {
    if (scheme.entities) {
      add(concept.iri, RDF_TYPE, namedNode(scheme.entities.class))
      add(concept.iri, RDFS_LABEL, literal(concept.label, concept.language))
    } else {
      add(concept.iri, RDF_TYPE, namedNode(`${SKOS}Concept`))
      add(concept.iri, `${SKOS}prefLabel`, literal(concept.label, concept.language))
    }
    add(concept.iri, `${SKOS}inScheme`, s)
    if (concept.sameAs) {
      add(
        concept.iri,
        scheme.entities ? OWL_SAME_AS : `${SKOS}exactMatch`,
        namedNode(concept.sameAs),
      )
    }
    if (concept.parent) add(concept.iri, `${SKOS}broader`, namedNode(concept.parent))
    else add(concept.iri, `${SKOS}topConceptOf`, s)
    if (concept.hidden) add(concept.iri, OWL_DEPRECATED, literal('true', namedNode(XSD_BOOLEAN)))
  }
  return out
}

function turtle(scheme: SkosScheme): string {
  const writer = new Writer({
    prefixes: { skos: SKOS, owl: 'http://www.w3.org/2002/07/owl#' },
  })
  for (const q of schemeQuads(scheme)) writer.addQuad(q)
  let out = ''
  writer.end((error, result) => {
    if (error) throw error
    out = result
  })
  return out
}

function jsonLd(scheme: SkosScheme) {
  const id = { '@type': '@id' }
  return {
    '@context': {
      skos: SKOS,
      owl: 'http://www.w3.org/2002/07/owl#',
      prefLabel: 'skos:prefLabel',
      inScheme: { '@id': 'skos:inScheme', ...id },
      broader: { '@id': 'skos:broader', ...id },
      topConceptOf: { '@id': 'skos:topConceptOf', ...id },
      hasTopConcept: { '@id': 'skos:hasTopConcept', ...id, '@container': '@set' },
      deprecated: { '@id': 'owl:deprecated' },
      exactMatch: { '@id': 'skos:exactMatch', ...id },
      sameAs: { '@id': 'owl:sameAs', ...id },
      label: { '@id': 'http://www.w3.org/2000/01/rdf-schema#label' },
    },
    '@graph': [
      {
        '@id': scheme.iri,
        '@type': 'skos:ConceptScheme',
        prefLabel: scheme.label,
        hasTopConcept: scheme.concepts.filter((c) => !c.parent).map((c) => c.iri),
      },
      ...scheme.concepts.map((concept) => ({
        '@id': concept.iri,
        '@type': scheme.entities ? scheme.entities.class : 'skos:Concept',
        [scheme.entities ? 'label' : 'prefLabel']: concept.language
          ? { '@value': concept.label, '@language': concept.language }
          : concept.label,
        ...(concept.sameAs ? { [scheme.entities ? 'sameAs' : 'exactMatch']: concept.sameAs } : {}),
        inScheme: scheme.iri,
        ...(concept.parent ? { broader: concept.parent } : { topConceptOf: scheme.iri }),
        ...(concept.hidden ? { deprecated: true } : {}),
      })),
    ],
  }
}

/** A concept as a document states it. Absent facts are absent, not false. */
export interface ParsedConcept {
  iri: string
  labels: { value: string; language?: string }[]
  /** The broader concepts: `skos:broader` of this concept, and `skos:narrower` of others. */
  parents: string[]
  hidden: boolean
  /** `skos:exactMatch` or `owl:sameAs`. */
  sameAs?: string
}

export class SkosParseError extends Error {}

/** The part of an RDF/JS quad that the parse reads. Both parsers give it. */
interface Triple {
  subject: { termType: string; value: string }
  predicate: { value: string }
  object: { termType: string; value: string; language?: string }
}

/**
 * The `skos:Concept` resources of a Turtle or JSON-LD document, in document order. The
 * format comes from the first character: `{` or `[` is JSON-LD. A JSON-LD document must
 * hold its context inline: the parser loads no remote context.
 */
export async function parse(text: string): Promise<ParsedConcept[]> {
  const quads = /^\s*[[{]/.test(text) ? await parseJsonLd(text) : parseTurtle(text)
  return conceptsIn(quads)
}

/** The `skos:Concept` resources of a set of triples, in document order. */
export function conceptsIn(quads: Triple[]): ParsedConcept[] {
  const types = new Set<string>()
  const inScheme = new Set<string>()
  const concepts = new Map<string, ParsedConcept & { entityLabels?: ParsedConcept['labels'] }>()
  const conceptOf = (iri: string) => {
    let found = concepts.get(iri)
    if (!found) concepts.set(iri, (found = { iri, labels: [], parents: [], hidden: false }))
    return found
  }
  // A blank node gets its `_:` name, so the import can report it.
  const name = (term: Triple['subject']) =>
    term.termType === 'BlankNode' ? `_:${term.value}` : term.value
  for (const q of quads) {
    if (q.subject.termType !== 'NamedNode' && q.subject.termType !== 'BlankNode') continue
    const subject = name(q.subject)
    const predicate = q.predicate.value
    if (predicate === RDF_TYPE && q.object.value === `${SKOS}Concept`) {
      types.add(subject)
      conceptOf(subject)
    } else if (predicate === `${SKOS}prefLabel` && q.object.termType === 'Literal') {
      const language = q.object.language
      conceptOf(subject).labels.push({ value: q.object.value, ...(language ? { language } : {}) })
    } else if (predicate === `${SKOS}broader` && q.object.termType === 'NamedNode') {
      conceptOf(subject).parents.push(q.object.value)
    } else if (predicate === `${SKOS}narrower` && q.object.termType === 'NamedNode') {
      conceptOf(q.object.value).parents.push(subject)
    } else if (predicate === OWL_DEPRECATED && q.object.termType === 'Literal') {
      conceptOf(subject).hidden = q.object.value === 'true' || q.object.value === '1'
    } else if (
      (predicate === `${SKOS}exactMatch` || predicate === OWL_SAME_AS) &&
      q.object.termType === 'NamedNode'
    ) {
      conceptOf(subject).sameAs ??= q.object.value
    } else if (predicate === RDFS_LABEL && q.object.termType === 'Literal') {
      // The label of an entity (an entity list exports `rdfs:label`, not `skos:prefLabel`).
      const language = q.object.language
      const entity = conceptOf(subject)
      entity.entityLabels = [
        ...(entity.entityLabels ?? []),
        { value: q.object.value, ...(language ? { language } : {}) },
      ]
    } else if (predicate === `${SKOS}inScheme` && q.object.termType === 'NamedNode') {
      inScheme.add(subject)
    }
  }
  // A concept: typed `skos:Concept`, or an entity of a scheme with an `rdfs:label`.
  return [...concepts.values()].flatMap(({ entityLabels, ...concept }) => {
    if (types.has(concept.iri)) return [concept]
    if (inScheme.has(concept.iri) && entityLabels?.length)
      return [{ ...concept, labels: entityLabels }]
    return []
  })
}

function parseTurtle(text: string): Triple[] {
  try {
    return new Parser({ format: 'text/turtle' }).parse(text)
  } catch (error) {
    throw new SkosParseError(error instanceof Error ? error.message : String(error))
  }
}

function parseJsonLd(text: string): Promise<Triple[]> {
  return new Promise((resolve, reject) => {
    const quads: Triple[] = []
    const parser = new JsonLdParser({
      documentLoader: {
        load: async (url: string) => {
          throw new SkosParseError(
            `The file loads a context from ${url}. Put the context in the file.`,
          )
        },
      },
    })
    parser.on('data', (q: Triple) => quads.push(q))
    parser.on('error', (error: Error) =>
      reject(error instanceof SkosParseError ? error : new SkosParseError(error.message)),
    )
    parser.on('end', () => resolve(quads))
    parser.end(text)
  })
}

/** One `skos:ConceptScheme` of a file and its concepts. `iri` '' holds concepts with no scheme. */
export interface ParsedScheme {
  iri: string
  label?: { value: string; language?: string }
  concepts: ParsedConcept[]
}

/**
 * The concept schemes of a set of triples. A concept belongs to the scheme of its
 * `skos:inScheme` or `skos:topConceptOf`, or of a `skos:hasTopConcept`; else to ''.
 */
export function schemesIn(quads: Triple[]): ParsedScheme[] {
  const concepts = conceptsIn(quads)
  const schemes = new Map<string, ParsedScheme>()
  const labels = new Map<string, { value: string; language?: string }[]>()
  const schemeOf = new Map<string, string>()
  for (const q of quads) {
    const s = q.subject.value
    const o = q.object.value
    if (
      q.predicate.value === RDF_TYPE &&
      o === `${SKOS}ConceptScheme` &&
      q.subject.termType === 'NamedNode'
    ) {
      if (!schemes.has(s)) schemes.set(s, { iri: s, concepts: [] })
    } else if (q.predicate.value === `${SKOS}prefLabel` && q.object.termType === 'Literal') {
      labels.set(s, [
        ...(labels.get(s) ?? []),
        { value: o, ...(q.object.language ? { language: q.object.language } : {}) },
      ])
    } else if (
      (q.predicate.value === `${SKOS}inScheme` || q.predicate.value === `${SKOS}topConceptOf`) &&
      q.object.termType === 'NamedNode'
    ) {
      if (!schemeOf.has(s)) schemeOf.set(s, o)
    } else if (q.predicate.value === `${SKOS}hasTopConcept` && q.object.termType === 'NamedNode') {
      if (!schemeOf.has(o)) schemeOf.set(o, s)
    }
  }
  for (const concept of concepts) {
    const iri = schemeOf.get(concept.iri) ?? ''
    if (!schemes.has(iri)) schemes.set(iri, { iri, concepts: [] })
    schemes.get(iri)!.concepts.push(concept)
  }
  return [...schemes.values()]
    .filter((scheme) => scheme.concepts.length > 0)
    .map((scheme) => {
      const label =
        labels.get(scheme.iri)?.find((l) => l.language === 'en') ?? labels.get(scheme.iri)?.[0]
      return label ? { ...scheme, label } : scheme
    })
}
