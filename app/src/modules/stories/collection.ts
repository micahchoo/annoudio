import {
  APIError,
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type CollectionConfig,
  type FieldHook,
  type Payload,
  type PayloadRequest,
  type RequestContext,
  type Where,
} from 'payload'

import { recording as findRecording } from '@/modules/catalogue'
import { body as mediaBody, mediaIdOf, type MediaBody, type MediaContext } from '@/modules/media'
import { bySlug } from '@/modules/projects'

import { lifecycle } from './lifecycle'
import { REPRESENTATIONS, STORIES, rebuild, type Settings } from './rebuild'
import type { Rejection } from './types'
import { excerptOf, mediaUrls, parseStory, withMediaFormats, type ParsedStory } from './shape'

/** The `data.code` of the APIError that a publish with a media body not ready throws. */
export const MEDIA_NOT_READY = 'media-not-ready'

// The hooks need the settings of a `Stories` instance. Calls through `createStories`
// put their settings in the Payload `context`. The admin GUI has no such context:
// it uses the settings of the first instance in the process, the one that
// `payload.config.ts` makes.
const CONTEXT_KEY = 'annoudio.stories'
let appSettings: Settings | undefined

export function register(settings: Settings): RequestContext {
  appSettings ??= settings
  return { [CONTEXT_KEY]: settings }
}

/** Who changes a story, and how. `stories` puts it in the context of each of its writes. */
export interface Change {
  action: 'saved' | 'returned' | 'returned-automatically'
  /** "member", "system", or the operator: the name, else the email. */
  by: string
}
const CHANGE_KEY = 'annoudio.change'

/** The context of one write by `stories`: its settings and the change. */
export function changeContext(context: RequestContext, change: Change): RequestContext {
  return { ...context, [CHANGE_KEY]: change }
}

function settingsOf(context: RequestContext): Settings {
  const settings = (context[CONTEXT_KEY] as Settings | undefined) ?? appSettings
  if (!settings) throw new Error('Call createStories before the first change to a story.')
  return settings
}

// The stored WADM record is the source of truth. This hook derives the indexed
// columns from it, so no caller writes them, and it refuses a record that
// moves a story to another instance or member (invariant 2).
const deriveColumns: CollectionBeforeValidateHook = (args) => {
  const { data, context, operation, req } = args
  if (!data || data.wadm === undefined) return data
  // On create, Payload gives an empty `originalDoc`.
  const originalDoc = operation === 'update' ? args.originalDoc : undefined
  const story = parseStory(data.wadm, settingsOf(context).origin)
  const refuse = (message: string) =>
    new ValidationError({ collection: STORIES, errors: [{ path: 'wadm', message }], req })
  if (!story || story.id !== (originalDoc?.id ?? data.id)) {
    throw refuse('The record is not a story of this origin with this id.')
  }
  const before = originalDoc ? parseStory(originalDoc.wadm, settingsOf(context).origin) : null
  if (
    originalDoc &&
    (originalDoc.project !== story.project ||
      originalDoc.recording !== story.recording ||
      originalDoc.member !== story.memberId ||
      before?.replyTo !== story.replyTo)
  ) {
    throw refuse('The instance, the member and the parent story of a story never change.')
  }
  return {
    ...data,
    project: story.project,
    recording: story.recording,
    member: story.memberId,
    nickname: story.annotation.creator.nickname,
    excerpt: excerptOf(story.annotation),
    start: story.start,
    end: story.end,
    wadm: story.annotation,
  }
}

/** A stored `rejection` group as a `Rejection`, or undefined when it is empty. */
export function rejectionOf(value: unknown): Rejection | undefined {
  const group = value as { reason?: unknown; at?: unknown; automatic?: unknown } | null | undefined
  if (typeof group?.at !== 'string' || typeof group.reason !== 'string') return undefined
  return {
    reason: group.reason,
    at: new Date(group.at).toISOString(),
    automatic: group.automatic === true,
  }
}

/** No rejection: the value that clears the `rejection` group. */
export const NO_REJECTION = { reason: null, operator: null, at: null, automatic: false }

// A published story is not returned. The admin Publish button sends the rejection that
// the form holds; this hook clears it for the button and for `publish()` alike.
const clearRejectionOnPublish: CollectionBeforeChangeHook = ({ data }) =>
  data._status === 'published' ? { ...data, rejection: NO_REJECTION } : data

const rebuildAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  context,
}) => {
  if (doc._status === 'published' || previousDoc?._status === 'published') {
    await rebuild(req, settingsOf(context), doc)
  }
  return doc
}

const rebuildAfterDelete: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
  if (doc._status === 'published') await rebuild(req, settingsOf(context), doc)
}

/** The media bodies of a story, each with its state, or null for an unknown URL. */
export async function mediaOf(context: MediaContext, story: ParsedStory) {
  return Promise.all(
    mediaUrls(story.annotation).map(async (url): Promise<[string, MediaBody | null]> => {
      const id = mediaIdOf(context.origin, url)
      return [url, id ? await mediaBody(context, id, story.memberId) : null]
    }),
  )
}

// A publish needs every media body ready (stories invariant; design C §1.4). The admin
// Publish button and `publish()` both come here. The served format is the format of the
// derived file, which the worker measured.
const requireReadyMedia: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  context,
}) => {
  if (data._status !== 'published') return data
  const origin = settingsOf(context).origin
  const story = parseStory(data.wadm ?? originalDoc?.wadm, origin)
  if (!story) return data
  const media = await mediaOf({ payload: req.payload, origin, req }, story)
  if (media.length === 0) return data
  if (media.some(([, body]) => body?.state === 'uploaded')) {
    throw new APIError(
      'This story has a voice note, photo or video that is still processing. Wait some minutes, then publish again.',
      400,
      { code: MEDIA_NOT_READY },
      true,
    )
  }
  if (media.some(([, body]) => !body?.ready)) {
    throw new APIError(
      'This story has a voice note, photo or video that cannot play: the processing failed or the file was deleted. Ask the member to attach the file again.',
      400,
      { code: MEDIA_NOT_READY },
      true,
    )
  }
  const formats = new Map(media.map(([url, body]) => [url, body!.format]))
  return { ...data, wadm: withMediaFormats(story.annotation, (url) => formats.get(url)!) }
}

// Each version records its change for History (O6): the action and who made it. A
// publish is a publish, by any path. The admin GUI writes only publishes; its operator is
// `req.user`. The hook also keeps `processing`: a media body of this version is not ready.
const recordChange: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  const change = context[CHANGE_KEY] as Change | undefined
  const user = req.user?.collection === 'users' ? req.user : null
  const operator = user
    ? (typeof user.name === 'string' && user.name.trim()) || user.email
    : undefined
  const origin = settingsOf(context).origin
  const story = parseStory(data.wadm ?? originalDoc?.wadm, origin)
  const media = story ? await mediaOf({ payload: req.payload, origin, req }, story) : []
  return {
    ...data,
    lastAction: data._status === 'published' ? 'published' : (change?.action ?? 'saved'),
    changedBy: change?.by ?? operator ?? 'member',
    processing: media.some(([, body]) => body?.state === 'uploaded'),
  }
}

/** The excerpt and the nickname of the story that a reply answers, or {} when it is gone. */
export async function parentOf(
  payload: Payload,
  origin: string,
  id: string,
  req?: PayloadRequest,
): Promise<{ excerpt?: string; nickname?: string }> {
  const main = await payload.findByID({
    collection: STORIES,
    id,
    draft: false,
    depth: 0,
    disableErrors: true,
    req,
  })
  const parent = main ? parseStory(main.wadm, origin) : null
  return parent
    ? { excerpt: excerptOf(parent.annotation), nickname: parent.annotation.creator.nickname }
    : {}
}

/** `ready`, `processing` or `failed`: the worst state of the media bodies. */
export function mediaStateOf(bodies: (MediaBody | null)[]): 'ready' | 'processing' | 'failed' {
  const states = bodies.map((body) => body?.state ?? 'failed')
  if (states.includes('failed')) return 'failed'
  if (states.includes('uploaded')) return 'processing'
  return 'ready'
}

// The admin list columns below are computed only when an operator reads. The module's
// own reads (rebuild, `ownDrafts`, export) make no extra lookups.
const forOperator =
  (compute: FieldHook): FieldHook =>
  (args) =>
    args.req.user?.collection === 'users' ? compute(args) : null

const mediaColumn = forOperator(async ({ data, req, context }) => {
  const origin = settingsOf(context).origin
  const story = parseStory(data?.wadm, origin)
  if (!story) return null
  const media = await mediaOf({ payload: req.payload, origin, req }, story)
  return media.length === 0 ? null : mediaStateOf(media.map(([, body]) => body))
})

const projectName = forOperator(async ({ data, req, context }) => {
  if (typeof data?.project !== 'string') return null
  const site = { payload: req.payload, origin: settingsOf(context).origin, req }
  return (await bySlug(site, data.project))?.label ?? data.project
})

const recordingTitle = forOperator(async ({ data, req, context }) => {
  if (typeof data?.recording !== 'string') return null
  const site = { payload: req.payload, origin: settingsOf(context).origin, req }
  return (await findRecording(site, data.recording))?.title ?? data.recording
})

// The lifecycle of the row (design/ia.md §2.1), from the same data as `counts`: the stored
// `processing` and `rejection`, and whether a published version exists under a draft.
// The read of the published version must not run this hook again (`MAIN_READ`).
const MAIN_READ = 'annoudio.mainRead'
const lifecycleColumn = forOperator(async ({ data, req, context }) => {
  if (!data?.id || context[MAIN_READ]) return null
  const draft = data._status !== 'published'
  const main = draft
    ? await req.payload.findByID({
        collection: STORIES,
        id: data.id,
        draft: false,
        depth: 0,
        disableErrors: true,
        select: { _status: true },
        context: { ...context, [MAIN_READ]: true },
        req,
      })
    : null
  const rejection = rejectionOf(data.rejection)
  return lifecycle({
    reviewState: draft ? 'draft' : 'published',
    pendingRevision: main?._status === 'published',
    ...(rejection ? { rejection } : {}),
    ...(data.processing ? { mediaState: 'processing' as const } : {}),
  })
})

const replyToColumn = forOperator(async ({ data, req, context }) => {
  const origin = settingsOf(context).origin
  const story = parseStory(data?.wadm, origin)
  if (!story || story.replyTo === null) return null
  const parent = await parentOf(req.payload, origin, story.replyTo, req)
  return parent.excerpt ?? ''
})

/** The review queue: the newest version is a draft, nobody returned it, and its media is ready. */
export const WAITING: Where = {
  and: [
    { _status: { equals: 'draft' } },
    { 'rejection.at': { exists: false } },
    { processing: { not_equals: true } },
  ],
}

/** True when the list address has a filter. Payload parses `?where[…]` into an object. */
function hasFilter(where: unknown): boolean {
  return typeof where === 'object' && where !== null && Object.keys(where).length > 0
}

const LAST_ACTIONS = ['saved', 'published', 'returned', 'returned-automatically']

// Data that the story panel shows in plain words. The edit form does not show the field.
const inPanel = { readOnly: true, condition: () => false }
const nobody = () => false

/** The Payload collection of stories. Nothing outside `stories` queries it. */
export const storiesCollection: CollectionConfig = {
  slug: STORIES,
  // The plural is the job name: the list is "Review stories" (design/ia.md §4.1).
  labels: { singular: 'Story', plural: 'Review stories' },
  admin: {
    // The sidebar link Review stories comes from `admin/NavLinks.tsx`.
    group: false,
    useAsTitle: 'excerpt',
    description:
      'Stories and replies that members tell on the Annotate page. Read each one, then publish it or return it to the member.',
    defaultColumns: [
      'excerpt',
      'lifecycle',
      'replyTo',
      'nickname',
      'recordingTitle',
      'projectName',
      'start',
      'mediaState',
      'createdAt',
    ],
    // The search box of the list: the start of the story and the member name.
    listSearchableFields: ['excerpt', 'nickname'],
    // With no filter in the address, the list is the review queue. ReviewTabs says so.
    baseFilter: ({ req }) => (hasFilter(req.query?.where) ? null : WAITING),
    hideAPIURL: true,
    components: {
      beforeListTable: ['/admin/stories/ReviewTabs#ReviewTabs'],
      // The review screen (O5): every control acts through `stories` (admin/stories/).
      edit: {
        Status: '/admin/stories/Controls#Status',
        beforeDocumentControls: ['/admin/stories/Controls#ReturnControl'],
        SaveDraftButton: '/admin/stories/Controls#NextStoryControl',
        PublishButton: '/admin/stories/Controls#PublishControl',
        UnpublishButton: '/admin/stories/Controls#NoUnpublish',
      },
      // Tabs: Story · History (O6). History lists the versions in plain lines.
      views: {
        edit: {
          default: { tab: { Component: '/admin/DocTabs#StoryTab' } },
          versions: {
            Component: '/admin/stories/History#History',
            tab: { Component: '/admin/DocTabs#HistoryTab' },
          },
        },
      },
    },
  },
  // Oldest first: the story that waits longest is at the top.
  defaultSort: 'createdAt',
  disableDuplicate: true,
  // Members write stories on the Annotate page. The local API of `stories` bypasses this.
  // `stories.remove` deletes (with the replies, the media and M5); Payload's delete does not.
  access: { create: nobody, delete: nobody },
  versions: {
    drafts: true,
  },
  indexes: [{ fields: ['project', 'recording'] }],
  fields: [
    {
      name: 'story',
      type: 'ui',
      admin: { components: { Field: '/admin/stories/StoryPanel#StoryPanel' } },
    },
    // UUIDv7, made by the Annotate page.
    { name: 'id', type: 'text', required: true, admin: { ...inPanel, disableListColumn: true } },
    // The columns below come from `wadm`. The hook writes them.
    {
      name: 'project',
      label: 'Project (short name)',
      type: 'text',
      index: true,
      admin: { ...inPanel, disableListColumn: true },
    },
    {
      name: 'recording',
      label: 'Recording ID',
      type: 'text',
      index: true,
      admin: { ...inPanel, disableListColumn: true },
    },
    {
      name: 'member',
      type: 'text',
      index: true,
      admin: { ...inPanel, disableListColumn: true, disableListFilter: true },
    },
    { name: 'nickname', label: 'Member', type: 'text', admin: inPanel },
    { name: 'excerpt', label: 'Story', type: 'text', admin: inPanel },
    {
      name: 'start',
      label: 'Time range',
      type: 'number',
      admin: {
        ...inPanel,
        disableListFilter: true,
        components: { Cell: '/admin/stories/TimeRangeCell#TimeRangeCell' },
      },
    },
    {
      name: 'end',
      type: 'number',
      admin: { ...inPanel, disableListColumn: true, disableListFilter: true },
    },
    // The WADM JSON-LD record. `jsonb` does not keep its key order. Operators never see it.
    { name: 'wadm', type: 'json', required: true, admin: { hidden: true } },
    {
      // Set by `reject`. A publish and the next save of the member clear it.
      name: 'rejection',
      type: 'group',
      admin: { condition: () => false },
      fields: [
        { name: 'reason', type: 'textarea' },
        // The id of the operator who returned the story. Empty for a system return.
        { name: 'operator', type: 'text' },
        { name: 'at', type: 'date' },
        // True when the system returned it: a media body failed.
        { name: 'automatic', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      // The checked `return` URL of the last save that had one: the host page where the
      // member told the story. Operators only; never in the WADM record.
      name: 'toldOn',
      type: 'text',
      access: { read: ({ req }) => req.user?.collection === 'users' },
      admin: { condition: () => false },
    },
    // The change that made this version, for History. The hook writes them.
    { name: 'lastAction', type: 'select', options: LAST_ACTIONS, admin: { hidden: true } },
    { name: 'changedBy', type: 'text', admin: { hidden: true } },
    {
      // True while a media body of this version is not ready. The `media.settled` consumer
      // and the hook keep it. The Processing tab of the review list filters on it.
      name: 'processing',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { hidden: true },
    },
    // Not stored: list columns for operators.
    {
      name: 'projectName',
      label: 'Project',
      type: 'text',
      virtual: true,
      admin: { ...inPanel, disableListFilter: true },
      hooks: { afterRead: [projectName] },
    },
    {
      name: 'recordingTitle',
      label: 'Recording',
      type: 'text',
      virtual: true,
      admin: { ...inPanel, disableListFilter: true },
      hooks: { afterRead: [recordingTitle] },
    },
    {
      // A reply: the excerpt of the story that it answers. Empty for a story.
      name: 'replyTo',
      label: 'Reply to',
      type: 'text',
      virtual: true,
      admin: {
        ...inPanel,
        disableListFilter: true,
        components: { Cell: '/admin/stories/ReplyToCell#ReplyToCell' },
      },
      hooks: { afterRead: [replyToColumn] },
    },
    {
      // A `Lifecycle` (stories/types.ts) for the badge of the list and the review screen.
      name: 'lifecycle',
      label: 'State',
      type: 'json',
      virtual: true,
      admin: {
        ...inPanel,
        disableListFilter: true,
        components: { Cell: '/admin/stories/ReviewBadge#ReviewBadge' },
      },
      hooks: { afterRead: [lifecycleColumn] },
    },
    {
      name: 'mediaState',
      label: 'Media',
      type: 'text',
      virtual: true,
      admin: {
        ...inPanel,
        disableListFilter: true,
        components: { Cell: '/admin/stories/MediaCell#MediaCell' },
      },
      hooks: { afterRead: [mediaColumn] },
    },
  ],
  hooks: {
    beforeValidate: [deriveColumns],
    beforeChange: [requireReadyMedia, clearRejectionOnPublish, recordChange],
    afterChange: [rebuildAfterChange],
    afterDelete: [rebuildAfterDelete],
  },
}

/**
 * The served bytes and the ETag of each representation, one row per
 * (instance, variant, page). Only the rebuild writes it. Hidden from the admin GUI
 * and closed to the REST and GraphQL APIs.
 */
export const storyRepresentationsCollection: CollectionConfig = {
  slug: REPRESENTATIONS,
  admin: { hidden: true },
  graphQL: false,
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  fields: [
    // `{project}/{recording}/{variant}`
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    // `{project}/{recording}`
    { name: 'instance', type: 'text', required: true, index: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'etag', type: 'text', required: true },
  ],
}
