# Phase 2 notes: the `player` module

Date: 2026-10-09. Scope: `ROADMAP.md` Phase 2, the read side. Code: `embed/`. Build output: `app/public/embed/`. Test hosts: `deploy/test-hosts/`.

This file lists what the build does differently from `CONTRACT.md`, what the tests do not prove, and the answer to the CSP question of CONTRACT 13.

## 1 Result

| Check | Result |
|---|---|
| `pnpm build` | Loader 759 B gzip (limit 1024). Bundle 30 467 B gzip (limit 81 920). |
| `pnpm typecheck`, `pnpm lint` | Pass. |
| Playwright, Chromium 156 | 77 pass. |
| Playwright, Firefox 157 | 75 pass, 2 skipped (build size check runs once; forced-colors emulation is Chromium only). |
| Playwright, WebKit 27.2 (WPE, Linux) | 75 pass, 2 skipped (same two). |
| Static page, WordPress 7.1.3, Omeka S 4.2.1 | Each passes in all three browsers: stories show, `annoudio:ready` fires, no console errors, no CSS leak in or out, correct Annotate `href`, the return fragment seeks and focuses with no autoplay. |

## 2 Deviations from CONTRACT.md

Each item says what the build does, why, and a proposed contract change where one is needed.

### 2.1 Region parts live in a nested shadow tree (CONTRACT 3.3, rule 1)

wavesurfer.js puts its timeline, and the regions plugin puts every region, inside its own open shadow root. The player sets `exportparts="region, active"` on that inner shadow host. A host writes `annoudio-player::part(region)` and `::part(region active)` with no `exportparts` of its own. The tests prove this in all three browsers.

The rule "All parts are in one shadow tree" is not literally true. Proposed text for 3.3 rule 1: "A host needs no `exportparts` for any part. The parts can be in nested shadow trees inside the player; that is implementation."

### 2.2 The return fragment scrolls and focuses when the player is ready (CONTRACT 7.2)

The player reads the fragment and keeps the seek when it starts. It scrolls itself into view and focuses `play-button` only when its own stories show (the moment of `annoudio:ready`). Reason: before that, the player's height changes and the scroll position is wrong. A player above it on the same page can still grow later and move it. No contract change.

### 2.3 Paging limit and page errors (CONTRACT 6, rule 6)

"Follows at most 20 pages" is read as "follows at most 20 `next` links", so the player reads at most 21 pages. A `next` page that fails makes the whole instance `stories-unavailable`. The player does not show a part of the stories without the note. Proposed text: "It follows at most 20 `next` links. If a page fails, the player shows `stories-unavailable`."

### 2.4 Request 5 to an audio host without CORS logs a browser console error (CONTRACT 6, rule 8; 16.1)

The player cannot know before it asks whether the audio host sends CORS headers. When the host does not, the waveform fetch fails and the browser itself logs it: Chromium logs 2 errors ("blocked by CORS policy", "net::ERR_FAILED"), Firefox 1, WebKit 2. The player catches the failure and draws the timeline without a waveform; it logs nothing of its own. So "no console errors" holds only when `src` sends CORS headers. The stack's own media (the `media` module) must send `Access-Control-Allow-Origin: *`.

Proposed text for CONTRACT 13: "If `src` is on a host without CORS, browsers log one or two console errors for the waveform request. The player works without a waveform."

An alternative is to send request 5 only when `src` has the same origin as `origin`. That removes the errors but also removes waveforms for other CORS hosts. Not done: it changes CONTRACT 6.

### 2.5 Smaller points

1. `origin` with one trailing `/` (`https://org.example/`) is accepted as an origin. Any other path is `invalid-attribute`.
2. `Sound` bodies do not show. They are a known type, so the player does not warn. The media parts come in Phase 4 (CONTRACT 3.3, rule 6).
3. A click on a region opens the story and seeks to the story start, not to the click point.
4. `annoudio:ready` usually has `duration: null` on a cold load, because the stories arrive before the audio metadata. The contract allows this.
5. A theme or stories result stays for the life of the page (one request per page, CONTRACT 6 rule 7). If every player that waits for an unsettled request leaves, the request is aborted.
6. The region fill shows at 60 % opacity, so the waveform shows through it. The colour on screen is lighter than `--annoudio-color-region`. CONTRACT 3.1 rule 6 does not list the region colour, so no contract text changes.
7. The `message` part can hold more than one note (for example an error and the "saved" note). They show in one paragraph.
8. The `annotate` warning for an unknown value repeats on each display update (`annotate` or `lang` change), not once per page.
9. Each story button has the accessible name "Story by Leela, 0:02 to 0:04". Its visible text is "Leela · 0:02–0:04 · Oct 8, 2026". axe passes. WCAG 2.5.3 (label in name) wants the visible text inside the name; check this with a screen reader user before v1.0.

## 3 The CSP `style-src` question (CONTRACT 13)

Question: does a strict `style-src` block constructed stylesheets?

Test: `tests/player.spec.ts`, "content security policy". The host page sends:

```
Content-Security-Policy: default-src 'none'; script-src ORIGIN; connect-src ORIGIN;
  media-src ORIGIN; style-src 'self'; img-src 'self'
```

Answer, in Chromium 156, Firefox 157 and WebKit 27.2:

1. `style-src` without `'unsafe-inline'` does **not** block constructed stylesheets (`new CSSStyleSheet()`, `replaceSync`, `adoptedStyleSheets`). The base styles and the project theme apply.
2. It does block the `<style>` element that wavesurfer.js 8.0.2 writes into its own shadow root. Each browser reports a `style-src-elem` violation. Without that element, the waveform layout broke: the progress layer fell below the timeline.
3. Fix in the player: it adopts a copy of those layout rules as a constructed sheet into wavesurfer's shadow root (`src/styles.ts`, `WAVE_CSS`). A test checks that nothing overflows the timeline under this CSP. The violation report stays, because wavesurfer still adds the element.
4. Styles that the player and wavesurfer set through the CSSOM (`element.style.x = …`) are not blocked.

Proposed text for CONTRACT 13, in place of "Unverified: …": "A strict `style-src` does not block the player's styles: they are constructed stylesheets. The browser reports one `style-src-elem` violation per player for an internal `<style>` element; it has no effect."

When wavesurfer.js is upgraded, compare `WAVE_CSS` with its `renderer.js` `initHtml()` again.

## 4 Host facts checked (CONTRACT 13)

| Host | What happens to the snippet | Test |
|---|---|---|
| WordPress 7.1.3, administrator, Custom HTML block | Kept as pasted. The player works. | `hosts.spec.ts` |
| WordPress 7.1.3, author (no `unfiltered_html`) | `<script>` and `<annoudio-player>` are both removed on save. | `hosts.spec.ts`, "host notes" |
| Omeka S 4.2.1, page HTML block, HTML purifier on (default) | `<script>` and `<annoudio-player>` are both removed on save. | `hosts.spec.ts`, "host notes" |
| Omeka S 4.2.1, HTML purifier off | Kept as pasted. The player works. | `hosts.spec.ts` |

The Omeka S page is written through the Omeka API manager as the administrator (`deploy/test-hosts/omeka-page.php`). That path runs the same block hydration and purifier as the admin form. The WordPress page is written with WP-CLI `--user=admin` / `--user=author1`, which runs the same `kses` filters as the editor.

Omeka S image: there is no maintained official image (`omeka/omeka-s` was last pushed in 2017). The stack uses `giocomai/omeka-s-docker:v4.2.1` (pushed 2026-09-27), which installs Omeka S without the web installer.

## 5 Dependencies outside this module (not done here)

1. **The app does not send the CONTRACT 5.1 headers.** Next.js serves `app/public/embed/` with its own static headers: no `Access-Control-Allow-Origin`, no `Cross-Origin-Resource-Policy`, no one-year `immutable` for the bundle, no 300 s for the loader. The bundle import needs CORS. Somebody must add these headers in `app/next.config.ts` (`headers()`) or in a route. The fixture server shows the exact set.
2. **The theme route** `GET /embed/v1/themes/{project}.json` does not exist in the app yet (`projects` module).
3. **The stories routes**: the player is tested against the fixture shape of design C 1.1 and 1.2 only. When the `stories` module lands, point one test at the real routes.
4. **The Annotate page** (`/annotate`) does not exist yet (Phase 3).
5. CONTRACT 15.4 (the stub `v1.js` for Phase 1) is now the real build output in `app/public/embed/`.

## 6 Not verified

1. Real Safari on macOS and iOS. WebKit here is Playwright's WPE build on Linux. iOS can load no audio data before a tap; that path is not tested.
2. Forced colours in Firefox and WebKit, and Windows high contrast. Only Chromium emulation is tested.
3. Screen reader output (NVDA, VoiceOver). Only axe and accessible names are tested.
4. The 20 MB waveform limit with a large real file, and decode memory for long recordings.
5. 200 % text size. Only 280 CSS px reflow is tested.
6. Contrast of theme values that a project sets (the player does not check them, by contract).
7. Revalidation (`304`) through the browser cache, and behaviour behind a CDN.
8. Two organisations on one page beyond one `origin` test.

## 7 Changes to this machine

1. `embed/` uses Playwright 1.64.0, not the app's 1.58.2: 1.58.2 does not support Ubuntu 26.04. When it installed its browsers, Playwright removed three browser folders that no installed Playwright referenced: `chromium-1243`, `chromium_headless_shell-1243` and `firefox-1543` in `~/.cache/ms-playwright`. Another project that needs them must run `playwright install` again.
2. `scripts/webkit-deps.sh` copied `libmanette-0.2.so.0` and `libhidapi-hidraw.so.0` into `~/.cache/ms-playwright/webkit-2370/minibrowser-wpe/sys/lib`. No system package was installed.
3. The compose stack `annoudio-hosts` runs (WordPress on `127.0.0.1:8091`, Omeka S on `127.0.0.1:8092`) with four named volumes. Stop it with `docker compose -f deploy/test-hosts/docker-compose.yml down`.
