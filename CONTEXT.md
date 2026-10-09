# Annoudio — context and ubiquitous language

Annoudio is an embeddable audio annotation widget. One organisation runs one copy. Community members tell stories about audio the organisation hosts. The team runs everything from one admin GUI.

Read this file before any design or code. Use these words exactly, in code, docs and tests.

## Ubiquitous language

| Term | Meaning | Not |
|---|---|---|
| **Organisation** | The owner of one deployed copy (one compose stack). | tenant |
| **Operator** | A team member who uses the admin GUI. Largely non-technical. | admin user, staff |
| **Member** | A community person with an account who tells stories. | user, annotator |
| **Visitor** | Anyone who sees stories in a player. No account. | reader |
| **Project** | One configuration set: vocabulary, theme tokens, review rules, rights line. Usually one site. | space, workspace |
| **Recording** | One audio work in the catalogue. Has a stable `id` and one or more `url`s. | file, media, track |
| **Catalogue** | The organisation-wide list of recordings. | library |
| **Instance** | The pair (project, recording). One conversation. Derived, never stored by hand. | embed, page |
| **Story** | One annotation in the domain sense: a time range on a recording plus one or more bodies. Stored as a WADM annotation. | comment, note |
| **Reply** | A story whose target is another story, not a time range. WADM `motivation: replying`, `target` = the parent story IRI. One level deep. No tags. Same review states. | comment, thread item |
| **Topic** | The public word for Concept on the Annotate page and in the player. Operators see "Concept" in the admin. One idea, two words, split by role. | tag, category |
| **Body** | The content of a story: `Text`, `Sound`, `Image` or `Video`, plus tags. WADM word. | attachment, payload |
| **Target** | The recording plus a time range `#t=start,end` (Media Fragments). WADM word. | selection |
| **Review state** | `draft` (saved, not public) or `published` (visible to visitors). | pending, approved |
| **Lifecycle state** | The state that every surface shows: Processing, Waiting for review, Returned (by an operator, or automatic), Published, Published · change waiting. Derived from the stored data by `stories.lifecycle(row)` only (`design/ia.md` §2.1). A member never sees "draft". | status, draft (outside History) |
| **Concept** | One term in a vocabulary. Has a stable IRI, a label, an optional parent. SKOS word. | tag, term, category |
| **Vocabulary** | The concept tree of a project. Exportable as SKOS. | ontology, taxonomy |
| **Theme tokens** | The `--annoudio-*` CSS custom properties a project sets. | skin, branding |
| **Snippet** | The two lines an operator pastes into a site: the `/embed/v1.js` script and `<annoudio-player>`. | embed code |
| **Player** | The `<annoudio-player>` custom element on the host site. Read side. | widget |
| **Annotate page** | The first-party page on the organisation's domain where a member writes a story. Write side. | editor |
| **Login code** | The emailed one-time code a member uses to sign in. | magic link, OTP |
| **Container** (WADM) | A paged list of stories for one instance, served by the Web Annotation Protocol. Do not confuse with a Docker container; say "stack" for that. | |
| **Stack** | The Docker compose deployment: app, Postgres, worker. | container |

## Fixed decisions

Source: `research/architecture-concerns.md`, `.brainstorm/sessions/0001-*.md`, `ROADMAP.md`.

- Backend: Payload CMS 3 on Postgres. The admin GUI is Payload's, preconfigured. Operators never see code.
- Story storage: WADM JSON-LD in a `jsonb` column. Audio body type is `Sound`. Targets use `FragmentSelector` with `conformsTo: http://www.w3.org/TR/media-frags/`. `scope` = project IRI (stories only; a reply's target is the parent story IRI with no `scope`). SKOS tags are two bodies: the concept IRI as `SpecificResource` and its label as `TextualBody` with `purpose: tagging`.
- Read API: W3C Web Annotation Protocol routes, implemented in-app. Anonymous, CORS `*`, content-hash `ETag`, paged, served from precomputed representations rebuilt on publish. `motivation` is `commenting`.
- Story ids are UUIDv7 made by the Annotate page; `project` (slug) and `recording` (id) are text columns derived from the stored `wadm` by a hook. The sibling lookups take `{ payload, origin, req? }` first so a rebuild reads inside its transaction.
- The player never knows whether a visitor is signed in. Writes happen only on the Annotate page.
- Login: email + login code, inside the app. No identity provider in v1.
- Media bodies: uploaded with tus, transcoded to `.m4a` by a worker (ffmpeg), raw blob kept. Jobs run in Postgres (pg-boss). No Redis.
- Snippet contract: `<script async src="https://ORG/embed/v1.js">` and `<annoudio-player project="…" recording="…" src="…">`. Breaking change = `v2.js`.
- Deploy: `docker-compose.yml`; Dokploy guide, Coolify alternative.

## Module map

Design vocabulary from the `codebase-design` skill: **module**, **interface**, **implementation**, **seam**, **adapter**, **depth**. A module is deep when a small interface hides much behaviour. The interface is the test surface: tests cross the same seam callers do.

| Module | Interface (what callers must know) | Hides | Dependencies (category) |
|---|---|---|---|
| `stories` | `createStories(config)` → `Stories`: `handleRead` (the Web Annotation Protocol read routes); member side `saveDraft`, `ownDrafts`, `ownStories`, `publishedStory`; operator side `publish`, `reject`, `remove`, `review`, `history`, `nextWaiting`, `exportStories`; counts `counts`, `tagCounts`, `projectReach`, `recent`; calls from other modules `mediaSettled`, `conceptChanged`, `forgetInstances`. Also `lifecycle(row)`, `storiesCollection`, `storyRepresentationsCollection`. See `design/stories-interface.md`. | WADM shaping and validation, jsonb storage, paging, ETag, review state, lifecycle, the precomputed representations | Postgres (local-substitutable: test Postgres in Docker) |
| `projects` | `projectsCollection(deps)`, `bySlug`, `byId`, `allProjects`, `create` (step 2 of "Add a player"), `returnTarget`, `theme`, `handleTheme`, `THEME_TOKENS`; admin form: name, slug, site origins (allow-list for the Annotate `return` URL), language, rights statement, review rule, theme tokens | theme JSON route, origin check, rights statements, the delete guard (a project with stories stays; its concepts go with it) | in-process; `deps` gives `stories.forgetInstances` and `vocabulary.removeVocabulary` |
| `vocabulary` | `conceptsCollection(deps)`; lookups `concept`, `conceptsOf`; `exportSkos`, `importSkos`, `IMPORT_LIMITS`; `removeVocabulary` (for the project delete) | IRI minting, hierarchy, SKOS serialisation, the delete guard (a concept in use stays) | in-process; `deps` gives `stories.conceptChanged` and `stories.tagCounts` |
| `catalogue` | `recordingsCollection(deps)`, `recording(id)`, `list`, `register` (step 1 of "Add a player"), `firstRecording`, `snippet`, `checkAudioUrl`, `handleRecording` (`GET /embed/v1/recordings/{project}/{id}.json`, CONTRACT.md §5.2); admin: one audio address, duration read in the operator's browser, Snippet panel per project, Stories count | URL check, snippet text (from `CONTRACT.md`), the delete guard (a recording with stories stays) | in-process; `deps` gives `stories.counts` and `stories.forgetInstances` |
| `membership` | `createMembership(config)` → `requestCode(email, { ip })`, `verifyCode(email, code, nickname?)` → session cookie, `sessionFromRequest`, `signOut`, `contact`, `account`, `updateAccount`; the collections `members`, `member-sessions`, `login-codes` | code generation, expiry, rate limits (per email, per IP, per stack), the cookie session table | `mail` (in-process) |
| `mail` | port `Mailer` (adapters `smtpMailer`, `memoryMailer`); `mailerEmailAdapter` (Payload's own mail, M7, through the same `Mailer`); `addressOf`; `mails` (all text M1–M7 in one file); `createNotices` → `storyEvent` (turns `stories` events into mails) and `digest` (the daily operator mail) | SMTP, templates, opt-outs | SMTP (true external, through the port) |
| `media` | `createMedia(config)` → `handleUpload` (tus), `handleFile` (the served files), `body`, `startSettledConsumer`; lookups `body`, `mediaIdOf`, `removeBody`; `UPLOAD_LIMITS`, `PICKER_TYPES`, `mediaCollection` | tus storage, raw blob retention, the `media.transcode` queue, the `media.settled` consumer | pg-boss (internal seam to the worker); the worker (owned remote, through the `media.settled` contract) |
| `worker` (`worker/`) | `startWorker(options)`, `enqueueTranscode`, ports `Prober` (adapters `ffprobeProber`, `fakeProber`) and `Transcoder` (adapters `ffmpegTranscoder`, `fakeTranscoder`); `settledReporter`, `workSettled`, `SETTLED`; `scheduleDigest`, `workDigest`; `LIMITS` | ffprobe checks, transcoding, limits, retries and the dead letter queue | ffmpeg and ffprobe (true external, through the ports); Postgres (pg-boss) |
| `player` | `CONTRACT.md`: `<annoudio-player>` attributes, `--annoudio-*` tokens, `part` names, events, `seek()` | wavesurfer, fetch, shadow DOM, Annotate link, loader | the `stories` read routes and `GET /embed/v1/themes/{project}.json` (owned remote: tested against a fixture server) |
| `annotate-page` | URL `/annotate?project&recording&t&return` (and `&replyTo`), `/annotate/mine`, `/annotate/account` | login, range select, tag picker, upload UI | `membership`, `stories`, `media`, `vocabulary` |
| `deploy` | `docker-compose.yml`, env vars, the guide | | |

Seam rules:
- One adapter means a hypothetical seam. Introduce a port only where a test adapter is also justified: `Prober`, `Mailer`, `Transcoder`.
- A module that needs another module's instance gets it through `deps` in `payload.config.ts` (a function, so the instance can be made after the config). This keeps the imports one way: `stories` imports `projects`, `catalogue`, `vocabulary` and `media`; those four never import `stories` (`mail` and `membership` import its types only).
- Payload collections are implementation of `stories`, `vocabulary`, `catalogue`, `membership`. Nothing outside those modules reads Payload collections directly.
- Internal seams (pure WADM builder, SKOS serialiser) stay private. Tests go through the module interface.

## Layout

```
app/            Payload app (Next.js): collections, endpoints, admin, Annotate page
app/src/modules/<module>/   one folder per module; index.ts is the interface
embed/          the player; builds to app/public/embed/v1.js
worker/         media jobs
deploy/         compose, Dokploy guide
design/         interface designs and decisions
research/       research notes
```

## Writing style

Code comments, docs and UI text: Simplified Technical English. Short sentences. Active voice. One meaning per word. Define a term once, here, and reuse it.
