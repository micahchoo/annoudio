# Annoudio: architecture concerns

Date of research: 2026-10-09. All claims cite the page that owns them. Dates are "last commit / last release" as shown by the GitHub API on that day.

## What this answers

Annoudio is an embeddable audio annotation widget: one Docker container per organisation, annotations stored as W3C Web Annotations, a custom-element player dropped into hand-built sites, WordPress and Omeka S, community accounts inside the container, and annotation bodies that can be text, browser-recorded voice notes, images or video.

Hard constraint (added during research): a largely non-technical team runs the system day to day and wants a GUI for everything (projects, vocabularies, recording catalogue, review queue, theming, user management, and ideally updates and deploys). Every verdict below applies that constraint.

The ten sections answer: (1) does the W3C model fit and can a server be reused; (2) what a cross-origin embed can and cannot do in 2026; (3) what browsers record and play; (4) what prior art exists; (5) which identity provider, if any; (6) how to edit SKOS vocabularies; (7) which admin-GUI backend; (8) the upload and processing chain; (9) how to version the embed snippet; (10) GUI tools to deploy and update the stack.

Terms used throughout:

- **WADM**: W3C Web Annotation Data Model. A JSON-LD format for "this body says something about this target".
- **Media Fragment**: a URL suffix such as `#t=30,60` that names a time range in audio or video.
- **IRI**: an internationalised URL. WADM uses IRIs as identifiers.
- **SKOS**: a W3C vocabulary for controlled term lists (concepts with labels, broader and narrower links).
- **OIDC**: OpenID Connect, the standard login hand-off between an app and an identity provider.

---

## 1. WADM fit and server reuse

### Finding

WADM covers every structure Annoudio needs. An audio, image or video body is an "External Web Resource" with an `id`, a `format` (media type) and a `type`. The type for audio is `Sound`, not `Audio`. A time range on an audio target is a `SpecificResource` whose `selector` is a `FragmentSelector` with `conformsTo` set to the Media Fragments URL and `value` such as `t=30,60`. `scope` records the page the user was on. `rights` is an IRI that can sit on the annotation, the body or the target. A tag is a `TextualBody` with `purpose: tagging`; a tag that points at a SKOS concept is a `SpecificResource` body with `purpose: tagging` and `source` set to the concept IRI; the two can sit side by side in one `body` array. The Web Annotation Protocol asks a server for a small set of HTTP behaviours (GET/HEAD/OPTIONS on annotations and containers, POST to create, PUT and DELETE, ETags, Link headers, LDP containers with paging). No existing open-source server is both maintained and fitted with an admin GUI.

### Evidence

- External Web Resources: `id` MUST be exactly 1; `format` SHOULD be the media type; `language` optional. https://www.w3.org/TR/annotation-model/#external-web-resources (REC 2017-02-23)
- Classes: the listed `type` values are `Dataset`, `Image`, `Video`, `Sound`, `Text`. "Sound: the class for a resource primarily intended to be heard." https://www.w3.org/TR/annotation-model/#classes
- Segments: an IRI with a fragment MAY be used directly, but "annotation systems may not discover annotations with fragment components when searching by means of the IRI without the fragment". The spec RECOMMENDS `FragmentSelector` instead. https://www.w3.org/TR/annotation-model/#segments-of-external-resources
- Fragment Selector: `type` MUST be `FragmentSelector`; `value` MUST be exactly 1; `conformsTo` SHOULD be exactly 1. The table lists Media = `http://www.w3.org/TR/media-frags/`. The example body uses `"selector": {"type":"FragmentSelector","conformsTo":"http://www.w3.org/TR/media-frags/","value":"t=30,60"}`. https://www.w3.org/TR/annotation-model/#fragment-selector
- Specific Resource: `source` MUST be exactly 1; same classes for body and target. https://www.w3.org/TR/annotation-model/#specific-resources
- Purpose on an external resource: the "Qitara" example tags a photo with a city IRI: `"body": {"type":"SpecificResource","purpose":"tagging","source":"http://example.org/city1"}`. https://www.w3.org/TR/annotation-model/#purpose-for-external-web-resources
- Motivation and purpose: `purpose` MAY be 0 or more on a `TextualBody`; the example has two bodies in one array, one with `"purpose":"tagging"`. https://www.w3.org/TR/annotation-model/#motivation-and-purpose
- Rights: "There MAY be at exactly 0 or more `rights` statements ... and the value MUST be an IRI." Example sets `rights` on the annotation and on the body. https://www.w3.org/TR/annotation-model/#rights-information
- Scope: "There MAY be 0 or more `scope` relationships for each Specific Resource." https://www.w3.org/TR/annotation-model/#scope-of-a-resource
- Body cardinality: "The `body` and/or `target` relationships of the Annotation may be arrays rather than a single object." https://www.w3.org/TR/annotation-model/#cardinality-of-bodies-and-targets
- Appendix A (selector/media-type table) lists `Video (video/*)` with Fragment = ✔ but has no audio row. https://www.w3.org/TR/annotation-model/#correspondence-among-media-types-and-selectors
- Media Fragments time syntax: `t=10,20` is the interval [10,20); `t=,20` is [0,20); `t=10` is [10,end). Default format is Normal Play Time (`npt`). `npt-sec = 1*DIGIT ["." *DIGIT]`; `hh:mm:ss` form needs minutes and seconds as exactly two digits. https://www.w3.org/TR/media-frags/#naming-time (REC 2012-09-25)
- Protocol, annotation IRI: server MUST support GET, HEAD, OPTIONS; MUST return JSON-LD with `application/ld+json`; MUST send `Link: <http://www.w3.org/ns/ldp#Resource>; rel="type"`, an `ETag`, an `Allow` header. https://www.w3.org/TR/annotation-protocol/#annotation-retrieval (REC 2017-02-23)
- Protocol, containers: server MUST provide one or more Annotation Containers; containers SHOULD be LDP Basic Containers; container IRI path MUST end in `/`; MUST support GET, HEAD, OPTIONS; MUST return `Link` headers for the container type and `ldp#constrainedBy`; if there are annotations the representation MUST link `first` or embed the first page; SHOULD include `total` and `modified`; `Prefer` header controls IRIs vs full descriptions. https://www.w3.org/TR/annotation-protocol/#annotation-containers
- Protocol, pages: an `AnnotationPage` MUST have an IRI, MUST link `next` if not last, MUST link `partOf`. https://www.w3.org/TR/annotation-protocol/#annotation-pages
- Protocol, writes: POST to a container, server MUST assign the `id`, MUST respond 201 with `Location`; `Slug` MAY suggest a path; PUT replaces (SHOULD support) with `If-Match`; DELETE returns 204. https://www.w3.org/TR/annotation-protocol/#creation-updating-and-deletion-of-annotations
- Elucidate (dlcs/elucidate-server): MIT, Java, "PostgreSQL 9.4+ (the `jsonb` type is required)", JWT auth. Last commit 2021-12-20; last release 1.5.1 on 2018-10-15; 24 open issues. No admin UI in README. https://github.com/dlcs/elucidate-server
- SimpleAnnotationServer (glenrobson): Apache-2.0, Java, IIIF/Mirador annotation lists. "This project doesn't currently contain Authentication"; "Web annotations" is on the roadmap, not done. Last commit 2025-02-05; last release 1.0.2 on 2020-09-15. https://github.com/glenrobson/SimpleAnnotationServer
- miiify (nationalarchives): MIT, "Store annotations in Git, serve them from an optimized read-only store"; IDs are injected at serve time; the write path is `miiify-import` then `miiify-compile`, both CLI. Last commit 2026-04-30; no GitHub releases; image `ghcr.io/nationalarchives/miiify:latest` is 100 MB compressed. https://github.com/nationalarchives/miiify
- Hypothesis h: BSD-2-Clause, pushed 2026-09-28, 226 open issues; GitHub releases stopped at v0.39.0 (2019-11-05). Its API schema (`docs/_extra/api-reference/hypothesis-v1.yaml`) describes `TextQuoteSelector`, `RangeSelector`, `TextPositionSelector` and contains no reference to `anno.jsonld`, JSON-LD or the W3C model. It is a text-page annotator with its own JSON. https://github.com/hypothesis/h
- Omeka S module Annotate also exposes a protocol endpoint (see section 4).

### Verdict for Annoudio

Store annotations as WADM JSON-LD in Postgres `jsonb` and implement the protocol endpoints yourself (about eight routes; the MUSTs above are the whole checklist). Use `type: Sound` on audio bodies, `FragmentSelector` + `conformsTo` media-frags for time targets, and a two-body array (`SpecificResource` with `source` concept IRI + `TextualBody` with the label) for SKOS tags. Main risk: none of the reusable servers has an admin GUI, so a non-technical team would gain nothing from reuse and would lose the ability to see and moderate annotations in the same GUI as the recordings; Elucidate is dormant, SAS has no auth and no W3C support, miiify is CLI-driven, Hypothesis is a different data model.

---

## 2. Cross-origin embed in 2026

### Finding

Theming through shadow DOM works today on all engines: CSS custom properties (`--name`) inherit from the host element into the shadow tree, `::part()` lets the host page style named inner elements, and `adoptedStyleSheets` lets one stylesheet serve many component instances. A script on a third-party page cannot read the container's session: Safari blocks all third-party cookies, Firefox partitions them per site, and Chrome keeps them on by default but has no plan to let embeds rely on them; the Storage Access API needs an iframe, a user gesture and in most browsers a prompt. CHIPS (partitioned cookies) is now in all three engines but only gives a cookie jar scoped to the embedding site, not the container's first-party session. The honest pattern is: anonymous reads via a public CORS API, writes only on a first-party page on the container's domain, with an optional short-lived token passed back on redirect.

### Evidence

- Custom property inheritance: "A custom property defined using two dashes `--` instead of `@property` always inherits the value of its parent." https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
- Across the shadow boundary: CSS Shadow Module §5.1 motivates custom properties with the outer page setting them on the host "letting inheritance push the values down to where they were needed"; §4.2 "Property inheritance can carry values from one tree to another." https://drafts.csswg.org/css-shadow-1/#inheritance (Editor's Draft)
- Encapsulation: "The page CSS does not affect nodes inside the shadow DOM." https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
- `::part()`: "The global `part` attribute makes a shadow tree element visible to its parent DOM"; nested shadow trees need `exportparts`; Baseline "Widely available ... since July 2020". https://developer.mozilla.org/en-US/docs/Web/CSS/::part
- `adoptedStyleSheets`: "Rules defined in the `CSSStyleSheet` will be scoped to the shadow DOM tree, as well as any other DOM trees to which we have assigned it." https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM — Support: Chrome 73, Firefox 101, Safari 16.4. https://github.com/mdn/browser-compat-data/blob/main/api/ShadowRoot.json
- Third-party cookies per browser: "Google Chrome doesn't block third-party cookies by default, only in Incognito mode"; "Firefox enables Total Cookie Protection if Enhanced Tracking Protection is enabled, as it is by default"; Safari "allowing access to third-party cookies per frame can only be done at the code level, via the Storage Access API". https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies
- Safari ITP: "ITP by default blocks all third-party cookies. There are no exceptions to this blocking." "Third-party cookie access can only be granted through the Storage Access API." "Third-party LocalStorage and IndexedDB are partitioned per first-party website and also made ephemeral." https://webkit.org/tracking-prevention/
- Firefox Total Cookie Protection default for all desktop users: announced 2022-06-14, "confining cookies to the site where they were created". https://blog.mozilla.org/en/products/firefox/firefox-rolls-out-total-cookie-protection-by-default-to-all-users-worldwide/
- Chrome, 2025-04-22: "we've made the decision to maintain our current approach to offering users third-party cookie choice in Chrome" and "will not be rolling out a new standalone prompt for third-party cookies." https://privacysandbox.google.com/blog/privacy-sandbox-next-steps
- Chrome, 2025-10-17: most Privacy Sandbox APIs retired (Topics, Protected Audience, Attribution Reporting, Related Website Sets, IP Protection and others); "We'll continue to support those APIs [CHIPS and FedCM] and evaluate opportunities for future enhancements"; "Chrome will maintain our current approach to offering users third-party cookie choice in Chrome." https://privacysandbox.google.com/blog/update-on-plans-for-privacy-sandbox-technologies
- Storage Access API: for "cross-site content loaded in a third-party context (i.e., embedded in an `<iframe>`)"; "The permission request must be associated with a user gesture (transient activation)"; "Chrome shows prompts for all embedded content that has not previously received storage access"; "Safari shows prompts for all embedded content that has not previously received storage access"; Firefox denies if the user has not interacted with the embedded origin as first party within 30 days. https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API — Support for `requestStorageAccess`: Chrome 119, Firefox 65, Safari 11.1. https://github.com/mdn/browser-compat-data/blob/main/api/Document.json
- CHIPS: "Cookies marked `Partitioned` are double-keyed: by the origin that sets them and the origin of the top-level page"; "Partitioned cookies must be set with `Secure`"; "Baseline 2025 ... Since December 2025, this feature works across the latest devices and browser versions." https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies — Support for the `Partitioned` attribute: Chrome 114, Firefox 141, Safari 26.2 (shipped in 18.4, removed in 18.5, re-shipped in 26.2). https://github.com/mdn/browser-compat-data/blob/main/http/headers/Set-Cookie.json

### Verdict for Annoudio

Ship the player as a custom element with an open shadow root, expose theme tokens as `--annoudio-*` custom properties and named `part`s, and share one `adoptedStyleSheets` sheet across instances. Do not try to detect a container session from the embed. Read annotations anonymously through a public CORS endpoint. The "Annotate" action opens a first-party page on the container's domain; after login, redirect back with a short-lived, single-use token in the URL fragment if the embed needs to show "signed in as". Main risk: a product owner expects "comment inline on the host page"; that needs an iframe plus Storage Access prompts on Safari and Chrome, which is a worse user experience than the redirect.

---

## 3. MediaRecorder in 2026

### Finding

Each engine records a different default. Chrome picks `audio/webm;codecs=opus`. Firefox picks `audio/ogg;codecs=opus`. Safari picks `audio/mp4` (AAC) and, since Safari 18.4, can also write `audio/webm` with Opus if asked. `MediaRecorder.isTypeSupported()` is available in all three since April 2021. For playback, Opus-in-WebM plays everywhere on current versions, but Safari only added Ogg Opus in 18.4 (macOS 15.4, iOS 18.4) and had partial WebM Opus before 17.4, and Chrome lacks AAC in Chromium builds. So a server-side transcode to one format is still required if the org's visitors use older Safari or iOS. The safest single playback format today is AAC in MP4 (`.m4a`); the smallest is Opus in WebM.

### Evidence

- `isTypeSupported`: "returns a Boolean which is `true` if the MIME media type specified is one the user agent should be able to successfully record"; Baseline "available across browsers since April 2021". https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static — MediaRecorder support: Chrome 47, Firefox 25, Safari 14.1. https://github.com/mdn/browser-compat-data/blob/main/api/MediaRecorder.json
- MDN gives no per-browser default: `mimeType` is "chosen by the browser" when not specified. https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType — The defaults below come from the browsers' source code.
- Chrome default: in `media_recorder_handler.cc`, for audio-only streams the actual MIME type is built as `"audio/webm"` + `";codecs="` + `"opus"`. Chrome's accepted audio codecs are `opus` and `pcm`. https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/mediarecorder/media_recorder_handler.cc (main, 2026-10)
- Firefox default: `SelectMimeType()` in `dom/media/MediaRecorder.cpp` sets the container to `AUDIO_OGG` for audio-only and `VIDEO_WEBM` when video is present, with codecs `opus` and `"vp8, opus"`. https://hg.mozilla.org/mozilla-central/file/tip/dom/media/MediaRecorder.cpp (tip, 2026-10)
- Safari default: `MediaRecorderPrivateAVFImpl.cpp` sets `options.mimeType = videoTrack ? "video/mp4" : "audio/mp4"` when empty; `isTypeSupported` accepts `audio/mp4` with `mp4a` (and `opus` when `HAVE(AVASSETWRITER_WITH_OPUS_SUPPORTED)`), and `audio/webm` with `opus`. https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/mediarecorder/MediaRecorderPrivateAVFImpl.cpp
- Safari 14.1 added MediaRecorder: "record audio and video, then encode them using the platform's available set of default encodings". https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/
- Safari 18.4: MediaRecorder "now supports creating WebM files using the Opus audio codec and either VP8 or VP9"; "adding Ogg container support for both Opus and Vorbis audio". https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- Opus playback: Chrome 33, Edge 14, Firefox 15, Safari 11 (CAF only at first); "Safari supports Opus in the `<audio>` element only when packaged in a CAF file" (older note). https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs — caniuse per-version Safari: 17.4 "Supported in a WebM container (all bitrates). Has a known regression"; 17.5–18.3 "Supported in a WebM container (all bitrates)"; 18.4+ partial note "requiring macOS 15.4 Sequoia or later". iOS Safari: 18.4+ full. https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json
- Ogg in Safari: "Safari 18.4+ (on macOS 15.4+, iOS 18.4+, iPadOS 18.4+, and visionOS 2.4+) added support for Opus and Vorbis codecs in Ogg containers." https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers — caniuse ogg-vorbis: Safari 14.1–18.3 partial ("Supports the Vorbis audio codec, but not the Ogg container"), 18.4+ full. https://github.com/Fyrd/caniuse/blob/main/features-json/ogg-vorbis.json
- WebM container in Safari: full from 16.0 (14.1–15.6 "requires macOS 11.3 Big Sur or later"). https://github.com/Fyrd/caniuse/blob/main/features-json/webm.json
- AAC: "Chrome supports AAC only in MP4 containers, and only supports AAC's Main Profile. In addition, AAC is not available in Chromium builds." "Firefox relies upon a platform's native support for AAC." https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs
- Opus-in-MP4 playback per browser: MDN lists MP4 as an Opus container but gives no per-browser versions. Not verified; see Unverified.

### Verdict for Annoudio

Record with whatever the browser picks (probe `isTypeSupported` in the order `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4`), upload the raw blob, keep it, and transcode server-side with ffmpeg to AAC-in-MP4 (`.m4a`) as the single playback file. Serve the original as a second `<source>` only if its type is WebM/Opus. Main risk: Firefox on a platform without system AAC; mitigate by also emitting Opus/WebM when CPU budget allows and listing both sources.

---

## 4. Prior art

### Finding

The Omeka S "Annotate" module is a real WADM backend with a protocol endpoint and an admin tab, but it is explicitly "no end user friendly interface", recommends one body and one target per annotation, and documents image `xywh` fragments, not time fragments. Omeka S media give a stable numeric `o:id` and an `o:original_url`, which is what Annoudio needs as the target IRI source. In IIIF land, Clover renders audio/video canvases and VTT "supplementing" annotations as captions and transcript, Ramp is a React IIIF AV player, Mirador 4 still has an open issue for annotations on video, and Annona is image-only. Among audio widgets, wavesurfer.js (regions plugin) and peaks.js (segments) both display and edit time ranges on a waveform and are maintained; Label Studio has an audio region labeler but is a labeling product; Annotorious is image-only; audio-annotator is dead. None stores or renders WADM; Annoudio would map annotations to regions itself.

### Evidence

(a) Omeka S

- Annotate module: "The three parts of the web annotation standard are implemented: Web Annotation Vocabulary ... Data Model ... Protocol". "This module has no end user friendly interface and is designed to be a backend for other modules or themes". "Annotations can be created via the tab 'Annotations' of each resource (item sets, items and media). They can be browsed and managed via the main admin menu (`admin/annotation`)." "it is recommended to keep one body and one target by annotation currently". Protocol endpoint: "`/annotations/`: LDP `BasicContainer` of all annotations, paginated as `AnnotationPage`"; "`/annotations/:id` — single annotation as a W3C `Annotation`." Selectors: targets combine `oa:hasSource` and `oa:hasSelector`; the module can "serialize image rectangles as `oa:FragmentSelector` (`#xywh=`)". No mention of `t=` or time selectors. Canonical repo is on GitLab; the GitHub mirror shows release 3.4.13 on 2026-04-16, last commit 2026-04-06. https://github.com/Daniel-KM/Omeka-S-module-Annotate and https://gitlab.com/Daniel-KM/Omeka-S-module-Annotate
- Omeka S media fields: `MediaRepresentation.php` emits `o:id`, `o:source`, `o:media_type`, `o:sha256`, `o:size`, `o:filename`, `o:original_url`. https://github.com/omeka/omeka-s/blob/develop/application/src/Api/Representation/MediaRepresentation.php — REST read: "`GET /api/:api_resource/:id` Get one resource by a known ID." "Resource IDs are exposed as `o:id` in the API output for all resources." https://omeka.org/s/docs/developer/api/rest_api/ and https://omeka.org/s/docs/developer/api/rest_api_reference/ — Omeka S latest release v4.2.1 on 2026-06-18. https://github.com/omeka/omeka-s/releases

(b) IIIF AV

- Clover IIIF: v3.16.2 on 2026-09-29, MIT, last commit 2026-10-09. "Renders a multi-canvas Video, Sound, and Image viewer"; "Renders annotations with the motivation of `supplementing` with a content resource having the format of `text/vtt`"; `options.annotations.motivations` filters textual annotations in the Information Panel; chapter markers from `structures` ranges with `#t=`; web component `<clover-viewer>` built with Preact. https://samvera-labs.github.io/clover-iiif/docs/viewer and https://github.com/samvera-labs/clover-iiif
- Mirador: v4.2.6 on 2026-10-02, Apache-2.0. Open issue #4251 "Annotation on video support + improve video handling" (updated 2026-07-22). https://github.com/ProjectMirador/mirador/issues/4251 and https://github.com/ProjectMirador/mirador/releases
- Ramp: v5.1.1 on 2026-08-05, license ISC (package.json), React 19 required for v5; standalone bundle uses Preact; components `IIIFPlayer`, `MediaPlayer`, `StructuredNavigation`, `Transcript`. https://github.com/samvera-labs/ramp
- Annona: MIT, release v1.3.2 on 2020-06-26, last commit 2026-03-31. "display W3 Web Annotations in a visual format" with Image, Storyboard (OpenSeadragon) and Range views; no audio view. https://github.com/ncsu-libraries/annona

(c) Audio widgets

- peaks.js (bbc): v3.4.2 on 2024-08-15, last commit 2025-11-08, LGPL-3.0, 65 open issues. `segments.add` takes `startTime`, `endTime`, `editable`, `color`, `labelText`; needs a `mediaElement` plus precomputed waveform data or Web Audio. https://github.com/bbc/peaks.js and https://github.com/bbc/peaks.js/blob/master/doc/API.md
- wavesurfer.js: 8.0.2 on 2026-10-07, BSD-3-Clause, 13 open issues. Regions plugin options `id, start, end, drag, resize, color, content, minLength, maxLength, channelIdx`; events `region-created`, `region-updated`, `region-removed`, `region-clicked`, `region-double-clicked`, `region-in`, `region-out`; `enableDragSelection`. https://github.com/katspaugh/wavesurfer.js/blob/main/src/plugins/regions.ts
- Hyperaudio Lite: v2.6.6 on 2026-09-21, MIT. Interactive transcript player; word timing via `data-m` milliseconds; not an annotation tool. https://github.com/hyperaudio/hyperaudio-lite
- audio-annotator (CrowdCurio): BSD-2-Clause, last commit 2017-08-22, no releases; wavesurfer-based region labeling for crowdsourcing. https://github.com/CrowdCurio/audio-annotator
- Annotorious: v3.4.0 on 2025-05-27, last commit 2026-10-06, BSD-3-Clause. "Add image annotation to your site"; works with OpenSeadragon and IIIF; no audio or video. https://annotorious.dev/ and https://github.com/annotorious/annotorious
- Label Studio: 1.23.2 on 2026-09-29, Apache-2.0. `<Audio>` tag "plays audio and shows its waveform"; regions labeled with `<Labels>`; export `value` has `start`, `end` in seconds, `channel`, `labels`. It is a labeling app, not an embeddable public player. https://labelstud.io/tags/audio

### Verdict for Annoudio

Reuse wavesurfer.js plus its regions plugin inside the custom element for the read side (regions = annotation time ranges, `region-clicked` opens the body panel) and for range selection on the first-party annotate page. Keep peaks.js as the fallback if precomputed waveforms for long recordings matter (LGPL applies). Treat Omeka S as a target host, not a backend: the Omeka media `o:original_url` is the target `source`, and the Omeka Annotate module can later receive a copy through its `/annotations/` protocol endpoint. Main risk: wavesurfer decodes audio in the browser for the waveform; long recordings need server-side peaks or the `decoder: none` style fallback.

---

## 5. Self-hosted identity providers as a sidecar

### Finding

Every full identity provider adds at least one more container and a mental model (flows, stages, realms, policies) that a non-technical admin must learn. Authentik and Keycloak are the heaviest (364 MB and 253 MB images, 2 GB RAM recommended) and have the richest admin consoles, but those consoles are built for IT staff. Zitadel is lighter but has no email magic-link primary login. Ory Kratos is headless (you build every screen). Pocket ID is passkey-only. Rauthy is the lightest full OIDC provider with an admin UI and documented magic-link login. lldap and Dex are not user-facing login services for this use case. The reasonable first step is accounts and "login by emailed code" inside the app itself, with an OIDC provider added later.

### Evidence

| Provider | Last release | License | Image (compressed, amd64) | Min RAM (docs) | Services | OIDC provider | Passwordless email | Admin UI |
|---|---|---|---|---|---|---|---|---|
| Authentik 2026.8.3 | 2026-09-17 | repo "NOASSERTION" (custom) | 364 MB (`ghcr.io/goauthentik/server`) | "at least 2 CPU cores and 2 GB of RAM" | server + worker + PostgreSQL; Redis removed in 2025.10 | yes | example blueprint `flows-login-email-magic-link.yaml` | full web admin, flow/stage model |
| Keycloak 26.8.0 | 2026-10-01 | Apache-2.0 | 253 MB (`quay.io/keycloak/keycloak`) | "2 GB for smaller production deployments" (heap via MaxRAMPercentage) | Keycloak + PostgreSQL (`dev-file` deprecated in prod) | yes | not built in; community extension p2-inc/keycloak-magic-link v0.90 | full admin console, realm model |
| Zitadel v4.19.4 | 2026-10-01 | AGPL-3.0 | 50 MB api + 66 MB login | "at least 2 GB RAM" | Traefik + API + Login (Next.js) + PostgreSQL | yes | passkeys; console docs show no email-code primary login | console |
| Ory Kratos v26.2.0 (+ Hydra v26.2.0) | 2026-03-20 | Apache-2.0 | 27 MB + 18 MB | not stated | Kratos + Hydra + SQL DB + your own UI | Hydra | one-time code by email; "You need a good email delivery provider" | none (headless) |
| lldap v0.6.3 | 2026-04-30 | GPL-3.0 | 26 MB | not stated | single; SQLite default | no ("For more features (OAuth/OpenID support, ...) you can install" other tools) | password reset by SMTP | simple web UI |
| Pocket ID v2.18.0 | 2026-10-04 | BSD-2-Clause | 33 MB | not stated | "one container or one binary", built-in SQLite | yes (certified) | passkeys only; admin-issued one-time login code | yes |
| Rauthy v0.37.1 | 2026-10-07 | Apache-2.0 | 35 MB | "Hiqlite single instance ~40mb" | single; embedded Hiqlite, Postgres optional | yes | docs list email magic link and passkeys | yes |
| Casdoor v4.18.0 | 2026-10-07 | Apache-2.0 | n/a (tag not on Docker Hub) | not stated | single Go binary + SQL DB (SQLite allowed) | yes, also SAML/CAS | email and SMS codes | web console |
| Logto v1.44.0 | 2026-09-30 | MPL-2.0 | 312 MB (`svhd/logto`) | not stated | Logto + PostgreSQL | yes | email/phone verification code; built-in email service is cloud-only | console (multi-tenancy cloud-only) |
| Dex v2.46.0 | 2026-10-07 | Apache-2.0 | 48 MB | not stated | single | yes | n/a; "portal to other identity providers through connectors" | none |

Sources: https://docs.goauthentik.io/install-config/install/docker-compose ; https://docs.goauthentik.io/core/architecture ; authentik release notes 2025.10 "Removed Redis dependency: authentik no longer uses Redis at all" https://github.com/goauthentik/authentik/blob/main/website/docs/releases/2025/v2025.10.mdx ; https://docs.goauthentik.io/add-secure-apps/flows-stages/flow/flows/ ; https://www.keycloak.org/server/containers ; https://github.com/p2-inc/keycloak-magic-link ; https://zitadel.com/docs/self-hosting/deploy/compose ; https://zitadel.com/docs/guides/manage/console/users ; https://www.ory.com/docs/kratos/passwordless/one-time-code ; https://github.com/lldap/lldap ; https://pocket-id.org/docs/ ; https://pocket-id.org/docs/setup/installation ; https://sebadob.github.io/rauthy/ ; https://github.com/sebadob/rauthy ; https://casdoor.ai/docs/overview/ ; https://docs.logto.io/logto-oss/ ; https://docs.logto.io/end-user-flows/sign-up-and-sign-in/sign-in ; https://github.com/dexidp/dex . Image sizes measured with `docker manifest inspect` on 2026-10-09; licenses and release dates from the GitHub API on 2026-10-09.

- In-app libraries: django-allauth 65.19.7 (2026-10-01), MIT: `ACCOUNT_LOGIN_BY_CODE_ENABLED` — "a one-time code is sent to that email address which allows the user to login. This method is often referred to as 'Magic Code Login'." https://docs.allauth.org/en/latest/account/configuration.html — authlib v1.8.0 (2026-08-30), BSD-3: "The ultimate Python library in building OAuth and OpenID Connect servers", OpenID Connect Core and Discovery. https://github.com/lepture/authlib — better-auth v1.7.7 (2026-09-30), MIT; Auth.js next-auth 4.24.15 (2026-07-20), ISC; Lucia "was deprecated on March 2025". https://github.com/lucia-auth/lucia

Admin-UI rating for a non-technical operator (judgement, based on the docs above): Authentik and Keycloak consoles expose every concept (flows, stages, policies, realms, clients, mappers) and are built for IT staff; Rauthy, Pocket ID and Casdoor consoles are small and list users, groups and clients; Kratos has no UI; Dex and lldap are not designed as the account system for a public community.

### Verdict for Annoudio

Start with accounts inside the app: email + "login by code" (allauth in Django, or better-auth's equivalent in Node), with user management in the same admin GUI as everything else. Do not ship an identity-provider container in v1. If organisations later need single sign-on, add Rauthy (35 MB, embedded DB, admin UI, OIDC) as the sidecar and let the app act as an OIDC client; expose the app itself as an OIDC provider only if a real consumer appears (authlib covers that in Python). Main risk: a magic-code login is only as strong as the mailbox and depends on SMTP deliverability; the team must own a transactional email account from day one.

---

## 6. SKOS vocabulary editing

### Finding

No maintained JavaScript library exists that edits a SKOS concept hierarchy and exports Turtle or JSON-LD and can be dropped into another admin UI. The maintained editors are full server applications in PHP (TemaTres), Ruby on Rails (iQvoc), Java (VocBench 3, OpenTheso) or Python (Atramhasis, vocabseditor). Skosmos is a browser only; SkoHub Vocabs is a static-site publisher and its editor is archived. A flat hierarchical term list in Annoudio's own admin GUI, with stable concept IRIs and a SKOS export, is the honest first version; it can later be imported into any of these tools.

### Evidence

- TemaTres: v3.6.1 on 2026-04-30, last commit 2026-10-01, GPL-2.0; "MySQL version 5.0 or greater", "PHP ... 7.4 or greater". https://github.com/tematres/TemaTres-Vocabulary-Server
- Skosmos: v3.4 on 2026-08-31, PHP 8.1–8.4; "a web-based tool providing services for accessing controlled vocabularies ... accessed via SPARQL endpoints". No editing. https://github.com/NatLibFi/Skosmos
- VocBench 3: Bitbucket, Java WAR deployed with Semantic Turkey; "management of OWL ontologies, SKOS/SKOS-XL thesauri, OntoLex lexicons"; last commit 2026-10-08; LICENSE is a BSD-style "All rights reserved" notice (exact variant not verified). https://vocbench.uniroma2.it/ and https://bitbucket.org/art-uniroma2/vocbench3
- SkoHub Vocabs: "Static site generator for Simple Knowledge Management Systems (SKOS)", parses Turtle in `./data`; Apache-2.0; last commit 2026-07-02; no releases. https://github.com/skohub-io/skohub-vocabs — skohub-editor is archived (2025-10-30). https://github.com/skohub-io/skohub-editor
- iQvoc: v.4.15.1 on 2026-09-04, Apache-2.0, Rails; "editorial features for registered users", "publishing the vocabulary in the Semantic Web"; Docker Compose with Postgres; can run as a Rails engine. https://github.com/innoq/iqvoc
- OpenTheso: v26.07.06 on 2026-07-27, CeCILL-C, Java; "import: SKOS, Turtle, JsonLD and CSV"; "export: SKOS, Turtle, JsonLD, CSV and PDF"; OpenAPI and GraphQL. https://github.com/miledrousset/opentheso
- Atramhasis: GPL-3.0, Python, last commit 2026-09-21; "an online SKOS editor". https://github.com/OnroerendErfgoed/atramhasis — vocabseditor: MIT, Python, last commit 2025-09-04. https://github.com/acdh-oeaw/vocabseditor — skosjs: Apache-2.0, JavaScript, last commit 2022-01-17, needs a SPARQL 1.1 endpoint. https://github.com/tkurz/skosjs — Cognithive/SKOS-editor: C#, last commit 2019-05-24. https://github.com/Cognithive/SKOS-editor

### Verdict for Annoudio

Build the vocabulary as a tree of concepts (IRI, prefLabel per language, altLabels, broader, definition) in the admin GUI, and export it as SKOS JSON-LD and Turtle from one endpoint (`/vocab/{scheme}.ttl`, `.jsonld`). Mint concept IRIs under the org's domain and never change them; the WADM tag bodies point at them. Import SKOS Turtle so an org that already has a thesaurus in TemaTres or OpenTheso can load it. Main risk: the team invents labels that drift from an external vocabulary; the import path plus `exactMatch` links keeps that reversible.

---

## 7. Admin-GUI-first backends

### Finding

Three options give a non-technical team a GUI for records, files, users and roles. Directus is a GUI-first data platform: collections, roles, policies, files and no-code Flows are all edited in the Data Studio, and it runs as one container plus Postgres. Its licence is no longer open source (Monospace Sustainable Core License, free core tier with limits) and it has no magic-link login. Payload CMS is MIT, runs as one Next.js app plus Postgres, models schema in TypeScript (a developer task) but gives editors an admin UI with built-in drafts (`_status: draft|published`) that is a ready review queue, auth-enabled collections for public community accounts, custom endpoints in-process for JSON-LD, and hooks. Strapi has end-user accounts but no official Docker image and puts Review Workflows behind the Enterprise plan. Django + admin + allauth is the lowest-magic path, but the Django docs say the admin "is not intended for building your entire front end around", so the team's review and vocabulary screens would be custom.

### Evidence

- Directus v12.5.0 on 2026-10-07; image `directus/directus:12.5.0` 234 MB; "Directus is licensed under the Monospace Sustainable Core License (MSCL)"; "Higher limits and features require a paid license". https://directus.com/docs/self-hosting/overview and https://github.com/directus/directus/blob/main/license — Auth drivers: `local`, `oauth2`, `openid`, `ldap`, `saml`; no passwordless. https://directus.com/docs/configuration/auth-sso — Roles, policies, Public role: "The Public role governs unauthenticated requests"; users have an "Unverified" status after registration. https://directus.com/docs/guides/auth/access-control — Flows triggers: Event Hook, Webhook, Schedule (CRON), Another Flow, Manual ("a manual click of a button within the Data Studio"); operations include Condition, Run Script, Create/Read/Update Data. https://github.com/directus/docs/tree/main/content/guides/06.flows — Custom endpoint extension: export `{ id, handler(router, context) }`. https://directus.com/docs/guides/extensions/api-extensions/endpoints
- Payload v3.90.2 on 2026-09-23, MIT. Auth: "Any Collection can opt in with `auth: true`"; `verify: true` for email verification; forgot-password built in; no magic link listed (custom strategies allowed). https://payloadcms.com/docs/authentication/overview — Postgres: `@payloadcms/db-postgres` "leverages Drizzle ORM and `node-postgres`"; push in dev, migrations elsewhere. https://payloadcms.com/docs/database/postgres — Custom endpoints: `endpoints` array with `path`, `method`, `handler`; "Custom endpoints are not authenticated by default". https://payloadcms.com/docs/rest-api/overview — Drafts: `_status` is `draft` or `published`; access rules can limit publishing to admins and reads to published; autosave; scheduled publish needs a jobs queue. https://payloadcms.com/docs/versions/drafts — Hooks "allow you to execute your own side effects during specific events of the Document lifecycle". https://payloadcms.com/docs/hooks/overview — Deployment: "Payload can be deployed anywhere that Next.js can run"; a multi-stage Dockerfile example; needs "a database, file storage, an email provider". https://payloadcms.com/docs/production/deployment
- Strapi v5.57.0 on 2026-10-07; LICENSE: MIT for code outside `ee/`. https://github.com/strapi/strapi/blob/develop/LICENSE — "Strapi does not build any official container images." https://docs.strapi.io/cms/installation/docker — Users & Permissions: end-user accounts with Public and Authenticated roles, email confirmation; no passwordless on the page. https://docs.strapi.io/cms/features/users-permissions — Review Workflows: "This feature is available with an Enterprise plan." https://docs.strapi.io/cms/features/review-workflows
- Django admin: "reads metadata from your models to provide a quick, model-centric interface where trusted users can manage content ... The admin's recommended use is limited to an organization's internal management tool. It's not intended for building your entire front end around." https://docs.djangoproject.com/en/5.2/ref/contrib/admin/ — allauth login by code, see section 5. Procrastinate for jobs, see section 8.

### Verdict for Annoudio

Choose Payload CMS on Postgres: two services (app + Postgres), MIT, admin UI for recordings, projects, vocabulary concepts, annotations, users and theme settings, a built-in draft/published review queue with per-role publish rights, public community accounts as an auth collection with email verification, and in-process custom endpoints that serialise WADM JSON-LD and the protocol routes. Add magic-code login as a custom auth strategy. Directus is the alternative if GUI schema editing and no-code Flows matter more than licence terms; check the MSCL free-tier limits first. Main risk: Payload's schema lives in code, so adding a field is a developer deploy, not a GUI click.

---

## 8. Upload and processing chain

### Finding

Uppy with its Tus plugin gives resumable browser uploads; tusd (34 MB image) or `@tus/server` in-process receives them. ffmpeg transcodes the voice note once (libopus or the native AAC encoder). Transcription on CPU is feasible with the `small` model: faster-whisper used about 1.5 GB RAM and 1m42s for 13 minutes of audio on an 8-thread desktop CPU; whisper.cpp needs about 0.85 GB for `small` and 0.39 GB for `base`. ClamAV wants 3–4 GiB RAM on its own, which is more than the rest of the stack. A Postgres-backed job queue (pg-boss for Node, Procrastinate for Python) avoids a Redis container to run, monitor and back up.

### Evidence

- Uppy uppy@6.0.4 on 2026-09-30, MIT. Tus plugin "brings resumable file uploading with Tus to Uppy by wrapping the tus-js-client"; options `endpoint`, `chunkSize` (default Infinity), `retryDelays` (default `[0, 1000, 3000, 5000]`); "Transloadit runs `tusd` in production". https://uppy.io/docs/tus/
- tusd v2.10.1 on 2026-09-16, MIT; "official reference implementation of the tus resumable upload protocol"; stores on disk, Google Cloud Storage or S3; image `tusproject/tusd:v2.10.1` is 34 MB. https://github.com/tus/tusd — `@tus/server` (tus-node-server, released 2026-09-22, MIT) "A tus server integrated into your existing Node.js server" with `FileStore` and `S3Store`, Express and Fastify examples. https://github.com/tus/tus-node-server
- ffmpeg encoders: "libopus Opus Interactive Audio Codec encoder wrapper"; the native AAC encoder is FFmpeg's default. https://ffmpeg.org/ffmpeg-codecs.html
- faster-whisper v1.2.1 on 2025-10-31, MIT, Python 3.9+; small model on CPU, int8, beam 5: 1m42s and 1477 MB RAM for 13 minutes of audio; with `batch_size=8`: 51s and 3608 MB; "Executed with 8 threads on an Intel Core i7-12700K". FFmpeg not required (PyAV bundled). https://github.com/SYSTRAN/faster-whisper
- whisper.cpp v1.9.5 on 2026-10-06, MIT; memory: tiny ~273 MB, base ~388 MB, small ~852 MB, medium ~2.1 GB, large ~3.9 GB. https://github.com/ggml-org/whisper.cpp
- ClamAV 1.5.4 on 2026-08-07, GPL-2.0; image `clamav/clamav:1.5` 148 MB; RAM "Minimum: 3 GiB", "Preferred: 4 GiB"; loading signatures "upwards of 1.2 GiB of RAM"; daily reload "upwards of 2.4 GiB of RAM for a short period". https://docs.clamav.net/manual/Installing/Docker.html
- pg-boss 12.37.1 on 2026-10-08, MIT: "relies on Postgres's SKIP LOCKED ... Concurrent workers claim jobs without blocking each other, and job processing gets the safety of guaranteed atomic commits." https://github.com/timgit/pg-boss
- Procrastinate 3.10.0 on 2026-09-23, MIT: "Python 3.10+ distributed task processing library, leveraging PostgreSQL 13+ to store task definitions, manage locks"; Django integration. https://github.com/procrastinate-org/procrastinate
- Redis 8 alpine image is 37 MB; it is one more stateful service to run and back up (measured 2026-10-09).

### Verdict for Annoudio

Uppy + Tus in the annotate page, uploads received in-process (`@tus/server` with `FileStore`, or tusd if a second container is acceptable), a pg-boss queue in the same Postgres, and one worker that runs `ffmpeg -i in -c:a aac -b:a 96k out.m4a`, probes with `ffprobe` to validate the media type, resizes images, and optionally transcribes with faster-whisper `small` int8 when the org enables it. Skip ClamAV in v1; the files are audio and images that are never executed and are re-encoded. Main risk: transcription on a 2–4 GB VPS competes with the app for RAM; run it as a separate low-priority worker with a concurrency of one and a per-org toggle.

---

## 9. Embed snippet versioning

### Finding

Every widely embedded script keeps one stable loader URL and puts the contract in attributes or a global config object. Hypothesis loads `https://hypothes.is/embed.js` and reads a JSON block or `window.hypothesisConfig()`; the client ships continuous versions (v1.1766.0) behind that URL. Disqus loads `https://SHORTNAME.disqus.com/embed.js` and reads `disqus_config` (`page.url`, `page.identifier`). giscus loads `https://giscus.app/client.js` with `data-*` attributes and talks to the host via `postMessage`. YouTube loads `https://www.youtube.com/iframe_api` and calls `onYouTubeIframeAPIReady`; it retires methods with dated deprecation notices rather than new URLs. Plausible introduced a new script in October 2025 and kept the old one working for sites that need it. None of them puts a version in the loader path; all of them promise the attributes, not the internals.

### Evidence

- Hypothesis: `<script src="https://hypothes.is/embed.js" async></script>`; config via `<script type="application/json" class="js-hypothesis-config">` or `window.hypothesisConfig()`. https://github.com/hypothesis/client/blob/main/docs/publishers/embedding.rst and https://github.com/hypothesis/client/blob/main/docs/publishers/config.rst — latest tag v1.1766.0 (2026-10). https://github.com/hypothesis/client/tags
- Disqus: `s.src = 'https://EXAMPLE.disqus.com/embed.js'`; `this.page.url` "the location of the page for permalinking purposes"; `this.page.identifier` "a unique value, used to identify the page and discussion thread"; no versioning statement. https://help.disqus.com/en/articles/1717112-universal-embed-code
- giscus (MIT, last commit 2026-05-26): `<script src="https://giscus.app/client.js" data-repo="..." data-theme="...">`; host page communicates with `iframe.contentWindow.postMessage({ giscus: message }, 'https://giscus.app')`. https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md
- YouTube IFrame API: `tag.src = "https://www.youtube.com/iframe_api"`; "The API will call this function [`onYouTubeIframeAPIReady`] when the page has finished downloading the JavaScript for the player API"; deprecations announced with dates (for example search-result loading "no longer supported as of 15 November 2020"); no versioning promise. https://developers.google.com/youtube/iframe_api_reference
- Plausible: "In October 2025, we introduced an updated version of the Plausible tracking script"; "Continue using the old script if you need this functionality"; default tracking changes "take effect automatically without needing to update the snippet on your site". https://github.com/plausible/docs/blob/master/docs/script-update-guide.md and https://plausible.io/docs/script-extensions

### Verdict for Annoudio

Snippet shape:

```html
<script async src="https://ORG.annoudio.example/embed/v1.js"></script>
<annoudio-player recording="https://ORG.annoudio.example/recordings/123"></annoudio-player>
```

The contract is: the `/embed/v1.js` path, the `annoudio-player` tag name, its attributes (`recording`, `lang`, `theme`), the `--annoudio-*` CSS tokens and `part` names, and the DOM events it emits. `v1.js` is a tiny loader that imports the current hashed bundle, so fixes ship without host edits (the Hypothesis and Plausible pattern). A breaking change gets `/embed/v2.js` and a new tag attribute set; `v1.js` keeps serving for years. Main risk: the loader URL is also the org's domain, so a domain change breaks every host page; put the embed host on a stable subdomain from day one.

---

## 10. Ops for non-technical teams

### Finding

Four GUI tools manage a Docker Compose stack on one VPS. Portainer CE is closest to raw Docker: it edits the compose file in a web editor, has "Update the stack" and "Pull and redeploy" buttons, but its backup covers only Portainer's own configuration, scheduled S3 backup is a paid-edition feature, and upgrading Portainer itself is three CLI commands. Coolify deploys compose from git or raw text with a Deploy button and updates itself from a Settings page. Dokploy deploys compose from git or raw text, backs up named volumes to S3 on a schedule and restores them from the UI, backs itself up to S3, but updates itself through the install script. Komodo runs a Core plus Periphery agents and defines stacks "in the UI, on the host, or in a git repo with auto-deploy on push"; its docs pages on backups could not be read.

### Evidence

- Portainer CE 2.45.2 on 2026-10-08, Zlib licence, image 42 MB. Stacks: "edit your compose file manually", "Update the stack", "Pull and redeploy" with "Re-pull image and redeploy", GitOps updates. https://docs.portainer.io/user/docker/stacks/edit — Backup: "This backup is only intended to back up the Portainer configuration"; "Store in S3" scheduled is Business Edition. https://docs.portainer.io/admin/settings/general — Upgrade: `docker stop portainer`, `docker rm portainer`, `docker pull portainer/portainer-ce:lts`, `docker run ...`. https://docs.portainer.io/start/upgrade/docker
- Coolify v4.4.3 on 2026-10-08, Apache-2.0, image 184 MB. Compose from a repository or "Raw (deploy file as-is)"; redeploy with the Deploy button; raw mode skips proxy labels and networking. https://coolify.io/docs/knowledge-base/docker/compose — Self-update: Settings > Updates, "Automatic updates" with a cron frequency (default daily), "Check now". https://coolify.io/docs/get-started/upgrade
- Dokploy v0.30.8 on 2026-09-29, Apache-2.0 outside a `/proprietary` directory, image `dokploy/dokploy:v0.30.8` 764 MB; "at least 2GB of RAM and 30GB of disk space"; installer adds Traefik and Docker. https://docs.dokploy.com/docs/core/installation — Compose: UI env vars are written to `.env` but "not automatically injected into containers" (use `env_file`). https://docs.dokploy.com/docs/core/docker-compose — Volume Backups: "backup Docker named volumes to S3 destinations", cron schedule, restore from the UI into a new volume. https://docs.dokploy.com/docs/core/volume-backups — Dokploy's own backup "saves your entire Dokploy file system and database" to S3 with restore in the UI. https://docs.dokploy.com/docs/core/backups — Self-update: `curl -sSL https://dokploy.com/install.sh | sh -s update`. https://docs.dokploy.com/docs/core/installation
- Komodo v2.3.3 on 2026-09-01, GPL-3.0, core image 257 MB. "Core: Web server hosting the API and browser UI"; "Periphery: Small, stateless agent running on each connected server"; compose files "in the UI, on the host, or in a git repo with auto-deploy on push". https://komo.do/docs/intro and https://github.com/moghtech/komodo/blob/main/docsite/docs/resources.md

### Verdict for Annoudio

Ship the org container as a Compose stack and document it for Dokploy: a non-technical operator can paste the compose, set the env vars in the UI, press Deploy, schedule volume and database backups to S3, and restore from the same screen. Coolify is the alternative when self-updating from the GUI matters more than volume restore. Portainer stays the choice for an org that already has IT staff. Main risk: Dokploy is pre-1.0 (v0.30.x) and its image is 764 MB; pin a version and test an update on a staging VPS before the org does.

---

## Decisions this changes

1. Non-technical GUI constraint: every day-to-day object (project, recording, vocabulary concept, annotation, review state, user, theme) must be a record in one admin UI; no CLI-only path for an operator task. This rules out reusing Elucidate, SAS, miiify and Hypothesis h (section 1), rules out headless Kratos and config-heavy Authentik/Keycloak in v1 (section 5), and favours Payload or Directus over a hand-built Django admin (section 7).
2. WADM: use `type: Sound` for audio bodies; always `FragmentSelector` + `conformsTo: http://www.w3.org/TR/media-frags/`; SKOS tags are a two-body array (section 1).
3. Protocol endpoints are implemented in-app on Postgres `jsonb`; the checklist is the MUST list in section 1.
4. The embed never detects a container session; "Annotate" is a first-party page with redirect back (section 2).
5. Voice notes are transcoded to `.m4a` by a worker; the raw blob is kept (section 3).
6. Read-side widget is built on wavesurfer.js regions inside a custom element (section 4).
7. Accounts and login-by-code live in the app; no identity-provider container in v1; Rauthy is the later sidecar (section 5).
8. Vocabularies are a tree in the admin UI with SKOS export and import; no external editor embedded (section 6).
9. Backend: Payload CMS + Postgres, two services (section 7).
10. Jobs run in Postgres (pg-boss); no Redis; no ClamAV in v1 (section 8).
11. Snippet contract is `/embed/v1.js` + `<annoudio-player>` attributes, tokens and parts (section 9).
12. Deployment story targets Dokploy, with Coolify as the alternative (section 10).

## Unverified

- Opus-in-MP4 playback support per browser version. MDN lists MP4 as an Opus container without versions; WebKit source gates Opus in MP4 behind `HAVE(AVASSETWRITER_WITH_OPUS_SUPPORTED)`. Treat Opus-in-MP4 as unsupported for playback until tested.
- Firefox AAC-in-MP4 playback on Linux depends on system codecs ("relies upon a platform's native support"); not tested here.
- Omeka S Annotate module: whether a `t=` time `FragmentSelector` on a media target round-trips through its API. The README documents `xywh` only. The GitLab repository is canonical; only the GitHub mirror was read. Its licence is not stated in the GitHub metadata.
- Authentik's licence (GitHub reports "NOASSERTION"); Directus MSCL free-tier limits (the docs page says higher limits need a paid licence but does not list them); VocBench 3 exact licence variant.
- Rauthy's email magic-link login: stated on the project docs landing page summary, not confirmed against a configuration reference.
- Pocket ID SMTP and Postgres support; Casdoor Docker image size (tag `v4.18.0` not found on Docker Hub).
- Keycloak image memory figures beyond "2 GB for smaller production deployments".
- Komodo backup features and database choice; Dokploy self-update from the web UI (docs show only the install script).
- Plausible's exact new snippet markup (docs page shows only `plausible.init` examples).
- Ramp licence is taken from `package.json` (`ISC`); the repo has no LICENSE file.
- MDN Baseline for CHIPS says "Since December 2025"; BCD lists Safari 26.2. Both were read on 2026-10-09; the Safari minor that re-shipped `Partitioned` was not cross-checked against WebKit release notes.
- Chrome's default recorder MIME type was read from the Blink source on `main`, not from a shipped release tag.
