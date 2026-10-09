import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { removeFirstLine } from '@/plural'

import { themeTokensField } from './theme'

// A project is one configuration set: vocabulary, theme tokens, review rules, rights line.
// Interface: the `bySlug` lookup, the `returnTarget` origin check, and the theme JSON
// (`theme`, `handleTheme`, `THEME_TOKENS`).

export { THEME_TOKENS, handleTheme, theme, type ThemeContext, type ThemeJson } from './theme'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** `review`: an operator publishes each story. `publish-at-once`: `saveDraft` publishes. */
export type ReviewRule = 'review' | 'publish-at-once'

/** The rights statements an operator can choose. `other` keeps the typed line and IRI. */
const RIGHTS = {
  'cc-by-4.0': { line: 'CC BY 4.0', iri: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-nc-4.0': { line: 'CC BY-NC 4.0', iri: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  'all-rights-reserved': {
    line: 'All rights reserved',
    iri: 'http://rightsstatements.org/vocab/InC/1.0/',
  },
} as const

const isListed = (value: unknown): value is keyof typeof RIGHTS =>
  typeof value === 'string' && Object.hasOwn(RIGHTS, value)

// A listed choice writes its line and IRI. "Other" (or no choice, in rows made before the
// choice existed) keeps what the operator typed.
const fillRights: CollectionBeforeChangeHook = ({ data }) =>
  isListed(data.rights)
    ? { ...data, rightsLine: RIGHTS[data.rights].line, rightsIri: RIGHTS[data.rights].iri }
    : data

const typedRights = (data: Record<string, unknown>) => !isListed(data?.rights)

/** What the projects need from the `stories` module. Given in `payload.config.ts`. */
export interface ProjectsDeps {
  /** Called on first use, so the `stories` instance can be made after the config. */
  stories: () => {
    forgetInstances(
      of: { project: string },
      options: { req: PayloadRequest },
    ): Promise<{ stories: number; replies: number }>
  }
  /** The `vocabulary` module's `removeVocabulary`: the concepts go with their project. */
  removeVocabulary(
    context: { payload: Payload; req: PayloadRequest },
    projectId: number | string,
  ): Promise<void>
}

export function projectsCollection(deps: ProjectsDeps): CollectionConfig {
  // A project with stories or replies stays: the operator removes them first. Without the
  // project its stories have no rights line and no theme, and the read routes would still
  // serve them. A project with none also takes its served representations and its
  // vocabulary away.
  const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
    const project = await byId({ payload: req.payload, req }, id)
    if (!project) return
    const { stories, replies } = await deps
      .stories()
      .forgetInstances({ project: project.slug }, { req })
    if (stories + replies > 0) {
      throw new APIError(
        removeFirstLine('project', stories, replies),
        400,
        { code: 'project-has-stories', stories, replies },
        true,
      )
    }
    await deps.removeVocabulary({ payload: req.payload, req }, id)
  }

  return {
    slug: 'projects',
    labels: { singular: 'Project', plural: 'Projects' },
    admin: {
      group: 'Settings',
      useAsTitle: 'name',
      defaultColumns: ['name', 'slug', 'reviewRule', 'updatedAt'],
      description:
        'One project for each site or collection: its vocabulary, review rule, rights statement and player theme.',
      hideAPIURL: true,
      components: {
        // The Overview tab comes first (O16): stories, recordings, concepts, members.
        views: {
          edit: {
            default: { tab: { Component: '/admin/DocTabs#SettingsTab' } },
            overview: {
              Component: '/admin/projects/Overview#Overview',
              path: '/overview',
              tab: { Component: '/admin/DocTabs#OverviewTab', order: 0 },
            },
          },
        },
      },
    },
    hooks: { beforeChange: [fillRights], beforeDelete: [guardDelete] },
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Project',
            fields: [
              { name: 'name', label: 'Name', type: 'text', required: true },
              {
                // The slug is part of every story IRI. Do not change it after the first story.
                name: 'slug',
                label: 'Short name',
                type: 'text',
                required: true,
                unique: true,
                index: true,
                admin: {
                  description:
                    'Part of the snippet and of every story address. Use lowercase letters, digits and hyphens, for example river-voices. Do not change it after the first story.',
                },
                validate: (value: unknown) =>
                  (typeof value === 'string' && SLUG.test(value)) ||
                  'Use lowercase letters, digits and single hyphens.',
              },
              {
                // The allow-list of the Annotate page `return` URL. With no rows, the Annotate
                // page never sends a member back to a host page.
                name: 'siteOrigins',
                label: 'Websites',
                labels: { singular: 'Website', plural: 'Websites' },
                type: 'array',
                admin: {
                  description:
                    'The web sites that show this project. Example: https://www.example.org. The Annotate page sends members back only to these sites.',
                },
                fields: [
                  {
                    name: 'origin',
                    label: 'Website address',
                    type: 'text',
                    required: true,
                    validate: (value: unknown) =>
                      (typeof value === 'string' && originOf(value) === value) ||
                      'Use a scheme and a host only, for example https://www.example.org.',
                  },
                ],
              },
              {
                // The default language tag of text bodies, for example `ml`.
                name: 'language',
                label: 'Language of the stories',
                type: 'text',
                admin: {
                  description:
                    'A language tag, for example en, ml or hi. The player uses it to show the text correctly.',
                },
              },
            ],
          },
          {
            label: 'Review and rights',
            fields: [
              {
                // Empty in rows made before the rule existed: the same as `review`.
                name: 'reviewRule',
                label: 'Review',
                type: 'radio',
                defaultValue: 'review',
                options: [
                  { label: 'An operator reads each story before it is public', value: 'review' },
                  { label: 'Publish each story at once', value: 'publish-at-once' },
                ],
                admin: {
                  description:
                    'With "Publish each story at once", visitors see a story when the member saves it. A story with a voice note, photo or video still waits until the file is ready and an operator publishes it.',
                },
              },
              {
                name: 'rights',
                label: 'Rights statement',
                type: 'select',
                options: [
                  { label: 'CC BY 4.0', value: 'cc-by-4.0' },
                  { label: 'CC BY-NC 4.0', value: 'cc-by-nc-4.0' },
                  { label: 'All rights reserved', value: 'all-rights-reserved' },
                  { label: 'Other: type it below', value: 'other' },
                ],
                admin: {
                  description:
                    'The rights statement shown under each story. Members see it before they save.',
                },
              },
              {
                // Text for the Annotate form.
                name: 'rightsLine',
                label: 'Rights statement text',
                type: 'text',
                admin: {
                  condition: typedRights,
                  description: 'Example: © 2026 Kochi Heritage Trust. Shown under each story.',
                },
              },
              {
                // The licence IRI that goes into each story as `rights`.
                name: 'rightsIri',
                label: 'Licence address',
                type: 'text',
                admin: {
                  condition: typedRights,
                  description:
                    'Optional. The web address of the licence, for example https://creativecommons.org/licenses/by-sa/4.0/.',
                },
              },
            ],
          },
          {
            label: 'Vocabulary',
            fields: [
              {
                name: 'vocabulary',
                type: 'ui',
                admin: { components: { Field: '/admin/projects/VocabularyPanel#VocabularyPanel' } },
              },
            ],
          },
          {
            label: 'Theme',
            fields: [
              {
                name: 'themePreview',
                type: 'ui',
                admin: { components: { Field: '/admin/projects/ThemePreview#ThemePreview' } },
              },
              themeTokensField,
            ],
          },
        ],
      },
    ],
  }
}

export interface Project {
  /** The admin document id. */
  id: number | string
  iri: string
  slug: string
  label: string
  rightsIri?: string
  /** Text for the Annotate form. */
  rightsLine?: string
  language?: string
  reviewRule: ReviewRule
  /** Origins of the host sites, each `scheme://host[:port]`. */
  siteOrigins: string[]
}

export interface ProjectsContext {
  payload: Payload
  origin: string
  req?: PayloadRequest
}

/** Find a project by its slug. Returns null if no project has the slug. */
export async function bySlug(context: ProjectsContext, slug: string): Promise<Project | null> {
  const { docs } = await context.payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    limit: 1,
    pagination: false,
    depth: 0,
    req: context.req,
  })
  const doc = docs[0]
  if (!doc) return null
  return {
    id: doc.id,
    iri: `${context.origin}/projects/${doc.slug}`,
    slug: doc.slug,
    label: doc.name,
    ...(doc.rightsIri ? { rightsIri: doc.rightsIri } : {}),
    ...(doc.rightsLine ? { rightsLine: doc.rightsLine } : {}),
    ...(doc.language ? { language: doc.language } : {}),
    reviewRule: doc.reviewRule === 'publish-at-once' ? 'publish-at-once' : 'review',
    siteOrigins: (doc.siteOrigins ?? []).map((row) => row.origin),
  }
}

/** The slug, name and website addresses of every project, in name order. */
export async function allProjects(context: {
  payload: Payload
  req?: PayloadRequest
}): Promise<{ id: number | string; slug: string; label: string; siteOrigins: string[] }[]> {
  const { docs } = await context.payload.find({
    collection: 'projects',
    sort: 'name',
    pagination: false,
    depth: 0,
    select: { slug: true, name: true, siteOrigins: true },
    req: context.req,
  })
  return docs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    label: doc.name,
    siteOrigins: (doc.siteOrigins ?? []).map((row) => row.origin),
  }))
}

/**
 * Make a project for one site (step 2 of "Put a recording on a site", with no project
 * yet). The slug comes from the name; the other settings keep their defaults. Gives the
 * project, or the field that is wrong with a text for the operator.
 */
export async function create(
  context: ProjectsContext,
  input: { name: string; website: string },
): Promise<Project | { error: 'name' | 'website'; message: string }> {
  const name = input.name.trim()
  if (!name) return { error: 'name', message: 'Type a name.' }
  const origin = originOf(input.website.trim())
  if (!origin) {
    return {
      error: 'website',
      message: 'Type the website address, for example https://www.example.org.',
    }
  }
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  let slug = base
  for (let n = 2; await bySlug(context, slug); n++) slug = `${base}-${n}`
  await context.payload.create({
    collection: 'projects',
    data: { name, slug, siteOrigins: [{ origin }] },
    depth: 0,
    req: context.req,
  })
  return (await bySlug(context, slug))!
}

/** The slug and name of a project by its document id, or null. */
export async function byId(
  context: { payload: Payload; req?: PayloadRequest },
  id: number | string,
): Promise<{ id: number | string; slug: string; label: string } | null> {
  const doc = await context.payload.findByID({
    collection: 'projects',
    id,
    depth: 0,
    disableErrors: true,
    req: context.req,
  })
  return doc ? { id: doc.id, slug: doc.slug, label: doc.name } : null
}

/**
 * The URL to send a member back to after the Annotate page, or null.
 * The URL must be http or https and its origin must be in `siteOrigins`. The fragment
 * is removed. Never redirect to a URL that this function did not give (open-redirect rule).
 */
export function returnTarget(
  project: Pick<Project, 'siteOrigins'>,
  value: string | null | undefined,
): string | null {
  if (!value || !URL.canParse(value)) return null
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (!project.siteOrigins.includes(url.origin)) return null
  url.hash = ''
  return url.href
}

/** The origin of a URL, or null if it is not an http or https URL. */
function originOf(value: string): string | null {
  if (!URL.canParse(value)) return null
  const url = new URL(value)
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
}
