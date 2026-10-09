# Annoudio embed contract, v1

Status: draft for Phase 1, 2026-10-09. Owner: the `player` module (see `CONTEXT.md`, module map).

This file is the **interface** of the `player` module. Hand-built sites, WordPress and Omeka S paste the **snippet** and keep it for years. Every rule here is a promise to those sites. Anything this file does not name is **implementation**: it can change in any release without notice.

The contract has eight parts: the snippet, the attributes, the theme tokens, the `part` names, the events with the method and the property, the requests, and the Annotate link. Sections 8 to 11 give the invariants, error modes, performance and accessibility rules that apply to all of them.

Words: "the player" is one `<annoudio-player>` element. "The host page" is the page that contains it. "The origin" is the scheme, host and port of the organisation's stack, for example `https://stories.org.example`. "The loader" is the file `/embed/v1.js`. "The bundle" is the hashed file that the loader imports.

---

## 1 The snippet

The operator copies these two lines from the catalogue. `ORG` is the stable host name of the organisation's stack.

```html
<script async src="https://ORG/embed/v1.js"></script>
<annoudio-player project="…" recording="…" src="…"></annoudio-player>
```

Rules:

1. The `<script>` line is the same for every player of one organisation. A page needs it once. A second copy on the same page is safe (section 5).
2. The `<script>` line can be before or after the elements, in `<head>` or in `<body>`. The player starts when the loader runs. Elements that the page adds later also start.
3. The `<script>` must be a classic script. Do not add `type="module"`. Do not add `integrity`: the loader changes when the organisation upgrades.
4. One page can hold many players. Each player is one **instance** (project, recording).
5. Child content of `<annoudio-player>` is fallback content. The browser shows it until the loader runs. The player hides it when it starts. Example: `<annoudio-player …><a href="ferry.m4a">Listen to the recording</a></annoudio-player>`. The snippet that the catalogue makes has no child content.

Example with real values:

```html
<script async src="https://stories.org.example/embed/v1.js"></script>
<annoudio-player project="river-voices" recording="rec-0042"
  src="https://stories.org.example/media/rec-0042.m4a"></annoudio-player>
```

---

## 2 Attributes

### 2.1 The v1 attribute set

| Attribute | Required | Value | Meaning |
|---|---|---|---|
| `project` | yes | The **project** slug. | The project whose stories, vocabulary and theme the player uses. |
| `recording` | yes | The **recording** `id` from the **catalogue**. | The recording that the stories are about. With `project`, it names the instance. |
| `src` | yes | The URL of the audio file. Absolute, or relative to the host page (as for `<audio src>`). Scheme `https:` or `http:`. | The file that the player plays. |
| `origin` | no | An origin: scheme, host and optional port. No path, query or fragment. | Where the player reads stories and theme, and where the Annotate link goes. Default: the origin of the loader that defined the element (2.3). |
| `annotate` | no | `link` or `none`. Default `link`. | `link` shows the Annotate link. `none` hides it, for read-only pages. |
| `lang` | no | A BCP 47 language tag. This is the global HTML attribute. | The language of the player's own text (labels, messages). Default: the language of the nearest ancestor with `lang`, as for any HTML element. |

Rules for all attributes:

1. The player reads attribute values when it starts and each time a value changes. A change to `project`, `recording`, `src` or `origin` makes the player stop, discard its state and start again. A change to `annotate` or `lang` updates the display only.
2. The player trims spaces at the start and end of each value. An empty value is the same as a missing attribute.
3. The player puts `project` and `recording` into URLs with `encodeURIComponent`. It does not check their characters. The stack answers 404 for an unknown project or recording (section 9).
4. The player does not compare `src` with the URLs in the catalogue. Stories point at the recording, not at a file. If `src` is a different edit of the audio (for example, cut at the start), the stories are at the wrong times. The host is responsible for this.
5. For `annotate`, an unknown value counts as the default (`link`). The player writes one `console.warn`. This follows HTML's rule for enumerated attributes, and lets a later v1 add values.
6. If the UI language in `lang` is not available, the player uses English. This is not an error.

### 2.2 Why `src` is required

`src` is required in v1, also when the catalogue has a URL for the recording.

- The player can start the audio with no other request first. The stories request and the audio request start at the same time.
- A recording can have many URLs in the catalogue. The host knows which file it serves. A WordPress or Omeka S media ID gives one exact file URL.
- The stories routes stay pure Web Annotation Protocol. The player needs no catalogue route.

A later v1 can make `src` optional (section 12.2: a required attribute can become optional). The reverse is a breaking change. So v1 starts strict.

### 2.3 How the player finds its default origin

The loader is a classic script. When it runs for the first time, it reads `document.currentScript.src` and keeps that URL's origin. This works for `async` classic scripts. `document.currentScript` is `null` in module scripts and in callbacks (MDN, `Document.currentScript`). So the loader reads it synchronously, at the top level, before any `await`. If the value is `null` (someone loaded the loader as a module), the loader uses the last `<script>` in the document whose `src` ends with `/embed/v1.js`.

The loader passes this origin to the bundle. The bundle resolves its own files from `import.meta.url` (MDN, `import.meta`).

When to set `origin`:

- The page holds players of two organisations. The first loader to run defines the element. Players of the second organisation must set `origin`, or they read from the first.
- The host serves a copy of the loader from its own domain.
- Tests that use a fixture server.

### 2.4 Attributes that are not in v1

The player reads no other attribute. Global HTML attributes (`id`, `class`, `style`, `hidden`, `title`, `lang`, `data-*`) work as on any element. The player never reads `data-*` attributes, so hosts can use them freely. All other names are reserved for later v1 releases.

| Name | Status | Reason |
|---|---|---|
| `theme` | Rejected for v1. Name reserved. | A theme in pasted HTML cannot be changed later. The operator sets the theme in the admin (section 3.2). The host overrides it in its own CSS. |
| `instance` | Rejected for v1. Name reserved. | The instance is (project, recording), derived and never stored by hand (`CONTEXT.md`). An override is for two conversations on one recording in one project. Nobody needs it yet. Adding it later is not breaking. |
| `autoplay` | Rejected. | Browsers block autoplay with sound. Autoplay also fails WCAG 1.4.2 for many users. |
| `start` / `t` | Deferred. Name reserved. | A start time for the player. The return fragment (section 7.2) covers the only v1 need. |
| `preload`, `controls`, `height` | Rejected. | The player sets `preload="metadata"`. It always shows controls. Height comes from tokens. |
| Child `<source>` elements | Rejected for v1. | The `media` module makes `.m4a`, which plays in every target browser. One `src` is enough. |

---

## 3 Theme tokens and parts

### 3.1 Theme tokens

The player's look comes from **theme tokens**: CSS custom properties named `--annoudio-*`. A custom property inherits into a shadow tree (MDN, "Using CSS custom properties"; CSS Scoping §4.2). So a host sets a token on the element or on any ancestor:

```css
annoudio-player { --annoudio-color-accent: #8a1c2b; --annoudio-radius: 0; }
```

| Token | What it colours or sets | Default |
|---|---|---|
| `--annoudio-color-surface` | Background of the player. | `#ffffff` |
| `--annoudio-color-text` | Main text and icons. | `#1f1f1f` |
| `--annoudio-color-muted` | Secondary text: times, nicknames, dates. | `#595959` |
| `--annoudio-color-accent` | Play button, played part of the timeline, edge of the open story's range, links. | `#0b5cad` |
| `--annoudio-color-on-accent` | Text and icons on the accent colour. | `#ffffff` |
| `--annoudio-color-border` | Borders and the timeline track. | `#767676` |
| `--annoudio-color-wave` | Waveform bars not yet played. | `#8c8c8c` |
| `--annoudio-color-region` | Fill of a story's time range on the timeline. | `#d5e3f3` |
| `--annoudio-color-focus` | Focus ring. | `#0b5cad` |
| `--annoudio-font-family` | All text. | The font that the host page gives the element (inherited). |
| `--annoudio-font-size` | Base text size. All other sizes scale from it. | The size that the host page gives the element (inherited). |
| `--annoudio-radius` | Corner radius of the frame and buttons. | `6px` |
| `--annoudio-space` | Base unit of space between items. | `0.5em` |
| `--annoudio-timeline-height` | Height of the timeline and waveform. | `64px` |

Rules:

1. Colour tokens take any CSS `<color>`. `--annoudio-radius`, `--annoudio-space`, `--annoudio-timeline-height` and `--annoudio-font-size` take a `<length>`. `--annoudio-font-family` takes a font family list. An invalid value makes that property use its default (normal CSS behaviour for an invalid custom property at use time).
2. The player's own styles read tokens only as `var(--annoudio-…, <default>)`. The player declares a `--annoudio-*` property in one place only: on `:host`, from the project theme stylesheet (section 3.2). So a value set on the element itself always wins, and a value set on an ancestor reaches the player by inheritance when the project theme does not set that token.
3. Order of strength, strongest first: host CSS on the element itself (`annoudio-player { --annoudio-color-accent: … }`), then the project theme from the admin (`:host` in the shadow root), then host CSS on an ancestor (`:root`, `body`, a wrapper), then the defaults in this table. Reason: a document rule on the host element beats a `:host` rule from the shadow tree; a `:host` rule beats an inherited value (CSS Scoping §3.3). A host that wants to override a project theme sets the token on the element, not on `:root`.
4. The defaults are light colours. The player does not follow `prefers-color-scheme` by itself. A host or a project that wants a dark player sets the tokens. Reason: the player must match the host page, not the operating system.
5. In forced-colours mode, the player uses system colours and ignores colour tokens.
6. Default contrast on `--annoudio-color-surface` (WCAG 2.2): text 16.5:1, muted 7.0:1, accent 6.7:1, on-accent on accent 6.7:1, border 4.5:1, wave 3.4:1. The player does not check the contrast of values that a host or a project sets.

### 3.2 How the project theme reaches the player

The operator sets theme tokens per project in the admin. The player reads them from the stack:

```
GET {origin}/embed/v1/themes/{project}.json
```

```json
{
  "tokens": { "color-accent": "#8a1c2b", "radius": "0px" },
  "name": "River Voices",
  "rightsLine": "CC BY 4.0",
  "rightsIri": "https://creativecommons.org/licenses/by/4.0/"
}
```

Rules:

1. Keys are token names without the `--annoudio-` prefix. The player uses only keys from table 3.1. It ignores other keys.
2. The player checks each value with `CSS.supports()` for the token's kind. It ignores a value that fails, with one `console.warn`.
3. The player applies the values in its own shadow root, through one constructed stylesheet in `adoptedStyleSheets` per project per page (MDN, `ShadowRoot.adoptedStyleSheets`). Nothing goes into the host document.
4. A 404, a network error or bad JSON means "no project theme". The player uses the defaults. This is not an error mode and shows no message.
5. The player starts this request at the same time as the stories request. It shows its controls when the theme request settles or after 500 ms, whichever comes first. A theme that arrives later replaces the defaults in place.
6. This JSON shape is part of v1, because a v1 bundle from one stack can read the theme of another v1 stack (`origin`). The stack can add keys. It cannot remove or rename keys within v1.
7. The project frame (added 2026-10-09, additive). `name` is the project name; it is always there. `rightsLine` is the rights statement of the project as text, for example "CC BY 4.0"; `rightsIri` is the web address of the licence. Each of the two is there only when the operator set it. The player shows `rightsLine` once, in the `rights` part, below the stories; with an `http:` or `https:` `rightsIri`, the line is a link to it. The player does not show `name`: the host page names its site. A player that gets no `rightsLine` (no theme, a 404, an older stack) shows no `rights` part.

Why this way (the requirement is "the operator configures the theme in the admin"):

- A change in the admin reaches every host page within the cache time (300 s), with no edit on any host.
- The host keeps the final word in its own CSS, with normal CSS rules.
- The player never touches host CSS. A `<link>` or `<style>` in the host `<head>` would leak rules into the host page.
- JSON is data. A stylesheet from the admin could hold any selector and break the player's layout. Also, the private CSS names inside the bundle stay private.

### 3.3 Parts

The player exposes named elements in its shadow tree with the `part` attribute. A host styles them with `::part()` (MDN, `::part`; Baseline since July 2020):

```css
annoudio-player::part(annotate-link) { font-weight: 700; }
annoudio-player::part(story active) { outline: 2px solid currentColor; }
```

| Part | What it is |
|---|---|
| `player` | The outer frame. Holds all other parts. |
| `controls` | The row with the play button, the time and the timeline. |
| `play-button` | The play and pause button. |
| `time` | Current time and duration, as text. |
| `timeline` | The seek track. Holds `waveform` and the `region` parts. |
| `waveform` | The waveform drawing. Present only when the player has waveform data (section 6, request 5). |
| `region` | One story's time range on the timeline. One per story. |
| `stories` | The list of stories. |
| `story` | One story in the list. |
| `story-text` | The text body of a story. |
| `story-media` | A sound, image or video body of a story: a media element with controls for a sound or a video, an image for an image. One per media body. Added 2026-10-09, additive. |
| `story-meta` | The nickname, date and time range of a story. |
| `tag` | One tag label of a story. |
| `annotate-link` | The Annotate link. Absent when `annotate="none"`. |
| `replies` | The list of replies under a story (6, rule 12). Present only for a story with replies. It shows when its story is open. Added 2026-10-09, additive. |
| `reply` | One reply in `replies`. Added 2026-10-09, additive. |
| `reply-text` | The text body of a reply. A sound, image or video body of a reply is a `story-media` part. Added 2026-10-09, additive. |
| `reply-meta` | The nickname and date of a reply. Added 2026-10-09, additive. |
| `reply-link` | The Reply link of a story (7.3). It shows when its story is open. Absent when `annotate="none"`. Added 2026-10-09, additive. |
| `rights` | The rights statement of the project (3.2, rule 7), once, below `stories`. A link when the project has a licence address. Absent when the project has no rights statement. Added 2026-10-09, additive. |
| `message` | A plain-language message: an error (section 9), a note (section 7.2), or the note of an empty container ("No stories yet. Tell the first one."). The empty note added 2026-10-09, additive. |
| `active` | A second part name on the `region` and `story` of the story that is open. Use it as `::part(story active)`. |

Rules:

1. A host needs no `exportparts` for any part. The parts can be in nested shadow trees inside the player; that is implementation.
2. Each name in this table stays, with the same meaning, for all of v1.
3. These are not stable: the element type behind a part, the order of parts, elements without a part name, and the private CSS inside the shadow tree. A host that styles `display` or `position` of a part does so at its own risk.
4. The host page's CSS does not reach into the shadow tree, except through tokens and parts (MDN, "Using shadow DOM"). The player's CSS does not reach out.
5. The host can style the element itself: `display`, `width`, `margin`, `max-width`. The default is `display: block` at the full width of its container. `hidden` hides it.
6. Media bodies add the part `story-media` (added 2026-10-09, additive). New parts are not a breaking change.
7. Reply threads add the parts `replies`, `reply`, `reply-text`, `reply-meta` and `reply-link` (added 2026-10-09, additive).
8. The project frame adds the part `rights` (added 2026-10-09, additive).

---

## 4 Events, the method and the property

### 4.1 Events

The player dispatches `CustomEvent`s on the element itself. Each event has `bubbles: true`, `composed: true` and `cancelable: false`. So a host can listen on the element, on `document`, or across its own shadow roots.

Each `detail` is a plain object. Every `detail` has `project` and `recording` (strings, or `null` when the attribute is missing). Times are seconds as numbers.

| Event | When | `detail` |
|---|---|---|
| `annoudio:ready` | Once per start (section 2.1, rule 1), when the controls show and the stories request has settled. It does not wait for audio data: iOS can load no audio data before a tap. | `{ project, recording, stories, duration }`. `stories`: number of published stories, or `null` if they did not load. `duration`: seconds, or `null` if not yet known. |
| `annoudio:error` | Each time an error mode in section 9 occurs. | `{ project, recording, code, message }`. `code`: one value from table 9. `message`: the English text, for logs. |
| `annoudio:play` | Playback starts. | `{ project, recording, time }` |
| `annoudio:pause` | Playback stops: the visitor pauses, the audio ends, or another player starts. | `{ project, recording, time, ended }`. `ended`: `true` when the audio reached its end. |
| `annoudio:story-open` | The visitor opens a story (on the timeline or in the list), or the return fragment opens it (7.2, `annoudio-reply`). Not when playback only passes through a story's range. | `{ project, recording, story, start, end }`. `story`: the story IRI (`id` in WADM). |
| `annoudio:annotate` | The visitor follows the Annotate link or a Reply link (7.3), before the browser leaves the page. | `{ project, recording, time, href, story }`. `href`: the full Annotate URL. `story`: the IRI of the story that the Reply link answers, or `null` for the Annotate link. `story` and the Reply link added 2026-10-09, additive. |
| `annoudio:timeupdate` | The value of `currentTime` (4.3) changes: during playback, and after a seek. At most 4 times per second. Not before `annoudio:ready`. Added 2026-10-09, additive. | `{ project, recording, currentTime }`. `currentTime`: the new value of the property. |

Rules:

1. A later v1 can add fields to a `detail`. Hosts must ignore fields they do not know.
2. The player dispatches no other `annoudio:*` events in v1.0. A later v1 can add events.
3. `annoudio:timeupdate` waits at least 250 ms after the previous one. When the time changes inside that wait, the player sends one event at the end of the wait, with the newest value. So the last change is never lost.

### 4.2 The method `seek(seconds)`

```js
await customElements.whenDefined("annoudio-player");
document.querySelector("annoudio-player").seek(42);
```

Rules:

1. `seek` moves the playback position to `seconds`. It does not start or stop playback. It returns `undefined`.
2. The player limits the value to 0 and the duration.
3. Before the duration is known, the player keeps the value and applies it when the duration is known. A later `seek` replaces a kept value.
4. A value that is not a finite number has no effect. The player writes one `console.warn`. `seek` never throws.
5. The method exists only after the element is defined. Wait for `customElements.whenDefined("annoudio-player")` first.

`seek` is the only public method. `currentTime` (4.3) is the only public property. Other members of the element object are implementation.

### 4.3 The property `currentTime`

Added 2026-10-09. Additive: a v1 release can add a property (12.2).

```js
await customElements.whenDefined("annoudio-player");
const seconds = document.querySelector("annoudio-player").currentTime;
```

Rules:

1. `currentTime` is a read-only number: the playback position in seconds that the player shows. This is the current time of the media element, or the value of a `seek` that waits for the duration (4.2, rule 3).
2. It is `NaN` before `annoudio:ready` of the current start (2.1, rule 1), and after the element leaves the document. A restart makes it `NaN` again until the next `annoudio:ready`.
3. It has only a getter, as `HTMLMediaElement.duration`. An assignment has no effect. In strict-mode code, the browser throws a `TypeError` for it in the host's own code. Reading it never throws.
4. Use `annoudio:timeupdate` (4.1) to follow it. Do not poll it.
5. Like `seek`, it exists only after the element is defined. After `bundle-unavailable` (5, step 7), the fallback element has neither `seek` nor `currentTime`.

---

## 5 The loader

`/embed/v1.js` is a small classic script. It does these steps, in this order:

1. It reads its own URL (section 2.3).
2. If `window.customElements` does not exist, it stops. Fallback content stays visible.
3. If `customElements.get("annoudio-player")` returns a definition, it stops. This makes a second copy of the snippet safe.
4. It calls `import()` with the absolute URL of the current bundle, `{origin}/embed/v1/<hash>/player.js`. A classic script can use `import()` (MDN, `import()`). The browser evaluates one module URL once, so two loaders of one organisation share one bundle.
5. The bundle checks `customElements.get` again and then calls `customElements.define("annoudio-player", …)` once. JavaScript runs one task at a time, so the check and the define cannot interleave. `define` throws `NotSupportedError` for a name that is already defined (MDN, `CustomElementRegistry.define`). The check prevents this.
6. The browser upgrades every `<annoudio-player>` already in the document. It runs the start steps for each one. Elements added later start when they connect.
7. If the import fails (network, 404, CORS, content security policy), the loader defines a small fallback element with the same name. It shows the message for `bundle-unavailable` (section 9) and dispatches `annoudio:error`.

Rules:

1. The loader and the bundle never throw into the host page. Every callback catches its own errors. An error becomes an error mode in section 9 and one `console.warn` that starts with `annoudio:`.
2. The loader and the bundle create no global variables and change no built-in objects. The only global change is the one entry in `customElements`.
3. They add nothing to the host document outside the element: no `<style>`, no `<link>`, no other elements.
4. They do not use cookies, `localStorage`, `sessionStorage` or IndexedDB.
5. They do not change the host page's URL or history.
6. The shadow root is `open`. Its content is still implementation (section 3.3, rule 3).
7. When the element leaves the document, the player stops playback and cancels its open requests.
8. When one player starts playback, all other players on the page that the same bundle defined pause.
9. Hosts must not link to a hashed bundle. Its URL is not part of the contract and it can disappear.

### 5.1 Response headers

| Path | `Cache-Control` | Other headers |
|---|---|---|
| `/embed/v1.js` | `public, max-age=300, stale-while-revalidate=3600` | `ETag` |
| `/embed/v1/<hash>/player.js` | `public, max-age=31536000, immutable` | |
| `/embed/v1/themes/{project}.json` | `public, max-age=300, stale-while-revalidate=86400`; on 404: `public, max-age=60` | `ETag` |
| `/embed/v1/recordings/{project}/{id}.json` | as the theme route | `ETag`. Added 2026-10-09, additive. |

All four paths send `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin` and `X-Content-Type-Options: nosniff`. The bundle needs CORS: the browser fetches modules with the CORS protocol (MDN, `<script>`, `type="module"`). `Cross-Origin-Resource-Policy` lets hosts with `Cross-Origin-Embedder-Policy: require-corp` load the files. JavaScript files use `Content-Type: text/javascript; charset=utf-8`.

A release keeps the bundles of the two releases before it. Reason: a browser can use a cached loader for up to 3900 s, and that loader names an older hash.

### 5.2 The recording JSON

Added 2026-10-09, additive. A route of the stack for CMS plugins (the WordPress block and the Omeka S module), not a request of the player:

```
GET {origin}/embed/v1/recordings/{project}/{id}.json
```

```json
{ "id": "1", "title": "Ferry crossing, 1962", "url": "https://archive.example/f.mp3", "duration": 1834 }
```

Rules:

1. `id` is the recording number of the catalogue (the `recording` attribute). `url` is the first audio address of the recording: the value for `src`. `duration` is in seconds, or `null` when the catalogue does not know it.
2. Anonymous, `Access-Control-Allow-Origin: *`, the headers of 5.1. An `If-None-Match` with the current `ETag` gives 304.
3. 404 (with the 60 s cache rule) for an unknown project, an unknown recording, or a file name that is not `{number}.json`. A known project serves every recording of the catalogue: the catalogue is organisation-wide.
4. The shape follows 3.2, rule 6: the stack can add keys; it cannot remove or rename them within v1.

---

## 6 Network contract

The player makes only these requests. It makes no other request: no analytics, no fonts, no third-party hosts.

| # | Request | When | Kind |
|---|---|---|---|
| 1 | `GET {loader origin}/embed/v1/<hash>/player.js` | Once per page. | Module import. CORS. No credentials. |
| 2 | `GET {origin}/embed/v1/themes/{project}.json` | Once per project per page. | `fetch`, simple CORS request. |
| 3 | `GET {origin}/stories/{project}/{recording}/` | Once per instance per page. | `fetch`, simple CORS request. |
| 4 | `GET` of each `next` page link in the stories responses | Only when an instance has more stories than one page holds. | `fetch`, simple CORS request. |
| 5 | `GET {src}` for waveform data | Once per player, only when the audio host sends CORS headers. | `fetch`, simple CORS request. |
| 6 | The audio, `{src}` | When the browser's media element loads it. | Media element request, made by the browser. |
| 7 | Sound, image or video bodies of stories | A sound: when the visitor plays it (`preload="none"`; WebKit can still get the file once). An image: when it comes near the viewport (`loading="lazy"`). A video: its metadata, when the story list shows. Changed 2026-10-09, additive. | Media element or image request, made by the browser. No `crossorigin`. Only `http:` and `https:` body URLs. |

Rules:

1. Requests 2 to 5 are plain GETs. They send no `Prefer` header and no `Accept` header with `profile="…"`. Either one forces a CORS preflight for every URL (`design/stories-interface-C-common-caller.md` §1.8). The player sets no custom request headers. The browser's own cache can add `If-None-Match`; that does not cause a preflight.
2. The player's `fetch` calls use `credentials: "omit"` and `mode: "cors"`. So they send no cookies.
3. The media element has no `crossorigin` attribute. So any audio host works, also one without CORS. The browser applies its own cookie rules to media requests. The player does not read or set them.
4. The stack never reads or sets a cookie on the routes in requests 1 to 4. The player never knows if a visitor is signed in (`CONTEXT.md`, fixed decisions).
5. The player reads the stories with the URL scheme of `design/stories-interface-C-common-caller.md` §1.1 and nothing else. It percent-encodes `project` and `recording`.
6. The player follows a `next` link only when it has the same origin as the container. It follows at most 20 `next` links. If a page fails, the player shows `stories-unavailable`.
7. Two players with the same instance on one page share one stories request. Two players with the same project share one theme request.
8. For request 5, the player aborts the fetch when `Content-Length` is missing or above 20 000 000 bytes. Then it draws the timeline without a waveform. This limit is implementation and can change. Request 5 can download the audio a second time; that is the cost of a waveform.
9. The player ignores story bodies of a type it does not know. It skips a story whose selector it cannot read, with one `console.warn`.
10. The player puts story text into the page with `textContent` only (stories invariant 7). It sets `lang` on each text body from the body's `language`.
11. The player shows each `Sound`, `Image` and `Video` body with an `http:` or `https:` `id` as one `story-media` part, after the text of its story. An image has the first text body of its story as `alt` (every media body comes with a short text). Playing a sound or a video body pauses the recording. Added 2026-10-09, additive.
12. Replies (added 2026-10-09, additive). A reply is a WADM annotation with `motivation: "replying"` and the story IRI as its `target` (a plain IRI). The stack serves the published replies of a story inside its page item, under the key `annoudio:replies`: an array of complete annotations without `@context`, oldest first. A page or container that holds such an item adds one extension context object: `"@context": ["http://www.w3.org/ns/anno.jsonld", …, { "annoudio:replies": { "@reverse": "oa:hasTarget" } }]`. So for a JSON-LD processor each value is an annotation whose target is the item, which the reply says itself; the key adds no other statement (`design/phase5b-notes.md`). The player reads a value only when its `motivation` is `replying` and its `target` is the item's `id`. It shows the replies of the open story in the `replies` part, in array order, with the rules 9 to 11 of a story. Tags of a reply are ignored. The `?iris=1` variants list the story IRIs only; `total` counts the stories, not the replies. Each published reply is also at its own IRI, as a complete annotation.

---

## 7 The Annotate link

### 7.1 The link

When `annotate="link"`, the player shows a normal `<a href>` link. It opens in the same tab:

```
{origin}/annotate?project={project}&recording={recording}&t={seconds}&return={page}
```

| Parameter | Value |
|---|---|
| `project`, `recording` | The attribute values, percent-encoded. |
| `t` | The current playback time, rounded down to a whole second. `0` before playback. |
| `return` | `encodeURIComponent` of the host page URL without its fragment. The player leaves out `return` when the encoded value is longer than 2000 characters. |

The `href` always holds the current time when the visitor follows the link. The player does not add a session, a token or any other parameter.

### 7.2 The return to the host page

The Annotate page sends the member back to `return` with this fragment:

```
#annoudio-t=42&annoudio-project=river-voices&annoudio-recording=rec-0042&annoudio-saved=draft
```

| Key | Meaning |
|---|---|
| `annoudio-t` | Seconds, a non-negative decimal with at most 3 decimal places: the start of the member's story, or the `t` the member came with. |
| `annoudio-project`, `annoudio-recording` | The instance. |
| `annoudio-saved` | Optional. `draft` means the member saved a story that waits for review. `published` means the save published it at once (the project publishes each story at once); added 2026-10-09, additive. |
| `annoudio-reply` | Optional. The story id of a story that the member answered (7.3). Added 2026-10-09, additive. |
| `annoudio-story` | Optional. The id of a story to open, with no note: a link from a mail or the admin ("Listen on the site", "Open on the site"). Added 2026-10-09, additive. |

When the player starts, it reads `location.hash` as URL search parameters. The first player in document order whose `project` and `recording` match does these steps:

1. It seeks to `annoudio-t` (as `seek`).
2. It scrolls itself into view, with no smooth scroll.
3. It moves focus to its `play-button`.
4. If `annoudio-saved=draft`, it shows a note in the `message` part: "Your story is sent. It shows here after review." With `annoudio-reply`, the note is "Your reply is sent. It shows here after review." If `annoudio-saved=published` (added 2026-10-09, additive), the note is "Your story is published. It can take one minute to show." (a reply: "Your reply is published. …"): a cache can keep the old list for up to `STORIES_MAX_AGE`.
5. If `annoudio-reply` names a story of its container, it opens that story (as a visitor does: it seeks to the start and dispatches `annoudio:story-open`), so the thread shows. This happens before steps 2 and 3. Added 2026-10-09, additive.
6. If `annoudio-story` names a story of its container, it opens that story in the same way as `annoudio-reply`, with no note. A reply id opens nothing. Added 2026-10-09, additive.

The player does not start playback. It does not remove the fragment from the URL. Other players ignore the fragment. Fragment keys that start with `annoudio-` are reserved for the player. A host page that uses the fragment for its own routing loses that state on return.

Why a fragment: the browser does not send it to the host's server. So it does not change server caches and does not need host code.

### 7.3 The Reply link

Added 2026-10-09, additive. When `annotate="link"`, the open story shows a Reply link in its thread, a normal `<a href>` that opens in the same tab:

```
{origin}/annotate?project={project}&recording={recording}&t={start}&replyTo={id}&return={page}
```

| Parameter | Value |
|---|---|
| `t` | The start of the story, rounded down to a whole second. |
| `replyTo` | The story id: the last path segment of the story IRI. The player shows a Reply link only for a story whose IRI is `{container IRI}{id}`. |
| `project`, `recording`, `return` | As in 7.1. |

The Annotate page shows the story above a text box and sends the member back with the fragment of 7.2, with `annoudio-reply={id}`.

---

## 8 Invariants

1. The player never renders blank. When it cannot work, it shows a plain-language message in the `message` part (section 9). The one exception: the loader did not run at all. Then only fallback content can show (section 1, rule 5).
2. The player shows only published stories. It cannot show a draft: the read routes never return one.
3. The player never writes. Writes happen only on the Annotate page.
4. The player has the same behaviour on every host page. It has no per-host configuration other than attributes and CSS.
5. The player never changes the host page outside its own element, except the one `customElements` entry.
6. Stories show in timeline order, as the container gives them. The player does not sort.

---

## 9 Error modes

Each error shows a message in the `message` part, in the player's UI language, and dispatches `annoudio:error`. The player also writes one `console.warn` with the code and the details for the site owner.

| `code` | Cause | What the player does | Message (English) |
|---|---|---|---|
| `missing-attribute` | `project`, `recording` or `src` is missing or empty. | Shows only the message. No requests. | "This audio player is not set up correctly. The `project` value is missing." (names the attribute) |
| `invalid-attribute` | `src` is not an `http:` or `https:` URL, or `origin` is not an origin. | Shows only the message. No requests. | "This audio player is not set up correctly. The `src` value is not a web address." |
| `not-found` | The stories route answers 404: unknown project or recording. | Plays the audio. Hides the Annotate link. | "Stories for this recording are not available." |
| `stories-unavailable` | Network error, CORS failure, a status other than 200, 304 or 404, or a body that is not a container. | Plays the audio. Keeps the Annotate link. | "Stories could not load. Reload the page to try again." |
| `audio-unavailable` | The media element reports an error, for example 404 or a format the browser cannot play. | Shows the stories without a timeline. | "The audio could not load." |
| `bundle-unavailable` | The loader could not import the bundle. | Shows only the message (section 5, step 7). | "The audio player could not load. Reload the page to try again." |

Rules:

1. Within v1, the stack can add codes. Hosts must treat an unknown code as an error.
2. The message text is not part of the contract. The codes are.
3. A missing project theme is not an error (section 3.2, rule 4). A missing waveform is not an error.

---

## 10 Performance

1. `v1.js` is at most 1 KB after gzip. The bundle is at most 80 KB after gzip.
2. The loader blocks nothing: `async` fetches it in parallel with parsing (MDN, `<script>`, `async`).
3. With one page of stories, a player needs three requests on a cold cache: bundle (once per page), theme (once per project), container. The audio streams with `preload="metadata"`.
4. Requests 2 and 3 start at the same time. The audio request does not wait for them.
5. The player does no work for the timeline before it is near the viewport. It does fetch its stories, so `annoudio:ready` can fire.
6. Updates during playback use `requestAnimationFrame`. The player does not update when its tab is hidden.
7. A new published story shows on host pages after at most `STORIES_MAX_AGE` seconds (default 60). The browser cache does this. The player has no cache of its own.

---

## 11 Accessibility

The player meets WCAG 2.2 level AA with its default tokens. In detail:

1. Keyboard: every control is a native `<button>`, `<a>` or `<input type="range">`. Tab reaches each one in visual order. The timeline is the range input: Left and Right arrows move 5 s, Page Up and Page Down move 30 s, Home and End go to the start and the end.
2. Each story is reachable from the keyboard in the `stories` list. The timeline regions are a second way to reach them, not the only way.
3. Labels: every control has an accessible name in the UI language ("Play", "Pause", "Seek"). The timeline has `aria-valuetext`, for example "0:42 of 3:10". Each story has a name, for example "Story by Leela, 0:42 to 0:51". The frame is a group named with the container `label` (the recording title), or "Audio player" if there is none.
4. Focus: a visible focus ring of at least 2 px in `--annoudio-color-focus`, at least 3:1 against the surface with default tokens.
5. Target size: every control is at least 24 × 24 CSS px.
6. Reduced motion: with `prefers-reduced-motion: reduce`, the player has no transitions, no animated scroll and no animated waveform. The playback position still moves, because it is information.
7. Contrast: see section 3.1, rule 6.
8. Forced colours: see section 3.1, rule 5.
9. No autoplay. Nothing plays until the visitor starts it.
10. Reflow: the player works at 280 CSS px wide and at 200 % text size with no horizontal scroll inside it.
11. Messages in the `message` part use `role="status"`, so a screen reader reads them without a focus move.
12. Language: the player's own text has the UI language. Each story text has its own `lang` (section 6, rule 10).

---

## 12 Versioning

### 12.1 The rule

The contract is v1. It has the path `/embed/v1.js` and the tag name `annoudio-player`. Every release of Annoudio serves `/embed/v1.js` with the v1 contract, also after v2 exists. A breaking change makes v2: a new path `/embed/v2.js` and a new tag name. So a v1 snippet and a v2 snippet can be on one page.

### 12.2 What is breaking

Breaking (needs v2):

- Remove or rename an attribute, token, part, event, `detail` field, error code or theme JSON key.
- Change the meaning or type of any of them.
- Make an optional attribute required, or remove a value of `annotate`.
- Change a default behaviour: for example, the default of `annotate`, the default origin, the Annotate URL, the return fragment, the order of strength in section 3.1.
- Remove the method `seek` or change what it does.
- Add a request that hosts must allow in their content security policy, to a new host.

Not breaking (a v1 release can do it):

- Add an optional attribute, a token, a part, an event, a `detail` field, an error code, an `annotate` value or a theme JSON key.
- Make a required attribute optional.
- Change implementation: the bundle, the DOM inside the shadow tree, the message texts, internal limits.
- Change a default token value to fix an accessibility failure. The release notes say so.

### 12.3 Deprecation

1. A deprecated item keeps working until the end of v1.
2. The changelog and this file name each deprecated item, the date, and the replacement.
3. When a page uses a deprecated item, the player writes one `console.info` per page per item. It starts with `annoudio:` and names the replacement.

### 12.4 Prior art (research §9)

- Hypothesis (`https://hypothes.is/embed.js`) and Plausible keep one loader URL and ship fixes behind it. Plausible kept its old script working when it made a new one in October 2025. Annoudio takes the stable loader and the hashed bundle from them.
- YouTube's IFrame API retires features with dated notices, not new URLs. Annoudio takes the dated deprecation notice.
- Disqus and giscus put the contract in attributes or a config object, not in the script internals. Annoudio does the same: attributes, tokens, parts, events.
- None of them puts a version in the loader path. Annoudio does, for two reasons. Each organisation runs its own copy and upgrades at its own time, so no central party can move all hosts at once. And a version in the path and the tag name lets v1 and v2 run on one page.

---

## 13 Host notes

These are facts about host platforms. Phase 2 tests them. They are not promises.

- Content security policy: a host with a CSP must allow the origin in `script-src` and `connect-src`, and the audio host in `media-src` and `connect-src`. Image and video bodies (Phase 4) also need `img-src` and `media-src`. A strict `style-src` does not block the player's styles: they are constructed stylesheets. The browser reports one `style-src-elem` violation per player for an internal `<style>` element; it has no effect. If `src` is on a host without CORS, browsers log one or two console errors for the waveform request. The player works without a waveform.
- WordPress: a hand-pasted `<script>` survives only for users with the `unfiltered_html` capability (Custom HTML block). The WordPress block (Phase 7) removes this need.
- Omeka S: the HTML purifier setting can remove `<script>` and unknown elements from page content. The Omeka S module (Phase 7) removes this need.

---

## 14 Alternatives considered

| Alternative | Decision | Reason |
|---|---|---|
| An `<iframe>` from the origin instead of a custom element | Rejected | Fixed height, no theming by host CSS, no `::part`, `postMessage` for events. It does not give the session back either: Safari blocks third-party cookies (research §2). |
| No version in the path (`/embed.js`), as Hypothesis, Disqus, giscus | Rejected | Section 12.4. |
| A pinned bundle URL in the snippet, with `integrity` | Rejected | No fix reaches a pasted snippet. The snippet lives for years. |
| `src` optional, with a catalogue lookup | Deferred | Section 2.2. It can come in a later v1 without a break. |
| A `theme` attribute, or tokens inside the stories container | Rejected | A pasted attribute cannot change later. The container is Web Annotation Protocol data for all clients, not presentation. |
| The project theme as a stylesheet (`theme.css`) | Rejected | Arbitrary CSS can break the player and ties the stack to private CSS names. JSON tokens do neither (section 3.2). |
| Automatic dark mode | Rejected | The player must match the host page, not the operating system (section 3.1, rule 4). |
| Properties that mirror the attributes, or `play()`, `pause()` | Deferred | No v1 caller needs them. `seek` covers the return case and transcript links. Adding them later is not breaking. `currentTime` was added on 2026-10-09 (4.3): the Annotate page needs the time to fill a story range. |
| A cancelable `annoudio:annotate` | Deferred | A host could then stop a member from leaving to write a story. A later v1 can make it cancelable. |
| A query parameter instead of a fragment on return | Rejected | Section 7.2. |
| The player reads a session to show "signed in as" | Rejected | The player never knows about sessions (`CONTEXT.md`). |

---

## 15 Dependencies outside the `player` module

These follow from this contract. They are not done here.

1. `CONTEXT.md`, module map, `player` row: add the theme route `GET {origin}/embed/v1/themes/{project}.json` as a dependency. The `projects` collection needs the theme token fields that this route serves.
2. `annotate-page`: it must send the member back with the fragment in section 7.2. It must accept `return` only for `http:` and `https:` URLs, or it is an open redirect. Recommendation: a list of allowed site origins per project.
3. `deploy`: the stack must keep the bundles of two earlier releases (section 5.1). The domain in the snippet must stay stable for years (research §9, main risk).
4. Phase 1 "done when" pastes this snippet into a bare HTML file. That needs a stub `v1.js` that defines the element and shows `missing-attribute` and `not-found` correctly.

---

## 16 Contract tests

These run in Phase 2 against a fixture server, in Chromium, Firefox and WebKit. They use only the public surface.

1. The snippet on a bare page makes no console errors, and the requests match section 6 exactly.
2. Two copies of the loader on one page define the element once and fetch the bundle once.
3. Each row of table 9 shows its message and dispatches `annoudio:error` with its code.
4. A token set on `:root` changes the player. A project theme changes it. The host token wins over the project theme.
5. Each part in table 3.3 can be styled with `::part()`. Host CSS for `button` does not change the player. The player's CSS does not change host elements.
6. Each event in table 4.1 fires with the documented `detail`. `currentTime` is `NaN` before `annoudio:ready` and follows playback and `seek`; `annoudio:timeupdate` fires at most 4 times per second.
7. The Annotate link carries the current `t` and `return`. The return fragment seeks the matching player only, and shows the draft note.
8. Keyboard only: play, seek, open a story, follow the Annotate link. Axe finds no violations with default tokens.
9. Reply threads (added 2026-10-09): the thread shows only under the open story, in order, as text; reply media bodies are `story-media` parts; the Reply link carries `replyTo` and the story start, and fires `annoudio:annotate` with `story`; `annotate="none"` hides every Reply link; the fragment with `annoudio-reply` opens the story and shows the reply note; axe finds no violations with an open thread.
10. The project frame and the new fragment keys (added 2026-10-09): a theme with `rightsLine` and `rightsIri` gives one `rights` part below the stories, a link to the licence; a theme without them gives none; an empty container shows its note in `message` and keeps the Annotate link; `annoudio-saved=published` shows the published note; `annoudio-story` opens the story with no note; axe finds no violations in these states.
