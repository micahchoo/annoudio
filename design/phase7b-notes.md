# Phase 7b notes: the plugins use the recording route

Date: 2026-10-09. Scope: the 7b request of `design/phase7a-notes.md` §4, item 1 (the public recording route), on the plugin side. Code: `plugins/`. Test hosts: `deploy/test-hosts/install-plugins.sh`, `omeka-plugins.php`. `app/`, `embed/`, `worker/` and the other `deploy/` files did not change. Read `CONTEXT.md` and `design/phase7a-notes.md` first; this file uses their words.

## 1 Result

| Check | Result |
|---|---|
| Playwright, Chromium, muted (`plugins/tests`) | 13 pass: 7 WordPress, 6 Omeka S (7a: 10). |
| `php -l`, PHP 8.2.34, 8.3.35, 8.5.11 | 15 files, no errors (`plugins/lint.sh`). |
| WordPress Plugin Check | "No errors found." |
| Zips | `plugins/dist/annoudio.zip` (0.2.0), `plugins/dist/Annoudio-omeka-s.zip` (0.2.0). |

The demo stack ran the images with the route: `GET /embed/v1/recordings/river-voices/1.json` → `{"id":"1","title":"Ferry crossing, 1962","url":"http://127.0.0.1:4610/media/tone.m4a","duration":10}`; the theme JSON has `"name":"River Voices"`.

What the new tests prove, on both hosts:

| Test | Proven |
|---|---|
| Settings / module configuration | The status reads "Connected to River Voices (project river-voices) at http://127.0.0.1:3500." The name is read from the theme JSON at test time, not typed in the test. |
| WordPress editor, ID only | As `author1`: the block has no "Audio address" field. "999999" shows the not-found text; "one" shows "is not a recording ID". "1" shows "Recording found: Ferry crossing, 1962" and the admin's audio address. The stored post is `<!-- wp:annoudio/player {"recording":"1","src":"<admin's url>"} /-->`. A visitor gets the player with that `src`, `annoudio:ready` with the stack's story count, the stories' text, no error. |
| WordPress, pasted snippet | The snippet from the live admin still fills the ID, and the block's `src` becomes the route's `url`. |
| ID-only blocks | WordPress: a WP-CLI post with two `{"recording":"1"}` blocks (no `src`). Omeka S: a media block plus an ID-only block. Both: players with the admin's `src`, one loader. |
| Admin wins, then fallback | A block whose stored copy is `tone-nolength.m4a` (a different address that plays). With the stack reachable, the page has the admin's `tone.m4a`. With the server address set to `http://127.0.0.1:9` (nothing answers), the page has the stored copy, and the player is complete (the visitor's browser still reaches the stack). WordPress also: an ID-only block with no copy prints nothing. |
| Omeka page editor | An unknown ID refuses the save. A block with ID + Omeka media and a block with ID only save, both show "Recording found: …", the stored data of both is `{recording: "1", src: <admin's url>}` (onHydrate wrote the copy), and the public page plays the media file and the admin's address. |

"Stack down" in the tests means "this server cannot reach the stack": the tests change the plugin's server address, not the stack. The task forbids stopping Docker stacks, and the change gives the same code path (a failed `GET`).

## 2 Decisions

### 2.1 Render-time read with a 5-minute cache, the stored copy as fallback

Chosen: at render time, the block reads the recording route through `Stack`, with a cache of 300 s; a failed read (404, 5xx, timeout, bad shape) is cached for 60 s; on a failure the block prints the stored `src`. The editor also stores the route's `url` in the block at save time, as that fallback.

Why not save-time only (store `url`, never read at render):

- The admin is the source of truth for the audio address (Phase 5: the operator registers recordings). With save-time only, a URL change in the admin needs a re-save of every post and page, and nobody gets told which ones.
- The cost of render-time is small and bounded. The two TTLs are the stack's own `Cache-Control` values for the route (CONTRACT 5.1: `max-age=300`, 404 `max-age=60`), so the plugin is never fresher or staler than a browser would be. A cache miss costs one `GET` with a 2 s timeout (the editor check keeps 5 s). A down stack costs one slow page view per minute per recording, not every view.
- The fallback keeps today's guarantee: a page view never depends on the stack being up. Visitors' browsers need the stack for stories anyway; only the audio address moves to the server side.

This reverses 7a §2.4, last point ("no request to the stack on a page view"). That rule existed because nothing on the stack was worth reading at render time; now the admin's address is.

The cache key holds the server origin, the project and the recording number, so a changed setting is a miss, not a stale hit. WordPress uses transients (`annoudio_rec_<md5>`). Omeka S has no cache service for modules and APCu is not always there, so the module has `Annoudio\FileCache`: one JSON file per key in `{temp_dir}/annoudio/`, atomic rename, a broken file is a miss. `Module::uninstall` clears it.

### 2.2 Only `Stack` knows the route

`Annoudio_Stack::recording()` / `Stack::recording()` (one request, for the editor check and Omeka's `onHydrate`) and `cached_recording()` / `cachedRecording()` (for render, never throws). Both check the shape: `url` must be `http(s)`, `title` falls back to the number. The ID must be digits (CONTRACT 5.2, rule 3: `{number}.json`); the plugins refuse other text before any request, with a sentence that names the Snippet panel's "Recording ID: 1".

`check_project()` / `checkProject()` now returns the theme JSON's `name` ("" from an older stack; the page then says "Connected to project river-voices at …", the 7a text).

The plugins no longer read the stories container (`/stories/{project}/{id}/`). The editor's title is now the recording `title` ("Ferry crossing, 1962"), not the container `label` ("River Voices: Ferry crossing, 1962").

### 2.3 WordPress editor

- Fields: **Recording ID** (first), then **Or paste the snippet**. No "Audio address" field. `src` stays a block attribute, but only the editor sets it: from the route's `url` when the check finds the recording, from the snippet when one is pasted, and to "" when the ID changes or the stack answers 404.
- The REST proxy `GET /wp-json/annoudio/v1/recordings/{id}` now returns `{id, title, url}`; a non-number is 400, an unknown one 404.
- Opening an old post whose stored `src` differs from the admin's sets the new `src`, so the editor shows "unsaved changes". This is correct (the copy is stale) and harmless.

### 2.4 Omeka S block

- Fields: **Recording ID** and the core attachment picker. The stored copy goes back with the form as a hidden field, so a save while the stack is down keeps it.
- `onHydrate`: refuses an empty ID, a non-number, an ID the stack answers 404 for, and a non-audio media. On success it stores the route's `url` as the copy. Other failures do not block the save (as 7a).
- `src` order at render: the attached media's original file, then the admin's address (cached), then the stored copy. The media still wins, as in 7a; the form now says to attach it only when it is the same file as the recording.

## 3 Deviations

1. **The 7a "typed audio address" is gone** in both editors. An old block keeps its typed `src` as the stored copy; it is used only when the stack does not answer. The 7a test page `annoudio-url` is deleted by `omeka-plugins.php`; `annoudio-fallback` replaces it.
2. **`omeka-plugins.php` does not run the module's code.** A bare `Application::init` in the CLI does not load modules (the Settings cache problem of 7a §3.4 also hides the module list), so `Annoudio\*` classes do not exist there. The 7a comment "start again so that the check in onHydrate sees them" was wrong: `onHydrate` never ran in that script, in 7a or now. The comment is corrected; `FileCache.php` is loaded by path to clear the cache; the fallback page's copy is written with Doctrine. The real `onHydrate` is proven by the page-editor test (2.4).
3. The block needs a stack with the route. Against an older stack every ID is "not found". The READMEs say so in "Problems". A fallback to the stories container was not built: it would keep a second route in `Stack` for one release.
4. The optional 7a §4 item "warn when the Omeka file is not the catalogue's file" is not built: the route has `duration`, but the Omeka media has no reliable duration without reading the file. The form text asks for the same file.

## 4 Not verified

1. The 5-minute expiry itself (no test waits 300 s). The tests prove the key changes with the server origin and that a hit/miss gives the right address.
2. A slow stack (between 2 s and the timeout): only "connection refused" was tested.
3. Object caches for WordPress transients (Redis, Memcached): the code uses the transient API only.
4. Omeka S with a read-only or shared `temp_dir` across servers: the cache then misses and every view reads the stack (correct, slower).
5. Everything in 7a §5 is still open.

## 5 For the owners of other files

- `.claude/rules/plugins-stack-routes.md` lists `/stories/{project}/{id}/` as a plugin route. The plugins no longer use it, and the rule does not list `/embed/v1/recordings/{project}/{id}.json`. Update the list (not changed here: outside my lane).

## 6 Changes to the test hosts (this machine)

1. WordPress: plugin 0.2.0; posts `annoudio-block-by-author` (two ID-only blocks) and `annoudio-block-fallback` (one block, stored copy `http://127.0.0.1:4610/media/tone-nolength.m4a`), both by `author1`. `install-plugins.sh` deletes all transients of the test site.
2. Omeka S: module 0.2.0 (upgraded); page `annoudio-media` (media block + ID-only block), page `annoudio-fallback` (ID-only block, stored copy as above); page `annoudio-url` deleted; folder `/tmp/annoudio` in the container is the recording cache.
3. Both host containers were joined again to `annoudio-demo_default` by `install-plugins.sh`.
