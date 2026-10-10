# Workflow recordings

Short screen recordings of Annoudio's workflows, one per workflow and role, made on the real demo stack (`deploy/DEMO.md`). Each recording is a WebM video (VP9, 24 fps, no sound) with a title card of 1.5 s, a poster PNG (the first frame after the title card) and a caption (`NN-name.md`, with the stumbles seen in that recording). Recorded on 2026-10-09 in two rounds: the **first** round on the app image with the bundle `f480656deb88`, and the **audit-fix** round (13 recordings, column "Image") on the image of `design/audit-fixes-notes.md`, bundle `e56689aec88c`, plugins 0.3.0.

Four roles: the **operator** (admin, laptop), the **member** (Annotate page, phone), the **visitor** (a host page) and the **site maintainer** (puts the widget on a site). Total size: 11.2 MB.

## The recordings

| File | Role | Workflow | Length | Size | Image | What it shows |
|---|---|---|---|---|---|---|
| [01-operator-first-sign-in-today.webm](01-operator-first-sign-in-today.webm) | Operator | Sign in; Today with "What Annoudio does" and the counts | 19.5 s | 0.27 MB | audit-fix | The sign-in screen with the Annoudio name, Today with "What Annoudio does" opened, the counts and "Last 7 days". |
| [02-operator-add-widget-to-site.webm](02-operator-add-widget-to-site.webm) | Operator | Add a widget to a site: Recording, Site, Snippet; copy the snippet | 24.7 s | 0.54 MB | audit-fix | The 3-step wizard; step 2 starts on River Voices; "Copy the snippet" → "Copied."; the live widget; Done. |
| [03-operator-try-it-preview.webm](03-operator-try-it-preview.webm) | Operator | Recording page → Try it → preview page with the live widget → Open the Annotate page | 24.0 s | 0.44 MB | first | "Widgets of this recording", Try it → the Annotate page → Back to the site → the preview page; the widget plays; Open the Annotate page. |
| [04-operator-vocabulary.webm](04-operator-vocabulary.webm) | Operator | Vocabulary: add a question from the catalogue, the list "Places" and two items, the field lock | 43.0 s | 1.09 MB | audit-fix | Add a question → When it happened; "places" refused ("Places exists."); New item + Add twice on the list; Edit: Topics with the lock text. |
| [05-operator-theme-colour-picker.webm](05-operator-theme-colour-picker.webm) | Operator | Theme tab: the accent colour with the colour picker, the contrast readout, the live widget | 23.7 s | 0.63 MB | audit-fix | The live widget beside the fields; a light accent ("too low"), then a dark one ("passes"); Save. |
| [06-operator-review-publish.webm](06-operator-review-publish.webm) | Operator | Review stories → a waiting story → chips → Publish dialog with preview → the next story opens | 24.2 s | 0.52 MB | audit-fix | The queue with a state badge on every row, a waiting story with chips, the Publish dialog with the preview, the next story. |
| [07-operator-return-to-member.webm](07-operator-return-to-member.webm) | Operator | Return to the member, with a reason | 17.3 s | 0.35 MB | audit-fix | Return to the member; the empty-reason error (it goes at the first key); the reason; the next waiting story opens. |
| [08-operator-invite-codes.webm](08-operator-invite-codes.webm) | Operator | Project → Sign-in tab → Make invite codes → the list of codes | 24.8 s | 0.44 MB | first | Settings → Sign-in, 3 codes × 30 members, "Your 3 new codes", the code table. |
| [09-operator-relationships.webm](09-operator-relationships.webm) | Operator | Relationships: recording "Used in projects" → project Overview → Members → a member page | 21.8 s | 0.43 MB | audit-fix | The chip "River Voices · 8 published · 5 waiting", the Overview, the chip "7 members told stories here" → Members → a member page. |
| [10-member-tell-a-story.webm](10-member-tell-a-story.webm) | Member (phone) | From the WordPress page: Tell a story, invite code, name, drag a range, answer, Send for review | 36.1 s | 0.57 MB | audit-fix | Tell a story under the controls, invite code, name, a drag on the waveform with Start/End right under it, "Use current time", the answers, Send. |
| [11-member-voice-note.webm](11-member-voice-note.webm) | Member (phone) | Record a voice note; Processing, then Waiting for review on Your stories | 28.8 s | 0.43 MB | first | Record / Stop / Attach a voice note, "Processing" then "Ready" on the form, the done screen, Your stories. |
| [12-member-returned-and-resubmit.webm](12-member-returned-and-resubmit.webm) | Member (phone) | Your stories shows Returned with the reason → Change the story → Send again | 20.8 s | 0.39 MB | audit-fix | "Returned to you" with the reason and the saved date, "Change your story", Send again, the badge "Sent again". |
| [13-member-reply.webm](13-member-reply.webm) | Member (phone) | Widget → Reply on a published story → write → send | 17.5 s | 0.31 MB | first | Open a story in the widget, Reply, "Reply to a story", send, back on the site with the note. |
| [14-visitor-widget.webm](14-visitor-widget.webm) | Visitor | The WordPress page: play, open a story, its answers, the thread, Tell a story | 26.6 s | 0.46 MB | audit-fix | Play; Asha's story with "Place: North landing"; Leela's story with its thread; Tell a story under the controls; the rights line. |
| [15-visitor-omeka.webm](15-visitor-omeka.webm) | Visitor | The Omeka S page: the same widget, play, open a story | 14.8 s | 0.30 MB | first | The same widget and theme in Omeka S: play, two stories, Tell a story. |
| [16-operator-walks-member-flow-from-preview.webm](16-operator-walks-member-flow-from-preview.webm) | Operator as member | Preview page → Annotate → send → back to the preview → review → publish → the widget shows it | 37.3 s | 1.08 MB | first | The preview widget's Tell a story, member sign-in, send, back to the preview, review, publish, the story in the widget. |
| [17-maintainer-wordpress-block.webm](17-maintainer-wordpress-block.webm) | Site maintainer | WordPress: the plugin settings say "Connected"; an author adds the block, types the recording number, publishes | 51.4 s | 1.16 MB | audit-fix | Settings → Annoudio "Connected to River Voices"; an author searches "widget", adds the Annoudio widget block, types the recording number, publishes; the post plays. |
| [18-maintainer-omeka-module.webm](18-maintainer-omeka-module.webm) | Site maintainer | Omeka S: the module says "Connected"; the page editor: add the block, pick the media, type the number, save, view | 34.8 s | 0.70 MB | audit-fix | Module configuration "Connected"; a new page, the Annoudio widget block, "Recording found" before Save, the Omeka media, Save; the public page plays. |
| [19-maintainer-hand-built-page.webm](19-maintainer-hand-built-page.webm) | Site maintainer | A hand-built page: copy the snippet, add the website, open the page, change the theme, reload | 35.7 s | 1.07 MB | audit-fix | Copy the snippet; a website on the list + Save; the page shows the widget; a new accent; a reload shows it at once. |

Phone recordings (10–13) are 390 × 844; all others are 1280 × 800.

## How to record them again

Prerequisites, all on this computer:

1. The demo stack runs (`deploy/DEMO.md`, "Start, stop, delete"), and so do the test hosts and the media fixture server (ports 4610, 4620).
2. The host pages are current: `bash deploy/test-hosts/install-plugins.sh` (bash, not sh: the script uses bash syntax).
3. Playwright and its Chromium from `embed/` (`cd embed && pnpm install`), and `ffmpeg` with `libvpx-vp9`.

Then, from the repository root:

```sh
node design/recordings/scripts/record-all.mjs          # all 19, in the order of the run
node design/recordings/scripts/record-all.mjs 06 07    # only these
node design/recordings/scripts/record-all.mjs --gif    # also a GIF of each (not made by default)
```

The run order is not the file order: 04 adds a question before the member answers (10); 01 comes after 10 and 11, so Today has stories that wait; 06 publishes the oldest waiting story that is not the member's new one; 07 returns the member's story of 10, which 12 changes; 14 publishes the reply of 13 (off camera) before it shows the thread. State between recordings (the member, the invite codes, story ids) is in `scripts/.work/state.json`.

Read this before a second run:

- **Every run adds data.** A run makes a new member `asha.<run>@example.org` ("Asha"), new stories, 3 invite codes, a WordPress post, an Omeka S page and one website `http://127.0.0.1:<port>` on River Voices (`REC_SITE_PORT`, default 4792; a port that is already on the list skips the on-camera step). Nothing is deleted. 05 and 19 change the accent colour and put it back to `#0b6e4f` at the end.
- **04 asks the first common question that is not asked yet** (Place, When it happened, Who is speaking, Kind of sound): the first round added Place, the audit-fix round When it happened. It fails when all four are asked.
- **06, 07 and 12 need the stories of 10 and 11** (and its member session) from the same run; run them in one go, or keep `state.json`. To start a new member, delete `memberEmail` and `textStory` from `state.json`.
- `REC_RUN` names the run (default: the UTC month, day and time); `REC_SLOWMO` sets Playwright's slowMo (default 180 ms).

### Method

- `scripts/lib.mjs`: one Chromium per recording (`--mute-audio`; 11 adds `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`), `recordVideo` at the viewport size, `slowMo` 180 ms. An init script draws a red dot that follows `mousemove` (Playwright videos draw no cursor) and shrinks on a press. Every click first moves the mouse to the target in 14 steps; text is typed key by key.
- The title card is a page of its own (`page.setContent`), shown for 1.6 s before the first page loads.
- Dead time is marked while recording: `s.fast()` speeds a part up (page loads 2–3×, waits for the worker 4×), `s.cut()` drops it (setup the viewer does not need, such as waiting for the stories cache). ffmpeg applies the marks in one filter graph (`trim`, `setpts`, `concat`) and re-encodes: `-c:v libvpx-vp9 -b:v 0 -crf 32 -an`, 24 fps, at most 1280 px wide.
- The poster is the frame of the cut video just after the first page has loaded. `--gif` makes a GIF from the WebM with a two-pass palette (`palettegen`, then `paletteuse`), 12 fps, 960 px (390 px for the phone).
- `scripts/flows/NN-*.mjs`: one file per recording; it exports `role` and `workflow` (the title card and the caption) and writes its stumbles with `s.note()`. `scripts/rest.mjs` (REST as the operator: read and restore the theme) and `scripts/setup.mjs` (publish through the admin's own Publish button, off camera) hold the steps that are not filmed. `scripts/sheet.sh NN` makes a contact sheet of a recording for a quick check; `scripts/addnotes.py NAME "note"` adds a stumble to a finished caption by hand. `scripts/.work/` holds the raw videos and state; it can be deleted.

## The videos

GitHub does not play `<video>` tags in Markdown: use the plain links under each one.

### 01-operator-first-sign-in-today

<video controls preload="none" poster="01-operator-first-sign-in-today.png" src="01-operator-first-sign-in-today.webm" width="640"></video>

[01-operator-first-sign-in-today.webm](01-operator-first-sign-in-today.webm) · [caption](01-operator-first-sign-in-today.md)

### 02-operator-add-widget-to-site

<video controls preload="none" poster="02-operator-add-widget-to-site.png" src="02-operator-add-widget-to-site.webm" width="640"></video>

[02-operator-add-widget-to-site.webm](02-operator-add-widget-to-site.webm) · [caption](02-operator-add-widget-to-site.md)

### 03-operator-try-it-preview

<video controls preload="none" poster="03-operator-try-it-preview.png" src="03-operator-try-it-preview.webm" width="640"></video>

[03-operator-try-it-preview.webm](03-operator-try-it-preview.webm) · [caption](03-operator-try-it-preview.md)

### 04-operator-vocabulary

<video controls preload="none" poster="04-operator-vocabulary.png" src="04-operator-vocabulary.webm" width="640"></video>

[04-operator-vocabulary.webm](04-operator-vocabulary.webm) · [caption](04-operator-vocabulary.md)

### 05-operator-theme-colour-picker

<video controls preload="none" poster="05-operator-theme-colour-picker.png" src="05-operator-theme-colour-picker.webm" width="640"></video>

[05-operator-theme-colour-picker.webm](05-operator-theme-colour-picker.webm) · [caption](05-operator-theme-colour-picker.md)

### 06-operator-review-publish

<video controls preload="none" poster="06-operator-review-publish.png" src="06-operator-review-publish.webm" width="640"></video>

[06-operator-review-publish.webm](06-operator-review-publish.webm) · [caption](06-operator-review-publish.md)

### 07-operator-return-to-member

<video controls preload="none" poster="07-operator-return-to-member.png" src="07-operator-return-to-member.webm" width="640"></video>

[07-operator-return-to-member.webm](07-operator-return-to-member.webm) · [caption](07-operator-return-to-member.md)

### 08-operator-invite-codes

<video controls preload="none" poster="08-operator-invite-codes.png" src="08-operator-invite-codes.webm" width="640"></video>

[08-operator-invite-codes.webm](08-operator-invite-codes.webm) · [caption](08-operator-invite-codes.md)

### 09-operator-relationships

<video controls preload="none" poster="09-operator-relationships.png" src="09-operator-relationships.webm" width="640"></video>

[09-operator-relationships.webm](09-operator-relationships.webm) · [caption](09-operator-relationships.md)

### 10-member-tell-a-story

<video controls preload="none" poster="10-member-tell-a-story.png" src="10-member-tell-a-story.webm" width="390"></video>

[10-member-tell-a-story.webm](10-member-tell-a-story.webm) · [caption](10-member-tell-a-story.md)

### 11-member-voice-note

<video controls preload="none" poster="11-member-voice-note.png" src="11-member-voice-note.webm" width="390"></video>

[11-member-voice-note.webm](11-member-voice-note.webm) · [caption](11-member-voice-note.md)

### 12-member-returned-and-resubmit

<video controls preload="none" poster="12-member-returned-and-resubmit.png" src="12-member-returned-and-resubmit.webm" width="390"></video>

[12-member-returned-and-resubmit.webm](12-member-returned-and-resubmit.webm) · [caption](12-member-returned-and-resubmit.md)

### 13-member-reply

<video controls preload="none" poster="13-member-reply.png" src="13-member-reply.webm" width="390"></video>

[13-member-reply.webm](13-member-reply.webm) · [caption](13-member-reply.md)

### 14-visitor-widget

<video controls preload="none" poster="14-visitor-widget.png" src="14-visitor-widget.webm" width="640"></video>

[14-visitor-widget.webm](14-visitor-widget.webm) · [caption](14-visitor-widget.md)

### 15-visitor-omeka

<video controls preload="none" poster="15-visitor-omeka.png" src="15-visitor-omeka.webm" width="640"></video>

[15-visitor-omeka.webm](15-visitor-omeka.webm) · [caption](15-visitor-omeka.md)

### 16-operator-walks-member-flow-from-preview

<video controls preload="none" poster="16-operator-walks-member-flow-from-preview.png" src="16-operator-walks-member-flow-from-preview.webm" width="640"></video>

[16-operator-walks-member-flow-from-preview.webm](16-operator-walks-member-flow-from-preview.webm) · [caption](16-operator-walks-member-flow-from-preview.md)

### 17-maintainer-wordpress-block

<video controls preload="none" poster="17-maintainer-wordpress-block.png" src="17-maintainer-wordpress-block.webm" width="640"></video>

[17-maintainer-wordpress-block.webm](17-maintainer-wordpress-block.webm) · [caption](17-maintainer-wordpress-block.md)

### 18-maintainer-omeka-module

<video controls preload="none" poster="18-maintainer-omeka-module.png" src="18-maintainer-omeka-module.webm" width="640"></video>

[18-maintainer-omeka-module.webm](18-maintainer-omeka-module.webm) · [caption](18-maintainer-omeka-module.md)

### 19-maintainer-hand-built-page

<video controls preload="none" poster="19-maintainer-hand-built-page.png" src="19-maintainer-hand-built-page.webm" width="640"></video>

[19-maintainer-hand-built-page.webm](19-maintainer-hand-built-page.webm) · [caption](19-maintainer-hand-built-page.md)

## Audit: what did not work as a person would expect

The first round found 32 stumbles; `design/audit-fixes-notes.md` lists them one by one (its rows 1–33) with the fix or the reason to decline. The audit-fix round re-recorded the 13 recordings whose screens changed and checked each fix on camera.

### Fixed, and seen fixed in the audit-fix round

| Recording | Was | Now |
|---|---|---|
| 06 | Only the first row of Review stories had its state badge | Every row has its badge |
| 19 | A saved theme did not show after a reload (theme file cached 5 min) | The reload shows the new accent at once (`Cache-Control: no-cache`) |
| 09 | "River Voices · 11 stories" counted waiting stories as stories | "8 published · 5 waiting"; "7 members told stories here" opens Members |
| 12 | A returned story said "Tell a story" and "Send for review"; the sent-again story looked like any other | "Change your story", **Send again**, the badge "Sent again"; cards say "Saved 9 Oct 2026, 18:54" |
| 17, 18 | "Annoudio player", "Recording ID"; a search for "widget" found nothing; Omeka said "Recording found" only after Save | "Annoudio widget", "Recording number"; the inserter finds it with "widget"; Omeka says "Recording found" when the number field changes |
| 07 | Return went to the list, Publish to the next story; the reason error stayed while typing | Both open the next waiting story; the error goes at the first character |
| 10 | "Tell a story" under every story; the story list between the waveform and Start/End; "Use 0:00" twice | "Tell a story" under the controls; on the Annotate page the list is a small scroll box and Start/End follow the waveform; "Use current time (0:00)" |
| 04 | "Add a list" invited a second Places; "Add an item" left the list | "Places exists. Open it"; **New item** + **Add** stays on the list |
| 14 | "Place  North landing" | "Place: North landing" |
| 02 | Step 2 started on "Choose a site…"; the option listed five addresses | River Voices is chosen; "… and 4 more" |
| 01 | The Payload logo on the sign-in screen; the folded help looked broken | The Annoudio name; a chevron on the folded help |

Fixed but not on camera in this round: the voice-note length on the review screen (07 returned a text story this time). The first-round recordings 03, 11, 13, 15 and 16 also show screens that the fixes changed (the Annotate page layout, the place of "Tell a story", the dates on Your stories, the test member). They were not in the list for this round; `node design/recordings/scripts/record-all.mjs 03 11 13 15 16` records them again.

### Still open (declined in `design/audit-fixes-notes.md`)

- **03**: the Annotate page is a 40rem column on a laptop (row 5: kept, centred, for line length).
- **03**: "Back to the site" lands on the preview page scrolled to the widget (row 6: the widget focuses itself on a return, as on host pages).
- **04**: the project page opens on the tab Project, not the tab left (row 9: Payload tabs keep no state).
- **10**: an empty waveform box shows before the wave draws (row 19: it keeps the place, so the page does not jump).
- **14**: the WordPress menu lists "Ferry crossing, 1962" twice (row 25: test-host data, owner of `deploy/`).
- **16**: the operator signs in again as a member on the Annotate page (row 26: by design).
- **11**: the state Processing is rarely seen, because a voice note is ready about 2 s after Attach (row 20: the true state; now held by a test).

### New stumbles seen in the audit-fix round

- **19**: after **Add Website** the new row is folded ("New website"): the maintainer must open it before typing the address.
- **09**: the widget chip says "8 published · 5 waiting" and the Overview stat "9 Published". The stat counts the published reply too (its heading is "Stories and replies"), so the numbers still differ at a glance.
- **09**: the member "Operator test", made before the fix, is not marked as a test member and still counts in "7 members told stories here". Only members made after the fix get the mark (audit-fixes-notes.md, decision 3).
