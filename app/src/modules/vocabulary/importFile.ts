// "Load a vocabulary file" (design/vocab.md §6): one upload path for an ontology, SKOS
// lists, and (slice 10) a form of questions as SHACL or an Omeka S resource template. The
// same call gives the preview (`apply: false`, nothing written) and the import. Rules:
// 5 MB, 20 000 terms, 5000 items per list; no fetch; a prefix that `anno.jsonld` uses for
// another namespace, or that is a term of `anno.jsonld`, is refused; the import never
// removes a field, a list or an item.

import { createHash } from 'node:crypto'

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type PayloadRequest,
} from 'payload'

import { bySlug, type Project } from '@/modules/projects'
import anno from '@/modules/stories/context/anno.json'

import { LISTS, keyOf, listIri } from './collection'
import { merge, type ImportReport } from './index'
import type { Iri } from './catalogue'
import { ONTOLOGIES, termByIri } from './ontologies'
import type { Store } from './profile'
import { RdfParseError, parseRdf, syntaxOf, type RdfSyntax, type Triple } from './rdf'
import { formFromOmeka, isOmeka } from './omeka'
import { addField, lists as listsOf, profile, updateField } from './profile'
import { formFromShacl, type FormField, type FormSpec } from './shacl'
import { schemesIn } from './skos'
import { NS, uploadTerms, type OntologyTerm } from './terms'
import type { OperatorSession, ProjectSlug } from './types'

export interface OntologyPreview {
  label: string
  prefix: string
  namespace: string
  properties: number
  classes: number
  /** False when an uploaded ontology has this namespace: the import is a new version. */
  isNew: boolean
  /** For a new version: the terms against the loaded ones. */
  changes?: { added: number; changed: number; unchanged: number; gone: number }
  leftOut: { unlabelled: number; outside: number }
}

export interface ListPreview {
  /** The `skos:ConceptScheme` IRI, or '' for concepts with no scheme. */
  iri: string
  label: string
  items: number
  /** True when the project has a list with this IRI: the items merge into it. */
  exists: boolean
  /** The merge by IRI. Null without a project. */
  report: ImportReport | null
}

/** One question of a form file (SHACL or Omeka template), as the import sees it. */
export interface FormFieldPreview {
  label: string
  property: Iri
  /** `new`: added after the existing questions; `known`: this project asks it already. */
  status: 'new' | 'known' | 'left-out'
  /** Why a question is left out: its property is not loaded, or its list is not here. */
  reason?: 'unknown-term' | 'not-a-property' | 'unknown-list'
}

export interface FormPreview {
  label: string
  fields: FormFieldPreview[]
}

export interface FileReport {
  syntax: RdfSyntax | 'omeka'
  ontology: OntologyPreview | null
  lists: ListPreview[]
  /** A SHACL shape or an Omeka template. Null without one, or without a project. */
  form: FormPreview | null
}

/** What the operator ticked. Absent keys mean "everything that the file has". */
export interface ImportChoice {
  ontology?: boolean
  /** The IRIs of the lists to load ('' for concepts with no scheme). */
  lists?: string[]
  form?: boolean
}

export type FileError =
  | 'too-large'
  | 'unreadable'
  | 'too-many-terms'
  | 'too-many-items'
  | 'prefix-clash'
  | 'prefix-taken'
  | 'bundled'
  | 'unknown-project'
  | 'nothing'

export type FileResult =
  | { ok: true; applied: boolean; report: FileReport }
  | { ok: false; error: FileError; message?: string }

export interface FileOptions {
  project?: ProjectSlug
  apply: boolean
  accept?: ImportChoice
  /** The operator's corrections of the ontology label, prefix and namespace. */
  names?: { label?: string; prefix?: string; namespace?: string }
}

const VANN = NS.vann
const OWL_ONTOLOGY = `${NS.owl}Ontology`
const TITLES = [`${NS.rdfs}label`, `${NS.dcterms}title`, 'http://purl.org/dc/elements/1.1/title']
const CONTEXT = (anno as { '@context': Record<string, unknown> })['@context']

/** The namespace, prefix and label that the file gives, else the most common namespace. */
function ontologyNames(
  triples: Triple[],
): { namespace: string; prefix: string; label: string } | null {
  const literal = (predicate: string) =>
    triples.find((t) => t.predicate.value === predicate && t.object.termType === 'Literal')?.object
      .value
  const typed = triples.filter(
    (t) =>
      t.subject.termType === 'NamedNode' &&
      t.predicate.value === `${NS.rdf}type` &&
      [
        `${NS.rdf}Property`,
        `${NS.owl}ObjectProperty`,
        `${NS.owl}DatatypeProperty`,
        `${NS.owl}AnnotationProperty`,
        `${NS.rdfs}Class`,
        `${NS.owl}Class`,
      ].includes(t.object.value),
  )
  if (typed.length === 0) return null
  const nsOf = (iri: string) =>
    iri.slice(0, Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1)
  let namespace = literal(`${VANN}preferredNamespaceUri`) ?? ''
  const ontology = triples.find(
    (t) =>
      t.predicate.value === `${NS.rdf}type` &&
      t.object.value === OWL_ONTOLOGY &&
      t.subject.termType === 'NamedNode',
  )?.subject.value
  if (!namespace && ontology) {
    // The ontology IRI, or the IRI with `#` or `/`: the one that the terms start with.
    namespace =
      [`${ontology}#`, `${ontology}/`, ontology].find(
        (ns) => /[#/]$/.test(ns) && typed.some((t) => t.subject.value.startsWith(ns)),
      ) ?? ''
  }
  if (!namespace) {
    const counts = new Map<string, number>()
    for (const t of typed)
      counts.set(nsOf(t.subject.value), (counts.get(nsOf(t.subject.value)) ?? 0) + 1)
    namespace = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }
  // The last part of the address that has a letter: `foaf` of `http://xmlns.com/foaf/0.1/`.
  const segment =
    namespace
      .replace(/^[a-z]+:\/\/[^/]+/, '')
      .split(/[/#]/)
      .reverse()
      .find((part) => /[a-z]/i.test(part)) ?? ''
  const prefix =
    literal(`${VANN}preferredNamespacePrefix`) ??
    (keyOf(segment)
      .replace(/-/g, '')
      .replace(/^[0-9]+/, '')
      .slice(0, 12) ||
      'ns')
  const titled = ontology
    ? triples.find(
        (t) =>
          t.subject.value === ontology &&
          TITLES.includes(t.predicate.value) &&
          t.object.termType === 'Literal',
      )?.object.value
    : undefined
  return { namespace, prefix, label: titled?.trim() || prefix }
}

/** Why a prefix cannot be used, or null. `anno.jsonld` is the context of every story. */
function prefixProblem(prefix: string, namespace: string): 'prefix-clash' | null {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(prefix)) return 'prefix-clash'
  if (!Object.hasOwn(CONTEXT, prefix)) return null
  const defined = CONTEXT[prefix]
  return typeof defined === 'string' && defined === namespace ? null : 'prefix-clash'
}

type TermRow = {
  id: number
  iri: string
  kind: string
  label: string
  comment: string | null
  range_hint: string | null
  gone: boolean | null
}

/** The drizzle handle of the transaction of `req`, else of the pool. */
async function dbOf(store: Store, req?: PayloadRequest) {
  const adapter = store.payload.db as unknown as PostgresAdapter
  const id = req ? await req.transactionID : undefined
  return (id !== undefined && adapter.sessions[id]?.db) || adapter.drizzle
}

export async function importFile(
  store: Store,
  operator: OperatorSession,
  file: { name: string; bytes: Uint8Array },
  options: FileOptions,
): Promise<FileResult> {
  if (file.bytes.byteLength > store.limits.fileBytes) return { ok: false, error: 'too-large' }
  const text = new TextDecoder('utf-8').decode(file.bytes)
  const project = options.project
    ? await bySlug({ payload: store.payload, origin: store.origin }, options.project)
    : null
  if (options.project && !project) return { ok: false, error: 'unknown-project' }

  // An Omeka S resource template is JSON, not JSON-LD: it has no RDF.
  const omeka = omekaOf(text)
  let triples: Triple[] = []
  let syntax: RdfSyntax | 'omeka' = 'omeka'
  if (!omeka) {
    try {
      syntax = syntaxOf(text)
      triples = await parseRdf(text, syntax)
    } catch (error) {
      if (error instanceof RdfParseError) {
        return { ok: false, error: 'unreadable', message: error.message }
      }
      throw error
    }
  }
  const projectLists = project ? await listsOf(store, project.slug) : []
  const formSpec = omeka
    ? formFromOmeka(omeka, (label) => projectLists.find((l) => l.label === label))
    : formFromShacl(triples)
  const form =
    project && formSpec ? await previewForm(store, project, formSpec, projectLists) : null

  // The ontology part.
  let ontology: (OntologyPreview & { terms: OntologyTerm[]; existing: number | null }) | null = null
  const found = ontologyNames(triples)
  if (found) {
    const names = { ...found, ...stripEmpty(options.names) }
    const { terms, unlabelled, outside } = uploadTerms(triples, names.namespace)
    if (terms.length > store.limits.fileTerms) return { ok: false, error: 'too-many-terms' }
    if (terms.length > 0) {
      const clash = prefixProblem(names.prefix, names.namespace)
      if (clash) return { ok: false, error: clash, message: names.prefix }
      const db = await dbOf(store)
      const { rows: loaded } = await db.execute<{
        id: number
        prefix: string
        namespace: string
        source: string
      }>(
        sql`select id, prefix, namespace, source from ontologies where namespace = ${names.namespace} or prefix = ${names.prefix}`,
      )
      const same = loaded.find((row) => row.namespace === names.namespace)
      if (same?.source === 'bundled')
        return { ok: false, error: 'bundled', message: names.namespace }
      if (loaded.some((row) => row.prefix === names.prefix && row.namespace !== names.namespace)) {
        return { ok: false, error: 'prefix-taken', message: names.prefix }
      }
      let changes: OntologyPreview['changes']
      if (same) {
        const { rows } = await db.execute<TermRow>(
          sql`select id, iri, kind, label, comment, range_hint, gone from ontology_terms where ontology_id = ${same.id}`,
        )
        changes = diff(rows, terms).counts
      }
      ontology = {
        ...names,
        properties: terms.filter((t) => t.kind === 'property').length,
        classes: terms.filter((t) => t.kind === 'class').length,
        isNew: !same,
        ...(changes ? { changes } : {}),
        leftOut: { unlabelled: unlabelled.length, outside },
        terms,
        existing: same?.id ?? null,
      }
    }
  }

  // The SKOS lists. Without a project: counted, not merged.
  const schemes = schemesIn(triples)
  const lists: ListPreview[] = []
  for (const scheme of schemes) {
    if (scheme.concepts.length > store.limits.itemsPerList)
      return { ok: false, error: 'too-many-items' }
    const label = scheme.label?.value ?? labelOfFile(file.name)
    const existing = project ? await listByIri(store, project, scheme.iri) : null
    lists.push({
      iri: scheme.iri,
      label,
      items: scheme.concepts.length,
      exists: existing !== null,
      report: project
        ? await merge({ payload: store.payload }, project, scheme.concepts, false, existing ?? -1)
        : null,
    })
  }

  const report: FileReport = {
    syntax,
    ontology: ontology ? publicOf(ontology) : null,
    lists,
    form: form?.preview ?? null,
  }
  if (!ontology && lists.length === 0 && !form) return { ok: false, error: 'nothing' }
  if (!options.apply) return { ok: true, applied: false, report }

  const accept = options.accept ?? {}
  const req = await createLocalReq({}, store.payload)
  await initTransaction(req)
  try {
    if (ontology && accept.ontology !== false) {
      await writeOntology(store, req, ontology, file.bytes)
    }
    for (const [i, scheme] of schemes.entries()) {
      if (!project || (accept.lists && !accept.lists.includes(scheme.iri))) continue
      const listId =
        (await listByIri(store, project, scheme.iri, req)) ??
        (await makeList(store, project, scheme.iri, lists[i].label, req))
      lists[i].report = await merge(
        { payload: store.payload, req },
        project,
        scheme.concepts,
        true,
        listId,
      )
    }
    await commitTransaction(req)
  } catch (error) {
    await killTransaction(req)
    throw error
  }
  // The questions go after the lists and the ontology that they can need. A form adds
  // questions after the existing ones; it never removes one.
  if (project && form && accept.form !== false) {
    const after = await listsOf(store, project.slug)
    for (const field of form.fields) {
      const list = field.listIri ? after.find((l) => l.iri === field.listIri) : undefined
      const added = await addField(store, operator, project.slug, {
        from: 'term',
        property: field.property,
        label: field.label,
        ...(field.help ? { help: field.help } : {}),
        valueType: field.valueType,
        ...(list ? { list: list.key } : {}),
      })
      if (!added.ok) continue
      await updateField(store, operator, project.slug, field.property, {
        required: field.required,
        max: field.max,
      })
    }
  }
  return { ok: true, applied: true, report }
}

function omekaOf(text: string) {
  if (!/^\s*\{/.test(text)) return null
  try {
    const value: unknown = JSON.parse(text)
    return isOmeka(value) ? value : null
  } catch {
    return null
  }
}

/** Each question of a form: new, known, or left out with the reason. */
async function previewForm(
  store: Store,
  project: Project,
  spec: FormSpec,
  projectLists: { key: string; iri: string; kind: 'items' | 'entities' }[],
) {
  const current = await profile(store, project.slug)
  const asked = new Set((current?.fields ?? []).map((f) => f.property))
  const fields: FormFieldPreview[] = []
  const addable: FormField[] = []
  for (const field of spec.fields) {
    const base = { label: field.label, property: field.property }
    if (asked.has(field.property)) {
      fields.push({ ...base, status: 'known' })
      continue
    }
    const term = await termByIri(store.payload, field.property)
    if (!term || (term.project !== undefined && term.project !== project.id)) {
      fields.push({ ...base, status: 'left-out', reason: 'unknown-term' })
      continue
    }
    if (term.kind !== 'property') {
      fields.push({ ...base, status: 'left-out', reason: 'not-a-property' })
      continue
    }
    const kind =
      field.valueType === 'list' ? 'items' : field.valueType === 'entity' ? 'entities' : null
    if (kind && !projectLists.some((l) => l.iri === field.listIri && l.kind === kind)) {
      fields.push({ ...base, status: 'left-out', reason: 'unknown-list' })
      continue
    }
    fields.push({ ...base, status: 'new' })
    addable.push(field)
  }
  return { preview: { label: spec.label, fields }, fields: addable }
}

function stripEmpty(names: FileOptions['names']) {
  return Object.fromEntries(
    Object.entries(names ?? {}).filter(
      ([, value]) => typeof value === 'string' && value.trim() !== '',
    ),
  ) as { label?: string; prefix?: string; namespace?: string }
}

function publicOf(o: OntologyPreview & { terms: unknown; existing: unknown }): OntologyPreview {
  const { terms: _terms, existing: _existing, ...rest } = o
  return rest
}

function labelOfFile(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return base ? base[0].toUpperCase() + base.slice(1) : 'Imported list'
}

/** The terms of a new version against the loaded ones. A gone term stays, marked `gone`. */
function diff(rows: TermRow[], terms: OntologyTerm[]) {
  const byIri = new Map(rows.map((row) => [row.iri, row]))
  const inFile = new Set(terms.map((t) => t.iri))
  const added: OntologyTerm[] = []
  const changed: { id: number; term: OntologyTerm }[] = []
  let unchanged = 0
  for (const term of terms) {
    const row = byIri.get(term.iri)
    if (!row) added.push(term)
    else if (
      row.kind !== term.kind ||
      row.label !== term.label ||
      (row.comment ?? undefined) !== term.comment ||
      (row.range_hint ?? undefined) !== term.rangeHint ||
      row.gone === true
    ) {
      changed.push({ id: row.id, term })
    } else unchanged++
  }
  const gone = rows.filter((row) => !inFile.has(row.iri) && row.gone !== true)
  return {
    added,
    changed,
    gone,
    counts: { added: added.length, changed: changed.length, unchanged, gone: gone.length },
  }
}

async function writeOntology(
  store: Store,
  req: PayloadRequest,
  ontology: OntologyPreview & { terms: OntologyTerm[]; existing: number | null },
  bytes: Uint8Array,
) {
  const db = await dbOf(store, req)
  const fileHash = createHash('sha256').update(bytes).digest('hex')
  let id = ontology.existing
  if (id === null) {
    const made = await store.payload.create({
      collection: ONTOLOGIES,
      data: {
        label: ontology.label,
        namespace: ontology.namespace,
        prefix: ontology.prefix,
        source: 'uploaded',
        fileHash,
        loadedAt: new Date().toISOString(),
      },
      depth: 0,
      req,
    })
    id = made.id as number
  } else {
    await store.payload.update({
      collection: ONTOLOGIES,
      id,
      data: {
        label: ontology.label,
        prefix: ontology.prefix,
        fileHash,
        loadedAt: new Date().toISOString(),
      },
      depth: 0,
      req,
    })
  }
  const { rows } = await db.execute<TermRow>(
    sql`select id, iri, kind, label, comment, range_hint, gone from ontology_terms where ontology_id = ${id}`,
  )
  const changes = diff(rows, ontology.terms)
  if (changes.added.length > 0) {
    await db.execute(sql`
      insert into ontology_terms (iri, ontology_id, kind, label, comment, range_hint, gone, updated_at, created_at)
        select t.iri, ${id}, t.kind::enum_ontology_terms_kind, t.label, t.comment, t."rangeHint", false, now(), now()
          from jsonb_to_recordset(${JSON.stringify(changes.added)}::jsonb)
            as t(iri text, kind text, label text, comment text, "rangeHint" text)
        on conflict (iri) do nothing`)
  }
  for (const { id: termId, term } of changes.changed) {
    await db.execute(sql`
      update ontology_terms set kind = ${term.kind}::enum_ontology_terms_kind, label = ${term.label},
        comment = ${term.comment ?? null}, range_hint = ${term.rangeHint ?? null}, gone = false, updated_at = now()
        where id = ${termId}`)
  }
  for (const row of changes.gone) {
    await db.execute(
      sql`update ontology_terms set gone = true, updated_at = now() where id = ${row.id}`,
    )
  }
}

async function listByIri(store: Store, project: Project, iri: string, req?: PayloadRequest) {
  if (!iri) return null
  const { docs } = await store.payload.find({
    collection: LISTS,
    where: { and: [{ project: { equals: project.id } }, { iri: { equals: iri } }] },
    limit: 1,
    depth: 0,
    req,
  })
  return docs[0]?.id ?? null
}

/** A new list for a scheme of a file: the scheme IRI when it is free, else a minted one. */
async function makeList(
  store: Store,
  project: Project,
  iri: string,
  label: string,
  req: PayloadRequest,
) {
  const base = keyOf(label) || 'list'
  let key = base
  for (let n = 2; ; n++) {
    const { totalDocs } = await store.payload.count({
      collection: LISTS,
      where: { and: [{ project: { equals: project.id } }, { key: { equals: key } }] },
      req,
    })
    if (totalDocs === 0) break
    key = `${base}-${n}`
  }
  const free =
    /^https?:\/\/\S+$/.test(iri) &&
    (await store.payload.count({ collection: LISTS, where: { iri: { equals: iri } }, req }))
      .totalDocs === 0
  const made = await store.payload.create({
    collection: LISTS,
    data: {
      project: project.id as number,
      key,
      iri: free ? iri : listIri(store.origin, project.slug, key),
      label,
      kind: 'items',
      hidden: false,
    },
    depth: 0,
    req,
  })
  return made.id
}
