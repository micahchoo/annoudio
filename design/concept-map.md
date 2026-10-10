# Concept map and screen help

Status: design, 2026-10-09. Design document only. A build agent applies section 5 mechanically. Read `CONTEXT.md` first.

The owner's requirement: "the help text on the Payload interface is not very helpful. For Stories, you have to start with the relation between Audio Annotation as a concept to what we are calling Stories, in a concise way. Same for all the other screens." And: "it's called a player in some places and a recording in others; just call it an annotation widget or something simple."

Sources: `CONTEXT.md`, `research/architecture-concerns.md` §1, `design/ia.md` (screens O0–O18, P0–P9, V0–V8, M1–M7), `design/workflow-audit.md` (items 8, 25, 29–36), `design/vocab-C-templates.md` §5–§8, and the strings in `app/src/admin/strings.ts`, `app/src/app/(frontend)/annotate/strings.ts`, `embed/src/text.ts`, `app/src/modules/mail/mails.ts` and the collection configs.

## 0 Word decisions

Each decision removes one fault of `workflow-audit.md`. Section 5 applies them.

| # | Decision | Removes |
|---|---|---|
| W1 | **Widget** is the only UI word for `<annoudio-player>`. "Player" never shows in UI text, in mails or in ARIA labels. The code keeps `player`. | audit 29, 31 |
| W2 | One job, one name: **Add a widget to a site**. The sidebar and the Recordings button show its first three words, **Add a widget** (ia.md §4.1: ≤ 3 words). "Put a recording on a site" and "Add a player" go. The object is the widget, so "Add" is now true when the recording exists. | audit 30 |
| W3 | **Topics** is the name of one list, never a general word. One entry of a list is an **item** ("Add an item", "12 stories use this item"). "Concept" stays in code, in the SKOS file and in the field "Address (IRI)". It is no longer an operator word. CONTEXT.md must change its Topic and Concept rows (section 6). | audit 32, 33 |
| W4 | **Sign in** and **Sign out**, never "Login", "Log in" or "Log out". **Login code** stays (CONTEXT term). | audit 8 |
| W5 | The rights line is one full sentence: "Stories on this page are shared under CC BY 4.0." The widget and the Annotate page show it with no prefix. "Stories here:" goes. | audit 35 |
| W6 | **Waiting for review** is the only word for that state, on all surfaces. "Waits for review" goes. | audit 20 |
| W7 | **Recording** means only the audio work in the catalogue. The member's microphone act makes a **voice note**. "Stop the recording", "Your recording", "Recording: 12 s" go. | one word, one meaning |
| W8 | **Address name** replaces "Short name" for the project slug. | audit 36 |
| W9 | Vocab-C words: a **question** (code: field, property) gets an **answer** (code: body). A **list** holds **items**. | vocab-C §1 |

## 1 Concept map

The W3C Web Annotation Data Model (WADM) says: "this body says something about this target". Annoudio uses the model as it is, and gives each part a plain name.

| In audio annotation (W3C) | In Annoudio | One-line definition for a person |
|---|---|---|
| Annotation (`type: Annotation`) | **Story** | A note that a member makes about one part of a recording. |
| Target `source` (the audio resource) | **Recording** | One audio work that your organisation keeps, with a title and an audio address. |
| Target `selector` (`FragmentSelector`, Media Fragments `t=62,95`) | **Time range** | The part of the recording that the story is about, for example 1:02–1:35. |
| Body: `TextualBody` | **The story's text** | What the member writes: what they remember or hear. |
| Body: `Sound`, `Image`, `Video` (external resource) | **Voice note, photo, video** | A file that the member adds to the text of the story. |
| Body: `TextualBody` with `rdf:predicate` (vocab-C) | **Answers** | The member's answers to your questions, for example "Place: North landing". |
| Motivation `commenting` | **Story** | The member says something about a time range. |
| Motivation `replying` (target = another annotation) | **Reply** | A note about a story, not about the recording. One level deep. |
| Purpose `tagging` (body points at a SKOS concept) | **An item from a list**, for example from **Topics** | A word from your list that says what the moment is about. |
| `creator` | **Member** | The person who told the story. Visitors see the member's name, never the email. |
| Container (Web Annotation Protocol, LDP) | **The stories of a recording in a project** (code: instance) | All the stories that one widget shows. |
| A client that shows annotations | **Widget** | The element on your site that plays the recording and shows its stories. |
| (none: Annoudio only) | **Snippet** | The two lines that you paste into a page to show a widget. |
| Target `scope` | **Project** | The settings for one site: the lists, the look, the review rule and the rights line. |
| `rights` | **Rights line** | The licence of the stories, shown under them in one sentence. |
| SKOS concept scheme | **List** (Topics, Places, Speakers) | A set of items that members can choose from. |
| SKOS concept | **Item** | One entry in a list, with a label and a fixed address. |
| Property (SHACL `sh:path`, `dcterms:spatial`) | **Question** | One fact that you ask members about each story, for example "Place". |
| Vocabulary (ontology, schema) | **Questions and lists** | All the questions and lists of one project. A file is optional, under Advanced. |
| (none: WADM has no state) | **Review state**: Processing, Waiting for review, Returned, Published | Where a story is on its way from the member to the visitors. |

### 1.1 The paragraph on Today

Heading "What Annoudio does". Today shows it open until the checklist is complete, then closed under the heading. 71 words:

> Annoudio is a tool for audio annotation. A member selects a part of a recording and tells a story about it. The story can have text, a voice note, a photo or a video. You read each story and publish it. Then visitors see it in the widget on your site, on the timeline of the recording. Annoudio keeps each story as a W3C Web Annotation, so other archive tools can read it.

## 2 Screen help

Each help line has two sentences. Sentence 1 relates the object of the screen to audio annotation. Sentence 2 says what to do here. "—" means that the screen has no such text. Words in **bold** are buttons. `{x}` is a value.

### 2.1 Admin

| ID | Heading | Help line | Empty state | Primary button |
|---|---|---|---|---|
| O0 | Create the first operator | An operator decides which stories about your recordings visitors see. Type your email and a password to make the first operator account. | — | **Create the first operator** |
| O1 | Sign in to Annoudio | Annoudio keeps the stories that members tell about your recordings. Sign in with the email and password of your operator account. | — | **Sign in**, link **Forgot your password?** |
| O2 | Reset your password | We send a link to the email of your operator account. Open the link to set a new password. | Sent: "We sent a link to {email}. It works for 1 hour." Expired: "This link does not work now. Ask for a new link." | **Send the link**, **Set the password** |
| O3 | Today | Members tell stories about parts of your recordings, and you decide which stories visitors see. Start with the work below. | Checklist: "Put your first widget on a site". Nothing waits: "No stories wait for review. The last story came in {age}." | **Start reviewing**, or the next checklist step |
| O4 | Review stories | A story is a note that a member made on a time range of a recording. Read each story, then publish it or return it to the member. | Per tab, as today. All: "No stories yet. Visitors select "Tell a story" in a widget to tell one." | **Start reviewing** |
| O5 | Story by {name} · {recording} | This story is a note on {range} of "{recording}". Play the range, read the story, then publish it or return it. | Gone: "This story does not exist now." | **Publish**, **Return to the member**, **Next story**, ⋮ **Remove** |
| O5a | Publish this story? | Visitors see it like this in the widget, within one minute. We mail {name} that it is published. | — | **Publish the story** (reply: **Publish the reply**), **Cancel** |
| O5b | Return this story to the member | The member sees your reason on the Annotate page and in a mail. Write what the member must change. | Reason empty: "Write the reason. The member sees it." | **Return the story**, **Cancel** |
| O5c | Remove this story? | The widget stops showing this story and its replies within one minute. The story goes for ever, and we mail the member. | — | **Remove the story**, **Cancel** |
| O6 | History of this story | Each line is one change to this story, newest first. Times are in the time zone of this browser. | — (always one line) | — |
| O7 | Add a widget to a site | A widget plays one recording on a page of your site and shows the stories about it. Choose the recording, then the site, then copy the snippet. | — | **Next**, **Copy the snippet**, **Done** |
| O7.1 | 1 Recording | The widget plays this recording, and every story marks a time range on it. Choose a recording, or add a new one with its audio address. | Search: "No recording has this title." | **Next** |
| O7.2 | 2 Site | The project of the site sets the look, the lists and the review rule of the widget. Choose the site, or add a new one. | No project: the inline form | **Next** |
| O7.3 | 3 Snippet | These two lines show the widget for "{recording}" on a page. Paste them into the page: a page needs the first line one time only. | No website: "This project has no website address. After a story, members do not come back to a site." | **Copy the snippet**, **Done** |
| O8 | Recordings | A recording is the audio that stories are about: each story marks a time range on one recording. Open a recording to copy the snippet of its widget. | "No recordings yet. Select "Add a widget" to add the first recording and put it on a site." | **Add a widget** |
| O9 | {title} | Members tell stories about time ranges of this recording. Copy the snippet to show its widget on a page of your site. | No project: "Make a project first. Each snippet belongs to one project." | **Save**, **Copy the snippet**, link **Try it: tell a story** (audit 1, 2) |
| O10 | Topics | Topics is a list of subjects that members add to their stories, and visitors see them as labels on each story. Add an item for each subject that members can choose. | "Topics is empty. Members can choose no subject until you add an item." | **Add an item**; under "For other systems": **Download the list (SKOS)**, **Load a SKOS file** |
| O11 | Item in Topics: {label} | Members choose this item to say what a story is about, and visitors see its label on the story. Change the label or the broader item here. | In use: "12 stories use this item." | **Save**, **Hide from new stories** |
| O12 | Load a SKOS file | Use this page when your list comes from a different system. Load the file, read the changes, then import them. | Refused: the error of `vocabulary.errors` | **Import these changes** |
| O13 | Members | A member is a person who tells stories about your recordings, and visitors see the member's name on each story. Open a member to see their stories or to block them. | "No members yet. A person becomes a member when they select "Tell a story" in a widget and sign in." | — (rows) |
| O14 | {name} | These are the stories that this member told about your recordings. To stop new stories from this member, select **Block this member**. | Blocked: "This member cannot sign in. Their published stories stay." | **Block this member**, **Unblock** |
| O15 | Projects | A project holds the rules for the stories of one site: the lists, the look of the widget, the review rule and the rights line. Open a project to change it. | "No projects yet. A project holds the settings for one site." | **New project** |
| O16 | {name}: overview | These counts show the stories that members told about recordings on this site. Open a list to review or change them. | Unsaved: "Save the project first. Then its overview shows here." | **Save** |
| O16.1 | Tab Project | These values connect the widgets on your site to this project. Type the name, the address name and each website address. | — | **Save** |
| O16.2 | Tab Review and rights | These rules decide when visitors see a new story, and under which licence. Choose the review rule and the rights line. | — | **Save** |
| O16.3 | Tab Sign-in | A person must sign in to tell a story, so that each story has a member. Choose how members sign in. | Invite codes: "No invite codes yet." | **Make invite codes** |
| O16.4 | Tab Topics | Members choose items from this list to say what a story is about. Add, rename or hide items here. | as O10 | **Add an item** |
| O16.5 | Tab Theme | The theme sets how the widget of this project looks on your site. Change a value, and the preview changes while you type. | No recording: "Add a recording to see the widget here." | **Save** |
| O17 | Operators | An operator decides which stories about your recordings visitors see. Select **Add an operator** to give a colleague access. | One operator: "You are the only operator. Add a colleague, so that review does not stop when you are away." | **Add an operator** |
| O18 | Your account | These settings are for you only. Choose how often a mail tells you that stories wait for review. | — | **Save** |

### 2.2 Admin, the coming questions (vocab-C §6)

When vocab-C ships, the sidebar link **Topics** becomes **Questions**, and O10 becomes one list page among many (Q4).

| ID | Heading | Help line | Empty state | Primary button |
|---|---|---|---|---|
| Q1 | Questions · {project} | Each question asks the member for one fact about the time range, for example the place. Add the questions that you want members to answer, in the order that they see them. | "No questions yet. Members write their story only." | **Add a question**, **See it on a phone** |
| Q2 | Add a question | A question becomes a field below the story on the Annotate page, and its answer shows on the story in the widget. Choose a common question, or write your own. | — | **Write a new question** |
| Q3 | Edit: {question} | Members see this question and its help below their story. Change the words, the answer type or the list here. | In use: "12 stories answer this question. To ask in a new way, add a new question." | **Save**, **Remove from the form** |
| Q4 | {list name} | A list holds the items that members can choose as an answer, for example the places of your area. Add, rename or hide items here. | "{list} is empty. Members can choose nothing from it yet." | **Add an item** |
| Q5 | Load a vocabulary file | Use this page when you have an ontology, a schema or a SKOS file. Load the file, choose what to keep, then load it. | "We found nothing that we can use in this file." | **Load these** |

### 2.3 Annotate page and member pages

| ID | Heading | Help line | Empty state | Primary button |
|---|---|---|---|---|
| P0 | We cannot find this recording | The link does not point to a recording that this site knows. Go back to the page you came from, and try the link again. | — | **Back to the site** |
| P1 | Sign in to tell a story | You tell a story about {time} of "{recording}". Type your email, and we send you a login code. | — | **Send the code** |
| P1r | Sign in to reply | You reply to the story by {name}. Type your email, and we send you a login code. | — | **Send the code** |
| P1i | Sign in with an invite code | You tell a story about {time} of "{recording}". Type your email and the invite code from the team of this site. | — | **Sign in** |
| P2 | Type your login code | You tell a story about {time} of "{recording}". We sent a code to {email}: it works for 10 minutes. | — | **Sign in**, **Send a new code**, **Use a different email** |
| P3 | Choose your name | Visitors see this name next to your stories in the widget. They never see your email. | — | **Continue** |
| P4 | Tell a story | A story is your note about one part of the recording, from Start to End. Set the times, then write what you remember or hear. | — | **Send for review** / **Publish the story** |
| P4r | Reply to a story | A reply answers one story, not a part of the recording. Read the story, then write your answer. | Parent gone: "We cannot find this story" + "The story that you want to answer is not visible now. You can write a story about the recording." | **Send for review** / **Publish the reply** |
| P4m | Voice note, photo or video | Optional. Visitors see it with your text after the story is published. | — | **Record a voice note**, **Attach this voice note**, **Attach a photo or a video** |
| P5 | Your story is sent | {state sentence} | — | **Your stories** |
| P6 | Your story | {state sentence}. Returned: "Change the story, then send it for review again." | — | **Change the story** |
| P7 | Your stories | Each story is a note that you made on part of a recording, on any site of this organisation. Open a returned story to change it. | "You have no stories yet. On a site, select "Tell a story" in the widget." | **Change the story** (returned card) |
| P8 | Your account | Your name shows next to each story that you tell. Change your name or your mail choice here. | — | **Save**, **Sign out** |
| P9 | Sign in again | Your session ended. Your text stays on this page. | — | **Send the code** |

State sentences (P5, P6, cards): Processing: "Processing your file. You can leave this page." Waiting: "Waiting for review. We send you a mail when it is published." Returned: "Returned to you." Published: "Published. Visitors see it in the widget on the site." Change waiting: "Published. Your change is waiting for review."

### 2.4 Widget (visitor)

The widget has no heading of its own: the host page names the site. It gets one new line, the **intro**, above the stories. It tells a visitor what a story is, in the words of sentence 1 of every help line.

| ID | Shows | Text | Primary |
|---|---|---|---|
| V0 | Before the loader (snippet fallback, audit 10) | `<audio controls src>` and "The stories about this recording show here when the page loads." | — |
| V1 | Loading | ARIA label of the frame: "Recording and its stories" | **Play** |
| V2 | Ready, no stories | "No stories yet. Tell the first one." Then the rights line. | **Tell a story** |
| V3 | Ready, stories | Heading "Stories". Intro: "Each story is about one part of the recording. Select a story to hear that part." | **Play** |
| V4 | Story open | "Story by {name}, {from} to {to}", "{n} replies" | **Reply** |
| V5 | Back from the Annotate page | "Your story is sent. It shows here after review." / "Your story is published. It can take one minute to show." | **Play** |
| V6 | Opened from a mail | the story opens, no note | **Play** |
| V7 | Errors | section 5.3 | as CONTRACT §9 |
| V8 | `annotate="none"` | V1–V6 without links. Empty: "No stories yet." | **Play** |

## 3 Field help

Each row: label, one-line description, example value. The description goes in `admin.description`. The example goes in `admin.placeholder` where the field type has one.

### 3.1 Projects

| Field | Label | Description | Example |
|---|---|---|---|
| `name` | Name | The name that members see at the top of the Annotate page and in mails. | River Voices |
| `slug` | Address name | Part of the snippet and of every story address. Use lowercase letters, digits and hyphens. Do not change it after the first story. | river-voices |
| `siteOrigins` | Websites | The sites that show the widgets of this project. After a story, the Annotate page sends members back only to these sites. | — |
| `siteOrigins.origin` | Website address | The scheme and the host only, with no path. | https://www.rivervoices.example.org |
| `language` | Language of the stories | A language tag. The widget uses it to show the text of the stories correctly. | ml |
| `reviewRule` | Review | Who decides when visitors see a new story. | — |
| option `review` | An operator reads each story before visitors see it | — | — |
| option `publish-at-once` | Visitors see each story at once | A story with a voice note, photo or video becomes public when its file is ready. (Today's text says an operator must publish it. ia.md §2.1 rule 1 says the system does.) | — |
| `rights` | Rights line | The licence of the stories. The widget and the Annotate page show it under the stories as one sentence. | CC BY 4.0 |
| option `other` | Other: write the sentence below | — | — |
| `rightsLine` | Rights line text | Write the full sentence that visitors read. | Stories on this page: © 2026 Kochi Heritage Trust. |
| `rightsIri` | Licence address | Optional. The web address of the licence. Each story keeps it in its data. | https://creativecommons.org/licenses/by-sa/4.0/ |
| `signIn` | How members sign in | A login code needs a mail server. An invite code does not: you give the codes to members, for example on paper at a workshop. | — |
| `themeTokens` | Theme | How the widget looks on your sites. An empty field uses the default, in grey. A change shows on your sites within 5 minutes. | — |

### 3.2 Theme tokens

| Field | Label | Description | Example |
|---|---|---|---|
| `colorSurface` | Background colour | The colour behind the widget. | #ffffff |
| `colorText` | Text colour | The colour of the story text. | #1f1f1f |
| `colorMuted` | Secondary text colour | The colour of names, times and the rights line. | #595959 |
| `colorAccent` | Accent colour | The colour of buttons and links, for example "Tell a story". | #0b5cad |
| `colorOnAccent` | Text on the accent colour | The colour of the words on a button. | #ffffff |
| `colorBorder` | Border colour | The colour of lines around the widget and the stories. | #767676 |
| `colorWave` | Waveform colour | The colour of the drawn sound of the recording. | #8c8c8c |
| `colorRegion` | Time range colour | The colour that marks the time range of each story on the waveform. | #d5e3f3 |
| `colorFocus` | Focus ring colour | The ring around the control that the keyboard is on. | #0b5cad |
| `fontFamily` | Font | Empty: the widget uses the font of your page. | Georgia, serif |
| `fontSize` | Text size | Empty: the widget uses the text size of your page. | 1rem |
| `radius` | Corner radius | How round the corners of the widget and its buttons are. | 6px |
| `space` | Space between items | The space between the stories and the controls. | 0.5em |
| `timelineHeight` | Waveform height | The height of the waveform with the time ranges. | 64px |

### 3.3 Recordings

| Field | Label | Description | Example |
|---|---|---|---|
| `title` | Title | The name of the recording. Members see it at the top of the Annotate page. | Ferry crossing, 1962 |
| `url` | Audio address | The web address of the audio file. The widget plays this file. | https://media.example.org/ferry.m4a |
| `otherUrls` | Other formats | Optional. The same audio in a different format, for browsers that cannot play the first address. | https://media.example.org/ferry.ogg |
| `duration` | Length | The browser reads it from the audio address. A story must end inside this length. | 30:34 |

### 3.4 Members

| Field | Label | Description | Example |
|---|---|---|---|
| `email` | Email | The member signs in with it. Visitors never see it. | asha@example.org |
| `nickname` | Name | The name that visitors see next to the stories of this member. | Asha |
| `status` | Status | A blocked member cannot sign in or tell stories. Their published stories stay. | Active |
| `emailVerified` | Email checked | Checked after a login code. A member who signed in only with an invite code gets no mail. | — |
| `mailNotices` | Mail when a story is published or gets a reply | The member sets this on Your account. | — |

### 3.5 Operators

| Field | Label | Description | Example |
|---|---|---|---|
| `email` | Email | You sign in to this admin with it. Members never see it. | ravi@example.org |
| `password` | Password | At least 8 characters. | — |
| `name` | Name | Other operators see it in the history of a story. Members never see it. | Ravi |
| `reviewMail` | Review mail | How often a mail tells you that stories wait for review. | Once a day |

### 3.6 Story review panel (read-only)

| Field | Label | Description | Example |
|---|---|---|---|
| `nickname` | Member | The member who told the story. | Asha |
| `excerpt` | Story | The first words of the text. | My father worked the ferry… |
| `range` | Time range | The part of the recording that the story is about. | 1:02–1:35 |
| `project` | Project (address name) | The project of the widget where the member selected "Tell a story". | river-voices |
| `recording` | Recording number | The recording that the story is about. | 1 |
| `replyTo` | Reply to | The story that this reply answers. | "My father worked…" |
| `lifecycle` | State | Where the story is on its way to the visitors. | Waiting for review |
| `media` | Voice note, photo or video | The files of the story, and whether they are ready. | Voice note, ready |
| `tags` | Topics | The items from the list Topics that the member chose. | Ferry, Horn |
| `toldOn` | Told on | The page where the member selected "Tell a story". | rivervoices.example.org/ferry |

### 3.7 Items in a list (concepts)

| Field | Label | Description | Example |
|---|---|---|---|
| `project` | Project | The project that owns this list. | River Voices |
| `label` | Label | The word that members choose and visitors see on the story. | Ferry |
| `parent` | Broader item | Optional. The item that this item is a part of. | River |
| `hidden` | Hide from new stories | Members cannot choose a hidden item for a new story. Stories that use it keep it. | — |
| `language` | Language of the label | Optional. A language tag. | en |
| `iri` | Address (IRI) | The app makes this address when you save. It never changes, so other systems can point at it. | https://ORG/vocab/river-voices/c/ferry |

### 3.8 Questions and lists (vocab-C §6)

| Field | Label | Description | Example |
|---|---|---|---|
| question label | Question | The words that members see above the field. | Place |
| help | Help | One line below the question. | Where did this happen? |
| type | Answer | The kind of answer: text, choice, date, number, link or language. You cannot change it after the first answer. | Choice |
| list | Choices from | The list that gives the choices. | Places |
| own answer | Members can add their own answer | Members can type an answer that is not in the list. | — |
| many | More than one answer | Members can choose more than one item. | — |
| required | Must answer | A member cannot send the story without an answer. | — |
| list name | Name of the list | Operators see it. Members see the question, not the list. | Places |
| file | Vocabulary file | Turtle, JSON-LD or RDF/XML, 1 MB at most. | river-archive.ttl |

### 3.9 Invite codes

| Field | Label | Description | Example |
|---|---|---|---|
| `count` | How many codes | A number from 1 to 100. | 20 |
| `label` | Label (optional) | Only operators see it. | Workshop 12 Oct |
| `expires` | Last day (optional) | After this day the codes stop working. Empty: no last day. | 2026-10-31 |
| `uses` | Members per code | 1: one code for each person. More: one code for a group. | 30 |

## 4 Mails

Rules stay as ia.md §2.3: one link, the voice of "The {project} team". Changes are marked **new**.

| ID | Subject | First line | Link text |
|---|---|---|---|
| M1 | Your login code for {project} | Your login code is {code}. | none |
| M2 | Your story needs a change | We returned your story about "{recording}", {range}, to you. | Change your story |
| M3 | Your story is published | Your story about "{recording}", {range}, is published. **new** second sentence: "Visitors see it in the widget on the site within one minute." | Listen on the site. **new**: with no `toldOn`, "Open your stories" (audit 25) |
| M4 | **new** {replier} replied to your story | {replier} replied to your story about "{recording}", {range}: | Read the reply. **new**: with no `toldOn`, "Open your stories" |
| M5 | Your story is removed | We removed your story about "{recording}", {range}. Visitors do not see it now. | **new** Open your stories |
| M6 | 2 stories and 1 reply wait for review | River Voices: 2 stories and 1 reply | Review the stories |
| M7 | Reset your Annoudio password | Someone asked to reset the password of your Annoudio account. | Set a new password |

Reasons: M3 said "in the player". M4's subject "Someone replied" hid the one fact that the member wants. M5's link "Your stories" did not say that it opens a page. M7: "Someone" is the plainer word.

## 5 Diff list

Format: `key`: "current" → "new". "+" is a new key. "−" is a deleted key. "(sig)" means the signature changes, so the callers change too.

### 5.1 `app/src/admin/strings.ts`

nav
- `nav.addPlayer`: "Add a player" → "Add a widget"
- `nav.concepts`: "Concepts" → "Topics"

today
- `today.setup`: "Put your first player on a site" → "Put your first widget on a site"
- `today.steps.snippet`: "Put the snippet on a site" → "Paste the snippet into your site"
- `today.storyHint`: "When a member tells a story, it waits for review. Publish it, and visitors see it." → "A visitor selects "Tell a story" in the widget and becomes a member. Publish the story, and visitors see it in the widget."
- `today.optional`: "Optional: add concepts, so that members can choose topics." → "Optional: add items to the list Topics, so that members can say what a story is about."
- `today.addConcepts`: "Add concepts" → "Open Topics"
- + `today.help`: "Members tell stories about parts of your recordings, and you decide which stories visitors see. Start with the work below."
- + `today.aboutHeading`: "What Annoudio does"
- + `today.about`: the paragraph of section 1.1

review
- + `review.help`: "A story is a note that a member made on a time range of a recording. Read each story, then publish it or return it to the member."
- + `review.storyHelp` (sig): `(range, recording) => \`This story is a note on ${range} of "${recording}". Play the range, read the story, then publish it or return it.\``
- `review.empty.all`: "No stories yet. Members tell stories on the Annotate page." → "No stories yet. Visitors select "Tell a story" in a widget to tell one."
- `review.stateLong.published`: "Published. Visitors see it in the player." → "Published. Visitors see it in the widget."
- `review.noTags`: "No topics." → "Topics: none."
- `review.goneTag`: "A concept that was removed" → "An item that was removed from Topics"
- `review.addConcept`: `Add a concept to ${project}` → `Add an item to the Topics of ${project}`
- `review.noTopicFits`: "No topic fits?" → "Nothing in Topics fits?"
- `review.notOnSite`: "Not from a site: the member opened the Annotate page directly." → "Not known. The member came from a page that is not on the website list of this project, or opened the Annotate page directly."
- `review.publishIntro`: "Visitors see it like this, within one minute:" → "Visitors see it like this in the widget, within one minute:"
- `review.removeIntro`: "The story goes for ever. Visitors stop seeing it within one minute. We mail the member." → "The widget stops showing this story and its replies within one minute. The story goes for ever, and we mail the member."
- `review.returnIntro`: "The member sees your reason on the Annotate page and in a mail, and can change the story." → "The member sees your reason on the Annotate page and in a mail. Write what the member must change."

addPlayer
- `addPlayer.title`: "Put a recording on a site" → "Add a widget to a site"
- + `addPlayer.help`: "A widget plays one recording on a page of your site and shows the stories about it. Choose the recording, then the site, then copy the snippet."
- + `addPlayer.recording.help`: "The widget plays this recording, and every story marks a time range on it. Choose a recording, or add a new one with its audio address."
- `addPlayer.site.question`: "Which site shows the player?" → "Which site shows the widget?"
- + `addPlayer.site.help`: "The project of the site sets the look, the lists and the review rule of the widget. Choose the site, or add a new one."
- `addPlayer.site.newHint`: "A project is one site: its topics, look and review rule. You can change its other settings later, in Projects." → "A project holds the settings for one site: its lists, look, review rule and rights line. You can change them later, in Projects."
- `addPlayer.snippet.intro`: "Paste these two lines into the page. A page needs the first line one time only." → "These two lines show the widget on a page. Paste them into the page: a page needs the first line one time only."
- `addPlayer.snippet.preview`: "Preview: the player with the look of this project" → "Preview: the widget with the look of this project. On your site, it also shows "Tell a story"."

recordings, recording
- `recordings.add`: "Add a player" → "Add a widget"
- `recordings.empty`: "No recordings yet. Select "Add a player" to add the first one and put it on a site." → "No recordings yet. Select "Add a widget" to add the first recording and put it on a site."
- + `recording.help`: "Members tell stories about time ranges of this recording. Copy the snippet to show its widget on a page of your site."
- `recording.snippetIntro`: "Paste these two lines into a web page to show the player with its stories. A page needs the first line one time only." → "Paste these two lines into a web page. The page then shows the widget of this recording, with its stories."
- + `recording.tryIt`: "Try it: tell a story" (link to `/annotate?project&recording`, audit 1)

concepts, overview, vocabulary, concept
- `concepts.title`: "Concepts" → "Topics"
- `concepts.intro`: "Members see concepts as topics. They choose topics when they tell a story." → "Topics is a list of subjects that members add to their stories, and visitors see them as labels on each story. Add an item for each subject that members can choose."
- `concepts.noProject`: "Make a project first. Each project has its own concepts." → "Make a project first. Each project has its own Topics."
- + `overview.help`: "These counts show the stories that members told about recordings on this site. Open a list to review or change them."
- `overview.review`: "Review the stories of this project" → "Review the waiting stories of this project"
- + `overview.allStories`: "All stories of this project" (audit 5)
- `overview.concepts`: `1 concept` / `${n} concepts` → `1 item in Topics` / `${n} items in Topics`
- `overview.conceptsLink`: "Open the concepts" → "Open Topics"
- `vocabulary.heading`: "Vocabulary" → "Topics"
- `vocabulary.intro`: "The concepts that members can choose as topics. To add one, select "Add a concept" and type the label. The app makes the concept address." → "Members choose items from this list to say what a story is about. Add, rename or hide items here."
- `vocabulary.unsaved`: "Save the project first. Then you can add concepts." → "Save the project first. Then you can add items."
- `vocabulary.none`: "No concepts yet. Members see no topics." → "Topics is empty. Members can choose no subject until you add an item."
- `vocabulary.add`: "Add a concept" → "Add an item"
- + `vocabulary.otherSystems`: "For other systems"
- `vocabulary.download`: "Download as SKOS" → "Download the list (SKOS)"
- `vocabulary.upload`: "Upload SKOS file" → "Load a SKOS file"
- `vocabulary.uploadIntro`: "A Turtle or JSON-LD file with skos:Concept items. The upload adds new concepts and updates the label and broader concept of known ones. It never removes a concept." → "Use this when your list comes from a different system. The file is Turtle or JSON-LD with skos:Concept items. It adds and renames items, and never removes one."
- `vocabulary.preview`: "The file has {n} concepts: …" → "The file has {n} items: …"
- `vocabulary.skipped`: "concept is / concepts are left out:" → "item is / items are left out:"
- `vocabulary.ignoredParents`: "broader link is / links are ignored." → "link to a broader item is / links to a broader item are ignored."
- `vocabulary.applied`: "The vocabulary is updated." → "Topics is updated."
- `vocabulary.errors.too-large`: "… 5000 concepts." → "… 5000 items."
- `concept.uses`: replace "this concept" with "this item" in both branches. "To stop members choosing it" → "To stop members from choosing it".
- `concept.unsaved`: "Save the concept first." → "Save the item first."

invites, theme
- `invites.intro`: "Give a code to each member, …" → "An invite code lets a person sign in and tell stories without a mail. Give one code to each person, for example on paper." Then the current sentences 2–3 as a second paragraph `+ invites.noMail`: "The app does not check the email of these members. So it sends them no mail until they sign in once with a login code."
- `invites.revoked`: "The code is revoked. Members who used it stay signed in; block a member in Members." → "The code is revoked. Members who used it stay signed in. To stop one of them, block the member in Members."
- `theme.intro`: "The player as it shows on a host site, with the values below. …" → "The theme sets how the widget of this project looks on your site. Change a value, then save: your sites get the change within 5 minutes."
- `theme.noRecording`: "Add a recording to the catalogue to see a preview here." → "Add a recording to see the widget here."

### 5.2 `app/src/app/(frontend)/annotate/strings.ts`

- − `rights`: "Stories here:" (W5. `Frame.tsx` shows `rightsLine` alone.)
- + `signIn.moment` (sig): `(time) => \`You tell a story about ${time} of the recording.\`` → `(time, recording) => \`You tell a story about ${time} of "${recording}".\`` Show it on P1, P2 and P3 (audit 13).
- `signIn.intro`: "We send a login code to your email. You do not need a password." → "Type your email, and we send you a login code. You do not need a password."
- `signIn.nicknameIntro`: "People who listen see this name next to your stories. They never see your email." → "Visitors see this name next to your stories in the widget. They never see your email."
- + `form.intro`: "A story is your note about one part of the recording, from Start to End. Set the times, then write what you remember or hear."
- `form.setFromPlayer` (sig): "Use the player time" → `(time) => \`Use ${time}\`` (audit 18; whole seconds, audit 17)
- `form.noTags`: "This project has no topics yet." → "Topics: nothing to choose yet."
- + `reply.intro`: "A reply answers one story, not a part of the recording. Read the story, then write your answer."
- `saveErrors.too-many-tags`: "Choose fewer topics." → "In Topics, choose fewer items."
- `saveErrors.unknown-concept`: "A topic does not exist now. Reload the page." → "An item in Topics does not exist now. Reload the page."
- `saveErrors.reply-and-tags`: "A reply has no topics. Reload the page and try again." → "A reply cannot use Topics. Reload the page and try again."
- `media.hint`: "Optional. It shows in the player after review and processing. Write a short text too." → "Optional. Visitors see it with your text after the story is published."
- `media.stop`: "Stop the recording" → "Stop the voice note"
- `media.recording`: `Recording: ${seconds} s` → `Voice note: ${seconds} s`
- `media.discard`: "Do not use this recording" → "Do not use this voice note"
- `media.preview`: "Your recording" → "Your voice note"
- `story.states.waiting`: "Waits for review. We send you a mail when it is published." → "Waiting for review. We send you a mail when it is published."
- `story.states.published`: "Published. Visitors see it in the player." → "Published. Visitors see it in the widget on the site."
- `story.states.changeWaiting`: "Published. Your change waits for review." → "Published. Your change is waiting for review."
- `mine.moment`: "Your stories and replies on all sites of this organisation." → "Each story is a note that you made on part of a recording, on any site of this organisation. Open a returned story to change it."
- `mine.empty`: "You have no stories yet. On a site, select "Tell a story"." → "You have no stories yet. On a site, select "Tell a story" in the widget."
- `account.moment`: "Your name and your mail choice." → "Your name shows next to each story that you tell. Change your name or your mail choice here."
- `account.nameHint`: "People who listen see this name …" → "Visitors see this name next to your stories. New stories get the new name."
- `stateLabel` `change: 'waiting'`: "Published · change waits for review" → "Published · change waiting"
- `stateLabel` `waiting`: "Waits for review" → "Waiting for review"

### 5.3 `embed/src/text.ts`

- `player`: "Audio player" → "Recording and its stories"
- + `intro`: "Each story is about one part of the recording. Select a story to hear that part." (new part `intro` above `stories`: an additive CONTRACT §3.3 change)
- − `rights`: "Stories here:" (W5. `element.ts:411` shows the line alone.)
- `error.missing-attribute`: "This audio player is not set up correctly. …" → "This widget is not set up correctly. …"
- `error.invalid-attribute`: both branches "This audio player is not set up correctly." → "This widget is not set up correctly."
- `error.bundle-unavailable`: "The audio player could not load. Reload the page to try again." → "The widget could not load. Reload the page to try again."

### 5.4 `app/src/modules/mail/mails.ts`

- `published` paragraph 1: `… is published. Visitors see it in the player now.` → `… is published. Visitors see it in the widget on the site within one minute.`
- `published` link (sig): input gains `onSite: boolean` (true when `toldOn` exists). Label: `onSite ? 'Listen on the site' : 'Open your stories'`.
- `replied` subject (sig): "Someone replied to your story" → `${input.replier} replied to your story`
- `replied` link (sig): as `published`. Label: `onSite ? 'Read the reply' : 'Open your stories'`.
- `removed` link label: "Your stories" → "Open your stories"
- `passwordReset` paragraph 1: "Somebody asked …" → "Someone asked …"

## 6 Changes outside the four files

These strings live in other files. The build agent applies them in phases of ≤ 5 files. Phase A: the four files of section 5. Phase B: this list.

| File | Change |
|---|---|
| `app/src/modules/projects/index.ts` | `RIGHTS[*].line` becomes a sentence: "Stories on this page are shared under CC BY 4.0." · "Stories on this page are shared under CC BY-NC 4.0." · "All rights to the stories on this page are reserved." Collection description → O15 help. Field labels and descriptions → §3.1. This is a data change: a migration rewrites the stored `rightsLine` of rows with a listed `rights`. |
| `app/src/modules/projects/theme.ts` | Each token gets a `description` (§3.2). `colorRegion` label → "Time range colour". `timelineHeight` label → "Waveform height". Group description → §3.1 `themeTokens`. |
| `app/src/modules/catalogue/index.ts` | Description → O8 help. Field descriptions → §3.3. |
| `app/src/modules/stories/collection.ts` | Description → O4 help. "Project (short name)" → "Project (address name)". "Recording ID" → "Recording number". |
| `app/src/modules/membership/collections.ts` | Description → O13 help (today's text says "with a login code" and misses invite codes). Field texts → §3.4. |
| `app/src/collections/Users.ts` | Description → O17 help. |
| `app/src/modules/media/collection.ts` | Description → "A voice note, photo or video is one part of a story, next to its text. A delete here removes the file from its story." |
| `app/src/modules/vocabulary/collection.ts` | Labels singular "Item", plural "Topics". Description → O10 help. Field texts → §3.7. |
| `app/src/payload.config.ts` | `i18n.translations.en.authentication`: `login` "Sign in", `forgotPasswordQuestion` "Forgot your password?", `forgotPassword` "Reset your password", `createFirstUser` "Create the first operator", `logOut` "Sign out". Key names checked in `@payloadcms/translations@3.90.2` `en.js`. |
| `app/src/app/(frontend)/annotate/Frame.tsx`, `embed/src/element.ts` | Drop the rights prefix (W5). |
| `CONTEXT.md`, `design/ia.md` §7 | Topic: "the name of one list". Concept: "code and SKOS only. UI word: item". Snippet: "put a widget there". ia.md §7 rows "Add a player", "Put a recording on a site", "Concept". |

The `review` option text of `publish-at-once` contradicts ia.md §2.1 rule 1 today. Section 3.1 corrects the text, not the behaviour. If the code makes an operator publish such a story, that is a separate fault.
