# Phase 7a notes: the WordPress block and the Omeka S module

Date: 2026-10-09. Scope: ROADMAP Phase 7, deliverable 2, first part. Code: `plugins/`. Test hosts: `deploy/test-hosts/install-plugins.sh`, `omeka-plugins.php`. `app/`, `embed/`, `worker/` and the other `deploy/` files did not change. Read `CONTEXT.md` first; this file uses its words.

## 1 Result

| Check | Result |
|---|---|
| Playwright, Chromium, muted (`plugins/tests`) | 10 pass: 5 WordPress, 5 Omeka S. |
| `php -l`, PHP 8.2.34, 8.3.35, 8.5.11 | 14 files, no errors (`plugins/lint.sh`). |
| WordPress Plugin Check 1.x (includes the PHPCS WordPress rules) | "No errors found." One warning suppressed with a reason (2.4). |
| PHPCS for Omeka S | Not run: no ruleset in the images, and Omeka S has no official one. |
| Zips | `plugins/dist/annoudio.zip`, `plugins/dist/Annoudio-omeka-s.zip` (`plugins/build.sh`). |

What the tests prove, on the running test hosts against the demo stack (`127.0.0.1:3500`, project `river-voices`, recording `1`):

| Host | Proven |
|---|---|
| WordPress 7.1.3 (Twenty Twenty-Five) | `author1` has no `unfiltered_html` (WP-CLI `list-caps`). As `author1`, in the real block editor: insert "Annoudio player", an unknown id shows the plain error, the snippet copied from the admin's Snippet panel (read from the live admin as the operator) fills id and URL, "Recording found: River Voices: Ferry crossing, 1962" shows, publish. The stored post content is exactly `<!-- wp:annoudio/player {"recording":"1","src":"…"} /-->`. A visitor sees the player: `annoudio:ready` with `stories` = the container's `total`, the same count of `story` parts, no `annoudio:error`, no console error. A post with two blocks has one loader `<script async>` (no `type`, no `crossorigin`). The settings page says "Connected to project river-voices at http://127.0.0.1:3500.", names an unknown project in one sentence, and refuses `…/embed/v1.js` as an address. |
| Omeka S 4.2.1, HTML purifier ON (checked in the admin) | Module configuration says "Connected …", names an unknown project, refuses a bad address. A page with an Omeka-media block and a typed-address block: one loader in the head, two players, the first `src` is the media's `o:original_url`. In the real page editor: add the block, pick the Omeka media with the core attachment picker, an unknown id refuses the save with the plain error, a correct id saves and shows "Recording found: …", the public page plays it with the stack's stories. |

Also checked by hand (curl, not in the suite): with the classic theme Twenty Twenty-One, WordPress prints the loader once, in the footer.

**Stories.** `deploy/test-hosts/seed-demo-stories.mjs` (documented in `deploy/DEMO.md`) adds stories through the real Annotate page and the admin's Publish button. Now in the demo: 1 published (Leela, text, 0:02–0:04, topic Ferry, `http://127.0.0.1:3500/stories/river-voices/1/01a1216c-b0a3-7afc-be1b-329fcabe3ce2`); 2 waiting in the review queue (Ravi, text, topic Horn, on purpose; Leela's photo story, blocked, see below). The tests read the container at run time and assert `total` (now 1), the same count of `story` parts, and that each story's text shows in the player, on both hosts.

**Blocker found (deploy, not in my lane):** the photo uploads (tus) and the worker transcodes it (`media.transcode` completed), but the `media.settled` job stays `created`: the app starts its consumer only with `ANNOUDIO_MEDIA_CONSUMER=1` (`app/src/payload.config.ts` `onInit`), and no `deploy/` compose or env file sets it (only `app/.env.example`). So on every compose deployment, media bodies stay "processing" and cannot be published. Fix: add `ANNOUDIO_MEDIA_CONSUMER: "1"` to the app service in `deploy/docker-compose.yml`, recreate the app, then run the seed again; the pending job is then consumed and the seed publishes the photo story.

## 2 Decisions

### 2.1 One setting, one block

The interface for a site maintainer is two values (stack address, project) and, per block, two values (recording id, audio address). Each plugin has one module that knows the stack's routes (`Annoudio_Stack`, `Annoudio\Stack`). The block, the settings page and the editor check use only that module.

- Validation of the pair: `GET {origin}/embed/v1/themes/{project}.json` → 200. The theme JSON has no project name, so the page says "Connected to project river-voices" (the slug).
- Validation of a recording: `GET {origin}/stories/{project}/{id}/` → 200 or 404. The title is the container `label` ("River Voices: Ferry crossing, 1962").
- The check runs when the settings page opens, not in the sanitizer. Reason: WordPress calls a `sanitize_callback` two times on the first save, and a check in the sanitizer would only show at save time. The page now always shows the live state.

### 2.2 `src`: option (a), the editor copies it

The container does not hold the recording URL, and this phase must not change `app/`. So the editor copies the id and the audio URL from the admin's Snippet panel. In WordPress, one field "Paste the snippet" reads both from the `<annoudio-player>` tag (not from the `<script>` line: the first test caught that bug). The block keeps only the two values. On Omeka S the better source is an Omeka media: its `o:original_url` becomes `src`, read at render time, so it follows the media.

### 2.3 No HTML is stored

WordPress: a dynamic block (`render_callback`), `save` returns `null`, `supports.html: false`. kses only sees the block comment with two string attributes. Omeka S: the block data is `{recording, src}` plus a core attachment; PHP renders the element through a view partial, and the loader through `headScript()`. The purifier runs on HTML blocks only.

### 2.4 The loader: once per page, `async`, contract URL

- WordPress: `wp_enqueue_script('annoudio-loader', '{origin}/embed/v1.js', [], null, ['strategy' => 'async'])` from the render callback. One handle → one tag. Version `null` → no `?ver=`: the URL is part of the contract and the stack owns the cache rules (CONTRACT 5.1). Plugin Check warns `MissingVersion`; the call has a `phpcs:ignore` with this reason. Block themes print it in the head, classic themes in the footer (enqueued after `wp_head`).
- Omeka S: `prepareRender` runs once per block layout per page (`PageLayout` helper, verified in 4.2.1 source); `headScript()->appendFile($url, 'text/javascript', ['async' => true])`, and `HeadScript::isDuplicate` drops a second copy. Output: `<script async="async" src="…">` with no `type`.
- No `origin` attribute: one organisation per site, so the loader's own origin is right (CONTRACT 2.3).
- No request to the stack on a page view.

### 2.5 The "server address"

Visitors' browsers use `origin`. The server-side checks use the optional "Server address" when it is set. Reason: in Docker on one computer, PHP cannot reach the host's `127.0.0.1:3500`. The test hosts join the demo stack's network (`docker network connect annoudio-demo_default`) and use `http://app:3000`. The address is the administrator's, so WordPress uses `wp_remote_get`, not `wp_safe_remote_get` (which refuses private addresses). The editor-supplied part (the recording id) is `rawurlencode`d into a path on that fixed host; redirects are off.

### 2.6 The WordPress editor check goes through this site's REST route

`GET /wp-json/annoudio/v1/recordings/{id}`, `permission_callback: current_user_can('edit_posts')`, `wp.apiFetch` sends the `X-WP-Nonce` (`wp_rest`) and WordPress checks it (`rest_cookie_check_errors`). The browser could fetch the container directly (CORS `*`). The proxy keeps one code path for all checks (the server address, the error texts) and keeps the editor script free of stack routes.

### 2.7 No Node build for the editor script

`block/index.js` is plain ES5 with `wp.element.createElement`, and `index.asset.php` lists the dependencies by hand. Reasons: a site maintainer can read and change the shipped file; the release is a zip of the repository folder; the editor UI is one placeholder with three fields, and JSX would add a toolchain for ~150 lines. If the editor grows (a recordings picker, 7b), move to `@wordpress/scripts`.

### 2.8 Omeka S checks

- `onHydrate` refuses: no recording id; a `src` that is not http(s); neither `src` nor an attached media with a file; an attached media that is not `audio/*`; a recording id that the stack answers 404 for. A stack that is down or unreachable does **not** block the save (the check cannot tell).
- The block form shows the live check above the fields, one request per Annoudio block when the page editor opens.
- The media picker is the core `blockAttachmentsForm`, limited to one attachment. It lists only the items of the site (Omeka 4 item–site assignment).

## 3 Deviations

1. ROADMAP Phase 7 says the plugins "register a recording via the API and write the snippet from the CMS media ID". They do not register recordings: the stack has no API for a site to create a recording. The operator registers the recording in the admin; the CMS media gives `src`. See the 7b request.
2. No alignment or width options in the WordPress block (`supports` has only `html: false`). The brief said "keep default"; the WordPress default is no alignment.
3. `src` in Omeka S comes from the media at render time. If an editor attaches a media and also types an address, the media wins.
4. Test-host facts that needed work in `omeka-plugins.php` (not in the module):
   - The `giocomai/omeka-s-docker` image installs with empty file allowlists, so every upload is refused. The script sets Omeka's defaults (`SettingForm::MEDIA_TYPE_WHITELIST`, `EXTENSION_WHITELIST`), as a web install does.
   - In a bare CLI `Application::init`, `Omeka\Settings` caches itself before the module manager marks Omeka as installed, so `get()` returns nothing. The script makes the module manager, then empties the cache. `omeka-page.php` (Phase 2) only writes settings, so it never met this.
   - The container cannot reach port 4610; the script copies the tone into the web root for the `url` ingester and removes it after.

## 4 Phase 7b request (needs `app/`)

1. **A public recording route** (minimum): `GET /embed/v1/recordings/{project}/{id}.json` → `{ id, title, url, duration }`, CORS `*`, anonymous. The recording URL is already public (it is in every snippet). With it, the block needs only the id: the editor check fills `src`, and a later v1 can make `src` optional (CONTRACT 12.2). Also lets the plugins warn when the Omeka file is not the catalogue's file.
2. **A recordings list for pickers** (better UX): a per-site key that an operator makes in the admin (scope: one project, read-only), and `GET /api/v1/recordings?project=` with that key → id, title, url. The plugins keep the key server-side and proxy the list to the editor. Then the editor picks from a list and never copies an id.
3. **Register a recording from the CMS** (the ROADMAP wording): the same key with a write scope, `POST /api/v1/recordings {title, url}`. The Omeka block could then make the recording from the attached media. This changes the "operator registers" rule of Phase 5; decide before building.

## 5 Not verified

1. Real HTTPS stacks, mixed content (an `https` site with an `http` stack), and a CSP on the host (CONTRACT 13 applies unchanged).
2. WordPress multisite (administrators there also lack `unfiltered_html`; the block should work the same). Editor and contributor roles (only author tested; the REST route allows `edit_posts`).
3. Classic themes in a browser (only curl, Twenty Twenty-One). Omeka S themes other than `default` (every theme must echo `headScript()`; the core themes do).
4. A private Omeka media: visitors cannot fetch its original file; the block does not warn.
5. Firefox and WebKit: the plugins print the same snippet that Phase 2 tested in all three; this phase ran Chromium only.
6. Translations: strings are marked (`__()`, `// @translate`) but no `.pot`/`.po` files exist.
7. The players with published stories in the demo (section 1).
8. Uninstall paths (`uninstall.php`, `Module::uninstall`) were not run.

## 6 Changes to the test hosts (this machine)

1. `annoudio-hosts-wordpress-1` and `annoudio-hosts-omeka-1` are also on the network `annoudio-demo_default`. A recreated container loses this; run `install-plugins.sh` again.
2. WordPress: plugin `annoudio` active, option `annoudio`, post `annoudio-block-by-author` (by `author1`); plugin `plugin-check` installed (inactive after `lint.sh`); theme `twentytwentyone` installed (inactive).
3. Omeka S: module Annoudio active, settings `annoudio_*`, file allowlists set to Omeka defaults, item "Ferry crossing, 1962 (Annoudio test)" with one audio media in site `annoudio`, pages `annoudio-media` and `annoudio-url`. The HTML purifier is on (`setup.sh` of Phase 2 leaves it off; `install-plugins.sh` turns it on). The Phase 2 pages `player` and `purified` are unchanged: Omeka purifies at save, not at display.
4. Docker image `php:8.2-cli` pulled for the lint.
