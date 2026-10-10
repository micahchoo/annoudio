# Annoudio app

This is the Payload CMS 3 app for Annoudio. It gives operators the admin GUI, serves the Web Annotation Protocol read routes and the Annotate page, where members write stories.

Read `../CONTEXT.md` first. It defines the words that this README uses.

## What the app contains (Phase 5c, and the project vocabulary)

Each module has one folder in `src/modules/`. Its `index.ts` is the only file that other code imports. `payload.config.ts` composes the collections and makes the one `stories` instance.

| Module | Collection | Holds | Interface |
|---|---|---|---|
| `projects` | `projects` | `name`, `slug` (unique, part of every story IRI), `siteOrigins` (the allow-list of the Annotate `return` URL), `language`, `reviewRule` (`review` or `publish-at-once`), `rights` (a listed licence or `other`), `rightsLine`, `rightsIri`, `themeTokens` (one optional text field per theme token, CONTRACT §3.1) | `projectsCollection(deps)`, `bySlug`, `byId`, `allProjects`, `create`, `returnTarget`, `theme`, `handleTheme`, `THEME_TOKENS`. A project with stories or replies cannot be deleted; its concepts go with it |
| `catalogue` | `recordings` | `title`, `url` (the audio address), `otherUrls` (other formats), `duration` (seconds; the admin probes it in the browser) | `recordingsCollection(deps)`, `recording`, `firstRecording`, `list`, `register`, `snippet`, `checkAudioUrl`, `handleRecording` (the recording JSON). A recording with stories or replies cannot be deleted |
| `vocabulary` | `ontologies`, `ontology-terms` (hidden), `vocab-fields` (hidden), `vocab-lists` (hidden), `concepts` ("List items") | The ontologies of the organisation (8 bundled, seeded on first use and by the migration; uploads), their properties and classes; per project the ordered **fields** (the questions: property, label, help, kind of answer, list, required, how many, show in the widget, own answers, hidden, position) and the **lists** (Topics, Places, People; items or entities with a class); items with `list`, `parent`, `hidden`, **Same as** | `createVocabulary` (`profile`, `choices`, `resolve`, `inputsOf`, `labels`, `item`, `addField`, `updateField`, `moveField`, `removeField`, `searchTerms`, `ontologies`, `lists`, `addList`, `addItem`, `importFile`, `exportFile`, `describe`), the collections, `CATALOGUE`, `writeQuads`; the SKOS functions and `removeVocabulary`. See `../design/vocab.md`, `../design/vocab-build-notes.md` |
| `membership` | `members`, `member-sessions`, `login-codes`, `invite-codes`, `invite-uses`, `invite-tries` (all hidden but `members`) | Members (email, nickname, status, `mailNotices`, `emailVerified`), session tokens, login codes and invite codes, all stored as hashes | `createMembership` (also `redeemInvite`, `invites`, `contact`, `account`, `updateAccount`), see `../design/membership-interface.md` and `../design/invite-codes.md` |
| `mail` | none | The `Mailer` port (adapters `smtpMailer`, `memoryMailer`), all mail text M1–M7 (`mails.ts`), and the notices that follow a story change (M2–M6) | `createNotices`, `mails`, `mailerEmailAdapter`, see `../design/phase5c-notes.md` |
| `media` | `media` (operators read and delete; nobody edits) | One row per upload: `member`, `kind`, `state` (`uploaded`, `ready`, `failed`), `size`, `raw`, `derived`, `format`, `durationSec`, `width`, `height`, `error` | `createMedia` (`handleUpload`, `handleFile`, `body`, `startSettledConsumer`), the lookups `body` and `mediaIdOf`, see `../design/phase4b-notes.md` |
| `stories` | `stories`, `story-representations` (hidden) | The WADM record of each story and reply, the derived columns (`excerpt`, `nickname`, `start`, …), `toldOn`, `processing`, the `rejection` (of an operator, or `automatic`), the change of each version (`lastAction`, `changedBy`), and the served bytes with their ETags | `lifecycle(row)` (the one derivation of the UI state), `createStories`: also `reject`, `remove`, `review`, `history`, `nextWaiting`, `ownStories`, `mediaSettled`, `counts`, `recent`, `projectReach`, `publishedStory`, `forgetInstances` (the delete guard of projects and recordings), `valueCounts`, `fieldUsage`, `exportQuads` (linked data); each answer of a story is one value body (`../design/vocab.md` §3), and `story-values` (hidden) holds one row per value of the newest and the published version; see `../design/stories-interface.md`, `../design/phase5-notes.md`, `../design/phase5b-notes.md`, `../design/phase5c-notes.md` |

`users` holds the operators (the admin calls them **Operators**): email, password, `name` (History names them by it), `reviewMail` (daily, each, never), and the two choices of the Today checklist. `members` holds the members. A member is never a Payload user: members sign in with a login code on the Annotate page, not in the admin.

The Web Annotation Protocol read routes are at `/stories/{project}/{recording}/`. The recording JSON for the CMS plugins is at `/embed/v1/recordings/{project}/{id}.json` (`../CONTRACT.md` §5.2). The route file is `src/app/(frontend)/stories/[[...path]]/route.ts`.

The player files are in `public/embed/`: `v1.js` and `v1/<hash>/player.js`. They are build output of `../embed/` (`cd ../embed && pnpm build`); never edit them. `next.config.ts` gives them the headers of `../CONTRACT.md` §5.1 (CORS `*`, `Cross-Origin-Resource-Policy`, 300 s for the loader, one year `immutable` for the bundle). The project theme is at `/embed/v1/themes/{project}.json` (route file `src/app/(frontend)/embed/v1/themes/[file]/route.ts`). An operator sets the theme in the admin, in the **Theme** group of a project. An empty field uses the player default, which the field shows in grey.

Payload adds the client hint headers `Accept-CH`, `Critical-CH` and `Vary: Sec-CH-Prefers-Color-Scheme` to every path. `next.config.ts` keeps them on `/admin/*` only, because only the admin reads the hint.

The admin for operators (Phase 5 and 5c, `../design/phase5-notes.md`, `../design/ia.md`, `../design/phase5c-notes.md`):

- The custom admin components are in `src/admin/`. All their text is in `src/admin/strings.ts`; the job addresses are in `src/admin/paths.ts`. Each config names its components by path (for example `/admin/stories/Controls#Status`). After you add or rename one, run `pnpm generate:importmap`. The styles are in `src/app/(payload)/custom.scss`.
- **Today** (`/admin`, `src/admin/Today.tsx`) replaces Payload's dashboard: on an empty stack the checklist (project, recording, snippet, first story; each step ticks from data), then what waits. The sidebar starts with the job links (`src/admin/NavLinks.tsx`): Today, Review stories (with the Waiting count), Add a widget, Vocabulary, Members; the group Settings holds Projects, Recordings, Operators; **Your account** comes last.
- **Review stories**: tabs Waiting for review · Processing · Returned · Published · All, each with its count and its own empty text; with no filter in the address, the list is the queue. A story opens as a read-only panel; the controls (`src/admin/stories/Controls.tsx`, `Dialogs.tsx`) are **Return to the member** (a reason), **Next story**, **Publish** (a dialog with what visitors see) and **Remove**, all through `stories`. After an action the next waiting story opens. There is no Unpublish. The tab **History** lists the changes of the story.
- **Add a widget** (`/admin/add-widget`, with `?recording=` or `?project=`): Recording, Site, Snippet in three steps. Step 2 makes the recording a widget of the project (`projects.recordings`); step 3 shows the snippet and the real widget with live links.
- **The preview page** (`/admin/preview/{project}/{recording}`): the real widget of one instance, its snippet and **Open the Annotate page**. **Try it: tell a story** (recording page, Overview, step 3, Theme tab) opens the Annotate page with `return` = this page, which the Annotate page always accepts: an operator walks the member's steps with no host site.
- **Relationships**: chips link a story to its member, project and recording; a recording page lists its widgets (projects with story counts, **Add to a project**); a project Overview lists its widgets; a member page lists the member's stories by state and invite codes. Choices from a known set are native dropdowns (`admin/ui/SelectField.tsx`); the 9 colour tokens have a colour picker with a contrast readout (`admin/projects/ColorField.tsx`).
- **A `return` that is not on the website list**: the Annotate page says so; `stories` keeps the page for operators (`toldOnUnlisted`), and the review screen offers **Add this website**.
- **Vocabulary** (`/admin/vocabulary[/project]`, the sidebar job; also the project tab **Vocabulary**): the questions of a project in order, with the property under each label, **Add a question** (14 common questions, Advanced: from an ontology, your own question), **Edit**, **Move up** / **Move down**, the field lock of a question that stories answer, and the folded **For other systems** (questions as SHACL or an Omeka template, the linked data at `/admin/export/{project}.ttl|.trig|.jsonld`, and **Load a vocabulary file**: Turtle, JSON-LD, RDF/XML, SHACL or an Omeka template, 5 MB at most, through `POST /api/ontologies/import`). **Lists** (`/admin/concepts/{project}`, also the project tab **Lists**): the lists with **Open** (the tree, or the entities with Same as) and **Add a list**. Settings → **Ontologies**: the loaded ontologies. **Projects**: the tab Overview first, then Settings (Project, Review and rights, Sign-in, Vocabulary, Lists, Theme).
- **Recordings**: no create button of its own (Add a widget makes recordings); a recording page has the snippet with a Copy button and the length from a browser probe.
- Server Actions of the admin (`src/admin/**/actions.ts`) check the operator first.

Mail (`src/modules/mail/`): M1 the login code; M2 returned; M3 published; M4 replied; M5 removed; M6 the review mail to operators (each story, or once a day at 08:00 in the time zone of the worker container: the worker schedules `mail.digest`); M7 the operator password reset (Payload). With `SMTP_URL`, mail goes out through SMTP (`@payloadcms/email-nodemailer` for M7). Without it, the app keeps mail in memory and writes it to the log. A mail goes after the change commits; a failed send goes to the log and does not undo the change.

Media bodies (voice notes, photos, short videos):

- The Annotate page uploads each file with Uppy and the tus protocol to `/media/upload` (route `src/app/(frontend)/media/upload/[[...id]]/route.ts`). Only a signed-in member can upload. The limits come from the worker: sound 100 MB, video 250 MB, image 25 MB. The raw file goes to `MEDIA_DIR/raw/`, and the app queues the job `media.transcode` for the worker container.
- The worker reports each result with the job `media.settled`. When a voice note is ready, its story goes from Processing to Waiting for review (or is published, with `publish-at-once`); when it fails, the story is returned to its member ("Returned (automatic)"). The Next server process with `ANNOUDIO_MEDIA_CONSUMER=1` works that queue and sets the state of the row. It starts the consumer in `src/instrumentation.ts`, when the server starts. Other processes that load the config (`payload run`, `next build`, the tests) never take a report.
- `/media/<id>` (route `src/app/(frontend)/media/[id]/route.ts`) serves the derived file of a ready body to any origin, with byte ranges and a one-year `immutable` cache. It gives 404 until the body is ready.
- A media body needs a text body in the same story. A draft can have a body that is still processing; **Publish** refuses it with a plain-language message until the body is ready. The **Media** column of the stories list shows `ready`, `processing` or `failed`.
- An operator deletes a media body in **Media bodies** to take it down: the row and both files go, and the URL gives 404. A cache can keep a copy for up to one year.

Replies (Phase 5b, `../design/phase5b-notes.md`): a reply is a story with `replyTo` (the id of a published story of the same instance) in place of a time range. It has a text, can have media bodies, and has no answers. Replies to a reply are refused. Each reply has its own review state, and the project review rule applies. Visitors see a published reply inside the page item of its story, under `annoudio:replies`, and at its own IRI. When its story is not published, a reply shows nowhere. No table or column was added: the stored WADM holds the target.

Member pages: **Your stories** (`/annotate/mine`, the member home; `/` goes there) groups the stories of the member by state; **Your account** (`/annotate/account`) has the name, the mail choice and Sign out. The Annotate page wears the project frame: the project name, its theme tokens, the rights line in the footer, a member menu, and **Back to the site**. The buttons say **Send for review**, or **Publish the story** when the project publishes at once. Times are typed as `1:02` or as seconds. Below the story and its media, **About this part** has the questions of the project: every required one and the first three others, the rest under **More questions (N)**; chips for a short list, a search box for a list of more than 8 items, own answers where the question allows them. The review screen shows the answers as "Label: value", and the widget the same, with the labels of the theme JSON `fields`.

The Annotate page is at `/annotate?project&recording&t&return` (`../CONTRACT.md` §7). The player's Reply link adds `replyTo=<story id>` (§7.3): the page then shows that story above a text box (no range, no questions), and the return fragment adds `annoudio-reply=<story id>`, so the player opens that story. Its files are in `src/app/(frontend)/annotate/`. All its text is in `strings.ts`. It shows the recording in `<annoudio-player annotate="none">` with the loader of this app, and starts it at `t` with `seek()`. The widget draws the time range (attribute `range`, CONTRACT §2.1): a drag on the waveform marks it, and **Use 0:05** writes the widget's current time in m:ss. After a save with no way back to the site, the page shows a done screen. Without JavaScript, the page shows a link to the audio file, and the forms still work. To send members back to a host page, add the origin of the host site (for example `https://www.example.org`) to **Site origins** of the project. The page drops a `return` URL on any other origin.

## Start the app for development

You need Node 24, pnpm 11 and Docker with compose.

1. Start Postgres. Run this command from the repository root:

   ```sh
   docker compose -f deploy/docker-compose.dev.yml up -d --wait
   ```

   Postgres listens on `127.0.0.1:5432`. The data stays in the volume `annoudio-dev_pgdata`.

2. Make the environment file. Do this one time only:

   ```sh
   cd app
   cp .env.example .env
   ```

   Then set `PAYLOAD_SECRET` in `.env` to a new value. Use `openssl rand -hex 24` to make one. Set `ANNOUDIO_ORIGIN` to the public origin of the app, for example `https://stories.example.org`. Every story IRI starts with it. Do not change it after the first story.

   Optional: `STORIES_PAGE_SIZE` (default 100), `STORIES_MAX_AGE` (60 seconds), `STORIES_MAX_BODIES` (5), `STORIES_MAX_VALUES` (30 answers per story; it replaces `STORIES_MAX_TAGS`), `STORIES_MAX_TEXT` (5000 characters).

   Media: `MEDIA_DIR` is the media volume (default `media` in the folder that runs the app). The worker must use the same folder. `ANNOUDIO_MEDIA_CONSUMER=1` makes this process take the worker's reports; set it in one app process only. Without it, uploads stay "processing". To process uploads in development, run the worker too (`../worker/README.md`) with the same `DATABASE_URL` and `MEDIA_DIR`.

   Login codes: set `SMTP_URL` (a nodemailer URL, for example `smtps://user:password@smtp.example.org:465`) and `EMAIL_FROM`. Without `SMTP_URL`, the app writes each login code to the terminal that runs `pnpm dev`. Use that in development only.

   Limits of login codes, each in one rolling hour: 5 per email, 20 per IP address, and `ANNOUDIO_CODES_PER_HOUR` per stack (default 100).

   Invite codes (`../design/invite-codes.md`): without `SMTP_URL`, members can sign in with an invite code. Each project has the setting **How members sign in** (tab **Sign-in**): a login code by email, an invite code, or both. A new project gets "login code" when the stack can send mail, else "invite code", and Today then says "No mail server: members sign in with invite codes." An operator makes the codes in the same tab (**Make invite codes**: how many, members per code, a label, a last day) and sees each code once. An invite code does not prove the email, so the app sends no member mail (M2–M5) to a member until that member signs in once with a login code. Failed invite tries have the same limits as login codes.

   `TRUST_PROXY`: the number of proxies in front of the app (Traefik, Caddy, nginx). Default 0. The app reads the client IP address from `X-Forwarded-For`: the value that the outermost proxy of this stack added, which is the `TRUST_PROXY`-th value from the right (0 and 1 both read the last value). It never reads the first value, because a client can set it. Next.js gives the app no socket address: it writes the socket address into `X-Forwarded-For` only when the request has none. So without a proxy, a client can choose its own IP address and escape the per-IP limit; the per-stack limit still holds. In production, run the app behind a proxy and set `TRUST_PROXY=1`.

3. Install the packages and start the server:

   ```sh
   pnpm install
   pnpm dev
   ```

4. Open http://localhost:3000/admin. On the first visit, the admin asks you to make the first operator account.

When a collection changes, `pnpm dev` can stop at a question from the schema push in the terminal, for example "Is theme_tokens_color_surface column in projects table created or renamed from another column?". Phase 3b removed `projects.site` and added the theme fields: choose **create column**. The tests do not ask, because `pnpm test:int` drops the test database first. Run `pnpm test:int` before `pnpm test:e2e` after a schema change, or the e2e server stops at the same question.

In development, Payload changes the database tables to agree with the collection configs (`push`). Production never does: it changes the tables only with the migrations in `src/migrations/`, and the app image runs `payload migrate` on start, before `next start`.

**After any schema change, run `migrate:create`.** A schema change is a new, removed or renamed collection, stored field, index or select option. With `DATABASE_URL` set:

```sh
pnpm migrate:create <name>    # writes src/migrations/<date>_<name>.ts and .json
pnpm migrate:status           # which migrations ran
pnpm migrate                  # runs the migrations that did not run
```

Read the SQL in the new file before you keep it. To check the migrations on an empty database, make `annoudio_fresh_test` on the dev Postgres, then run `NODE_ENV=production pnpm migrate` with `DATABASE_URL` set to it. `NODE_ENV=production` turns `push` off, so only the migrations make the tables.

## Stop the app

1. Push Ctrl+C in the terminal that runs `pnpm dev`.
2. Stop Postgres:

   ```sh
   docker compose -f deploy/docker-compose.dev.yml down
   ```

   To delete all data too, add `-v` to that command.

## Other commands

| Command | Does |
|---|---|
| `pnpm generate:types` | Writes `src/payload-types.ts` from the collection configs. Run it after you change a collection. |
| `pnpm generate:importmap` | Writes the admin import map. Run it after you add a custom admin component. |
| `pnpm exec tsx scripts/bundle-ontologies.ts [folder]` | Writes `src/modules/vocabulary/bundled/*.json` from the official files of the 8 bundled ontologies (it downloads a file that is not in the folder). The app never downloads them; run it only to update a bundled ontology. |
| `pnpm build` | Makes a production build (`.next`). It type-checks the tests too. |
| `pnpm migrate`, `pnpm migrate:create <name>`, `pnpm migrate:status` | Payload migrations (see above). |
| `pnpm test:int` | Runs the integration tests (Vitest) on the database `annoudio_test`. Postgres must run. Payload makes the database if it does not exist, and drops all its tables at the start of each test file. Set `TEST_DATABASE_URL` to use a different test database; its name must end in `_test`. |
| `pnpm test:e2e` | Runs the Playwright tests (Chromium). `tests/e2e/review.e2e.spec.ts` drives the admin as an operator. They start their own `next dev` on port 3100 with the build folder `.next-e2e`, so a running `pnpm dev` does not block them. They use `annoudio_test` and delete its rows. Postgres must run. The first time, run `pnpm exec playwright install chromium`. Chromium runs muted and detached from PulseAudio (`PULSE_SERVER=/nonexistent`), so the tone of the player tests is silent. `tests/e2e/embed.e2e.spec.ts` starts a small host site on `127.0.0.1:3199`, `tests/e2e/media.e2e.spec.ts` one on `127.0.0.1:3198`. The e2e server takes the `media.settled` reports, with `MEDIA_DIR=.media-e2e`; the media tests run the real worker with its fake adapters in the test process. The voice-note test records from Chromium's fake microphone. |

## Caution

- `rdfxml-streaming-parser` (RDF/XML uploads) is a new dependency of the app, and `jsonld` (tests only) a new dev dependency: rebuild the app image.

- The app imports the worker package (`annoudio-worker: file:../worker`) for the limits, the job names and the `media.settled` message. pnpm copies `../worker/dist` when it installs. After a change in `../worker/src/`, run `pnpm build` in `../worker`, then `pnpm install --force` here.

- Do not commit `.env`. It contains the secret.
- `ANNOUDIO_TEST_MAILBOX=1` opens `/test-mailbox`, which shows login codes to anyone. Only the Playwright config sets it. A production build ignores it.
- Postgres stores `wadm` as `jsonb`. `jsonb` does not keep the key order of a JSON object. A record that you write can come back with its keys in a different order.
