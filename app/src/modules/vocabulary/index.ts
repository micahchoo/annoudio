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

import type { Quad } from 'n3'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { bySlug } from '@/modules/projects'

import { CONCEPTS, FIELDS, LISTS } from './collection'
import type { Iri, ListKind, ShowAs, ValueType } from './catalogue'
import {
  TERMS,
  ontologies,
  searchTerms,
  type OntologySummary,
  type Term,
  type TermQuery,
} from './ontologies'
import {
  addField,
  addItem,
  addList,
  choices,
  item,
  labels,
  lists,
  moveField,
  profile,
  removeField,
  updateField,
  type Store,
} from './profile'
import { describe, exportProfile, type ProfileFormat } from './files'
import { importFile, type FileOptions, type FileResult } from './importFile'
import { inputsOf, resolve } from './resolve'
import {
  VOCABULARY_LIMITS,
  type Choice,
  type FieldPatch,
  type FieldResult,
  type FieldSpec,
  type ItemError,
  type ListSummary,
  type OperatorSession,
  type Profile,
  type ProjectSlug,
  type ResolveResult,
  type ResolvedValue,
  type ValueInput,
  type VocabularyConfig,
} from './types'
import { SkosParseError, parse, serialise, type ParsedConcept, type SkosFormat } from './skos'

export {
  conceptsCollection,
  ontologiesCollection,
  ontologyTermsCollection,
  vocabFieldsCollection,
  vocabListsCollection,
  type VocabularyDeps,
} from './collection'
export type { SkosFormat } from './skos'
export { CATALOGUE } from './catalogue'
export type { CatalogueEntry, Iri, ListKind, ShowAs, ValueType } from './catalogue'
export { BUNDLED, seedOntologies } from './ontologies'
export type { OntologySummary, Term, TermQuery } from './ontologies'
export { PREFIXES, writeQuads, type RdfOutput } from './rdf'
export type { ProfileFormat } from './files'
export type {
  FileError,
  FormFieldPreview,
  FormPreview,
  FileOptions,
  FileReport,
  FileResult,
  ImportChoice,
  ListPreview,
  OntologyPreview,
} from './importFile'

export type {
  Choice,
  Field,
  FieldList,
  FieldPatch,
  FieldResult,
  FieldSpec,
  ItemError,
  ListSummary,
  OperatorSession,
  Profile,
  ResolveResult,
  ResolvedObject,
  ResolvedValue,
  ValueErrorCode,
  ValueInput,
  VocabularyConfig,
  VocabularyLimits,
  VocabularyStories,
} from './types'
export { VOCABULARY_LIMITS } from './types'

/** The `vocabulary` instance (design/vocab.md §9.2). */
export interface Vocabulary {
  // The Annotate page, `stories`, the theme JSON.
  /** The fields of a project in order. `forNewStories`: without the hidden fields. */
  profile(project: ProjectSlug, options?: { forNewStories?: boolean }): Promise<Profile | null>
  /** The items of a list: the tree (≤ 200 items), else a search by label. Hidden items are left out. */
  choices(project: ProjectSlug, listKey: string, query?: string): Promise<Choice[]>
  /** Check the answers and turn them into statements. `keep`: the stored values of the story. */
  resolve(
    project: ProjectSlug,
    input: ValueInput[],
    options?: { keep?: ResolvedValue[]; req?: PayloadRequest },
  ): Promise<ResolveResult>
  /** The form input that gives these values again. */
  inputsOf(project: ProjectSlug, values: ResolvedValue[]): Promise<ValueInput[]>
  /** The label and the widget display of each field, hidden fields too. */
  labels(
    project: ProjectSlug,
  ): Promise<{ property: Iri; label: string; showAs: ShowAs; valueType: ValueType }[]>
  /** One item or entity of the project. From a hook, pass its `req`. */
  item(
    project: ProjectSlug,
    iri: Iri,
    options?: { req?: PayloadRequest },
  ): Promise<{ iri: Iri; label: string; language?: string; list: string } | null>

  // Operators: fields.
  addField(operator: OperatorSession, project: ProjectSlug, spec: FieldSpec): Promise<FieldResult>
  updateField(
    operator: OperatorSession,
    project: ProjectSlug,
    property: Iri,
    patch: FieldPatch,
  ): Promise<FieldResult>
  moveField(
    operator: OperatorSession,
    project: ProjectSlug,
    property: Iri,
    to: number,
  ): Promise<FieldResult>
  removeField(operator: OperatorSession, project: ProjectSlug, property: Iri): Promise<FieldResult>
  /** Properties or classes of the loaded ontologies, by words of the label or comment. */
  searchTerms(query: TermQuery): Promise<Term[]>
  /** The loaded ontologies of the organisation (Settings → Ontologies). */
  ontologies(): Promise<OntologySummary[]>

  // Operators: lists.
  lists(project: ProjectSlug): Promise<ListSummary[]>
  addList(
    operator: OperatorSession,
    project: ProjectSlug,
    spec: { label: string; kind: ListKind; class?: Iri },
  ): Promise<
    | { ok: true; key: string }
    | { ok: false; error: 'too-many' | 'bad-class' }
    /** A list of the project has this name already (case and spaces do not count). */
    | { ok: false; error: 'exists'; key: string; label: string }
  >
  addItem(
    operator: OperatorSession,
    project: ProjectSlug,
    listKey: string,
    spec: { label: string; parent?: Iri; sameAs?: string },
  ): Promise<{ ok: true; iri: Iri } | { ok: false; error: ItemError }>

  // Files.
  /**
   * Load a vocabulary file: an ontology, SKOS lists. `apply: false` is the preview and
   * writes nothing; `apply: true` writes what `accept` names, in one transaction. The
   * report has the same shape both times.
   */
  importFile(
    operator: OperatorSession,
    file: { name: string; bytes: Uint8Array },
    options: FileOptions,
  ): Promise<FileResult>
  /**
   * A file for other systems: the questions as SHACL (Turtle or JSON-LD) or as an Omeka S
   * resource template, or one list as SKOS. Null for an unknown project or list. A file
   * that this stack exports, it can import again with no change.
   */
  exportFile(project: ProjectSlug, what: ExportWhat): Promise<SkosFile | null>
  /** Layer 3 of the linked data export (§3.4): the shape, own properties, lists, entities. */
  describe(project: ProjectSlug): Promise<Quad[]>
}

export type ExportWhat =
  | { kind: 'profile'; format: ProfileFormat }
  | { kind: 'list'; listKey: string; format: 'turtle' | 'jsonld' }

export function createVocabulary(config: VocabularyConfig): Vocabulary {
  let pending: Promise<Payload> | undefined
  const payload = () =>
    (pending ??= Promise.resolve(
      typeof config.payload === 'function' ? config.payload() : config.payload,
    ).catch((error: unknown) => {
      pending = undefined
      throw error
    }))
  const limits = { ...VOCABULARY_LIMITS, ...config.limits }
  const store = async (): Promise<Store> => ({
    payload: await payload(),
    origin: config.origin,
    stories: config.stories,
    limits,
  })
  const checked = (operator: OperatorSession) => {
    if (typeof operator?.operatorId !== 'string' || operator.operatorId === '') {
      throw new Error('vocabulary: forbidden')
    }
    return operator
  }
  return {
    profile: async (project, options) => profile(await store(), project, options),
    choices: async (project, listKey, query) => choices(await store(), project, listKey, query),
    resolve: async (project, input, options) => resolve(await store(), project, input, options),
    inputsOf: async (project, values) => inputsOf(await store(), project, values),
    labels: async (project) => labels(await store(), project),
    item: async (project, iri, options) => item(await store(), project, iri, options),
    addField: async (operator, project, spec) =>
      addField(await store(), checked(operator), project, spec),
    updateField: async (operator, project, property, patch) =>
      updateField(await store(), checked(operator), project, property, patch),
    moveField: async (operator, project, property, to) =>
      moveField(await store(), checked(operator), project, property, to),
    removeField: async (operator, project, property) =>
      removeField(await store(), checked(operator), project, property),
    searchTerms: async (query) => searchTerms(await payload(), query),
    ontologies: async () => ontologies(await payload()),
    lists: async (project) => lists(await store(), project),
    addList: async (operator, project, spec) =>
      addList(await store(), checked(operator), project, spec),
    addItem: async (operator, project, listKey, spec) =>
      addItem(await store(), checked(operator), project, listKey, spec),
    importFile: async (operator, file, options) =>
      importFile(await store(), checked(operator), file, options),
    exportFile: async (project, what) =>
      what.kind === 'profile'
        ? exportProfile(await store(), project, what.format)
        : exportSkos(
            { payload: await payload(), origin: config.origin },
            project,
            what.format === 'turtle' ? 'turtle' : 'json-ld',
            what.listKey,
          ),
    describe: async (project) => describe(await store(), project),
  }
}

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
 * Remove the vocabulary of a project: its fields, items, lists and own properties. The `projects` module calls this when it deletes a
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
  // Fields point at lists and terms, items at lists: fields first, lists and terms last.
  for (const collection of [FIELDS, CONCEPTS, LISTS, TERMS] as const) {
    const { errors } = await context.payload.delete({
      collection,
      where,
      depth: 0,
      req: context.req,
    })
    if (errors.length > 0) throw new Error(errors[0].message)
  }
}

/** One concept of a vocabulary, with the IRI of its parent concept. */
export interface ConceptNode extends Concept {
  /** The admin document id. */
  id: number | string
  parent?: string
  /** True when members cannot choose it for a new story. */
  hidden: boolean
  /** The key of its list. */
  list: string
  sameAs?: string
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
    list: doc.list && typeof doc.list === 'object' ? doc.list.key : '',
    ...(doc.sameAs ? { sameAs: doc.sameAs } : {}),
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
  listKey = 'topics',
): Promise<SkosFile | null> {
  const project = await bySlug(context, projectSlug)
  if (!project) return null
  const { docs } = await context.payload.find({
    collection: LISTS,
    where: { and: [{ project: { equals: project.id } }, { key: { equals: listKey } }] },
    limit: 1,
    depth: 1,
  })
  const list = docs[0]
  if (!list && listKey !== 'topics') return null
  const cls = list?.class && typeof list.class === 'object' ? list.class.iri : undefined
  const concepts = (await conceptsOf(context, projectSlug)).filter(
    (c) => c.list === listKey || (!list && !c.list),
  )
  const body = serialise(
    {
      // The list Topics keeps the scheme IRI and the name of the old one-list vocabulary.
      iri: list?.iri ?? `${context.origin}/vocab/${project.slug}`,
      label: listKey === 'topics' ? project.label : list!.label,
      ...(list?.kind === 'entities' && cls ? { entities: { class: cls } } : {}),
      concepts: concepts.map(({ iri, label, language, parent, hidden, sameAs }) => ({
        iri,
        label,
        hidden,
        ...(language ? { language } : {}),
        ...(parent ? { parent } : {}),
        ...(sameAs ? { sameAs } : {}),
      })),
    },
    format,
  )
  const name = listKey === 'topics' ? project.slug : `${project.slug}-${listKey}`
  return format === 'turtle'
    ? { filename: `${name}.ttl`, contentType: 'text/turtle; charset=utf-8', body }
    : { filename: `${name}.jsonld`, contentType: 'application/ld+json', body }
}

/** Why the import leaves a concept out. */
export type SkipReason =
  /** The concept is a blank node or not an http(s) IRI. */
  | 'not-a-web-address'
  /** The document gives no `skos:prefLabel`. */
  | 'no-label'
  /** A concept of another project has this IRI. */
  | 'other-project'
  /** An item of a different list of this project has this IRI. */
  | 'other-list'

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
  options: { apply: boolean; list?: string },
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
    const listId = options.list
      ? (
          await payload.find({
            collection: LISTS,
            where: {
              and: [{ project: { equals: project.id } }, { key: { equals: options.list } }],
            },
            limit: 1,
            depth: 0,
            req,
          })
        ).docs[0]?.id
      : undefined
    if (options.list && listId === undefined) throw new Error(`No list ${options.list}`)
    const report = await merge({ payload, req }, project, parsed, options.apply, listId)
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
  sameAs?: string
}

/**
 * Merge concepts into the vocabulary of a project by IRI: into one list (`listId`), or
 * into the list Topics (no `listId`: the old one-list path). `importFile` uses it per list.
 */
export async function merge(
  context: VocabularyContext,
  project: { id: number | string; slug: string; language?: string },
  parsed: ParsedConcept[],
  apply: boolean,
  listId?: number | string,
): Promise<ImportReport> {
  const { payload, req } = context
  const projectId = project.id
  const all = await conceptsOf(context, project.slug)
  const inList =
    listId === undefined
      ? null
      : new Set(
          (
            await payload.find({
              collection: CONCEPTS,
              where: { list: { equals: listId } },
              pagination: false,
              depth: 0,
              select: { iri: true },
              req,
            })
          ).docs.map((doc) => doc.iri),
        )
  const own = new Map<string, Existing>(
    all.filter((c) => !inList || inList.has(c.iri)).map((c) => [c.iri, c]),
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
        const reason = all.some((c) => c.iri === concept.iri) ? 'other-list' : 'other-project'
        report.skipped.push({ iri: concept.iri, reason })
        continue
      }
      const data = {
        // The Payload type says number: the id type of the Postgres adapter.
        project: projectId as number,
        ...(listId === undefined ? {} : { list: listId as number }),
        iri: concept.iri,
        label: label.value,
        language: label.language ?? null,
        hidden: concept.hidden,
        ...(concept.sameAs ? { sameAs: concept.sameAs } : {}),
      }
      const id = apply
        ? (await payload.create({ collection: CONCEPTS, data, depth: 0, req })).id
        : null
      report.added++
      kept.push({ concept, id, changed: true })
      continue
    }
    const hidden = current.hidden || concept.hidden
    const sameAs = concept.sameAs ?? current.sameAs
    const same =
      current.label === label.value &&
      current.language === label.language &&
      current.hidden === hidden &&
      current.sameAs === sameAs
    if (!same && apply) {
      await payload.update({
        collection: CONCEPTS,
        id: current.id,
        data: {
          label: label.value,
          language: label.language ?? null,
          hidden,
          sameAs: sameAs ?? null,
        },
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
