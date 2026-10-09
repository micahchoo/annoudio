# `stories` interface — design B: flexible

Status: proposal (design B of several). Date: 2026-10-09.
Vocabulary: `CONTEXT.md` and the `codebase-design` skill.

Design constraint: support many use cases and future extensions. Keep every extension behind one coherent interface. No caller sees Payload documents, Payload queries or SQL.

The central idea: **one query shape, one viewer, one write path.**

- Every read is a `StoryQuery` that a `Viewer` asks. The HTTP routes, the Annotate page, the admin and export all use the same query shape. The module applies review-state rules and the project's view policy from the viewer. Callers never filter by review state by hand.
- Every write goes through the collection hooks of the `stories` collection. Writes from the module functions and writes from the Payload admin GUI pass through the same validation and the same instance derivation.
- WADM JSON-LD is a public standard, so the module gives it out (on the HTTP routes, in export, and as `story.annotation`). The module never takes WADM in. Callers write domain inputs (`StoryInput`). The module shapes the WADM.

Spec facts that this design uses (checked on 2026-10-09):

- WADM `scope` is a property of a **SpecificResource**, not of the Annotation. So the project IRI goes in `target.scope`.
- WADM `rights` MUST be an IRI. A project's rights *line* (text for people) is not enough. The project also needs a rights IRI.
- A FragmentSelector `value` has no `#`: `t=42,51`. Media Fragments allows `t=42,51&xywh=percent:10,10,30,30` for a future video region.
- Web Annotation Protocol: container types `["BasicContainer", "AnnotationCollection"]`; properties `total`, `modified`, `label`, `first`, `last`; page type `AnnotationPage` with `partOf`, `startIndex`, `next`, `prev`, `items`. `Prefer` values `ldp#PreferMinimalContainer`, `oa#PreferContainedIRIs`, `oa#PreferContainedDescriptions`. Media type `application/ld+json;profile="http://www.w3.org/ns/anno.jsonld"`. GET and HEAD MUST give `ETag`. Container responses MUST give `Link: <http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"`.
- Payload 3 drafts: `versions.drafts: true` adds `_status` (`draft` | `published`). An update with `draft: true` writes only to the versions table. The main document stays at the published version. The admin GUI shows three states: Draft, Published, Changed.

---

## 1 Interface

The interface is the file `app/src/modules/stories/index.ts`. It has four parts:

1. `storiesCollections` — static configuration for `payload.config.ts`.
2. `createStories(config)` — gives the `Stories` object.
3. `Stories.protocol.handle` — the HTTP seam for the Web Annotation Protocol.
4. `Stories` read, write and export functions.

### 1.1 Identity and domain types

```ts
// Branded ids. The module makes and checks them. Callers pass them through.
export type StoryId     = string & { readonly __brand: 'StoryId' }
export type ProjectId   = string & { readonly __brand: 'ProjectId' }
export type RecordingId = string & { readonly __brand: 'RecordingId' }
export type MemberId    = string & { readonly __brand: 'MemberId' }
export type OperatorId  = string & { readonly __brand: 'OperatorId' }
export type ConceptIri  = string & { readonly __brand: 'ConceptIri' }

/** The pair (project, recording). Derived from a story. Never stored by hand. */
export interface Instance { project: ProjectId; recording: RecordingId }

export type ReviewState = 'draft' | 'published'

/** A time range on the recording, in seconds. Half-open: [start, end). */
export interface TimeRange { start: number; end: number }

/** Future: a region of a video frame, as Media Fragments xywh. */
export interface Region { unit: 'pixel' | 'percent'; x: number; y: number; w: number; h: number }

/** Domain target. `region` is optional and reserved for video recordings. */
export interface Target { recording: RecordingId; time: TimeRange; region?: Region }

/** Domain body input. A new body type is a new variant here. */
export type BodyInput =
  | { kind: 'text';  value: string; language?: string; purpose?: 'commenting' | 'describing' }
  | { kind: 'sound'; mediaUrl: string; format: string }   // URL from the `media` module
  | { kind: 'image'; mediaUrl: string; format: string }
  | { kind: 'video'; mediaUrl: string; format: string }
  | { kind: 'tag';   concept: ConceptIri }                 // label comes from `vocabulary`

/** What a member writes. */
export interface StoryInput {
  project: ProjectId
  target: Target
  bodies: BodyInput[]
}

/** Domain view of one story, as the asking viewer may see it. */
export interface Story {
  id: StoryId
  iri: string                    // stable, absolute: `${baseUrl}/wap/a/${id}`
  instance: Instance
  target: Target
  bodies: Body[]                 // domain bodies, with tag labels resolved
  creator: { member: MemberId; nickname: string }
  created: Date
  modified: Date
  review: {
    state: ReviewState           // state of the version this viewer sees
    pendingRevision: boolean     // true = published, and a newer draft exists ("Changed")
    publishedBy?: 'operator' | 'rule'
    publishedAt?: Date
  }
  withdrawn: boolean             // true only for operator viewers; others get null instead
  etag: string                   // strong ETag of this version
  annotation: WadmAnnotation     // the exact JSON-LD the protocol serves for this version
}

export type Body =
  | { kind: 'text';  value: string; language?: string; purpose: 'commenting' | 'describing' }
  | { kind: 'sound' | 'image' | 'video'; mediaUrl: string; format: string }
  | { kind: 'tag';   concept: ConceptIri; label: string }

/** Read-only WADM JSON. Public standard shape. Output only. */
export type WadmAnnotation = Readonly<Record<string, unknown>> & {
  '@context': 'http://www.w3.org/ns/anno.jsonld'
  id: string
  type: 'Annotation'
}
```

### 1.2 Viewer and view policy

```ts
/** Who asks. The module derives review-state rules from this. */
export type Viewer =
  | { kind: 'visitor' }                          // anonymous; the HTTP routes always use this
  | { kind: 'member'; member: MemberId }         // sees published + own drafts
  | { kind: 'operator'; operator: OperatorId }   // sees all, incl. withdrawn
  | { kind: 'system' }                           // export jobs, migrations; same as operator

/** Per-project setting. Read from the project configuration, not passed by callers. */
export type ViewPolicy =
  | 'own'            // only stories scoped to this project
  | 'all'            // plus published stories of other projects on the same recording
  | 'reviewed-only'  // plus published stories of other projects that an operator published
```

Review-state rules (one table, applied inside the module to every read):

| Viewer | Own project stories | Other project stories (policy permits) |
|---|---|---|
| visitor | `published` version only | `published` version only |
| member | `published`, plus own drafts and own pending revisions | `published` only |
| operator, system | latest version, every state, withdrawn included | same |

### 1.3 Query

```ts
export interface StoryQuery {
  viewer: Viewer
  /** Where the reader stands. Decides which project's view policy applies. */
  from:
    | { instance: Instance }       // one container: the player's case
    | { project: ProjectId }       // every recording of a project
    | { everywhere: true }         // whole organisation; operator and system only
  at?: TimeRange                   // media time: stories whose target overlaps [start, end)
  createdIn?: { from?: Date; to?: Date }   // wall time, half-open
  modifiedSince?: Date
  concept?: { iri: ConceptIri; includeNarrower?: boolean }
  creator?: MemberId
  reviewState?: ReviewState[]      // narrows; never widens past the viewer's rules
  bodyKinds?: Body['kind'][]       // e.g. only stories with a 'sound' body
  order?: 'target-start' | 'created' | 'modified'   // default 'target-start'
}

export interface StoryPage {
  stories: Story[]
  total: number                    // total matches, not page length
  modified: Date | null            // newest `modified` among matches
  startIndex: number
  next: PageToken | null
  prev: PageToken | null
  etag: string                     // ETag of this page under this query
}

/** Opaque. Callers store it and pass it back. Never parse it. */
export type PageToken = string & { readonly __brand: 'PageToken' }
```

### 1.4 Write inputs and results

```ts
export type StoriesError =
  | { code: 'invalid-story'; issues: Issue[] }          // shape, time range, empty text
  | { code: 'unknown-project' | 'unknown-recording' }
  | { code: 'unknown-concept'; concept: ConceptIri }    // not in this project's vocabulary
  | { code: 'not-found' }
  | { code: 'forbidden' }                               // viewer may not do this
  | { code: 'conflict'; current: string }               // ifMatch is stale; `current` = ETag now
  | { code: 'invalid-transition'; from: ReviewState | 'withdrawn' }

export interface Issue { path: string; rule: string; message: string }   // STE message, safe to show

export type Result<T> = { ok: true; value: T } | { ok: false; error: StoriesError }
```

### 1.5 The `Stories` object

```ts
export const storiesCollections: CollectionConfig[]   // spread into payload.config.ts

export function createStories(config: StoriesConfig): Stories

export interface StoriesConfig {
  payload: Payload               // the running Payload instance (opaque to callers)
  baseUrl: string                // absolute origin, e.g. 'https://stories.example.org'
  pageSize?: number              // default 100; max 500
  now?: () => Date               // default: system clock; tests pass a fixed clock
}

export interface Stories {
  // ---- read ----
  find(query: StoryQuery, page?: PageToken): Promise<StoryPage>
  get(id: StoryId, viewer: Viewer): Promise<Story | null>

  // ---- write: member (Annotate page) ----
  saveDraft(input: StoryInput, by: MemberId): Promise<Result<Story>>
  revise(id: StoryId, input: StoryInput, by: MemberId, ifMatch: string): Promise<Result<Story>>
  withdraw(id: StoryId, by: MemberId | OperatorId, ifMatch?: string): Promise<Result<void>>

  // ---- write: operator (admin GUI custom actions, bulk actions) ----
  setReviewState(
    id: StoryId, state: ReviewState, by: OperatorId,
    opts?: { ifMatch?: string; note?: string },
  ): Promise<Result<Story>>
  addReviewerNote(id: StoryId, text: string, by: OperatorId): Promise<Result<ReviewerNote>>
  reviewerNotes(id: StoryId, viewer: Viewer): Promise<ReviewerNote[]>   // operator only

  // ---- export ----
  export(query: StoryQuery, format: ExportFormat): AsyncIterable<Uint8Array>

  // ---- HTTP seam ----
  protocol: { handle(request: Request): Promise<Response> }

  // ---- maintenance (called by `vocabulary`) ----
  refreshConceptLabel(concept: ConceptIri): Promise<{ updated: number }>
}

export type ExportFormat =
  | 'wadm-collection'   // one AnnotationCollection JSON-LD document with every item inline
  | 'wadm-ndjson'       // one WADM annotation per line

export interface ReviewerNote {
  id: string; story: StoryId; text: string
  by: OperatorId; created: Date
  annotation: WadmAnnotation   // motivation 'moderating', target = story IRI
}
```

### 1.6 HTTP surface of `protocol.handle`

The route file mounts one catch-all under `/wap/`. The handler owns every URL below it.

| Method, path | Result |
|---|---|
| `GET /wap/{project}/{recording}/` | `AnnotationCollection` for the instance. Honours `Prefer`. Default `PreferContainedDescriptions`, first page embedded. |
| `GET /wap/{project}/{recording}/?iris=1` | The same container, IRI form. |
| `GET /wap/{project}/{recording}/?page={token}[&iris=1]` | `AnnotationPage`. |
| `GET /wap/a/{id}` | One annotation. `404` if absent or not visible. `410` if withdrawn after publish. |
| `HEAD` on all of the above | Same headers, no body. |
| `OPTIONS` on all | `204` with CORS headers and `Allow`. |
| `POST`, `PUT`, `DELETE`, `PATCH` | `405` with `Allow: GET, HEAD, OPTIONS`. Writes happen on the Annotate page only. |

Headers on every `GET` and `HEAD`:

- `Content-Type: application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"`
- `ETag`, `Vary: Accept, Prefer`, `Allow: GET, HEAD, OPTIONS`
- `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: ETag, Link, Content-Location`
- Containers also: `Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"`, the `constrainedBy` link, and `Content-Location` with the IRI form that matches the `Prefer` (`?iris=0` or `?iris=1`).
- `If-None-Match` that matches gives `304` with no body.
- `Cache-Control: public, max-age=0, must-revalidate` — caches revalidate with the ETag.

The handler always uses the viewer `{ kind: 'visitor' }`. It reads no cookie and no `Authorization` header. This keeps the CONTEXT rule: the player never knows whether a visitor is signed in.

### 1.7 Invariants

1. **WADM is the source of truth.** The jsonb column holds the WADM annotation. Every other stored column is a projection of it, written by the same hook.
2. **Instance is derived.** `instance.project` comes from `target.scope`. `instance.recording` comes from `target.source`. No caller and no operator sets them.
3. **One write path.** Module functions and Payload admin saves run the same `beforeChange` hook. A story that fails validation never reaches the table, whatever the source.
4. **Visibility is a rule, not a parameter.** `reviewState` in a query only narrows. A visitor who asks for `['draft']` gets an empty page, not an error.
5. **A published story stays visible during revision.** `revise` on a published story writes a pending revision. Visitors keep the published version until an operator publishes again.
6. **Members change only their own stories.** `revise` and `withdraw` by a member on another member's story give `forbidden`.
7. **Time range.** `0 ≤ start < end`. If the catalogue knows the duration, `end ≤ duration`. Seconds, up to 3 decimals.
8. **Bodies.** At least one non-tag body. Every `sound`, `image` or `video` body needs one `text` body with it (ROADMAP milestone 3). Text: 1 to 5000 characters after trim.
9. **Tags.** Every concept is in the vocabulary of `input.project`. One tag gives two WADM bodies: `SpecificResource` (source = concept IRI, `purpose: tagging`) and `TextualBody` (label, `purpose: tagging`).
10. **Stable IRIs.** A story IRI never changes and never depends on a container. One story can appear in more than one container (cross-project policy).
11. **Stable order.** `target-start` order is `(time.start, created, id)` ascending. Ties never reorder between pages.
12. **ETag honesty.** If any story visible in a container changes, the container ETag changes. The converse is not true: a draft save can change the ETag of a visitor container with no visible change.

### 1.8 Ordering constraints

1. Register `storiesCollections` in `payload.config.ts`, then run the Payload migration. The migration adds the change-sequence and the indexes. `createStories` checks for them at start and throws if they are missing.
2. The project and the recording must exist before `saveDraft`. Else `unknown-project` or `unknown-recording`.
3. A concept must exist in the project vocabulary before a member uses it as a tag.
4. Media bodies: upload with the `media` module first. Pass the body URL it gives. `stories` does not wait for transcoding; it stores the URL.
5. `revise`, `setReviewState` and `withdraw` should send `ifMatch` (the `etag` from the last read). `revise` requires it.
6. A `PageToken` belongs to one query. If you pass a token from query A with query B, `find` ignores the token and returns page one. It gives no error. Reason: a player with an old page link must not break.

### 1.9 Error modes

- Writes return `Result`. They never throw for expected failures. The Annotate page shows `issues[].message` beside the field at `issues[].path`.
- Reads return `null` (single story) or an empty page. A story the viewer may not see is `null`, not `forbidden`. This hides the existence of drafts.
- The module throws only for broken configuration or a lost database connection. The HTTP handler maps a throw to `503` with `Retry-After: 5` and logs it. It never shows a stack trace.
- HTTP: unknown project or recording in the URL gives `404`. A bad page token gives page one, see 1.8.6.

### 1.10 Required configuration

| Setting | Source | Why |
|---|---|---|
| `baseUrl` | env `PUBLIC_URL` | All IRIs are absolute. |
| project `rights` IRI | `projects` collection | WADM `rights` MUST be an IRI. |
| project `viewPolicy` | `projects` collection, default `own` | Cross-project sharing. |
| project `reviewRule` | `projects` collection, default `operator` | `rule` = auto-publish on save; sets `publishedBy: 'rule'`. |
| `pageSize` | code, default 100 | Protocol leaves page size to the server. |

The module reads the `projects`, `recordings`, `members` and `concepts` collections through the interfaces of `catalogue`, `vocabulary` and `membership`. Open question: no module in `CONTEXT.md` owns the `projects` collection yet.

### 1.11 Performance notes

- Container GET: at most 2 queries. Query 1 is an aggregate: `count`, `max(modified)` and `max(change_seq)` on one index. If `If-None-Match` matches, the handler stops there and gives `304`. Query 2 reads the page.
- Index: `(recording, project, _status, t_start, created, id)` covers the player's query for every policy.
- Paging is by offset. It is cheap up to about 10 000 stories per instance. Above that, see trade-offs.
- `export` reads by keyset in batches of 500 and streams. Memory stays constant. It never uses offset.
- `concept.includeNarrower` expands the concept tree once per query (one `vocabulary` call), then uses a join table index.
- Target: p95 container GET under 50 ms for 1 000 stories on the stack Postgres.

---

## 2 Usage examples

### 2.1 Web Annotation Protocol routes (the player, any reader)

```ts
// app/src/app/(wap)/wap/[...path]/route.ts
import { stories } from '@/modules/stories/instance'
export const GET = (req: Request) => stories.protocol.handle(req)
export const HEAD = GET
export const OPTIONS = GET
export const POST = GET; export const PUT = GET; export const DELETE = GET   // all give 405
```

Exchange the player sees:

```
GET /wap/riverside/rec-0193/ HTTP/1.1
Prefer: return=representation;include="http://www.w3.org/ns/oa#PreferContainedDescriptions"

HTTP/1.1 200 OK
Content-Type: application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"
Content-Location: https://stories.example.org/wap/riverside/rec-0193/?iris=0
ETag: "c-7f3a91e0"
Vary: Accept, Prefer
Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"
Link: <http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"
Access-Control-Allow-Origin: *

{
  "@context": ["http://www.w3.org/ns/anno.jsonld", "http://www.w3.org/ns/ldp.jsonld"],
  "id": "https://stories.example.org/wap/riverside/rec-0193/?iris=0",
  "type": ["BasicContainer", "AnnotationCollection"],
  "label": "Stories: Riverside — Harvest song, 1972",
  "total": 2, "modified": "2026-10-08T09:14:00Z",
  "first": {
    "id": "https://stories.example.org/wap/riverside/rec-0193/?iris=0&page=p0",
    "type": "AnnotationPage", "startIndex": 0,
    "items": [{
      "id": "https://stories.example.org/wap/a/st_8k2",
      "type": "Annotation",
      "motivation": "commenting",
      "creator": { "id": "https://stories.example.org/members/m_41", "type": "Person", "nickname": "Asha" },
      "created": "2026-10-07T18:02:11Z", "modified": "2026-10-08T09:14:00Z",
      "rights": "http://creativecommons.org/licenses/by/4.0/",
      "body": [
        { "type": "TextualBody", "value": "My grandmother sang this at the harvest.", "format": "text/plain", "language": "en", "purpose": "commenting" },
        { "type": "SpecificResource", "source": "https://stories.example.org/vocab/riverside/c/harvest", "purpose": "tagging" },
        { "type": "TextualBody", "value": "Harvest", "purpose": "tagging" }
      ],
      "target": {
        "type": "SpecificResource",
        "source": "https://stories.example.org/recordings/rec-0193",
        "scope": "https://stories.example.org/projects/riverside",
        "selector": { "type": "FragmentSelector", "conformsTo": "http://www.w3.org/TR/media-frags/", "value": "t=42,51" }
      }
    }]
  },
  "last": "https://stories.example.org/wap/riverside/rec-0193/?iris=0&page=p0"
}
```

### 2.2 Annotate page: save a member's story as a draft

```ts
const result = await stories.saveDraft({
  project: projectId,
  target: { recording: recordingId, time: { start: 42, end: 51 } },
  bodies: [
    { kind: 'text', value: form.text, language: 'en' },
    ...form.concepts.map((iri) => ({ kind: 'tag', concept: iri }) as const),
  ],
}, session.member)

if (!result.ok) return showErrors(result.error)        // issues[] map to form fields
redirect(`${returnUrl}#t=${result.value.target.time.start}`)

// "My stories" list on the Annotate page: own drafts and published, this instance.
const mine = await stories.find({
  viewer: { kind: 'member', member: session.member },
  from: { instance: { project: projectId, recording: recordingId } },
  creator: session.member,
  order: 'modified',
})
```

### 2.3 Admin GUI: move review state draft → published

Path A — Payload's own Publish button. No code in the caller. The operator opens the story in the `stories` collection and clicks **Publish**. Payload sets `_status: 'published'`. The module's hook validates, records `publishedBy: 'operator'`, and bumps the change sequence. The player sees the story on its next request.

Path B — custom bulk action or "Publish with note" button in the admin:

```ts
const queue = await stories.find({
  viewer: { kind: 'operator', operator: req.user.id },
  from: { project: projectId },
  reviewState: ['draft'],
  order: 'created',
})
for (const s of queue.stories) {
  const r = await stories.setReviewState(s.id, 'published', req.user.id,
    { ifMatch: s.etag, note: 'Checked spelling of place names.' })
  if (!r.ok && r.error.code === 'conflict') reportChangedSinceOpened(s.id)
}
```

### 2.4 Export

```ts
// Every published story of a project in 2026, tagged "Harvest" or narrower, as one JSON-LD file.
const stream = stories.export({
  viewer: { kind: 'system' },
  from: { project: projectId },
  reviewState: ['published'],
  createdIn: { from: new Date('2026-01-01'), to: new Date('2027-01-01') },
  concept: { iri: harvestIri, includeNarrower: true },
}, 'wadm-collection')

return new Response(ReadableStream.from(stream), {
  headers: { 'Content-Type': 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
             'Content-Disposition': 'attachment; filename="riverside-2026.jsonld"' },
})
```

Other query examples that need no new function:

- One member's stories everywhere, for a data request: `{ viewer: system, from: { everywhere: true }, creator }`.
- What the player shows between 1:00 and 2:00: `{ viewer: visitor, from: { instance }, at: { start: 60, end: 120 } }`.
- Voice notes only: `bodyKinds: ['sound']`.

---

## 3 What the implementation hides

1. **WADM shaping.** Domain `BodyInput` → WADM bodies: `TextualBody` with `format: text/plain`, `purpose`; `Sound`/`Image`/`Video` with `id` = media URL and `format`; a tag → two bodies. `motivation` choice (`commenting`, or `tagging` when only tags exist — not possible under invariant 8, but the shaper handles it). `creator` as `Person` with `nickname`, no email. `generator`. `rights` from the project. `@context`.
2. **Target shaping.** `source` = recording IRI; `scope` = project IRI on the `SpecificResource`; FragmentSelector `t=start,end` with trailing-zero trim; `&xywh=` when a region exists.
3. **Validation.** Shape, time range against catalogue duration, text length, media-body-needs-text rule, concept membership in the project vocabulary, member ownership.
4. **Storage.** Payload 3 collection `stories` with `versions.drafts: true`. Field `annotation` (Payload `json` → Postgres `jsonb`). Projected fields: `project`, `recording`, `tStart`, `tEnd`, `creator`, `concepts` (hasMany, join table), `bodyKinds`, `publishedBy`, `publishedAt`, `withdrawnAt`, `changeSeq`. The admin shows `annotation` read-only and the projections as list columns.
5. **Payload draft mechanics.** Create vs update; `draft: true` writes go only to the versions table; reads use `draft: true` for operator and own-member views and the main table for visitors. The three admin states map to `review.state` + `review.pendingRevision`.
6. **Access control.** Payload `access.read`, `access.update` on the collection: only operators may set `_status: 'published'`. Members are a separate auth collection.
7. **View policy.** Reads the project's `viewPolicy` and widens the `scope` filter for `all` and `reviewed-only`.
8. **Paging.** Offset pages with opaque tokens (the token encodes offset + query hash). `startIndex`, `next`, `prev`, `first`, `last`, `partOf`. IRI form vs description form.
9. **`Prefer` parsing** and `Content-Location`.
10. **ETag computation.** Container: hash of (query hash, policy, `count`, `max(changeSeq)` over the recording incl. withdrawn rows, page). Single story: `"s-{id}-{versionSeq}"`.
11. **Change sequence.** A Postgres sequence, set in the hook. Payload has no such field type; the migration adds it.
12. **Withdraw.** Soft delete with `withdrawnAt`. A withdrawn story that was once public gives `410`; a never-public one gives `404`.
13. **Reviewer notes.** A second collection `story-notes`. Each note is also a WADM annotation (`motivation: moderating`, target = story IRI). Notes never appear in a visitor container. The admin shows them in the story edit view through a Payload join field.
14. **Label snapshot.** Tag labels are stored in the WADM at save time. `refreshConceptLabel` rewrites them when `vocabulary` renames a concept.
15. **CORS, `Vary`, `Allow`, `304`, `405`, `410`, `503` mapping.**

---

## 4 Dependency strategy and internal seams

### 4.1 External dependency

Postgres: **local-substitutable**. Tests run Payload against a throwaway Postgres in Docker (one database per test file, migrated once). No port at the external seam. Postgres is part of the module's implementation, not a thing that varies.

### 4.2 Module dependencies (in-process)

| Needs | From | How |
|---|---|---|
| recording exists, its IRI, duration | `catalogue` | direct import of its interface |
| concept exists in project, label, narrower concepts | `vocabulary` | direct import |
| member nickname | `membership` | direct import |
| project rights IRI, view policy, review rule | project configuration (owner open) | direct import |

These are not ports. Each has one adapter: the real module. Tests use the real modules on the same test Postgres and seed data through their interfaces.

### 4.3 Seams that are real (two adapters)

- `now` — system clock in production, fixed clock in tests. Tests need exact `created`/`modified` values and `createdIn` boundaries.

### 4.4 Internal seams (private; never exported from `index.ts`)

- `wadm/shape.ts` — pure: domain input + context → `WadmAnnotation`. Pure and deterministic.
- `wadm/read.ts` — pure: `WadmAnnotation` → domain `Story` fields.
- `bodies/` — one codec per body kind (`text`, `sound`, `image`, `video`, `tag`). A new body type is one new codec plus one new `BodyInput` variant. This is where "future body types" lives.
- `protocol/` — pure: `StoryPage` + request facts → `Response`. `Prefer` parse, container and page JSON, headers.
- `query/` — `StoryQuery` + viewer + policy → Payload `where` + `sort`. The only file that knows Payload query syntax.
- `etag.ts` — pure hash.

These seams make the implementation easy to read. They do not get their own test suites by default. If a pure seam has a combinatorial edge (for example, `Prefer` parsing), a small table test at that seam is allowed. Delete it if it duplicates an interface test.

---

## 5 Trade-offs

### Where leverage is high

- **`find(StoryQuery)`.** One function serves the player, the Annotate page list, the admin review queue, data requests and export. Each new filter (time, concept, member, body kind) is one optional field. Callers learn one shape.
- **`Viewer` instead of review-state flags.** Callers cannot leak a draft by a wrong filter. The review rules live in one table in one file. Locality: a change to "who sees what" is one edit.
- **`protocol.handle(Request)`.** The route file is 6 lines. All protocol details — `Prefer`, IRI forms, ETag, CORS, `304`, `405` — sit behind one function. A protocol bug is fixed once.
- **Hooks as the one write path.** The admin GUI's own Publish button and the module functions share validation. No second path can write a bad story.
- **WADM out, domain in.** Callers never hand-write JSON-LD. WADM consumers (the player, other annotation clients, export) get the standard shape.

### Where leverage is thin, or the cost is real

- **The interface is wide.** About 11 functions and a query type with 9 fields. Design A (minimal) would have 3. Each optional field multiplies the test matrix. Mitigation: the review-rule table and the policy table are tested as tables, not as products.
- **Speculative surface.** `region`, `video`, `reviewed-only`, `everywhere`, `bodyKinds` and reviewer notes have no caller in milestones 1–3. Rule from the skill: do not build a seam without a second use. Proposal: keep the types, but ship `region`, `reviewed-only` and reviewer notes as `not implemented` until a milestone needs them. The types cost little; the implementation costs a lot.
- **`storiesCollections` leaks Payload into the interface.** It is unavoidable: Payload config is static and built before `createStories`. Callers only spread it; they never read it. Still, it couples `payload.config.ts` to this module's internals.
- **Offset paging.** Simple, gives `startIndex` and `last`. But an insert during a read can shift items between pages. The page ETag lets a client detect this. Above about 10 000 stories per instance, switch to keyset tokens. The token is opaque, so the switch does not change the interface.
- **Coarse container ETag.** It changes on every write to the recording, even invisible draft saves. Visitors re-download more often than necessary. It is never stale, which matters more.
- **`reviewed-only` meaning is a guess.** This design reads it as "other projects' stories that an operator (not an auto-publish rule) published". Another reading is "stories that *this* project's operator accepted", which needs a per-project review record. Ask the owner before building it.
- **Label snapshots.** Fast reads and stable ETags. But a renamed concept shows the old label until `vocabulary` calls `refreshConceptLabel`. That is a coupling: `vocabulary` must know to call it.
- **Pending revisions are hidden from visitors** (Payload drafts). That is correct for review. But an operator may expect an "edit" to show at once. The admin must show "Changed" clearly.

---

## 6 Test surface

All tests cross the interface: `createStories(...)` on a migrated test Postgres, or `protocol.handle(new Request(...))`. Seed projects, recordings, members and concepts through their own modules. No test reads Payload collections or SQL.

### 6.1 Write: `saveDraft`, `revise`, `withdraw`

- `saveDraft stores a text story as a draft that only its member can see`
- `saveDraft derives the instance from the target and the project`
- `saveDraft rejects an end time before the start time`
- `saveDraft rejects an end time after the recording duration`
- `saveDraft rejects a media body without a text body`
- `saveDraft rejects a concept that is not in the project vocabulary`
- `saveDraft rejects an unknown recording`
- `saveDraft auto-publishes when the project review rule is "rule" and records publishedBy rule`
- `revise of a published story keeps the published version visible to visitors`
- `revise by another member is forbidden`
- `revise with a stale ifMatch returns conflict with the current etag`
- `withdraw of a published story makes the single GET return 410`
- `withdraw of a never-published story makes the single GET return 404`

### 6.2 Review state

- `setReviewState publishes a draft and the visitor container then lists it`
- `setReviewState back to draft removes the story from the visitor container`
- `setReviewState publishes the pending revision, not the old published version`
- `setReviewState by a member is forbidden`
- `admin Publish through Payload runs the same validation as setReviewState` (uses Payload local API as the admin GUI does — the one allowed exception, because the admin GUI *is* a caller)
- `addReviewerNote is visible to operators and never appears in any visitor response`

### 6.3 Read: `find`, `get`, visibility and policy

- `visitor never sees a draft, whatever reviewState the query asks for`
- `member sees own drafts and other members' published stories only`
- `operator sees withdrawn stories`
- `view policy own shows only stories scoped to the project`
- `view policy all adds published stories of other projects on the same recording`
- `view policy all never adds drafts of other projects`
- `find at returns stories whose target overlaps the half-open range`
- `find createdIn excludes a story created exactly at the upper bound`
- `find by concept with includeNarrower returns stories tagged with a child concept`
- `find by creator returns only that member's stories`
- `find order target-start is stable across pages for equal start times`
- `get returns null for a draft when the viewer is a visitor`

### 6.4 WADM shape (through `story.annotation` and the HTTP body)

- `annotation puts the project IRI in target.scope`
- `annotation uses a FragmentSelector conforming to media-frags with value t=42,51`
- `annotation shapes a tag as a SpecificResource body and a tagging TextualBody`
- `annotation shapes a voice note as a Sound body with format audio/mp4`
- `annotation sets rights to the project rights IRI`
- `annotation creator has a nickname and no email`
- `refreshConceptLabel changes the tagging label in every story with that concept`

### 6.5 HTTP: `protocol.handle`

- `container GET returns BasicContainer and AnnotationCollection types with total and modified`
- `container GET without Prefer embeds the first page of full descriptions`
- `container GET with PreferContainedIRIs returns IRIs and Content-Location with iris=1`
- `container GET with PreferMinimalContainer returns first and last links only`
- `container GET has the constrainedBy Link header and the BasicContainer type link`
- `page GET has partOf, startIndex, next and no prev on page one`
- `last page has prev and no next`
- `walking next from first returns every visible story exactly once`
- `container GET with a matching If-None-Match returns 304 with no body`
- `container ETag changes when a story in the container is published`
- `single GET returns the annotation with a strong ETag`
- `every GET has Access-Control-Allow-Origin star and exposes ETag`
- `POST to a container returns 405 with Allow GET HEAD OPTIONS`
- `handler ignores cookies and Authorization and serves the visitor view`
- `unknown project in the path returns 404`
- `bad page token returns page one`

### 6.6 Export

- `export wadm-ndjson streams one valid annotation per line`
- `export wadm-collection is one document with every matching story inline`
- `export of 5000 stories completes with constant memory` (performance guard, tagged slow)
- `export by a visitor viewer contains published stories only`

### 6.7 Configuration

- `createStories throws when the migration has not run`
