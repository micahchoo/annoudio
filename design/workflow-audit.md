# Workflow audit: the demo, walked as a first-time person

Date: 2026-10-09. Stack: `annoudio-demo` (app :3500, Mailpit :8025), test hosts (WordPress :8091, Omeka S :8092), embed fixture server (:4610 / :4620). Chromium (Playwright, `--mute-audio`); admin at 1280 × 800, member and visitor at 390 × 844. Screenshots: `design/workflow-audit/`. Words: `CONTEXT.md`.

The walk added two members (`audit-1791576229379@example.org`, `audit-member2@example.org`, name "Audit Visitor") and two published stories on recording 1 ("Audit: the engine changes pitch here.", 0:03–0:08; "Audit: bare page return test.", 0:06–0:08). Nothing else changed.

## Why "I could not see the process of annotating at all"

Three faults together. Any one of them alone stops the walk.

1. **The host pages that the user opens show no widget.** `http://localhost:8091/?pagename=player` and `http://localhost:8092/s/annoudio/page/player` hold the raw `snippet.html` that `deploy/test-hosts/setup.sh` pasted. It loads `http://localhost:4510/embed/v1.js` with `recording="rec-0042"`. Port 4510 is the embed test fixture, and nothing listens there (`ERR_CONNECTION_REFUSED`). The element has no fallback content, so the page shows a title and white space (`20-wp-player-page.png`, `21-omeka-player-page.png`). The pages that load the demo stack are different ones, made by `install-plugins.sh`: `http://localhost:8091/?name=annoudio-block-by-author` and `http://localhost:8092/s/annoudio/page/annoudio-media` (`22-…`, `23-…`). No document names them.
2. **Every widget inside the stack has `annotate="none"`.** The Theme tab preview (`admin/projects/ThemePlayer.tsx:32`), the "Add a player" step 3 preview (`admin/addPlayer/Wizard.tsx:125`) and the player on the Annotate page itself (`StoryForm.tsx:140`). No admin screen links to `/annotate`. So, from the admin alone, an operator cannot see a widget with a "Tell a story" link, and cannot try to tell a story.
3. **The return to WordPress or Omeka S is refused.** The project River Voices has one website, `http://127.0.0.1:4620`. The WordPress origin `http://localhost:8091` and the Omeka origin `http://localhost:8092` are not on the list, so the Annotate page drops `return` silently. The way back becomes "← Your stories". After **Send for review**, the member stays on the Annotate page. The admin then says the story is "Not from a site" (`26-…`, `33-…`, `51-…`). The only allowed return page, `bare.html`, has a widget that points at the fixture stack (:4610, recording `rec-0042`). That widget cannot show the "sent" note or the new story (`41-…`, `58-…`).

The widget itself is not broken. With the fragment that a valid return would add, the WordPress widget shows "Your story is sent. It shows here after review." at 0:06 (`34-wp-with-saved-fragment.png`). The story, once published, shows on the WordPress plugin page (`56-…`).

## Breaks and friction

Severity: **blocks** = the person cannot continue; **confuses** = the person continues but is misled or unsure; **cosmetic** = wording or polish.

### Step 1: operator, from the admin alone

1. **The admin has no way to see the widget with live links.**
   - What I saw: Today (`02-today.png`), Recordings (`03-…`), recording 1 (`04-recording-1.png`: the snippet only, no preview), project Theme tab (`09-project-theme-tab.png`: a preview with no "Tell a story"), Add a player step 3 (`13-addplayer-step3.png`: "Preview: the player with the look of this project", also no link).
   - What a person expects: one button, "See it as a visitor" or "Try telling a story", next to the snippet.
   - Severity: blocks.
   - Fix: on the recording page and in step 3, add **Open the Annotate page** (`/annotate?project&recording`) and show the step 3 preview with its "Tell a story" link live.

2. **The admin never shows the Annotate page address.**
   - What I saw: no link to `/annotate` in any admin screen. The code has no such link (search of `app/src/admin`).
   - What a person expects: the address of the page where members write, so the operator can test it and send it to a member.
   - Severity: blocks.
   - Fix: on the recording page, add a line "Members tell stories here:" with the Annotate address for each project.

3. **The previews look exactly like the real widget, but they have no links.**
   - What I saw: `09-…`, `13-…`. Stories, waveform and rights line all show; "Tell a story" and **Reply** are missing, and nothing says why.
   - What a person expects: the preview to be the widget, or a note that says it is not.
   - Severity: confuses.
   - Fix: under each preview, add "Preview only: the links to tell a story show on your site."

4. **The project link opens Settings, not Overview.**
   - What I saw: `/admin/collections/projects/1` opens the Settings form (`06-project-overview.png` and `07-…` are the same screen). Overview is a second URL (`08-project-overview.png`).
   - What a person expects: the Overview first (`ia.md` O16: "Overview (new, first)").
   - Severity: confuses.
   - Fix: make the project row link to `/overview`, or make Overview the default tab.

5. **"Review the stories of this project" opens the Waiting filter only.**
   - What I saw: in `08-…`, the link carries `_status=draft`, `rejection.at exists=false`, `processing≠true`. With 0 waiting, the list is empty, but the card above says "Published: 3 stories".
   - What a person expects: the link to open the stories that the card counts.
   - Severity: confuses.
   - Fix: when nothing waits, name the link "Waiting for review (0)", and add a second link for all the project's stories.

6. **The website list does not match the demo's own host sites.**
   - What I saw: in Settings, Websites = `http://127.0.0.1:4620` only. Step 3 says "Members come back only to 127.0.0.1:4620." (`13-…`). The WordPress and Omeka pages that the demo uses are on `localhost:8091` and `localhost:8092`.
   - What a person expects: the demo hosts to be on the list.
   - Severity: blocks (root cause 3).
   - Fix: in the demo seed, add `http://localhost:8091` and `http://localhost:8092` to River Voices' websites.

7. **Nothing warns when a story comes from a site that is not on the list.**
   - What I saw: the review screen for a story told from WordPress says "Told on: Not from a site: the member opened the Annotate page directly." (`51-review-first-waiting.png`, first run). This is false.
   - What a person expects: "Told on localhost:8091 (not one of this project's websites)", with an **Add this website** action.
   - Severity: confuses.
   - Fix: store the refused return origin and show it with a warning on the review screen and on Today.

8. **Sign-in words differ from `ia.md`.**
   - What I saw: the button reads "Login" and the link reads "Forgot password?" (`01-admin-login.png`). `ia.md` O1 says **Sign in** and **Forgot your password?**.
   - Severity: cosmetic.
   - Fix: set Payload's `authentication:login` translation to "Sign in".

### Step 2: visitor → member (WordPress)

9. **The WordPress and Omeka pages given for the demo load a dead stack.**
   - What I saw: `20-…`, `21-…`, `57-…` (still empty after the publish). The console shows `localhost:4510/embed/v1.js net::ERR_CONNECTION_REFUSED`.
   - What a person expects: the player.
   - Severity: blocks (root cause 1).
   - Fix: make `setup.sh` paste the demo snippet (`127.0.0.1:3500`, recording `1`), or delete the `player` pages and list the working plugin pages in DEMO.md.

10. **A widget that cannot load shows nothing.**
    - What I saw: `20-…`. No text, no audio, no error.
    - What a person expects: at least the audio, or "The stories could not load."
    - Severity: confuses.
    - Fix: make the snippet carry fallback child content (`<audio controls src>` plus a line), as CONTRACT V0 allows.

11. **"Tell a story" is small and comes last.**
    - What I saw: a small text link under all the stories, above the rights line (`22-wp-block-by-author.png`). At 390 px it is below the fold.
    - What a person expects: the main action near the play controls, with the time it will use ("Tell a story at 0:03").
    - Severity: confuses.
    - Fix: move "Tell a story" into the controls row and show it as a button.

12. **The page drops `return` with no message.**
    - What I saw: `26-annotate-email.png`. The way back reads "← Your stories" for a person who has no stories yet. The form has no `return` field.
    - What a person expects: "Back to the site".
    - Severity: blocks (the member cannot get back to WordPress).
    - Fix: when `return` is refused, show "We cannot send you back to this site." and log it for the operator (see 7).

13. **The time of the story is lost on the code screen.**
    - What I saw: `26-…` shows "You tell a story about 0:03 of the recording."; `27-annotate-code.png` does not.
    - What a person expects: the moment to stay visible on every sign-in step.
    - Severity: cosmetic.
    - Fix: keep the moment line on P2 and P3.

14. **A reload at "Choose your name" goes back to "Sign in".**
    - What I saw: reload of `29-annotate-after-code.png` → the email form again. The person needs a new code.
    - What a person expects: the name step to stay.
    - Severity: confuses.
    - Fix: make the session at the code step, and ask for the name as the first screen of a signed-in member with no name.

15. **End defaults to past the end of the audio.**
    - What I saw: `30-annotate-form-empty.png`: Start 0:03, End **0:13**, on a 0:10 recording.
    - What a person expects: End to be at most the length.
    - Severity: confuses.
    - Fix: clamp the default End to the recording's duration.

16. **The range is picked only by typing.**
    - What I saw: a drag on the waveform seeks; it does not select (`31-annotate-after-drag.png`, the fields stay 0:03 / 0:13). The new story's range is not drawn on the waveform.
    - What a person expects: drag to mark the range, and see it.
    - Severity: confuses (this is the core act of audio annotation).
    - Fix: draw the Start–End range as a region on the Annotate page's waveform; let a drag set it.

17. **"Use the player time" writes milliseconds.**
    - What I saw: End = `0:08.963` (`32-annotate-form-filled.png`). `ia.md` §7 says m:ss.
    - Severity: cosmetic.
    - Fix: round to whole seconds, or to 0.1 s at most.

18. **"Use the player time" does not name the time it will use.**
    - What I saw: two identical buttons, with no time on them (`30-…`).
    - What a person expects: "Use 0:05".
    - Severity: cosmetic.
    - Fix: put the current player time in the button label.

19. **After Send for review, the form is still on the page.**
    - What I saw: `33-after-send.png`. The title still says "Tell a story", the form is full, and a second **Send for review** button is there. The "Sent." banner is small.
    - What a person expects: a clear done screen: "Sent for review", the next steps, and **Back to the site**.
    - Severity: confuses.
    - Fix: after a save, close the form behind **Change the story**, and title the page "Your story".

20. **The badge says "Waits for review".**
    - What I saw: `33-…`. The admin says "Waiting for review"; `ia.md` §7 forbids "Waits for review".
    - Severity: cosmetic.
    - Fix: use the one lifecycle word, "Waiting for review".

### Step 3: operator again

21. **Today does not show the new story at once.**
    - What I saw: "No stories wait for review" can stay for up to 30 s after a send (the badge cache, phase5c decision 7). `50-today-with-waiting.png` shows one waiting story.
    - Severity: cosmetic.
    - Fix: none needed; optionally add "Counts can be 30 seconds late."

22. **A story told on WordPress has no "Open on the site".**
    - What I saw: `51-…`: "Not from a site". So the operator cannot check the published story on WordPress from the admin.
    - Severity: confuses (follows from 6).
    - Fix: same as 6 and 7.

23. **"Open on the site" goes to a widget that cannot show the story.**
    - What I saw: for the bare-page story, the link is `http://127.0.0.1:4620/bare.html#…annoudio-story=…`. That page shows the fixture's stories, one of them the XSS test string `<img src=x onerror=…>` (`58-bare-open-on-site.png`).
    - What a person expects: the story, open.
    - Severity: confuses.
    - Fix: give the demo a real return page on 4620 (or another origin) whose snippet points at :3500, recording 1.

24. **Publish works as designed.**
    - What I saw: the dialog with the preview (`52-publish-dialog.png`), the next story opens, then the empty Waiting tab with "Published. Visitors see it within one minute." (`53-…`, `54-…`). The story shows on the WordPress plugin page (`56-wp-after-publish.png`).
    - Severity: none. This is the reference.

25. **The "published" mail sends a WordPress story to Your stories.**
    - What I saw: Mailpit, "Your story is published" for the WordPress story. Its link is "Listen on the site: http://127.0.0.1:3500/annotate/mine".
    - What a person expects: a link to WordPress, or a label that matches where it goes.
    - Severity: confuses.
    - Fix: when `toldOn` is empty, label the link "Your stories", not "Listen on the site".

### Step 4: the DEMO.md Annotate link (`return=…4620/bare.html`)

26. **The return is accepted, but it lands on a widget that ignores it.**
    - What I saw: `40-demo-link-form.png` shows "← Back to the site". After Send for review, the page lands on `bare.html#annoudio-t=6&annoudio-project=river-voices&annoudio-recording=1&annoudio-saved=draft` (`41-bare-after-send.png`). The widget there is `recording="rec-0042"` on `localhost:4610`. The fragment names recording 1, so the widget shows no note and stays at 0:00. It lists other, fake stories.
    - What a person expects: the "sent" note at 0:06.
    - Severity: blocks (the demo's only working return proves nothing).
    - Fix: point DEMO.md's Annotate link at a host page with the demo snippet, for example the WordPress plugin page once 6 is fixed.

27. **bare.html's own "Tell a story" opens a blank page.**
    - What I saw: `http://localhost:4610/annotate?project=river-voices&recording=rec-0042&…` returns 404 with an empty body (`42-bare-tell-a-story-click.png`).
    - Severity: blocks (on that page).
    - Fix: do not use the fixture page as a demo return page; say in DEMO.md that it is a test fixture.

28. **The DEMO.md link has no `t`.**
    - What I saw: Start = 0:00 and End = 0:10, the whole recording (`40-…`).
    - Severity: cosmetic.
    - Fix: add `&t=2` to the DEMO.md link, so that the form shows a real moment.

### Step 5: wording

29. **"Player" is in UI text where CONTEXT.md says "widget".**
    - What I saw: CONTEXT.md lists "player (in UI text)" as forbidden. The UI still says: "Add a player" (sidebar), "Put your first player on a site", "Which site shows the player?", "Preview: the player with the look of this project", "The player as it shows on a host site…", "Paste these two lines into a web page to show the player…", "Visitors see it in the player now." (mail M3), "It shows in the player after review…", "Use the player time".
    - Severity: confuses (one idea, two words; `ia.md` §7 itself still uses "Add a player").
    - Fix: decide once. Either CONTEXT.md allows "player" as the public word, or the UI says "widget" (for example "Add a widget"). Then update `ia.md` §7.

30. **"Add a player" and "Put a recording on a site" name one job twice.**
    - What I saw: the sidebar and crumb say "Add a player"; the title says "Put a recording on a site" (`10-addplayer-step1.png`). The job reuses an existing recording, so "Add" is wrong.
    - Severity: confuses.
    - Fix: one name in both places, for example "Put on a site".

31. **"Recording" and "player" are mixed in one job.**
    - What I saw: the Recordings help says "Open a recording to copy its snippet for a web page." (`03-…`), so the snippet is a recording property. The wizard makes a "player". The recording page has no widget.
    - Severity: confuses.
    - Fix: say "the widget for this recording" everywhere the snippet shows.

32. **Topics and Concepts are mixed on one admin screen.**
    - What I saw: `16-story-published.png`: "Topics: Ferry" next to "No topic fits? Add a concept to River Voices". CONTEXT.md says operators see "Concept".
    - Severity: cosmetic.
    - Fix: on the review screen, use "Concepts (members see topics)". Then "No concept fits?".

33. **The Concepts page talks file formats, not audio.**
    - What I saw: `60-concepts.png`: "Download as SKOS · Turtle (.ttl) · JSON-LD (.jsonld)", "A Turtle or JSON-LD file with skos:Concept items…". This is jargon for a non-technical operator. Nothing says what a concept does in the widget.
    - Severity: confuses.
    - Fix: lead with "Members tag a moment of a recording with a topic; visitors see it as a label on the story", and fold the SKOS tools under "For other systems".

34. **No admin text explains the job in terms of audio annotation.**
    - What I saw: Today, Recordings and Stories help ("Stories and replies that members tell on the Annotate page…") never say that a story is a note on a time range of the audio, or where the Annotate page is.
    - Severity: confuses.
    - Fix: one line on Today, for example: "Members mark a moment of a recording and tell a story about it. You publish it; visitors see it on the timeline."

35. **The rights line repeats "Stories".**
    - What I saw: "Stories here: Stories © their tellers, shared under CC BY 4.0" (`22-…`, `30-…`).
    - Severity: cosmetic.
    - Fix: change the demo rights text to "© their tellers, CC BY 4.0", or drop the "Stories here:" label when the line starts with "Stories".

36. **"Short name" is the slug.**
    - What I saw: the field is "Short name" (`05-…`), but the help says "Part of the snippet and of every story address… Do not change it."
    - Severity: cosmetic.
    - Fix: name it "Address name (in the snippet)".

## The five fixes that matter most, in order

1. **Make the demo host pages real** (items 1, 9, 26). Point the WordPress `?pagename=player` and Omeka `page/player` pages at the demo stack (`127.0.0.1:3500`, recording `1`), or replace them with the plugin pages. List the working host URLs in DEMO.md, and point its Annotate link there.
2. **Put the demo host origins on River Voices' website list** (items 6, 12, 22): `http://localhost:8091` and `http://localhost:8092`. Then the return, the "sent" note at the right second, "Told on" and "Open on the site" all work.
3. **Give the admin a live way in** (items 1, 2, 3). Add **Try it: tell a story** (the Annotate address) on the recording page and in step 3, and make the step 3 preview's "Tell a story" link live.
4. **Never drop `return` silently** (items 7, 12). Tell the member, and show the operator "Told on localhost:8091 (not one of this project's websites)" with **Add this website**.
5. **Make the range visible on the Annotate page** (items 15, 16, 19). Draw Start–End on the waveform, let a drag set it, clamp End to the length, and show a done screen after Send for review.

## After the fixes (2026-10-09, demo environment only)

Fixes 1 and 2 of the list above, and the DEMO.md return page. No code changed in `app/`, `embed/`, `worker/` or `plugins/`; the images did not rebuild. Screenshots: `design/workflow-audit/after/`.

### What changed

- **Demo host pages.** `deploy/test-hosts/install-plugins.sh` now makes `http://localhost:8091/?pagename=demo` (WordPress, Custom HTML block) and `http://localhost:8092/s/annoudio/page/demo` (Omeka S, HTML block). Each holds the admin's two snippet lines: `127.0.0.1:3500/embed/v1.js`, project `river-voices`, recording `1`, `src` = the recording's URL. One widget per page. The Phase 2 `player` pages stay on the fixture (port 4510, `rec-0042`), because `embed/tests/hosts.spec.ts` asserts those values. `setup.sh` now says so in its header.
- **Websites of River Voices.** The same script adds `http://localhost:8091`, `http://127.0.0.1:8091`, `http://localhost:8092` and `http://127.0.0.1:8092` (REST, as the operator), and keeps the rows that are there. The list is now these four and `http://127.0.0.1:4620`.
- **DEMO.md.** It names the two demo pages first, lists the other host pages as test fixtures, and gives the Annotate link `t=2` and `return` = the WordPress demo page (not `bare.html`). A new section says what the member sees after **Send for review**.
- **Idempotence.** `setup.sh`, then `install-plugins.sh` two times: one `demo` page on each host, no duplicate websites.

### The walk (Chromium, muted; member 390 × 844, admin 1280 × 800)

| Step | Result | Screenshot |
|---|---|---|
| WordPress demo page, seek to 0:03 | The widget with 5 stories. **Tell a story** = `/annotate?…&t=3&return=http%3A%2F%2Flocalhost%3A8091%2F%3Fpagename%3Ddemo`. | `01-wp-demo-page.png` |
| Annotate page, invite code `EMNN-PQPD` | "← Back to the site" (the return is accepted). "You tell a story about 0:03." | `02-annotate-invite-code.png` |
| Name, then the form | Start 0:03. End typed as 0:06; story typed. | `03-annotate-story-written.png` |
| **Send for review** | Back on `?pagename=demo#annoudio-t=3&…&annoudio-saved=draft`. The widget is at 0:03 / 0:10 and says "Your story is sent. It shows here after review." | `04-wp-returned-sent-note.png` |
| Admin, the story | "Told on localhost:8091", with **Open on the site**. Publish. | `05-admin-review-told-on.png` |
| WordPress demo page again | The story shows (6 stories). No console errors. | `06-wp-story-published.png` |

The Omeka S demo page also loads the widget (6 stories), and its **Tell a story** link carries `return=http://localhost:8092/s/annoudio/page/demo`.

The walk added the member `walk-1791578866841@example.org` ("Walk Visitor") and one published story, "After the fixes: the horn sounds at the landing." (0:03–0:06).

### What still does not work (needs the app build)

- Fix 3: the admin still has no live way in. The previews still have `annotate="none"`, and no admin screen shows the Annotate address (items 1–3).
- Fixes 4 and 5: a refused `return` is still dropped with no message (items 7, 12). The Annotate page still defaults End past the length (0:13 on a 0:10 recording, seen again in this walk), the range is not drawn and a drag does not set it, and the full form stays after a save that has no return (items 15, 16, 19).
- Item 4 (project link opens Settings), item 10 (an empty widget when the loader fails), item 25 (the "published" mail label), and the wording items 29–36 are unchanged.
- The host origins live only in the demo database. A new demo stack (`down -v`) needs `install-plugins.sh` again; DEMO.md says so.
