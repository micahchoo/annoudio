# IA proposal A: task-centred

Status: proposal, 2026-10-09. ROADMAP Phase 5c step 1. One of three proposals (A task-centred, B object-centred, C journey-centred). `design/ia.md` compares them and chooses. Read `CONTEXT.md` first; this file uses its words.

## 0 The principle

Each person comes to Annoudio to do a job. The screens follow the jobs, not the database.

- **Operator**: the admin is a list of recurring jobs. The sidebar names jobs ("Review stories"), not collections ("Stories"). An object page (a recording, a concept) is a place that a job passes through. The operator can reach it, but never needs to start there.
- **Member**: the Annotate page has one job: tell a story about this moment. Each part of the page serves that job, or it goes.
- **Visitor**: the player has one job: find a moment, hear what people said, add yours.

Test for every screen: "Which job is this a step of, and what is the next step?" A screen with no answer is cut or moved to Settings.

Inputs: the demo stack (screens read with Playwright on 2026-10-09), `phase0-operator-walkthrough.md` (38 items), `phase3*`, `phase4b`, `phase5-notes.md`, `CONTRACT.md`, Payload 3.90.2 types in `app/node_modules/payload/dist`.

## 1 People and jobs

Frequency: D daily, W weekly, M monthly, R rare, 1 once.

### 1.1 Operator

| # | Job | Freq | Trigger | Starts at | Ends when |
|---|---|---|---|---|---|
| O-a | Review the stories that came in | D | "3 stories wait for review" on Today | Today → **Start reviewing** | The queue is empty: "No stories wait for review." |
| O-b | Find one story | W | A member or a site owner asks "where is my story?" | Review stories → All stories → search | The story page is open |
| O-c | Take down content | R (urgent) | A complaint about a published story or file | Find one story | Story unpublished or file deleted; player shows it no more |
| O-d | Put a recording on a site | M | "A site needs a player" / new audio in the archive | Today or sidebar → **Put a recording on a site** | Snippet copied, and the player shows on the host page |
| O-e | Keep the vocabulary tidy | M | Members write about a topic that is not in the list; a concept has 0 stories; a thesaurus update | Sidebar → **Tidy the vocabulary** | The tree is right; members see the new topic at once |
| O-f | Look after members | R | Spam, a complaint, "change my name" | Sidebar → **Look after members** | Member blocked, unblocked or name changed |
| O-g | Set up a site's project, change its look or rules | R | A new partner site; a site redesign | Settings → Projects | Project saved; the theme preview matches the site |
| O-h | Add an operator | R | A new team member | Settings → Operators | The new operator can sign in |
| O-i | First setup | 1 | A new stack | `/admin/create-first-user` | First project, first recording, first snippet copied |

### 1.2 Member

| # | Job | Freq | Trigger | Starts at | Ends when |
|---|---|---|---|---|---|
| M-a | Tell a story about this moment | Each visit | Hears something in the player; follows **Add a story at 0:42** | Annotate page at `t` | Back on the host page at the same second, with "Your story is saved. It shows here after review." |
| M-b | Fix a returned story | R | Sees "Returned: reason" on the Annotate page (today: only on the next visit; see §3.4 gap G2) | Annotate page → Your stories → **Change** | Story waits for review again |
| M-c | Change an own story | R | A typo, a better memory | Your stories → **Change** | Saved; a published story keeps its old text public until review |
| M-d | Reply to a story (Phase 5b) | Each visit | Reads a story in the player | **Reply** under the story | Back on the host page; reply waits for review |
| M-e | Sign out | R | Shared computer | Annotate page → **Sign out** | Session ends |

### 1.3 Visitor

| # | Job | Trigger | Ends when |
|---|---|---|---|
| V-a | Listen and read what people said | A host page with a player | Reads a story while its range plays |
| V-b | Jump to a moment | A region on the timeline, or a story in the list | Playback at the story's start; story marked `active` |
| V-c | Read a thread (Phase 5b) | A story with replies | Replies show under the story |
| V-d | Add yours | **Add a story at 0:42** | Becomes a member on the Annotate page (job M-a) |

## 2 The object model as each person sees it

Not the database. Each tree is what the person must hold in mind to do the jobs.

```
OPERATOR                                 MEMBER                      VISITOR
Today (what needs me)                    This moment                 This recording
├─ Stories (by review state)             ├─ the Recording (title,    ├─ Stories at moments
│  ├─ Draft · Returned · Published       │   project name, player)   │  ├─ text, voice note,
│  └─ Story: text, voice note/photo/     ├─ my Story (draft):        │  │  photo, video
│     video, topics, time range,         │   time range, text,       │  ├─ topics
│     member name, recording, project    │   topics, voice note/     │  ├─ name, date, range
├─ Recordings                            │   photo/video             │  └─ replies (5b)
│  └─ Recording: title, audio address,   └─ My stories here          └─ "Add a story at 0:42"
│     length, its Snippet per project        (Waits for review /
├─ Projects (= sites)                        Published / Returned:
│  ├─ Vocabulary → Concepts (tree)           reason)
│  ├─ Website addresses, review rule,
│  │  rights statement, Theme tokens
├─ Members (name, email, stories, blocked)
└─ Operators
```

Containment rules the operator sees:
- A **Project** is "a site": one vocabulary, one look, one rule. The words "Project" and "site" appear together on every project screen: "Project (one for each site)".
- A **Recording** belongs to the **Catalogue**, not to a project. One recording can be on several sites. The **Snippet** is the pair (project, recording); the operator meets it only as "put this recording on that site". The word **Instance** never shows.
- A **Story** belongs to one recording and one project. The operator reaches it through review, never through the recording first.

Objects a role never sees:

| Role | Never sees |
|---|---|
| Operator | WADM, Body, Target, IRI (except a read-only "Concept address" on the concept page), Container, Instance, UUIDs, `t=62,95`, Media bodies as a list (reached only from a story), login codes, sessions, story representations |
| Member | Project slug, recording id, review rules, other members' drafts, Concept IRIs, the word "Concept" (sees "Topics"; see §6), the word "draft" (sees "Waits for review") |
| Visitor | Drafts, member emails, the word "Member", anything of the Annotate page until the link |

## 3 Navigation

### 3.1 Operator: one home, jobs in the sidebar

The home screen is **Today** (`/admin`). The sidebar has task links first, then Settings. Collections that a task reaches do not show as collections.

```
┌──────────────────────────┬──────────────────────────────────────────────────┐
│ Annoudio · River Voices  │ Today                                            │
│ org                      │                                                  │
│                          │  3 stories wait for review. The oldest came in   │
│ ● Today                  │  2 days ago.               [ Start reviewing ]   │
│   Review stories     (3) │                                                  │
│   Put a recording on a   │  1 story is returned and waits for the member.   │
│     site                 │  1 voice note could not be processed. → open     │
│   Tidy the vocabulary    │                                                  │
│   Look after members     │  Other jobs                                      │
│                          │  [ Put a recording on a site ]                   │
│ Settings                 │  [ Add a concept ]   [ Find a story ]            │
│   Projects (sites)       │                                                  │
│   Operators              │  Last 7 days: 12 stories in, 9 published,        │
│   Your account           │  2 returned. 4 recordings have stories.          │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

| Level 1 (sidebar) | Level 2 (inside) | Job | Ends at |
|---|---|---|---|
| Today | none | all | a job's first screen |
| Review stories (count) | tabs: Waiting for review · Returned to the member · Published · All stories (with search) | O-a, O-b, O-c | empty queue / the story |
| Put a recording on a site | steps: 1 Recording · 2 Site · 3 Snippet; plus "All recordings" | O-d | snippet copied, page checked |
| Tidy the vocabulary | one tree per project (project picker if more than one) | O-e | tree saved |
| Look after members | list → member page | O-f | member saved |
| Settings → Projects (sites) | project page tabs: Project · Review and rights · Theme | O-g | saved |
| Settings → Operators | list → new operator | O-h | operator added |
| Settings → Your account | Payload account view | | |

Rules:
1. The badge on "Review stories" is the count of the Waiting tab. No other badge.
2. Every list row and every count opens the object page in the context of a job. The breadcrumb names the job: "Review stories / Story by Asha, 1:02–1:35".
3. Every job ends on a screen that says what happens next ("It shows in the player now", "Paste the snippet into your page").
4. Object pages (Recording, Concept, Member, Project) stay reachable by their direct URL and from links. They are not in the sidebar.

### 3.2 Member: one screen

The Annotate page is the member's only screen. It is one column, phone first. Its parts, top to bottom: the moment (recording title, project name, player at `t`); sign in (only when signed out); the story form; My stories on this recording; Sign out. There is no member home and no member list of all stories. A member who comes without a link gets the not-found page.

### 3.3 Visitor: the player

The player is the visitor's only surface. It has no navigation beyond the timeline, the story list and the **Add a story at 0:42** link (CONTRACT §3.3 parts, §7).

### 3.4 Handoffs between surfaces

What carries each handoff, and where the chain breaks today.

```
 OPERATOR (admin)              HOST SITE (not ours)          VISITOR / MEMBER
 Put a recording on a site
   └ [Copy the snippet] ──────► operator pastes 2 lines
                                into the CMS page
                                   └ page loads /embed/v1.js ► Player (V2/V3)
                                                                 └ Add a story at 0:42
                                                                   ?project&recording&t&return
                                                                       ▼
                                                              Annotate page: Sign in
                                                              email ─► mailbox ─► login code
                                                              (first time: Name)
                                                                       ▼
                                                              Write ─► [Save the story]
                     ◄──────── return URL #annoudio-t=…&annoudio-saved=draft
                                   └ Player: "Your story is saved. It shows here after review."
 Today: "1 story waits" ◄───── (no signal today: G1)
   └ Review one story
       ├ [Publish] ─ rebuild ────────────────────────────────► Player shows it (V2)
       │                                                         └ Reply (5b) ─► Annotate ?replyTo
       └ [Return to the member] ─ (no mail today: G2) ───────► Annotate page:
                                                                "Returned: reason" (next visit)
```

| Handoff | Carrier | Gap |
|---|---|---|
| Admin → host site | Clipboard; the operator works in another tool | G3: the stack cannot tell whether the snippet is live on the page |
| Host → player | `<script>` + `<annoudio-player>` | none (CONTRACT) |
| Player → Annotate | `<a href>` with `t` and `return` (CONTRACT §7.1) | none |
| Annotate → mailbox → Annotate | Login code mail; the member switches app on a phone | Phone may unload the tab; the sign-in step comes before writing for this reason (§4.2 M1) |
| Annotate → host | Redirect with fragment (CONTRACT §7.2) | Unlisted `return` origin drops the return; page shows "saved" with no way back. Default: show the recording's project site as a link |
| Annotate → admin | Story row, review state Draft | G1: no signal to operators. Proposal: daily mail "N stories wait" through Payload's email adapter (5c deliverable "real email adapter") |
| Admin → member | Review state, `rejection` | G2: member learns about Publish or Return only on a next visit. Proposal: one mail on Return (reason + Change link) and one on first Publish. Needs a new `membership` mail; see §7 F8 |
| Admin → player | Rebuild on publish | none; next player load shows it |

## 4 Screen inventory

Columns: states (E empty, L loading, X error, S success, W waiting, R returned, P processing, plus named states), primary action, words on the primary buttons. Button words in **bold** are exact UI text.

### 4.1 Operator (admin)

| ID | Screen | States | Primary action | Button words |
|---|---|---|---|---|
| O0 | Create the first operator (`/admin/create-first-user`) | form; X field errors | create the first account | **Create the first operator** |
| O1 | Sign in | form; X wrong email or password; X no mail adapter for reset (see F9) | sign in | **Sign in**, **Forgot your password?** |
| O2 | Today | E new stack (setup list, §5 F1); E nothing waits ("No stories wait for review. The last story came in 3 days ago."); W work waits; X a count fails ("We could not count the stories. Reload the page.") | start the most urgent job | **Start reviewing**; on E: **Create the first project** |
| O3 | Review stories (list with 4 tabs) | L; E per tab ("No stories wait for review." / "No story is returned." / "No story is published yet."); list; X list fails (Payload) | open the oldest waiting story | **Start reviewing** (opens the oldest); row click |
| O4 | Review one story | W Draft; P voice note/photo/video still processing (Publish off, reason shown); X file failed ("This file cannot play. Return the story so the member can attach a new file."); R returned (reason, date, "waits for the member"); S published; published + newer draft ("Published. A change waits for review."); reply (5b: parent story shown above); X publish error (toast with plain reason) | decide | **Publish**, **Return to the member**, **Next story** (replaces "Keep as draft", which saves nothing), **Unpublish** (published only) |
| O4a | Publish done | S toast "Published. Visitors see it in the player now." and the next waiting story opens; S queue empty → back to O3 empty | continue | **Next story** (automatic) |
| O5 | Return dialog | open; X empty reason ("Write the reason. The member sees it."); S "Returned to the member." | send the reason | **Return to the member**, **Cancel** |
| O6 | Take down a file (from O4, ⋮ menu) | confirm ("The file is deleted from this stack. Copies in caches can stay for some time."); S | delete the file | **Delete the file**, **Cancel** |
| O7 | All recordings (inside "Put a recording on a site") | E "No recordings yet." ; list: Title, Length, Stories `3 (2)`, Projects with stories | start a new one | **Add a recording** |
| O8 | Put a recording on a site, step 1: Recording | choose existing or new; new: title + Audio address; L "Checking the audio…"; S "The audio plays in this browser. Length: 30:34."; X "This browser cannot play this address." (save still allowed); X not https | go on | **Check the audio**, **Next** |
| O9 | step 2: Site | list of projects; E no project ("Create a project first" inline: name + website address); X the website address is missing from the project ("The player works, but members cannot come back to this site." with **Add the website address**) | choose the project | **Next** |
| O10 | step 3: Snippet | the two lines (CONTRACT §1), a live player preview with the project theme, the instruction "Paste these two lines into the page. A page needs the first line one time only."; S "Copied."; X clipboard refused (select-all fallback) | copy | **Copy the snippet**, **Done** |
| O11 | Recording page (object) | edit; snippet panel per project; "Stories on this recording" link to O3 filtered | save | **Save** |
| O12 | Tidy the vocabulary (tree) | E "No concepts yet. Members see no topics." ; tree with story counts; inline add (X empty label, X duplicate label); rename; move (X cycle refused); hide; X remove refused ("12 stories use this concept. Hide it from new stories instead."); import preview (added / changed / unchanged / left out); X bad file; S "Imported: 4 added, 1 changed." | add a concept | **Add a concept**, **Download as SKOS**, **Upload SKOS file**, **Import these changes** |
| O13 | Concept page (object) | edit; usage count; read-only Concept address | save | **Save**, **Hide from new stories** |
| O14 | Look after members (list) | E "No members yet. Members sign up on the Annotate page."; list: Name, Stories, Last story, Status | open a member | row click |
| O15 | Member page | active; blocked ("This member cannot sign in. Their published stories stay."); stories of this member (link to O3) | block or unblock | **Block this member**, **Unblock** |
| O16 | Projects (sites) list | E "No projects yet."; list: Name, Website address, Review rule, Stories | create | **Create a project** |
| O17 | Project page, tabs Project · Review and rights · Theme | edit; X bad website address; Theme: live preview with the real player; S saved | save | **Save** |
| O18 | Operators list / new operator | list; new: email + password; S "Tell the new operator the password." (no mail adapter, F9) | add | **Add an operator** |
| O19 | Story history (from O4) | list "Published by Asha, 9 Oct 12:36", "Saved by the member, 9 Oct 12:30"; E one entry | read | none |

### 4.2 Member (Annotate page, `/annotate`)

| ID | State of the page | What shows | Primary button |
|---|---|---|---|
| M0 | Not found | "We cannot find this recording" + way back | **Go back** |
| M1 | Arrive, signed out | The moment on top: title, project, player at `t`, "You tell a story about 0:42." Below: sign-in. Sign in comes first: the code mail makes a phone switch apps, and an unsaved text can be lost | **Send the code** |
| M2 | Code sent | "We sent a code to a@b.org. It works for 10 minutes." X wrong code; X expired; X too many tries; X too many codes; X mail failed | **Sign in**; **Send a new code**, **Use a different email** |
| M3 | First sign-in: name | "People who listen see this name next to your stories. They never see your email." X empty, X too long | **Continue** |
| M4 | Write (signed in) | Start and End prefilled from `t` (shown as `0:42`, typed as m:ss or seconds), **Use the player time** for each; Story text; Topics; Voice note, photo or video (optional) | **Save the story** |
| M4p | Uploading / processing | "Uploading: 40 %" (Save off: "Wait for the upload to finish."); then "Processing. You can save the story now." | **Save the story** |
| M4x | Save error | The field-level message from `saveErrors`; typed text and files stay | **Save the story** |
| M4s | Signed out while writing | "Your session ended. Sign in again. Your text stays on this page." (G4: today the text is lost on reload) | **Send the code** |
| M5 | Saved, waits (no valid return) | "Your story is saved. It shows in the player after review." + link to the project site | **Back to the site** |
| M5h | Saved, valid return | Redirect to host; the player shows the note (V6) | none |
| M6 | Saved and published (rule "publish at once") | "Your story is saved and published. It shows in the player now." | **Back to the site** |
| M7 | My stories on this recording | E "You have no stories on this recording yet."; rows: Waits for review / Published / Published. Your change waits for review / Returned to you: reason | **Change** |
| M8 | Change a returned story | The reason above the form: "Returned: The time range does not match. Change the story, then save it again." | **Save the story** |
| M9 | Reply (5b, `?replyTo=`) | The parent story quoted, no time range, text (+ voice note) | **Save the reply** |

### 4.3 Visitor (player, CONTRACT)

| ID | State | What shows | Primary |
|---|---|---|---|
| V1 | Before the loader / no JavaScript | Fallback content: a link to the audio | the link |
| V2 | Ready, with stories | Timeline with regions; story list in timeline order; each story: text, media, topics, name, date, range | **Play** |
| V3 | Ready, no stories | "No stories yet." + the link (display text only; not in the contract) | **Add a story at 0:42** |
| V4 | Story open | `active` region and story; playback from its start | **Play** |
| V5 | Errors (CONTRACT §9) | the six codes and their messages; `not-found` hides the link | as §9 |
| V6 | Back from Annotate | seek to `annoudio-t`, focus on **Play**, note "Your story is saved. It shows here after review." | **Play** |
| V7 | Thread (5b) | replies under the open story; **Reply** link | **Reply** |

Link text: today "Add a story". Proposal: "Add a story at 0:42", with the time from `currentTime`. The time is the job's object; the href already holds it. Message text is not part of the contract (CONTRACT §9 rule 2), so this is not a v2 change.

### 4.4 Mail

| Mail | To | Today | Proposal |
|---|---|---|---|
| Login code | Member | yes | keep: "Your login code: 123456. It works for 10 minutes." |
| Password reset | Operator | no adapter | 5c: real email adapter |
| "N stories wait for review" | Operators | no | daily, only when N > 0 (G1) |
| "Your story is returned" / "is published" | Member | no | one mail each (G2, F8) |

## 5 Flows

### F1 First operator on an empty stack

| # | Screen / state | The operator does | The screen says |
|---|---|---|---|
| 1 | O0 | types email and password | **Create the first operator** |
| 2 | O2 E new stack | reads the setup list | "Three steps put the first player on a site: 1 Create a project for your site. 2 Put a recording on the site. 3 Paste the snippet into a page." |
| 3 | O16 → O17 | name "River Voices", website address `https://rivervoices.example.org`, review rule, rights statement | **Create a project** → S "Saved." Back to Today; step 1 ticked |
| 4 | O8 | title, audio address → **Check the audio** | S "The audio plays in this browser. Length: 30:34." |
| 5 | O9 | chooses River Voices | **Next** |
| 6 | O10 | sees the preview player, **Copy the snippet** | S "Copied." "Paste these two lines into the page." |
| 7 | (host CMS) | pastes the snippet | (outside) |
| 8 | O2 | step 3 stays "Did you paste it? Open your page and look for the player." (G3) | **Done** ticks it by hand |
| 9 | O2 | optional: **Add a concept** (O12) | the setup list goes; Today shows the normal view |

### F2 Recording to live player

O2 → **Put a recording on a site** → O8 (new recording, L checking, S plays) → **Next** → O9 (project) → **Next** → O10 (preview, **Copy the snippet**, S Copied) → host CMS → visitor opens the page → V1 → V3 "No stories yet." with **Add a story at 0:42**. The recording now shows in O7 with Stories `0`. The job ends at O10 **Done**, which returns to Today.

### F3 Story from Annotate link to visible

| # | Surface / state | Person does | Result |
|---|---|---|---|
| 1 | V2 at 0:42 | visitor selects **Add a story at 0:42** | Annotate page `?t=42&return=…` |
| 2 | M1 | types email, **Send the code** | M2 |
| 3 | mailbox | reads "Your login code: 123456" | |
| 4 | M2 → M3 (first time) | code, **Sign in**, name, **Continue** | M4 with Start 0:42 |
| 5 | M4 → M4p | writes, picks topic "Ferry", records a voice note | "Processing. You can save the story now." |
| 6 | M4 | **Save the story** | M5h: host page at 0:42, V6 note |
| 7 | (G1) operator mail or Today | | O2 "1 story waits for review." |
| 8 | O3 → O4 W/P | **Start reviewing**; if P: Publish is off with "The voice note is still processing." | |
| 9 | O4 | reads, plays the range, **Publish** | O4a "Published. Visitors see it in the player now." next story opens |
| 10 | V2 | next page load | the story shows at 0:42 |

### F4 Story returned and resubmitted

| # | Surface / state | Person does | Result |
|---|---|---|---|
| 1 | O4 W | **Return to the member** | O5 |
| 2 | O5 | reason "The range is 1:02–1:35, but the story is about the horn at 2:10. Move the range." **Return to the member** | S "Returned to the member." Story in tab "Returned to the member"; next story opens |
| 3 | (G2) mail to member | "Your story is returned. Reason: … Change it here: [link to Annotate page with `?story=<id>`]" | |
| 4 | M1/M2 (if signed out) → M8 | sees "Returned: reason", changes the range, **Save the story** | M5h; story leaves "Returned", enters "Waiting for review" |
| 5 | O2 / O3 | badge +1 | O4 shows "Returned on 9 Oct: reason. Changed by the member on 10 Oct." |
| 6 | O4 | **Publish** | as F3 step 9 |

Without the G2 mail, step 3 does not happen. The member sees the reason only if they come back to the same recording.

### F5 Concept added and used

| # | Surface / state | Person does | Result |
|---|---|---|---|
| 1 | O4 | reads a story about "the ferry horn"; no topic fits | (the trigger) |
| 2 | O12 | sidebar **Tidy the vocabulary** → River Voices → **Add a concept** under "Ferry": label "Horn" | S "Added. Members can choose it now." The app makes the Concept address |
| 3 | O4 | (optional) back to the story | operators cannot add a topic to a member's story (stories are the member's words); the story keeps its topics |
| 4 | M4 | the next member sees "Horn" under "Ferry" in Topics | picks it, saves |
| 5 | O4 → V2 | **Publish** | the player shows the tag "Horn" |
| 6 | O12 | later: rename "Horn" to "Ferry horn" | published stories show the new label after the rebuild (`conceptChanged`) |

## 6 Naming

UI words. One word, one meaning, on every surface. "Forbidden" means: never in UI text, mail or docs for operators and members.

| UI word | Seen by | Means (CONTEXT term) | Forbidden synonyms |
|---|---|---|---|
| Operator | Operator | Operator | user, admin, staff, editor |
| Member | Operator | Member | user, annotator, contributor, account |
| (no word) | Visitor | Visitor | reader, guest, user |
| Name | Member, Operator | nickname | username, handle, display name |
| Project (one for each site) | Operator | Project | space, workspace, site config |
| Website address | Operator | `siteOrigins` | origin, domain, site URL |
| Recording | all | Recording | file, media, track, audio item |
| Audio address | Operator | recording `url` | URL, link, source |
| Length | Operator | duration | duration, runtime |
| Story | all | Story | comment, note, annotation, post, submission |
| Reply (5b) | all | Story with `replying` | comment, response |
| Voice note · Photo · Video | all | `Sound` · `Image` · `Video` body | attachment, media body, upload, file (except "the file" in a take-down) |
| Time range, shown `1:02–1:35` | all | Target | selection, fragment, `t=` |
| Concept | Operator | Concept | tag, term, category, keyword |
| Topic | Member, Visitor | Concept (as chosen on a story) | tag, category |
| Vocabulary | Operator | Vocabulary | taxonomy, ontology, thesaurus, tag list |
| Draft · Returned · Published (badges) | Operator | Review state; "Returned" = draft with a reason | pending, approved, rejected, live, in moderation |
| Waits for review · Returned to you · Published | Member | Review state | pending, draft, rejected |
| Publish · Unpublish · Return to the member | Operator | review actions | approve, accept, reject, decline, publish changes |
| Snippet | Operator | Snippet | embed code, widget code, script |
| Player | Operator | Player | widget, embed, iframe |
| Annotate page | Operator, docs | Annotate page | editor, form |
| Tell a story (page title) | Member | Annotate page | annotate, add annotation |
| Login code | Member | Login code | magic link, OTP, PIN, password |
| Theme | Operator | Theme tokens | skin, branding, style |
| Rights statement | Operator | rights line + IRI | licence field, copyright line |
| Concept address | Operator (read-only) | concept IRI | IRI, URI, identifier |

Conflict to settle in `ia.md`: CONTEXT.md says "Concept" and forbids "tag, term, category". The Annotate page says "Topics" today. This proposal keeps both, split by role: "Concept" in the admin, "Topic" for members and visitors. The admin vocabulary screen says once: "Members see concepts as topics." If `ia.md` accepts this, add "Topic" to CONTEXT.md as the member-facing name of a Concept. The rival (one word everywhere) is cleaner, but "concept" is a strange word for a community member.

## 7 Feasibility in Payload 3.90.2

Verified in `payload/dist/config/types.d.ts` and `collections/config/types.d.ts`:
- `admin.components.views.{key}: { Component, path, exact }` adds a route under `/admin`; `views.dashboard` replaces the home.
- `admin.components.beforeNavLinks` / `afterNavLinks` add links to the default nav; `admin.components.Nav` replaces it.
- Collection `admin.group: false` removes a collection from the sidebar and the dashboard "without disabling its routes"; `admin.hidden` removes routes too.
- Collection `admin.components`: `beforeList`, `beforeListTable`, `listMenuItems`, `views.list`, `views.edit.{default,versions,…}` with `tab.condition`, `edit.PublishButton`, `edit.SaveDraftButton`, `edit.beforeDocumentControls`, `edit.editMenuItems`; `baseFilter`; `enableQueryPresets`.
- `admin.dashboard` (widgets) exists but is marked `@experimental`.
- A custom root view is a bare page; to get the sidebar it renders `DefaultTemplate` from `@payloadcms/next/templates` and checks `req.user` itself.

| Screen | Build | How |
|---|---|---|
| O0, O1 | Payload customised | `admin.components.graphics` (logo), `beforeLogin`; i18n for button words |
| O2 Today | Payload customised | `views.dashboard` replacement (not the experimental widgets); calls `stories.counts` and the module interfaces (phase 5 decision 9) |
| Sidebar | Payload customised | `beforeNavLinks` (task links + review badge) + `group: false` on Stories, Media bodies, Recordings, Concepts, Members; Projects and Operators stay in a "Settings" group. Not a full `Nav` replacement: it would re-implement active state and the mobile toggle |
| O3 | Payload default + customised | exists: `baseFilter`, `ReviewTabs` in `beforeList`; add search on excerpt and nickname (`listSearchableFields`) |
| O4, O4a | Payload customised | exists: `StoryPanel`, `RejectButton`. New: `edit.PublishButton` that opens the next waiting story; "Next story" in `beforeDocumentControls`. Needs a new `stories` method `nextWaiting(afterId)` (F4) |
| O5, O6 | Payload customised | exist (`<dialog>`, delete on Media bodies); O6 needs a link from the story panel to its media row |
| O7–O10 Put a recording on a site | custom page under /admin | `views.putOnSite` at `/admin/put-on-site` with `DefaultTemplate`; Server Actions that call `catalogue` and `projects`; reuses `DurationField`, `SnippetCopy`, `ThemePlayer` |
| O11, O13, O15, O17 | Payload default + customised | exist as edit views |
| O12 Tidy the vocabulary | custom page under /admin | `views.vocabulary` at `/admin/vocabulary/:project?`; reuses `VocabularyPanel`, `SkosTools`; inline add, rename, move need Server Actions over `vocabulary` (F7) |
| O14, O16, O18 | Payload default | list views with labels and empty-state text in `beforeListTable` |
| O19 history | Payload customised | `views.edit.versions.Component` replacement; needs the author of each version (F12) |
| M0–M9 | outside the admin | Next route `(frontend)/annotate`; exists except M4s, M9, link to site in M5 |
| V1–V7 | outside the admin | `embed/`; V3 text and the "at 0:42" link text are display changes; V7 is 5b |
| Mail | outside the admin | Payload `email` adapter (operators); `membership` Mailer (members) |

Flags: what the current code structure cannot do yet.

- **F4 Next story.** `stories` has `counts` and `review`, but no "next in queue". Add `nextWaiting` to the `stories` interface (a `design/stories-interface.md` change).
- **F5 Put a recording on a site writes two modules.** `catalogue` and `projects` expose admin forms and lookups, not write functions. The wizard needs `catalogue.register({ title, url, length })` and `projects.addSiteOrigin(slug, origin)`. Rule in CONTEXT: nothing outside a module reads its collections. So these are interface additions, not admin code.
- **F6 "Which sites show this recording?" is not knowable.** No stored link between recording and project: the instance is derived. O7 can show only "projects with stories on this recording". G3 (is the snippet live?) has no data source. A server fetch of the host page is an SSRF risk; this proposal does not do it. Default: the operator ticks it by hand.
- **F7 Vocabulary as a job.** Today it is a project tab plus the Concepts form. A top-level page is new UI over the same `vocabulary` interface; no schema change.
- **F8 Member mail on Return and Publish.** `membership` has one mail (login code). A new mail kind and a call from `stories.reject` / `publish` cross modules; it needs a port or an event. Out of IA scope: `ia.md` decides.
- **F9 Operator mail.** No Payload email adapter: password reset and the daily digest fail today. 5c deliverable.
- **F10 Payload "[Untitled]" heading** on a new recording (walkthrough 30) has no option. The wizard avoids it: the operator never sees Payload's create view for recordings.
- **F11 Text kept across sign-out (M4s).** Needs client storage of the draft text (`sessionStorage`, try/catch). Small change in `StoryForm`.
- **F12 Readable history.** Payload versions store no author by default. Needs a `lastChangedBy` field written by a hook, or the history stays hidden.

## 8 Trade-offs of this principle

Strong:
- **The daily job is short.** Today → Start reviewing → Publish → next story opens. No filter, no list choice. This is the job that runs every day, so its click count matters most.
- **A non-technical operator never needs the data model.** "Put a recording on a site" hides the fact that a recording and a project are separate and that a snippet is their pair. Walkthrough items 27, 35, 36 go away by design, not by a label.
- **Empty states point to the next job.** An empty stack shows three steps; an empty queue says when the last story came. Each job ends on "what happens next".
- **The handoffs are visible.** The design lists each place where the chain breaks (G1–G3) instead of hiding them behind object pages.
- **The member page stays simple.** One job, one column, phone first.

Weak:
- **An operator who thinks in projects.** "Show me everything about River Voices" has no screen. The operator must pick River Voices in each job: the review tabs, the vocabulary picker, the wizard. Mitigation: one project filter that each task remembers (Payload preferences). It is still four places, not one. Proposal B is stronger here.
- **Two ways to the same object.** A recording is made in the wizard and changed on its object page. Two forms can drift. Rule: the wizard and the object page call the same module function, and the object page has no create button.
- **More custom pages.** Two custom views, a nav extension and a dashboard replacement. Each Payload upgrade can break them (`DefaultTemplate`, import map). An object-centred IA uses more Payload defaults.
- **Jobs we did not list fall into Settings.** Exports of all stories, a report for a funder, or a bulk move have no home. A task IA grows a junk drawer when jobs change.
- **Search is a second-class job.** "Find a story" lives inside the review tabs. An operator who answers questions all day would want search first.
- **Verb labels are long.** "Put a recording on a site" wraps in a narrow sidebar and is hard to translate short.

## 9 Defaults this proposal sets for `ia.md`

1. The home is Today, a `views.dashboard` replacement, not widgets.
2. Sidebar = task links (`beforeNavLinks`) + Settings; collections that a task reaches use `group: false`.
3. "Keep as draft" becomes **Next story**; **Publish** opens the next waiting story.
4. Member signs in before writing (phone app switch), with the moment shown above.
5. The player link reads **Add a story at 0:42**; empty player says "No stories yet."
6. Member mail on Return (G2) and an operator digest (G1) are the two biggest gaps in the chain; decide both in `ia.md`.
