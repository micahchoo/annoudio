// The operator reads: one story for the review screen, the counts by review state, and
// the tag counts of a vocabulary. The counts read the tables directly: a story has one
// main row (the published version, or the first draft) and one `latest` version row.

import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { recording as findRecording } from '@/modules/catalogue'
import { bySlug } from '@/modules/projects'

import { mediaOf, mediaStateOf, parentOf, rejectionOf } from './collection'
import { STORIES, labelsOf, type Settings } from './rebuild'
import { itemIrisOf, parseStory, relabel, textsOf, valuesOf } from './shape'
import { lifecycle } from './lifecycle'
import type {
  ProjectReach,
  HistoryLine,
  ProjectSlug,
  RecentCounts,
  RecordingId,
  StoryCounts,
  StoryReview,
} from './types'

const MEDIA_KINDS = { Sound: 'sound', Image: 'image', Video: 'video' } as const

export async function reviewOf(
  payload: Payload,
  settings: Settings,
  id: string,
): Promise<StoryReview | null> {
  const { origin } = settings
  const [latest, main] = await Promise.all(
    [true, false].map((draft) =>
      payload.findByID({ collection: STORIES, id, draft, depth: 0, disableErrors: true }),
    ),
  )
  const story = latest ? parseStory(latest.wadm, origin) : null
  if (!latest || !story) return null
  const site = { payload, origin }
  const drizzle = (payload.db as unknown as PostgresAdapter).drizzle
  const [project, recording, labels, media, parent, replies] = await Promise.all([
    bySlug(site, story.project),
    findRecording(site, story.recording),
    labelsOf(undefined, settings.vocabulary, story.project, itemIrisOf(story.annotation)),
    mediaOf(site, story),
    story.replyTo === null ? null : parentOf(payload, origin, story.replyTo),
    story.replyTo === null
      ? drizzle
          .execute<{ n: string }>(
            sql`select count(*) as n from stories where wadm ->> 'target' = ${story.annotation.id}`,
          )
          .then(({ rows }) => Number(rows[0].n))
      : 0,
  ])
  const reviewState = latest._status === 'published' ? 'published' : 'draft'
  const rejection = rejectionOf(latest.rejection)
  return {
    id: story.id,
    reviewState,
    pendingRevision: reviewState === 'draft' && main?._status === 'published',
    ...(rejection ? { rejection } : {}),
    ...(media.length > 0 ? { mediaState: mediaStateOf(media.map(([, body]) => body)) } : {}),
    ...(latest.sentAgain === true ? { sentAgain: true } : {}),
    ...(typeof latest.toldOn === 'string' && latest.toldOn ? { toldOn: latest.toldOn } : {}),
    ...(typeof latest.toldOnUnlisted === 'string' && latest.toldOnUnlisted
      ? { toldOnUnlisted: latest.toldOnUnlisted }
      : {}),
    member: { id: story.memberId, nickname: story.annotation.creator.nickname },
    created: story.annotation.created,
    modified: story.annotation.modified,
    ...(story.replyTo === null
      ? { start: story.start, end: story.end }
      : { replyTo: { id: story.replyTo, ...parent } }),
    replies,
    texts: textsOf(story.annotation).map(({ value, language }) => ({
      value,
      ...(language ? { language } : {}),
    })),
    media: story.annotation.body.flatMap((body) => {
      if (Array.isArray(body.type) || !('id' in body)) return []
      const found = media.find(([url]) => url === body.id)?.[1] ?? null
      return [{ kind: MEDIA_KINDS[body.type], url: body.id, state: mediaStateOf([found]) }]
    }),
    values: valuesOf(relabel(story.annotation, labels)),
    project: { slug: story.project, ...(project ? { name: project.label } : {}) },
    recording: {
      id: story.recording,
      ...(recording ? { title: recording.title, url: recording.urls[0] } : {}),
    },
  }
}

export async function countsOf(
  payload: Payload,
  origin: string,
  filter: { project?: ProjectSlug; recording?: RecordingId; member?: string },
): Promise<StoryCounts> {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const main = sql.join(
    [
      sql``,
      ...(filter.project === undefined ? [] : [sql`and project = ${filter.project}`]),
      ...(filter.recording === undefined ? [] : [sql`and recording = ${filter.recording}`]),
      ...(filter.member === undefined ? [] : [sql`and member = ${filter.member}`]),
    ],
    sql` `,
  )
  const version = sql.join(
    [
      sql``,
      ...(filter.project === undefined ? [] : [sql`and v.version_project = ${filter.project}`]),
      ...(filter.recording === undefined
        ? []
        : [sql`and v.version_recording = ${filter.recording}`]),
      ...(filter.member === undefined ? [] : [sql`and v.version_member = ${filter.member}`]),
    ],
    sql` `,
  )
  const [published, drafts, totals] = await Promise.all([
    db.execute<{ stories: string; replies: string }>(sql`
      select count(*) filter (where wadm ->> 'motivation' = 'commenting') as stories,
             count(*) filter (where wadm ->> 'motivation' = 'replying') as replies
        from stories where _status = 'published' ${main}`),
    // The newest version of each story whose newest version is a draft. These are few:
    // the stories that wait for an operator or for their member.
    db.execute<{
      wadm: unknown
      rejection: unknown
      processing: boolean | null
      at: string | Date
      published: boolean
    }>(sql`
      select v.version_wadm as wadm,
             json_build_object('reason', v.version_rejection_reason, 'at', v.version_rejection_at,
               'automatic', v.version_rejection_automatic) as rejection,
             v.version_processing as processing,
             v.updated_at as at,
             exists (select 1 from stories s where s.id = v.parent_id and s._status = 'published') as published
        from _stories_v v
        where v.latest and v.version__status = 'draft' ${version}`),
    db.execute<{ newest: string | Date | null; on_sites: string }>(sql`
      select max(v.created_at) filter (where v.version_changed_by = 'member') as newest,
             count(distinct v.parent_id) filter (where v.version_told_on is not null) as on_sites
        from _stories_v v where true ${version}`),
  ])
  const counts: StoryCounts = {
    processing: { stories: 0, replies: 0 },
    waiting: { stories: 0, replies: 0 },
    returned: { stories: 0, replies: 0, automatic: 0 },
    published: {
      stories: Number(published.rows[0].stories),
      replies: Number(published.rows[0].replies),
    },
    oldestWaiting: null,
    newest: totals.rows[0].newest ? new Date(totals.rows[0].newest).toISOString() : null,
    onSites: Number(totals.rows[0].on_sites),
    changes: 0,
  }
  for (const row of drafts.rows) {
    const story = parseStory(row.wadm, origin)
    if (!story) continue
    const rejection = rejectionOf(row.rejection)
    // The stored `processing` column, as the Processing tab of the list reads it.
    const derived = lifecycle({
      reviewState: 'draft',
      pendingRevision: row.published,
      ...(rejection ? { rejection } : {}),
      ...(row.processing ? { mediaState: 'processing' as const } : {}),
    })
    // A draft is always `change` of a published story, or the state itself.
    if (derived.change !== null) counts.changes += 1
    const state = derived.change ?? derived.state
    if (state === 'published') continue
    counts[state][story.replyTo === null ? 'stories' : 'replies'] += 1
    if (state === 'returned' && derived.automatic) counts.returned.automatic += 1
    if (state === 'waiting') {
      const at = new Date(row.at).toISOString()
      if (counts.oldestWaiting === null || at < counts.oldestWaiting) counts.oldestWaiting = at
    }
  }
  return counts
}

export async function recentOf(payload: Payload, since: Date): Promise<RecentCounts> {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const at = since.toISOString()
  const { rows } = await db.execute<{ told: string; published: string; returned: string }>(sql`
    select
      (select count(*) from stories where created_at >= ${at}) as told,
      (select count(distinct parent_id) from _stories_v
         where version_last_action = 'published' and created_at >= ${at}) as published,
      (select count(distinct parent_id) from _stories_v
         where version_last_action in ('returned', 'returned-automatically')
           and created_at >= ${at}) as returned`)
  const row = rows[0]
  return {
    told: Number(row.told),
    published: Number(row.published),
    returned: Number(row.returned),
  }
}

/** Every version of a story, newest first. Versions from before Phase 5c have no action. */
export async function historyOf(
  payload: Payload,
  origin: string,
  id: string,
): Promise<HistoryLine[]> {
  const { docs } = await payload.findVersions({
    collection: STORIES,
    where: { parent: { equals: id } },
    sort: '-createdAt',
    pagination: false,
    depth: 0,
  })
  return docs.map((doc) => {
    const version = doc.version
    const rejection = rejectionOf(version.rejection)
    const action = version.lastAction ?? (version._status === 'published' ? 'published' : 'saved')
    return {
      at: new Date(doc.createdAt).toISOString(),
      action,
      by: version.changedBy ?? 'member',
      nickname: parseStory(version.wadm, origin)?.annotation.creator.nickname ?? '',
      ...(action.startsWith('returned') && rejection ? { reason: rejection.reason } : {}),
    }
  })
}

export async function reachOf(
  payload: Payload,
  project: ProjectSlug,
  leaveOut: string[],
): Promise<ProjectReach> {
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const [recordings, members] = await Promise.all([
    db.execute<{ recording: string; stories: string }>(sql`
      select recording, count(*) as stories from stories
        where project = ${project} and wadm ->> 'motivation' = 'commenting'
        group by recording order by count(*) desc, recording`),
    db.execute<{ members: string }>(
      sql`select count(distinct member) as members from stories
            where project = ${project} and member not in
              (select jsonb_array_elements_text(${JSON.stringify(leaveOut)}::jsonb))`,
    ),
  ])
  return {
    recordings: recordings.rows.map((row) => ({ id: row.recording, stories: Number(row.stories) })),
    members: Number(members.rows[0].members),
  }
}
