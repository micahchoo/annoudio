# Unverified

Date: 2026-10-09 (closing pass). This file collects every "not verified", "unverified" and "not tested" item of `design/phase*-notes.md` that is still open. No automated test checks these items. Each row gives the cheapest check and what the check needs:

- **device**: a real phone, a Mac, or a browser that Playwright does not run;
- **server**: a real VPS, a real proxy, a real SMTP or a real CDN;
- **person**: a person who does the task (an operator, a member, a screen-reader user);
- **time**: a test that waits for the clock;
- **here**: this machine is enough; no one did it yet.

Rows closed by later phases are listed at the end, with the phase that closed them.

## Player (`embed/`)

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| P1 | Real Safari on macOS and iOS. WebKit here is Playwright's WPE build on Linux. iOS loads no audio data before a tap. `currentTime` and `annoudio:timeupdate` are tested in WebKit only. | 2 §6.1, 3b | Open `bare.html` of the player fixture on an iPhone and a Mac over the LAN; tap play; open a story; check the time moves. | device |
| P2 | Forced colours in Firefox and WebKit, and Windows high contrast. | 2 §6.2 | Windows with a high-contrast theme, open the fixture page in Edge and Firefox. | device |
| P3 | Screen reader output (NVDA, VoiceOver). Only axe and accessible names are tested. | 2 §6.3 | A screen-reader user opens a story list and plays one story. | person, device |
| P4 | The 20 MB waveform limit with a large real file; decode memory for long recordings. | 2 §6.4 | Point the fixture at a 60-minute `.m4a`; watch memory in the browser task manager. | here |
| P5 | 200 % text size. Only 280 CSS px reflow is tested. | 2 §6.5 | Set the browser text size to 200 % and open the fixture page. | here |
| P6 | Contrast of theme values that a project sets (the player does not check them, by contract). | 2 §6.6 | None in code. The operator guide can tell operators to check contrast. | person |
| P7 | Revalidation (`304`) through the browser cache, and behaviour behind a CDN. | 2 §6.7, 3b | Put the demo stack behind a CDN; reload a page two times and read the network panel. | server |
| P8 | Two organisations on one page, beyond the one `origin` test. | 2 §6.8 | A static page with two snippets from two stacks (demo :3500 and a second compose stack). | here |
| P9 | Real playback of the derived `.m4a` and `.mp4` in Firefox on Linux without system AAC/H.264. Playwright's Firefox has its own codecs. | 4a, 4b | Distribution Firefox on a Linux machine with no extra codec packages; play a published voice note in the demo. | device |
| P10 | The player on a host page with the published photo of the demo. | 6b | Open the WordPress test host page of the demo and open the photo story. | here |

## Annotate page (members)

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| A1 | Real Safari and iOS recording (`audio/mp4` from MediaRecorder). The recorder test uses Chromium's fake microphone. This is the Phase 4 done-when test. | 4b | Record a voice note on an iPhone in the demo; publish it; play it in Chrome and Firefox. Then record in Chrome and play on the iPhone. | device |
| A2 | The Annotate page, the reply form, Your stories and Your account in Firefox and WebKit. App e2e runs in Chromium only. | 3b, 4b, 5b, 5c | Add `firefox` and `webkit` projects to `app/playwright.config.ts` and run `annotate`, `replies`, `mine` once. | here |
| A3 | Cross-site cookie behaviour from a link on another site (`SameSite=Lax`). The tests open the Annotate page directly. | 3 | Follow the Annotate link from the WordPress test host (another port is another site only with another host name; use `127.0.0.2` or a hosts entry). | here |
| A4 | A hidden concept: the Annotate page filter in a browser. | 5 | One e2e step: hide a concept, open the Annotate page, check the picker. | here |
| A5 | A reply with a media body, end to end. | 5b | One e2e test: reply with a photo, publish, read the player. | here |
| A6 | The 15-minute limit of a voice note is checked by the worker after the upload, not by the recorder. A member can record 20 minutes and lose them. | 4b | A real phone: record 16 minutes. Check the message the member sees. | device, time |
| A7 | Real MediaRecorder files. The fixtures copy their codecs and containers, but they are not browser output. | 4a | Record one file in each browser (A1, P9) and keep it as a fixture. | device |

## Admin (operators)

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| O1 | axe on the Payload lists other than Stories (Projects, Recordings, Concepts, Members, Operators, Media bodies), the project settings form, the concept form and the member page. Their selection checkboxes have no names. | 5c | Add these screens to the axe loop of `app/tests/e2e/lifecycle.e2e.spec.ts`. | here |
| O2 | The admin in the dark theme. | 5, 5c | Set the operator's theme to dark in Account; screenshot each screen of `design/phase5c-screens/`. | here |
| O3 | The theme preview with the operator's real fonts. | 5 | Set a font token to a web font of the pilot site. | here |
| O4 | The browser duration probe in Firefox and Safari, and for an audio address that answers without CORS headers. | 5 | "Add a player" in Firefox and Safari with an address on a server with no CORS headers. | device |
| O5 | The theme form in a browser (the int tests run the same `validate` functions through the local API). | 3b | Type a bad colour in the Theme tab and save. | here |
| O6 | The **Media** column and the Publish error toast of `media-not-ready` in a browser. | 4b | One e2e step: open a story whose body is processing and select Publish. | here |
| O7 | Every task without help from a developer: approve a story, add a term, add a recording, embed it. | ROADMAP Phase 7 | The team trial. | person |

## Media pipeline (worker)

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| M1 | Voice note and video through the production images (6b ran a photo only; 5c e2e uses a fake transcoder). | 6b | In the demo, record a voice note and upload a short video on the Annotate page; read the worker log (it now has one line when a job starts and one when it ends). | here |
| M2 | The worker test suite in the Docker image (ffmpeg 8.1.2). Only the smoke test ran there. | 4a | Run `pnpm test` in a container from the worker image with the test database. | here |
| M3 | Transcode time and memory of a 3-minute 1080p video on a small VPS. The 10-minute ffmpeg timeout is a guess. | 4a | Upload such a video on a 2 vCPU / 4 GB VPS and time the job from the worker log. | server |
| M4 | The tus path behind Traefik (Dokploy): the body size limit and the timeouts of the proxy. | 4b | Upload a 250 MB video through a Dokploy stack. | server |
| M5 | `FileStore.deleteExpired` on a real volume (no test waits one day). | 4b | Start an upload, stop it, check the `media` volume after 24 h. | time |

## Mail

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| E1 | M2, M4 and M5 through a real SMTP server. 6b sent M1, M3, M6 and M7 through Mailpit. | 5c, 6b | In the demo, return a story (M2), publish a reply (M4, M5) and read Mailpit. | here |
| E2 | Deliverability (SPF, DKIM) with the organisation's mail provider. | 5c | Send a login code to a Gmail and an Outlook address from the pilot stack. | server |
| E3 | The real 08:00 digest trigger. The schedule row and one `mail.digest` job are tested; the clock is not. | 5c, 6b | Leave the demo stack running past 08:00 in its `TZ`; read Mailpit. | time |
| E4 | `TZ` with a wrong name (for example `IST`): Node falls back to UTC with no message. | 6b | Set `TZ=IST` in the demo `.env`; read the worker start line. | here |

## Read API and proxies

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| R1 | A CDN or proxy in front of the app: `TRUST_PROXY`, `Vary`, `304` through a shared cache. | 3b | The same stack behind Cloudflare; read the response headers. | server |
| R2 | `X-Forwarded-For` as Traefik in Dokploy writes it (the per-IP login-code limit reads it). | 3b | On a Dokploy stack, request six codes from one phone; check the sixth is refused. | server, device |
| R3 | A Web Annotation client (Mirador, Hypothesis) that reads `annoudio:replies`. Only jsonld.js was tested; pyld was not. | 5b | Load a container URL of the demo in pyld (`pip install pyld`) and expand it. | here |
| R4 | JSON-LD SKOS files from TemaTres or OpenTheso. | 5 | Export a small vocabulary from a TemaTres demo and import it. | here |

## Deploy and operations

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| D1 | Every Dokploy and Coolify step on a real server. Button names marked "Unverified" in the guides were not found in the source. | 6, 6b | Follow `deploy/GUIDE-dokploy.md` literally on a clean VPS (the Phase 6 done-when test). | server, person |
| D2 | How Dokploy shows a database restore that exits 1 (the three `pgboss` errors). | 6 | Part of D1: one restore in the Dokploy GUI. | server |
| D3 | A Next build on a 4 GB VPS with Dokploy running. | 6 | Part of D1: watch the build log and the memory. | server |
| D4 | Coolify: database backup for a git compose application; value-less environment keys; how it shows the exited `media-init`. | 6 | Follow `deploy/GUIDE-coolify.md` on a clean VPS. | server |
| D5 | `migrate` of a real database with data from an older release. Tested on empty databases and on rows written by hand. | 5 | Before the first upgrade: restore a copy of the pilot database into a staging stack and run the new image. | server |
| D6 | An upgrade from one release to the next with `deploy/UPGRADE.md`. There is only one release. | 6 | Tag the current tree as a release; upgrade the demo to the next one. | here |

## CMS plugins (`plugins/`)

| # | Item | Source | Cheapest check | Needs |
|---|---|---|---|---|
| C1 | Real HTTPS stacks, mixed content (an `https` site with an `http` stack), and a CSP on the host. | 7a §5.1 | Put the test hosts and the demo behind a local TLS proxy (Caddy). | here |
| C2 | WordPress multisite; editor and contributor roles (only author was tested). | 7a §5.2 | A WordPress multisite container; repeat the author test as an editor. | here |
| C3 | Classic themes in a browser; Omeka S themes other than `default`. | 7a §5.3 | Switch the test hosts to Twenty Twenty-One and an Omeka S community theme; run the plugin tests. | here |
| C4 | A private Omeka media: visitors cannot fetch its original file; the block does not warn. | 7a §5.4 | Make one media private; open the public page as a visitor. | here |
| C5 | The plugins in Firefox and WebKit (Chromium only in this phase). | 7a §5.5 | Add the two browsers to `plugins/tests` Playwright config. | here |
| C6 | Translations: strings are marked, but no `.pot`/`.po` files exist. | 7a §5.6 | `wp i18n make-pot`; one Omeka S `.po`. | here |
| C7 | Uninstall paths (`uninstall.php`, `Module::uninstall`). | 7a §5.8 | Uninstall both plugins on the test hosts; check the options and tables are gone. | here |
| C8 | The 5-minute cache expiry of the recording lookup (no test waits 300 s). | 7b §4.1 | Change the address of a recording in the admin; reload the page after 5 minutes. | time |
| C9 | A slow stack (between 2 s and the timeout); only "connection refused" was tested. | 7b §4.2 | Put a delay proxy (`toxiproxy`) between a test host and the demo. | here |
| C10 | WordPress object caches for transients (Redis, Memcached). | 7b §4.3 | Install the Redis object cache plugin on the test host; rerun the plugin tests. | here |
| C11 | Omeka S with a read-only or shared `temp_dir`. | 7b §4.4 | Mount `temp_dir` read-only on the Omeka test host. | here |

## Known and not fixed

These items are not unverified: tests show them. They are here because earlier notes listed them with the unverified items.

| # | Item | Source |
|---|---|---|
| K1 | Text typed into an existing story or reply before React hydrates can be lost (React 19.2 resets a non-empty server textarea). | 3, 3b, 5b |
| K2 | Firefox in the embed tests still opens a PulseAudio stream with silent samples. | 3b §9 |
| K3 | A new member name changes only the stories that the member saves after the change. | 5c |
| K4 | WebKit ignores `preload="none"` and gets a voice note once when the story list shows. | 4b |

## Closed since the notes were written

| Item | Source | Closed by |
|---|---|---|
| Real SMTP for M1, M3, M6, M7; operator password reset through an email adapter | 3, 5c, 6 | 6b (Mailpit, real SMTP) |
| `pnpm build` not run | 3 | 3b and every later phase |
| No admin "Publish" test | 3 | 5c e2e, 6b seed (the admin's Publish button) |
| The start at `t` and "Use the player time" | 3 | `app/tests/e2e/annotate.e2e.spec.ts` |
| Uploads and `/media/<id>` in the production image | 6 | 6b (a photo; voice and video stay open: M1) |
| The Dashboard and the Stories column count replies as stories | 5b | 5c (Today replaced the Dashboard; the column counts stories only) |
| The demo stack lacks the 5c fixes | 5c | 6b (demo rebuilt) |
| The worker logs nothing per job | 6b | closing pass (`design/closing-notes.md`) |
| A deleted project still has its stories served | 6b | closing pass (`design/closing-notes.md`) |
