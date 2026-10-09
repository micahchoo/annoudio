// Rebuild the stored representations of one instance from its published stories.
// It runs in the transaction of the review-state change, so a read after the
// change returns the new bytes (invariant 4).

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { recording as findRecording } from '@/modules/catalogue'
import { bySlug } from '@/modules/projects'
import { concept } from '@/modules/vocabulary'

import { etagOf } from './etag'
import { representations, type InstanceInfo, type ServedReply, type ServedStory } from './paginate'
import { parseStory, relabel, tagsOf, type Label } from './shape'
import type { ConceptIri, ProjectSlug, RecordingId, StoryId, Tally } from './types'

export const STORIES = 'stories'
export const REPRESENTATIONS = 'story-representations'

export interface Settings {
  origin: string
  pageSize: number
}

export interface Instance {
  project: ProjectSlug
  recording: RecordingId
}

export function instanceKey({ project, recording }: Instance): string {
  return `${project}/${recording}`
}

export function containerIri(origin: string, { project, recording }: Instance): string {
  return `${origin}/stories/${project}/${recording}/`
}

/** The container IRI and label, or null if the project or the recording does not exist. */
export async function instanceInfo(
  context: { payload: PayloadRequest['payload']; origin: string; req?: PayloadRequest },
  instance: Instance,
): Promise<InstanceInfo | null> {
  const [project, recording] = await Promise.all([
    bySlug(context, instance.project),
    findRecording(context, instance.recording),
  ])
  if (!project || !recording) return null
  return {
    containerIri: containerIri(context.origin, instance),
    label: `${project.label}: ${recording.title}`,
  }
}

/** The current label of each concept, or null for a concept that no longer exists. */
export async function labelsOf(
  req: PayloadRequest | undefined,
  payload: PayloadRequest['payload'],
  project: ProjectSlug,
  iris: ConceptIri[],
): Promise<Map<ConceptIri, Label | null>> {
  const unique = [...new Set(iris)]
  const found = await Promise.all(unique.map((iri) => concept({ payload, req }, project, iri)))
  return new Map(unique.map((iri, i) => [iri, found[i]]))
}

export async function rebuild(req: PayloadRequest, settings: Settings, instance: Instance) {
  const { payload } = req
  const key = instanceKey(instance)
  await lockInstance(req, key)

  const info = await instanceInfo({ payload, origin: settings.origin, req }, instance)
  const { docs } = await payload.find({
    collection: STORIES,
    where: {
      and: [
        { project: { equals: instance.project } },
        { recording: { equals: instance.recording } },
        { _status: { equals: 'published' } },
      ],
    },
    draft: false,
    pagination: false,
    depth: 0,
    req,
  })
  const parsed = docs.flatMap((doc) => parseStory(doc.wadm, settings.origin) ?? [])
  const labels = await labelsOf(
    req,
    payload,
    instance.project,
    parsed.flatMap((story) => tagsOf(story.annotation)),
  )
  // A reply shows only under its published parent. When the parent is not published, the
  // reply keeps its review state but is served nowhere, also not at its own IRI.
  const replies = new Map<StoryId, ServedReply[]>()
  for (const story of parsed) {
    if (story.replyTo === null) continue
    const reply = { id: story.id, annotation: story.annotation }
    replies.set(story.replyTo, [...(replies.get(story.replyTo) ?? []), reply])
  }
  const published: ServedStory[] = parsed.flatMap((story) =>
    story.replyTo === null
      ? {
          id: story.id,
          start: story.start,
          annotation: relabel(story.annotation, labels),
          replies: replies.get(story.id) ?? [],
        }
      : [],
  )
  const wanted = info ? representations(info, published, settings.pageSize) : new Map()

  const { docs: existing } = await payload.find({
    collection: REPRESENTATIONS,
    where: { instance: { equals: key } },
    pagination: false,
    depth: 0,
    select: { key: true, etag: true },
    req,
  })
  const byKey = new Map(existing.map((row) => [row.key, row]))

  for (const [variant, body] of wanted) {
    const rowKey = `${key}/${variant}`
    const etag = etagOf(body)
    const row = byKey.get(rowKey)
    byKey.delete(rowKey)
    if (row?.etag === etag) continue
    const data = { key: rowKey, instance: key, body, etag }
    if (row) await payload.update({ collection: REPRESENTATIONS, id: row.id, data, req })
    else await payload.create({ collection: REPRESENTATIONS, data, req })
  }
  const stale = [...byKey.values()].map((row) => row.id)
  if (stale.length > 0) {
    await payload.delete({ collection: REPRESENTATIONS, where: { id: { in: stale } }, req })
  }
}

/**
 * Before the delete of a project or a recording: its stories and replies in every review
 * state. With none, remove the representations of its instances (`stories.forgetInstances`).
 */
export async function forgetInstances(
  payload: Payload,
  of: { project: ProjectSlug } | { recording: RecordingId },
  req?: PayloadRequest,
): Promise<Tally> {
  const db = await dbOf(payload, req)
  const story = 'project' in of ? sql`project = ${of.project}` : sql`recording = ${of.recording}`
  const { rows } = await db.execute<{ stories: string; replies: string }>(sql`
    select count(*) filter (where wadm ->> 'motivation' = 'replying') as replies,
           count(*) filter (where wadm ->> 'motivation' is distinct from 'replying') as stories
      from stories where ${story}`)
  const tally = { stories: Number(rows[0].stories), replies: Number(rows[0].replies) }
  if (tally.stories + tally.replies > 0) return tally
  // `instance` is `{project}/{recording}`. A slug has no '/'; a recording id is digits.
  const served =
    'project' in of
      ? sql`split_part(instance, '/', 1) = ${of.project}`
      : sql`split_part(instance, '/', 2) = ${of.recording}`
  await db.execute(sql`delete from story_representations where ${served}`)
  return tally
}

/** The Drizzle handle of the transaction of `req`, else of the pool. */
async function dbOf(payload: Payload, req?: PayloadRequest) {
  const adapter = payload.db as unknown as PostgresAdapter
  const transactionID = req ? await req.transactionID : undefined
  return (transactionID !== undefined && adapter.sessions[transactionID]?.db) || adapter.drizzle
}

/** Two rebuilds of one instance wait for each other until the transaction ends. */
async function lockInstance(req: PayloadRequest, key: string) {
  const db = await dbOf(req.payload, req)
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtext('annoudio.stories'), hashtext(${key}))`,
  )
}
