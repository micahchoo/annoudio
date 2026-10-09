# IA proposal C: journey-centred

Status: proposal for ROADMAP Phase 5c step 1, 2026-10-09. Read `CONTEXT.md` first. This file uses its words. Siblings: `ia-A` (task-centred), `ia-B` (object-centred). The choice goes in `ia.md`.

**Principle.** Each screen exists because one person's journey arrives there, or because one person's action hands the story to a different person. One story has one lifecycle. The six state names in section 2 are the same on every surface: the admin, the Annotate page, the player and the mail. The states between two actions (Processing, Waiting for review, Returned) get full screens, because a participatory tool spends most of its time in them.

**Evidence used.** The demo stack (`deploy/DEMO.md`) was read in Chromium on 2026-10-09: the admin home is "Start here" with counts above Payload's collection cards; the sidebar shows "Projects" twice (group and collection); the empty queue shows Payload's "No Results. Either none exist or none match the filters". Payload facts come from the 3.90.2 type files in `app/node_modules` (section 8).

---

## 1 People, jobs and handoffs

| Person | Job | Device | Home |
|---|---|---|---|
| **Operator** | Set up projects, recordings and the vocabulary. Give the snippet to the site. Review stories: publish, return, remove. | Laptop | Admin **Home** (`/admin`) |
| **Member** | Tell a story at a time on a recording. Fix a returned story. See it published. Reply. | Phone first | **Your stories** (`/annotate/mine`, new) |
| **Visitor** | Listen. Read stories. Become a member by "Tell a story" or "Reply". | Any | The host page with the **player** |

A **handoff** is the moment when one person's action is the next person's trigger. The journey has nine handoffs. Each one needs a signal that reaches the next person, also when that person is not on the screen.

| # | From → to | Action | Signal to the next person |
|---|---|---|---|
| H1 | Operator → host site | Copies the snippet | Clipboard. The operator pastes it. (Optional signal back: "Player seen on example.org", 8.3.) |
| H2 | Host site → visitor | Page loads | The player shows. |
| H3 | Visitor → member | Selects **Tell a story** or **Reply** | Annotate page opens at the second `t`. |
| H4 | Member → operator | Selects **Send for review** | Queue count on Home and sidebar. Mail M6 (digest). |
| H5 | Worker → story | Media processing ends | State changes; the Annotate page polls. |
| H6 | Operator → member | **Return to the member** | Mail M2. Banner on the Annotate page. |
| H7 | Operator → member | **Publish** | Mail M3. State on **Your stories**. |
| H8 | Operator → visitor | **Publish** | Story shows in the player within `STORIES_MAX_AGE` (60 s). |
| H9 | Member (reply) → parent member | Reply is published | Mail M4. |

Today H1–H3 and H8 work. H4 has no mail. H5 works only while the page is open. H6 has no mail (Phase 5 deviation 4). H7 and H9 do not exist.

---

## 2 The story lifecycle

### 2.1 States

The UI states derive from the stored review state (`draft` / `published`), the rejection and the media body state. No new stored state is necessary, except the system return in 2.3.

```
             member: Send for review
  (Writing) ─────────────────────────┐
                                     v
                  media not ready ┌────────────┐ file failed (system)
                ┌────────────────>│ Processing │──────────────────┐
                │                 └─────┬──────┘                  │
                │      media ready      │                         │
                │      (system)         v                         v
                │            ┌────────────────────┐ operator ┌──────────┐
                │            │ Waiting for review │─────────>│ Returned │
                │            └─────────┬──────────┘  Return  └────┬─────┘
                │      operator:       │                          │ member:
                │      Publish         v                          │ Send for review
                │              ┌─────────────┐                    │
                └──────────────│  Published  │<───────────────────┘
          member: change       └──┬───────┬──┘   (via Processing or Waiting)
          (Published stays        │       │
           visible; the change    │       │ operator: Return
           has its own state)     │       └────────────> Returned
                                  │ operator: Remove (from any state)
                                  v
                              (Removed)
```

| UI state | Stored as | Badge colour role |
|---|---|---|
| Writing | Not stored. Annotate page only. | none |
| **Processing** | `draft`, no rejection, a media body in `uploaded` | neutral |
| **Waiting for review** | `draft`, no rejection, all media `ready` | attention |
| **Returned** | `draft` with a rejection (operator or system) | warning |
| **Published** | `published`, no newer draft | success |
| **Published · change waiting** | `published` plus a newer draft. The change shows its own state: Processing, Waiting for review or Returned. | success + attention |
| Removed | No row. Mail and history only. | none |

Rules:
1. With the project review rule `publish-at-once`, Waiting for review is skipped: Processing → Published, and Writing → Published.
2. **Unpublish** is not an action. The way off the player is **Return to the member** (with a reason) or **Remove**. An unpublished story with no reason lands in the operator's own queue, and the member does not know why. Phase 5 decision 5 already makes a return of a published story a draft.
3. A member never sees "draft". An operator sees "Draft" only inside the history.

### 2.2 Who sees what

| State (entered by) | Operator sees | Member sees | Visitor sees | Mail | Next action (who) |
|---|---|---|---|---|---|
| Writing (member) | nothing | The form | nothing | none | **Send for review** (member) |
| Processing (member, or system after upload) | Row in **Processing** tab; "You can publish when it is ready." | "Processing your voice note. You can leave this page." | nothing | none | Wait (system) |
| Waiting for review (member, or system when media is ready) | Row in **Waiting for review**, oldest first, with its age ("2 days"). Home count. | "Waits for review. We send you a mail when it is published." | nothing. After the return: note in the player. | M6 to operators (digest) | **Publish** or **Return to the member** (operator) |
| Returned (operator, or system for a failed file) | Row in **Returned**; the reason; age | Banner "Returned" with the reason; **Change the story** | nothing (or the old published version) | M2 to member | **Send for review** again (member) |
| Published (operator, or system for `publish-at-once`) | Row in **Published**; **Open on the site** | "Published" with **Listen on the site** | The story in the player | M3 to member (not for `publish-at-once`: the member saw it) | none; a reply, a change, a return |
| Published · change waiting (member) | Row in **Waiting for review** with "Change to a published story" | "Published. Your change waits for review." | The published version | M6 (digest) | As Waiting for review |
| Removed (operator) | Gone from lists; history keeps one line in the member record | Gone from **Your stories** | Gone (≤ 60 s) | M5 to member | none |

### 2.3 System return for a failed file

Today a failed media body makes the story stuck: the member must notice "Cannot play", and the operator cannot publish it. In this proposal the `media.settled` consumer sets a rejection with the reason "We could not use your file. Attach a different file." So the story goes to **Returned**, and the next action is visibly the member's. The operator sees "Returned (automatic)".

---

## 3 The object model as each person sees it

| Object | Operator | Member | Visitor |
|---|---|---|---|
| Project | Settings, Vocabulary, Theme, Review and mail tabs. One per site. | The line "River Voices" under the recording title. | invisible |
| Recording | Title, audio address, length, snippet, story counts | The title and the audio at the top of the form | The audio in the player |
| Instance | A filter: "Ferry crossing, 1962 in River Voices" | invisible; implied by the link | One player |
| Story | A queue row and a review screen with a lifecycle badge | A card in **Your stories** with the same badge | A story in the list and a region on the timeline |
| Reply | A story with "Reply to: …" | A reply card under the parent | A thread under the open story |
| Concept / Vocabulary | **Concept** in a tree with story counts | **Topic** chips | **Topic** labels (`tag` part) |
| Body | Text, voice note, photo, video players in the review panel | Text field, record button, attach button | `story-text`, `story-media` |
| Review state | Lifecycle badge (2.1) | Lifecycle badge (2.1) | invisible: only Published exists |
| Snippet | Two lines and **Copy the snippet** on the recording | invisible | invisible |
| Member | Nickname, email, stories, **Block** | "Signed in as Asha" and **Your account** | The nickname in `story-meta` |
| Media body | Reached from its story only | Part of the story | Part of the story |

The member and the visitor never see Instance, Catalogue, IRI, Container or Media body as words.

---

## 4 Navigation

### 4.1 Admin (operator, laptop)

```
┌─ Annoudio · River Voices org ───────────────────────────────┐
│ Home                                                        │
│ REVIEW                                                      │
│   Waiting for review   3                                    │
│   Processing           1                                    │
│   Returned             2                                    │
│   Published                                                 │
│ SET UP                                                      │
│   Projects                                                  │
│   Recordings                                                │
│   Concepts                                                  │
│ PEOPLE                                                      │
│   Members                                                   │
│   Operators                                                 │
└─────────────────────────────────────────────────────────────┘
```

The REVIEW links are the queue tabs, with live counts. Media bodies leaves the sidebar. The group "Projects" becomes "Set up" (the demo shows "Projects" twice).

### 4.2 Annotate page (member, phone)

No sidebar. A top bar: recording title, "Signed in as Asha ▾" (menu: **Your stories**, **Your account**, **Sign out**). Every screen has one way back: **Back to the site** (the `return` URL), else **Your stories**.

### 4.3 Player (visitor)

No navigation. Two exits: **Tell a story** (the Annotate link) and **Reply** (per story, Phase 5b).

### 4.4 Links between surfaces

| From | Link words | To |
|---|---|---|
| Admin recording | **Copy the snippet** | host site (by paste) |
| Admin story | **Open on the site** | stored `return` URL + `#annoudio-t=…&annoudio-story=<id>` |
| Admin story | **Listen in the admin** | the panel player (exists) |
| Player | **Tell a story** | `/annotate?project&recording&t&return` |
| Player thread | **Reply** | `/annotate?…&replyTo=<id>` |
| Annotate page | **Back to the site** | `return` + `#annoudio-t&…&annoudio-saved=…` |
| M2 Returned | **Change your story** | `/annotate?project&recording&story=<id>&return=…` |
| M3 Published | **Listen on the site** | stored `return` + fragment; no `return` → **Your stories** |
| M4 Reply | **Read the reply** | as M3, at the parent story |
| M6 Digest | **Review the stories** | `/admin/collections/stories` (Waiting tab) |

---

## 5 Screen inventory

Each row gives the states and the primary action. Button words are final proposals.

### 5.1 Admin

| ID | Screen | States | Primary action |
|---|---|---|---|
| A0 | Sign in | default, wrong password, locked | **Sign in** |
| A1 | First operator | empty stack only | **Create the first operator** |
| A2 | Forgot / set password | request, sent, new password, expired link | **Send the link**, **Set the password** |
| A3 | Home | setup checklist (empty stack), daily, all done | first unfinished step, or **Review the stories** |
| A4 | Stories queue | tabs Waiting / Processing / Returned / Published / All; each with its own empty text | open the oldest row |
| A5 | Story review | one view per lifecycle state; reply variant shows the parent | **Publish** (confirm dialog), **Return to the member**, **Remove** |
| A5a | Publish dialog | preview as the visitor sees it | **Publish the story** / **Cancel** |
| A5b | Return dialog | reason empty, filled | **Return the story** / **Cancel** (exists) |
| A5c | Remove dialog | optional reason | **Remove the story** / **Cancel** |
| A6 | Story history (tab) | list of lines "Published by Ravi, 9 Oct 14:02" | none |
| A7 | Projects list | empty, list | **New project** |
| A8 | Project | tabs Settings, Vocabulary, Theme, Review and mail; unsaved | **Save** |
| A9 | Concept | new, in use ("12 stories use this"), hidden | **Save**, **Hide from new stories** |
| A10 | SKOS import preview | parsed, refused file | **Import these changes** |
| A11 | Recordings list | empty, list with **Stories** `3 (2)` | **New recording** |
| A12 | Recording | probing, plays, cannot play, no project, saved with snippet | **Save**, **Copy the snippet** |
| A13 | Member | active, blocked; their stories by state | **Block**, **Unblock** |
| A14 | Operators | list, invite sent | **Invite an operator** |

### 5.2 Annotate page (phone first)

| ID | Screen | States | Primary action |
|---|---|---|---|
| P0 | Unknown link | 404 | **Back to the site** (when `return` is valid) |
| P1 | Sign in: email | default, invalid, rate limited, send failed | **Send the code** |
| P2 | Sign in: code | default, wrong, expired, too many | **Sign in** |
| P3 | Choose your name | first sign-in only | **Continue** |
| P4 | Tell a story | empty, filled, error, saving; reply variant (no time range, parent shown) | **Send for review** (`review`) / **Publish the story** (`publish-at-once`) |
| P4m | Voice note, photo or video | idle, recording, listen, uploading %, processing, ready, failed, no microphone | **Record a voice note**, **Attach this voice note** |
| P5 | Sent | Processing, Waiting for review, Published (`publish-at-once`) | **Back to the site** |
| P6 | Your story | Waiting, Returned (reason banner), Published, change waiting | **Change the story** |
| P7 | Your stories (new) | empty, list grouped by state: "Returned to you" first | open a story |
| P8 | Your account (new) | name, mail choice | **Save**, **Sign out** |
| P9 | Session ended | after 30 days or sign-out elsewhere | **Sign in again** (keeps the typed text) |

### 5.3 Player (`CONTRACT.md` parts)

| ID | State | Shows | Primary action |
|---|---|---|---|
| V0 | Before the loader | fallback child content | — |
| V1 | Loading | controls, no stories yet | **Play** |
| V2 | Ready, no stories | `message`: "No stories yet. Tell the first one." | **Tell a story** |
| V3 | Ready, stories | `region`s, `stories`, `tag`s | **Play**, open a story |
| V4 | Story open | `story active`; thread (5b) | **Reply** |
| V5 | Back from the Annotate page | `message`: "Your story is sent. It shows here after review." / "Your story is published. It can take one minute to show." | **Play** |
| V6 | Errors | the six codes of CONTRACT §9 | as §9 |
| V7 | `annotate="none"` | V1–V4 without links | **Play** |

### 5.4 Mail (each mail is a screen)

| ID | To | When | Subject |
|---|---|---|---|
| M1 | member | code asked (exists) | Your login code for River Voices |
| M2 | member | Returned | Your story needs a change |
| M3 | member | Published | Your story is published |
| M4 | member | a reply to their story is published | Someone replied to your story |
| M5 | member | Removed | Your story is removed |
| M6 | operators | daily, when ≥1 story waits | 3 stories wait for review |
| M7 | operator | invited | Set your password for Annoudio |
| M8 | operator | password reset | Reset your Annoudio password |

Mail rules: plain text plus a simple HTML copy. One link per mail. The organisation name in the sender. M2, M5 always go. M3, M4 obey the member's choice on P8 (default: on). M6 obeys the project setting: each story / once a day (default) / never.

### 5.5 Wireframes

A3 Home, empty stack (checklist) and daily:

```
┌ Home ─────────────────────────────┐  ┌ Home ───────────────────────────────┐
│ Set up your first player          │  │ 3 stories wait for review.          │
│ [x] 1 Make a project              │  │   Oldest: 2 days. [Review the       │
│ [ ] 2 Add topics (concepts)       │  │   stories]                          │
│ [ ] 3 Add a recording             │  │ 1 story is processing.              │
│ [ ] 4 Copy the snippet            │  │ 2 stories are returned. Members     │
│ [ ] 5 Paste it on your site       │  │   must change them.                 │
│     Not seen on a site yet.       │  │ Players seen: example.org (today)   │
│ [Add a recording]  ← next step    │  │ Set up: 2 projects, 14 recordings   │
└───────────────────────────────────┘  └─────────────────────────────────────┘
```

A5 Story review with A5a:

```
┌ Story by Asha · Ferry crossing, 1962 ───── [Waiting for review · 2 days] ┐
│ ▶ 1:02–1:35  ───■──────────                                              │
│ "My father worked the ferry. The horn meant…"                            │
│ Topics: Ferry, Horn       Voice note ▶ 0:41 (Ready)                      │
│ Told on: example.org/ferry  [Open on the site]                           │
│ [Publish]  [Return to the member]                       ⋮ Remove         │
└──────────────────────────────────────────────────────────────────────────┘
  ┌ Publish this story? ──────────────────────────────┐
  │ Visitors see it like this, within one minute:     │
  │ ┌ Asha · 1:02–1:35 ─────────────────────────────┐ │
  │ │ My father worked the ferry…   [Ferry] [Horn]  │ │
  │ └───────────────────────────────────────────────┘ │
  │ We mail Asha that it is published.                │
  │ [Publish the story]  [Cancel]                     │
  └───────────────────────────────────────────────────┘
```

P6 Returned and P7 Your stories (phone, 360 px):

```
┌ Ferry crossing, 1962 ──── Asha ▾┐  ┌ Your stories ─────────── Asha ▾┐
│ ┌ Returned ───────────────────┐ │  │ Returned to you (1)            │
│ │ "Please remove the full name│ │  │ ┌ Ferry crossing · 1:02 ─────┐ │
│ │ of your neighbour." – Ravi  │ │  │ │ My father worked… [Returned]│ │
│ └─────────────────────────────┘ │  │ └────────────────────────────┘ │
│ Start 1:02   End 1:35           │  │ Waiting for review (1)         │
│ [Use the player time]           │  │ Published (4)                  │
│ Story  […text…]                 │  │                                │
│ Topics [Ferry] [Horn] [River]   │  │ You have no stories yet: on a  │
│ [Send for review]               │  │ site, select "Tell a story".   │
└─────────────────────────────────┘  └────────────────────────────────┘
```

M2 and M3:

```
From: River Voices <stories@org.example>     From: River Voices <stories@org.example>
Subject: Your story needs a change           Subject: Your story is published
Hello Asha,                                  Hello Asha,
Ravi read your story on "Ferry crossing,     Your story on "Ferry crossing, 1962"
1962" (1:02–1:35) and returned it:           (1:02–1:35) is published. Visitors
  "Please remove the full name of your       see it in the player now.
  neighbour."                                Listen on the site:
Change your story:                           https://example.org/ferry#annoudio-t=62…
https://stories.org.example/annotate?…       To stop these mails, open Your account.
Visitors do not see the story until it is
published.
```

---

## 6 Flows

**F1 First operator on an empty stack.**
1. Operator opens `/admin`. Payload sends them to A1. They create the first operator.
2. A3 shows the checklist. Step 1 is next: **Make a project**.
3. A8: name, slug (made from the name), website address, rights line. **Save**. A3 ticks step 1.
4. A8 Vocabulary tab: **Add a concept** ×N, or **Upload SKOS file** → A10 → **Import these changes**.
5. A8 Review and mail tab: review rule (default `review`), operator mail (default once a day).
6. A3 next step: **Add a recording** → F2.

**F2 Recording to live player.**
1. A11 **New recording**. A12: title, audio address. The probe says "The audio plays in this browser. Length: 30:34."
2. **Save**. The snippet panel shows the two lines. **Copy the snippet**.
3. The operator pastes it on the host page (H1). The host origin must be in the project's website addresses, else the Annotate page drops `return`. A12 says so under the snippet: "Your site must be in the project's website addresses: example.org ✓".
4. The visitor loads the page. The player shows V2 ("No stories yet. Tell the first one.").
5. Optional: A3 shows "Players seen: example.org" (8.3).

**F3 Story from the Annotate link to visible.**
1. Visitor plays to 1:02 and selects **Tell a story** (H3). P1 opens at `t=62`.
2. P1 → M1 → P2 → P3 (first time only). P4 opens with Start 1:02.
3. Member sets End, writes text, picks topics, records a voice note (P4m: recording → listen → **Attach this voice note** → uploading → processing).
4. **Send for review**. P5 says "Sent. Processing your voice note. You can leave this page." **Back to the site** → V5 note.
5. The worker finishes (H5): Processing → Waiting for review. M6 goes out the next morning (H4).
6. Operator: M6 → A4 Waiting tab → A5 → **Publish** → A5a → **Publish the story**.
7. M3 to member (H7). Visitor sees the story within 60 s (H8).

**F4 Story returned and sent again.**
1. A5 **Return to the member** → A5b reason → **Return the story**. A4 moves the row to Returned.
2. M2 to member (H6). **Change your story** opens P6 with the reason banner. If the session ended: P1–P2, then P6.
3. Member changes the text. **Send for review**. The rejection clears (Phase 5 decision 5). State: Waiting for review.
4. A5 shows "Sent again after a return" and the old reason in A6 history. Operator publishes → F3 step 7.
5. Variant, published story: the published version stays visible during the change (Published · change waiting).

**F5 Concept added and used.**
1. A member writes "the boatmen's strike" with no fitting topic. The operator sees it in A5.
2. A5 has **Add a topic to this project** (opens A9 with the project set). The operator adds "Strike" under "River".
3. A9 **Save**. P4 lists "Strike" on the next page load. The operator can tag no story; the member can add it with **Change the story**. (Operators do not change stories: CONTEXT.)
4. The player shows "Strike" as a `tag` after the next publish of a story with it.
5. Rename later: A9 label change; `conceptChanged` rebuilds every story that uses it. A9 shows "12 stories use this concept".

**F6 Reply (Phase 5b).**
1. Visitor opens a story (V4) and selects **Reply**. Annotate page opens with `replyTo`.
2. Sign in as F3. P4 reply variant: the parent story at the top, a text field, no time range. **Send for review**.
3. A4 row "Reply to: My father worked…". A5 shows the parent above the reply. **Publish**.
4. M3 to the replier; M4 to the parent's member (H9). Visitors see the thread under the parent.

---

## 7 Naming

| UI term | Use on | Forbidden synonyms |
|---|---|---|
| Story | all surfaces | comment, note, annotation (UI), post, submission |
| Reply | all | comment, response |
| Tell a story | player link, P4 title | Add a story (player today), Annotate, Contribute |
| Send for review | P4 button (`review` rule) | Save the story (today), Submit |
| Publish / Publish the story | A5, A5a; P4 (`publish-at-once`) | Approve, Publish changes, Go live |
| Return to the member / Returned | A5, badges, P6, M2 | Reject, Decline, Rejected |
| Remove / Removed | A5c, M5 | Delete (UI), Take down |
| Processing | all | Pending, Uploading (except during upload %) |
| Waiting for review | all | Pending, Draft (outside history), In moderation, Waits for review (today, P6) |
| Published · change waiting | all | Pending (today, `own.pending`) |
| Topic | member and visitor surfaces | Tag, Category |
| Concept | admin only; "Concepts (members see topics)" | Term, Tag, Category |
| Time range, `1:02–1:35` | all | `42 s to 51 s` (today, P6), "Start (seconds)" |
| Member / Operator / Visitor | all | User, Admin, Staff, Annotator, Reader |
| Recording | all | Track, File, Media |
| Snippet | admin | Embed code |
| Login code | P1, P2, M1 | OTP, Magic link, Password |
| Your stories | member | My contributions, Dashboard |

Open naming question for `ia.md`: CONTEXT.md gives "Concept"; the member surfaces already say "Topics". This proposal keeps both, one per surface, and adds "Topic" to CONTEXT.md as the public word for a concept. Alternative: "Topic" everywhere, "Concept" only in SKOS files.

---

## 8 Feasibility

Payload 3.90.2 slots checked in `payload/dist/config/types.d.ts` and `collections/config/types.d.ts`: `admin.components.views.dashboard` (replace Home) and `views[key]` with `path` (new routes under `/admin/:path`); `beforeNavLinks`, `afterNavLinks`, `Nav`; `beforeLogin`, `afterLogin`, `graphics.Logo/Icon`; collection `admin.group`, `hidden`, `baseFilter`, `defaultSort`, `enableQueryPresets`, `components.beforeListTable`, `views.list.Component`; edit `PublishButton`, `UnpublishButton`, `SaveButton`, `SaveDraftButton`, `Status`, `beforeDocumentControls`, `editMenuItems`; document views with `tab` (custom tabs and a replaced versions view); `auth.forgotPassword.generateEmailHTML/Subject`; config `email` adapter. `admin.dashboard` widgets exist but are marked experimental: do not use them. A custom root view must check the operator itself and wrap `DefaultTemplate` from `@payloadcms/next/templates` to keep the nav.

| Screen | Build path | Flag |
|---|---|---|
| A0 Sign in | Payload customised: `graphics.Logo`, `beforeLogin` (organisation name) | — |
| A1 First operator | Payload default; words by i18n | No component slot (only `routes.createFirstUser`). |
| A2, M8 Password | Payload customised: `auth.forgotPassword.generateEmail*` | **No email adapter in `app/`** (phase 6 notes). Add `@payloadcms/email-nodemailer` on `SMTP_URL`. |
| A3 Home | Payload customised: `views.dashboard` replace (today `beforeDashboard` sits above Payload's cards) | Checklist reads counts through module interfaces. |
| Sidebar counts | Payload customised: `beforeNavLinks` server component; `group: 'Set up'`; `hidden` for Media bodies | Count queries on every admin page: cache for 30 s. |
| A4 Queue | Payload customised: `baseFilter` + tab links (exist); new Processing tab; per-tab empty text in `beforeListTable` | Payload's "No Results" text is global i18n; hide it with the custom empty block. Fragile, test it. |
| A5 Review | Payload customised: `ui` fields (exist), `Status` (lifecycle badge), `PublishButton` (dialog A5a), `UnpublishButton: false` (a `false` component renders nothing), `editMenuItems` (Remove) | **Open on the site** needs the stored `return` (8.2). |
| A6 History | Payload customised: document view replacing `versions`, `tab: { label: 'History' }` | **Versions store no operator.** Add a `changedBy` field set in `beforeChange`, so each version holds it. |
| A7–A12 | Payload customised (exists, Phase 5) | A8 tab "Review and mail" needs a new field (`operatorMail`). |
| A13 Member | Payload customised; stories by state as a `ui` field | — |
| A14 Invite | Payload customised: create the operator with a random password, then `forgotPassword` with the M7 text | Payload has no invite flow. Needs the email adapter. |
| P0–P6 | Outside the admin: Next route `/annotate` (exists) | P5/P6 state text: new strings only. |
| P7 Your stories | Outside the admin: new route `/annotate/mine` | **No lookup of a member's stories across instances.** `stories` needs `ownStories(member)`. |
| P8 Your account | Outside the admin: new route `/annotate/account` | `members` needs a field `mail` (on/off) and a nickname change action. |
| P9 Session ended | Outside the admin | Typed text is lost today on reload. Keep it in `sessionStorage` (draft only, per story id). |
| V0–V7 | Outside the admin: `embed/` | V2 empty text and V5 "published" note: new text. `annoudio-saved=published` and `annoudio-story=<id>` are **additive contract changes** (CONTRACT §7.2, §12). |
| M1 | exists | — |
| M2–M5 | Outside the admin: `stories` hooks call the membership `Mailer` port | **No member mail path except login codes.** Add `Mailer.send(kind, to, data)`; send after the commit, not inside the hook transaction. |
| M6 Digest | Outside the admin: a pg-boss schedule in the worker | The app's pg-boss has `schedule: false`; the worker owns schedules. New job. |

### 8.1 What the current code cannot do

1. Mail to members other than M1, and any operator mail (no adapter).
2. Version author for A6.
3. A member's stories across recordings (P7).
4. `publish-at-once` with a media body: the story stays a draft after processing until the member saves again (Phase 5 decision 6). The `media.settled` consumer must publish it. The same consumer must set the system return (2.3).
5. A link back to the host page from the admin or a mail: the `return` URL is not stored.

### 8.2 Stored `return`

Store the checked `return` (after `returnTarget`) on the story as `toldOn`. It is operator-visible and never public. It feeds **Open on the site**, M3 and M4. A story told with no valid `return` gets the **Your stories** link.

### 8.3 Optional: "Player seen on a site"

The stories read route gets an `Origin` header on each cross-origin fetch. An upsert once per hour per (project, origin) gives A3 its step 5 tick and catches a snippet on a site that is not in the website addresses. Cost: one write on a hot, cached read path. Defer if the read path must stay write-free.

---

## 9 Trade-offs

**Gains.**
1. One state vocabulary on four surfaces. A member, an operator and a mail say "Returned" for the same row. The six names map to stored data with no new review state.
2. Every handoff has a signal. Today four of nine handoffs have none (H4, H6, H7, H9). A member who leaves the page learns the result.
3. The in-between states have owners: each state names whose move is next. A stuck story (failed file) becomes a visible "Returned".
4. Removing **Unpublish** removes a state where nobody acts.

**Costs.**
1. Mail is the backbone. It needs an email adapter, a send-after-commit path, a schedule, an opt-out, and deliverability (SPF, DKIM) that a non-technical organisation must set up. If mail fails, H6 and H7 fall back to **Your stories**, which a member must remember to open.
2. More member surface: two new routes (P7, P8) and new `stories` and `members` lookups. Task-centred IA can ship the admin first; this IA needs the Annotate side and the mail at the same time to deliver its value.
3. Object management is secondary. Projects, Recordings and Concepts sit under "Set up" and are reached by the checklist or the sidebar. An operator who curates the catalogue all day gets no richer object screens than Phase 5 gives.
4. The lifecycle is derived, not stored. Five derived states need one shared function (in `stories`) that the admin, the Annotate page and the mail all call. If two surfaces derive it differently, the main promise breaks. Test it at the `stories` interface.
5. Two contract additions (`annoudio-saved=published`, `annoudio-story`). They are additive, but every contract change costs a careful review.
6. "Topic" vs "Concept" stays split by surface, against the one-name principle, unless `ia.md` picks one word.
