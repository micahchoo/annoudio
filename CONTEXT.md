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
| **Instance** | The pair (project, recording). One conversation. Derived, never stored by hand. A project also keeps its **widgets**: the recordings that an operator put on its sites (`projects.recordings`, written by "Add a widget to a site"), so a widget shows in the admin before its first story. | embed, page |
| **Story** | One annotation in the domain sense: a time range on a recording plus one or more bodies. Stored as a WADM annotation. | comment, note |
| **Reply** | A story whose target is another story, not a time range. WADM `motivation: replying`, `target` = the parent story IRI. One level deep. No values. Same review states. | comment, thread item |
| **Body** | The content of a story: `Text`, `Sound`, `Image` or `Video`, plus one value body per value. WADM word. | attachment, payload |
| **Target** | The recording plus a time range `#t=start,end` (Media Fragments). WADM word. | selection |
| **Review state** | `draft` (saved, not public) or `published` (visible to visitors). | pending, approved |
| **Lifecycle state** | The state that every surface shows: Processing, Waiting for review, Returned (by an operator, or automatic), Published, Published · change waiting. Derived from the stored data by `stories.lifecycle(row)` only (`design/ia.md` §2.1). A member never sees "draft". | status, draft (outside History) |
| **Vocabulary** | The ordered list of fields of a project: what members are asked about each story. The admin tab and the sidebar job are "Vocabulary". | ontology, taxonomy, schema |
| **Field** | One row of a vocabulary. It puts one property on the Annotate form, with a label that members read as a question ("Where did this happen?"). Members see only the label: their word is **question**. | column, attribute |
| **Property** | The RDF property that a field records, for example `dcterms:spatial`. A term of an ontology, or an own property of the project (`{origin}/vocab/{project}/p/{key}`). Operators see it in small text under the label. | predicate (in UI text) |
| **Ontology** | An RDF file of properties and classes, loaded once for the organisation (Settings → Ontologies). Eight are bundled: Dublin Core, Dublin Core types, FOAF, SKOS, RDF, RDF Schema, Schema.org, MARC relators. | vocabulary |
| **List** | A controlled list of a project that a field takes its choices from, for example **Topics**, **Places**, **People**. Kind `items` (a SKOS concept scheme) or `entities` (people, places or things with a class). | scheme, taxonomy, category |
| **Item** | One entry of a list, with a stable IRI (`{origin}/vocab/{project}/c/{key}`), a label and an optional broader item. Code and SKOS say concept (collection `concepts`). | concept (in UI text), tag, term |
| **Entity** | An item of an entity list: a label, a class (`foaf:Person`, …) and an optional "same as" address. | record |
| **Value** | One answer of one story for one field. Members say "answer". | tag, metadata |
| **Value body** | How a value is stored: one WADM `TextualBody` that is also an `rdf:Statement` (`rdf:subject` = the segment IRI, `rdf:predicate`, `rdf:object`). | tag pair |
| **Theme tokens** | The `--annoudio-*` CSS custom properties a project sets. | skin, branding |
| **Snippet** | The two lines an operator pastes into a site to put a widget there: the `/embed/v1.js` script and `<annoudio-player>`. | embed code |
| **Widget** | The `<annoudio-player>` custom element on the host site, as people see it: "the widget". Read side. The tag name stays `annoudio-player` (CONTRACT.md); the word people read is widget. In code, the module is still `player`. | player (in UI text), embed |
| **Preview page** | The admin page `/admin/preview/{project}/{recording}`: the real widget of one instance with live links, so an operator can walk the member's steps with no host site. The Annotate page always sends a member back to it. | test page |
| **Annotate page** | The first-party page on the organisation's domain where a member writes a story. Write side. | editor |
| **Invite code** | A code an operator makes on a project; a member signs in with email + invite code, with no mail. It proves that you hold the code, not that you own the email: such a member gets no mail until a login code checks the email. | access code, token |
| **Test member** | A member made while the browser holds an operator session (the operator trying the member flow from the preview page). Marked `test`, left out of counts, shown with a "Test" badge. | |
| **Sent again** | A returned story that its member sent for review again. A flag cleared on publish or return; the admin shows a badge. | resubmitted |
| **Login code** | The emailed one-time code a member uses to sign in. | magic link, OTP |
| **Container** (WADM) | A paged list of stories for one instance, served by the Web Annotation Protocol. Do not confuse with a Docker container; say "stack" for that. | |
| **Stack** | The Docker compose deployment: app, Postgres, worker. | container |

## Fixed decisions

Source: `research/architecture-concerns.md`, `.brainstorm/sessions/0001-*.md`, `ROADMAP.md`.

- Backend: Payload CMS 3 on Postgres. The admin GUI is Payload's, preconfigured. Operators never see code.
- Story storage: WADM JSON-LD in a `jsonb` column. Audio body type is `Sound`. Targets use `FragmentSelector` with `conformsTo: http://www.w3.org/TR/media-frags/`. `scope` = project IRI (stories only; a reply's target is the parent story IRI with no `scope`). Each value is one value body: `"type": ["TextualBody", "rdf:Statement"]` with `value` (the text a person reads), `purpose` (`tagging` for a list item, else `describing`), `rdf:subject` (the segment IRI `{recording IRI}#t={start},{end}`), `rdf:predicate` and `rdf:object` (full IRIs as `{ "id": … }`; a literal uses `@language`, never `language`). A reply has no values (`design/vocab.md` §3).
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
| `stories` | `createStories(config)` → `Stories`: `handleRead` (the Web Annotation Protocol read routes); member side `saveDraft`, `ownDrafts`, `ownStories`, `publishedStory`; operator side `publish`, `reject`, `remove`, `review`, `history`, `nextWaiting`, `exportStories`; counts `counts`, `valueCounts`, `fieldUsage`, `projectReach`, `recent`; linked data `exportQuads`; calls from other modules `mediaSettled`, `conceptChanged`, `forgetInstances`. Also `lifecycle(row)`, `storiesCollection`, `storyRepresentationsCollection`, `storyValuesCollection`. See `design/stories-interface.md`, `design/vocab.md` §9.3. | WADM shaping and validation, value bodies, jsonb storage, the derived `story-values` rows, paging, ETag, review state, lifecycle, the precomputed representations | Postgres (local-substitutable: test Postgres in Docker) |
| `projects` | `projectsCollection(deps)`, `bySlug`, `byId`, `allProjects`, `create` (step 2 of "Add a widget"), `addRecording`, `projectsOfRecording`, `addSiteOrigin` ("Add this website"), `returnTarget` (with `self`: the admin preview page), `pageOf`, `DARK_SET`, `theme`, `handleTheme`, `THEME_TOKENS`; admin form: name, slug, site origins (allow-list for the Annotate `return` URL), language, rights statement, review rule, theme tokens | theme JSON route, origin check, rights statements, the delete guard (a project with stories stays; its concepts go with it) | in-process; `deps` gives `stories.forgetInstances` and `vocabulary.removeVocabulary` |
| `vocabulary` | `createVocabulary(config)` → `Vocabulary`: `profile`, `choices`, `resolve`, `inputsOf`, `labels`, `item` (Annotate page, `stories`, theme JSON); `addField`, `updateField`, `moveField`, `removeField`, `searchTerms`, `ontologies`, `lists`, `addList`, `addItem` (operators); `importFile`, `exportFile`, `describe` (files). Collections `ontologies` (with `POST /api/ontologies/import`), `ontology-terms`, `vocab-fields`, `vocab-lists`, `concepts`; `CATALOGUE`, `VOCABULARY_LIMITS`, `BUNDLED`, `seedOntologies`, `writeQuads`; the SKOS free functions `concept`, `conceptsOf`, `exportSkos`, `importSkos`, `removeVocabulary` stay (see `design/vocab-build-notes.md`) | the bundled ontologies and their seed, IRI minting, field order and the field lock, list membership and hidden rules, own answers, the three date datatypes, the parsers (Turtle, JSON-LD, RDF/XML, SHACL, Omeka template), the prefix rule, SKOS and SHACL serialisation, the delete guards (an item, a field, an ontology in use stays) | in-process; `config.stories` gives `stories.valueCounts`, `stories.fieldUsage` and `stories.conceptChanged` |
| `catalogue` | `recordingsCollection(deps)`, `recording(id)`, `list`, `register` (step 1 of "Add a widget"), `firstRecording`, `snippet`, `checkAudioUrl`, `handleRecording` (`GET /embed/v1/recordings/{project}/{id}.json`, CONTRACT.md §5.2); admin: one audio address, duration read in the operator's browser, Snippet panel per project, Stories count | URL check, snippet text (from `CONTRACT.md`), the delete guard (a recording with stories stays) | in-process; `deps` gives `stories.counts` and `stories.forgetInstances` |
| `membership` | `createMembership(config)` → `requestCode(email, { ip })`, `verifyCode(email, code, nickname?)` → session cookie, `sessionFromRequest`, `signOut`, `contact`, `account`, `updateAccount`; the collections `members`, `member-sessions`, `login-codes` | code generation, expiry, rate limits (per email, per IP, per stack), the cookie session table | `mail` (in-process) |
| `mail` | port `Mailer` (adapters `smtpMailer`, `memoryMailer`); `mailerEmailAdapter` (Payload's own mail, M7, through the same `Mailer`); `addressOf`; `mails` (all text M1–M7 in one file); `createNotices` → `storyEvent` (turns `stories` events into mails) and `digest` (the daily operator mail) | SMTP, templates, opt-outs | SMTP (true external, through the port) |
| `media` | `createMedia(config)` → `handleUpload` (tus), `handleFile` (the served files), `body`, `startSettledConsumer`; lookups `body`, `mediaIdOf`, `removeBody`; `UPLOAD_LIMITS`, `PICKER_TYPES`, `mediaCollection` | tus storage, raw blob retention, the `media.transcode` queue, the `media.settled` consumer | pg-boss (internal seam to the worker); the worker (owned remote, through the `media.settled` contract) |
| `worker` (`worker/`) | `startWorker(options)`, `enqueueTranscode`, ports `Prober` (adapters `ffprobeProber`, `fakeProber`) and `Transcoder` (adapters `ffmpegTranscoder`, `fakeTranscoder`); `settledReporter`, `workSettled`, `SETTLED`; `scheduleDigest`, `workDigest`; `LIMITS` | ffprobe checks, transcoding, limits, retries and the dead letter queue | ffmpeg and ffprobe (true external, through the ports); Postgres (pg-boss) |
| `player` | `CONTRACT.md`: `<annoudio-player>` attributes, `--annoudio-*` tokens, `part` names, events, `seek()` | wavesurfer, fetch, shadow DOM, Annotate link, loader | the `stories` read routes and `GET /embed/v1/themes/{project}.json` (owned remote: tested against a fixture server) |
| `annotate-page` | URL `/annotate?project&recording&t&return` (and `&replyTo`), `/annotate/mine`, `/annotate/account` | login, range select, the questions of the project (`FieldControls`), upload UI | `membership`, `stories`, `media`, `vocabulary` |
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
