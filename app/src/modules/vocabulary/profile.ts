// The fields and lists of a project: read them, add, change, move and remove them
// (design/vocab.md §8, §9.2). The collections `vocab-fields`, `vocab-lists` and
// `concepts` are implementation: callers see `Field`, `ListSummary` and `Choice`.

import type { Payload, PayloadRequest, Where } from 'payload'

import { bySlug, type Project } from '@/modules/projects'

import { CATALOGUE, type Iri, type ListKind, type ValueType } from './catalogue'
import { CONCEPTS, FIELDS, LISTS, idOf, keyOf, listIri } from './collection'
import { TERMS, seeded, termByIri, termOf } from './ontologies'
import { NS } from './terms'
import type {
  Choice,
  Field,
  FieldPatch,
  FieldResult,
  FieldSpec,
  ItemError,
  ListSummary,
  OperatorSession,
  Profile,
  ProjectSlug,
  VocabularyLimits,
  VocabularyStories,
} from './types'

export interface Store {
  payload: Payload
  origin: string
  stories?: () => VocabularyStories
  limits: VocabularyLimits
}

/** The class of the items of a list of kind `items`. */
export const SKOS_CONCEPT = `${NS.skos}Concept`

interface ListDoc {
  id: number | string
  key: string
  iri: string
  label: string
  kind: ListKind
  hidden?: boolean | null
  class?: unknown
}

interface FieldDoc {
  id: number | string
  property: unknown
  label: string
  help?: string | null
  valueType: ValueType
  list?: unknown
  required?: boolean | null
  max: number
  showAs: Field['showAs']
  allowOwn?: boolean | null
  hidden?: boolean | null
  position: number
}

const classOf = (value: unknown): Iri | undefined =>
  typeof value === 'object' && value !== null && 'iri' in value
    ? (value as { iri: string }).iri
    : undefined

/** The fields of a project as stored, in position order, each with its term and list. */
async function fieldDocs(store: Store, projectId: number | string, req?: PayloadRequest) {
  const { docs } = await store.payload.find({
    collection: FIELDS,
    where: { project: { equals: projectId } },
    sort: 'position',
    pagination: false,
    depth: 2,
    req,
  })
  return docs as unknown as FieldDoc[]
}

async function listSize(store: Store, listId: number | string, req?: PayloadRequest) {
  return (
    await store.payload.count({ collection: CONCEPTS, where: { list: { equals: listId } }, req })
  ).totalDocs
}

async function listOf(store: Store, doc: ListDoc, req?: PayloadRequest) {
  const cls = classOf(doc.class)
  return {
    key: doc.key,
    iri: doc.iri,
    label: doc.label,
    kind: doc.kind,
    ...(doc.kind === 'entities' && cls ? { class: cls } : {}),
    size: await listSize(store, doc.id, req),
  }
}

async function fieldOf(
  store: Store,
  doc: FieldDoc,
  usage: Map<Iri, number>,
  req?: PayloadRequest,
): Promise<Field> {
  const term = termOf(doc.property as Parameters<typeof termOf>[0])
  const list =
    typeof doc.list === 'object' && doc.list !== null
      ? await listOf(store, doc.list as ListDoc, req)
      : undefined
  return {
    property: term.iri,
    curie: term.curie,
    label: doc.label,
    ...(doc.help ? { help: doc.help } : {}),
    valueType: doc.valueType,
    ...(list ? { list } : {}),
    required: doc.required === true,
    max: doc.max,
    showAs: doc.showAs,
    allowOwn: doc.allowOwn === true,
    hidden: doc.hidden === true,
    usage: usage.get(term.iri) ?? 0,
  }
}

async function usageOf(store: Store, project: ProjectSlug): Promise<Map<Iri, number>> {
  return store.stories ? store.stories().fieldUsage(project) : new Map()
}

export async function profile(
  store: Store,
  slug: ProjectSlug,
  options: { forNewStories?: boolean; req?: PayloadRequest } = {},
): Promise<Profile | null> {
  const project = await bySlug(
    { payload: store.payload, origin: store.origin, req: options.req },
    slug,
  )
  if (!project) return null
  const [docs, usage] = await Promise.all([
    fieldDocs(store, project.id, options.req),
    usageOf(store, slug),
  ])
  const fields = await Promise.all(docs.map((doc) => fieldOf(store, doc, usage, options.req)))
  return {
    project: slug,
    language: project.language || 'en',
    fields: options.forNewStories ? fields.filter((field) => !field.hidden) : fields,
  }
}

/** The fields as the widget labels them (theme JSON `fields`). Hidden fields too. */
export async function labels(store: Store, slug: ProjectSlug) {
  const found = await profile(store, slug)
  return (found?.fields ?? []).map(({ property, label, showAs, valueType }) => ({
    property,
    label,
    showAs,
    valueType,
  }))
}

const fits = (valueType: ValueType, kind: ListKind | undefined) =>
  valueType === 'list'
    ? kind === 'items'
    : valueType === 'entity'
      ? kind === 'entities'
      : kind === undefined

async function listDoc(
  store: Store,
  projectId: number | string,
  key: string,
  req?: PayloadRequest,
) {
  const { docs } = await store.payload.find({
    collection: LISTS,
    where: { and: [{ project: { equals: projectId } }, { key: { equals: key } }] },
    limit: 1,
    depth: 1,
    req,
  })
  return (docs[0] as unknown as ListDoc | undefined) ?? null
}

/** A free key in a collection of the project: `key`, `key-2`, `key-3`… */
async function freeKey(taken: (key: string) => Promise<boolean>, label: string) {
  const base = keyOf(label) || crypto.randomUUID().slice(0, 8)
  for (let n = 1; ; n++) {
    const key = n === 1 ? base : `${base}-${n}`
    if (!(await taken(key))) return key
  }
}

export async function addField(
  store: Store,
  _operator: OperatorSession,
  slug: ProjectSlug,
  spec: FieldSpec,
): Promise<FieldResult> {
  const { payload } = store
  await seeded(payload)
  const project = await bySlug({ payload, origin: store.origin }, slug)
  if (!project) return { ok: false, error: 'unknown-project' }
  const docs = await fieldDocs(store, project.id)
  if (docs.length >= store.limits.fields) return { ok: false, error: 'too-many' }

  let property: Iri
  let values: {
    label: string
    help?: string
    valueType: ValueType
    max: number
    allowOwn: boolean
    showAs: Field['showAs']
  }
  let listId: number | string | undefined
  if (spec.from === 'catalogue') {
    const entry = CATALOGUE.find((e) => e.key === spec.key)
    if (!entry) return { ok: false, error: 'unknown-term' }
    property = entry.property
    values = {
      label: entry.label,
      help: entry.help,
      valueType: entry.valueType,
      max: entry.max,
      allowOwn: entry.allowOwn,
      showAs: entry.showAs,
    }
    if (docs.some((doc) => termOf(doc.property as never).iri === property)) {
      return { ok: false, error: 'property-taken' }
    }
    if (entry.list) {
      // A second question that names the same list ("People") reuses it.
      const found = await listDoc(store, project.id, entry.list.key)
      if (found) listId = found.id
      else {
        const made = await makeList(store, project, entry.list.key, {
          label: entry.list.name,
          kind: entry.list.kind,
          class: entry.list.class,
        })
        if (!made.ok) return { ok: false, error: 'too-many' }
        listId = made.id
        for (const label of seedOf(entry.list.seed, project)) {
          await addItemTo(store, project, made.id, label)
        }
      }
    }
  } else {
    if (!hasText(spec.label)) return { ok: false, error: 'unknown-term' }
    values = {
      label: spec.label.trim(),
      help: spec.help?.trim() || undefined,
      valueType: spec.valueType,
      max: spec.valueType === 'list' || spec.valueType === 'entity' ? 3 : 1,
      allowOwn: false,
      showAs: 'line',
    }
    if (spec.list !== undefined) {
      const found = await listDoc(store, project.id, spec.list)
      if (!found || !fits(spec.valueType, found.kind)) return { ok: false, error: 'bad-list' }
      listId = found.id
    } else if (!fits(spec.valueType, undefined)) return { ok: false, error: 'bad-list' }
    if (spec.from === 'term') {
      const term = await termByIri(payload, spec.property)
      if (!term || (term.project !== undefined && term.project !== project.id)) {
        return { ok: false, error: 'unknown-term' }
      }
      if (term.kind !== 'property') return { ok: false, error: 'not-a-property' }
      property = term.iri
      if (docs.some((doc) => termOf(doc.property as never).iri === property)) {
        return { ok: false, error: 'property-taken' }
      }
    } else {
      property = await mintProperty(store, project, values.label, values.help)
    }
  }
  const term = await termByIri(payload, property)
  if (!term) return { ok: false, error: 'unknown-term' }
  if (term.kind !== 'property') return { ok: false, error: 'not-a-property' }
  const position = docs.reduce((max, doc) => Math.max(max, doc.position), 0) + 1
  const doc = await payload.create({
    collection: FIELDS,
    data: {
      project: project.id as number,
      property: term.id as number,
      label: values.label,
      help: values.help ?? null,
      valueType: values.valueType,
      list: (listId as number | undefined) ?? null,
      required: false,
      max: values.max,
      showAs: values.showAs,
      allowOwn: values.allowOwn,
      hidden: false,
      position,
    },
    depth: 2,
  })
  return { ok: true, field: await fieldOf(store, doc as unknown as FieldDoc, new Map()) }
}

const hasText = (label: string) => typeof label === 'string' && label.trim().length > 0

function seedOf(
  seed: readonly string[] | 'project-language' | undefined,
  project: Project,
): string[] {
  if (!seed) return []
  if (seed !== 'project-language') return [...seed]
  const tag = project.language || 'en'
  try {
    return [new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag]
  } catch {
    return [tag]
  }
}

/** Mint `{origin}/vocab/{project}/p/{key}` as an own property of the project. */
async function mintProperty(store: Store, project: Project, label: string, help?: string) {
  const base = `${store.origin}/vocab/${project.slug}/p/`
  const key = await freeKey(
    async (k) =>
      (await store.payload.count({ collection: TERMS, where: { iri: { equals: `${base}${k}` } } }))
        .totalDocs > 0,
    label,
  )
  const iri = `${base}${key}`
  await store.payload.create({
    collection: TERMS,
    data: {
      iri,
      kind: 'property',
      label,
      comment: help ?? null,
      project: project.id as number,
      gone: false,
    },
  })
  return iri
}

async function fieldDocOf(store: Store, projectId: number | string, property: Iri) {
  const docs = await fieldDocs(store, projectId)
  return { docs, doc: docs.find((d) => termOf(d.property as never).iri === property) }
}

export async function updateField(
  store: Store,
  _operator: OperatorSession,
  slug: ProjectSlug,
  property: Iri,
  patch: FieldPatch,
): Promise<FieldResult> {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project) return { ok: false, error: 'unknown-project' }
  const { doc } = await fieldDocOf(store, project.id, property)
  if (!doc) return { ok: false, error: 'unknown-term' }
  const usage = await usageOf(store, slug)
  const locked = (usage.get(property) ?? 0) > 0
  const currentList = typeof doc.list === 'object' && doc.list ? (doc.list as ListDoc) : null
  const valueType = patch.valueType ?? doc.valueType
  let listId: number | string | null = currentList?.id ?? null
  if (patch.list !== undefined) {
    const found = await listDoc(store, project.id, patch.list)
    if (!found) return { ok: false, error: 'bad-list' }
    listId = found.id
  }
  // Property, value type and list are fixed once a story has a value (§8, field lock).
  if (locked && (valueType !== doc.valueType || listId !== (currentList?.id ?? null))) {
    return { ok: false, error: 'field-in-use' }
  }
  if (patch.valueType !== undefined && patch.list === undefined && valueType !== doc.valueType) {
    if (valueType !== 'list' && valueType !== 'entity') listId = null
  }
  const list =
    listId === null
      ? null
      : await store.payload.findByID({ collection: LISTS, id: listId, depth: 0 })
  if (!fits(valueType, (list?.kind as ListKind | undefined) ?? undefined)) {
    return { ok: false, error: 'bad-list' }
  }
  if (
    patch.max !== undefined &&
    !(Number.isInteger(patch.max) && patch.max >= 1 && patch.max <= store.limits.maxPerField)
  ) {
    return { ok: false, error: 'too-many' }
  }
  if (patch.label !== undefined && !hasText(patch.label))
    return { ok: false, error: 'unknown-term' }
  const updated = await store.payload.update({
    collection: FIELDS,
    id: doc.id,
    data: {
      ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
      ...(patch.help !== undefined ? { help: patch.help.trim() || null } : {}),
      ...(patch.required !== undefined ? { required: patch.required } : {}),
      ...(patch.max !== undefined ? { max: patch.max } : {}),
      ...(patch.showAs !== undefined ? { showAs: patch.showAs } : {}),
      ...(patch.allowOwn !== undefined ? { allowOwn: patch.allowOwn } : {}),
      ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}),
      valueType,
      list: listId as number | null,
    },
    depth: 2,
  })
  return { ok: true, field: await fieldOf(store, updated as unknown as FieldDoc, usage) }
}

/** Move a field to `to` (1 is the first). The others keep their order. */
export async function moveField(
  store: Store,
  _operator: OperatorSession,
  slug: ProjectSlug,
  property: Iri,
  to: number,
): Promise<FieldResult> {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project) return { ok: false, error: 'unknown-project' }
  const { docs, doc } = await fieldDocOf(store, project.id, property)
  if (!doc) return { ok: false, error: 'unknown-term' }
  const order = docs.filter((d) => d.id !== doc.id)
  const at = Math.min(Math.max(Math.round(to), 1), docs.length) - 1
  order.splice(at, 0, doc)
  for (const [i, d] of order.entries()) {
    if (d.position !== i + 1) {
      await store.payload.update({
        collection: FIELDS,
        id: d.id,
        data: { position: i + 1 },
        depth: 0,
      })
    }
  }
  const usage = await usageOf(store, slug)
  return { ok: true, field: await fieldOf(store, { ...doc, position: at + 1 }, usage) }
}

/** Remove a field that no story uses. A used field can only be hidden (`field-in-use`). */
export async function removeField(
  store: Store,
  _operator: OperatorSession,
  slug: ProjectSlug,
  property: Iri,
): Promise<FieldResult> {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project) return { ok: false, error: 'unknown-project' }
  const { docs, doc } = await fieldDocOf(store, project.id, property)
  if (!doc) return { ok: false, error: 'unknown-term' }
  const usage = await usageOf(store, slug)
  if ((usage.get(property) ?? 0) > 0) return { ok: false, error: 'field-in-use' }
  const field = await fieldOf(store, doc, usage)
  await store.payload.delete({ collection: FIELDS, id: doc.id })
  // Positions stay 1…n.
  for (const [i, d] of docs.filter((d) => d.id !== doc.id).entries()) {
    if (d.position !== i + 1) {
      await store.payload.update({
        collection: FIELDS,
        id: d.id,
        data: { position: i + 1 },
        depth: 0,
      })
    }
  }
  return { ok: true, field }
}

export async function lists(store: Store, slug: ProjectSlug): Promise<ListSummary[]> {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project) return []
  const [{ docs }, fields] = await Promise.all([
    store.payload.find({
      collection: LISTS,
      where: { project: { equals: project.id } },
      sort: 'createdAt',
      pagination: false,
      depth: 1,
    }),
    fieldDocs(store, project.id),
  ])
  return Promise.all(
    (docs as unknown as ListDoc[]).map(async (doc) => ({
      ...(await listOf(store, doc)),
      hidden: doc.hidden === true,
      askedBy: fields.filter((f) => idOf(f.list) === doc.id).map((f) => f.label),
    })),
  )
}

async function makeList(
  store: Store,
  project: Project,
  key: string,
  spec: { label: string; kind: ListKind; class?: Iri },
): Promise<
  { ok: true; id: number | string; key: string } | { ok: false; error: 'too-many' | 'bad-class' }
> {
  const { payload } = store
  const count = await payload.count({
    collection: LISTS,
    where: { project: { equals: project.id } },
  })
  if (count.totalDocs >= store.limits.lists) return { ok: false, error: 'too-many' }
  let classId: number | string | null = null
  if (spec.kind === 'entities') {
    const term = spec.class ? await termByIri(payload, spec.class) : null
    if (!term || term.kind !== 'class') return { ok: false, error: 'bad-class' }
    classId = term.id
  }
  const made = await payload.create({
    collection: LISTS,
    data: {
      project: project.id as number,
      key,
      iri: listIri(store.origin, project.slug, key),
      label: spec.label.trim(),
      kind: spec.kind,
      class: classId as number | null,
      hidden: false,
    },
    depth: 0,
  })
  return { ok: true, id: made.id, key }
}

export async function addList(
  store: Store,
  _operator: OperatorSession,
  slug: ProjectSlug,
  spec: { label: string; kind: ListKind; class?: Iri },
): Promise<
  | { ok: true; key: string }
  | { ok: false; error: 'too-many' | 'bad-class' }
  | { ok: false; error: 'exists'; key: string; label: string }
> {
  await seeded(store.payload)
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project || !hasText(spec.label)) return { ok: false, error: 'bad-class' }
  // One name, one list: a second "Places" would split the answers (recordings audit, 04).
  const name = spec.label.trim().toLocaleLowerCase()
  const { docs } = await store.payload.find({
    collection: LISTS,
    where: { project: { equals: project.id } },
    pagination: false,
    depth: 0,
  })
  const same = (docs as unknown as ListDoc[]).find(
    (doc) => doc.label.trim().toLocaleLowerCase() === name,
  )
  if (same) return { ok: false, error: 'exists', key: same.key, label: same.label }
  const key = await freeKey(async (k) => (await listDoc(store, project.id, k)) !== null, spec.label)
  const made = await makeList(store, project, key, spec)
  return made.ok ? { ok: true, key: made.key } : made
}

async function addItemTo(
  store: Store,
  project: Project,
  listId: number | string,
  label: string,
  extra: { parent?: number | string; sameAs?: string } = {},
) {
  const doc = await store.payload.create({
    collection: CONCEPTS,
    // The collection hook mints the IRI from the label.
    data: {
      project: project.id as number,
      list: listId as number,
      label,
      ...(extra.parent !== undefined ? { parent: extra.parent as number } : {}),
      ...(extra.sameAs ? { sameAs: extra.sameAs } : {}),
    } as never,
    depth: 0,
  })
  return doc.iri
}

export async function addItem(
  store: Store,
  _operator: OperatorSession,
  slug: ProjectSlug,
  listKey: string,
  spec: { label: string; parent?: Iri; sameAs?: string },
): Promise<{ ok: true; iri: Iri } | { ok: false; error: ItemError }> {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project) return { ok: false, error: 'unknown-project' }
  const list = await listDoc(store, project.id, listKey)
  if (!list) return { ok: false, error: 'unknown-list' }
  const label = spec.label?.trim()
  if (!label) return { ok: false, error: 'no-label' }
  if (spec.sameAs && !/^https?:\/\/[^\s]+$/.test(spec.sameAs))
    return { ok: false, error: 'bad-same-as' }
  if ((await listSize(store, list.id)) >= store.limits.itemsPerList)
    return { ok: false, error: 'too-many' }
  let parent: number | string | undefined
  if (spec.parent) {
    const { docs } = await store.payload.find({
      collection: CONCEPTS,
      where: { and: [{ iri: { equals: spec.parent } }, { list: { equals: list.id } }] },
      limit: 1,
      depth: 0,
    })
    if (!docs[0]) return { ok: false, error: 'bad-parent' }
    parent = docs[0].id
  }
  return {
    ok: true,
    iri: await addItemTo(store, project, list.id, label, {
      parent,
      ...(spec.sameAs ? { sameAs: spec.sameAs } : {}),
    }),
  }
}

interface ItemDoc {
  id: number | string
  iri: string
  label: string
  language?: string | null
  hidden?: boolean | null
  parent?: unknown
  list?: unknown
  sameAs?: string | null
}

/** The items of a project with these IRIs, each with its list key. */
export async function itemsOf(
  store: Store,
  slug: ProjectSlug,
  iris: Iri[],
  req?: PayloadRequest,
): Promise<Map<Iri, ItemDoc & { listKey: string }>> {
  if (iris.length === 0) return new Map()
  const { docs } = await store.payload.find({
    collection: CONCEPTS,
    where: { and: [{ iri: { in: [...new Set(iris)] } }, { 'project.slug': { equals: slug } }] },
    pagination: false,
    depth: 1,
    req,
  })
  return new Map(
    (docs as unknown as ItemDoc[]).map((doc) => [
      doc.iri,
      {
        ...doc,
        listKey: typeof doc.list === 'object' && doc.list ? (doc.list as ListDoc).key : '',
      },
    ]),
  )
}

export async function item(
  store: Store,
  slug: ProjectSlug,
  iri: Iri,
  options: { req?: PayloadRequest } = {},
) {
  const found = (await itemsOf(store, slug, [iri], options.req)).get(iri)
  if (!found) return null
  return {
    iri: found.iri,
    label: found.label,
    ...(found.language ? { language: found.language } : {}),
    list: found.listKey,
  }
}

/** The tree of a list in label order, depth-first. Beyond 200 items: a search by label. */
export async function choices(
  store: Store,
  slug: ProjectSlug,
  listKey: string,
  query?: string,
): Promise<Choice[]> {
  const project = await bySlug({ payload: store.payload, origin: store.origin }, slug)
  if (!project) return []
  const list = await listDoc(store, project.id, listKey)
  if (!list) return []
  const and: Where[] = [{ list: { equals: list.id } }, { hidden: { not_equals: true } }]
  const size = await store.payload.count({ collection: CONCEPTS, where: { and } })
  const text = query?.trim()
  if (size.totalDocs > 200 || text) {
    const { docs } = await store.payload.find({
      collection: CONCEPTS,
      where: { and: [...and, ...(text ? [{ label: { like: text } }] : [])] },
      sort: 'label',
      limit: 50,
      depth: 1,
    })
    return (docs as unknown as ItemDoc[]).map((doc) => choiceOf(doc, 0))
  }
  const { docs } = await store.payload.find({
    collection: CONCEPTS,
    where: { and },
    sort: 'label',
    pagination: false,
    depth: 1,
  })
  const items = docs as unknown as ItemDoc[]
  const byParent = new Map<string, ItemDoc[]>()
  const known = new Set(items.map((doc) => doc.iri))
  for (const doc of items) {
    const parent = classOf(doc.parent)
    const key = parent && known.has(parent) ? parent : ''
    byParent.set(key, [...(byParent.get(key) ?? []), doc])
  }
  const out: Choice[] = []
  const walk = (key: string, depth: number) => {
    for (const doc of byParent.get(key) ?? []) {
      out.push(choiceOf(doc, depth))
      walk(doc.iri, depth + 1)
    }
  }
  walk('', 0)
  return out
}

function choiceOf(doc: ItemDoc, depth: number): Choice {
  const parent = classOf(doc.parent)
  return {
    iri: doc.iri,
    label: doc.label,
    ...(doc.language ? { language: doc.language } : {}),
    ...(parent ? { parent } : {}),
    depth,
  }
}
