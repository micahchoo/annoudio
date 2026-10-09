# Phase 1 notes: the `stories` module

Date: 2026-10-09. Scope: ROADMAP Phase 1, deliverables 1 and 2 (the record and the protocol routes). `CONTRACT.md` (deliverable 3) is a separate task.

Read `CONTEXT.md` first. This file uses its words.

## What was built

| Part | Where |
|---|---|
| `stories` module | `app/src/modules/stories/`. `index.ts` is the interface. Internal files: `shape.ts` (WADM), `validate.ts`, `paginate.ts` (containers and pages), `rebuild.ts` (Postgres), `protocol.ts` (read side), `etag.ts`, `collection.ts`, `create.ts`, `types.ts`. |
| Sibling lookups | `projects.bySlug`, `catalogue.recording`, `vocabulary.concept`, `media.body` (stub). Each module folder holds its collection config. |
| New collection | `concepts` (project, iri, label, language, parent). No editor. |
| Changed collection | `projects`: added `slug` (unique, validated), `rightsIri`, `language`. |
| Route | `app/src/app/(frontend)/stories/[[...path]]/route.ts`. It exports every method; `handleRead` answers GET, HEAD and OPTIONS, and gives 405 with CORS headers for the others. |
| Config | `payload.config.ts` composes the collections and exports `stories`, the one instance. It reads `ANNOUDIO_ORIGIN` and the optional `STORIES_*` variables. |
| Tests | `app/tests/int/stories/`: `read.int.spec.ts` (26 tests), `write.int.spec.ts` (27 tests), `world.ts` (seed and helpers), `hand-written.wadm.json` (the record). |

### How a read works

A publish, an unpublish, an admin delete and `conceptChanged` rebuild the instance in the same transaction. The rebuild reads the published stories, gives each tag its current label, sorts them (`start`, `created`, `id`), and writes one row per representation: 4 container variants, 2 variants per page, 1 per story. Each row holds the response text and its ETag (SHA-256 of the text). A row whose ETag does not change is not written. A read is one row lookup. A known instance with no row gets an empty container that the handler makes from the same code.

### Stored record and served bytes

The stored `wadm` field is the source of truth. A `beforeValidate` hook parses it and writes the indexed columns `project`, `recording`, `member`, `start`, `end`. No caller writes them. The hook refuses a record that is not a story of this origin, or that moves a story to another instance or member.

`jsonb` does not keep key order. The served bytes do not come from storage order: `parseStory` rebuilds every object in one fixed key order. The tests compare served bytes with `JSON.stringify` of the hand-written record, and compare the stored field parsed.

## Phase 1 verification (amendment 5)

Claim: a Payload 3.90 draft save leaves the published version unchanged, and `find` with `draft: false` returns the published version.

Result: **true**. Representations are built from the main collection table, not from the versions table.

Evidence:

1. Source. `payload/dist/collections/operations/utilities/update.js`: when `isSavingDraft` is true, Payload does not call `db.updateOne` on the main table. It only writes a version (`saveVersion` with `draft: true`).
2. Test. `write.int.spec.ts` > `published story stays unchanged in reads while its member saves a new draft`. The test publishes a story, saves a new draft, and checks that the story bytes, the story ETag, the container ETag and `exportStories({ reviewState: 'published' })` do not change. The draft save over a published story fires the rebuild hook (the previous version was published), so this test runs `find` with `draft: false` after a draft save. After the next `publish`, the new text appears.
3. Mutation. When the rebuild reads the newest versions (`draft: true`), this test fails. So the test can see the difference.

A note on `publish`: a local `update` with `data: { _status: 'published' }` publishes the newest version. Payload merges the data into the newest version (`getLatestCollectionVersion`), not into the main document.

## Deviations from the decision

1. **Two collection exports.** `index.ts` exports `storiesCollection` and `storyRepresentationsCollection`. Reason: Payload makes one table per collection config. A hand-made table is not possible in development: Payload's schema push asks to drop every table that it does not know. Nothing outside `stories` queries either collection. `story-representations` is hidden in the admin and closed to REST and GraphQL.
2. **`StoriesConfig.payload` also takes a function.** `payload: Payload | (() => Promise<Payload>)`. Reason: `payload.config.ts` must make the instance before Payload exists. The function form starts Payload on the first call. Tests give the Payload instance itself.
3. **`StoriesError` is a type only.** The interface exports types, `createStories` and the collections. Callers check `error.name === 'StoriesError'` and `error.code`.
4. **New `SaveError` code `too-many-tags`.** C has a tag limit but no error code for it.
5. **An empty text body returns `no-body`.** C did not say. A story with only white space has no content.
6. **`media-not-ready` is not checked by `publish`.** Phase 1 has no media module. The only way to get a media body is the admin path (the hand-written record). Phase 4 adds the check with the `Transcoder` fake.
7. **`ownDrafts` gives a media body as `{ kind, media: <body IRI> }`.** The stored WADM has the media URL, not the media id. Phase 4 (owner: `media`) must give the reverse lookup, or the stored story must keep the media id.
8. **Story `project` and `recording` are text columns, not relationships.** They hold the project slug and the recording id, the same values as the IRIs. Phase 0 had relationship fields. The admin list shows the text.
9. **Hand-written record path.** The test stores the record through the Payload local API (the admin path), then calls `publish()`. Reason: `saveDraft` refuses every Sound body in Phase 1, because the `media` stub says no media exists. A second test checks that `saveDraft` makes the same shape from domain input, without the Sound body.
10. **Served tag labels come from the vocabulary at rebuild time.** The stored `wadm` keeps the label of the save. `conceptChanged` changes the served label; it does not change the stored record. A removed concept takes both tag bodies out of the served story.
11. **Lookups take a context.** The decision wrote `bySlug(slug)`. The real functions take `{ payload, origin, req? }` first, so the rebuild can read in its transaction. The module reads no environment variable.
12. **`projects.language`** is a new field. `bySlug` returns `language`, and `stories` uses it as the default language of text bodies.
13. **Lint config.** `pnpm lint` failed in Phase 0: `eslint.config.mjs` imported `@eslint/eslintrc`, which is not installed. It now uses the flat configs of `eslint-config-next` 16, with the same rules. It also ignores `public/embed/**`: the player bundles that `embed/` builds there are build output.
14. **`skipTrailingSlashRedirect: true`** in `next.config.ts`. Without it, Next redirects the container IRI `…/1/` to `…/1`. The handler serves the container at both URLs.

## Known gaps

- **No caller of `conceptChanged` yet.** An operator can change a concept label in the admin now; the served label stays old until something calls `conceptChanged`. The Phase 5 vocabulary editor must call it after the commit (owner: `vocabulary`). A hook in the `concepts` collection cannot do it: it runs before the commit, so the rebuild would read the old label.
- **Project label and recording title are copied into the container `label`.** A rename does not rebuild. Same owner rule: Phase 5 (`catalogue`, `projects`).
- **A change of `STORIES_PAGE_SIZE` does not rebuild.** C §1.7 asks for a full rebuild at start. Not built. Until it exists, do not change the page size after the first publish.
- **No GIN index on `wadm -> 'body'`.** Payload cannot declare it. `conceptChanged` scans the published stories. Add the index in the first production migration.
- **Benchmarks 51 and 52 of C §6 are not written.** They are not part of the unit run.
- **Two first saves of one new id at the same time** can make the second one fail with a unique-key error. A double click after the first save returns is safe (idempotent).
- **Headers that Next and Payload add.** `withPayload` adds `Accept-CH`, `Critical-CH` and `Vary: Sec-CH-Prefers-Color-Scheme` to every path, and Next adds `Vary: rsc, …`. These extra `Vary` values split CDN cache keys. Decide in Phase 2 if the `/stories` routes must remove them.
- **`CONTEXT.md` does not yet record `motivation: commenting`.** The decision file records it. C asked for it in `CONTEXT.md`.

## Test map

Required by the brief, and where each one is (R = `read.int.spec.ts`, W = `write.int.spec.ts`):

| Behaviour | Test |
|---|---|
| Hand-written record byte-equal, single route and container; stored field equal parsed | R `the hand-written record` (4 tests) |
| Anonymous read never returns a draft | R `draft story is 404, and the container does not count it` |
| Publish makes the story appear and changes the ETag | W `publish makes the story appear…`; R `ETag changes after a publish in the instance and not after a publish in another` |
| If-None-Match gives 304 | R `If-None-Match with the current ETag gives 304 without a body` (container, page, story) |
| CORS on every response; OPTIONS 204; 405 | R `protocol` (4 tests) |
| `?page=`, `?iris=1`, Prefer minimal and IRIs | R `container` (5 tests) |
| pageSize 2 across 5 stories | R `with pageSize 2 and 5 stories has 3 linked pages` |
| Order start, created, id | R `items are in start order, then created, then id` |
| saveDraft errors | W `saveDraft` (9 tests) |
| Idempotent double save | W `same id and same input twice gives one story and the same ETag` |
| ownDrafts | W `ownDrafts` (2 tests) |
| conceptChanged | W `conceptChanged updates…`, `conceptChanged after a concept removal…` |
| Unpublish removes | W `unpublish removes the story…` |
| Fixed clock gives stable created and ETag | R `a fixed clock gives a stable created and ETag` |
| Unknown instance 404 | R `of an unknown project or recording is 404` |
| Amendment 5 | W `published story stays unchanged in reads while its member saves a new draft` |

Also from C §6: admin-path publish gives the same bytes (42), admin delete (43), concurrent publishes (47), forbidden and not-found (46), HTML text (38), fractional seconds (39), unknown media (36), text limit (35), export (49, 50).

Mutation check: eight deliberate faults were put into the code, one at a time. Each one made the test that names the behaviour fail: order without `created`, rebuild from draft versions, no relabel, no idempotence, no advisory lock, no 304, no stale check, no owner check.

## Run the tests

From the repository root:

```sh
docker compose -f deploy/docker-compose.dev.yml up -d --wait
cd app
pnpm test:int
pnpm tsc --noEmit
pnpm lint
```

The tests use the database `annoudio_test` on the same Postgres server. Payload makes it if it does not exist. At the start of each test file, Payload drops all its tables and pushes the schema again (`PAYLOAD_DROP_DATABASE`). `vitest.setup.ts` refuses to run on a database whose name does not end in `_test`. The files run one at a time.

## Development database

The development database was reset (`down -v`), because the schema changed (text story ids, a required project slug). It now holds one project (`river-voices`), one recording (id 1), one concept and one published story, made through `stories.saveDraft` and `stories.publish`. The route check through `next dev` used this data: container, story, 304, OPTIONS 204, POST 405, unknown 404, and the container with and without the trailing slash.
