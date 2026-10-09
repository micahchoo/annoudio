# `stories` interface, design A: minimal

Status: proposal, 2026-10-09. One of several designs for `design/stories-interface.md`.

Design constraint: the smallest interface that serves all four callers. This design has three entry points:

| Entry point | Caller | What one call gives |
|---|---|---|
| `storiesPlugin(options)` | Payload config (the admin GUI, the review state) | The `stories` collection, its review state, its access rules, its admin views |
| `http(request, payload)` | Web Annotation Protocol routes (the player, export, any visitor) | Every read: container, page, story, `HEAD`, `OPTIONS`, `ETag`, `304`, CORS, `Prefer` |
| `saveDraft(payload, member, draft)` | The Annotate page | One valid WADM story in review state `draft`, made from domain values |

There is no `publish` function. The operator moves the review state in Payload's own admin GUI. The plugin owns what happens at that moment (section 1.4).

Spec sources:

- Web Annotation Protocol, W3C REC 2017-02-23: https://www.w3.org/TR/annotation-protocol/
- Web Annotation Data Model (WADM), W3C REC 2017-02-23: https://www.w3.org/TR/annotation-model/
- Media Fragments URI 1.0: http://www.w3.org/TR/media-frags/

---

## 1 Interface

### 1.1 Types

```ts
// app/src/modules/stories/index.ts — the whole interface.

import type { Payload, Plugin } from 'payload'

/** An absolute IRI. The module never accepts a relative IRI. */
export type Iri = string

/** Configuration. Read once, when Payload builds its config. */
export interface StoriesOptions {
  /** The organisation origin, for example "https://stories.example.org". No trailing "/". */
  baseIri: Iri
  /** The path where the Next.js route mounts `http`. Default "/stories". */
  basePath?: string
  /** Stories per AnnotationPage. Default 100. Range 1..500. */
  pageSize?: number
}

/** The signed-in member. The caller gets this from `membership`. */
export interface MemberRef {
  id: string
  /** The name visitors see. Never an email address. Optional. */
  nickname?: string
}

/** What the Annotate page knows. Domain values, not WADM. */
export interface StoryDraft {
  /** Absent: make a new story. Present: replace the member's own story. */
  id?: string
  project: string            // project slug, as in the snippet `project="…"`
  recording: string          // recording id, as in the snippet `recording="…"`
  start: number              // seconds, >= 0
  end: number                // seconds, > start
  text?: string              // plain text; becomes a TextualBody
  language?: string          // BCP 47 tag for `text`, for example "ml"
  media?: Array<{ url: Iri; format: string }> // from `media.upload`; format is a media type
  concepts?: Iri[]           // concept IRIs from the project vocabulary
}

/** A story as WADM JSON-LD. Readers get exactly this shape. */
export interface Story {
  '@context': 'http://www.w3.org/ns/anno.jsonld'
  id: Iri
  type: 'Annotation'
  motivation: 'commenting'
  creator: { id: Iri; type: 'Person'; nickname?: string }
  created: string            // xsd:dateTime, UTC
  modified: string           // xsd:dateTime, UTC
  rights?: Iri
  body: StoryBody[]          // never empty
  target: {
    type: 'SpecificResource'
    source: Iri              // the recording IRI
    scope: Iri               // the project IRI
    selector: {
      type: 'FragmentSelector'
      conformsTo: 'http://www.w3.org/TR/media-frags/'
      value: string          // "t=42,51"
    }
  }
}

export type StoryBody =
  | { type: 'TextualBody'; value: string; format: 'text/plain'; language?: string; purpose: 'commenting' }
  | { type: 'TextualBody'; value: string; purpose: 'tagging' }          // concept label
  | { type: 'SpecificResource'; source: Iri; purpose: 'tagging' }       // concept IRI
  | { id: Iri; type: 'Sound' | 'Image' | 'Video'; format: string }

export type SaveDraftError =
  | 'unknown-project'
  | 'unknown-recording'
  | 'invalid-range'          // start < 0, end <= start, or end > recording duration
  | 'empty-story'            // no text and no media
  | 'unknown-concept'        // concept is not in this project's vocabulary
  | 'foreign-media'          // media url is not a body URL that `media` made
  | 'unknown-story'          // id given, but no such story
  | 'not-creator'            // id given, but this member did not make it
  | 'instance-change'        // id given, but project or recording differs

export type SaveDraftResult =
  | { ok: true; story: Story; reviewState: 'draft' }
  | { ok: false; error: SaveDraftError; field?: keyof StoryDraft }

/** 1. Install the collection, its review state and its admin views. */
export function storiesPlugin(options: StoriesOptions): Plugin

/** 2. Answer one Web Annotation Protocol request. Anonymous. Published stories only. */
export function http(request: Request, payload: Payload): Promise<Response>

/** 3. Save one member's story in review state `draft`. */
export function saveDraft(payload: Payload, member: MemberRef, draft: StoryDraft): Promise<SaveDraftResult>
```

Note on the `Story` type: `scope` is a property of the `SpecificResource` target in WADM §4.2.3, not of the annotation. The fixed decision "`scope` = project IRI" is satisfied there.

### 1.2 IRIs and routes

`http` answers these paths under `basePath`. Each container IRI ends in `/` and has no query, as the protocol §4 requires.

| Path | Resource | Contents |
|---|---|---|
| `/stories/{project}/{recording}/` | Container for one instance | Published stories of the instance |
| `/stories/{project}/` | Container for one project | Published stories of all instances of the project (export) |
| `…/?page={n}` and `…/?iris=1&page={n}` | AnnotationPage | Page `n`, zero-based, with descriptions or IRIs |
| `/stories/{project}/{recording}/{id}` | One story | WADM JSON-LD |

Derived IRIs:

- Project IRI: `{baseIri}/projects/{project}`.
- Recording IRI: `{baseIri}/recordings/{recording}`.
- Member IRI: `{baseIri}/members/{member.id}`.
- Story IRI: `{baseIri}{basePath}/{project}/{recording}/{id}`. The instance is part of the story IRI. This is safe because the instance of a story never changes (invariant I2).

### 1.3 Invariants

- **I1. Anonymous reads see published stories only.** `http` never returns a story, an IRI, a count or a `modified` time that comes from a draft. A draft story GET gives `404`, not `403`.
- **I2. The instance of a story never changes.** `target.source` and `target.scope` are set at creation. `saveDraft` with an `id` and a different instance gives `instance-change`.
- **I3. Every stored story is valid WADM.** The module validates on every write: `saveDraft`, and each admin save. An invalid document never reaches the table.
- **I4. Readers get the stored JSON unchanged**, except for the `@context` line, which the container page removes from embedded stories (it is on the page).
- **I5. A member never publishes.** `saveDraft` always writes review state `draft`. Only an operator can set `published`.
- **I6. A published story stays visible while its creator edits it.** `saveDraft` on a published story makes a newer draft version. Visitors see the last published version until an operator publishes the new one.
- **I7. Order is stable.** Container order is `start` ascending, then `created` ascending, then `id`. A page always has the same stories while the container `ETag` is the same.
- **I8. `created` never changes. `modified` changes on each save and each change of review state.**
- **I9. The body array has no duplicate concept.** Each concept gives exactly two bodies: the `SpecificResource` and its `TextualBody` label, next to each other.
- **I10. Time values are canonical.** `value` is `t={start},{end}` in seconds with at most three decimals and no trailing zeros: `t=42,51`, `t=42.5,51.125`.

### 1.4 Review state

The operator moves the review state with Payload's draft and publish buttons on the `stories` collection. The plugin installs hooks that run at that moment:

1. Validate the WADM again (I3).
2. Set `modified` (I8).
3. Change the container `ETag` of the instance and of the project (section 1.7).

The admin GUI shows the WADM field read-only. It shows derived columns for the review queue: project, recording, time range, text excerpt, tag labels, creator nickname, review state. An operator changes review state and can delete a story. An operator does not edit JSON.

### 1.5 Ordering constraints

- Register `storiesPlugin` in `payload.config.ts` before the first call to `http` or `saveDraft`. Both read `options` from the Payload config.
- Run the Payload migration that the plugin adds before the app starts in production.
- Call `media.upload` before `saveDraft`. `saveDraft` accepts only body URLs that already exist.
- Call `membership.verifyCode` before `saveDraft`. `saveDraft` trusts `member`. It does not authenticate.

### 1.6 Error modes

`saveDraft`:

- Returns `{ ok: false, error }` for every problem in the input (the `SaveDraftError` list). `field` names the input field when one field is the cause. The Annotate page shows the error next to that field.
- Throws only when the stack fails (Postgres unavailable, migration missing). The caller does not catch this. Next.js shows its error page.

`http` never throws. Every result is a `Response`:

| Status | When |
|---|---|
| `200` | Container, page or story found |
| `304` | `If-None-Match` equals the current `ETag` |
| `204` | `OPTIONS` (CORS preflight) |
| `400` | `page` is not a non-negative integer; `Prefer` has both `PreferContainedIRIs` and `PreferContainedDescriptions` |
| `404` | Unknown project or recording; unknown story; draft story; page after the last page |
| `405` | Any method except `GET`, `HEAD`, `OPTIONS`. `Allow` lists the three. |
| `500` | Stack failure. Body is a short JSON message, no stack trace. |

An existing instance with zero published stories gives `200` with `total: 0` and no `first` (protocol §4.2).

### 1.7 HTTP headers that `http` sets

All responses:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Expose-Headers: ETag, Link, Allow, Vary`
- `Content-Type: application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"` (except `204`, `304`)

Containers also send:

- `Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"`
- `Link: <http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"`
- `Allow: GET, HEAD, OPTIONS` (no `POST`: writes go through `saveDraft`, not the protocol)
- `Vary: Prefer`

Stories also send `Link: <http://www.w3.org/ns/ldp#Resource>; rel="type"` and `Allow: GET, HEAD, OPTIONS`.

`ETag` (weak, `W/"…"`):

- Story: a hash of the published version id and its `modified`.
- Container and page: a hash of (container IRI, preference, page number, `total`, largest `modified`, `pageSize`).
- Cache: `Cache-Control: public, max-age=0, must-revalidate`. A visitor's browser asks again each time and usually gets `304`.

The module serves JSON-LD only. It does not negotiate formats, so it does not send `Vary: Accept`. Turtle (a protocol SHOULD) is not in v1.

### 1.8 `Prefer` handling (protocol §4.2.1)

| Request `Prefer` include | Container response |
|---|---|
| none, or `oa#PreferContainedDescriptions` | `first` embeds page 0 with full stories; `last` is a link |
| `oa#PreferContainedIRIs` | `first` embeds page 0 with story IRIs; page links carry `iris=1` |
| `ldp#PreferMinimalContainer` (with or without one of the above) | No stories, no `ldp:contains`; `first` and `last` are links |

Pages carry `id`, `type: "AnnotationPage"`, `partOf { id, total, modified }`, `startIndex`, `next` (except the last page), `prev` (except page 0), and `items`. Containers carry `type: ["BasicContainer", "AnnotationCollection"]`, `label`, `total`, `modified`, `first`, `last`, and `@context` with both `http://www.w3.org/ns/anno.jsonld` and `http://www.w3.org/ns/ldp.jsonld`.

### 1.9 Required configuration

| Value | Where | Effect |
|---|---|---|
| `baseIri` | `storiesPlugin` options, from env `ANNOUDIO_ORIGIN` | Every IRI. Change it and every story IRI changes. Set it once. |
| `basePath` | options, default `/stories` | The route path. Must equal the Next.js route folder. |
| `pageSize` | options, default 100 | Stories per page. A change changes every page `ETag`. |
| Next.js route | `app/src/app/stories/[...path]/route.ts` | Exports `GET`, `HEAD`, `OPTIONS` that call `http`. |

### 1.10 Performance notes

- One container or page request is two SQL statements: one count with `max(modified)`, one page select. Both use the index `(project, recording, review_state, start, created, id)`.
- A `304` costs the count statement only. The page select does not run.
- The project container uses the index `(project, review_state, start, created, id)`.
- Offset paging. Cost grows with the page number. A container with 10 000 stories and `pageSize` 100 has 100 pages; the last page reads 10 000 index rows. This is acceptable for v1 (one recording rarely has more than a few hundred stories).
- `saveDraft` does one transaction: read the existing story (when `id` is present), read the recording duration, check the concepts, write the version. Target: under 50 ms on the stack.
- `http` does not use Payload's `find`. It reads the table with one SQL statement through Payload's Drizzle instance, because `find` loads every field and runs every hook.

---

## 2 Usage examples

### 2.1 Payload config (admin GUI and review state)

```ts
// app/src/payload.config.ts
import { storiesPlugin } from '@/modules/stories'

export default buildConfig({
  plugins: [
    storiesPlugin({ baseIri: process.env.ANNOUDIO_ORIGIN!, pageSize: 100 }),
  ],
  // …
})
```

The operator opens **Stories** in the admin GUI. The list shows drafts first. The operator opens a draft, listens, and clicks **Publish**. Nothing else in the codebase changes for this caller.

### 2.2 Web Annotation Protocol routes (player, visitors, any client)

```ts
// app/src/app/stories/[...path]/route.ts
import { getPayload } from 'payload'
import config from '@payload-config'
import { http } from '@/modules/stories'

const handle = async (request: Request) => http(request, await getPayload({ config }))
export { handle as GET, handle as HEAD, handle as OPTIONS }
```

The player reads one instance:

```
GET /stories/oral-history/rec-0042/
Accept: application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"
→ 200, ETag: W/"c1f…", first = page 0 with stories, last = …/?page=3

GET /stories/oral-history/rec-0042/?page=1
If-None-Match: W/"9ab…"
→ 304
```

A client reads one story:

```
GET /stories/oral-history/rec-0042/7f3c2a
→ 200, the WADM JSON-LD of section 1.1
```

### 2.3 Annotate page (save a member's story as a draft)

```ts
// app/src/app/annotate/actions.ts  (a Next.js server action)
import { saveDraft } from '@/modules/stories'

const result = await saveDraft(payload, session.member, {
  project: 'oral-history',
  recording: 'rec-0042',
  start: 42,
  end: 51,
  text: 'ഇത് എന്റെ മുത്തശ്ശിയുടെ പാട്ടാണ്.',
  language: 'ml',
  media: [{ url: 'https://stories.example.org/media/b81e.m4a', format: 'audio/mp4' }],
  concepts: ['https://stories.example.org/vocab/oral-history/lullaby'],
})

if (!result.ok) return { error: result.error, field: result.field }
redirect(`${returnUrl}#t=42`)
```

The stored story:

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "https://stories.example.org/stories/oral-history/rec-0042/7f3c2a",
  "type": "Annotation",
  "motivation": "commenting",
  "creator": { "id": "https://stories.example.org/members/m-19", "type": "Person", "nickname": "Ammini" },
  "created": "2026-10-09T08:12:03Z",
  "modified": "2026-10-09T08:12:03Z",
  "rights": "https://creativecommons.org/licenses/by-nc/4.0/",
  "body": [
    { "type": "TextualBody", "value": "ഇത് എന്റെ മുത്തശ്ശിയുടെ പാട്ടാണ്.", "format": "text/plain", "language": "ml", "purpose": "commenting" },
    { "id": "https://stories.example.org/media/b81e.m4a", "type": "Sound", "format": "audio/mp4" },
    { "type": "SpecificResource", "source": "https://stories.example.org/vocab/oral-history/lullaby", "purpose": "tagging" },
    { "type": "TextualBody", "value": "Lullaby", "purpose": "tagging" }
  ],
  "target": {
    "type": "SpecificResource",
    "source": "https://stories.example.org/recordings/rec-0042",
    "scope": "https://stories.example.org/projects/oral-history",
    "selector": { "type": "FragmentSelector", "conformsTo": "http://www.w3.org/TR/media-frags/", "value": "t=42,51" }
  }
}
```

The member edits the story later: the same call with `id: '7f3c2a'`.

### 2.4 Export (later)

Export is a crawl of the project container. It uses `http`, not a new entry point:

```
GET /stories/oral-history/        Prefer: …#PreferMinimalContainer
→ first = …/?page=0, last = …/?page=41
GET /stories/oral-history/?page=0 … ?page=41
```

The pages are a valid AnnotationCollection. A file export is a script that concatenates `items`. Any Web Annotation client can do the same crawl.

---

## 3 What the implementation hides

Callers do not know these things. Each one can change without a change to a caller.

1. **WADM shaping.** The mapping from `StoryDraft` to the JSON of section 2.3: body types from media types (`audio/*` → `Sound`, `image/*` → `Image`, `video/*` → `Video`), the two-body SKOS tag, `motivation`, `creator`, `rights`, the target with `scope` and `FragmentSelector`, canonical time values (I10).
2. **WADM validation.** One validator for every write path (I3): required properties, allowed body types, selector shape, IRIs absolute, at least one non-tag body.
3. **Cross-module checks.** The recording exists and its duration bounds `end`. The concepts belong to the project vocabulary, and their labels come from the vocabulary. The media URLs came from `media`. The project rights IRI goes into `rights`.
4. **Storage.** The Payload collection, its `jsonb` field, its version tables, and the migration. Derived columns `project`, `recording`, `start`, `end`, `created` sit next to the `jsonb` and come from it in a `beforeChange` hook. Nobody writes them by hand. This is the **instance derivation**.
5. **Review state.** Payload's `_status` and versions. How a draft of a published story lives in the version table while the main row stays published (I6). Access rules: members cannot publish; anonymous reads filter on `published`.
6. **The protocol.** Route parsing, `Prefer` parsing, container and page JSON, `first`/`last`/`next`/`prev`/`startIndex`/`partOf`, all headers in section 1.7, `HEAD` (same headers, no body), `OPTIONS`, `304`.
7. **ETag computation** and cache headers.
8. **Paging arithmetic and ordering** (I7), and the SQL that does it.
9. **The admin views:** read-only WADM field, derived list columns, the review queue filter.

---

## 4 Dependency strategy and internal seams

### 4.1 External dependencies

| Dependency | Category | Strategy |
|---|---|---|
| Postgres (through Payload and Drizzle) | Local-substitutable | Tests run against a real Postgres in Docker. No port at the external seam. Each test file gets a fresh schema. |
| Payload 3 | In-process framework | The tests boot Payload with the plugin, as production does. `payload` is a parameter of `http` and `saveDraft`, so a test passes its own instance. |
| `catalogue` (recording exists, duration) | In-process module | Called through its interface. Test data: register a recording through `catalogue` in test setup. |
| `vocabulary` (concept in project, label) | In-process module | Called through its interface. Test data: import a small SKOS file through `vocabulary.importSkos`. |
| `media` (URL is a known body URL) | In-process module | Called through its interface. |

**Flagged dependency, outside this module's scope.** The current module map does not give `stories` what it needs:

- `vocabulary` lists only `exportSkos` and `importSkos`. `stories` needs `vocabulary.concept(project, iri) → { iri, label } | null`.
- `catalogue` lists only `register`. `stories` needs `catalogue.recording(id) → { id, durationSeconds } | null`.
- `media` lists only `upload`. `stories` needs `media.isBodyUrl(url) → boolean`.
- Projects have no module. `stories` needs the project slug, its rights IRI and its label. Proposal: a `projects` lookup in a small `projects` module, or `projects` inside `vocabulary`.

The rule "nothing outside those modules reads Payload collections directly" forbids the shortcut of reading those collections from `stories`. Decide these four before implementation.

### 4.2 Internal seams (private; not in `index.ts`)

| Internal seam | Shape | Why it exists |
|---|---|---|
| `wadm.ts` | Pure: `shape(draft, context) → Story`, `validate(json) → errors` | One place for WADM rules. Used by `saveDraft` and by the admin hook. |
| `protocol.ts` | Pure: `(parsed request, container facts, rows) → { status, headers, body }` | Keeps HTTP rules free of SQL. |
| `store.ts` | SQL: `count(instance)`, `page(instance, offset, limit)`, `one(id)`, `write(version)` | One place for SQL, indexes and the published filter (I1). |
| `collection.ts` | Payload `CollectionConfig` with hooks and access | The plugin's content. |

Each internal seam has one adapter. So none is a port. Tests do not import them (section 6). They exist for locality, not for substitution.

---

## 5 Trade-offs

### 5.1 Where leverage is high

- **`http`.** One function, one parameter that every web developer already knows (`Request`). Behind it: about fifteen protocol rules, three `Prefer` modes, paging, `ETag`, `304`, CORS, `HEAD`, `OPTIONS`, the published filter. The player, export and any third-party Web Annotation client use it. The test surface is the same as the caller surface: send a `Request`, read a `Response`.
- **`saveDraft`.** The caller gives domain values from the Annotate form. It never sees WADM. All WADM, SKOS and Media Fragments knowledge stays in the module. Create and edit are one call: the presence of `id` decides.
- **Export costs no interface.** The project container is the export.
- **Locality for the review state.** One hook set guards both write paths (member and operator). A WADM rule change touches `wadm.ts` only.

### 5.2 Where leverage is thin, or the design costs something

- **`storiesPlugin` is a framework hook, not a behaviour.** Its behaviour (publish validates, stamps `modified`, changes `ETag`) is visible only through `http` after an admin action. Tests must drive the admin path through Payload's local API (`payload.update({ _status: 'published' })`), which is the same path the admin GUI takes. That is honest, but it couples tests to Payload's draft model.
- **No `publish` function.** A future caller that publishes outside the admin GUI (a bulk "publish all from this workshop" button, a trusted-member rule) must use Payload's local API on the collection. That breaks the rule that only the module touches the collection. If such a caller appears, add `setReviewState(payload, operator, id, state)` as entry point four. Do not add it now: it has no caller.
- **Export has no drafts.** `http` is anonymous, so an export of drafts (for an archive backup) is not possible through it. A database dump covers backups. If operators need a draft export, it is a new entry point.
- **No member read.** The Annotate page cannot list "my drafts" through this interface. When editing a draft, the page has only what it saved. If the Annotate page needs to reload a draft, `saveDraft` is not enough; a `readOwn(payload, member, id)` entry point is the smallest fix. This is the most likely fourth entry point.
- **No delete for members.** A member cannot remove their own story. Operators delete in the admin GUI. Consent law (for example, a request to remove a voice recording) may force a member delete later.
- **Offset paging.** Simple and gives `last` and `startIndex`, which the protocol asks for. A story published between two page reads moves stories across page edges. The container `ETag` changes, so a careful client restarts. The player reads small instances and does not care.
- **`payload` as a parameter.** It makes tests easy and keeps the module free of globals. It is one more thing each caller passes. The alternative, `getPayload` inside the module, hides it but makes the module create its own dependency.
- **JSON-LD only.** No Turtle. The protocol says SHOULD, not MUST. Add it inside `http` later without an interface change.

---

## 6 Test surface

All tests cross the interface: `storiesPlugin` in the test Payload config, then `http` and `saveDraft`. The admin path uses `payload.update` on the collection, because that is exactly what the admin GUI does. Postgres runs in Docker. No test imports `wadm.ts`, `protocol.ts` or `store.ts`.

Fixture: one project `oral-history` with rights IRI, one recording `rec-0042` of 300 s, a vocabulary with concept `lullaby` ("Lullaby"), one media body URL, two members.

### 6.1 `saveDraft`

1. `saveDraft makes a draft that anonymous readers do not see`
2. `saveDraft shapes text, Sound body, SKOS tag pair, target and scope as WADM`
3. `saveDraft writes the concept label from the vocabulary, not from the caller`
4. `saveDraft maps audio, image and video media types to Sound, Image and Video bodies`
5. `saveDraft writes canonical time values` (`42` and `51.50` → `t=42,51.5`)
6. `saveDraft rejects start below zero, end not after start, and end after the recording duration with invalid-range`
7. `saveDraft rejects a story with no text and no media with empty-story`
8. `saveDraft rejects a concept from another project with unknown-concept`
9. `saveDraft rejects a media URL that media did not make with foreign-media`
10. `saveDraft rejects an unknown project and an unknown recording`
11. `saveDraft with an id replaces the member's draft and keeps created`
12. `saveDraft with another member's id returns not-creator and changes nothing`
13. `saveDraft with an id and a different recording returns instance-change`
14. `saveDraft on a published story keeps the published version visible until an operator publishes the edit`
15. `saveDraft never writes review state published, whatever the input`
16. `saveDraft never puts the member email in the story`

### 6.2 Review state (admin path)

17. `publishing a draft makes it visible in its instance container and the project container`
18. `publishing changes modified and the container ETag`
19. `unpublishing removes the story from every read and gives 404 on its IRI`
20. `an operator save of invalid WADM is refused` (I3 through the admin path)
21. `a member session cannot set review state published`
22. `deleting a story removes it from the container and changes the ETag`

### 6.3 `http`: containers and pages

23. `instance container has BasicContainer and AnnotationCollection types, label, total, modified, first, last`
24. `instance container sends both Link headers, Allow, Vary Prefer, and the WADM content type`
25. `container with no published stories gives total 0 and no first`
26. `default Prefer embeds page 0 with full stories`
27. `PreferContainedIRIs embeds page 0 with IRIs and page links carry iris=1`
28. `PreferMinimalContainer gives first and last links and no stories`
29. `both PreferContainedIRIs and PreferContainedDescriptions give 400`
30. `pages carry partOf with total and modified, startIndex, next and prev at the right edges`
31. `walking every page yields every published story once, ordered by start, created, id`
32. `page after the last page gives 404; a non-integer page gives 400`
33. `project container holds the published stories of all its instances`
34. `unknown project or recording gives 404`

### 6.4 `http`: stories, caching, CORS, methods

35. `story GET returns the stored WADM unchanged with ldp Resource Link and ETag`
36. `draft story GET gives 404`
37. `If-None-Match with the current ETag gives 304 with no body`
38. `the ETag changes after a publish in the instance and stays the same after a draft save`
39. `HEAD gives the same status and headers as GET and no body`
40. `OPTIONS gives 204 with CORS headers`
41. `every response has Access-Control-Allow-Origin * and exposes ETag and Link`
42. `POST, PUT, PATCH and DELETE give 405 with Allow GET, HEAD, OPTIONS`

### 6.5 Contract check

43. `every story from http passes a WADM JSON-LD check against http://www.w3.org/ns/anno.jsonld` (expand with a JSON-LD processor; no unknown terms)

Tests that are not written: unit tests on `wadm.ts`, `protocol.ts`, `store.ts`. The interface tests cover them. If a shaping bug is hard to find through `saveDraft`, add a test at the interface first; reach into an internal seam only when the interface test cannot show the cause.
