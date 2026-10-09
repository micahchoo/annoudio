# `stories` interface — design C: optimise for the most common caller

Status: proposal, 2026-10-09. One of several designs for the `stories` module (see `CONTEXT.md`, module map).

Design constraint: the most common caller is the **player**. It reads the published stories of one **instance** anonymously, many times per minute, from many host sites. That read must be trivial, cacheable and fast. The second most common caller is the **Annotate page**. It saves one draft. All other callers (admin review, export) may be less convenient.

The core decision: **the module precomputes the public representations of each instance when the review state changes, not when a visitor reads.** A read is one primary-key lookup of bytes that are already shaped, paged and tagged with an `ETag`. A publish pays the cost.

Sources for exact property names: W3C Web Annotation Data Model (https://www.w3.org/TR/annotation-model/), W3C Web Annotation Protocol (https://www.w3.org/TR/annotation-protocol/), Media Fragments URI 1.0 (https://www.w3.org/TR/media-frags/), Fetch standard (CORS-safelisted request headers).

---

## 1 Interface

The interface is everything a caller must know. It has three parts: the URL scheme (for the player), five functions (for the Annotate page, the admin GUI and export), and one collection config (for `payload.config.ts`).

### 1.1 Read side: one handler and one URL scheme

```ts
// app/src/modules/stories/index.ts

/**
 * The whole read interface. Mount it once, on GET, HEAD and OPTIONS of `/stories/*`.
 * Anonymous. Never reads a session. Never returns a draft.
 */
export function handleRead(request: Request): Promise<Response>;
```

URL scheme (the player knows only this):

| IRI | What it is |
|---|---|
| `{origin}/stories/{project}/{recording}/` | The **container** of the instance: an `AnnotationCollection` and LDP `BasicContainer`. Its first page is embedded. |
| `{origin}/stories/{project}/{recording}/?page={n}` | Page `n` (zero-based) as an `AnnotationPage`, with complete stories. |
| `{origin}/stories/{project}/{recording}/?iris=1` and `?iris=1&page={n}` | The same container and pages, with story IRIs only. |
| `{origin}/stories/{project}/{recording}/{storyId}` | One published story as a WADM `Annotation`. |

`project` is the project slug. `recording` is the recording `id` from the catalogue. The player already has both: they are the `project` and `recording` attributes of `<annoudio-player>`.

Response contract:

| Case | Status | Headers (all responses also carry the CORS set below) |
|---|---|---|
| Container, known instance | 200 | `Content-Type: application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"`, `ETag` (strong), `Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"`, `Link: <http://www.w3.org/TR/annotation-protocol/>; rel="http://www.w3.org/ns/ldp#constrainedBy"`, `Allow: GET, HEAD, OPTIONS`, `Vary: Prefer`, `Cache-Control` |
| Page | 200 | Same as container, without the `BasicContainer` type link. |
| Story | 200 | `Content-Type` as above, `ETag`, `Link: <http://www.w3.org/ns/ldp#Resource>; rel="type"`, `Allow: GET, HEAD, OPTIONS`, `Cache-Control` |
| `If-None-Match` matches | 304 | `ETag`, `Cache-Control`. No body. |
| Known instance, zero published stories | 200 | Container with `total: 0` and no `first`/`last`. |
| Unknown project or recording, page out of range, draft story, unknown story | 404 | `Cache-Control: public, max-age=60`. Body is a short JSON problem document. |
| Any other method | 405 | `Allow: GET, HEAD, OPTIONS` |
| OPTIONS (CORS preflight) | 204 | `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`, `Access-Control-Allow-Headers: Accept, Prefer, If-None-Match`, `Access-Control-Max-Age: 86400` |

CORS set on every response: `Access-Control-Allow-Origin: *`, `Access-Control-Expose-Headers: ETag, Link, Allow, Vary`.

`Prefer` handling (Web Annotation Protocol §4.2.1). The handler honours the three preferences `http://www.w3.org/ns/ldp#PreferMinimalContainer`, `http://www.w3.org/ns/oa#PreferContainedIRIs` and `http://www.w3.org/ns/oa#PreferContainedDescriptions`. With no `Prefer`, it uses `PreferContainedDescriptions` and embeds the first page. Query parameters (`iris=1`) select the same variants without a header. If a request sends both `Prefer` and `iris`, the query parameter wins, because the query is part of the cache key everywhere.

Representation of the container (default variant):

```json
{
  "@context": ["http://www.w3.org/ns/anno.jsonld", "http://www.w3.org/ns/ldp.jsonld"],
  "id": "https://org.example/stories/river-voices/rec-0042/",
  "type": ["BasicContainer", "AnnotationCollection"],
  "label": "River Voices: Ferry crossing, 1962",
  "total": 3,
  "modified": "2026-10-09T10:14:00Z",
  "first": {
    "id": "https://org.example/stories/river-voices/rec-0042/?page=0",
    "type": "AnnotationPage",
    "startIndex": 0,
    "items": [ { "...": "one complete story, see 1.2" } ]
  },
  "last": "https://org.example/stories/river-voices/rec-0042/?page=0"
}
```

A page has `id`, `type: "AnnotationPage"`, `partOf` (the container `id`, `total`, `modified`), `startIndex`, `items`, and `next`/`prev` where they apply.

### 1.2 The shape of one published story

The module makes this shape. No caller builds it.

```json
{
  "@context": "http://www.w3.org/ns/anno.jsonld",
  "id": "https://org.example/stories/river-voices/rec-0042/0192f3a4-7c1e-7b10-9d55-3e1f0a2b4c6d",
  "type": "Annotation",
  "motivation": "commenting",
  "created": "2026-10-08T19:02:11Z",
  "modified": "2026-10-09T10:14:00Z",
  "creator": { "id": "https://org.example/members/m-118", "type": "Person", "nickname": "Leela" },
  "rights": "https://creativecommons.org/licenses/by-nc/4.0/",
  "body": [
    { "type": "TextualBody", "value": "My grandmother sang this on the ferry.", "format": "text/plain", "language": "ml" },
    { "id": "https://org.example/media/0192f3a4-aa01.m4a", "type": "Sound", "format": "audio/mp4" },
    { "type": "SpecificResource", "source": "https://org.example/vocab/river-voices/c/ferry", "purpose": "tagging" },
    { "type": "TextualBody", "value": "Ferry", "purpose": "tagging", "language": "en" }
  ],
  "target": {
    "type": "SpecificResource",
    "source": "https://org.example/recordings/rec-0042",
    "scope": "https://org.example/projects/river-voices",
    "selector": {
      "type": "FragmentSelector",
      "conformsTo": "http://www.w3.org/TR/media-frags/",
      "value": "t=42,51"
    }
  }
}
```

Notes on the shape:
- `scope` sits on the target `SpecificResource`, because WADM defines `scope` on a Specific Resource.
- Each SKOS tag is two bodies: the concept IRI as `SpecificResource` with `purpose: tagging`, then its label as `TextualBody` with `purpose: tagging`.
- `creator` carries the member IRI and display name. It never carries the email address.
- `target.source` is the recording IRI from the catalogue, not one of its `url`s. A recording can have many URLs; its IRI is stable.

### 1.3 Write side: one function for the Annotate page

```ts
export type StoryId = string;          // UUIDv7, made by the Annotate page when it opens
export type ProjectSlug = string;
export type RecordingId = string;
export type ConceptIri = string;
export type MediaId = string;          // from the `media` module upload

export type BodyInput =
  | { kind: "text"; value: string; language?: string }   // plain text only, never HTML
  | { kind: "sound"; media: MediaId }
  | { kind: "image"; media: MediaId }
  | { kind: "video"; media: MediaId };

export interface DraftInput {
  id: StoryId;                 // same id on every save of this story = update, not a new story
  project: ProjectSlug;
  recording: RecordingId;
  start: number;               // seconds, Normal Play Time
  end: number;                 // seconds; the range is [start, end)
  bodies: BodyInput[];         // 1..config.maxBodies; tags do not count
  tags?: ConceptIri[];         // 0..config.maxTags; concepts of this project's vocabulary
  ifMatch?: string;            // ETag from the previous save; omit on the first save
}

export type SaveError =
  | { code: "unknown-instance" }                          // project or recording does not exist
  | { code: "invalid-range"; field: "start" | "end" }     // start < 0, end <= start, or end > duration
  | { code: "no-body" }
  | { code: "too-many-bodies" }
  | { code: "text-too-long"; index: number }
  | { code: "unknown-media"; index: number }              // media id not found or not owned by this member
  | { code: "unknown-concept"; iri: ConceptIri }          // not in this project's vocabulary
  | { code: "instance-changed" }                          // a later save tried to move the story to another instance
  | { code: "not-owner" }                                 // this id belongs to another member
  | { code: "stale"; etag: string };                      // ifMatch does not match the current draft

export type SaveResult =
  | { ok: true; id: StoryId; iri: string; etag: string; reviewState: "draft" }
  | { ok: false; error: SaveError };

/** Create or update the member's draft. Never changes what visitors see. */
export function saveDraft(session: MemberSession, input: DraftInput): Promise<SaveResult>;
```

`MemberSession` comes from the `membership` module. `saveDraft` trusts it; it does not check the login code again.

### 1.4 Review, export and coupling functions

```ts
/** Admin path. Same effect as the Publish button in the admin GUI. */
export function publish(operator: OperatorSession, id: StoryId): Promise<void>;
export function unpublish(operator: OperatorSession, id: StoryId): Promise<void>;

/** All stories that match, in stable id order, as WADM. Operator only. */
export function exportStories(
  operator: OperatorSession,
  filter: { project?: ProjectSlug; reviewState?: "published" | "draft" | "any" },
): AsyncIterable<Annotation>;

/** The `vocabulary` module calls this after a concept label changes or a concept is removed. */
export function conceptChanged(iri: ConceptIri): Promise<void>;

/** The Payload collection. Add it to `payload.config.ts`. Do not query it from outside `stories`. */
export const storiesCollection: CollectionConfig;
```

`publish` and `unpublish` throw `StoriesError` with `code` `"not-found"`, `"forbidden"` (session is not an operator) or `"media-not-ready"` (a sound, image or video body has no transcoded file yet). A failed publish changes nothing.

### 1.5 Invariants

1. A visitor sees only published stories. `handleRead` has no code path that reads a draft.
2. The instance of a story never changes. The first save fixes `project` and `recording`. Story IRIs are therefore stable, and the instance is a pure function of the stored story.
3. A published story stays visible, unchanged, while its member saves a new draft of it. Visitors see the new text only after the next publish.
4. After `publish`, `unpublish`, a delete in the admin GUI or `conceptChanged` returns, every read from the origin returns the new representation. The rebuild of the precomputed representations runs in the same transaction as the state change.
5. Equal content gives an equal `ETag`. The `ETag` is a hash of the bytes. A rebuild that changes nothing does not invalidate any cache.
6. Items in a container are in timeline order: `start` ascending, then `created`, then `id`. The player can draw them without a sort.
7. Text bodies are plain text. The player can insert them with `textContent` on any host site without an XSS risk.
8. `saveDraft` with the same `id` and the same input is idempotent. A double submit makes one story.

### 1.6 Ordering constraints

- Mount `storiesCollection` in `payload.config.ts` before the first call to any function. The module's migration creates the precomputed-representation table.
- The `media` upload must finish (a `MediaId` exists) before `saveDraft` refers to it. The transcode may still run; `publish` waits for nothing and fails with `media-not-ready` instead.
- The `vocabulary` module must call `conceptChanged` after it commits a label change. If it does not, published tag labels stay old.
- A client must not send `Prefer` to a page IRI (the protocol says the client SHOULD NOT). The handler ignores `Prefer` on pages.

### 1.7 Required configuration

| Name | Default | Meaning |
|---|---|---|
| `ANNOUDIO_ORIGIN` | none, required | Base for every IRI. Do not change it after the first story: every stored IRI uses it. |
| `STORIES_PAGE_SIZE` | 100 | Stories per page. A change triggers a full rebuild at start. |
| `STORIES_MAX_AGE` | 60 | Seconds in `Cache-Control: public, max-age=…, stale-while-revalidate=86400`. This is the longest time a visitor waits to see a new publish. |
| `STORIES_MAX_BODIES` | 5 | Bodies per story, tags excluded. |
| `STORIES_MAX_TAGS` | 10 | Tags per story. |
| `STORIES_MAX_TEXT` | 5000 | Characters per text body. |

The project gives the `rights` IRI and the default text `language`. The catalogue gives the recording IRI, title and duration.

### 1.8 Performance notes

- **Container or page read:** one primary-key lookup in `story_representations` (key: `instance`, `variant`, `page`). The row holds the response bytes and the `ETag`. No JSON work, no join, no Payload query. Target: under 2 ms in the handler at p99.
- **304:** the same lookup. The handler compares `If-None-Match` with the stored `ETag` and sends no body.
- **Most instances have fewer than `STORIES_PAGE_SIZE` stories.** For them, the player needs one request in total: the container, with all stories in the embedded first page.
- **The player must send a plain GET with no custom headers.** `Prefer` is not a CORS-safelisted header, and an `Accept` value with `profile="…"` contains a `"` byte, which is a CORS-unsafe byte. Either one forces a preflight per URL. Without them, the request is a CORS simple request. The browser's own HTTP cache sends `If-None-Match` on revalidation; that does not cause a preflight.
- **Cache layers:** browser cache and any CDN in front of the stack can serve the read for `STORIES_MAX_AGE` seconds, then revalidate with a 304. `stale-while-revalidate` keeps the player fast while it revalidates.
- **Publish cost:** O(n) in the published stories of one instance. It reshapes all of them and rewrites every page row. For n ≤ 1000 this is a few milliseconds. See section 5 for large instances.
- **`saveDraft` cost:** one Payload create or update in one transaction, plus in-process lookups in `catalogue`, `vocabulary` and `media`. No rebuild.

---

## 2 Usage examples

### 2.1 Player (caller 1, the common case)

```ts
// embed/src/load.ts — inside <annoudio-player>
const base = `${origin}/stories/${project}/${recording}/`;
const container = await (await fetch(base)).json();          // plain GET: no preflight
let page = container.first;
const stories = page ? [...page.items] : [];
while (page?.next) {                                          // rare: only for big instances
  page = await (await fetch(page.next)).json();
  stories.push(...page.items);
}
// `stories` is already in timeline order. Each story: target.selector.value is "t=42,51".
```

The player does nothing for caching. The browser does it with `ETag` and `Cache-Control`.

### 2.2 A third-party protocol client

```http
GET /stories/river-voices/rec-0042/ HTTP/1.1
Prefer: return=representation;include="http://www.w3.org/ns/ldp#PreferMinimalContainer http://www.w3.org/ns/oa#PreferContainedIRIs"
```

The response is the container without embedded items, with `first` = `…/?iris=1&page=0` and `last`. This client pays one preflight per URL per day (`Access-Control-Max-Age: 86400`).

### 2.3 Annotate page (caller 2)

```ts
// app/src/app/annotate/actions.ts — server action
"use server";
import { saveDraft } from "@/modules/stories";
import { requireMember } from "@/modules/membership";

export async function save(form: DraftForm) {
  const session = await requireMember();
  const result = await saveDraft(session, {
    id: form.storyId,                        // made with uuidv7() when the page opened
    project: form.project,
    recording: form.recording,
    start: form.start,
    end: form.end,
    bodies: [{ kind: "text", value: form.text }, ...form.mediaIds.map((m) => ({ kind: "sound", media: m }))],
    tags: form.conceptIris,
    ifMatch: form.etag,                      // undefined on the first save
  });
  if (!result.ok) return { error: result.error };      // the page shows the field error
  return { etag: result.etag, returnTo: `${form.return}#t=${form.start}` };
}
```

### 2.4 Admin GUI (caller 3)

The operator opens the Stories list in the admin GUI. The list shows recording, project, time range, member and review state. The operator opens one story, reads its bodies (read-only), and presses Publish. Payload sets `_status` to `published`. The collection hook in `stories` rebuilds the instance. No operator code. Scripts and tests use the same path:

```ts
await publish(operatorSession, "0192f3a4-7c1e-7b10-9d55-3e1f0a2b4c6d");
```

### 2.5 Export (caller 4)

```ts
// app/src/app/(payload)/api/export/route.ts
const out = [];
for await (const story of exportStories(operator, { project: "river-voices", reviewState: "published" })) {
  out.push(story);
}
return Response.json({ "@context": "http://www.w3.org/ns/anno.jsonld", type: "AnnotationCollection", total: out.length, items: out });
```

Export is less convenient on purpose: it streams stories one at a time and the caller makes the file.

### 2.6 Vocabulary coupling

```ts
// app/src/modules/vocabulary/collection.ts — afterChange hook
if (doc.prefLabel !== previousDoc.prefLabel) await conceptChanged(doc.iri);
```

---

## 3 What the implementation hides

- **WADM shaping.** `@context`, `type`, `motivation`, the two-body SKOS tag, `FragmentSelector` with `conformsTo`, `scope`, `rights`, `creator`, `created`/`modified`. Callers give ids and seconds; the module makes IRIs and JSON-LD.
- **Media Fragments formatting.** Seconds become `t=42,51` (integers without a decimal point, other values with at most 3 decimals, no trailing zeros).
- **Validation.** Range against the recording duration, body count, text length, media ownership, concept membership in the project vocabulary, instance immutability, ownership of the story id.
- **Instance derivation.** The instance key `(project, recording)` is stored as two indexed columns beside the `jsonb` WADM record. No caller writes it.
- **Storage.** The Payload 3 collection `stories` with `versions.drafts`, the `jsonb` field `annotation`, the indexed columns, a GIN index on `annotation -> 'body'` for `conceptChanged`, and the table `story_representations`.
- **Review state.** Payload's `_status` (`draft` | `published`) and its versions table. Member edits of a published story become a new draft version; the published version stays in the main document.
- **The precomputed container.** On every state change: read the published stories of the instance, shape, sort, cut into pages, serialise each variant (descriptions, IRIs, minimal), hash each to an `ETag`, upsert the rows, delete rows of pages that no longer exist. `modified` stays the same when the bytes stay the same.
- **Concurrency.** Two publishes on one instance serialise on a transaction-scoped advisory lock keyed by the instance. The second rebuild sees the first one's result.
- **Protocol details.** `Link`, `Allow`, `Vary`, CORS, `Prefer` parsing, 304, 404 for drafts (not 403, so a visitor cannot learn that a draft exists), HEAD without a body.
- **Fallback for a missing row.** A known instance with no stories has no row. The handler checks the instance in the catalogue and returns a fixed empty container. An empty container is the same bytes for every request, so its `ETag` is stable.

---

## 4 Dependency strategy and internal seams

**Postgres: local-substitutable.** Tests run the real Payload app against a test Postgres in Docker (the compose `postgres` service, or one throwaway container per test run). Each test file migrates once; each test truncates the `stories` tables. There is no port at the external seam and no in-memory fake of storage. Reason: the precomputed rows, the advisory lock, the transaction around the rebuild and Payload's draft versions are the behaviour under test. A fake would hide exactly the parts that can break.

**In-process modules: real.** `catalogue`, `vocabulary`, `projects` and `media` are in-process. Tests use the real modules with seeded rows. `media` has its own `Transcoder` port; tests use its fake adapter to mark a media id as ready or not ready.

**No port for the cache.** One adapter (the Postgres table) means a hypothetical seam. If the stack later puts a CDN in front, the CDN obeys the HTTP headers; it does not need a seam in code.

**Internal seams (private, not exported from `index.ts`):**

| Internal seam | Kind | Why it exists |
|---|---|---|
| `shape(record, context) → Annotation` | pure | The one place that knows WADM. Used by the rebuild and by `exportStories`. |
| `validate(input, context) → SaveError \| null` | pure | Keeps `saveDraft` readable. |
| `paginate(annotations, pageSize, containerIri) → Representation[]` | pure | One place that knows the protocol's page links and `startIndex`. |
| `parseRead(url, headers) → ReadKey` | pure | Maps URL, `iris` and `Prefer` to one row key. |
| `rebuild(tx, instance)` | Postgres | Called from the collection hooks and from `conceptChanged`. |

Tests do not call these seams. They cross the module interface, as callers do. If a bug in `shape` hides from the interface tests, add an interface test that shows it.

---

## 5 Trade-offs

**Where leverage is high:**
- **The player.** It knows one URL template and plain `fetch`. Caching, paging links, ordering, tag labels and the media URL come in the response. One request covers most instances. Delete the `stories` module, and every one of these concerns moves into the player and into every third-party client.
- **The read path.** It has almost no logic left: lookup, compare `ETag`, send bytes. Bugs in shaping surface at publish time, in one place, not at read time on many host sites.
- **`saveDraft`.** One function, one input type, one result type with field-level error codes. The client-made UUID removes a "create vs update" choice and makes double submits safe.

**Where leverage is thin:**
- **`publish` and `unpublish`** are thin wrappers over a Payload update. Their depth is in the hook they trigger, which the admin GUI also triggers. They exist so tests and scripts have a path that is not the GUI.
- **`storiesCollection`** leaks Payload into `payload.config.ts`. This is unavoidable with Payload; the rule "nothing outside `stories` queries the collection" keeps the leak small.
- **`exportStories`** is shallow on purpose. The caller makes the file.

**Costs of this design:**
- **Write amplification.** Each publish rewrites all page rows of the instance. For an instance with 10 000 stories, that is about 10 MB per publish. Mitigation if it happens: above a threshold, store only the stories and compute pages on read, with an in-process cache keyed by `ETag`. Do not build this before an instance is that big.
- **Staleness.** A visitor can see old stories for up to `STORIES_MAX_AGE` seconds after a publish. The origin is fresh at once (invariant 4); caches are not. The ROADMAP test "sees it on the static page without a rebuild" must wait or reload with cache bypass.
- **Coupling to `vocabulary`.** Labels are copied into the published shape. If `vocabulary` forgets `conceptChanged`, labels drift. A rival design reads labels at request time, but then the read is no longer a single lookup.
- **No draft preview in the player.** A member cannot see their draft in the player. This follows from "the player never knows whether a visitor is signed in". The Annotate page must show the draft itself.
- **Payload draft semantics are an assumption.** The design depends on this: a draft save on a published document creates a version and leaves the published main document unchanged. Verify it against Payload 3.90 in the first slice. If it is wrong, the rebuild must read the latest published version from the versions table.
- **Rebuild inside the publish transaction.** This makes invariant 4 true, but a rebuild failure makes the publish fail. That is the correct failure: an operator sees an error, not a silent public mismatch.
- **Open choice.** `motivation` is `commenting`. `describing` is the rival. Pick one in the first slice and record it in `CONTEXT.md`.

---

## 6 Test surface

All tests cross the interface: `handleRead` with a `Request`, and the exported functions. Postgres is real. Names are the test titles.

**Read: container and pages (`handleRead`)**
1. `container of a known instance with no stories is 200 with total 0 and no first`
2. `container of an unknown project or recording is 404`
3. `container embeds the first page with complete stories when no Prefer is sent`
4. `container sends the BasicContainer type link, the constrainedBy link, Allow and Vary: Prefer`
5. `content type is application/ld+json with the anno.jsonld profile`
6. `items are in start order, then created, then id`
7. `instance with pageSize + 1 stories has two pages; page 0 links next, page 1 links prev and partOf`
8. `page startIndex is zero-based and counts across pages`
9. `page out of range is 404`
10. `iris=1 returns story IRIs only in items`
11. `PreferMinimalContainer returns first and last links and no items`
12. `PreferContainedIRIs header gives the same bytes as iris=1`
13. `HEAD returns the GET headers and no body`
14. `OPTIONS returns 204 with CORS preflight headers and max-age 86400`
15. `POST, PUT and DELETE are 405 with Allow`
16. `every response carries Access-Control-Allow-Origin * and exposes ETag and Link`

**Read: caching**
17. `If-None-Match with the current ETag returns 304 without a body`
18. `ETag changes after a publish in the instance and not after a publish in another instance`
19. `ETag stays the same after a rebuild that changes no content`
20. `ETag stays the same after a member saves a new draft of a published story`
21. `Cache-Control uses STORIES_MAX_AGE and stale-while-revalidate`

**Read: one story**
22. `published story GET returns the WADM shape with Sound body, FragmentSelector t=42,51, scope and rights`
23. `SKOS tag appears as SpecificResource source plus TextualBody label, both purpose tagging`
24. `creator has the member IRI and nickname and no email`
25. `draft story GET is 404`
26. `unknown story id is 404`

**Write: `saveDraft`**
27. `first save creates a draft that no read returns`
28. `second save with the same id updates the draft and returns a new etag`
29. `same id and same input twice gives one story`
30. `save with a stale ifMatch returns stale with the current etag`
31. `save with another member's id returns not-owner`
32. `save that changes project or recording returns instance-changed`
33. `end <= start, start < 0 and end > duration return invalid-range with the field`
34. `zero bodies returns no-body; more than STORIES_MAX_BODIES returns too-many-bodies`
35. `text over STORIES_MAX_TEXT returns text-too-long with the index`
36. `media id of another member returns unknown-media`
37. `concept from another project's vocabulary returns unknown-concept`
38. `text body with HTML is stored and served as plain text`
39. `fractional seconds format as t=42.5,51.125 with no trailing zeros`

**Review: `publish`, `unpublish`, admin path**
40. `publish makes the story appear in the container read that follows`
41. `unpublish removes the story from the container read that follows`
42. `publish through the Payload local API gives the same container bytes as publish()`
43. `delete of a published story in the admin removes it from the container`
44. `published story stays unchanged in reads while its member saves a new draft`
45. `publish with an untranscoded media body throws media-not-ready and changes nothing`
46. `publish by a member session throws forbidden`
47. `two concurrent publishes in one instance give a container with both stories`

**Coupling and export**
48. `conceptChanged updates the tag label in every published story that uses the concept`
49. `exportStories with reviewState published yields only published stories in id order`
50. `exportStories yields the same WADM as the single story GET`

**Performance (benchmark, not in the unit run)**
51. `container read of a 100-story instance is under 2 ms p99 in the handler`
52. `publish in a 1000-story instance is under 200 ms`
