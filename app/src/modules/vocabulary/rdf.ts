// Read an RDF file into triples. Pure: no Payload. Four syntaxes: Turtle and N-Triples
// (`n3`), JSON-LD (`jsonld-streaming-parser`), RDF/XML (`rdfxml-streaming-parser`).
//
// No fetch (design/vocab.md §6): a JSON-LD file with a remote `@context` is refused, and
// the RDF/XML parser reads no DTD and no external entity. `owl:imports` is a triple like
// any other: nothing follows it.

import { JsonLdParser } from 'jsonld-streaming-parser'
import { DataFactory, Parser, Writer, type Quad } from 'n3'
import { RdfXmlParser } from 'rdfxml-streaming-parser'

export type RdfSyntax = 'turtle' | 'json-ld' | 'rdf-xml'

/** The part of an RDF/JS quad that the readers use. All three parsers give it. */
export interface Triple {
  subject: { termType: string; value: string }
  predicate: { value: string }
  object: {
    termType: string
    value: string
    language?: string
    datatype?: { value: string }
  }
}

export class RdfParseError extends Error {}

/**
 * The syntax of a file, from its first characters: `{` or `[` is JSON-LD, `<?xml` or an
 * `<rdf:RDF` root is RDF/XML, anything else is Turtle (N-Triples is Turtle).
 */
export function syntaxOf(text: string): RdfSyntax {
  const start = text.replace(/^\uFEFF/, '').trimStart()
  if (/^[[{]/.test(start)) return 'json-ld'
  // Turtle can start with `<http://…>`, but never with `<?` or `<!` or a qualified name.
  if (/^<(?:\?xml|!--|!DOCTYPE|[A-Za-z_][\w.-]*:[A-Za-z_])/i.test(start)) return 'rdf-xml'
  return 'turtle'
}

/** All triples of the file. Throws `RdfParseError` with the parser's message. */
export async function parseRdf(
  text: string,
  syntax: RdfSyntax = syntaxOf(text),
): Promise<Triple[]> {
  if (syntax === 'turtle') return parseTurtle(text)
  return syntax === 'json-ld' ? stream(jsonLdParser(), text) : stream(rdfXmlParser(), text)
}

function parseTurtle(text: string): Triple[] {
  try {
    return new Parser({ format: 'text/turtle' }).parse(text)
  } catch (error) {
    throw new RdfParseError(error instanceof Error ? error.message : String(error))
  }
}

function jsonLdParser() {
  return new JsonLdParser({
    documentLoader: {
      load: async (url: string) => {
        throw new RdfParseError(
          `The file loads a context from ${url}. Put the context in the file.`,
        )
      },
    },
  })
}

function rdfXmlParser() {
  // A base for relative IRIs, so `rdf:about="#x"` gives an IRI and not an error.
  return new RdfXmlParser({ baseIRI: 'urn:annoudio:upload' })
}

interface Stream {
  on(event: 'data', listener: (quad: Triple) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'end', listener: () => void): unknown
  end(chunk: string): unknown
}

function stream(parser: Stream, text: string): Promise<Triple[]> {
  return new Promise((resolve, reject) => {
    const quads: Triple[] = []
    parser.on('data', (quad) => quads.push(quad))
    parser.on('error', (error) =>
      reject(error instanceof RdfParseError ? error : new RdfParseError(error.message)),
    )
    parser.on('end', () => resolve(quads))
    parser.end(text)
  })
}

export type RdfOutput = 'turtle' | 'trig' | 'jsonld'

/** The prefixes of the files that this stack writes. The stored bodies hold full IRIs. */
export const PREFIXES: Record<string, string> = {
  oa: 'http://www.w3.org/ns/oa#',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  dctypes: 'http://purl.org/dc/dcmitype/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  owl: 'http://www.w3.org/2002/07/owl#',
  schema: 'http://schema.org/',
  sh: 'http://www.w3.org/ns/shacl#',
  relators: 'http://id.loc.gov/vocabulary/relators/',
}

/**
 * Quads as Turtle (every graph merged into the default graph), TriG (named graphs kept)
 * or JSON-LD (expanded, flat, one `@graph` per named graph; no remote context).
 */
export function writeQuads(
  quads: Quad[],
  format: RdfOutput,
  prefixes: Record<string, string> = PREFIXES,
): string {
  if (format === 'jsonld') return JSON.stringify(jsonLdOf(quads), null, 2)
  const { quad, defaultGraph } = DataFactory
  const writer = new Writer({
    format: format === 'trig' ? 'application/trig' : 'text/turtle',
    prefixes,
  })
  for (const q of quads) {
    writer.addQuad(format === 'trig' ? q : quad(q.subject, q.predicate, q.object, defaultGraph()))
  }
  let out = ''
  writer.end((error, result) => {
    if (error) throw error
    out = result
  })
  return out
}

type JsonNode = Record<string, unknown> & { '@id': string }

function jsonLdOf(quads: Quad[]): unknown[] {
  const graphs = new Map<string, Map<string, JsonNode>>()
  const idOf = (term: Quad['subject'] | Quad['graph']) =>
    term.termType === 'BlankNode' ? `_:${term.value}` : term.value
  for (const q of quads) {
    const graph = q.graph.termType === 'DefaultGraph' ? '' : idOf(q.graph)
    if (!graphs.has(graph)) graphs.set(graph, new Map())
    const nodes = graphs.get(graph)!
    const id = idOf(q.subject)
    if (!nodes.has(id)) nodes.set(id, { '@id': id })
    const node = nodes.get(id)!
    const o = q.object
    const value =
      o.termType === 'Literal'
        ? {
            '@value': o.value,
            ...(o.language
              ? { '@language': o.language }
              : o.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string'
                ? { '@type': o.datatype.value }
                : {}),
          }
        : { '@id': o.termType === 'BlankNode' ? `_:${o.value}` : o.value }
    if (q.predicate.value === `${PREFIXES.rdf}type` && o.termType !== 'Literal') {
      node['@type'] = [
        ...((node['@type'] as string[] | undefined) ?? []),
        (value as { '@id': string })['@id'],
      ]
    } else {
      node[q.predicate.value] = [
        ...((node[q.predicate.value] as unknown[] | undefined) ?? []),
        value,
      ]
    }
  }
  const top = [...(graphs.get('')?.values() ?? [])] as unknown[]
  for (const [graph, nodes] of graphs) {
    if (graph) top.push({ '@id': graph, '@graph': [...nodes.values()] })
  }
  return top
}
