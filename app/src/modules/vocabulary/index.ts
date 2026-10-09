// The interface of the `vocabulary` module. Callers import only from this file.
//
// A vocabulary is the concept tree of a project. Each concept has a stable IRI that the
// app mints (`{origin}/vocab/{project}/c/{key}`), a label and an optional parent.
// Lookups: `concept` (for `stories`), `conceptsOf` (the tag picker of the Annotate page and
// the admin tree). SKOS: `exportSkos`, `importSkos`. `removeVocabulary` (for `projects`).
//
// Ordering constraints:
// - Add `conceptsCollection(deps)` to `payload.config.ts`. `deps.stories` gives the
//   `stories` instance: a label change calls its `conceptChanged`, and a delete asks its
//   `tagCounts`.

import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { bySlug } from '@/modules/projects'

import { CONCEPTS } from './collection'
import { SkosParseError, parse, serialise, type ParsedConcept, type SkosFormat } from './skos'

export { conceptsCollection, type VocabularyDeps } from './collection'
export type { SkosFormat } from './skos'

export interface Concept {
  iri: string
  label: string
  language?: string
}

export interface VocabularyContext {
  payload: Payload
  req?: PayloadRequest
}

/**
 * Find a concept of the project vocabulary. Returns null if the project has no such
 * concept. A hidden concept is found: stories that use it keep it.
 */
export async function concept(
  context: VocabularyContext,
  projectSlug: string,
  iri: string,
): Promise<Concept | null> {
  const { docs } = await context.payload.find({
    collection: CONCEPTS,
    where: { and: [{ iri: { equals: iri } }, { 'project.slug': { equals: projectSlug } }] },
    limit: 1,
    pagination: false,
    depth: 0,
    req: context.req,
  })
  const doc = docs[0]
  if (!doc) return null
  return { iri: doc.iri, label: doc.label, ...(doc.language ? { language: doc.language } : {}) }
}

/**
 * Remove every concept of a project. The `projects` module calls this when it deletes a
 * project that has no stories (a concept that a story uses refuses its delete). From a
 * hook, pass its `req`, so the removal is part of the project delete.
 */
export async function removeVocabulary(
  context: VocabularyContext,
  projectId: number | string,
): Promise<void> {
  const where = { project: { equals: projectId } }
  // No concept is under another one after this step, so each delete passes its guard.
  await context.payload.update({
    collection: CONCEPTS,
    where: { and: [where, { parent: { exists: true } }] },
    data: { parent: null },
    depth: 0,
    req: context.req,
  })
  const { errors } = await context.payload.delete({
    collection: CONCEPTS,
    where,
    depth: 0,
    req: context.req,
  })
  if (errors.length > 0) throw new Error(errors[0].message)
}

/** One concept of a vocabulary, with the IRI of its parent concept. */
export interface ConceptNode extends Concept {
  /** The admin document id. */
  id: number | string
  parent?: string
  /** True when members cannot choose it for a new story. */
  hidden: boolean
}

/** All concepts of the project vocabulary, in label order. Empty for an unknown project. */
export async function conceptsOf(
  context: VocabularyContext,
  projectSlug: string,
): Promise<ConceptNode[]> {
  const { docs } = await context.payload.find({
    collection: CONCEPTS,
    where: { 'project.slug': { equals: projectSlug } },
    sort: 'label',
    pagination: false,
    depth: 1,
    req: context.req,
  })
  return docs.map((doc) => ({
    id: doc.id,
    iri: doc.iri,
    label: doc.label,
    ...(doc.language ? { language: doc.language } : {}),
    ...(doc.parent && typeof doc.parent === 'object' ? { parent: doc.parent.iri } : {}),
    hidden: doc.hidden === true,
  }))
}

export interface SiteContext {
  payload: Payload
  /** ANNOUDIO_ORIGIN. The scheme IRI is `{origin}/vocab/{project}`. */
  origin: string
}

export interface SkosFile {
  filename: string
  contentType: string
  body: string
}

/**
 * The project vocabulary as one SKOS concept scheme: Turtle or JSON-LD (inline context).
 * Hidden concepts are in it with `owl:deprecated true`. Null for an unknown project.
 */
export async function exportSkos(
  context: SiteContext,
  projectSlug: string,
  format: SkosFormat,
): Promise<SkosFile | null> {
  const project = await bySlug(context, projectSlug)
  if (!project) return null
  const concepts = await conceptsOf(context, projectSlug)
  const body = serialise(
    {
      iri: `${context.origin}/vocab/${project.slug}`,
      label: project.label,
      concepts: concepts.map(({ iri, label, language, parent, hidden }) => ({
        iri,
        label,
        hidden,
        ...(language ? { language } : {}),
        ...(parent ? { parent } : {}),
      })),
    },
    format,
  )
  return format === 'turtle'
    ? { filename: `${project.slug}.ttl`, contentType: 'text/turtle; charset=utf-8', body }
    : { filename: `${project.slug}.jsonld`, contentType: 'application/ld+json', body }
}

/** Why the import leaves a concept out. */
export type SkipReason =
  /** The concept is a blank node or not an http(s) IRI. */
  | 'not-a-web-address'
  /** The document gives no `skos:prefLabel`. */
  | 'no-label'
  /** A concept of another project has this IRI. */
  | 'other-project'

export interface ImportReport {
  /** Concepts in the document. */
  concepts: number
  added: number
  /** Concepts whose label, language, parent or hidden state change. */
  changed: number
  unchanged: number
  skipped: { iri: string; reason: SkipReason }[]
  /** Parent links that the import ignores: the parent is not in the vocabulary, or a cycle. */
  ignoredParents: { iri: string; parent: string }[]
}

export type ImportResult =
  | { ok: true; applied: boolean; report: ImportReport }
  | { ok: false; error: 'unknown-project' | 'too-large' | 'not-skos'; message?: string }

/** The largest SKOS file and the most concepts that one import takes. */
// 1 MB stays under the default body limit of a Next.js Server Action (1 MiB).
export const IMPORT_LIMITS = { bytes: 1_000_000, concepts: 5000 } as const

/**
 * Merge a SKOS document (Turtle or JSON-LD) into the project vocabulary, by IRI.
 * With `apply: false`, change nothing and give the report (the preview). With
 * `apply: true`, make the changes in one transaction and give the same report.
 *
 * Rules: a new IRI adds a concept with that IRI; a known IRI takes the label, language
 * and parent of the document. The import never removes a concept, a parent link or a
 * hidden mark. `owl:deprecated true` hides a concept. The label is the `skos:prefLabel` in
 * the project language, else in English, else the first one.
 */
export async function importSkos(
  context: SiteContext,
  projectSlug: string,
  text: string,
  options: { apply: boolean },
): Promise<ImportResult> {
  const project = await bySlug(context, projectSlug)
  if (!project) return { ok: false, error: 'unknown-project' }
  if (Buffer.byteLength(text, 'utf8') > IMPORT_LIMITS.bytes)
    return { ok: false, error: 'too-large' }
  let parsed: ParsedConcept[]
  try {
    parsed = await parse(text)
  } catch (error) {
    if (error instanceof SkosParseError)
      return { ok: false, error: 'not-skos', message: error.message }
    throw error
  }
  if (parsed.length === 0)
    return { ok: false, error: 'not-skos', message: 'The file has no skos:Concept.' }
  if (parsed.length > IMPORT_LIMITS.concepts) return { ok: false, error: 'too-large' }

  const { payload } = context
  const req = options.apply ? await createLocalReq({}, payload) : undefined
  if (req) await initTransaction(req)
  try {
    const report = await merge({ payload, req }, project, parsed, options.apply)
    if (req) await commitTransaction(req)
    return { ok: true, applied: options.apply, report }
  } catch (error) {
    if (req) await killTransaction(req)
    throw error
  }
}

interface Existing {
  id: number | string
  iri: string
  label: string
  language?: string
  parent?: string
  hidden: boolean
}

async function merge(
  context: VocabularyContext,
  project: { id: number | string; slug: string; language?: string },
  parsed: ParsedConcept[],
  apply: boolean,
): Promise<ImportReport> {
  const { payload, req } = context
  const projectId = project.id
  const own = new Map<string, Existing>(
    (await conceptsOf(context, project.slug)).map((c) => [c.iri, c]),
  )
  const report: ImportReport = {
    concepts: parsed.length,
    added: 0,
    changed: 0,
    unchanged: 0,
    skipped: [],
    ignoredParents: [],
  }

  // Pass 1: labels and the hidden mark. Each kept concept gets a row id.
  const kept: { concept: ParsedConcept; id: number | string | null; changed: boolean }[] = []
  for (const concept of parsed) {
    if (!/^https?:\/\/[^\s]+$/.test(concept.iri)) {
      report.skipped.push({ iri: concept.iri, reason: 'not-a-web-address' })
      continue
    }
    const label = pickLabel(concept.labels, project.language)
    if (!label) {
      report.skipped.push({ iri: concept.iri, reason: 'no-label' })
      continue
    }
    const current = own.get(concept.iri)
    if (!current) {
      const { totalDocs } = await payload.count({
        collection: CONCEPTS,
        where: { iri: { equals: concept.iri } },
        req,
      })
      if (totalDocs > 0) {
        report.skipped.push({ iri: concept.iri, reason: 'other-project' })
        continue
      }
      const data = {
        // The Payload type says number: the id type of the Postgres adapter.
        project: projectId as number,
        iri: concept.iri,
        label: label.value,
        language: label.language ?? null,
        hidden: concept.hidden,
      }
      const id = apply
        ? (await payload.create({ collection: CONCEPTS, data, depth: 0, req })).id
        : null
      report.added++
      kept.push({ concept, id, changed: true })
      continue
    }
    const hidden = current.hidden || concept.hidden
    const same =
      current.label === label.value &&
      current.language === label.language &&
      current.hidden === hidden
    if (!same && apply) {
      await payload.update({
        collection: CONCEPTS,
        id: current.id,
        data: { label: label.value, language: label.language ?? null, hidden },
        depth: 0,
        req,
      })
    }
    kept.push({ concept, id: current.id, changed: !same })
  }

  // Pass 2: parents. The tree after the import, so cycles show before a write.
  const parentOf = new Map([...own.values()].map((c) => [c.iri, c.parent]))
  const known = new Set([...own.keys(), ...kept.map((k) => k.concept.iri)])
  for (const item of kept) {
    const wanted = item.concept.parents.find((parent) => known.has(parent))
    for (const parent of item.concept.parents) {
      if (parent !== wanted) report.ignoredParents.push({ iri: item.concept.iri, parent })
    }
    if (!wanted || parentOf.get(item.concept.iri) === wanted) continue
    if (reaches(parentOf, wanted, item.concept.iri)) {
      report.ignoredParents.push({ iri: item.concept.iri, parent: wanted })
      continue
    }
    parentOf.set(item.concept.iri, wanted)
    item.changed = true
    if (apply) {
      const parent = await payload.find({
        collection: CONCEPTS,
        where: { iri: { equals: wanted } },
        limit: 1,
        depth: 0,
        req,
      })
      await payload.update({
        collection: CONCEPTS,
        id: item.id!,
        data: { parent: parent.docs[0].id },
        depth: 0,
        req,
      })
    }
  }
  for (const item of kept) {
    if (own.has(item.concept.iri)) {
      if (item.changed) report.changed++
      else report.unchanged++
    }
  }
  return report
}

/** True when the parent chain from `from` reaches `target`. */
function reaches(parentOf: Map<string, string | undefined>, from: string, target: string): boolean {
  const seen = new Set<string>()
  for (let at: string | undefined = from; at; at = parentOf.get(at)) {
    if (at === target) return true
    if (seen.has(at)) return true
    seen.add(at)
  }
  return false
}

function pickLabel(labels: ParsedConcept['labels'], language: string | undefined) {
  return (
    (language && labels.find((l) => l.language === language)) ||
    labels.find((l) => l.language === 'en') ||
    labels.find((l) => !l.language) ||
    labels[0]
  )
}
