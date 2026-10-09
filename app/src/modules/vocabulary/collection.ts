import {
  APIError,
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type PayloadRequest,
  type Where,
} from 'payload'

import { byId } from '@/modules/projects'

export const CONCEPTS = 'concepts'

/** What the vocabulary needs from the `stories` module. Given in `payload.config.ts`. */
export interface VocabularyDeps {
  /** ANNOUDIO_ORIGIN, the base of every minted IRI. */
  origin: string
  /** Called on first use, so the `stories` instance can be made after the config. */
  stories: () => {
    conceptChanged(iri: string, options?: { req?: PayloadRequest }): Promise<void>
    tagCounts(project: string): Promise<Map<string, number>>
  }
}

/** The IRI of a concept: `{origin}/vocab/{project}/c/{key}`. */
export function conceptIriBase(origin: string, project: string): string {
  return `${origin}/vocab/${project}/c/`
}

/** Lowercase ASCII letters and digits with single hyphens, or '' for a label with none. */
function keyOf(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

const idOf = (value: unknown): number | string | undefined =>
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
      throw refuse(
        'project',
        'A concept stays in its project. Make a new concept in the other project.',
      )
    }
    const project =
      projectId === undefined ? null : await byId({ payload: req.payload, req }, projectId)
    if (!project) return data

    const parentId = idOf(data.parent === undefined ? originalDoc?.parent : data.parent)
    if (parentId !== undefined && parentId !== null) {
      // Walk up from the new parent. Finding this concept, or another project, refuses.
      let current: number | string | undefined = parentId
      for (let depth = 0; current !== undefined && current !== null; depth++) {
        if (current === originalDoc?.id || depth > MAX_DEPTH) {
          throw refuse(
            'parent',
            'A concept cannot be under itself or under one of its narrower concepts.',
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
          throw refuse('parent', 'Choose a broader concept of the same project.')
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
    const uses = project ? ((await deps.stories().tagCounts(project.slug)).get(doc.iri) ?? 0) : 0
    if (uses > 0) {
      throw new APIError(
        `${uses === 1 ? '1 story uses' : `${uses} stories use`} this concept. Select "Hide from new stories" in place of delete.`,
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
        'This concept has narrower concepts. Move them or remove them first.',
        400,
        { code: 'concept-has-children' },
        true,
      )
    }
  }

  return {
    slug: CONCEPTS,
    labels: { singular: 'Concept', plural: 'Concepts' },
    admin: {
      // The sidebar link Concepts comes from `admin/NavLinks.tsx`.
      group: false,
      useAsTitle: 'label',
      defaultColumns: ['label', 'parent', 'project', 'hidden', 'updatedAt'],
      description:
        'The terms that members choose as topics. Each project has its own vocabulary. To see a vocabulary as a tree, select Concepts in the menu.',
      hideAPIURL: true,
    },
    hooks: {
      beforeValidate: [keepIri, mintAndCheck],
      afterChange: [relabelStories],
      beforeDelete: [guardDelete],
    },
    fields: [
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
        name: 'label',
        label: 'Label',
        type: 'text',
        required: true,
        admin: { description: 'The word that members see in the list of topics.' },
      },
      {
        name: 'parent',
        label: 'Broader concept',
        type: 'relationship',
        relationTo: CONCEPTS,
        admin: {
          allowCreate: false,
          description: 'Optional. The concept that this concept is part of.',
        },
        filterOptions: ({ data, id }): Where => {
          const sameProject: Where = { project: { equals: idOf(data?.project) ?? null } }
          return id === undefined ? sameProject : { and: [sameProject, { id: { not_equals: id } }] }
        },
      },
      {
        name: 'hidden',
        label: 'Hide from new stories',
        type: 'checkbox',
        defaultValue: false,
        admin: {
          description:
            'Members cannot choose a hidden concept for a new story. Stories that use it keep it.',
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
        admin: { description: 'Optional. A language tag, for example en or ml.' },
      },
      {
        // The stable IRI of the concept. Stories point at it.
        name: 'iri',
        label: 'Concept address (IRI)',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        // The hook makes the IRI before the database check. The admin form has none yet.
        validate: (): true => true,
        admin: {
          readOnly: true,
          position: 'sidebar',
          description: 'The app makes this address when you save. It never changes.',
        },
      },
    ],
  }
}
