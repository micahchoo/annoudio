# Annoudio roadmap

Status: 2026-10-09. Phases 0 to 6 and the CMS plugins of Phase 7 are built. The team trial and the pilot (Phase 7) need people: they are not started. Each phase below has a status line. Source decisions: `.brainstorm/sessions/0001-embeddable-av-annotation.md`, `research/architecture-concerns.md`.

Each phase has one goal, one deliverable, and a "done when" test that one developer can run alone. No other people are available until the product works, so the team trial is one phase at the end (Phase 7). Phases retire the biggest technical risk first. Do not start a phase before the previous "done when" passes.

## Phase 0 — Look at the admin (2 days)

Status: Built 2026-10-09 (see design/phase0-operator-walkthrough.md).

Goal: see Payload's admin with the real collections before building on it.

Deliverable: Payload's Docker example with three preconfigured collections: `projects`, `recordings`, `stories` (draft/published enabled). No custom UI.

Done when: the developer walks through approve-a-draft, add-a-term, register-a-recording and writes down each step that needs a developer's knowledge. That list is the first input to Phase 5.

Risk reduced, not retired: usability is judged by the team only in Phase 7. To keep a late switch cheap, the schema is the WADM record and the protocol API (Phase 1), not Payload's own shapes; the admin is a front end over them.

## Phase 1 — Fix the two contracts (2 weeks)

Status: Built 2026-10-09 (see design/phase1-notes.md and CONTRACT.md).

Goal: pin the two things that cannot change later: the annotation record and the embed snippet.

Deliverables:
1. One hand-written WADM JSON-LD record (voice-note `Sound` body, `#t=` target with `FragmentSelector`, `scope` = project, `rights`, two-body SKOS tag) stored in Payload's `stories` collection and served byte-equal by the protocol routes (compare parsed JSON for the stored `wadm` field: `jsonb` reorders keys).
2. The Web Annotation Protocol routes: container per (project, recording), paging, `ETag`, CORS read for any origin.
3. `CONTRACT.md`: the snippet `<script async src="/embed/v1.js">` + `<annoudio-player project recording src>`, the attribute list, the `--annoudio-*` CSS tokens, the `part` names. Versioning rule: breaking change = `v2.js`.

Done when: an automated test saves the record and reads the served representation back byte-equal through the protocol routes, and the snippet in `CONTRACT.md` is pasted into a bare HTML file and loads with no console errors.

Risk retired: schema and snippet lock-in.

## Phase 2 — Read side (3 weeks)

Status: Built 2026-10-09 (see design/phase2-notes.md). "Safari" in the done-when test is Playwright's WebKit; real Safari is in design/UNVERIFIED.md.

Goal: a visitor on any site sees published annotations on a player.

Deliverable: `/embed/v1.js` loader that fetches a hashed bundle; `<annoudio-player>` custom element on wavesurfer.js regions; shadow DOM; themed by tokens from the project; fetches the protocol container anonymously; "Annotate" link to the container with return URL + current time.

Done when: the element works on one static page, one local WordPress and one local Omeka S (Docker images), pasted by hand, in Chrome, Firefox and Safari (WebKit via Playwright), with no CSS leaking either way, checked by a Playwright test.

Risk retired: cross-origin and CSS isolation.

## Phase 3 — Write side with text only (3 weeks)

Status: Built 2026-10-09 (see design/phase3-notes.md and design/phase3b-notes.md).

Goal: a community member can add a text story at a time range.

Deliverables: a `members` collection with login by emailed code (not a Payload auth collection: a member is never `req.user`; the session is a cookie and a session table); the Annotate page on the container (player + range select + text + tag picker from the project vocabulary); save as draft; redirect back to the host page at the same second; review in the admin (draft → published); the player shows the new story.

Done when: a Playwright test logs in as a member from the static page, adds a story, publishes it as an admin, and sees it on the static page without a rebuild.

Risk retired: login flow across domains; review workflow in a preconfigured admin.

## Phase 4 — Media bodies (3 weeks)

Status: Built 2026-10-09 (see design/phase4a-notes.md and design/phase4b-notes.md). The done-when test with a real Safari recording is not done: see design/UNVERIFIED.md.

Goal: voice notes, images and short video as story bodies.

Deliverables: Uppy + tus upload on the Annotate page (the tus server runs in the app, `@tus/server`); MediaRecorder capture for voice; a separate worker container (pg-boss) that runs ffmpeg to `.m4a` (raw blob kept) and reports to the app with the pg-boss job `media.settled`; size limits; `ffprobe` validation in the worker; a required short text with every media body; media bodies play in the player.

Done when: a voice note recorded in Safari plays in Chrome and Firefox, and vice versa, after review.

Risk retired: the only heavy processing path. Transcription and ClamAV stay parked.

## Phase 5 — Vocabulary and catalogue tools (2 weeks)

Status: Built 2026-10-09 (see design/phase5-notes.md).

Goal: the admin covers every daily task without a developer.

Deliverables: vocabulary tree editor in the admin with stable IRIs, SKOS Turtle/JSON-LD export and import; recording catalogue with a duration probe (it runs in the operator's browser: the app image has no ffprobe) and a copy-ready snippet per recording (an operator pastes an audio address; there is no upload of recordings); theme tokens editable per project with a live preview; per-project review defaults.

Done when: the developer sets up a new project and recording through the GUI only, with the Phase 0 list of developer-only steps reduced to zero.

## Phase 5b — Reply threads (1 week)

Status: Built 2026-10-09 (see design/phase5b-notes.md).

Goal: a member can answer a story, and visitors read the thread under it.

Deliverables: a reply is a story whose target is another story's IRI (WADM `motivation: replying`; no new table, no schema change); `saveDraft` accepts `replyTo: StoryId` in place of a time range; the container serves replies inside the parent story's page entry (one request, no extra round trip); review state per reply; the player shows a thread under the open story with a "Reply" link to the Annotate page (`/annotate?…&replyTo=<id>`); the admin review list shows "reply to …".

Done when: a Playwright test posts a reply from the Annotate page, an operator publishes it through the interface, and the player shows it under its parent.

Risk retired: the data model's first non-time target. Parked until here on purpose: the thread UI is the only part that is not already in the standard.

## Phase 5c — Information architecture, then lifecycle UX (3 weeks)

Status: Built 2026-10-09 (see design/ia.md and design/phase5c-notes.md; screenshots in design/phase5c-screens/).

Step 1 (design, 1 week): three IA proposals (task-centred, object-centred, journey-centred) in design/ia-{A,B,C}.md; comparison and choice in design/ia.md: roles and jobs, object model as the person sees it, navigation, screen inventory with every state, cross-surface flows (snippet → site → Annotate → review → player), naming, text wireframes, Payload admin feasibility. No screen is built before design/ia.md exists.

Step 2 (build, 2 weeks). Goal: every step a person meets, from the first operator sign-in to a visitor reading a thread, is complete: guidance, empty states, confirmations, errors, success, mail copy, mobile layout, accessibility.

Deliverables: operator onboarding and empty states with the next action; admin branding and login screen; publish confirmation with a visitor preview; readable version history; operator mail (password reset) through a real email adapter; the Annotate page as a complete phone flow (arrive, sign in, nickname, write, record, processing, waiting, returned, success, back to the site); player empty/loading/error states; all mail copy reviewed; one STE pass over every string file; keyboard and screen-reader pass (`better-interface` skill as the checklist).

Done when: a Playwright walkthrough of the whole lifecycle passes with axe checks on every screen, and the screenshot set of every state is in design/phase5c-screens/.

## Phase 6 — Packaging and operations (2 weeks)

Status: Built 2026-10-09 (see design/phase6-notes.md and design/phase6b-notes.md). A fresh stack and the backup restore were tested on this machine; an upgrade from one release to the next was not run (there is one release). The done-when test on a clean VPS with Dokploy: Owner: not started.

Goal: a partner organisation can run its own copy.

Deliverables: `docker-compose.yml` (Payload, Postgres, worker); Dokploy deployment guide with S3 backups and GUI restore; Coolify as the documented alternative; upgrade procedure a non-technical person can follow; a seed with the preconfigured collections.

Done when: the developer deploys a fresh copy on a clean VPS by following the guide literally, restores a backup, and upgrades one version. Every step that needed a terminal is written into the guide as a Dokploy GUI step or flagged as a gap.

## Phase 7 — Team trial, CMS plugins and pilot (4 weeks)

Status: deliverable 1 (team trial): Owner: not started. Deliverable 2 (CMS plugins): Built 2026-10-09 (see design/phase7a-notes.md and design/phase7b-notes.md). Deliverable 3 (pilot): Owner: not started.

Goal: the first contact with real people, all at once, on a working product.

Deliverables:
1. Team trial on a staging copy: each team member, unaided, approves a story, adds a term, registers a recording and embeds it on a test page. Record every point of confusion; fix the admin before the pilot. This is where the Payload decision is finally judged.
2. WordPress block and Omeka S module that write the snippet from a recording ID. The operator adds the recording in the admin ("Add a player"); the plugin reads its audio address from `GET /embed/v1/recordings/{project}/{id}.json` (CONTRACT.md §5.2). The plugins do not register recordings: decision in design/phase7a-notes.md §2.
3. Pilot on one real site with real community members; a feedback round; fixes.

Done when: the pilot site has published stories from people outside the team, and the review queue has been handled by the team only.

## After completion (parked, in order of pull)

1. Cross-project sharing (choice C): the storage already keys on recording; add a view policy per project.
2. Rauthy as SSO sidecar when sites want to sign in with the community account.
3. Transcription (faster-whisper, ~1.5 GB RAM) as a per-organisation toggle.
4. Waveform precompute (`audiowaveform`) for long recordings.
5. ClamAV on uploads.

## Timeline

About 22 weeks of focused work for one developer, ~5 months. All human feedback arrives in Phase 7, so Phases 0-6 lean on automated tests (Playwright for the embed and the write flow, API tests for the protocol) and on the developer walking the GUI as the operator would.

## Decisions needed before Phase 1

Status: still open. The owner decides both before the pilot.

- The container's public domain (the snippet URL is part of the contract).
- Which site is the pilot, and who on the team runs the review queue.
