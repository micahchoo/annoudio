# Audit fixes notes

Date: 2026-10-09. Scope: `app/`, `embed/`, `plugins/`. Source: the 32 stumbles of `design/recordings/README.md` ("Audit"), seen while the workflows were recorded. Read `CONTEXT.md`, `design/concept-map.md` and `design/design-system.md` first; this file uses their words. `deploy/` and `worker/` did not change. `deploy/test-hosts/install-plugins.sh` did not change either: the plugin names (`annoudio`, `Annoudio`) and the block names (`annoudio/player`, `annoudioPlayer`) stay, so stored posts and pages keep their blocks.

## The fault

**Review stories showed the state badge on the first row only.** Cause: the `lifecycle` column of the stories list read the main row with `payload.findByID({ …, context: { [MAIN_READ]: true }, req })`. With `req`, Payload's `createLocalReq` writes that context into `req.context`. All rows of one list share `req`, so every later row read `MAIN_READ: true` and returned `null`: an empty State cell. Fix: the hook reads the main row through `payload.db.findOne` (no hooks, so no guard flag is needed), `app/src/modules/stories/collection.ts`. The new int test "every row of the operator list has its state" fails on the old hook (checked: rows 2 to 4 gave `null`) and passes now.

## Item by item

Each stumble of the audit, by recording. "Test" names the test that holds the fix; a fix with no test says why.

| # | Rec. | Stumble | Result | Test |
|---|---|---|---|---|
| 1 | 01 | Sign-in screen shows the Payload logo | Fixed: `admin.components.graphics.Logo` and `Icon` (Payload 3.90, checked in `@payloadcms/next` `elements/Logo` and `templates/Default`) give the stack name, `ANNOUDIO_NAME` or "Annoudio", with the recording icon (`admin/Brand.tsx`). | e2e `preview` (sign-in screen: brand text, no `.graphic-logo`; Today: no `.graphic-icon`) |
| 2 | 01 | "What Annoudio does" folded looks broken | Fixed: a chevron in the summary (turns when open), one line high when folded. | None: style only |
| 3 | 02 | Step 2 starts on "Choose a site…" | Fixed: the site chosen before, else the one project that has a widget of the recording, else the only project. | e2e `addWidget` "with two projects" |
| 4 | 02 | The site option lists all five addresses | Fixed: "Harbour Talks · a.example.org and 4 more". | e2e `addWidget` "with two projects" |
| 5 | 03 | Annotate page a narrow column at the left at 1280 px | Declined: the page is a centred 40rem column (`margin: 0 auto`; checked in a 1280 × 800 screenshot of the demo stack). A wider form makes lines too long. | — |
| 6 | 03 | "Back to the site" lands scrolled to the widget | Declined: the widget focuses itself on a return fragment (CONTRACT §7.2), so a member on a host page lands on the story. The preview page shows the widget as host pages do; its heading is one scroll up. | — |
| 7 | 04 | "Add a list" invites a second "Places" | Fixed: `vocabulary.addList` refuses a name that a list of the project has (case and spaces do not count) with `{ error: 'exists', key, label }`; the form says "Places exists. Open it". Add a question with a new list says the same. | int `vocabulary` (" people " refused); e2e `lists` |
| 8 | 04 | "Add an item" leaves the list; no way back after Save | Fixed: the page of a list has **New item** + **Add** (stays on the list, focus back in the field); "Add an item with all fields" opens the item form, which now starts with "← Back to Places". | e2e `answers` (two items, the address stays `?list=places`); e2e `lists` (Back to People) |
| 9 | 04 | The project page forgets its tab | Declined: Payload's tabs field keeps no state between loads, and a remembered tab needs a wrapper around Payload's tab buttons (fragile at each upgrade). The sidebar job **Vocabulary** opens that screen directly. | — |
| 10 | 06 | Only the first row shows its state badge | Fixed: see "The fault". | int `stories/lifecycle` "every row of the operator list"; e2e `review` (every row has the badge) |
| 11 | 07 | The voice note reads 0:00 / 0:00 before it plays | Fixed: the review screen loads the metadata of a sound body (`preload="metadata"`), so the length shows. | None: one attribute; the native controls cannot be read by a test |
| 12 | 07 | "Write the reason" stays while the reason is typed | Fixed: the error goes at the first character. | e2e `review` (the alert goes) |
| 13 | 07 | Return goes to the list, Publish to the next story | Fixed: `stories.nextWaiting(id)` gives the first waiting story after `id`, else the oldest other one; both moves use it, so both open the next story while one waits. | int `stories/actions` `nextWaiting` |
| 14 | 09 | "River Voices · 11 stories" counts drafts | Fixed: every widget chip says what it counts: "6 published · 5 waiting" (· "1 returned"; "No stories yet"), on the recording page, the Overview and the preview page (`admin/ui/counts.ts` `storyStates`). Waiting includes Processing. The Overview stats and Today already split states, stories and replies. | e2e `preview` (recording page, Overview); e2e `concepts` (Overview) |
| 15 | 09 | "N members told stories here" is not a link | Fixed: it opens Members. | e2e `preview` (the chip is a link) |
| 16 | 10 | On a phone, "Tell a story" is under every story | Fixed: the widget puts the Annotate link under the controls, above the intro and the stories. The order of parts is not contract (§3.3 rule 3). | embed `contract` 16.12 (order), 16.8 (keyboard order), 16.10 (rights below the stories) |
| 17 | 10 | On the Annotate page, the story list is between the waveform and Start/End | Fixed: on the Annotate page only, the widget's `stories` part is an 8rem box with its own scroll and its `intro` part is hidden (the page has its own intro line), both with `::part()`; the moment line, Start and End follow the waveform, then the time hint, then the story text. Host pages keep the full list. | e2e `annotate` "on a phone, Start and End follow the waveform" (390 × 844, 8 stories) |
| 18 | 10 | Both buttons read "Use 0:00" | Fixed: "Use current time (0:00)", named "Start: use the current time, 0:00". | e2e `annotate`, `preview` |
| 19 | 10 | An empty waveform box shows for a moment | Declined: the box keeps the place of the wave, so the page does not jump when the peaks arrive (the controls show after 500 ms at most, CONTRACT §3.2 rule 5). A drawn placeholder would be one more loading state. | — |
| 20 | 11 | Processing is never seen | Kept, now held by a test: the done screen and Your stories read the state at render (`lifecycle` of `ownDrafts`, with the media state). The voice note is ready in about 2 s, so Waiting for review is the true state. | e2e `media` (photo: done screen Processing, then Waiting for review) |
| 21 | 11 | Cards on Your stories carry no date | Fixed: each card (Your stories, and the list on the Annotate page) says "Saved 9 Oct 2026, 14:05" in the member's time zone (`OwnDraft.modified`). | e2e `lifecycle` F4 |
| 22 | 12 | A returned story still says "Tell a story" / "Send for review" | Fixed: the page title is "Change your story" for an own story, and a returned story has **Send again** with "An operator reads the changed story before visitors see it." The form heading of an own story is "Times and text". | e2e `lifecycle` F4 |
| 23 | 12 | A story sent again looks like any other | Fixed: the stored flag `sentAgain` (set by `saveDraft` on a returned story, cleared by publish and return) gives `Lifecycle.again`; the admin list row, the review screen and Your stories show a second badge "Sent again". The review screen no longer reads History for it. | int `stories/lifecycle` "Sent again"; e2e `lifecycle` F4 |
| 24 | 14 | "Place  North landing" | Fixed: the widget draws a colon after each field label (`.field-label::after`); the label text stays "Place". | embed `contract` 16.11 |
| 25 | 14 | The WordPress menu lists "Ferry crossing, 1962" twice | Declined here: test-host data (`deploy/test-hosts/setup.sh` makes the Phase 2 page with the same title), not in this lane. For the owner of `deploy/`: give the Phase 2 page its own title. | — |
| 26 | 16 | The operator signs in again as a member | Declined: members are not Payload users, by design (CONTEXT.md fixed decisions; `design/membership-interface.md`): an operator session must never act as a member. Row 27 deals with what follows from it. | — |
| 27 | 16 | The operator's test member counts as a real member | Fixed: a sign-in (login code or invite code) from a browser that also has an operator session makes a **test member** (`members.test`); an existing member stays as it is. `membership.testMembers()` gives them; the Overview member count leaves them out (`stories.projectReach(project, { leaveOut })`); the Members list and the member page show "Test". | int `membership` (test member), int `stories/review` (`projectReach` leaveOut); e2e `preview` (Members, Overview "0 members") |
| 28 | 17 | The block is "Annoudio player"; "widget" finds nothing | Fixed: both CMS plugins say "Annoudio widget"; the WordPress keywords are widget, audio, story, stories, annotation. Versions 0.3.0 (WordPress plugin, block, Omeka S module), zips rebuilt. | plugins `wordpress.spec` (the inserter search "widget") |
| 29 | 17 | "Recording ID" against the admin's "Recording number" | Fixed: "Recording number" in both plugins, their messages and READMEs. | plugins `wordpress.spec`, `omeka.spec` |
| 30 | 18 | Omeka says "Recording found" only after Save | Fixed: the module's own route `GET /admin/annoudio/recording?recording=1` (`RecordingController`, signed-in roles that edit pages) gives the status line as JSON; the block form asks it when the number field changes, and writes "Recording found: …" before a save. The form and the route share `Player::check`. | plugins `omeka.spec` (Tab after the number) |
| 31 | 18 | Omeka "Recording ID" | Fixed with 29. | plugins `omeka.spec` |
| 32 | 19 | The Websites list: one large block per address | Fixed: the rows start folded, each labelled with its address ("New website" when empty), so "Add Website" stays near. | None: Payload field options only |
| 33 | 19 | A saved theme does not show after a reload | Fixed: the theme JSON is `Cache-Control: public, no-cache` with its ETag (was `max-age=300`): the browser asks again on each load and gets a 304 while nothing changed, so a save shows on the next load, a plain reload too, and also in the admin preview and Try it. CONTRACT §3.2 and §5.1 say so (a shorter cache time: additive). The Theme tab says "at the next page load". | int `projects/theme` (header); e2e `embed` "a saved theme shows on the next page load" |

Rows 3 and 4 are one item of the audit, so 33 rows hold its 32 items. The ten items of its short list are rows 10, 33, 14, 20, 22–23, 28–29, 13, 16–17, 7–9 and 1.

## Decisions

1. **The theme JSON is `no-cache`, not `max-age=60, stale-while-revalidate`.** The brief proposed 60 s with revalidation. With `stale-while-revalidate`, the first load after the 60 s still uses the old file (the browser revalidates in the background), and inside the 60 s a reload uses it too: Chromium revalidates only the page itself on a reload, not a `fetch()` of the player. Only `no-cache` meets "shows on the next page load". The cost is one conditional request per page view, answered by a 304; the request stays CORS-simple (the browser cache adds `If-None-Match`, not the player). The recording JSON of the plugins keeps 300 s.
2. **"Sent again" is stored, not read from History.** A list row would otherwise read every version of every story. `sentAgain` is on the story and in its versions (migration `20261010_012444_audit_fixes`); `lifecycle` gives `again: true` only while the story waits or processes. A change to a published story is not "sent again": only a change after a return is.
3. **A test member is made by the operator session, not by the preview page address.** The Annotate page reads the operator session of the same browser (`payload.auth`); the operator may try the member steps from any widget. Only a new member becomes a test member; story counts keep its stories (they are real stories), member counts leave it out.
4. **The Annotate page caps the story list with `::part(stories)`.** No widget attribute was added: the page owns both sides, and host pages keep their full list.
5. **Block and layout names stay** (`annoudio/player`, `annoudioPlayer`, the class `Player`): posts and pages store them. Only the words people read changed.

## Result

| Check | Result |
|---|---|
| `app`: `pnpm test:int` | **364 pass** (28 files). Before: 360. New: `stories/lifecycle` 2 (Sent again; every row of the operator list), `membership` 1 (test member), `stories/review` 1 (`projectReach` leaveOut); new assertions in `vocabulary` (a list name that exists), `stories/actions` (`nextWaiting` after the newest), `projects/theme` (`no-cache`). |
| `app`: `pnpm test:e2e` (Chromium, muted) | **84 pass**. Before: 81. New: `addWidget` "with two projects", `embed` "a saved theme shows on the next page load", `annotate` "on a phone". Updated for the new words and moves (none weakened): `review`, `lifecycle` F4, `preview`, `lists`, `answers`, `concepts`, `media`, `annotate`. `preview` now waits for the "…applied" toast to settle before axe (axe read its fade-in as low contrast). |
| `embed`: `pnpm test` (Chromium, Firefox, WebKit, muted) | **323 pass, 4 skipped**. Before: 320. New: 16.12 "the Annotate link comes under the controls" (× 3); 16.8 keyboard order and 16.10 rights order follow the new place of the link; 16.11 checks the colon. |
| `plugins`: Playwright after `install-plugins.sh` | **13 pass**. `lint.sh`: `php -l` (PHP 8.2, 8.3, 8.5) and WordPress Plugin Check clean. |
| `tsc`, `lint` | Clean in `app` and `embed`; `app` lint keeps its 1 warning (`tests/e2e/admin.e2e.spec.ts`, Payload template). |
| Builds | `app` `pnpm build` passes. `embed` bundle **`e56689aec88c`** (34 123 B gzip, limit 81 920; loader 756 B); the folder keeps the two before it, `f480656deb88` (the demo stack) and `31d277eeda2f`; the build removed `6b4bd18c8a1a`. |
| Migration | One: **`20261010_012444_audit_fixes`** (`stories.sent_again`, `_stories_v.version_sent_again`, `members.test` with an index). Checked on an empty database: up (all seven); down; up. `migrate:create --skip-empty` after: no file. |

## For the owners of other files

- `deploy/`: rebuild the app image (migration `audit_fixes` at start, bundle `e56689aec88c`). Optional env `ANNOUDIO_NAME`: the name on the sign-in screen and at the top of the admin (default "Annoudio"). Reinstall the plugins on real sites (0.3.0). Test hosts: the Phase 2 WordPress page and the demo page share a title (row 25).
- `CONTEXT.md` (not changed here): add **Test member** (a member that an operator made from a browser with an operator session; member counts leave it out) and **Sent again** (a story that the member changed after a return; it waits again).
- `design/ia.md` decision 10 said the recording chip counts as the widget's `total`; the chip now shows the states, and its first number is that total.
- `CONTRACT.md`: §3.2 rule 8 and "Why this way", §5.1 table and the new paragraph on the theme cache (each "changed 2026-10-09").
- `.claude/rules/embed-build-output.md`: the theme rule is `no-cache` now (text updated).
