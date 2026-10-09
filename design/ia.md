# Annoudio information architecture

Status: decision, 2026-10-09. ROADMAP Phase 5c step 1. Phase 5c step 2 builds this file. Read `CONTEXT.md` first; this file uses its words, including **Reply** and **Topic**.

Sources: `ia-C-journey-centred.md` (the spine: lifecycle, who sees what, mails, member home, system return, no Unpublish), `ia-A-task-centred.md` (operator navigation: Today, job sidebar, Publish → next story, the 3-step wizard), `ia-B-object-centred.md` (the project frame on public surfaces, one project overview page). Not taken from B: per-project list scoping, the project cookie, the replaced sidebar, the two-level navigation, the stored project ↔ recording link. Payload facts come from the feasibility sections of A, B and C (checked against 3.90.2 types).

## 0 Decision summary

1. One story lifecycle with six names (Processing, Waiting for review, Returned, Published, Published · change waiting, Removed) on every surface: admin, Annotate page, player note, mail.
2. **Unpublish** goes. A story leaves the player by **Return to the member** (with a reason) or **Remove**. A return of a change keeps the published version visible.
3. The operator home is **Today**: a setup checklist on an empty stack, then the work that waits.
4. The sidebar names jobs in ≤ 3 words: Today, Review stories, Add a player, Concepts, Members; then Settings: Projects, Recordings, Operators, Your account.
5. **Publish** opens a dialog with the visitor preview; after it, the next waiting story opens. **Next story** replaces "Keep as draft".
6. **Put a recording on a site** has 3 steps: Recording, Site (the project), Snippet. A new public route `GET /embed/v1/recordings/{project}/{id}.json` serves the CMS plugins.
7. Members get a home, **Your stories**, and **Your account** (name, mail choice, sign out). Six mails close every handoff; each has one link.
8. The project frame (name, theme, rights line) shows on the Annotate page; the player shows theme and rights line. The theme JSON gets three additive keys: `name`, `rightsLine`, `rightsIri`.
9. Schema: five new fields (story `toldOn`, `changedBy`, `lastAction`, `rejection.automatic`; member `mailNotices`; operator `reviewMail`). One migration.
10. Counts split stories and replies in words ("2 stories and 1 reply wait for review"); the catalogue column counts stories only, as the player's `total` does.

## 1 People, jobs, handoffs

| Person | Device | Home | Daily or common jobs |
|---|---|---|---|
| **Operator** | Laptop | **Today** (`/admin`) | Review stories; put a recording on a site; keep the concepts tidy; look after members; set up projects |
| **Member** | Phone first | **Your stories** (`/annotate/mine`) | Tell a story; fix a returned story; read the result; reply |
| **Visitor** | Any | The host page with the player | Listen; read stories and replies; select **Tell a story** or **Reply** |

A **handoff** is the moment when one person's action is the next person's trigger. Each handoff has a signal that reaches the next person when that person is away.

| # | From → to | Action | Signal |
|---|---|---|---|
| H1 | Operator → host site | **Copy the snippet** (step 3) | Clipboard; the operator pastes it |
| H2 | Host site → visitor | Page loads | The player |
| H3 | Visitor → member | **Tell a story** / **Reply** | Annotate page at `t` |
| H4 | Member → operator | **Send for review** | Count on Today and the sidebar; M6 |
| H5 | Worker → story | Media ready or failed | State change; the page polls; a failure is a system return (M2) |
| H6 | Operator → member | **Return to the member** | M2; banner on the story |
| H7 | Operator → member | **Publish** | M3; badge in **Your stories** |
| H8 | Operator → visitor | **Publish** | The player shows it within `STORIES_MAX_AGE` (60 s) |
| H9 | Replier → parent's member | Reply is published | M4 |
| H10 | Operator → member | **Remove** | M5 |

## 2 Story lifecycle

### 2.1 States

The UI state is derived from stored data. One function, `stories.lifecycle(row)`, derives it. The admin, the Annotate page, the mails and the counts call only this function.

| UI state | Stored as | Badge role |
|---|---|---|
| Writing | Not stored. Annotate page only. | none |
| **Processing** | `draft`, no rejection, a media body not `ready` | neutral |
| **Waiting for review** | `draft`, no rejection, all media `ready` | attention |
| **Returned** | `draft` with `rejection` (`automatic` = operator or system) | warning |
| **Published** | `published`, no newer draft | success |
| **Published · change waiting** | `published` plus a newer draft. The change has its own state: Processing, Waiting for review or Returned. | success + attention |
| Removed | No row. M5 is the record. | none |

Transitions:

```
 Writing ──Send for review──> Processing ──media ready──> Waiting for review ──Publish──> Published
                                   │ file failed (system)        │ Return                │  │
                                   v                             v                       │  │ member changes
                               Returned <────────────────────────┘<──── Return ──────────┘  v
                                   │ member: Send for review           Published · change waiting
                                   └────> Processing or Waiting           (Return or Publish acts on the change)
 Remove: from any state → Removed (the story and its replies)
```

Rules:
1. `publish-at-once`: Waiting for review is skipped. Writing → Published, or Processing → Published when the media is ready (the `media.settled` consumer publishes it).
2. **Return** of a Published story (no newer draft) makes it a draft with the reason: visitors stop seeing it. This is the take-down path. **Return** of a change returns the newer draft only: the published version stays visible (Phase 5 decision 5).
3. **System return**: when a media body fails, the `media.settled` consumer sets `rejection` with `automatic: true` and the reason "We could not use your file. Attach a different file." The operator sees "Returned (automatic)".
4. A member never sees "draft". An operator sees "Draft" only in History.
5. A reply has the same states. Its parent must be Published for the reply to show (Phase 5b decision 7).

### 2.2 Who sees what

| State | Operator sees | Member sees | Visitor sees | Mail | Next move (who) |
|---|---|---|---|---|---|
| Writing | nothing | the form | nothing | none | **Send for review** (member) |
| Processing | Row in **Processing** tab: "You can publish when the file is ready." | "Processing your voice note. You can leave this page." | nothing | none | wait (system) |
| Waiting for review | Row in **Waiting for review**, oldest first, with age ("2 days"); Today count | "Waits for review. We send you a mail when it is published." | nothing | M6 to operators | **Publish** / **Return to the member** (operator) |
| Returned | Row in **Returned** with reason and age; "(automatic)" for a system return | Banner "Returned" with the reason; **Change the story** | nothing (or the published version, rule 2) | M2 | **Send for review** (member) |
| Published | Row in **Published**; **Open on the site** | "Published"; **Listen on the site** | the story | M3 (rule M3 below) | none |
| Published · change waiting | Row in **Waiting for review** marked "Change to a published story" | "Published. Your change waits for review." | the published version | M6 | as Waiting for review |
| Removed | gone from lists | gone from **Your stories** | gone (≤ 60 s) | M5 | none |

### 2.3 Mails

Mail rules: plain text plus a simple HTML copy. One link per mail. No operator name in a member mail: the voice is "the River Voices team" (it protects operators; the admin keeps `rejection.operator`). Mails go after the commit, never inside a hook transaction. A failed send logs and does not undo the action. Sender address: `EMAIL_FROM` (exists). Sender name: the project name for member mails, "Annoudio" for operator mails.

| ID | To | Sent when | Not sent when | Subject | Body (essentials) | Link |
|---|---|---|---|---|---|---|
| M1 | member | a login code is asked (exists) | never skipped | Your login code for River Voices | Code; "It works for 10 minutes." "Your account works on all sites of this organisation." | none |
| M2 | member | Returned (operator or system) | never skipped (it asks for an action) | Your story needs a change | Recording title, time range `1:02–1:35`, the reason, "Visitors do not see the story until it is published." | **Change your story** → `/annotate?project&recording&story=<id>&return=<toldOn>` |
| M3 | member | Published by an operator, or by the system after processing | the save published it at once (`publish-at-once`, no media wait): the member saw it; `mailNotices` off | Your story is published | Title, range, "Visitors see it in the player now." | **Listen on the site** → `toldOn` + `#annoudio-t=<start>&annoudio-project&annoudio-recording&annoudio-story=<id>`; no `toldOn` → **Your stories** |
| M4 | parent's member | a reply to their story is published | the replier is the parent's member; `mailNotices` off | Someone replied to your story | Replier's name, first 200 characters of the reply | **Read the reply** → as M3, at the parent story |
| M5 | member (and each reply's member) | Remove | never skipped | Your story is removed | Title, range, the reason if given; for a reply: "The story that you replied to is removed." | **Your stories** |
| M6 | operators | digest: once a day at 08:00 stack time, only when ≥ 1 story or reply waits; or at each H4 | `publish-at-once` (nothing waits); operator `reviewMail` = never | 2 stories and 1 reply wait for review | Count per project; the oldest age | **Review the stories** → `/admin/collections/stories` (Waiting tab) |
| M7 | operator | password reset (Payload `forgotPassword`) | — | Reset your Annoudio password | Link, expiry | the reset link |

Opt-outs: the member's **Your account** has one checkbox, "Mail me when my story is published or gets a reply" (`mailNotices`, default on; M3, M4). The operator's **Your account** has "Review mail: once a day (default) / for each story / never" (`reviewMail`). The choice is per person, not per project: the person who gets the mail owns the choice.

## 3 Object model as each role sees it

| Object | Operator | Member | Visitor |
|---|---|---|---|
| Project | "One for each site". Settings → Projects; Overview tab with counts | Project name above the recording title; theme; rights line in the footer | Theme and rights line only; never the word |
| Recording | Title, audio address, length, snippet, story count | Title and audio at the top of the form | The audio in the player |
| Instance | Never a word. A filter: "Ferry crossing, 1962 in River Voices" | Never | One player |
| Story | Queue row and review screen with the lifecycle badge | A card in **Your stories** with the same badge | A story in the list and a region |
| Reply | A story marked "Reply to: …"; the parent shows above it | A card "Reply to the story by Asha" | The thread under the open story |
| Concept / Vocabulary | **Concept** in a tree with story counts | **Topic** chips | **Topic** labels (`tag` part) |
| Body | Text, voice note, photo, video in the review panel | Text field, record button, attach button | `story-text`, `story-media` |
| Snippet | Step 3; the recording page | never | never |
| Member | Name, email, stories by state, **Block** | "Signed in as Asha"; **Your account** | The name in `story-meta` |
| Media body | Reached from its story only (not in the sidebar) | Part of the story | Part of the story |

Nobody outside the admin sees Instance, Catalogue, IRI, Container, Body or Media body as words.

## 4 Navigation

### 4.1 Admin

```
┌ Annoudio ─────────────┬──────────────────────────────────────────────┐
│ ● Today               │                                              │
│   Review stories   3  │  (content)                                   │
│   Add a player        │                                              │
│   Concepts            │                                              │
│   Members             │                                              │
│ SETTINGS              │                                              │
│   Projects            │                                              │
│   Recordings          │                                              │
│   Operators           │                                              │
│   Your account        │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

Rules:
1. The badge on **Review stories** is the Waiting for review count (stories + replies). No other badge.
2. Job links come from `beforeNavLinks`. Stories, Media bodies, Concepts and Members have `group: false`. Projects, Recordings and Operators are in the group "Settings". The default Payload Nav stays.
3. Object pages (story, recording, concept, member, project) stay reachable by URL and by links. Breadcrumbs name the job: "Review stories / Story by Asha, 1:02–1:35".
4. Every job ends on a screen that says what happens next.

Today, empty stack and normal day:

```
┌ Today ─────────────────────────────────┐  ┌ Today ─────────────────────────────────────┐
│ Put your first player on a site        │  │ 2 stories and 1 reply wait for review.     │
│ [x] 1 Make a project for your site     │  │ The oldest came in 2 days ago.             │
│ [ ] 2 Add a recording                  │  │                       [ Start reviewing ]  │
│ [ ] 3 Put the snippet on a site        │  │ 1 story is processing.                     │
│       [ I pasted it ]                  │  │ 2 stories are returned. Members must       │
│ [ ] 4 Publish the first story          │  │   change them. 1 is automatic (file).      │
│ Optional: add concepts, so members     │  │ Other jobs: [ Add a player ] [ Concepts ]  │
│ can choose topics.                     │  │ Last 7 days: 12 in, 9 published,           │
│              [ Add a recording ] ←next │  │   2 returned, 1 removed.                   │
└────────────────────────────────────────┘  └────────────────────────────────────────────┘
```

Checklist rules: a step ticks from data. 1: a project exists. 2: a recording exists. 3: the operator selects **I pasted it**, or a story arrives with a `toldOn` on a site of the project. 4: a story is published. The checklist goes when all four tick, or with **Hide the list**. Empty queue text: "No stories wait for review. The last story came in 3 days ago."

Review screen (Waiting for review) and the Publish dialog:

```
┌ Review stories / Story by Asha · Ferry crossing, 1962 ─── [Waiting for review · 2 days] ┐
│ River Voices                                                                            │
│ ▶ 1:02–1:35  ───■──────────                                                             │
│ "My father worked the ferry. The horn meant…"                                           │
│ Topics: Ferry, Horn        Voice note ▶ 0:41 (ready)                                    │
│ Told on: rivervoices.example.org/ferry   [ Open on the site ]                           │
│ No topic fits? [ Add a concept to River Voices ]                                        │
│ [ Publish ]  [ Return to the member ]  [ Next story ]                    ⋮  Remove      │
│ Tabs: Story · History                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
   ┌ Publish this story? ────────────────────────────────┐
   │ Visitors see it like this, within one minute:       │
   │ ┌ Asha · 1:02–1:35 ───────────────────────────────┐ │
   │ │ My father worked the ferry…   [Ferry] [Horn]    │ │
   │ └─────────────────────────────────────────────────┘ │
   │ We mail Asha that it is published.                  │
   │ [ Publish the story ]  [ Cancel ]                   │
   └─────────────────────────────────────────────────────┘
```

After **Publish the story**: toast "Published. Visitors see it within one minute." and the next waiting story opens; at the end, the empty Waiting tab. In Processing, **Publish** is off with "The voice note is still processing." For a reply, the parent story shows above, read-only.

Put a recording on a site (`/admin/add-player`):

```
┌ Put a recording on a site ── 1 Recording ─ 2 Site ─ 3 Snippet ─────────┐
│ 1 Recording                                                           │
│ ( ) Choose a recording  [ search the recordings… ]                    │
│ (•) New recording   Title [Ferry crossing, 1962      ]                │
│                     Audio address [https://archive.example/f.mp3]     │
│                     ✓ The audio plays in this browser. Length: 30:34. │
│                                                       [ Next ]        │
├───────────────────────────────────────────────────────────────────────┤
│ 2 Site                                                                │
│ Which site shows the player?                                          │
│ (•) River Voices  rivervoices.example.org                             │
│ ( ) Kochi Voices  kochivoices.example.org                             │
│ ( ) New project: Name [        ]  Website address [https://     ]     │
│                                                       [ Next ]        │
├───────────────────────────────────────────────────────────────────────┤
│ 3 Snippet                                                             │
│ <script async src="https://stories.org.example/embed/v1.js"></script> │
│ <annoudio-player project="river-voices" recording="1"                 │
│   src="https://archive.example/f.mp3"></annoudio-player>              │
│ [ Copy the snippet ]   ✓ Copied.                                      │
│ Paste these two lines into the page. A page needs the first line      │
│ one time only. Members come back only to rivervoices.example.org.     │
│ WordPress or Omeka S: type the recording number 1 in the block.       │
│ ┌ preview: the real player with the River Voices theme ──────────────┐│
│ └────────────────────────────────────────────────────────────────────┘│
│                                                       [ Done ]        │
└───────────────────────────────────────────────────────────────────────┘
```

How the project is chosen: step 2 lists the projects. With one project, it is selected and step 2 shows one line, "Site: River Voices. [Change]". With no project, step 2 shows the inline form (name, website address); the other project settings get defaults. The snippet holds the three values: `project` (step 2 slug), `recording` (step 1 id), `src` (step 1 audio address). **Done** goes to Today. The wizard and the recording page call the same `catalogue` functions; the Recordings list has no create button of its own: its button is **Add a player**.

The recording JSON route `GET /embed/v1/recordings/{project}/{id}.json` → `{ id, title, url, duration }` (CORS `*`, anonymous, 404 for an unknown project or recording). Callers: the WordPress block and the Omeka S module (the editor check fills `src` from the number; Phase 7a request 1), and step 3's line "type the recording number 1", which is true only because of this route. Step 3 itself reads `catalogue.recording(id)` in process, the same function that the route serves.

### 4.2 Annotate page (member, phone)

No sidebar. Top bar: project name (small), recording title, "Asha ▾" (menu: **Your stories**, **Your account**, **Sign out**). One way back on every screen: **Back to the site** (the checked `return`), else **Your stories**. Footer: the rights line, for example "Stories here are shared under CC BY 4.0." with the rights link. The page sets the project's theme tokens on its root.

Your stories (phone, 360 px):

```
┌ Your stories ─────────────── Asha ▾ ┐
│ Returned to you (1)                 │
│ ┌ Ferry crossing, 1962 · 1:02–1:35 ┐│
│ │ River Voices         [Returned]  ││
│ │ "Please remove the full name…"   ││
│ │ [ Change the story ]             ││
│ └──────────────────────────────────┘│
│ Processing (0)                      │
│ Waiting for review (1)          ▸   │
│ Published (4)                   ▸   │
│ Replies (2)                     ▸   │
│ ─────────────────────────────────── │
│ Empty: You have no stories yet. On  │
│ a site, select "Tell a story".      │
└─────────────────────────────────────┘
```

Groups in this order: Returned to you, Processing, Waiting for review, Published (with "change waiting" on its card), Replies. Each card names its recording, project and range. Your stories has no single project, so it uses the default theme.

Your account (minimum): Email (read-only), Name (**Save**), checkbox "Mail me when my story is published or gets a reply", **Sign out**. Delete: open question 1.

### 4.3 Player (visitor)

No navigation. Exits: **Tell a story** (the Annotate link) and **Reply** (per open story). The project frame: theme tokens (exists) and the rights line once, below the story list, in a new part `rights`. The player does not show the project name: the host page already names the site.

Empty state:

```
┌ ▶ 0:00 / 30:34  ───────────────────────────── ┐
│ No stories yet. Tell the first one.          │  ← message
│ [ Tell a story ]                             │  ← annotate-link
│ Stories here are shared under CC BY 4.0.     │  ← rights (new part)
└──────────────────────────────────────────────┘
```

### 4.4 Links between surfaces

| From | Words | To |
|---|---|---|
| Step 3, recording page | **Copy the snippet** | host site (by paste) |
| Review screen | **Open on the site** | `toldOn` + `#annoudio-t=<start>&annoudio-project&annoudio-recording&annoudio-story=<id>` |
| Player | **Tell a story** / **Reply** | `/annotate?project&recording&t&return` (+ `replyTo`) |
| Annotate page | **Back to the site** | `return` + fragment with `annoudio-saved=draft` or `published` |
| M2 | **Change your story** | `/annotate?project&recording&story=<id>&return=<toldOn>` |
| M3, M4 | **Listen on the site** / **Read the reply** | as **Open on the site**; no `toldOn` → `/annotate/mine` |
| M5 | **Your stories** | `/annotate/mine` |
| M6 | **Review the stories** | the Waiting tab |

## 5 Screen inventory

Marks: NEW, CHANGED, UNCHANGED against the Phase 5b code.

### 5.1 Admin

| ID | Screen | States | Primary action, button words | Mark |
|---|---|---|---|---|
| O0 | Create the first operator | form; field errors | **Create the first operator** | CHANGED (words) |
| O1 | Sign in | form; wrong email or password; locked | **Sign in**, **Forgot your password?** | CHANGED (logo, words) |
| O2 | Forgot / set password | request; sent; new password; link expired | **Send the link**, **Set the password** | CHANGED (mail works) |
| O3 | Today | setup checklist; work waits; nothing waits; a count failed ("We could not count the stories. Reload the page.") | **Start reviewing**, or the next checklist step | CHANGED (replaces Dashboard) |
| O4 | Review stories (list) | tabs Waiting for review · Processing · Returned · Published · All, each with a count and its own empty text; search on excerpt and name | **Start reviewing** (opens the oldest) | CHANGED (Processing tab, empty texts, search) |
| O5 | Review one story | one view per lifecycle state; reply variant (parent above); publish error | **Publish**, **Return to the member**, **Next story**, ⋮ **Remove**; **Open on the site**; **Add a concept to River Voices** | CHANGED (no Unpublish, no Keep as draft) |
| O5a | Publish dialog | preview; publishing; error | **Publish the story**, **Cancel** | NEW |
| O5b | Return dialog | reason empty ("Write the reason. The member sees it."); filled; for a Published story: "Visitors stop seeing this story." | **Return the story**, **Cancel** | CHANGED (text) |
| O5c | Remove dialog | optional reason; with replies: "Its 2 replies are removed too." | **Remove the story**, **Cancel** | NEW |
| O6 | History (story tab) | lines "Published by Ravi, 9 Oct 14:02", "Changed by Asha (member)", "Returned by Ravi: reason", "Returned automatically: file failed"; one line | none | NEW |
| O7 | Put a recording on a site, steps 1–3 | step 1: choose / new, checking, plays, cannot play (save allowed), not https; step 2: one project, many, none (inline form), website address missing; step 3: copied, copy refused (select-all fallback) | **Next**, **Copy the snippet**, **Done** | NEW |
| O8 | Recordings (Settings) | empty "No recordings yet."; list: Title, Length, Stories `3 (2)` | **Add a player** | CHANGED (button, no create view) |
| O9 | Recording page | edit; snippet panel per project; "Stories on this recording" link | **Save**, **Copy the snippet** | UNCHANGED |
| O10 | Concepts (tree page) | empty "No concepts yet. Members see no topics."; project picker when > 1 project; tree with counts; "Members see concepts as topics." | **Add a concept**, **Download as SKOS**, **Upload SKOS file** | NEW (reuses `VocabularyPanel`, `SkosTools`) |
| O11 | Concept form | new; in use "12 stories use this concept"; hidden | **Save**, **Hide from new stories** | UNCHANGED |
| O12 | SKOS import preview | parsed; refused file | **Import these changes** | UNCHANGED |
| O13 | Members list | empty "No members yet. Members sign up on the Annotate page."; list | row | CHANGED (empty text) |
| O14 | Member page | active; blocked ("This member cannot sign in. Their published stories stay."); stories by state | **Block this member**, **Unblock** | CHANGED (stories by state) |
| O15 | Projects list | empty "No projects yet. A project is one site: its topics, look and review rule."; list | **New project** | CHANGED (empty text) |
| O16 | Project page | tabs **Overview** (new, first) · existing tabs; Overview: stories and replies by state, recordings with stories here, concept count, members with stories here, links "Review this project's stories" (a `where` link) | **Save** | CHANGED (Overview tab) |
| O17 | Operators list and form | list; one operator ("You are the only operator. Add a colleague."); mail not set up line | **Add an operator** | CHANGED (words) |
| O18 | Your account (operator) | password; Review mail choice | **Save** | CHANGED (`reviewMail`) |

### 5.2 Annotate page

| ID | Screen | States | Primary action | Mark |
|---|---|---|---|---|
| P0 | Not found | unknown recording; unknown parent story | **Back to the site** (when `return` is valid) | UNCHANGED |
| P1 | Sign in: email | default; invalid; rate limited; send failed. The moment shows above: "You tell a story about 1:02." | **Send the code** | CHANGED (frame) |
| P2 | Sign in: code | waiting; wrong (tries left); expired; too many | **Sign in**, **Send a new code**, **Use a different email** | CHANGED (frame) |
| P3 | Choose your name | first sign-in only; empty; too long; has @ | **Continue** | UNCHANGED |
| P4 | Tell a story | empty; filled; field errors; saving. Start and End shown `1:02`, typed m:ss or seconds; **Use the player time** | **Send for review** (`review`) / **Publish the story** (`publish-at-once`) | CHANGED (words, frame) |
| P4r | Reply | parent shown; text; media | **Send for review** / **Publish the reply** | CHANGED (words) |
| P4m | Voice note, photo or video | idle; recording; listen; uploading %; processing; ready; failed; no microphone | **Record a voice note**, **Attach this voice note** | CHANGED (words) |
| P5 | Sent (no valid `return`) | Processing; Waiting for review; Published | **Your stories** | CHANGED |
| P6 | Your story (`story=<id>`) | Processing; Waiting; Returned (reason banner); Published; change waiting | **Change the story** | CHANGED |
| P7 | Your stories | empty; groups (4.2) | **Change the story** on a returned card | NEW |
| P8 | Your account | saved; name error | **Save**, **Sign out** | NEW |
| P9 | Session ended | after 30 days or sign-out elsewhere: "Sign in again. Your text stays on this page." | **Send the code** | CHANGED (text kept in `sessionStorage`) |

### 5.3 Player

| ID | State | Shows | Primary | Mark |
|---|---|---|---|---|
| V0 | Before the loader | fallback child content | — | UNCHANGED |
| V1 | Loading | controls, no stories | **Play** | UNCHANGED |
| V2 | Ready, no stories | `message` "No stories yet. Tell the first one."; `rights` | **Tell a story** | CHANGED (text, link word) |
| V3 | Ready, stories | regions, stories, tags, `rights` | **Play** | CHANGED (`rights`) |
| V4 | Story open | `story active`, thread | **Reply** | UNCHANGED |
| V5 | Back from the Annotate page | "Your story is sent. It shows here after review." / "Your story is published. It can take one minute to show." (`annoudio-saved=published`) | **Play** | CHANGED |
| V6 | Opened from a mail or the admin | `annoudio-story=<id>` opens that story (as `annoudio-reply`), no note | **Play** | NEW |
| V7 | Errors | the six codes of CONTRACT §9 | as §9 | UNCHANGED |
| V8 | `annotate="none"` | V1–V6 without links | **Play** | UNCHANGED |

Mail screens M1–M7: section 2.3 (M1 CHANGED: project name in the subject; M2–M7 NEW).

## 6 Flows

**F1 First operator on an empty stack.** 1. `/admin` → O0 → **Create the first operator**. 2. O3 shows the checklist. 3. **Make a project** → O15 → name, website address, rights line → **Save**; step 1 ticks. 4. **Add a recording** → O7 → F2.

**F2 Recording to live player.** 1. O7 step 1: **New recording**, title, audio address; the probe says "The audio plays in this browser. Length: 30:34." **Next**. 2. Step 2: River Voices is selected (one project). **Next**. 3. Step 3: **Copy the snippet** → "Copied." The operator pastes it on the host page (H1). On WordPress or Omeka S, the editor types the number 1; the block reads the recording route. 4. **Done** → O3; the operator selects **I pasted it**; step 3 ticks. 5. A visitor opens the page: V2.

**F3 Story to visible.** 1. Visitor plays to 1:02 → **Tell a story** (H3) → P1. 2. P1 → M1 → P2 → P3 (first time) → P4 with Start 1:02. 3. Member sets End, writes, picks topics, records a voice note (P4m). 4. **Send for review** → host page, V5 "Your story is sent…" (or P5). The story stores `toldOn`. 5. Worker ends (H5): Processing → Waiting for review. M6 goes the next morning. 6. Operator: O3 **Start reviewing** → O5 → **Publish** → O5a → **Publish the story**; the next story opens. 7. M3 to the member (H7); the visitor sees the story in ≤ 60 s (H8). With `publish-at-once`: step 4 shows "published", steps 5–6 do not occur, M3 goes only if the media made the publish wait.

**F4 Returned and sent again.** 1. O5 **Return to the member** → O5b reason → **Return the story**. The next story opens; the row moves to Returned. 2. M2 (H6) → **Change your story** → P6 with the reason banner (P1–P2 first if signed out). 3. Member changes it → **Send for review**. The rejection clears. 4. O5 shows "Sent again after a return"; History keeps the reason. **Publish** → F3 step 7. Variant: a change to a Published story; the published version stays visible during the whole flow. Variant: a failed file gives the same flow with "Returned (automatic)" and no operator step 1.

**F5 Concept added and used.** 1. O5: no topic fits → **Add a concept to River Voices** → O11 with the project set → label "Strike", parent "River" → **Save**. 2. Members see "Strike" in P4 at the next page load. Operators do not change stories: the operator can return the story with "Add the topic Strike". 3. After the next publish, the player shows the `tag` "Strike". 4. A later rename runs `conceptChanged`; O11 says "12 stories use this concept".

**F6 Reply.** 1. Visitor opens a story (V4) → **Reply** → Annotate page with `replyTo`. 2. Sign in as F3 → P4r → **Send for review**. 3. O4 row "Reply to: My father worked…"; O5 shows the parent above. **Publish**. 4. M3 to the replier, M4 to the parent's member (H9). Visitors see the thread under the parent.

**F7 Take down.** 1. A complaint names a story. O4 **All** tab, search → O5 (Published). 2. Content can come back after a change → **Return to the member** (it leaves the player; M2). Content must go → ⋮ **Remove** → O5c → **Remove the story** (its replies go too; M5 to each member). 3. The player drops it within 60 s.

## 7 Naming

| UI word | Where | Forbidden | Reason |
|---|---|---|---|
| Story | all | comment, note, annotation (UI), post, submission | CONTEXT term |
| Reply | all | comment, response | CONTEXT term |
| Topic | Annotate page, player, member mails | tag, category | CONTEXT: public word for Concept |
| Concept | admin only; O10 says "Members see concepts as topics." | term, tag | CONTEXT: operator word; SKOS |
| Tell a story | player link, P4 title | Add a story (today), Annotate, Contribute | the member's own words for the job; no time in the link (the page says the time) |
| Send for review | P4, P4r with `review` | Save the story (today), Submit | names what happens next |
| Publish / Publish the story | O5, O5a; P4 with `publish-at-once` | Approve, Publish changes, Go live | one verb on both sides |
| Return to the member / Returned / Returned to you | O5, badges, P6, P7, M2 | Reject, Rejected, Decline | says what happens; matches the badge |
| Remove / Removed | O5c, M5 | Delete (UI), Take down, Unpublish | one exit word; Unpublish is gone |
| Next story | O5 | Keep as draft | the button saves nothing; it moves on |
| Processing · Waiting for review · Published · change waiting | all | Pending, Draft (outside History), Waits for review (today), In moderation | one lifecycle (2.1) |
| Time range `1:02–1:35` | all; en dash, m:ss, h:mm:ss over one hour | `42 s to 51 s`, `t=62,95`, "Start (seconds)" | one format, human time |
| Today · Review stories · Add a player · Concepts · Members | sidebar (≤ 3 words) | Put a recording on a site, Tidy the vocabulary, Look after members (A's long verbs) | short and translatable; the page title keeps the full job name |
| Put a recording on a site | O7 title only | Embed wizard | names the whole job once |
| Website address · Audio address · Length | admin | origin, URL, duration | Phase 5 words |
| Rights line | admin field; the text itself on public surfaces | licence field | CONTEXT term |
| Snippet | admin | embed code | CONTEXT term |
| Login code | P1, P2, M1 | OTP, magic link | CONTEXT term |
| Your stories · Your account | member, operator account | My contributions, Dashboard, Profile | one possessive pattern |
| Member · Operator · Name | all | user, admin, staff, annotator, nickname (UI) | CONTEXT terms |

## 8 Data model and interface changes

| Change | Module | Kind | Migration |
|---|---|---|---|
| `stories.toldOn` (text, operator-only; the checked `return` of the last save that had one; never in WADM) | `stories` | field + `saveDraft` input | yes |
| `stories.changedBy` (text: operator email or "member") and `stories.lastAction` (select: saved, published, returned, returned-automatically) on each version | `stories` | fields, set in `beforeChange` | yes (main and versions tables) |
| `stories.rejection.automatic` (checkbox) | `stories` | field | yes |
| `members.mailNotices` (checkbox, default true) | `membership` | field | yes |
| `users.reviewMail` (select: daily, each, never; default daily) | operators (`Users.ts`) | field | yes |
| `stories.lifecycle(row)`, `nextWaiting(afterId)`, `ownStories(member)`, `remove(operator, id, reason?)`; `counts` gains `processing` and a stories/replies split | `stories` | interface | no |
| `stories.unpublish` | `stories` | delete when no caller is left (`reject` covers it) | no |
| `media.settled` consumer: system return on failure; publish for `publish-at-once` | `media` → `stories` | behaviour | no |
| `Mailer.send(kind, to, data)` with M2–M5 templates; send after commit | `membership` | interface | no |
| Payload email adapter (`@payloadcms/email-nodemailer` on `SMTP_URL`, `EMAIL_FROM`) for M6, M7 | config | dependency | no |
| Daily `digest.due` job: the worker schedules it, the app consumes it and sends M6 | `worker`, app | job | no |
| Theme JSON adds `name`, `rightsLine`, `rightsIri` (CONTRACT §3.2 rule 6: the stack can add keys) | `projects` | route, additive | no |
| `GET /embed/v1/recordings/{project}/{id}.json` → `{ id, title, url, duration }`, CORS `*`, cache as the theme route | `catalogue` | new public route | no |
| `catalogue.register({ title, url, length })`, `projects.create({ name, origin })` for O7 | `catalogue`, `projects` | interface | no |
| CONTRACT §7.2: `annoudio-saved=published`; key `annoudio-story=<id>` (opens the story, no note) | `player` | additive | no |
| CONTRACT §3.3: part `rights` (the project rights line, below `stories`) | `player` | additive | no |
| Player texts: link "Tell a story"; empty "No stories yet. Tell the first one."; V5 notes | `player` | text (CONTRACT §9 rule 2: not contract) | no |
| Annotate routes `/annotate/mine`, `/annotate/account` | `annotate-page` | new routes | no |

No `projects.recordings` link: the instance stays derived (CONTEXT). The Overview tab lists recordings with stories in the project only.

## 9 Feasibility per screen

Payload default = no code beyond labels. Customised = Payload slots and API. Custom page = an admin view (`admin.components.views[key]` with `DefaultTemplate`, own operator check). Outside = Next routes or `embed/`.

| Screen | Path | How | Flag |
|---|---|---|---|
| O0, O1 | customised | i18n, `graphics.Logo`, `beforeLogin` | O0 has no component slot |
| O2, M7 | customised | `auth.forgotPassword.generateEmail*` + email adapter | needs `SMTP_URL` |
| O3 Today | customised | `views.dashboard` replacement (not experimental widgets) | reads module interfaces only |
| Sidebar | customised | `beforeNavLinks`, `group: false`, group "Settings" | cache counts 30 s |
| O4 | customised | `baseFilter`, tab links (exist), `beforeListTable` empty texts, `listSearchableFields` | Payload's global "No Results" text: hide it; test it |
| O5, O5a–c | customised | `ui` panel (exists), `Status`, `edit.PublishButton` (dialog + next story), `SaveDraftButton` → Next story, `editMenuItems` (Remove), `UnpublishButton` off | verify that the custom PublishButton keeps Payload's error toast |
| O6 | customised | `views.edit.versions` replacement, `tab: { label: 'History' }` | needs `changedBy`, `lastAction` |
| O7 | custom page | `/admin/add-player`; Server Actions over `catalogue`, `projects`; reuses `DurationField`, `SnippetCopy`, `ThemePreview` | — |
| O8, O9, O11–O15, O17, O18 | default / customised | exist; labels and `beforeListTable` | O8 hides Create New |
| O10 | custom page | `/admin/concepts/:project?` reusing `VocabularyPanel`, `SkosTools` | — |
| O16 Overview | customised | `views.edit.overview` document tab | — |
| P0–P9 | outside | `(frontend)/annotate`; P7, P8 new routes | P9 `sessionStorage` with try/catch |
| V0–V8 | outside | `embed/` | contract additions in section 8 |
| M1–M6 | outside | `membership` Mailer (members), Payload adapter (operators) | deliverability (SPF, DKIM) is the organisation's setup; the deploy guide says so |
| Recording route | outside | Next route beside the theme route | — |

## 10 Build order (Phase 5c step 2)

Each slice ≤ 5 files. Each slice keeps `test:int`, `test:e2e`, `tsc`, `lint` green.

| # | Slice | Files (about) | Done when |
|---|---|---|---|
| 1 | Lifecycle | `stories/lifecycle.ts`, `types.ts`, `review.ts` (counts), `index.ts`, int spec | An int test derives all 7 states and the reply variant at the `stories` interface; `counts` splits stories and replies and has `processing`. |
| 2 | Schema | `stories/collection.ts`, `membership/collections.ts`, `Users.ts`, migration, int spec | Migration up and down pass on an empty database with rows; `toldOn` is saved from a valid `return` and never appears in WADM. |
| 3 | Story actions | `stories/review.ts` (`remove`, `nextWaiting`, `ownStories`), `media/settled.ts`, `types.ts`, int spec | A failed file gives Returned (automatic); `publish-at-once` with media publishes when ready; `remove` deletes the replies; `unpublish` has no caller and is gone. |
| 4 | Mail backbone | `payload.config.ts` (adapter), `membership/mailer.ts`, `membership/mails.ts` (M1–M5 text), stories after-commit sender, int spec | Memory mailer gets M2 after a return and M3 after a publish; a rolled-back transaction sends nothing; `mailNotices` off stops M3, M4. |
| 5 | Digest | worker schedule, app consumer, `mails.ts` (M6), int spec | A fake clock at 08:00 with 3 waiting sends one M6 per operator with `daily`; 0 waiting sends none; `each` sends at H4. |
| 6 | Sidebar and Today | `admin/Today.tsx`, `admin/NavLinks.tsx`, `payload.config.ts`, collection `group` changes, e2e | Empty stack shows the 4-step checklist; each step ticks from data; the badge equals the Waiting count. |
| 7 | Review screen | `admin/stories/PublishButton.tsx`, `NextStory.tsx` (replaces `KeepAsDraft`), `RemoveItem.tsx`, `Status.tsx`, `review.e2e` | Publish shows the preview, then the next story opens; no Unpublish anywhere; Remove removes; Processing tab and empty texts show. |
| 8 | History | `admin/stories/History.tsx`, collection view config, e2e | History reads "Published by …", "Returned automatically …" in browser time. |
| 9 | Put a recording on a site | `admin/addPlayer/View.tsx`, `actions.ts`, `catalogue/index.ts`, `projects/index.ts`, e2e | An e2e test goes Today → 3 steps → copied snippet with the right `project`, `recording`, `src`; the inline project form works with 0 projects. |
| 10 | Concepts page and project Overview | `admin/vocabulary/ConceptsView.tsx`, `admin/projects/Overview.tsx`, config, e2e | Sidebar **Concepts** opens the tree (picker with 2 projects); Overview counts match `stories.counts`. |
| 11 | Public routes and contract | theme route, `projects/theme.ts`, recording route, `CONTRACT.md`, int spec | Theme JSON has `name`, `rightsLine`, `rightsIri`; recording JSON gives 200/404 with CORS `*`; CONTRACT lists every addition with the date. |
| 12 | Player | `embed/src/text.ts`, `player.ts`, `stories.ts`, contract spec, fixture (new, not changed) | Empty text, "Tell a story", `rights` part, `annoudio-saved=published` note and `annoudio-story` pass in 3 browsers. |
| 13 | Annotate page frame and words | `annotate/page.tsx`, `strings.ts`, `annotate.css`, `StoryForm.tsx`, `ReplyForm.tsx` | Project name, theme and rights line show; buttons say Send for review / Publish the story; ranges show `1:02–1:35`; text survives a session end. |
| 14 | Your stories and Your account | `annotate/mine/page.tsx`, `annotate/account/page.tsx`, `actions.ts`, `strings.ts`, e2e | Groups show in order; the name change and the mail choice save; **Sign out** ends the session. |
| 15 | Walkthrough | `tests/e2e/lifecycle.e2e.spec.ts`, screenshot script | ROADMAP 5c done-when: F1–F7 pass with axe on every screen; screenshots of every state in `design/phase5c-screens/`. |

## 11 Open questions

1. **Can a member delete their own account?** Default: not in 5c. **Your account** says "To delete your account and your stories, write to {EMAIL_FROM}." An operator then removes the stories and blocks the member. A real delete (with what happens to published stories and replies) goes to Phase 7.
2. **Does Remove also remove the replies under the story?** Default: yes. A reply is served only under a published parent (5b decision 7), so a kept reply is invisible data. Each reply's member gets M5.
3. **Should the stack tick "Put the snippet on a site" by itself?** Default: no new write. The step ticks by **I pasted it** or by the first story with a `toldOn` on that site. A "player seen" record per site origin needs a write on the cached read path, which today writes nothing (proposal C §8.3).
