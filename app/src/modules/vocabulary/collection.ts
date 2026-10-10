import {
  APIError,
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type FieldHook,
  type PayloadRequest,
  type Where,
} from 'payload'

import { byId } from '@/modules/projects'

import { CATALOGUE } from './catalogue'
import { importFile } from './importFile'
import { ONTOLOGIES, TERMS, seeded } from './ontologies'
import { NS } from './terms'
import { VOCABULARY_LIMITS } from './types'

export const CONCEPTS = 'concepts' as const
export const FIELDS = 'vocab-fields' as const
export const LISTS = 'vocab-lists' as const

const isOperator = ({ req }: { req: PayloadRequest }) => req.user?.collection === 'users'

/** The bytes of a request body, or null when it has more than `limit` bytes. */
async function readCapped(
  body: ReadableStream<Uint8Array> | null | undefined,
  limit: number,
): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      // Read the rest and keep nothing, so the answer 413 reaches the client on a clean
      // connection (a proxy in front, also `next dev`, breaks the next request otherwise).
      // A body of more than four times the limit is cut.
      for (let rest = size; rest <= limit * 4;) {
        const next = await reader.read()
        if (next.done) return null
        rest += next.value.byteLength
      }
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}
const nobody = () => false

/** What the vocabulary needs from the `stories` module. Given in `payload.config.ts`. */
export interface VocabularyDeps {
  /** ANNOUDIO_ORIGIN, the base of every minted IRI. */
  origin: string
  /** Called on first use, so the `stories` instance can be made after the config. */
  stories: () => {
    conceptChanged(iri: string, options?: { req?: PayloadRequest }): Promise<void>
    valueCounts(project: string): Promise<Map<string, number>>
  }
}

/** The IRI of a concept: `{origin}/vocab/{project}/c/{key}`. */
export function conceptIriBase(origin: string, project: string): string {
  return `${origin}/vocab/${project}/c/`
}

/** Lowercase ASCII letters and digits with single hyphens, or '' for a label with none. */
export function keyOf(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

export const idOf = (value: unknown): number | string | undefined =>
  typeof value === 'object' && value !== null && 'id' in value
    ? (value as { id: number | string }).id
    : ((value as number | string | undefined) ?? undefined)

const MAX_DEPTH = 100

export function conceptsCollection(deps: VocabularyDeps): CollectionConfig {
  // The app makes the IRI once, from the label, and never changes it. A label with no
  // Latin letters (for example Malayalam) gets a random key. A caller that gives an IRI
  // (the SKOS import, the tests) keeps it.
  const mintAndCheck: CollectionBeforeValidateHook = async ({
    data,
    originalDoc,
    operation,
    req,
  }) => {
    if (!data) return data
    const refuse = (path: string, message: string) =>
      new ValidationError({ collection: CONCEPTS, errors: [{ path, message }], req })
    const projectId = idOf(data.project ?? originalDoc?.project)
    if (operation === 'update' && idOf(originalDoc?.project) !== projectId) {
      throw refuse('project', 'An item stays in its project. Make a new item in the other project.')
    }
    const project =
      projectId === undefined ? null : await byId({ payload: req.payload, req }, projectId)
    if (!project) return data

    // An item without a list goes to the list Topics of its project (the old path: one
    // list per project). An item stays in its list.
    let listId = idOf(data.list === undefined ? originalDoc?.list : data.list)
    if (operation === 'update' && originalDoc?.list && idOf(originalDoc.list) !== listId) {
      throw refuse('list', 'An item stays in its list. Make a new item in the other list.')
    }
    if (listId === undefined || listId === null) {
      listId = await topicsListOf(req, deps.origin, project)
      data = { ...data, list: listId }
    } else {
      const list = await req.payload.findByID({
        collection: LISTS,
        id: listId,
        depth: 0,
        disableErrors: true,
        req,
      })
      if (!list || idOf(list.project) !== projectId) {
        throw refuse('list', 'Choose a list of the same project.')
      }
    }

    const parentId = idOf(data.parent === undefined ? originalDoc?.parent : data.parent)
    if (parentId !== undefined && parentId !== null) {
      // Walk up from the new parent. Finding this concept, or another project, refuses.
      let current: number | string | undefined = parentId
      for (let depth = 0; current !== undefined && current !== null; depth++) {
        if (current === originalDoc?.id || depth > MAX_DEPTH) {
          throw refuse(
            'parent',
            'An item cannot be under itself or under one of its narrower items.',
          )
        }
        const parent = await req.payload.findByID({
          collection: CONCEPTS,
          id: current,
          depth: 0,
          disableErrors: true,
          req,
        })
        if (!parent || idOf(parent.project) !== projectId) {
          throw refuse('parent', 'Choose a broader item of the same project.')
        }
        if (idOf(parent.list) !== listId) {
          throw refuse('parent', 'Choose a broader item of the same list.')
        }
        current = idOf(parent.parent)
      }
    }

    if (operation === 'update' || data.iri) return data
    const base = conceptIriBase(deps.origin, project.slug)
    const key = keyOf(String(data.label ?? '')) || crypto.randomUUID().slice(0, 8)
    for (let n = 1; ; n++) {
      const iri = `${base}${n === 1 ? key : `${key}-${n}`}`
      const { totalDocs } = await req.payload.count({
        collection: CONCEPTS,
        where: { iri: { equals: iri } },
        req,
      })
      if (totalDocs === 0) return { ...data, iri }
    }
  }

  // The IRI never changes, even when a caller sends one.
  const keepIri: CollectionBeforeValidateHook = ({ data, originalDoc, operation }) =>
    operation === 'update' && data && originalDoc?.iri ? { ...data, iri: originalDoc.iri } : data

  // Published stories show the label of each tag. A new label rebuilds them in this
  // transaction.
  const relabelStories: CollectionAfterChangeHook = async ({
    doc,
    previousDoc,
    operation,
    req,
  }) => {
    if (
      operation === 'update' &&
      (previousDoc?.label !== doc.label || previousDoc?.language !== doc.language)
    ) {
      await deps.stories().conceptChanged(doc.iri, { req })
    }
    return doc
  }

  // A concept that stories use stays: the operator hides it. A concept with narrower
  // concepts stays until they move.
  const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
    const doc = await req.payload.findByID({ collection: CONCEPTS, id, depth: 0, req })
    const project = await byId({ payload: req.payload, req }, idOf(doc.project)!)
    const uses = project ? ((await deps.stories().valueCounts(project.slug)).get(doc.iri) ?? 0) : 0
    if (uses > 0) {
      throw new APIError(
        `${uses === 1 ? '1 story uses' : `${uses} stories use`} this item. Select "Hide from new stories" in place of delete.`,
        400,
        { code: 'concept-in-use', uses },
        true,
      )
    }
    const { totalDocs } = await req.payload.count({
      collection: CONCEPTS,
      where: { parent: { equals: id } },
      req,
    })
    if (totalDocs > 0) {
      throw new APIError(
        'This item has narrower items. Move them or remove them first.',
        400,
        { code: 'concept-has-children' },
        true,
      )
    }
  }

  return {
    slug: CONCEPTS,
    labels: { singular: 'Item', plural: 'List items' },
    admin: {
      // The Lists tab of a project and the page of each list show them (admin/vocabulary/).
      group: false,
      useAsTitle: 'label',
      defaultColumns: ['label', 'list', 'parent', 'project', 'hidden', 'updatedAt'],
      description:
        'A list holds the items that members can choose as an answer, for example the places of your area. Add, rename or hide items here.',
      hideAPIURL: true,
      components: { beforeListTable: ['/admin/ListEmpty#ItemsEmpty'] },
    },
    hooks: {
      beforeValidate: [keepIri, mintAndCheck],
      afterChange: [relabelStories],
      beforeDelete: [guardDelete],
    },
    fields: [
      {
        // "← Back to Places": the page of the item's list (admin/vocabulary/ConceptBack.tsx).
        name: 'back',
        type: 'ui',
        admin: { components: { Field: '/admin/vocabulary/ConceptBack#ConceptBack' } },
      },
      {
        name: 'project',
        label: 'Project',
        type: 'relationship',
        relationTo: 'projects',
        required: true,
        index: true,
        admin: { allowCreate: false },
        // "Add a concept" links give the project: /admin/collections/concepts/create?project=<id>.
        defaultValue: ({ req }) => {
          const asked = Number(req.query?.project)
          return Number.isInteger(asked) && asked > 0 ? asked : undefined
        },
      },
      {
        // Never empty: the hook fills it with the list Topics of the project when a caller
        // gives none (the old path, and the tests of other modules, give none).
        name: 'list',
        label: 'List',
        type: 'relationship',
        relationTo: LISTS,
        index: true,
        admin: { allowCreate: false },
        filterOptions: ({ data }): Where => ({
          project: { equals: idOf(data?.project) ?? null },
        }),
        defaultValue: ({ req }) => {
          const asked = Number(req.query?.list)
          return Number.isInteger(asked) && asked > 0 ? asked : undefined
        },
      },
      {
        name: 'label',
        label: 'Label',
        type: 'text',
        required: true,
        admin: {
          description: 'The word that members choose and visitors see on the story.',
          placeholder: 'Ferry',
        },
      },
      {
        name: 'sameAs',
        label: 'Same as',
        type: 'text',
        admin: {
          description:
            'Optional. The web address of the same thing in a different system, for example Wikidata, VIAF or an Omeka item.',
        },
        validate: (value: unknown) =>
          value === null ||
          value === undefined ||
          value === '' ||
          (typeof value === 'string' && /^https?:\/\/[^\s]+$/.test(value)) ||
          'Use a web address that starts with https:// or http://.',
      },
      {
        name: 'parent',
        label: 'Broader item',
        type: 'relationship',
        relationTo: CONCEPTS,
        admin: {
          allowCreate: false,
          description: 'Optional. The item that this item is a part of.',
        },
        filterOptions: ({ data, id }): Where => {
          const sameList: Where = data?.list
            ? { list: { equals: idOf(data.list) ?? null } }
            : { project: { equals: idOf(data?.project) ?? null } }
          return id === undefined ? sameList : { and: [sameList, { id: { not_equals: id } }] }
        },
      },
      {
        name: 'hidden',
        label: 'Hide from new stories',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          description:
            'Members cannot choose a hidden item for a new story. Stories that use it keep it.',
        },
      },
      {
        name: 'usage',
        type: 'ui',
        admin: { components: { Field: '/admin/vocabulary/ConceptUsage#ConceptUsage' } },
      },
      {
        // The language tag of the label, for example `en`.
        name: 'language',
        label: 'Language of the label',
        type: 'text',
        admin: { description: 'Optional. A language tag.', placeholder: 'en' },
      },
      {
        // The stable IRI of the concept. Stories point at it.
        name: 'iri',
        label: 'Address (IRI)',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        // The hook makes the IRI before the database check. The admin form has none yet.
        validate: (): true => true,
        admin: {
          readOnly: true,
          position: 'sidebar',
          description:
            'The app makes this address when you save. It never changes, so other systems can point at it.',
        },
      },
    ],
  }
}

/**
 * The ontologies of the organisation (Settings → Ontologies). Read-only rows: the bundle
 * seed and `importFile` write them. A bundled ontology cannot be removed.
 */
export function ontologiesCollection(deps: { origin: string }): CollectionConfig {
  const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
    const doc = await req.payload.findByID({ collection: ONTOLOGIES, id, depth: 0, req })
    if (doc.source === 'bundled') {
      throw new APIError(
        'This ontology comes with Annoudio. It cannot be removed.',
        400,
        { code: 'ontology-bundled' },
        true,
      )
    }
    // A field records its answers with the property: the property stays while a field uses it.
    const used = await req.payload.count({
      collection: FIELDS,
      where: { 'property.ontology': { equals: id } },
      req,
    })
    if (used.totalDocs > 0) {
      throw new APIError(
        `${used.totalDocs === 1 ? 'A question uses' : `${used.totalDocs} questions use`} a property of this ontology. Remove those questions first.`,
        400,
        { code: 'ontology-in-use' },
        true,
      )
    }
    await req.payload.delete({ collection: TERMS, where: { ontology: { equals: id } }, req })
  }
  const termCount: FieldHook = async ({ data, req }) =>
    data?.id === undefined
      ? null
      : (
          await req.payload.count({
            collection: TERMS,
            where: { ontology: { equals: data.id } },
            req,
          })
        ).totalDocs

  return {
    slug: ONTOLOGIES,
    labels: { singular: 'Ontology', plural: 'Ontologies' },
    admin: {
      group: 'Settings',
      useAsTitle: 'label',
      defaultColumns: ['label', 'prefix', 'namespace', 'terms', 'source', 'loadedAt'],
      description:
        'Each answer that a member gives about a part of a recording is saved with a property of an ontology, for example the place with dcterms:spatial of Dublin Core. Eight ontologies come with Annoudio; load one here only when a question needs a different property.',
      hideAPIURL: true,
    },
    access: { read: isOperator, create: nobody, update: nobody, delete: isOperator },
    hooks: { beforeDelete: [guardDelete] },
    // "Load a vocabulary file" (design/vocab.md §6): a route handler, so the 1 MiB body
    // limit of a Server Action does not apply. The body is the file; it stops at 5 MB.
    endpoints: [
      {
        path: '/import',
        method: 'post',
        handler: async (req) => {
          if (req.user?.collection !== 'users') {
            return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
          }
          const query = new URL(req.url ?? '', 'http://x').searchParams
          const json = (key: string) => {
            try {
              return JSON.parse(query.get(key) ?? 'null') ?? undefined
            } catch {
              return undefined
            }
          }
          const limits = VOCABULARY_LIMITS
          const bytes = await readCapped((req as unknown as Request).body, limits.fileBytes)
          if (!bytes) return Response.json({ ok: false, error: 'too-large' }, { status: 413 })
          const result = await importFile(
            { payload: req.payload, origin: deps.origin, limits: { ...limits } },
            { operatorId: String(req.user.id) },
            { name: query.get('name') ?? 'file', bytes },
            {
              ...(query.get('project') ? { project: query.get('project')! } : {}),
              apply: query.get('apply') === '1',
              accept: json('accept'),
              names: json('names'),
            },
          )
          return Response.json(result, { status: result.ok ? 200 : 400 })
        },
      },
    ],
    fields: [
      { name: 'label', label: 'Name', type: 'text', required: true },
      { name: 'namespace', label: 'Namespace', type: 'text', required: true, unique: true },
      { name: 'prefix', label: 'Prefix', type: 'text', required: true },
      {
        name: 'source',
        label: 'Source',
        type: 'select',
        required: true,
        options: [
          { label: 'Comes with Annoudio', value: 'bundled' },
          { label: 'Uploaded', value: 'uploaded' },
        ],
      },
      { name: 'licence', label: 'Licence', type: 'text' },
      { name: 'fileHash', type: 'text', admin: { hidden: true } },
      { name: 'loadedAt', label: 'Loaded', type: 'date' },
      {
        name: 'terms',
        label: 'Terms',
        type: 'number',
        virtual: true,
        admin: { readOnly: true },
        hooks: { afterRead: [termCount] },
      },
    ],
  }
}

/** One property or class of an ontology, or an own property of a project. Hidden. */
export const ontologyTermsCollection: CollectionConfig = {
  slug: TERMS,
  admin: { hidden: true, useAsTitle: 'label' },
  access: { read: isOperator, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'iri', type: 'text', required: true, unique: true, index: true },
    { name: 'ontology', type: 'relationship', relationTo: ONTOLOGIES, index: true },
    // Only for an own property ("Your own question"): the project that minted it.
    { name: 'project', type: 'relationship', relationTo: 'projects', index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: ['property', 'class'],
    },
    { name: 'label', type: 'text', required: true, index: true },
    { name: 'comment', type: 'textarea' },
    { name: 'rangeHint', type: 'text' },
    // True when the newest file of the ontology no longer has the term.
    { name: 'gone', type: 'checkbox', defaultValue: false },
  ],
}

/** The IRI of a list: Topics keeps the scheme IRI of the old vocabulary; others get `/s/{key}`. */
export function listIri(origin: string, project: string, key: string): string {
  return key === 'topics' ? `${origin}/vocab/${project}` : `${origin}/vocab/${project}/s/${key}`
}

/** The id of the list Topics of a project; the first call makes it. */
export async function topicsListOf(
  req: PayloadRequest,
  origin: string,
  project: { id: number | string; slug: string },
): Promise<number | string> {
  const { docs } = await req.payload.find({
    collection: LISTS,
    where: { and: [{ project: { equals: project.id } }, { key: { equals: 'topics' } }] },
    limit: 1,
    depth: 0,
    req,
  })
  if (docs[0]) return docs[0].id
  const made = await req.payload.create({
    collection: LISTS,
    data: {
      project: project.id as number,
      key: 'topics',
      iri: listIri(origin, project.slug, 'topics'),
      label: 'Topics',
      kind: 'items',
    },
    depth: 0,
    req,
  })
  // As the migration does (design/vocab.md §4, step 3): a project with items in Topics
  // asks the question Topics, unless it has a field for `dcterms:subject` already.
  await seeded(req.payload)
  const subject = await req.payload.find({
    collection: TERMS,
    where: { iri: { equals: `${NS.dcterms}subject` } },
    limit: 1,
    depth: 0,
    req,
  })
  const fields = await req.payload.find({
    collection: FIELDS,
    where: { project: { equals: project.id } },
    pagination: false,
    depth: 0,
    req,
  })
  const term = subject.docs[0]
  if (term && !fields.docs.some((field) => idOf(field.property) === term.id)) {
    const topics = CATALOGUE.find((entry) => entry.key === 'topics')!
    await req.payload.create({
      collection: FIELDS,
      data: {
        project: project.id as number,
        property: term.id,
        label: topics.label,
        help: topics.help ?? null,
        valueType: 'list',
        list: made.id,
        max: topics.max,
        showAs: topics.showAs,
        allowOwn: false,
        required: false,
        hidden: false,
        position: fields.docs.reduce((max, field) => Math.max(max, field.position), 0) + 1,
      },
      depth: 0,
      req,
    })
  }
  return made.id
}

/**
 * The lists of the projects (Topics, Places, People). Hidden in the admin: the Lists tab
 * of a project shows them, and the `vocabulary` interface writes them.
 */
export const vocabListsCollection: CollectionConfig = {
  slug: LISTS,
  labels: { singular: 'List', plural: 'Lists' },
  admin: { hidden: true, useAsTitle: 'label' },
  access: { read: isOperator, create: nobody, update: nobody, delete: nobody },
  indexes: [{ fields: ['project', 'key'], unique: true }],
  fields: [
    { name: 'project', type: 'relationship', relationTo: 'projects', required: true, index: true },
    { name: 'key', type: 'text', required: true },
    { name: 'iri', type: 'text', required: true, unique: true },
    { name: 'label', type: 'text', required: true },
    { name: 'kind', type: 'select', required: true, options: ['items', 'entities'] },
    // The class of the entities of the list, for example foaf:Person. Empty for items.
    { name: 'class', type: 'relationship', relationTo: TERMS },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
  ],
}

/**
 * The fields of the projects: the vocabulary, in `position` order. Hidden in the admin:
 * the Vocabulary tab of a project shows them, and the `vocabulary` interface writes them.
 */
export const vocabFieldsCollection: CollectionConfig = {
  slug: FIELDS,
  labels: { singular: 'Field', plural: 'Fields' },
  admin: { hidden: true, useAsTitle: 'label' },
  access: { read: isOperator, create: nobody, update: nobody, delete: nobody },
  // One field per property in a project: the stored body names the property, not the field.
  indexes: [{ fields: ['project', 'property'], unique: true }],
  fields: [
    { name: 'project', type: 'relationship', relationTo: 'projects', required: true, index: true },
    { name: 'property', type: 'relationship', relationTo: TERMS, required: true },
    { name: 'label', type: 'text', required: true },
    { name: 'help', type: 'text' },
    {
      name: 'valueType',
      type: 'select',
      required: true,
      options: ['text', 'date', 'number', 'link', 'list', 'entity'],
    },
    { name: 'list', type: 'relationship', relationTo: LISTS },
    { name: 'required', type: 'checkbox', defaultValue: false },
    { name: 'max', type: 'number', required: true, min: 1, max: 10, defaultValue: 1 },
    {
      name: 'showAs',
      type: 'select',
      required: true,
      options: ['line', 'tags', 'none'],
      defaultValue: 'line',
    },
    { name: 'allowOwn', type: 'checkbox', defaultValue: false },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
    { name: 'position', type: 'number', required: true, index: true },
  ],
}
