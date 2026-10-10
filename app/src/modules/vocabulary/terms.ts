// The properties and classes of an ontology file. Pure: no Payload. The bundle script
// (`scripts/bundle-ontologies.ts`) and `importFile` use it, so a bundled ontology and an
// uploaded one give the same terms.
//
// Rules (design/vocab-B-schemes.md §4, as Omeka S): `rdf:Property`, `owl:ObjectProperty`,
// `owl:DatatypeProperty` and `owl:AnnotationProperty` give a property; `rdfs:Class` and
// `owl:Class` give a class. The label is `rdfs:label`, else `skos:prefLabel`, else
// `madsrdf:authoritativeLabel`; in English, else with no language tag, else the first.
// The comment is `rdfs:comment`, else `skos:definition`. The range hint is `rdfs:range`,
// else `schema:rangeIncludes`. All other axioms are left out.

import type { Triple } from './rdf'

export const NS = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  schema: 'http://schema.org/',
  mads: 'http://www.loc.gov/mads/rdf/v1#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  dcterms: 'http://purl.org/dc/terms/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  sh: 'http://www.w3.org/ns/shacl#',
  vann: 'http://purl.org/vocab/vann/',
} as const

export type TermKind = 'property' | 'class'

export interface OntologyTerm {
  iri: string
  kind: TermKind
  label: string
  comment?: string
  rangeHint?: string
}

const PROPERTY_TYPES = new Set([
  `${NS.rdf}Property`,
  `${NS.owl}ObjectProperty`,
  `${NS.owl}DatatypeProperty`,
  `${NS.owl}AnnotationProperty`,
])
const CLASS_TYPES = new Set([`${NS.rdfs}Class`, `${NS.owl}Class`])
const LABELS = [`${NS.rdfs}label`, `${NS.skos}prefLabel`, `${NS.mads}authoritativeLabel`]
const COMMENTS = [`${NS.rdfs}comment`, `${NS.skos}definition`]
const RANGES = [`${NS.rdfs}range`, `${NS.schema}rangeIncludes`]
const COMMENT_CHARS = 500

interface Facts {
  types: Set<string>
  literals: Map<string, { value: string; language?: string }[]>
  iris: Map<string, string[]>
}

export interface TermsOptions {
  /** Keep only subjects whose IRI starts with this namespace. */
  namespace: string
  /**
   * Read every subject of the namespace as a property, whatever its `rdf:type`. For the
   * MARC relators, which LoC types as `madsrdf:Authority` and `bf:Role`
   * (design/vocab.md §2).
   */
  allSubjectsAreProperties?: boolean
}

/** The terms of one namespace in a file, in IRI order. A term with no label gets its local name. */
export function termsOf(triples: Triple[], options: TermsOptions): OntologyTerm[] {
  return scan(triples, options).terms
}

/**
 * The terms of an upload: only terms with a label. `unlabelled` names the left-out terms;
 * `outside` counts the typed properties and classes of other namespaces.
 */
export function uploadTerms(
  triples: Triple[],
  namespace: string,
): { terms: OntologyTerm[]; unlabelled: string[]; outside: number } {
  const all = scan(triples, { namespace })
  const unlabelled = new Set(all.unlabelled)
  const inside = new Set(all.terms.map((t) => t.iri))
  const outside = new Set(
    triples
      .filter(
        (t) =>
          t.subject.termType === 'NamedNode' &&
          t.predicate.value === `${NS.rdf}type` &&
          (PROPERTY_TYPES.has(t.object.value) || CLASS_TYPES.has(t.object.value)) &&
          !inside.has(t.subject.value),
      )
      .map((t) => t.subject.value),
  )
  return {
    terms: all.terms.filter((t) => !unlabelled.has(t.iri)),
    unlabelled: [...unlabelled],
    outside: outside.size,
  }
}

function scan(
  triples: Triple[],
  options: TermsOptions,
): { terms: OntologyTerm[]; unlabelled: string[] } {
  const unlabelled: string[] = []
  const facts = new Map<string, Facts>()
  for (const t of triples) {
    if (t.subject.termType !== 'NamedNode' || !t.subject.value.startsWith(options.namespace)) {
      continue
    }
    let f = facts.get(t.subject.value)
    if (!f)
      facts.set(t.subject.value, (f = { types: new Set(), literals: new Map(), iris: new Map() }))
    if (t.predicate.value === `${NS.rdf}type`) f.types.add(t.object.value)
    else if (t.object.termType === 'Literal') {
      const list = f.literals.get(t.predicate.value) ?? []
      list.push({
        value: t.object.value,
        ...(t.object.language ? { language: t.object.language } : {}),
      })
      f.literals.set(t.predicate.value, list)
    } else if (t.object.termType === 'NamedNode') {
      f.iris.set(t.predicate.value, [...(f.iris.get(t.predicate.value) ?? []), t.object.value])
    }
  }
  const terms: OntologyTerm[] = []
  for (const [iri, f] of facts) {
    const local = iri.slice(options.namespace.length)
    if (!local) continue
    const kind: TermKind | null = [...f.types].some((type) => PROPERTY_TYPES.has(type))
      ? 'property'
      : [...f.types].some((type) => CLASS_TYPES.has(type))
        ? 'class'
        : options.allSubjectsAreProperties
          ? 'property'
          : null
    if (!kind) continue
    const picked = pick(f, LABELS)?.value
    if (!picked) unlabelled.push(iri)
    const label = picked ?? local
    const comment = pick(f, COMMENTS)?.value.replace(/\s+/g, ' ').trim()
    const rangeHint = RANGES.flatMap((p) => f.iris.get(p) ?? [])[0]
    terms.push({
      iri,
      kind,
      label: label.replace(/\s+/g, ' ').trim(),
      ...(comment ? { comment: shorten(comment) } : {}),
      ...(rangeHint ? { rangeHint } : {}),
    })
  }
  return { terms: terms.sort((a, b) => (a.iri < b.iri ? -1 : a.iri > b.iri ? 1 : 0)), unlabelled }
}

/** The first literal of the first predicate that has one: English, then no tag, then any. */
function pick(f: Facts, predicates: string[]) {
  for (const predicate of predicates) {
    const all = f.literals.get(predicate)
    if (!all?.length) continue
    return (
      all.find((l) => l.language === 'en' || l.language?.startsWith('en-')) ??
      all.find((l) => !l.language) ??
      all[0]
    )
  }
  return undefined
}

function shorten(text: string): string {
  const chars = [...text]
  return chars.length > COMMENT_CHARS ? `${chars.slice(0, COMMENT_CHARS - 1).join('')}…` : text
}
