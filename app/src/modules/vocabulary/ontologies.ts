// The ontologies of the organisation: the bundled ones and the uploaded ones
// (design/vocab.md §2, §9.1). One row per namespace in `ontologies`, one row per property
// or class in `ontology-terms`.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'

import dcterms from './bundled/dcterms.json'
import dctypes from './bundled/dctypes.json'
import foaf from './bundled/foaf.json'
import rdf from './bundled/rdf.json'
import rdfs from './bundled/rdfs.json'
import relators from './bundled/relators.json'
import schema from './bundled/schema.json'
import skos from './bundled/skos.json'
import { CATALOGUE, type Iri } from './catalogue'
import type { OntologyTerm, TermKind } from './terms'

export const ONTOLOGIES = 'ontologies' as const
export const TERMS = 'ontology-terms' as const

export interface BundledOntology {
  prefix: string
  label: string
  namespace: string
  url: string
  licence: string
  terms: OntologyTerm[]
}

/** The ontologies that every stack has, offline. `scripts/bundle-ontologies.ts` makes them. */
export const BUNDLED = [
  dcterms,
  dctypes,
  foaf,
  skos,
  rdf,
  rdfs,
  schema,
  relators,
] as BundledOntology[]

/** A drizzle handle: the pool, a transaction, or the `db` of a migration. */
interface Executor {
  execute: PostgresAdapter['drizzle']['execute']
}

/**
 * Insert each bundled ontology whose namespace is not in `ontologies`, and the terms of a
 * bundled ontology that has none. The advisory lock makes two processes wait for each
 * other. Run it inside a transaction (the migration does; `seeded` does).
 */
export async function seedOntologies(db: Executor): Promise<number> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('annoudio.ontologies'))`)
  let added = 0
  for (const ontology of BUNDLED) {
    await db.execute(sql`
      insert into ontologies (label, namespace, prefix, source, licence, loaded_at, updated_at, created_at)
        select ${ontology.label}, ${ontology.namespace}, ${ontology.prefix}, 'bundled',
               ${ontology.licence}, now(), now(), now()
        where not exists (select 1 from ontologies where namespace = ${ontology.namespace})`)
    const { rows } = await db.execute<{ id: number }>(sql`
      select o.id from ontologies o where o.namespace = ${ontology.namespace}
        and not exists (select 1 from ontology_terms t where t.ontology_id = o.id)`)
    if (rows.length === 0) continue
    added++
    await db.execute(sql`
      insert into ontology_terms (iri, ontology_id, kind, label, comment, range_hint, gone, updated_at, created_at)
        select t.iri, ${rows[0].id}, t.kind::enum_ontology_terms_kind, t.label, t.comment,
               t."rangeHint", false, now(), now()
          from jsonb_to_recordset(${JSON.stringify(ontology.terms)}::jsonb)
            as t(iri text, kind text, label text, comment text, "rangeHint" text)
        on conflict (iri) do nothing`)
  }
  return added
}

/**
 * Seed the bundled ontologies when a bundled one or its terms are missing. One small query
 * when all are there. (A `truncate … cascade` of projects also empties `ontology-terms`.)
 */
export async function seeded(payload: Payload): Promise<void> {
  const drizzle = (payload.db as unknown as PostgresAdapter).drizzle
  const { rows } = await drizzle.execute<{ complete: boolean }>(sql`
    select count(*) = ${BUNDLED.length} as complete from ontologies o
      where o.source = 'bundled'
        and exists (select 1 from ontology_terms t where t.ontology_id = o.id)`)
  if (rows[0]?.complete) return
  await drizzle.transaction(async (tx) => {
    await seedOntologies(tx)
  })
}

export interface Term {
  iri: Iri
  /** `prefix:local`, or the IRI when the ontology has no prefix for it. */
  curie: string
  kind: TermKind
  label: string
  comment?: string
  rangeHint?: Iri
  ontology: { label: string; prefix: string; namespace: string }
  /** The term is no longer in the newest file of its ontology. */
  gone: boolean
}

export interface TermQuery {
  kind: TermKind
  text: string
  /** The prefix of one ontology. */
  ontology?: string
  /** Also the own properties of this project. Without it: organisation terms only. */
  project?: number | string
  limit?: number
}

interface TermDoc {
  iri: string
  kind: TermKind
  label: string
  comment?: string | null
  rangeHint?: string | null
  gone?: boolean | null
  ontology?: { label: string; prefix: string; namespace: string } | number | null
}

export function termOf(doc: TermDoc): Term {
  const ontology =
    typeof doc.ontology === 'object' && doc.ontology
      ? {
          label: doc.ontology.label,
          prefix: doc.ontology.prefix,
          namespace: doc.ontology.namespace,
        }
      : { label: '', prefix: '', namespace: '' }
  const local = ontology.namespace && doc.iri.startsWith(ontology.namespace)
  return {
    iri: doc.iri,
    curie:
      local && ontology.prefix
        ? `${ontology.prefix}:${doc.iri.slice(ontology.namespace.length)}`
        : doc.iri,
    kind: doc.kind,
    label: doc.label,
    ...(doc.comment ? { comment: doc.comment } : {}),
    ...(doc.rangeHint ? { rangeHint: doc.rangeHint } : {}),
    ontology,
    gone: doc.gone === true,
  }
}

/**
 * Terms whose label, comment or IRI has every word of `text`, or whose catalogue question
 * (§2) has them: "place" finds `dcterms:spatial` ("Spatial Coverage") through "Place".
 * Catalogue hits first, then labels that start with the text, then the others by label.
 */
export async function searchTerms(payload: Payload, query: TermQuery): Promise<Term[]> {
  await seeded(payload)
  const text = query.text.trim()
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const asked = CATALOGUE.filter((entry) => {
    const said = `${entry.label} ${entry.help ?? ''}`.toLowerCase()
    return words.length > 0 && words.every((word) => said.includes(word))
  }).map((entry) => entry.property)
  const and: Where[] = [{ kind: { equals: query.kind } }]
  if (text) {
    and.push({
      or: [
        { label: { like: text } },
        { comment: { like: text } },
        { iri: { like: text } },
        ...(asked.length > 0 ? [{ iri: { in: asked } }] : []),
      ],
    })
  }
  if (query.ontology) and.push({ 'ontology.prefix': { equals: query.ontology } })
  and.push(
    query.project === undefined
      ? { project: { exists: false } }
      : { or: [{ project: { exists: false } }, { project: { equals: query.project } }] },
  )
  const limit = query.limit ?? 20
  const { docs } = await payload.find({
    collection: TERMS,
    where: { and },
    sort: 'label',
    limit: Math.max(limit * 5, 100),
    depth: 1,
  })
  const rank = (term: Term) =>
    asked.includes(term.iri) ? 0 : term.label.toLowerCase().startsWith(words[0] ?? '') ? 1 : 2
  return (docs as TermDoc[])
    .map(termOf)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit)
}

/** One term by IRI, or null. */
export async function termByIri(
  payload: Payload,
  iri: Iri,
): Promise<(Term & { id: number | string; project?: number | string }) | null> {
  await seeded(payload)
  const { docs } = await payload.find({
    collection: TERMS,
    where: { iri: { equals: iri } },
    limit: 1,
    depth: 1,
  })
  const doc = docs[0] as (TermDoc & { id: number | string; project?: unknown }) | undefined
  if (!doc) return null
  const project =
    typeof doc.project === 'object' && doc.project !== null
      ? (doc.project as { id: number | string }).id
      : (doc.project as number | string | null | undefined)
  return { ...termOf(doc), id: doc.id, ...(project ? { project } : {}) }
}

export interface OntologySummary {
  label: string
  prefix: string
  namespace: string
  source: 'bundled' | 'uploaded'
  /** Properties and classes. */
  terms: number
}

/** The loaded ontologies, bundled ones first, then by label. */
export async function ontologies(payload: Payload): Promise<OntologySummary[]> {
  await seeded(payload)
  const drizzle = (payload.db as unknown as PostgresAdapter).drizzle
  const { rows } = await drizzle.execute<{
    label: string
    prefix: string
    namespace: string
    source: OntologySummary['source']
    terms: string
  }>(sql`
    select o.label, o.prefix, o.namespace, o.source,
           (select count(*) from ontology_terms t where t.ontology_id = o.id) as terms
      from ontologies o order by o.source, o.label`)
  return rows.map((row) => ({ ...row, terms: Number(row.terms) }))
}
