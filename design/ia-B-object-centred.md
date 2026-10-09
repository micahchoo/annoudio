# IA proposal B: object-centred, the project contains everything

Status: proposal, 2026-10-09. Input to `design/ia.md` (ROADMAP Phase 5c, step 1). Read `CONTEXT.md` first. This file uses its words.

Sources: `phase0-operator-walkthrough.md` (38 items), `phase3-notes.md`, `phase3b-notes.md`, `phase4b-notes.md`, `phase5-notes.md`, `CONTRACT.md` §3.3, §7, §9, `research/architecture-concerns.md` §7, the demo stack (`deploy/DEMO.md`, looked at with Playwright on 2026-10-09), and the Payload 3.90.2 type files in `app/node_modules`.

## 0 The principle in one paragraph

An operator always works inside one **project**. The project holds its recordings, stories, vocabulary, members' activity, theme, review rule, rights statement and snippets. The stack level holds three things only: the list of projects, the operators, and the stack settings. The member and the visitor never see the stack: they see one project, with its name, its theme and its rights statement.

Today the admin is collection-centred (sidebar: Review, Catalogue, Projects, People). A story list mixes all projects, and the project is a column. This proposal moves the project from a column to the frame.

## 1 People and jobs

Frequency order. The trigger is the event that starts the job.

### Operator

| # | Job | Trigger | How often |
|---|---|---|---|
| O1 | Review stories: publish, return to the member, or keep as draft | Stack home or project home shows "N stories wait for review" | Daily |
| O2 | Read a published story again; unpublish it or take down a photo | A complaint from a member, a visitor or the host site | Weekly |
| O3 | Add a recording to a project and copy its snippet | The archive team publishes a new web page | Weekly |
| O4 | Add or rename a concept | A story needs a topic that the vocabulary does not have | Monthly |
| O5 | See which members are active in a project; block a member | Many stories from one member, or abuse | Monthly |
| O6 | Change the theme or the rights statement | The host site changes its design or licence | Rarely |
| O7 | Make a new project | A new site or a new collection | Rarely |
| O8 | Add an operator; reset an own password | A new team member; a forgotten password | Rarely |
| O9 | Import or export the vocabulary as SKOS | A partner sends a thesaurus; a backup | Rarely |
| O10 | First set-up of an empty stack | The stack is deployed (Phase 6 guide, last step) | Once |

### Member

| # | Job | Trigger |
|---|---|---|
| M1 | Tell a story at a time on a recording | The member hears a moment on the host site and selects "Tell a story" in the player |
| M2 | Sign in with a login code | First visit, or the 30-day session ended |
| M3 | Add a voice note, photo or video to a story | During M1 |
| M4 | Change a returned story and save it again | The Annotate page (or a mail, §7 flag F7) says "Returned to you" |
| M5 | Reply to a story | The member reads a story in the player and selects "Reply" (Phase 5b) |
| M6 | See the state of own stories on this recording | Return to the Annotate page |

### Visitor

| # | Job | Trigger |
|---|---|---|
| V1 | Listen to the recording and read the stories at their times | Opens the host page |
| V2 | Jump to a story's time range | Selects a story or a region on the timeline |
| V3 | Read a reply thread | Opens a story that has replies |
| V4 | Become a member | Selects "Tell a story" (becomes M1) |

## 2 The object model as each person sees it

This is the model on the screen, not the database. Indentation means "contains".

### Operator

```
Stack  (the organisation's copy; the operator says "Annoudio" or the organisation name)
├── Projects
│   └── Project "River Voices"
│       ├── Recordings          (each one is a catalogue recording that this project uses)
│       │   └── Recording "Ferry crossing, 1962"
│       │       ├── Snippet     (for this project only)
│       │       ├── Stories     (of this recording in this project)
│       │       └── Used in     (the other projects that use the same recording)
│       ├── Stories             (review queue: Waits for review, Returned, Published, All)
│       │   └── Story           (text, voice note / photo / video, topics, time range, member)
│       │       └── Replies     (Phase 5b)
│       ├── Vocabulary          (concept tree)
│       ├── Members             (people who told stories in this project)
│       ├── Theme
│       └── Settings            (name, short name, websites, review rule, rights statement)
├── Operators
└── Stack settings              (organisation name and logo, mail status)
```

**Decision: recordings are listed inside the project, and the recording page says where else it is used.** The data model keeps one organisation-wide catalogue. The screen shows the catalogue only through two doors: the "From the catalogue" picker when the operator adds a recording to a project, and the "Used in" line on the recording page.

Why this choice, and not "a recording at stack level, used in projects":

1. The operator's jobs O1 and O3 start from a site, and a site is a project. The operator asks "what is on the River Voices site?", not "where is recording 1 used?".
2. The snippet needs a project and a recording. Inside a project, the snippet is complete at once. Phase 5 needs a project dropdown on the snippet panel because the recording is outside the project.
3. Most recordings are used in one project. The "Used in" line covers the rare shared case without a third top-level object.
4. The rival design (a stack-level catalogue) is better for one job only: "do we already have this audio?". The picker answers it, because it searches the whole catalogue, including recordings that no project uses.

Cost: "this project uses this recording" must be stored (`projects.recordings`, §7 flag F1). An instance is still derived; the list is only the operator's choice of which recordings the project shows in the admin.

**Operator never sees:** instance, body, target, container, WADM, IRI, the recording database number as a field (it is inside the snippet), media bodies as a list (Phase 5 has "Media bodies" in the sidebar; here they are parts of a story), login codes, sessions, story representations.

### Member

```
Project "River Voices"  (name, theme, rights statement, "Back to <website>")
└── Recording "Ferry crossing, 1962"
    ├── My stories on this recording  (Waits for review / Returned to you / Published)
    └── New story or reply  (time range, text, topics, voice note / photo / video)
Me  (nickname, email; one account for all projects of the organisation)
```

**Member never sees:** the catalogue, other projects (except by visiting their sites), other members' drafts, the vocabulary tree (the member sees a flat topic list, grouped by parent), operators' names, review rules.

One object crosses projects for a member: the account. The login code mail says so (§4, screen A2).

### Visitor

```
Player on the host page
└── Recording → Stories (published only) → Replies
```

**Visitor never sees:** drafts, review states, members' emails, the vocabulary, the project as a word. The visitor sees the project only as the theme and the rights statement.

## 3 Navigation

### 3.1 Levels

```
Level 0  Stack      /admin                  Stack home: the project list
Level 1  Project    /admin/p/{short name}   Project home
Level 2  Project section tabs: Home · Stories · Recordings · Vocabulary · Members · Theme · Settings
Level 3  One object: a story, a recording, a concept, a member
```

The sidebar changes with the level. At level 0 it shows: **Projects**, **Operators**, **Stack settings**. At levels 1 to 3 it shows the project switcher at the top, then the seven project sections, then a quiet link **All projects** at the bottom.

```
┌───────────────────────┬──────────────────────────────────────────────────┐
│ ▾ River Voices        │ River Voices / Stories                           │
│   switch project      │                                                  │
│                       │ Stories                                          │
│   Home                │ [Waits for review 3] [Returned 1] [Published] [All]│
│ ▸ Stories         3   │ ┌──────────────────────────────────────────────┐ │
│   Recordings          │ │ "The horn blew twice…"  Asha  Ferry 1962 1:02│ │
│   Vocabulary          │ │ "My father sold…"       Ravi  Ferry 1962 4:10│ │
│   Members             │ └──────────────────────────────────────────────┘ │
│   Theme               │                                                  │
│   Settings            │                                                  │
│ ───────────           │                                                  │
│   All projects        │                                                  │
└───────────────────────┴──────────────────────────────────────────────────┘
```

Breadcrumbs always start with the project: `River Voices / Stories / "The horn blew twice…"`.

### 3.2 The one home screen per role

| Role | Home | Why |
|---|---|---|
| Operator | **Stack home** at `/admin` when the stack has 0 or 2+ projects. With exactly 1 project, `/admin` opens that **project home**. | One project is the common case; the operator then never sees level 0. |
| Member | The **Annotate page** of the instance the member came from. No member home exists. | The member always arrives from a player. |
| Visitor | The **host page**. Annoudio has no visitor home. | The player lives on the organisation's site. |

### 3.3 Where each job starts and ends

| Job | Starts | Ends |
|---|---|---|
| O1 Review | Stack home row "3 wait" or project home card | Story review → Publish → the next waiting story opens (or the empty queue) |
| O2 Take down | Project → Stories → Published, search | Story review → Unpublish, or "Take down this photo" |
| O3 Recording | Project → Recordings → **Add a recording** | Recording page: **Copy the snippet**, then **Open the preview** |
| O4 Concept | Project → Vocabulary → **Add a concept** | The tree shows the new concept with "0 stories" |
| O5 Members | Project → Members | Member page → **Block this member** (all projects) |
| O6 Theme | Project → Theme | **Save** → the preview shows the saved theme |
| O7 Project | Stack home → **New project** | New project home with the set-up checklist |
| O8 Operator | Stack level → Operators → **Add an operator** | Operator list |
| O10 First set-up | `/admin/create-first-user` | Stack home, empty state, **Make the first project** |
| M1 Story | Player → **Tell a story** | Host page at the same second, with the player note |
| M4 Returned | Annotate page "Returned to you" → **Change** | Host page, note "saved; waits for review" |
| V1 Listen | Host page | Host page |

### 3.4 Handoffs between surfaces

Each arrow is a handoff. The project must stay visible across every arrow: the same name, theme and rights statement.

| # | From → to | What carries the project | What the person sees |
|---|---|---|---|
| H1 | Recording page (admin) → host site | The snippet: `project="river-voices" recording="1"` | Operator pastes two lines into the CMS |
| H2 | Host site → player | The loader reads `GET /embed/v1/themes/river-voices.json` | Player in the project theme; rights statement under each story |
| H3 | Player → Annotate page | Link `{origin}/annotate?project&recording&t&return` (CONTRACT §7.1) | Header: project name, recording title, "Back to example.org" |
| H4 | Annotate page → mail → Annotate page | Login code mail. Subject: "Your login code for River Voices" | Code, and "Your account works on all sites of {organisation}" |
| H5 | Annotate page → host page | Redirect to `return` + `#annoudio-t…&annoudio-saved=draft` (CONTRACT §7.2) | Player at the second, note "Your story is saved. It shows here after review." |
| H6 | Story saved → operator | Project home and stack home counts; no operator mail in v1 | "3 stories wait for review" |
| H7 | Review → player | Publish rebuilds the container | Visitor sees the story at its time |
| H8 | Review → member (returned) | Returned reason on the story; mail (flag F7) with link `/annotate?…&story=<id>` | "Returned to you: <reason>" |
| H9 | Player → Annotate page (reply) | Link with `&replyTo=<story id>` (Phase 5b) | Header names the story that the member answers |
| H10 | Reply → review → player | Reply waits in the same project queue, marked "Reply to <excerpt>" | Thread under the parent story |

## 4 Screen inventory

State words: **empty** (no data), **loading**, **error**, **success** (after an action), **waiting** (draft waits for review), **returned**, **processing** (a media body is not ready). A dash means the state does not apply.

### 4.1 Stack level (operator)

| ID | Screen | States | Primary action (button words) |
|---|---|---|---|
| S1 | Sign in | error: "Wrong email or password."; loading on submit; success → home. Shows organisation logo and name. | **Sign in** |
| S2 | First operator (empty stack) | Shows only when no operator exists. error per field. | **Make my account** |
| S3 | Stack home: project list | empty: "No projects yet. A project is one website with its own topics, look and review rule." + one button; one project → redirect to P1; many: a row per project with "N wait for review", "N returned", recordings, last story. error: count failed → row says "Counts not available". | **Make the first project** / **New project** |
| S4 | New project | error per field (short name in use, website not https). success → P1 with checklist. Fields: Name, Short name (made from the name, editable until the first snippet), Website address. Other settings get defaults. | **Make the project** |
| S5 | Operators list | one operator only: "You are the only operator. Add a colleague so that review continues when you are away." | **Add an operator** |
| S6 | Operator form | error; success: "Asha can sign in now." Mail status line: if no mail is set up, "Password reset mail does not work. Give Asha the password yourself." | **Add the operator** / **Save** |
| S7 | Stack settings | Organisation name, logo, mail status (read-only: "Mail works" / "Mail is not set up: login codes go to the server log"), **Send a test mail**. error: test mail failed with the reason. | **Save** |
| S8 | My account | Password change; success: "Your password is changed." | **Change the password** |

### 4.2 Project level (operator)

| ID | Screen | States | Primary action |
|---|---|---|---|
| P1 | Project home | **set-up** (new project): checklist "1 Add the website ✓ 2 Add a recording 3 Paste the snippet 4 Check the preview 5 First story"; each open item is a link. **normal**: cards "N stories wait for review" (link), "N returned to members", "N published this month", "Newest stories" (5). **quiet**: "No stories wait. The last story came 12 days ago." loading: card skeletons. error per card. | The first open checklist item, else **Review the stories** |
| P2 | Stories (queue) | Tabs **Waits for review** (oldest first), **Returned**, **Published**, **All**. empty per tab: "No stories wait for review." / "No returned stories." / "Nothing is published yet. Visitors see stories after you publish them." loading; error: "The list could not load. Reload the page." Rows: excerpt, member, recording, time range, media icons, "Reply to…" mark, age. | Select a row |
| P3 | Story review | **waiting**: badge Draft + "Visitors do not see this story." **processing**: "The voice note is still processing. You can publish when it is ready." Publish disabled with that reason. **failed media**: "The photo cannot play. Return the story to the member." **returned**: badge Returned + reason + date. **published**: badge Published + "Visitors see this story." **published with a newer draft**: both versions, side by side text. **success** after Publish: toast "Published. Visitors see it now." and the next waiting story opens; at the end, "No more stories wait." error: "Publish failed: <reason>." Panel: text, range player, topics, media players, member, rights statement, a visitor preview of the story card. | **Publish**; also **Return to the member** (reason required), **Keep as draft**, **Unpublish**, **Take down this photo** (media only, with confirm) |
| P4 | Recordings (in project) | empty: "This project has no recordings. Add one to get a snippet." Rows: title, length, stories `3 (2)`, used in other projects. | **Add a recording** |
| P5 | Add a recording | Two choices: **New recording** (form: Title, Audio address; probe states: checking / "Plays in this browser. Length 30:34" / "This browser cannot play it. Check the address." — save is allowed) and **From the catalogue** (search; empty: "No recordings in the catalogue match."; rows show "used in Kochi Voices"). | **Add the recording** |
| P6 | Recording page | Snippet for this project, **Copy the snippet** → success "Copied." (error: "Copy failed. Select the text and copy it."); **Open the preview** (V2); Stories of this recording here; "Also used in: Kochi Voices" with a warning on edit "A change to the title or address shows in 2 projects." **Remove from this project**: refused while stories exist ("12 stories use this recording here"). | **Copy the snippet** |
| P7 | Vocabulary | empty: "No concepts yet. Members choose concepts as topics for their stories." Tree with story counts; hidden concepts greyed with "Hidden from new stories". | **Add a concept**; also **Download as SKOS**, **Upload SKOS file** |
| P8 | Concept | Label, Parent (this project only). success → back to the tree, the row flashes. error: cycle, label in use. In use: "12 stories use this concept." Delete refused → **Hide from new stories**. | **Add the concept** / **Save** |
| P9 | SKOS import preview | loading (parse); error: "This file is not Turtle or JSON-LD." / "Too large: 1 MB at most."; preview: added / changed / unchanged / left out. success: "12 concepts added, 3 changed." | **Import these changes** |
| P10 | Members (in project) | empty: "No member has told a story here yet." Rows: nickname, stories here (published, waiting, returned), last story, blocked mark. | Select a row |
| P11 | Member page | Stories in this project; email (operator only); "Also tells stories in: Kochi Voices". Blocked state: "Asha cannot sign in. Her published stories stay." | **Block this member** (says "in all projects"; confirm) / **Unblock** |
| P12 | Theme | Live preview with the real player; fields with defaults in grey; error per field ("Not a colour"); success: "Saved. Host sites show it within 5 minutes." | **Save** |
| P13 | Settings | Tabs: Project (name, short name read-only after the first snippet, websites, language), Review and rights (review rule, rights statement). success; error. Warning on "Publish each story at once": "Visitors see each story without review." | **Save** |

### 4.3 Member surfaces

All member screens show the project frame: project name, recording title, project theme tokens, rights statement in the footer, **Back to example.org** (from `return`; absent without a valid `return`).

| ID | Screen | States | Primary action |
|---|---|---|---|
| A1 | Annotate: sign in | signed out; error: "Type an email address."; rate-limited: "Too many codes. Wait one hour."; send failed: "We could not send the mail. Try again later." | **Send the code** |
| A2 | Login code mail | Subject "Your login code for River Voices". Body: code, 10 minutes, "Your account works on all sites of {organisation}." | — |
| A3 | Annotate: code | waiting for the code ("We sent a code to a…@example.org"); error: wrong code (tries left), expired, too many tries; **Send a new code** | **Sign in** |
| A4 | Annotate: name (first time) | error: empty, too long, has @ | **Continue** |
| A5 | Annotate: story form | **new** (range from `t`); **reply** (header "Reply to Asha: 'The horn blew…'", no range); **change own**. Media sub-states: recording, uploading %, **processing** ("Processing. You can save the story now."), ready, failed. error per field (`strings.ts` saveErrors). Save waits while an upload runs: "Wait for the upload to finish." | **Save the story** |
| A6 | Annotate: my stories on this recording | empty: "You have no stories on this recording yet."; **waiting**: "Waits for review"; **returned**: "Returned to you: <reason>. Change the story, then save it again."; published; "Published. Your change waits for review." | **Change** |
| A7 | Saved, no `return` | "Your story is saved. It shows in the player after review." / "…saved and published…" | **Listen to the recording** |
| A8 | Not found | "We cannot find this recording." No project frame (the project is unknown). | — |
| A9 | Returned mail (flag F7) | Subject "Your story on Ferry crossing, 1962 was returned". Reason, link to A5 change. | **Change your story** (link) |

### 4.4 Visitor and preview surfaces

| ID | Screen | States | Primary action |
|---|---|---|---|
| V1 | Player on the host page | loading (controls disabled, "Loading stories…"); ready with stories; **empty**: "No stories yet. Tell the first story."; back from Annotate: note "Your story is saved. It shows here after review."; errors per CONTRACT §9 codes (`not-found`, `stories-unavailable`, `audio-unavailable`, `bundle-unavailable`, attribute errors); thread open (Phase 5b). | **Tell a story** (today "Add a story": rename) |
| V2 | Preview page `/preview/{project}/{recording}` (operator only) | The player exactly as on a host site, with the snippet beside it. error: same codes as V1. | **Copy the snippet** |

## 5 Flows

Format: step → screen (state).

### F-A First operator on an empty stack

1. Opens `/admin` → S2 First operator (empty stack).
2. Types name, email, password → **Make my account** → S3 Stack home (empty).
3. **Make the first project** → S4 New project. Types "River Voices"; short name fills as `river-voices`; website `https://rivervoices.example.org`.
4. **Make the project** → P1 Project home (set-up). Item 1 is ticked.
5. Optional: S7 Stack settings from the bottom link "Set the organisation name". Mail status says if login codes can reach members. The checklist shows a warning line while mail is not set up.

The stack now has one project, so `/admin` opens P1 from here on.

### F-B Recording to live player

1. P1 (set-up) → item "Add a recording" → P5 Add a recording.
2. **New recording**: title "Ferry crossing, 1962", audio address → probe (checking → "Plays in this browser. Length 30:34").
3. **Add the recording** → P6 Recording page (success). The snippet holds `project="river-voices" recording="1" src="…"`.
4. **Copy the snippet** → "Copied." Checklist item 3 shows "Paste it into your site".
5. **Open the preview** → V2 (ready, empty: "No stories yet. Tell the first story."). Checklist item 4 ticks when the operator opens it.
6. Operator pastes the snippet into the CMS (outside Annoudio) → V1 on the host site (loading → ready, empty).

### F-C Story from the Annotate link to visible

1. Visitor on V1 (ready) plays to 1:02 → **Tell a story** → A1 (signed out), header "River Voices · Ferry crossing, 1962", "Back to rivervoices.example.org".
2. **Send the code** → A3 (waiting for the code). Mail A2 arrives.
3. Types the code → **Sign in** → A4 (first time) → **Continue** → A5 (new; start 62).
4. Writes text, picks topic "Horn", records a voice note → A5 (processing) → **Save the story**.
5. Redirect → V1 at 1:02 with the note "saved… after review".
6. Operator: S3 or P1 shows "1 story waits for review" → P2 (Waits for review) → P3 (waiting, processing until the worker finishes; then waiting).
7. **Publish** → P3 (success) → "No more stories wait."
8. Visitor reloads V1 → the story shows at 1:02 with the voice note and the rights statement.

With review rule "Publish each story at once", step 5 says "saved and published" and steps 6–7 do not occur (a story with a processing body still waits; phase5-notes decision 6).

### F-D Story returned and resubmitted

1. Operator on P3 (waiting) → **Return to the member** → dialog: reason (required), "Asha sees this reason on the Annotate page." → **Return the story**.
2. P3 (returned); P2 tab Returned counts 1; the next waiting story opens.
3. Member gets mail A9 (flag F7). Without F7: the member sees it only on the next visit to A6.
4. Member opens the link → A5 (change own) with A6 above: "Returned to you: <reason>".
5. Changes the text → **Save the story** → host page note, or A7. The story is waiting again; the reason is cleared (phase5-notes decision 5).
6. Operator: P2 Waits for review shows the story with the mark "Changed after return" → P3 → **Publish**.

### F-E Concept added and used

1. Operator on P3 reads a story about a fish auction; no topic fits → breadcrumb **River Voices** → P7 Vocabulary.
2. **Add a concept** → P8: label "Fish auction", parent "River" (the project is fixed, not a field) → **Add the concept**.
3. P7 (success): "Fish auction · 0 stories" under River.
4. A member opens A5 → the topic list shows "River › Fish auction" → picks it → saves.
5. Operator P3 (waiting) shows topic "Fish auction" → **Publish**.
6. P7 shows "Fish auction · 1 story"; V1 shows the tag on the story (part `tag`).

Note: the operator cannot add a topic to a member's story (stories are read-only to operators). The operator can return it with the reason "Add the topic Fish auction". This is a v1 limit, not an IA choice.

## 6 Naming

One term per idea. The operator column applies in the admin; the public column on the player, the Annotate page and mails.

| Idea | Operator UI | Public UI | Forbidden |
|---|---|---|---|
| Project | Project | (the project name only) | space, workspace, site, tenant, collection |
| Project slug | Short name | — | slug, key, ID |
| Site origin | Website address | the host name in "Back to …" | origin, domain, site URL |
| Recording | Recording | Recording (A8 only) | file, media, track, audio, item |
| Catalogue | Catalogue (picker only) | — | library, archive, media library |
| Story | Story | Story | comment, note, annotation, post, entry |
| Reply | Reply | Reply | comment, response |
| Body | Text / Voice note / Photo / Video | Text / Voice note / Photo / Video | body, attachment, payload, upload, file |
| Target | Time range (`1:02–1:35`) | Start, End | target, selection, fragment, region (region is a CSS part only) |
| Concept | Concept | **Topic** | tag, term, category, keyword, label |
| Vocabulary | Vocabulary | (no word: "topics") | ontology, taxonomy, thesaurus |
| Review state `draft` | Draft (badge); tab "Waits for review" | "Waits for review" | pending, unapproved, submitted, in moderation |
| Rejection | Returned (badge); button "Return to the member" | "Returned to you" | rejected, declined, denied |
| Review state `published` | Published | Published | approved, live, public |
| Review rule | Review rule: "An operator reads each story…" / "Publish each story at once" | — | moderation, workflow |
| Rights line | Rights statement | (the statement text) | rights line, licence line, copyright |
| Theme tokens | Theme | — | skin, branding, style, CSS |
| Snippet | Snippet; "Copy the snippet" | — | embed code, embed, widget code |
| Player | Player | (no word) | widget, embed |
| Annotate page | Annotate page | "Tell a story" (page title) | editor, form, contribute page |
| Player link | — | **Tell a story** | Add a story, Annotate, Contribute |
| Login code | — | Login code | magic link, OTP, PIN, password |
| Member | Member | (the nickname); "Name" field | user, annotator, contributor |
| Operator | Operator | — | user, admin, staff, moderator |
| Stack | Stack settings | — | container, server, instance |
| Instance | (never shown) | — | embed, page |

Rule: "Settings" alone means project settings. The stack-level item is always "Stack settings".

## 7 Feasibility in Payload 3.90.2

Verified in `app/node_modules/payload/dist` (types) and `@payloadcms/next`, `@payloadcms/ui` exports:

- `admin.components.Nav` replaces the sidebar; `beforeNavLinks`, `afterNavLinks`, `settingsMenu` add to it. `@payloadcms/ui` exports `NavGroup`, `useNav`, `SetStepNav`, `useStepNav`.
- `admin.components.views` adds root views at any `path-to-regexp` path (`/p/:project`), and replaces `dashboard` and `account`.
- Collection `admin.components.views.edit.<key>` adds document tabs with `path`, `tab.label`, `tab.order`, `tab.Pill` (a count), `tab.href`, `tab.condition`.
- Collection `admin.baseFilter({ req, … })` filters the list view (applied in `@payloadcms/next` list view only, not in Local API reads).
- `@payloadcms/next/views` exports `renderListView` and `ListView`: a custom view can render Payload's own list with a query.
- `enableQueryPresets` gives saved list views per operator. Not used here (phase5-notes decision 3).
- `graphics.Logo`, `graphics.Icon`, `beforeLogin`, `afterLogin` brand the sign-in screen.
- The multi-tenant plugin (`@payloadcms/plugin-multi-tenant`, docs 2026-10) adds a tenant selector and per-tenant list filters. **Not used**: it needs a `tenant` relationship on each collection and tenant arrays on operators; `stories.project` is a text slug, and recordings belong to many projects. Its pattern (a selected-project cookie and a base filter) is the model for flag F2.

| Screen | Build | API / note |
|---|---|---|
| S1 Sign in | Payload customised | `graphics.Logo`, `beforeLogin`, i18n for words |
| S2 First operator | Payload customised | i18n override of the create-first-user text |
| S3 Stack home | Custom page under /admin | `views.dashboard` replacement; one-project redirect |
| S4 New project | Payload customised | `projects` create view with fewer fields (`admin.condition` on create) |
| S5, S6 Operators | Payload default | `users` collection, labels done in Phase 5 |
| S7 Stack settings | Payload customised | New Global `stack-settings` + a UI field for mail status and test mail (F6) |
| S8 My account | Payload default | `account` view |
| Sidebar (both levels) | Payload customised | `admin.components.Nav` replacement (F3) |
| P1 Project home | Custom page under /admin | Root view `/p/:project` |
| P2 Stories | Payload customised | `stories` list + `baseFilter` from the selected project (F2); tabs exist (`ReviewTabs`) |
| P3 Story review | Payload customised | Exists (`StoryPanel`, `RejectButton`, `KeepAsDraft`); add `SetStepNav` for project breadcrumbs, "next waiting story", media take-down button |
| P4 Recordings | Custom page under /admin, or a document tab on `projects` | `renderListView` of `recordings` filtered by `projects.recordings` (F1) |
| P5 Add a recording | Custom page under /admin | Picker over the catalogue + create; writes F1 link |
| P6 Recording page | Payload customised | `recordings` edit view; `SnippetPanel` takes the project from context, not a dropdown; join field "Used in" (F1) |
| P7 Vocabulary | Payload customised | Exists as a `projects` tab (`VocabularyPanel`) |
| P8 Concept | Payload customised | `concepts` form; project from the selected project as default and hidden (F4) |
| P9 SKOS import | Payload customised | Exists (`SkosTools`) |
| P10 Members | Custom page under /admin | Members with stories in this project: needs a member column on stories (F5) |
| P11 Member page | Payload customised | `members` edit view + a stories-in-project list |
| P12 Theme | Payload customised | Exists (`ThemePreview`) |
| P13 Settings | Payload customised | Exists (`projects` tabs) |
| A1–A8 Annotate page | Outside the admin | `app/src/app/(frontend)/annotate/`; add the project frame and theme (F8) |
| A2, A9 Mails | Outside the admin | `membership` Mailer port; A9 needs a new mail (F7) |
| V1 Player | Outside the admin | `embed/`; "Tell a story" and the empty text are not contract (CONTRACT §9 rule 2) |
| V2 Preview | Outside the admin (first-party page, operator session) | New route; reuses the snippet text |

### Flags: what the current code cannot do

- **F1 Project ↔ recording link does not exist.** Today any snippet with any pair works, and nothing records which recordings a project uses. Add `projects.recordings` (relationship, `hasMany`) and a `join` field "Used in" on `recordings`; migration; amend CONTEXT.md "Instance" ("derived; the project's recording list is a display choice"). Verify that a `join` field works over a `hasMany` relationship in 3.90. Rival: derive the list from stories; it fails for a new recording with no stories (flow F-B).
- **F2 Per-project scoping of lists is not built in.** Payload lists are per collection. Plan: a cookie `annoudio-project` set by P1, read by `baseFilter` on `stories` (text `project` = slug) and `concepts` (relationship id): two filter forms. Hazards: two browser tabs on two projects share one cookie; a pasted list URL shows the other project. Mitigation: project links always also carry `where[project][equals]=<slug>` (Payload keeps `where` while it pages, phase5-notes decision 3), and the custom Nav shows the active project in large type.
- **F3 The custom Nav is ours to keep.** Replacing `Nav` means we own its keyboard order, collapse, mobile drawer and screen-reader names. Payload upgrades can change the nav wrapper (`NavWrapper`, `DefaultNav`). Keep it small; reuse `NavGroup`.
- **F4 Prefill of the project on a create form.** Verify that a field `defaultValue` function gets `req` in 3.90 (to read the cookie). Else pass `?project=` and read it in a custom field component.
- **F5 Members per project.** `members` has no project; stories hold the member in WADM `creator` and a stored `nickname`. Verify a stored member id column on `stories`; if absent, add it in the same hook as `project` and `recording` (migration). Blocking stays stack-wide: the button says so.
- **F6 Stack settings Global and organisation name.** New Global and migration. Mail status reads env (`SMTP_URL`), so it is read-only. Payload operator mail still has no email adapter (phase3-notes gaps).
- **F7 Member mail on return.** `membership` sends login codes only. A9 needs a second mail type through the same Mailer port, and a link with `story=<id>`. Phase 5c lists "all mail copy"; this adds one mail.
- **F8 The Annotate page in the project theme.** Today only the embedded player uses the tokens. The page must read `projects.theme(slug)` and set the same `--annoudio-*` properties on its own root, plus the rights statement and "Back to …". No contract change.
- **F9 "Next waiting story" after Publish.** Payload's publish stays on the document. A custom `PublishButton` (`components.edit.PublishButton`) can redirect after success. Verify that it keeps Payload's error toast.

## 8 Trade-offs of this principle

### Strong

1. **Every screen answers "for which site?"** The breadcrumb and the switcher say it. The Phase 5 list needs a Project column to say it.
2. **The snippet is complete in context.** No project dropdown on the recording page; the snippet is right the first time.
3. **Set-up is one guided place.** The project home checklist covers walkthrough item 3 (a start page with the next action) and the Phase 5c onboarding deliverable.
4. **The public surfaces match the admin.** The project that the operator configures is the same frame that the member sees on the Annotate page and the visitor sees in the player. Theme, rights statement and review rule are visibly one object.
5. **Concepts never cross projects by accident.** The concept form has no project field, so no concept lands in the wrong vocabulary.
6. **It scales to the parked "cross-project sharing" (ROADMAP after-completion 1)**: "Used in" already shows a recording in many projects.

### Weak

1. **One review queue across projects does not exist.** An operator who reviews for four projects visits four queues. Mitigation: the stack home shows "N wait" per project, sorted by the oldest waiting story. If review is one person's daily job across many projects, the task-centred proposal (A) is better for O1. Count the projects of the pilot organisation before the choice.
2. **For one project, the frame is overhead.** The switcher and "All projects" do nothing. Mitigation: with one project, hide the switcher and open P1 at `/admin`.
3. **Organisation-wide objects feel misplaced.** Members, recordings and operators are stack-wide in data. Blocking a member "inside" a project blocks them everywhere; editing a shared recording changes two projects. The screen must warn each time (P6, P11), and warnings that repeat get ignored.
4. **The most custom code of the three principles.** A custom Nav, a cookie filter, a project home, a recordings view, a picker and a new link field. Each Payload upgrade must be checked against F2, F3 and F9.
5. **Search across projects is lost.** "Find Asha's story, I do not know the project" needs **All projects** → member page (P11 lists projects). That is two steps more than a global story list.
6. **Hidden state.** The selected project is a cookie (F2). An operator who works in two tabs can review in the wrong project. The large project name in the Nav is the only guard.
