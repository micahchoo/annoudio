import {
  APIError,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type FieldHook,
  type Payload,
  type PayloadRequest,
} from 'payload'

import { bySlug } from '@/modules/projects'
import { removeFirstLine } from '@/plural'
import { publicJson } from '@/publicJson'

// The interface of the `catalogue` module: the organisation-wide list of recordings.
// `recording` is the lookup that `stories` and the Annotate page use. `snippet` gives the
// two lines of CONTRACT.md §1 for one instance.
//
// The duration probe runs in the operator's browser (`/admin/catalogue/DurationField`):
// it loads the audio address in an <audio> element and reads its duration before the
// save. That also checks that the audio plays in a browser (design/phase5-notes.md).
//
// Ordering constraint: add `recordingsCollection(deps)` to `payload.config.ts`.

/** What the catalogue needs from the `stories` module. Given in `payload.config.ts`. */
export interface CatalogueDeps {
  /** Called on first use, so the `stories` instance can be made after the config. */
  stories: () => {
    counts(filter: {
      recording: string
    }): Promise<{ published: { stories: number }; waiting: { stories: number } }>
    forgetInstances(
      of: { recording: RecordingId },
      options: { req: PayloadRequest },
    ): Promise<{ stories: number; replies: number }>
  }
}

/**
 * An audio address must be https. http is allowed for a loopback host only (development
 * and tests). Gives an error text, or true.
 */
export function checkAudioUrl(value: unknown): true | string {
  const hint = 'Use a full https address, for example https://media.example.org/fish-market.m4a.'
  if (typeof value !== 'string' || !URL.canParse(value.trim())) return hint
  const url = new URL(value.trim())
  if (url.username || url.password) return hint
  if (url.protocol === 'https:') return true
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  return url.protocol === 'http:' && loopback ? true : hint
}

const urlField = {
  name: 'url',
  type: 'text' as const,
  required: true,
  validate: (value: unknown) => checkAudioUrl(value),
}

export function recordingsCollection(deps: CatalogueDeps): CollectionConfig {
  // "Stories" column: published stories, and the stories that wait for review in brackets.
  // Replies do not count, as in the player's `total` (design/ia.md §0, 10). Only an
  // operator read computes it.
  const storyCount: FieldHook = async ({ data, req }) => {
    if (req.user?.collection !== 'users' || data?.id === undefined) return null
    const { published, waiting } = await deps.stories().counts({ recording: String(data.id) })
    return waiting.stories > 0
      ? `${published.stories} (${waiting.stories})`
      : String(published.stories)
  }

  // A recording with stories or replies stays: the operator removes them first. A
  // recording with none also takes its served representations away.
  const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
    const { stories, replies } = await deps
      .stories()
      .forgetInstances({ recording: String(id) }, { req })
    if (stories + replies > 0) {
      throw new APIError(
        removeFirstLine('recording', stories, replies),
        400,
        { code: 'recording-has-stories', stories, replies },
        true,
      )
    }
  }

  return {
    slug: 'recordings',
    labels: { singular: 'Recording', plural: 'Recordings' },
    admin: {
      group: 'Settings',
      useAsTitle: 'title',
      defaultColumns: ['title', 'duration', 'stories', 'updatedAt'],
      description:
        'The audio that members tell stories about. Open a recording to copy its snippet for a web page.',
      hideAPIURL: true,
      // "Add a player" adds a recording (admin/addPlayer); the list has no create button.
      components: { beforeListTable: ['/admin/catalogue/RecordingsHeader#RecordingsHeader'] },
    },
    // `register` (the local API) makes recordings; the admin forms only change them.
    access: { create: () => false },
    hooks: { beforeDelete: [guardDelete] },
    fields: [
      {
        name: 'snippet',
        type: 'ui',
        admin: { components: { Field: '/admin/catalogue/SnippetPanel#SnippetPanel' } },
      },
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        ...urlField,
        label: 'Audio address',
        admin: {
          description:
            'The web address of the audio file, for example https://media.example.org/fish-market.m4a.',
        },
      },
      {
        name: 'otherUrls',
        label: 'Other formats',
        labels: { singular: 'Other format', plural: 'Other formats' },
        type: 'array',
        admin: {
          initCollapsed: true,
          description:
            'Optional. The same audio in a different format, for browsers that cannot play the first address.',
        },
        fields: [{ ...urlField, label: 'Audio address' }],
      },
      {
        // Seconds. The admin probe fills it from the audio address.
        name: 'duration',
        label: 'Length',
        type: 'number',
        min: 0,
        admin: {
          components: {
            Field: '/admin/catalogue/DurationField#DurationField',
            Cell: '/admin/ClockCell#ClockCell',
          },
        },
      },
      {
        name: 'stories',
        label: 'Stories',
        type: 'text',
        virtual: true,
        admin: { readOnly: true, condition: () => false, disableListFilter: true },
        hooks: { afterRead: [storyCount] },
      },
    ],
  }
}

/** The recording `id` is the Payload document id, as text. It is stable. */
export type RecordingId = string

export interface Recording {
  iri: string
  id: RecordingId
  title: string
  /** The audio URLs, first one first. At least one. */
  urls: string[]
  duration?: number
}

export interface CatalogueContext {
  payload: Payload
  origin: string
  req?: PayloadRequest
}

/** Find a recording by its id. Returns null if no recording has the id. */
export async function recording(
  context: CatalogueContext,
  id: RecordingId,
): Promise<Recording | null> {
  if (!/^[1-9][0-9]*$/.test(id)) return null
  const doc = await context.payload.findByID({
    collection: 'recordings',
    id: Number(id),
    depth: 0,
    disableErrors: true,
    req: context.req,
  })
  if (!doc) return null
  return {
    iri: `${context.origin}/recordings/${id}`,
    id,
    title: doc.title,
    urls: [doc.url, ...(doc.otherUrls ?? []).map((row) => row.url)],
    ...(typeof doc.duration === 'number' ? { duration: doc.duration } : {}),
  }
}

/** A recording as a list shows it: what a chooser needs. */
export interface RecordingSummary {
  id: RecordingId
  title: string
  url: string
  duration?: number
}

/** The recordings of the catalogue in title order, at most `limit` (default 200). */
export async function list(context: CatalogueContext, limit = 200): Promise<RecordingSummary[]> {
  const { docs } = await context.payload.find({
    collection: 'recordings',
    sort: 'title',
    limit,
    depth: 0,
    select: { title: true, url: true, duration: true },
    req: context.req,
  })
  return docs.map((doc) => ({
    id: String(doc.id),
    title: doc.title,
    url: doc.url,
    ...(typeof doc.duration === 'number' ? { duration: doc.duration } : {}),
  }))
}

/**
 * Add a recording (step 1 of "Put a recording on a site"). `length` comes from the
 * operator's browser, which played the audio (design/phase5-notes.md, decision 1).
 * Gives the recording, or the field that is wrong with a text for the operator.
 */
export async function register(
  context: CatalogueContext,
  input: { title: string; url: string; length?: number | null },
): Promise<Recording | { error: 'title' | 'url'; message: string }> {
  const title = input.title.trim()
  if (!title) return { error: 'title', message: 'Type a title.' }
  const url = input.url.trim()
  const checked = checkAudioUrl(url)
  if (checked !== true) return { error: 'url', message: checked }
  const length = input.length
  const doc = await context.payload.create({
    collection: 'recordings',
    data: {
      title,
      url,
      ...(typeof length === 'number' && Number.isFinite(length) && length > 0
        ? { duration: Number(length.toFixed(3)) }
        : {}),
    },
    depth: 0,
    req: context.req,
  })
  return (await recording(context, String(doc.id)))!
}

/** The first recording of the catalogue (lowest id), or null when it is empty. */
export async function firstRecording(context: CatalogueContext): Promise<Recording | null> {
  const { docs } = await context.payload.find({
    collection: 'recordings',
    sort: 'id',
    limit: 1,
    depth: 0,
    req: context.req,
  })
  return docs[0] ? recording(context, String(docs[0].id)) : null
}

/**
 * The snippet of CONTRACT.md §1 for one instance: the loader line and the element line.
 * `src` is the audio address that the host page plays.
 */
export function snippet(
  origin: string,
  instance: { project: string; recording: RecordingId; src: string },
): string {
  const attr = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  return [
    `<script async src="${attr(`${origin}/embed/v1.js`)}"></script>`,
    `<annoudio-player project="${attr(instance.project)}" recording="${attr(instance.recording)}" src="${attr(instance.src)}"></annoudio-player>`,
  ].join('\n')
}

/** The recording JSON of a project: what a CMS plugin needs to fill `src` from the number. */
export interface RecordingJson {
  id: RecordingId
  title: string
  /** The audio address (the first one). */
  url: string
  /** Seconds, or null when the catalogue does not know it. */
  duration: number | null
}

const RECORDING_FILE = /^([1-9][0-9]*)\.json$/

/**
 * `GET /embed/v1/recordings/{project}/{id}.json` (CONTRACT.md §5.2): public, CORS `*`, the
 * cache rules of the theme route. 404 for an unknown project or recording. Callers: the
 * WordPress block, the Omeka S module, and step 3 of "Put a recording on a site".
 */
export async function handleRecording(
  context: CatalogueContext,
  request: Request,
  project: string,
  file: string,
): Promise<Response> {
  const id = RECORDING_FILE.exec(file)?.[1]
  const [known, found] = await Promise.all([
    bySlug(context, project),
    id ? recording(context, id) : null,
  ])
  const json: RecordingJson | null =
    known && found
      ? { id: found.id, title: found.title, url: found.urls[0], duration: found.duration ?? null }
      : null
  return publicJson(request, json)
}
