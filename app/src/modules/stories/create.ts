import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import {
  APIError,
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
  type Where,
} from 'payload'

import { recording as findRecording } from '@/modules/catalogue'
import { body as mediaBody, mediaIdOf, removeBody, type MediaContext } from '@/modules/media'
import { bySlug, pageOf, returnTarget } from '@/modules/projects'

import {
  MEDIA_NOT_READY,
  NO_REJECTION,
  changeContext,
  mediaOf,
  mediaStateOf,
  register,
  rejectionOf,
  type Change,
} from './collection'
import { etagOf } from './etag'
import { handleRead } from './protocol'
import { countsOf, historyOf, reachOf, recentOf, reviewOf } from './review'
import {
  STORIES,
  forgetInstances,
  labelsOf,
  rebuild,
  type Instance,
  type Settings,
} from './rebuild'
import {
  buildAnnotation,
  parseStory,
  itemIrisOf,
  relabel,
  storyIri,
  textsOf,
  toInput,
  valuesOf,
  type ParsedStory,
  type Place,
  type ResolvedBody,
} from './shape'
import type {
  Annotation,
  BodyInput,
  DraftInput,
  ExportFilter,
  MemberSession,
  OperatorSession,
  OwnDraft,
  OwnStory,
  PublishedStory,
  SaveError,
  SaveResult,
  Stories,
  StoriesConfig,
  StoriesError,
  StoryEvent,
  StoryRef,
} from './types'
import { storyQuads } from './linked'
import { checkDraft } from './validate'
import { fieldUsageOf, valueCountsOf } from './values'

/** The reason of a system return. The member reads it on the Annotate page and in M2. */
const SYSTEM_RETURN = 'We could not use your file. Attach a different file.'

class StoriesFailure extends Error implements StoriesError {
  readonly name = 'StoriesError'
  constructor(readonly code: StoriesError['code']) {
    super(`stories: ${code}`)
  }
}

export function createStories(config: StoriesConfig): Stories {
  const origin = parseOrigin(config.origin)
  const pageSize = config.pageSize ?? 100
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new RangeError('pageSize must be an integer from 1 to 500.')
  }
  const maxAge = config.maxAge ?? 60
  const limits = {
    bodies: config.limits?.bodies ?? 5,
    values: config.limits?.values ?? 30,
    text: config.limits?.text ?? 5000,
  }
  const now = config.now ?? (() => new Date())
  const settings: Settings = { origin, pageSize, vocabulary: config.vocabulary }
  const context = register(settings)

  let pending: Promise<Payload> | undefined
  const payload = () => {
    pending ??= Promise.resolve(
      typeof config.payload === 'function' ? config.payload() : config.payload,
    ).catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }

  /** Tell `notify` about a committed change. A failure there never undoes the change. */
  async function emit(event: StoryEvent): Promise<void> {
    try {
      await config.notify?.(event)
    } catch (error) {
      console.error(`[stories] The notice "${event.kind}" for ${event.story.id} failed.`, error)
    }
  }

  /** The newest version of a story as an event names it, or null. */
  async function refOf(db: Payload, id: string): Promise<StoryRef | null> {
    const latest = await db.findByID({
      collection: STORIES,
      id,
      draft: true,
      depth: 0,
      disableErrors: true,
    })
    const story = latest ? parseStory(latest.wadm, origin) : null
    if (!latest || !story) return null
    const parent = story.replyTo === null ? null : await publishedOf(db, story.replyTo)
    return {
      id: story.id,
      project: story.project,
      recording: story.recording,
      memberId: story.memberId,
      nickname: story.annotation.creator.nickname,
      ...(story.replyTo === null ? { start: story.start, end: story.end } : {}),
      ...(parent && parent.replyTo === null
        ? {
            parent: {
              id: parent.id,
              memberId: parent.memberId,
              nickname: parent.annotation.creator.nickname,
              start: parent.start,
              end: parent.end,
            },
          }
        : {}),
      text: textsOf(story.annotation)[0]?.value ?? '',
      ...(typeof latest.toldOn === 'string' && latest.toldOn ? { toldOn: latest.toldOn } : {}),
    }
  }

  /** Emit an event about the newest version of one story. */
  async function emitAbout(
    db: Payload,
    id: string,
    event: (story: StoryRef) => StoryEvent,
  ): Promise<void> {
    const story = await refOf(db, id)
    if (story) await emit(event(story))
  }

  async function saveDraft(session: MemberSession, input: DraftInput): Promise<SaveResult> {
    const db = await payload()
    const site = { payload: db, origin }
    const fail = (error: SaveError): SaveResult => ({ ok: false, error })
    const iri = storyIri(origin, input.project, input.recording, input.id)
    const ok = (etag: string, reviewState: 'draft' | 'published' = 'draft'): SaveResult => ({
      ok: true,
      id: input.id,
      iri,
      etag,
      reviewState,
    })

    const current = await db.findByID({
      collection: STORIES,
      id: input.id,
      draft: true,
      depth: 0,
      disableErrors: true,
    })
    const before = current ? parseStory(current.wadm, origin) : null
    if (current && before?.memberId !== session.memberId) return fail({ code: 'not-owner' })
    if (
      before &&
      (before.project !== input.project ||
        before.recording !== input.recording ||
        before.replyTo !== (input.replyTo ?? null))
    ) {
      return fail({ code: 'instance-changed' })
    }

    const [project, recording] = await Promise.all([
      bySlug(site, input.project),
      findRecording(site, input.recording),
    ])
    if (!project || !recording) return fail({ code: 'unknown-instance' })
    const invalid = checkDraft(input, recording.duration, limits)
    if (invalid) return fail(invalid)

    let place: Place
    if (input.replyTo !== undefined) {
      const parent = await publishedOf(db, input.replyTo)
      if (!parent || parent.project !== input.project || parent.recording !== input.recording) {
        return fail({ code: 'unknown-parent' })
      }
      // One level: the player shows one thread under each story.
      if (parent.replyTo !== null) return fail({ code: 'reply-depth' })
      place = { parentIri: parent.annotation.id }
    } else {
      place = {
        recordingIri: recording.iri,
        projectIri: project.iri,
        start: input.start!,
        end: input.end!,
      }
    }

    const bodies: ResolvedBody[] = []
    for (const [index, body] of input.bodies.entries()) {
      const resolved = await resolveBody(site, body, session.memberId, project.language)
      if (resolved === 'failed') return fail({ code: 'media-failed', index })
      if (!resolved) return fail({ code: 'unknown-media', index })
      bodies.push(resolved)
    }
    // A reply has no values (checkDraft refused any). The values of hidden fields carry over.
    let values: Awaited<ReturnType<typeof valuesOf>> = []
    if (input.replyTo === undefined) {
      const resolved = await config.vocabulary.resolve(input.project, input.values ?? [], {
        keep: before ? valuesOf(before.annotation) : [],
      })
      if (!resolved.ok) return fail({ code: 'values-invalid', errors: resolved.errors })
      values = resolved.values
    }

    const toldOn = returnTarget(project, input.toldOn)
    // A listed page clears an unlisted one; an unlisted page waits for the operator.
    const unlisted = toldOn ? null : pageOf(input.toldOn)
    const pages = toldOn
      ? { toldOn, toldOnUnlisted: null }
      : unlisted
        ? { toldOnUnlisted: unlisted }
        : {}
    const member = changeContext(context, { action: 'saved', by: 'member' })
    const time = now().toISOString()
    const next = buildAnnotation({
      iri,
      created: before?.annotation.created ?? time,
      modified: time,
      creator: { iri: `${origin}/members/${session.memberId}`, nickname: session.nickname },
      rights: project.rightsIri,
      bodies,
      values,
      place,
    })

    if (before) {
      const etag = draftEtag(before.annotation)
      // A repeated save with the same content makes no new version.
      if (
        sameContent(before.annotation, next) &&
        (!toldOn || toldOn === current?.toldOn) &&
        (!unlisted || unlisted === current?.toldOnUnlisted)
      ) {
        return ok(etag)
      }
      if (input.ifMatch !== etag) return fail({ code: 'stale', etag })
      // A change by the member answers a rejection: the story goes back into the queue,
      // marked "sent again" until an operator publishes or returns it.
      const sentAgain = current?.sentAgain === true || rejectionOf(current?.rejection) !== undefined
      await db.update({
        collection: STORIES,
        id: input.id,
        data: { wadm: next, rejection: NO_REJECTION, sentAgain, ...pages },
        draft: true,
        depth: 0,
        context: member,
      })
    } else {
      await db.create({
        collection: STORIES,
        data: { id: input.id, wadm: next, _status: 'draft', ...pages },
        draft: true,
        depth: 0,
        context: member,
      })
    }
    const system = { action: 'saved', by: 'system' } as const
    if (project.reviewRule !== 'publish-at-once') {
      // A story whose media is Processing waits later: `mediaSettled` tells it.
      const stored = await db.findByID({ collection: STORIES, id: input.id, draft: true, depth: 0 })
      if (!stored.processing) await emitAbout(db, input.id, (story) => ({ kind: 'waiting', story }))
      return ok(draftEtag(next))
    }
    // With `publish-at-once`, nothing waits for an operator. A story whose media is not
    // ready is published by `mediaSettled`.
    if (!(await publishNow(db, input.id, system))) return ok(draftEtag(next))
    // The publish can give media bodies their measured format, so the ETag is of the
    // stored record.
    const stored = await db.findByID({ collection: STORIES, id: input.id, draft: true, depth: 0 })
    return ok(draftEtag(parseStory(stored.wadm, origin)?.annotation ?? next), 'published')
  }

  /**
   * Publish the newest version. The collection hooks check the media bodies and rebuild;
   * a refusal changes nothing. False when a media body is not ready.
   */
  async function publishNow(db: Payload, id: string, by: Change): Promise<boolean> {
    try {
      await db.update({
        collection: STORIES,
        id,
        data: { _status: 'published' },
        depth: 0,
        context: changeContext(context, by),
      })
      return true
    } catch (error) {
      const code = error instanceof APIError ? (error.data as { code?: string } | null)?.code : null
      if (code === MEDIA_NOT_READY) return false
      throw error
    }
  }

  /** The published version of a story or reply, parsed, or null. */
  async function publishedOf(db: Payload, id: string): Promise<ParsedStory | null> {
    const main = await db.findByID({
      collection: STORIES,
      id,
      draft: false,
      depth: 0,
      disableErrors: true,
    })
    return main?._status === 'published' ? parseStory(main.wadm, origin) : null
  }

  async function publishedStory(instance: Instance, id: string): Promise<PublishedStory | null> {
    const story = await publishedOf(await payload(), id)
    if (!story || story.replyTo !== null) return null
    if (story.project !== instance.project || story.recording !== instance.recording) return null
    return {
      id: story.id,
      nickname: story.annotation.creator.nickname,
      start: story.start,
      end: story.end,
      texts: textsOf(story.annotation).map(({ value, language }) => ({
        value,
        ...(language ? { language } : {}),
      })),
    }
  }

  /** The member's stories and replies that match `and`, each with its instance. */
  async function ownOf(session: MemberSession, and: Where[]): Promise<OwnStory[]> {
    const db = await payload()
    const where: Where = { and: [{ member: { equals: session.memberId } }, ...and] }
    const [latest, main] = await Promise.all([
      db.find({ collection: STORIES, where, draft: true, pagination: false, depth: 0 }),
      db.find({ collection: STORIES, where, draft: false, pagination: false, depth: 0 }),
    ])
    const published = new Set(
      main.docs.filter((doc) => doc._status === 'published').map((doc) => doc.id),
    )
    const site = { payload: db, origin }
    const own = await Promise.all(
      latest.docs.map(async (doc) => {
        const story = parseStory(doc.wadm, origin)
        if (!story) return []
        const reviewState = doc._status === 'published' ? 'published' : 'draft'
        const rejection = rejectionOf(doc.rejection)
        const media = await mediaOf(site, story)
        return {
          id: story.id,
          iri: story.annotation.id,
          etag: draftEtag(story.annotation),
          reviewState,
          pendingRevision: reviewState === 'draft' && published.has(story.id),
          modified: story.annotation.modified,
          ...(doc.sentAgain === true ? { sentAgain: true } : {}),
          project: story.project,
          recording: story.recording,
          ...(story.replyTo === null
            ? { start: story.start, end: story.end }
            : { replyTo: story.replyTo }),
          ...toInput(story.annotation, origin),
          ...(rejection ? { rejection } : {}),
          ...(media.length > 0 ? { mediaState: mediaStateOf(media.map(([, body]) => body)) } : {}),
          ...(typeof doc.toldOn === 'string' && doc.toldOn ? { toldOn: doc.toldOn } : {}),
        } satisfies OwnStory
      }),
    )
    return own.flat()
  }

  async function ownDrafts(session: MemberSession, instance: Instance): Promise<OwnDraft[]> {
    const own = await ownOf(session, [
      { project: { equals: instance.project } },
      { recording: { equals: instance.recording } },
    ])
    return own.map(({ project: _p, recording: _r, ...draft }) => draft).sort(ownOrder)
  }

  async function ownStories(session: MemberSession): Promise<OwnStory[]> {
    // Ids are UUIDv7: id order is time order.
    return (await ownOf(session, [])).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
  }

  async function publish(operator: OperatorSession, id: string): Promise<void> {
    requireOperator(operator)
    const db = await payload()
    const latest = await db.findByID({
      collection: STORIES,
      id,
      draft: true,
      depth: 0,
      disableErrors: true,
    })
    if (!latest) throw new StoriesFailure('not-found')
    if (latest._status === 'published') return
    // The admin Publish button makes the same update.
    if (!(await publishNow(db, id, { action: 'saved', by: operatorName(operator) }))) {
      throw new StoriesFailure('media-not-ready')
    }
    await emitAbout(db, id, (story) => ({ kind: 'published', story }))
  }

  async function reject(operator: OperatorSession, id: string, reason: string): Promise<void> {
    requireOperator(operator)
    const text = typeof reason === 'string' ? reason.trim() : ''
    if (!text) throw new StoriesFailure('no-reason')
    const db = await payload()
    const latest = await db.findByID({
      collection: STORIES,
      id,
      draft: true,
      depth: 0,
      disableErrors: true,
    })
    if (!latest) throw new StoriesFailure('not-found')
    const rejection = {
      reason: text,
      operator: operator.operatorId,
      at: now().toISOString(),
      automatic: false,
    }
    const returned = changeContext(context, { action: 'returned', by: operatorName(operator) })
    if (latest._status === 'published') {
      // Visitors see this version: take it down, as Unpublish does.
      await db.update({
        collection: STORIES,
        id,
        data: { _status: 'draft', rejection, sentAgain: false },
        depth: 0,
        context: returned,
      })
    } else {
      // A draft. A published version of the story, if there is one, stays visible.
      await db.update({
        collection: STORIES,
        id,
        data: { rejection, sentAgain: false },
        draft: true,
        depth: 0,
        context: returned,
      })
    }
    await emitAbout(db, id, (story) => ({
      kind: 'returned',
      story,
      reason: text,
      automatic: false,
    }))
  }

  async function history(operator: OperatorSession, id: string) {
    requireOperator(operator)
    return historyOf(await payload(), origin, id)
  }

  async function review(operator: OperatorSession, id: string) {
    requireOperator(operator)
    return reviewOf(await payload(), settings, id)
  }

  async function remove(operator: OperatorSession, id: string, reason?: string): Promise<void> {
    requireOperator(operator)
    const db = await payload()
    const latest = await db.findByID({
      collection: STORIES,
      id,
      draft: true,
      depth: 0,
      disableErrors: true,
    })
    if (!latest) throw new StoriesFailure('not-found')
    const drizzle = (db.db as unknown as PostgresAdapter).drizzle
    const story = parseStory(latest.wadm, origin)
    // The replies of a story: a reply's target is the story IRI, and it never changes.
    const replies =
      story?.replyTo === null
        ? (
            await drizzle.execute<{ id: string }>(
              sql`select id from stories where wadm ->> 'target' = ${story.annotation.id}`,
            )
          ).rows.map((row) => row.id)
        : []
    const ids = [...replies, id]
    // The media bodies of every version of these stories.
    const { rows: bodies } = await drizzle.execute<{ url: string }>(sql`
      select distinct b ->> 'id' as url
        from _stories_v v, jsonb_array_elements(v.version_wadm -> 'body') b
        where v.parent_id in (${sql.join(
          ids.map((one) => sql`${one}`),
          sql`, `,
        )}) and b ->> 'type' in ('Sound', 'Image', 'Video')`)

    const refs = await Promise.all(ids.map((one) => refOf(db, one)))

    const req = await createLocalReq({}, db)
    await initTransaction(req)
    try {
      // The replies first: each delete rebuilds the instance while the story is there.
      for (const one of ids) {
        await db.delete({ collection: STORIES, id: one, depth: 0, req, context })
      }
      await commitTransaction(req)
    } catch (error) {
      await killTransaction(req)
      throw error
    }
    // A take-down takes the files down too, unless another story uses them.
    for (const { url } of bodies) {
      const mediaId = mediaIdOf(origin, url)
      if (!mediaId) continue
      const uses = JSON.stringify([{ id: url }])
      const { rows } = await drizzle.execute(
        sql`select 1 from _stories_v where version_wadm -> 'body' @> ${uses}::jsonb limit 1`,
      )
      if (rows.length === 0) await removeBody({ payload: db, origin }, mediaId)
    }
    const removed = refs.at(-1)
    if (removed) {
      await emit({
        kind: 'removed',
        story: removed,
        reason: reason?.trim() || null,
        replies: refs.slice(0, -1).flatMap((ref) => ref ?? []),
      })
    }
  }

  async function nextWaiting(afterId?: string): Promise<string | null> {
    const db = (await payload()).db as unknown as PostgresAdapter
    // The Waiting for review tab, oldest first (the list sorts by `createdAt`): the first
    // story after `afterId`, else the oldest other one. So Publish and Return both open a
    // waiting story while one is left (recordings audit, 07). An unknown id gives the oldest.
    const { rows } = await db.drizzle.execute<{ id: string }>(sql`
      select s.id from _stories_v v join stories s on s.id = v.parent_id
        where v.latest and v.version__status = 'draft' and v.version_rejection_at is null
          and not coalesce(v.version_processing, false)
          ${afterId === undefined ? sql`` : sql`and s.id <> ${afterId}`}
        order by ${
          afterId === undefined
            ? sql``
            : sql`coalesce((s.created_at, s.id) > (select created_at, id from stories where id = ${afterId}), false) desc,`
        } s.created_at, s.id
        limit 1`)
    return rows[0]?.id ?? null
  }

  async function mediaSettled(mediaId: string): Promise<void> {
    const db = await payload()
    const drizzle = (db.db as unknown as PostgresAdapter).drizzle
    const uses = JSON.stringify([{ id: `${origin}/media/${mediaId}` }])
    const { rows } = await drizzle.execute<{ id: string }>(
      sql`select parent_id as id from _stories_v where latest and version_wadm -> 'body' @> ${uses}::jsonb`,
    )
    const site = { payload: db, origin }
    for (const { id } of rows) {
      const latest = await db.findByID({ collection: STORIES, id, draft: true, depth: 0 })
      const story = parseStory(latest.wadm, origin)
      // A published version has only ready bodies (the publish hook checks it).
      if (!story || latest._status === 'published') continue
      const states = (await mediaOf(site, story)).map(([, body]) => mediaStateOf([body]))
      const returned = rejectionOf(latest.rejection) !== undefined
      if (states.includes('failed')) {
        if (returned) continue
        // A system return (design/ia.md §2.1, rule 3). M2 tells the member.
        await db.update({
          collection: STORIES,
          id,
          data: {
            rejection: {
              reason: SYSTEM_RETURN,
              operator: null,
              at: now().toISOString(),
              automatic: true,
            },
          },
          draft: true,
          depth: 0,
          context: changeContext(context, { action: 'returned-automatically', by: 'system' }),
        })
        await emitAbout(db, id, (ref) => ({
          kind: 'returned',
          story: ref,
          reason: SYSTEM_RETURN,
          automatic: true,
        }))
        continue
      }
      // A second report, or a body that was ready before the save: nothing changes.
      if (states.includes('processing') || !latest.processing) continue
      const project = await bySlug(site, story.project)
      const system = { action: 'saved', by: 'system' } as const
      if (
        !returned &&
        project?.reviewRule === 'publish-at-once' &&
        (await publishNow(db, id, system))
      ) {
        await emitAbout(db, id, (ref) => ({ kind: 'published', story: ref }))
        continue
      }
      // Processing → Waiting for review. A cache column: no new version, so History
      // gets no line for it.
      await drizzle.execute(
        sql`update _stories_v set version_processing = false where latest and parent_id = ${id}`,
      )
      await drizzle.execute(sql`update stories set processing = false where id = ${id}`)
      if (!returned) await emitAbout(db, id, (ref) => ({ kind: 'waiting', story: ref }))
    }
  }

  async function* exportStories(
    operator: OperatorSession,
    filter: ExportFilter = {},
  ): AsyncIterable<Annotation> {
    requireOperator(operator)
    const db = await payload()
    const state = filter.reviewState ?? 'published'
    const and: Where[] = []
    if (filter.project) and.push({ project: { equals: filter.project } })
    if (state !== 'any') and.push({ _status: { equals: state } })
    for (let page = 1; ; page++) {
      const result = await db.find({
        collection: STORIES,
        where: { and },
        draft: state !== 'published',
        sort: 'id',
        limit: 100,
        page,
        depth: 0,
      })
      for (const doc of result.docs) {
        const story = parseStory(doc.wadm, origin)
        if (!story) continue
        const labels = await labelsOf(
          undefined,
          config.vocabulary,
          story.project,
          itemIrisOf(story.annotation),
        )
        yield relabel(story.annotation, labels)
      }
      if (!result.hasNextPage) return
    }
  }

  /** Layers 1 and 2 of the linked data export: published stories only (design/vocab.md §3.4). */
  async function* exportQuads(operator: OperatorSession, filter: ExportFilter = {}) {
    let n = 0
    for await (const annotation of exportStories(operator, {
      ...filter,
      reviewState: 'published',
    })) {
      yield* await storyQuads(annotation, n++)
    }
  }

  async function conceptChanged(
    iri: string,
    options: { req?: PayloadRequest } = {},
  ): Promise<void> {
    const db = await payload()
    const adapter = db.db as unknown as PostgresAdapter
    const uses = JSON.stringify([{ 'rdf:object': { id: iri } }])
    const { rows } = await adapter.drizzle.execute<{ project: string; recording: string }>(
      sql`select distinct project, recording from stories
          where _status = 'published' and wadm -> 'body' @> ${uses}::jsonb`,
    )
    for (const instance of rows) {
      if (options.req) {
        await rebuild(options.req, settings, instance)
        continue
      }
      const req = await createLocalReq({}, db)
      await initTransaction(req)
      try {
        await rebuild(req, settings, instance)
        await commitTransaction(req)
      } catch (error) {
        await killTransaction(req)
        throw error
      }
    }
  }

  return {
    handleRead: (request) => handleRead(request, { payload, origin, pageSize, maxAge }),
    saveDraft,
    ownDrafts,
    publishedStory,
    publish,
    remove,
    nextWaiting,
    ownStories,
    mediaSettled,
    exportStories,
    exportQuads,
    reject,
    history,
    review,
    counts: async (filter = {}) => countsOf(await payload(), origin, filter),
    projectReach: async (project, options) => reachOf(await payload(), project, options?.leaveOut ?? []),
    recent: async (since) => recentOf(await payload(), since),
    valueCounts: async (project) => valueCountsOf(await payload(), project),
    fieldUsage: async (project) => fieldUsageOf(await payload(), project),
    conceptChanged,
    forgetInstances: async (of, options = {}) =>
      forgetInstances(options.req?.payload ?? (await payload()), of, options.req),
  }
}

/** A draft takes a media body that is `uploaded` or `ready`; `publish` needs `ready`. */
async function resolveBody(
  site: MediaContext,
  body: BodyInput,
  memberId: string,
  defaultLanguage: string | undefined,
): Promise<ResolvedBody | 'failed' | null> {
  if (body.kind === 'text') {
    const language = body.language ?? defaultLanguage
    return { kind: 'text', value: body.value, ...(language ? { language } : {}) }
  }
  const media = await mediaBody(site, body.media, memberId)
  if (!media || media.kind !== body.kind) return null
  if (media.state === 'failed') return 'failed'
  return { kind: body.kind, url: media.url, format: media.format }
}

/** Stories in timeline order, then replies. Ids are UUIDv7, so id order is time order. */
function ownOrder(a: OwnDraft, b: OwnDraft): number {
  const byStart = (a.start ?? Infinity) - (b.start ?? Infinity)
  if (byStart !== 0 && !Number.isNaN(byStart)) return byStart
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** The ETag of a draft: the hash of its canonical bytes. */
function draftEtag(annotation: Annotation): string {
  return etagOf(JSON.stringify(annotation))
}

function sameContent(a: Annotation, b: Annotation): boolean {
  return JSON.stringify({ ...a, modified: '' }) === JSON.stringify({ ...b, modified: '' })
}

/** The operator in History: the name or email, else the id. */
function operatorName(operator: OperatorSession): string {
  return operator.name || `operator ${operator.operatorId}`
}

function requireOperator(operator: OperatorSession) {
  if (typeof operator?.operatorId !== 'string' || operator.operatorId === '') {
    throw new StoriesFailure('forbidden')
  }
}

function parseOrigin(value: string): string {
  const url = URL.canParse(value) ? new URL(value) : null
  if (
    !url ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    value.replace(/\/$/, '') !== url.origin
  ) {
    throw new TypeError(`origin must be a scheme, a host and an optional port: ${value}`)
  }
  return url.origin
}
