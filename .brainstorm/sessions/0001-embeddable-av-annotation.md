# 0001 — embeddable-av-annotation (partial)

## Starting aim (user)
Dockerized, embeddable annotation widget. Admin GUI: project spaces -> many instances (one instance = one use of the embed).
Project space configures vocabularies/ontology, theme, annotation types. Targets audio, video, image. Open web standards.
Embed has an "Annotate" button -> user logs in -> annotation UI (in situ or separate page). Asked: what parts are weak?

## Agent critique (proposals, not user selections)
1. Hinge: "takes the user's login" — whose identity? Host-site user (signed token from host, like Hypothesis publisher accounts / Disqus SSO), own accounts, or anonymous. Third-party cookies in iframes are blocked by Safari/Firefox -> popup/separate page is a feature, not a fallback.
2. "Their own audio": waveforms need CORS on host media; URL changes orphan annotations (media identity problem).
3. "Audio, video and image as annotations" is ambiguous: media as target vs media as annotation body. Each target type needs a different selector UI. Suggest audio first.
4. "Instance" undefined: page? media file? embed snippet? Ontology change after annotations exist -> needs term versioning.
5. "Ontology GUI" is a product in itself; probably need SKOS-style controlled vocabularies + field schema.
6. "Open web standards" unnamed: W3C Web Annotation, Media Fragments, SKOS, OIDC, IIIF AV. Prior art: Label Studio, Annotorious, Hypothesis, peaks.js, IIIF AV tools. Differentiation not stated.
7. Missing: who annotates and why; read side (do visitors see annotations?), moderation, export.
8. Tension: dockerized self-host vs one multi-tenant service for many sites.

## User reactions (turn 2)
- Login: separate page.
- Target: host passes a media URL in the embed; it is the annotation target. Waveform optional; plain time-based OK.
- Media type: media is the annotation BODY (audio/video/image notes) targeted on audio.
- Instance = one embed snippet. Proposed hierarchy: space > project > page > instance (space = one site).
- Vocabularies: SKOS-like with customizable labels. Standards: WADM + Media Fragments.
- Visitors see annotations; review in backend; export unknown.
- One container per organisation, serving many sites.
- Use case: DH org hosting many showcase sites + services for other orgs; annotators = community members (own logins) and site maintainers; viewers = community, friends, visitors. Participatory.

## Agent move (turn 2)
- Weakness #2 shrinks: org hosts the audio -> controls URLs, CORS, can precompute peaks server-side (e.g. BBC audiowaveform).
- New hinge: hierarchy mixes two jobs — config inheritance vs where annotations live. Same audio on two pages: shared or separate?
  Options: (A) annotations belong to media, page = WADM `scope` (context only); (B) belong to instance; (C) belong to media, project decides visibility.
- Suggest: config only at space+project; page/instance auto-registered when embed first loads.
- Parked: pre- vs post-moderation; consent/rights for contributed voice recordings; export format; one account across all spaces?

## User selection (turn 3)
- Chose C: annotations belong to the recording and follow it everywhere; each project chooses what it shows.

## Agent move (turn 3)
- Consequence: a travelling story needs a "passport" — data that must travel with it:
  1. Terms: tags from project A's vocabulary appear in project B. Store terms as IRIs + labels; B shows, maps, or hides foreign terms.
  2. Review: approval is per project (A approved != B approved), so review state is a project->annotation record, not a field on the annotation.
  3. Consent: contributor chooses where the story may travel (this project / our org's sites / anywhere). Project filter can narrow, never widen.
- Note: consent ceiling + project filter = visibility is the intersection.

## Next open question
Who decides where a story may travel: the contributor, the project, or both?

## Agent re-read (turn 4, model changed; user asked for disagreements/additions)
Disagree:
- C vs one-container-per-org: stories only travel inside one store. Partner sites must embed from the DH org's container, or stories stop at org boundary. Needs stating.
- Hierarchy too deep: propose project (config) > recording (annotation home, cross-project) > embed (auto-registered). Site = field on project.
- Consent: default answer instead of question — contributor chooses at save; project sets form default; contributor's choice is the ceiling.
Add:
- Recording must be a first-class entity with a catalogue (one recording, many URLs); embed passes a recording ID.
- Embed should BE the player (custom element), not attach to a host player.
- Media bodies need text (transcript) for search/accessibility/review; upload pipeline + moderation.
- Export = WADM JSON-LD + Web Annotation Protocol collection endpoint.
- Simplify first build: per-project review + consent; foreign tags as labels; SKOS mapping later.

## Turn 5: user asks "what if I choose B"
Agent: B removes passport, container contradiction, catalogue. Costs: disconnected stories per embed (depends on how often a recording is reused); fragile instance identity across redesign/CMS migration (needs "continue old instance" admin tool).
Proposal: build B, store as C — WADM target = recording URL + media fragment, scope = instance; policy fixed to "own only". Keeps C open.
Open: how sites are built (CMS plugin can hold the instance ID stable; static sites cannot).

## Turn 6: re-read the 7 points under B
1 container contradiction gone; 2 hierarchy = project > instance (recording = target field, not a level); 3 consent dissolves to rights/licence line, keep `rights` field; 4 catalogue optional but snippet carries stable recording ID + URL; 5 embed-is-player unchanged, more important (ID lives in snippet); 6 text with voice notes unchanged; 7 export unchanged, query-by-target gives cross-site report.
B adds: instance continuity tool in admin.

## Turn 7: sites = WordPress, Omeka S, some static
Agent: CMS gives stable media IDs (WP attachment ID, Omeka S media o:id); plugins write the snippet. Proposal: derive instance = (project, recording) so re-embeds keep stories, no continuity tool. Optional explicit `instance` attr for the exception (two conversations on one recording in one project).
Open: does one-conversation-per-recording-per-project fit?

## Landed direction (turn 8, user confirmed one conversation per recording per project)
Idea: one container per org; admin defines projects (SKOS-like vocab w/ custom labels, theme, review rules, rights line); embed = custom element player `<annoudio-player project recording src>`; WP block + Omeka S module write snippet from CMS media ID; static sites by hand; instance = (project, recording); visitors see reviewed stories; Annotate -> separate page on container; bodies: text/voice/image/video; storage WADM (target=recording+#t, scope=project, rights); Web Annotation Protocol = API = export.
Why it fits: org hosts audio; CMSs give stable IDs; stories stay with site; partner orgs independent; C stays possible by query.
Biggest tension: community login identity — one account across sites vs per site; OIDC in container adds friction.
Parked: C/passport (storage keeps open); waveform (precompute); voice-note pipeline (no blocking decision); video/image as targets (out of scope).
Next exploration: hand-write one WADM record (voice body, #t target, scope, rights, SKOS tag), load into Elucidate, fetch via collection endpoint.
Status: landed.

## Turn 9 (user): OIDC IdP in container; many hand-built sites, not only CMS
Agent: login — container accounts + magic link first; OIDC provider role only when sites want SSO; use Authentik/Keycloak or a library.
Hand-built sites as main path -> recording catalogue returns: Recordings list in admin (title, URLs, ID), snippet copied from there; CMS plugins register via API; CMS media IDs are fields not keys.
Model: project (config) > recording (org-wide catalogue) > instance = (project, recording).
Watch: Annotate redirect to another domain must return to the same second and keep the session.

## Turn 10: architectural concerns -> research launched
Concerns: (1) WADM fit + protocol server reuse vs JSONB; (2) cross-origin embed, session detection without 3rd-party cookies; (3) MediaRecorder formats, transcoding; (4) prior art (Omeka S Annotate, Clover/Mirador AV, peaks.js etc.) — could shrink read side; (5) IdP sidecar vs magic-link first; (6) SKOS editor vs flat list.
Findings file: research/architecture-concerns.md (background agent).

## Turn 11: pipeline + off-the-shelf
Pipeline A ingest / B deliver / C write / D review / E read / F export.
New concerns: B — hand-pasted snippets cannot be updated: pin /v1/embed.js, attributes = public contract (most irreversible decision). C — body upload is the only heavy processing; keep service count low (Postgres queue, disk media).
Pieces: ffprobe, audiowaveform, Lit, peaks.js/wavesurfer, Uppy+tus, ffmpeg, whisper, jsonld/pyld, JSONB, Caddy, rdflib.
Hinge: admin GUI origin — headless CMS (Directus/Payload) vs framework w/ generated admin (Django). Agent leans Django: WADM shape as schema, 2 services. Depends on user's stack.
Open: stack choice; extend research to upload chain, headless-CMS option, snippet versioning.

## Turn 12 (user): HARD CONSTRAINT — maintained by a largely non-technical team, GUI preferred for everything
Research extended: apply constraint to Q1/Q5/Q6; add Q7 admin-GUI-first backends (Directus/Payload/Strapi vs Django), Q8 upload chain + Postgres queues, Q9 snippet versioning prior art, Q10 GUI ops (Portainer/Coolify/Dokploy/Komodo).

## Turn 13: research reported (research/architecture-concerns.md, 2026-10-09)
Verdicts: WADM fits (audio body = `Sound`; FragmentSelector+conformsTo; SKOS tag = two-body array); no reusable WAP server with admin UI -> JSON-LD in Postgres jsonb, ~8 protocol routes in-app. Embed cannot see container session -> anonymous reads, first-party write page. Voice notes: ffmpeg -> m4a, keep raw. Read side: wavesurfer.js regions in custom element; Omeka Annotate module is backend-only, xywh documented not t=. IdP: none in v1, login-by-code in app, Rauthy later. SKOS: tree in admin + export/import, no embeddable editor. Backend: Payload CMS + Postgres (2 services); Directus now MSCL, no magic link; Strapi review = enterprise. Uploads: Uppy+tus, pg-boss, no Redis/ClamAV v1; whisper optional (~1.5 GB RAM). Snippet: /embed/v1.js loader + <annoudio-player>, attributes/tokens/parts = contract. Ops: Dokploy (pre-1.0) or Coolify.
Shift from turn 11: admin hinge resolved toward Payload (GUI constraint), not Django.
Unverified list in file (Opus-in-MP4, Omeka t= round-trip, Rauthy magic link, Dokploy GUI self-update, Directus free-tier limits...).

## Turn 14 (user): "a preconfigured Payload or Directus should be fine" -> agent recommends Payload (MIT, auth collections w/ login code; Directus MSCL + no magic link).
## FINAL landed shape
Stack per org: Payload + Postgres, ffmpeg worker, pg-boss; Dokploy/Coolify deploy.
Admin preconfigured: projects (vocab tree + SKOS export, theme tokens, review rules), recording catalogue + snippet generator, review = draft/published, community users.
Embed: /embed/v1.js + <annoudio-player recording>, wavesurfer.js; anonymous reads; Annotate = first-party page, code-by-email login, return to same second.
Data: WADM in jsonb; Sound/Image/Video bodies on #t= targets; scope = project; WAP routes in-app = export.
Parked: cross-project sharing, Rauthy SSO, transcription, ClamAV, waveform precompute.
Open tension: Payload admin usability for non-technical team.
Next step: Payload Docker example, 3 collections, one colleague approves an annotation + adds a term unaided.
Status: landed (complete).

## Turn 15: Payload confirmed; ROADMAP.md written (phases 0-7, done-when tests, parked list).

## Turn 16 (user): no testers until a working product. Roadmap revised: human tests moved to Phase 7 team trial; Phases 0-6 use Playwright/API tests + developer walkthroughs; Phase 0 shrunk to 2 days.

## Turn (build phase): user suggested reply threads. Added as ROADMAP Phase 5b: reply = WADM annotation targeting a story IRI, motivation replying; no schema change.
