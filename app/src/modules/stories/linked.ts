// The stories as linked data (design/vocab.md §3.4): layer 1, the stored WADM as RDF in
// the default graph; layer 2, the statements of the value bodies, asserted, in a named
// graph whose name is the story IRI, plus `{segment} dcterms:isPartOf {recording}`.
// The caller gives published stories only. No fetch: `anno.jsonld` is a local copy.

import { JsonLdParser } from 'jsonld-streaming-parser'
import { DataFactory, type Quad, type Quad_Object } from 'n3'

import anno from './context/anno.json'
import { isValueBody } from './shape'
import type { Annotation, ValueObject } from './types'

const ANNO = 'http://www.w3.org/ns/anno.jsonld'
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const IS_PART_OF = 'http://purl.org/dc/terms/isPartOf'

/** Layer 1 of one story. `n` keeps the blank nodes of each story apart. */
function wadmQuads(annotation: Annotation, n: number): Promise<Quad[]> {
  const { blankNode, quad } = DataFactory
  const rename = <T extends Quad['subject'] | Quad['object']>(term: T): T =>
    (term.termType === 'BlankNode' ? blankNode(`s${n}_${term.value}`) : term) as T
  return new Promise((resolve, reject) => {
    const out: Quad[] = []
    const parser = new JsonLdParser({
      documentLoader: {
        load: async (url: string) => {
          if (url !== ANNO) throw new Error(`stories: no fetch of ${url}`)
          return anno as never
        },
      },
    })
    parser.on('data', (q: Quad) =>
      out.push(quad(rename(q.subject), q.predicate, rename(q.object), q.graph)),
    )
    parser.on('error', reject)
    parser.on('end', () => resolve(out))
    parser.end(JSON.stringify(annotation))
  })
}

function objectOf(object: ValueObject, story: number, i: number, extra: Quad[]): Quad_Object {
  const { namedNode, literal, blankNode, quad } = DataFactory
  if ('id' in object) return namedNode(object.id)
  if ('rdfs:label' in object) {
    // An own answer: "a person named Ravi".
    const node = blankNode(`own${story}_${i}`)
    const label = object['rdfs:label']
    extra.push(quad(node, namedNode(RDF_TYPE), namedNode(object.type)))
    extra.push(quad(node, namedNode(RDFS_LABEL), literal(label['@value'], label['@language'])))
    return node
  }
  if ('type' in object) {
    const datatype = object.type.startsWith('xsd:') ? `${XSD}${object.type.slice(4)}` : object.type
    return literal(object['@value'], namedNode(datatype))
  }
  return literal(object['@value'], object['@language'])
}

/** Layers 1 and 2 of one published story. */
export async function storyQuads(annotation: Annotation, n: number): Promise<Quad[]> {
  const { namedNode, quad } = DataFactory
  const out = await wadmQuads(annotation, n)
  if (annotation.motivation !== 'commenting') return out
  const graph = namedNode(annotation.id)
  const values = annotation.body.filter(isValueBody)
  if (values.length === 0) return out
  const segment = namedNode(values[0]['rdf:subject'].id)
  out.push(quad(segment, namedNode(IS_PART_OF), namedNode(annotation.target.source), graph))
  for (const [i, body] of values.entries()) {
    const extra: Quad[] = []
    const object = objectOf(body['rdf:object'], n, i, extra)
    out.push(
      quad(namedNode(body['rdf:subject'].id), namedNode(body['rdf:predicate'].id), object, graph),
    )
    for (const q of extra) out.push(quad(q.subject, q.predicate, q.object, graph))
  }
  return out
}
