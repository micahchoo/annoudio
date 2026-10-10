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

export {
  DARK_SET,
  THEME_TOKENS,
  handleTheme,
  theme,
  type ThemeContext,
  type ThemeField,
  type ThemeJson,
} from './theme'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * How members of the project sign in (design/invite-codes.md): a login code by mail, an
 * invite code from the operator, or both.
 */
export type SignInMode = 'email-code' | 'invite-code' | 'both'

const SIGN_IN_MODES: readonly SignInMode[] = ['email-code', 'invite-code', 'both']

/** The stored value of a project, read as a mode. Rows from before the field: `email-code`. */
const signInModeOf = (value: unknown): SignInMode =>
  SIGN_IN_MODES.includes(value as SignInMode) ? (value as SignInMode) : 'email-code'

/** `review`: an operator publishes each story. `publish-at-once`: `saveDraft` publishes. */
export type ReviewRule = 'review' | 'publish-at-once'

/**
 * The rights statements an operator can choose. `other` keeps the typed line and IRI. Each
 * line is one full sentence: the widget and the Annotate page show it with no prefix
 * (design/concept-map.md W5). Migration `rework` rewrites the stored lines of old rows.
 */
export const RIGHTS = {
  'cc-by-4.0': {
    line: 'Stories on this page are shared under CC BY 4.0.',
    iri: 'https://creativecommons.org/licenses/by/4.0/',
  },
  'cc-by-nc-4.0': {
    line: 'Stories on this page are shared under CC BY-NC 4.0.',
    iri: 'https://creativecommons.org/licenses/by-nc/4.0/',
  },
  'all-rights-reserved': {
    line: 'All rights to the stories on this page are reserved.',
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
  /**
   * True when the stack can send mail (SMTP_URL, or the test mailbox). A new project then
   * gets `email-code`, else `invite-code`. Default true.
   */
  canMail?: boolean
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
        'A project holds the rules for the stories of one site: the lists, the look of the widget, the review rule and the rights line. Open a project to change it.',
      hideAPIURL: true,
      components: {
        beforeListTable: ['/admin/ListEmpty#ProjectsEmpty'],
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
              {
                name: 'name',
                label: 'Name',
                type: 'text',
                required: true,
                admin: {
                  description:
                    'The name that members see at the top of the Annotate page and in mails.',
                  placeholder: 'River Voices',
                  // The list link opens the Overview tab (workflow-audit 4).
                  components: { Cell: '/admin/projects/NameCell#NameCell' },
                },
              },
              {
                // The slug is part of every story IRI. Do not change it after the first story.
                name: 'slug',
                label: 'Address name',
                type: 'text',
                required: true,
                unique: true,
                index: true,
                admin: {
                  description:
                    'Part of the snippet and of every story address. Use lowercase letters, digits and hyphens. Do not change it after the first story.',
                  placeholder: 'river-voices',
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
                    'The sites that show the widgets of this project. After a story, the Annotate page sends members back only to these sites.',
                  // One line per website, its address as the label (recordings audit, 19).
                  initCollapsed: true,
                  components: { RowLabel: '/admin/projects/WebsiteLabel#WebsiteLabel' },
                },
                fields: [
                  {
                    name: 'origin',
                    label: 'Website address',
                    type: 'text',
                    required: true,
                    admin: {
                      description: 'The scheme and the host only, with no path.',
                      placeholder: 'https://www.rivervoices.example.org',
                    },
                    validate: (value: unknown) =>
                      (typeof value === 'string' && originOf(value) === value) ||
                      'Use a scheme and a host only, for example https://www.example.org.',
                  },
                ],
              },
              {
                // The widgets of this project: the recordings that an operator put on a site
                // of it ("Add a widget to a site", step 2, or "Add to a project" on a
                // recording). The instances stay derived from the stories; this list shows
                // a widget before its first story (design/rework-notes.md, decision 1).
                name: 'recordings',
                label: 'Recordings with a widget',
                type: 'relationship',
                relationTo: 'recordings',
                hasMany: true,
                admin: {
                  description:
                    'The recordings that you put on a site of this project. "Add a widget" adds one here. Stories can come for other recordings too.',
                },
              },
              {
                // The default language tag of text bodies, for example `ml`.
                name: 'language',
                label: 'Language of the stories',
                type: 'text',
                admin: {
                  description:
                    'A language tag. The widget uses it to show the text of the stories correctly. Choose one, or type a different tag.',
                  placeholder: 'ml',
                  components: { Field: '/admin/ui/LanguageField#LanguageField' },
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
                  {
                    label: 'An operator reads each story before visitors see it',
                    value: 'review',
                  },
                  { label: 'Visitors see each story at once', value: 'publish-at-once' },
                ],
                admin: {
                  description:
                    'Who decides when visitors see a new story. With "Visitors see each story at once", a story with a voice note, photo or video becomes public by itself when its file is ready.',
                  components: { Field: '/admin/ui/SelectField#SelectField' },
                },
              },
              {
                name: 'rights',
                label: 'Rights line',
                type: 'select',
                options: [
                  { label: 'CC BY 4.0', value: 'cc-by-4.0' },
                  { label: 'CC BY-NC 4.0', value: 'cc-by-nc-4.0' },
                  { label: 'All rights reserved', value: 'all-rights-reserved' },
                  { label: 'Other: write the sentence below', value: 'other' },
                ],
                admin: {
                  description:
                    'The licence of the stories. The widget and the Annotate page show it under the stories as one sentence.',
                  components: { Field: '/admin/ui/SelectField#SelectField' },
                },
              },
              {
                // Text for the Annotate form.
                name: 'rightsLine',
                label: 'Rights line text',
                type: 'text',
                admin: {
                  condition: typedRights,
                  description: 'Write the full sentence that visitors read.',
                  placeholder: 'Stories on this page: © 2026 Kochi Heritage Trust.',
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
                    'Optional. The web address of the licence. Each story keeps it in its data.',
                  placeholder: 'https://creativecommons.org/licenses/by-sa/4.0/',
                },
              },
            ],
          },
          {
            label: 'Sign-in',
            fields: [
              {
                // Empty in rows made before the field existed: the same as `email-code`.
                name: 'signIn',
                label: 'How members sign in',
                type: 'radio',
                // A function: the column then has no database default, so the schema
                // and the migrations do not depend on the stack that made them.
                defaultValue: () => (deps.canMail === false ? 'invite-code' : 'email-code'),
                options: [
                  { label: 'With a login code by email', value: 'email-code' },
                  { label: 'With an invite code that you give them', value: 'invite-code' },
                  { label: 'Both: a login code or an invite code', value: 'both' },
                ],
                admin: {
                  description:
                    'A login code needs a mail server. An invite code does not: you give the codes to members, for example on paper at a workshop.',
                  components: { Field: '/admin/ui/SelectField#SelectField' },
                },
              },
              {
                name: 'invites',
                type: 'ui',
                admin: { components: { Field: '/admin/projects/InvitePanel#InvitePanel' } },
              },
            ],
          },
          {
            // The questions of the project (design/vocab.md §8, O10v).
            label: 'Vocabulary',
            fields: [
              {
                name: 'vocabulary',
                type: 'ui',
                admin: { components: { Field: '/admin/vocabulary/FieldList#VocabularyTab' } },
              },
            ],
          },
          {
            // The lists that questions take their choices from (O10l).
            label: 'Lists',
            fields: [
              {
                name: 'lists',
                type: 'ui',
                admin: { components: { Field: '/admin/vocabulary/ListsPanel#ListsTab' } },
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
  /** How members sign in on the Annotate page of this project. */
  signIn: SignInMode
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
    signIn: signInModeOf(doc.signIn),
    siteOrigins: (doc.siteOrigins ?? []).map((row) => row.origin),
  }
}

/** One project as lists show it: slug, name, websites and the recordings with a widget. */
export interface ProjectSummary {
  id: number | string
  slug: string
  label: string
  siteOrigins: string[]
  /** The recording ids of its widgets, in the order they were added. */
  recordings: string[]
}

const idsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(typeof item === 'object' && item ? (item as { id: unknown }).id : item))
    : []

/** The slug, name, website addresses and widgets of every project, in name order. */
export async function allProjects(context: {
  payload: Payload
  req?: PayloadRequest
}): Promise<ProjectSummary[]> {
  const { docs } = await context.payload.find({
    collection: 'projects',
    sort: 'name',
    pagination: false,
    depth: 0,
    select: { slug: true, name: true, siteOrigins: true, recordings: true },
    req: context.req,
  })
  return docs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    label: doc.name,
    siteOrigins: (doc.siteOrigins ?? []).map((row) => row.origin),
    recordings: idsOf(doc.recordings),
  }))
}

/** The projects with a widget for this recording, in name order. */
export async function projectsOfRecording(
  context: { payload: Payload; req?: PayloadRequest },
  recordingId: string,
): Promise<ProjectSummary[]> {
  return (await allProjects(context)).filter((p) => p.recordings.includes(recordingId))
}

/**
 * Add a recording to the widgets of a project. True when the project has it after the
 * call (a second call changes nothing); false for an unknown project or recording.
 */
export async function addRecording(
  context: ProjectsContext,
  slug: string,
  recordingId: string,
): Promise<boolean> {
  const project = (await allProjects(context)).find((p) => p.slug === slug)
  if (!project || !/^[1-9][0-9]*$/.test(recordingId)) return false
  if (project.recordings.includes(recordingId)) return true
  const found = await context.payload.findByID({
    collection: 'recordings',
    id: recordingId,
    depth: 0,
    disableErrors: true,
    req: context.req,
  })
  if (!found) return false
  await context.payload.update({
    collection: 'projects',
    id: project.id,
    data: { recordings: [...project.recordings, recordingId].map(Number) },
    depth: 0,
    req: context.req,
  })
  return true
}

/**
 * Add the website of a page to the list of a project ("Add this website" on the review
 * screen, workflow-audit 7). Gives the origin that the list has after the call.
 */
export async function addSiteOrigin(
  context: ProjectsContext,
  slug: string,
  page: string,
): Promise<{ ok: true; origin: string } | { ok: false }> {
  const origin = originOf(page)
  const project = origin ? await bySlug(context, slug) : null
  if (!origin || !project) return { ok: false }
  if (!project.siteOrigins.includes(origin)) {
    await context.payload.update({
      collection: 'projects',
      id: project.id,
      data: { siteOrigins: [...project.siteOrigins, origin].map((o) => ({ origin: o })) },
      depth: 0,
      req: context.req,
    })
  }
  return { ok: true, origin }
}

/**
 * Make a project for one site (step 2 of "Add a widget to a site", with no project
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

/** The admin preview page of a widget: the one page of the stack that a `return` can name. */
const PREVIEW_PATH = '/admin/preview/'

/**
 * A web page as `return` gives it: an absolute http or https URL with no user name or
 * password, without its fragment. Null for anything else. Not a check of the website list.
 */
export function pageOf(value: string | null | undefined): string | null {
  if (!value || !URL.canParse(value)) return null
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  url.hash = ''
  return url.href
}

/**
 * The URL to send a member back to after the Annotate page, or null.
 * The URL must be http or https and its origin must be in `siteOrigins`, or, with `self`
 * (the origin of this stack), it is the admin preview page of a widget. The fragment is
 * removed. Never redirect to a URL that this function did not give (open-redirect rule).
 */
export function returnTarget(
  project: Pick<Project, 'siteOrigins'>,
  value: string | null | undefined,
  options: { self?: string } = {},
): string | null {
  const page = pageOf(value)
  if (!page) return null
  const url = new URL(page)
  if (project.siteOrigins.includes(url.origin)) return page
  const preview = options.self && url.origin === options.self && url.pathname.startsWith(PREVIEW_PATH)
  return preview ? page : null
}

/** The origin of a URL, or null if it is not an http or https URL. */
function originOf(value: string): string | null {
  if (!URL.canParse(value)) return null
  const url = new URL(value)
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
}
