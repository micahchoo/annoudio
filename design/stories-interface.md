# `stories` interface — decision

Date: 2026-10-09. Chosen from three designs: A minimal, B flexible, C common-caller (same folder).

## Decision

Base: **C** (`stories-interface-C-common-caller.md`). Everything in C applies unless this file changes it.

Amendments:

1. **Construction.** Replace env-var reads inside the module with one constructor, so tests inject dependencies:
   ```ts
   export const storiesCollection: CollectionConfig            // add to payload.config.ts; nothing outside `stories` queries it
   export function createStories(config: StoriesConfig): Stories
   export interface StoriesConfig {
     payload: Payload
     origin: string            // ANNOUDIO_ORIGIN; base of every IRI; never change after the first story
     pageSize?: number         // default 100, max 500
     maxAge?: number           // default 60; Cache-Control max-age
     limits?: { bodies?: number; tags?: number; text?: number }   // defaults 5, 10, 5000
     now?: () => Date          // default system clock; tests pass a fixed clock
   }
   export interface Stories {
     handleRead(request: Request): Promise<Response>                       // C §1.1
     saveDraft(session: MemberSession, input: DraftInput): Promise<SaveResult>   // C §1.3
     ownDrafts(session: MemberSession, instance: { project: ProjectSlug; recording: RecordingId }): Promise<OwnDraft[]>
     publish(operator: OperatorSession, id: StoryId): Promise<void>        // C §1.4
     unpublish(operator: OperatorSession, id: StoryId): Promise<void>
     exportStories(operator: OperatorSession, filter): AsyncIterable<Annotation>
     conceptChanged(iri: ConceptIri): Promise<void>
   }
   ```
   `payload.config.ts` reads the env and calls `createStories` once. Route files call `handleRead`.

2. **`ownDrafts`** (from A's thin spot). Returns the member's own stories in this instance, each with `id`, `etag`, `reviewState`, `pendingRevision` (published and a newer draft exists), and the domain input needed to refill the Annotate form (`start`, `end`, `bodies`, `tags`). Visitors and other members never see them. This is the only member read.

3. **The admin Publish button and `publish()` run the same hook.** Tests of the review path call `publish()`; they never call `payload.update`. (A's tests did; rejected: that tests past the interface.)

4. **Review-state rule (from B):** any filter narrows what a caller may see; it never widens. `handleRead` has no code path that reads a draft (C invariant 1).

5. **Verify in Phase 1, before building on it:** a Payload 3 draft save leaves the published version unchanged and `find` with `draft: false` returns the published version. C assumed this; nobody checked. If false, the precomputed representations must be built from the versions table.

6. **`motivation`**: `commenting`. Open in C; closed here. A story is a member's comment on a time range.

## Lookups the module needs (in-process imports, not ports)

C and A both found these. They are the minimal interfaces of the sibling modules; Phase 1 implements them as thin Payload-backed functions and nothing more.

```ts
// projects
projects.bySlug(slug): Promise<{ iri: string; slug: string; label: string; rightsIri?: string; language?: string } | null>
// catalogue
catalogue.recording(id): Promise<{ iri: string; id: string; title: string; duration?: number } | null>
// vocabulary
vocabulary.concept(projectSlug, iri): Promise<{ iri: string; label: string; language?: string } | null>
// media (Phase 4; Phase 1 stubs it as "no media exists")
media.body(mediaId, memberId): Promise<{ url: string; format: string; kind: 'sound'|'image'|'video'; ready: boolean } | null>
```

`rights` in WADM is an IRI (B's correction). A project has `rightsLine` (text for the form) and `rightsIri` (optional, goes into the story).

## Why C

- Depth: the player's whole contract is one URL scheme and one function; the implementation hides shaping, validation, paging, ETag, cache headers and the precompute.
- Locality: a change in the WADM shape is one rebuild path. A change in review rules is one hook.
- The CORS-preflight finding is a real cost in the common case that A and B missed.
- Content-hash ETags make caches correct for free.

Costs accepted: a `story_representations` table and an O(n) rebuild per publish; `vocabulary` must call `conceptChanged`; visitors can see a publish up to `maxAge` seconds late.

## Rejected

- B's `Viewer`/`StoryQuery`/view policy: parked with cross-project sharing. The `scope` field keeps it possible.
- B's `revise`/`withdraw`/reviewer notes: no caller in v1.
- A's crawl-as-export: fine for readers, but operators need a one-click export in the admin; C's `exportStories` backs that button.
- Offset paging as the primary read (A, B): replaced by precomputed pages.

## Test surface

C §6 (52 named tests), plus: `ownDrafts` returns only the caller's stories; `ownDrafts` reports `pendingRevision`; fixed clock gives a stable `created` and ETag; the Phase 1 verification in amendment 5.
