import type { Quad } from 'n3'
import type { Payload, PayloadRequest } from 'payload'

import type { ResolvedValue, ValueErrorCode, ValueInput, Vocabulary } from '@/modules/vocabulary'

export type { ResolvedValue, ValueErrorCode, ValueInput }

export type StoryId = string // UUIDv7, made by the Annotate page when it opens
export type ProjectSlug = string
export type RecordingId = string
export type ConceptIri = string
export type MediaId = string // from the `media` module upload

/**
 * A signed-in member. The `membership` module (Phase 3) makes it.
 * `stories` trusts it and does not check the login code again.
 * The member IRI is `{origin}/members/{memberId}`.
 */
export interface MemberSession {
  memberId: string
  nickname: string
}

/** A signed-in operator. The admin makes it from the Payload user. */
export interface OperatorSession {
  operatorId: string
  /** History names the operator ("Published by …"): the name, else the email. */
  name?: string
}

export interface StoriesConfig {
  /** The Payload instance, or a function that gives it on first use. */
  payload: Payload | (() => Promise<Payload>)
  /** ANNOUDIO_ORIGIN. The base of every IRI. Do not change it after the first story. */
  origin: string
  /** Stories per page. Default 100, maximum 500. */
  pageSize?: number
  /** Seconds in Cache-Control max-age. Default 60. */
  maxAge?: number
  /** Default 5 bodies, 30 values, 5000 characters per text body. */
  limits?: { bodies?: number; values?: number; text?: number }
  /**
   * The `vocabulary` instance: `resolve` checks the values of a save, and `item` gives the
   * current label of an item for the served stories.
   */
  vocabulary: Pick<Vocabulary, 'resolve' | 'item'>
  /** Default: the system clock. Tests give a fixed clock. */
  now?: () => Date
  /**
   * Called after each change that a person must hear about, after the commit. The mails
   * hang here (`mail.createNotices`). An error goes to the log; the change stays.
   */
  notify?: (event: StoryEvent) => Promise<void>
}

/** A story or reply as an event names it. */
export interface StoryRef {
  id: StoryId
  project: ProjectSlug
  recording: RecordingId
  memberId: string
  nickname: string
  /** A story has a range. Absent for a reply. */
  start?: number
  end?: number
  /** For a reply: the story that it answers. */
  parent?: { id: StoryId; memberId: string; nickname: string; start: number; end: number }
  /** The first text body. */
  text: string
  /** The host page where the member told it (`DraftInput.toldOn`). */
  toldOn?: string
}

/**
 * A change that a person must hear about (design/ia.md §1, handoffs H4, H6, H7, H9, H10).
 * - `waiting`: a story now waits for an operator: a member sent it for review (H4), or
 *   its media became ready. Not with `publish-at-once`, and not while it is Processing.
 * - `returned`: an operator or the system returned it (`automatic`).
 * - `published`: an operator published it, or the system did when its media was ready.
 *   Not a save that `publish-at-once` published: the member saw that.
 * - `removed`: an operator removed it, with its replies.
 */
export type StoryEvent =
  | { kind: 'waiting'; story: StoryRef }
  | { kind: 'returned'; story: StoryRef; reason: string; automatic: boolean }
  | { kind: 'published'; story: StoryRef }
  | { kind: 'removed'; story: StoryRef; reason: string | null; replies: StoryRef[] }

export type BodyInput =
  | { kind: 'text'; value: string; language?: string } // plain text only, never HTML
  | { kind: 'sound'; media: MediaId }
  | { kind: 'image'; media: MediaId }
  | { kind: 'video'; media: MediaId }

/**
 * A story has a time range: `start` and `end`. A reply has `replyTo` in place of the range:
 * the id of a published story of the same instance. A reply has no values.
 */
export interface DraftInput {
  /** The same id on every save of this story updates it. */
  id: StoryId
  project: ProjectSlug
  recording: RecordingId
  /** Seconds, Normal Play Time. The range is [start, end). Rounded to milliseconds. */
  start?: number
  end?: number
  /** The story that this reply answers. Replies to a reply are refused (`reply-depth`). */
  replyTo?: StoryId
  /** 1 to `limits.bodies`. Values do not count. */
  bodies: BodyInput[]
  /** The answers to the fields of the project (`vocabulary.resolve` checks them). Not on a reply. */
  values?: ValueInput[]
  /** The ETag from the previous save. Omit it on the first save. */
  ifMatch?: string
  /**
   * The `return` URL of the Annotate link: the host page where the member tells the
   * story. Kept as `toldOn` only when its origin is a site of the project
   * (`projects.returnTarget`); a save without a valid one keeps the earlier value. Any other
   * http(s) page is kept for the operator as `toldOnUnlisted`. Operators see both; neither
   * is ever in the WADM record.
   */
  toldOn?: string | null
}

export type SaveError =
  | { code: 'unknown-instance' }
  | { code: 'invalid-range'; field: 'start' | 'end' }
  /** The input has `replyTo` and a time range. */
  | { code: 'reply-and-range' }
  /** The input has `replyTo` and values. */
  | { code: 'reply-and-values' }
  /** `replyTo` is not a published story of this instance. */
  | { code: 'unknown-parent' }
  /** `replyTo` is a reply. A thread has one level. */
  | { code: 'reply-depth' }
  | { code: 'no-body' }
  | { code: 'too-many-bodies' }
  /** `vocabulary.resolve` refused values: one code per field. */
  | { code: 'values-invalid'; errors: { property: string; code: ValueErrorCode }[] }
  | { code: 'text-too-long'; index: number }
  | { code: 'unknown-media'; index: number }
  /** The worker could not use this upload (state `failed`). */
  | { code: 'media-failed'; index: number }
  /** A sound, image or video body needs a text body in the same story. */
  | { code: 'media-needs-text' }
  /** The save moves the story to a different instance, or the reply to a different story. */
  | { code: 'instance-changed' }
  | { code: 'not-owner' }
  | { code: 'stale'; etag: string }

export type SaveResult =
  /** `published` only when the project has the review rule `publish-at-once`. */
  | { ok: true; id: StoryId; iri: string; etag: string; reviewState: 'draft' | 'published' }
  | { ok: false; error: SaveError }

/** One story of the member, with the input that refills the Annotate form. */
export interface OwnDraft {
  id: StoryId
  iri: string
  /** Give it as `ifMatch` on the next save. */
  etag: string
  /** The review state of the newest version. */
  reviewState: 'draft' | 'published'
  /** True when a published version exists and a newer draft waits for review. */
  pendingRevision: boolean
  /** ISO 8601: the last save by the member (the WADM `modified`). */
  modified: string
  /** True when the member changed the story after a return, and nobody published or returned it since. */
  sentAgain?: boolean
  /** A story has `start` and `end`. A reply has `replyTo`. */
  start?: number
  end?: number
  replyTo?: StoryId
  /** Media bodies give their `MediaId`, so a save of the same input keeps them. */
  bodies: BodyInput[]
  /** The stored values, in field order. `vocabulary.inputsOf` turns them into form input. */
  values: ResolvedValue[]
  /** Set when an operator or the system returned this draft to the member. A new save clears it. */
  rejection?: Rejection
  /** The worst state of the media bodies of the newest version. Absent with no media body. */
  mediaState?: MediaState
  /** The host page where the member told the story, if a save had a valid `return`. */
  toldOn?: string
}

/** One story or reply of the member, in any project: a card of Your stories. */
export interface OwnStory extends OwnDraft {
  project: ProjectSlug
  recording: RecordingId
}

/** A published story as the Annotate page shows it above the reply form. */
export interface PublishedStory {
  id: StoryId
  nickname: string
  start: number
  end: number
  texts: { value: string; language?: string }[]
}

/** Why a story went back to the member, and when. */
export interface Rejection {
  reason: string
  /** ISO 8601 */
  at: string
  /** True when the system returned it: a media body failed. False: an operator did. */
  automatic: boolean
}

/** The worst state of the media bodies of one version. */
export type MediaState = 'ready' | 'processing' | 'failed'

/** What `lifecycle` reads. `OwnDraft` and `StoryReview` have this shape. */
export interface LifecycleRow {
  /** The review state of the newest version. */
  reviewState: 'draft' | 'published'
  /** True when a published version exists and a newer draft waits for review. */
  pendingRevision: boolean
  rejection?: { automatic: boolean }
  /** Absent when the newest version has no media body. */
  mediaState?: MediaState
  /** True when the member changed the story after a return, and it was not published or returned since. */
  sentAgain?: boolean
}

/**
 * The UI state of a story or reply (design/ia.md §2.1). `published` with a `change` is
 * "Published · change waiting": visitors see the published version, and the change has
 * its own state. `automatic` is true for a system return (a file failed), in `state` or
 * in `change`.
 */
export interface Lifecycle {
  state: 'processing' | 'waiting' | 'returned' | 'published'
  change: 'processing' | 'waiting' | 'returned' | null
  automatic: boolean
  /** Present when the member sent the story again after a return and it waits (or processes). */
  again?: true
}

/** The story as an operator reviews it. Built from the newest version. */
export interface StoryReview {
  id: StoryId
  reviewState: 'draft' | 'published'
  /** True when a published version exists and a newer draft waits for review. */
  pendingRevision: boolean
  rejection?: Rejection
  /** The worst state of `media`. Absent with no media body. */
  mediaState?: MediaState
  /** True when the member changed the story after a return, and nobody published or returned it since. */
  sentAgain?: boolean
  /** The host page where the member told the story, if a save had a valid `return`. */
  toldOn?: string
  /**
   * The page of the newest `return` that was not on the website list of the project (or
   * the admin preview page), when no save had a listed one since. Operators only: the
   * review screen offers "Add this website" (workflow-audit 7).
   */
  toldOnUnlisted?: string
  member: { id: string; nickname: string }
  /** ISO 8601 */
  created: string
  /** ISO 8601: the last save by the member. */
  modified: string
  /** A story has `start` and `end`. A reply has `replyTo`. */
  start?: number
  end?: number
  /** The story that this reply answers. `excerpt` and `nickname` are absent when it is gone. */
  replyTo?: { id: StoryId; excerpt?: string; nickname?: string }
  /** For a story: its replies in any state. `remove` removes them too. 0 for a reply. */
  replies: number
  texts: { value: string; language?: string }[]
  /** `processing` until the worker is done. */
  media: {
    kind: 'sound' | 'image' | 'video'
    url: string
    state: 'ready' | 'processing' | 'failed'
  }[]
  /** The values, in field order, with the current label of each item. The admin joins the field labels. */
  values: ResolvedValue[]
  project: { slug: ProjectSlug; name?: string }
  recording: { id: RecordingId; title?: string; url?: string }
}

/** One count, split: stories have a time range, replies answer a story. */
export interface Tally {
  stories: number
  replies: number
}

/**
 * Stories and replies by lifecycle state (`lifecycle`). `processing`, `waiting` and
 * `returned` count the newest versions that are drafts, also a change to a published
 * story. `published` counts what visitors see. So a published story with a change
 * waiting counts in `published` and in `waiting`.
 */
export interface StoryCounts {
  processing: Tally
  waiting: Tally
  /** `automatic`: stories and replies that the system returned (a file failed). */
  returned: Tally & { automatic: number }
  published: Tally
  /** ISO 8601: the last save of the version that waits longest. Null when none waits. */
  oldestWaiting: string | null
  /** ISO 8601: the last save by a member. Null when no member saved a story. */
  newest: string | null
  /** The stories and replies with a host page (`toldOn`): a player works on a site. */
  onSites: number
  /** Published stories and replies with a newer draft. `published` counts them too. */
  changes: number
}

/** One version of a story, as History shows it. Newest first. */
export interface HistoryLine {
  /** ISO 8601 */
  at: string
  action: 'saved' | 'published' | 'returned' | 'returned-automatically'
  /** "member", "system", or the operator (name, else email). */
  by: string
  /** The member's name at that version, for "Changed by Asha (member)". */
  nickname: string
  /** The reason of a return. */
  reason?: string
}

/** Where the stories of a project are: for its Overview tab. Drafts count too. */
export interface ProjectReach {
  /** Each recording with stories in the project, most stories first. Replies do not count. */
  recordings: { id: RecordingId; stories: number }[]
  /** Members with a story or a reply in the project. */
  members: number
}

/** What happened since a time: stories that came in, publishes and returns. */
export interface RecentCounts {
  /** New stories and replies. */
  told: number
  published: number
  /** Returns by an operator or by the system. */
  returned: number
}

export interface ExportFilter {
  project?: ProjectSlug
  /** `published`: the published version. `draft`: stories whose newest version is a draft.
   *  `any`: the newest version of every story. Default `published`. */
  reviewState?: 'published' | 'draft' | 'any'
}

/** `publish`, `reject`, `remove` and `exportStories` throw this. Check `name` and `code`. */
export interface StoriesError extends Error {
  name: 'StoriesError'
  /** `media-not-ready`: `publish` found a sound, image or video body that is not ready. */
  code: 'not-found' | 'forbidden' | 'media-not-ready' | 'no-reason'
}

export interface TextualBody {
  type: 'TextualBody'
  value: string
  format: 'text/plain'
  language?: string
}
export interface MediaResource {
  id: string
  type: 'Sound' | 'Image' | 'Video'
  format: string
}
/** The `rdf:object` of a value body (design/vocab.md §3.1). */
export type ValueObject =
  | { id: string }
  | { '@value': string; '@language'?: string }
  | { '@value': string; type: string }
  | { type: string; 'rdfs:label': { '@value': string; '@language'?: string } }

/** One value: a `TextualBody` that is also an `rdf:Statement` (design/vocab.md §3.2). */
export interface ValueBody {
  type: ['TextualBody', 'rdf:Statement']
  purpose: 'tagging' | 'describing'
  value: string
  language?: string
  'rdf:subject': { id: string }
  'rdf:predicate': { id: string }
  'rdf:object': ValueObject
}

// Type aliases, not interfaces: Payload's `json` field needs an implicit index signature.
type AnnotationBase = {
  '@context': 'http://www.w3.org/ns/anno.jsonld'
  id: string
  type: 'Annotation'
  created: string
  modified: string
  creator: { id: string; type: 'Person'; nickname: string }
  rights?: string
  body: (TextualBody | MediaResource | ValueBody)[]
}

/** A story: a time range of a recording, in a project. */
export type StoryAnnotation = AnnotationBase & {
  motivation: 'commenting'
  target: {
    type: 'SpecificResource'
    source: string
    scope: string
    selector: {
      type: 'FragmentSelector'
      conformsTo: 'http://www.w3.org/TR/media-frags/'
      value: string
    }
  }
}

/** A reply: its target is the IRI of the story that it answers. It has no values. */
export type ReplyAnnotation = AnnotationBase & {
  motivation: 'replying'
  target: string
}

/** One story or reply as WADM JSON-LD. The module makes it; no caller builds it. */
export type Annotation = StoryAnnotation | ReplyAnnotation

export interface Stories {
  /**
   * The read side of the Web Annotation Protocol. Mount it on GET, HEAD and OPTIONS
   * of `/stories/*`. Anonymous. Never reads a session. Never returns a draft.
   */
  handleRead(request: Request): Promise<Response>
  /** Create or update the member's draft. Never changes what visitors see. */
  saveDraft(session: MemberSession, input: DraftInput): Promise<SaveResult>
  /** The member's own stories in one instance. The only member read. */
  ownDrafts(
    session: MemberSession,
    instance: { project: ProjectSlug; recording: RecordingId },
  ): Promise<OwnDraft[]>
  /**
   * One published story of the instance, for the Annotate page's reply form. Null for a
   * reply, a draft, or an id of a different instance. Anonymous: visitors see it too.
   */
  publishedStory(
    instance: { project: ProjectSlug; recording: RecordingId },
    id: StoryId,
  ): Promise<PublishedStory | null>
  /** Same effect as the Publish button in the admin GUI. */
  publish(operator: OperatorSession, id: StoryId): Promise<void>
  /**
   * Remove a story for ever, with its replies (design/ia.md §11, 2), and the media bodies
   * that no other story uses. Visitors stop seeing it within `maxAge`. `reason` goes into
   * the mail to the member. Throws `not-found` for an unknown id.
   */
  remove(operator: OperatorSession, id: StoryId, reason?: string): Promise<void>
  /**
   * The next story of the Waiting for review tab, oldest first: the first one after
   * `afterId` (which can have left the tab), else the oldest other one; the oldest when
   * `afterId` is absent or unknown. Null when no other story waits.
   */
  nextWaiting(afterId?: StoryId): Promise<StoryId | null>
  /** All stories and replies of the member, in every project, newest first. */
  ownStories(session: MemberSession): Promise<OwnStory[]>
  /**
   * The `media.settled` consumer calls this after it sets the result of a media body. For
   * each story whose newest version uses the body: a failed body returns the story to its
   * member ("Returned (automatic)"); when all bodies are ready, the project rule
   * `publish-at-once` publishes it, else it waits for review. A second call does nothing.
   */
  mediaSettled(mediaId: MediaId): Promise<void>
  /** All stories that match, in id order, as WADM. Operator only. */
  exportStories(operator: OperatorSession, filter?: ExportFilter): AsyncIterable<Annotation>
  /**
   * The published stories as RDF quads (design/vocab.md §3.4): layer 1, the WADM, in the
   * default graph; layer 2, the asserted statements of each story in the named graph of
   * the story IRI. `filter.reviewState` is ignored: only published stories. Operator only.
   */
  exportQuads(operator: OperatorSession, filter?: ExportFilter): AsyncIterable<Quad>
  /**
   * Return a story to its member with a reason. The story becomes a draft and leaves the
   * review queue; a published story stops being visible. The member sees the reason on
   * the Annotate page. The next save of the member clears it. A blank reason throws
   * `no-reason`.
   */
  reject(operator: OperatorSession, id: StoryId, reason: string): Promise<void>
  /** Every version of one story, newest first, for History. Operator only. */
  history(operator: OperatorSession, id: StoryId): Promise<HistoryLine[]>
  /** The newest version of one story for the review screen, or null. Operator only. */
  review(operator: OperatorSession, id: StoryId): Promise<StoryReview | null>
  /** Stories and replies by lifecycle state: of the stack, of one project or of one recording. */
  /** `member`: the stories and replies of one member (the member page). */
  counts(filter?: { project?: ProjectSlug; recording?: RecordingId; member?: string }): Promise<StoryCounts>
  /**
   * The recordings and members with stories in one project. `leaveOut`: member ids that
   * the member count skips (the test members of `membership.testMembers`).
   */
  projectReach(project: ProjectSlug, options?: { leaveOut?: string[] }): Promise<ProjectReach>
  /** What happened since `since`, for the Today page. */
  recent(since: Date): Promise<RecentCounts>
  /** For each item or entity IRI of the project: the stories whose values point at it. */
  valueCounts(project: ProjectSlug): Promise<Map<string, number>>
  /** For each property IRI: the stories with a value for it. More than 0 locks the field. */
  fieldUsage(project: ProjectSlug): Promise<Map<string, number>>
  /**
   * The `vocabulary` module calls this after a label change or a removal. From a hook,
   * pass its `req`: the rebuild then reads inside the transaction of the change.
   * Without `req`, call it after the commit.
   */
  conceptChanged(iri: ConceptIri, options?: { req?: PayloadRequest }): Promise<void>
  /**
   * The `projects` and `catalogue` modules call this before they delete a project or a
   * recording. Gives its stories and replies, in every review state. When both are 0, it
   * also removes what the read routes serve for its instances, so a read after the delete
   * gives 404. From a hook, pass its `req`: both steps then run in the transaction of the
   * delete.
   */
  forgetInstances(
    of: { project: ProjectSlug } | { recording: RecordingId },
    options?: { req?: PayloadRequest },
  ): Promise<Tally>
}
