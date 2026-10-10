# The local demo stack

A complete Annoudio stack on this computer, with demo data. Use it to look at the admin, at the widget on a WordPress page and an Omeka S page, and at the Annotate page. It is not a server setup: for that, read `GUIDE-dokploy.md`.

## Addresses

| What | Address |
|---|---|
| Admin | http://127.0.0.1:3500/admin |
| The widget on a WordPress page (start here) | http://localhost:8091/?pagename=demo |
| The widget on an Omeka S page | http://localhost:8092/s/annoudio/page/demo |
| Annotate page for the demo recording, at 0:02, return to the WordPress page | http://127.0.0.1:3500/annotate?project=river-voices&recording=1&t=2&return=http%3A%2F%2Flocalhost%3A8091%2F%3Fpagename%3Ddemo |
| Stories of the recording (Web Annotation Protocol) | http://127.0.0.1:3500/stories/river-voices/1/ |
| Theme tokens of the project | http://127.0.0.1:3500/embed/v1/themes/river-voices.json |
| Player loader | http://127.0.0.1:3500/embed/v1.js |
| Mailbox (all mails of the stack) | http://127.0.0.1:8025 |

The two host pages and the audio of the recording (`127.0.0.1:4610/media/tone.m4a`) are not part of this stack. They work only when the test hosts (`deploy/test-hosts`, next sections) and the media fixture server (`embed/tests/fixture/server.mjs`, ports 4610 and 4620) run.

Each host page holds the two lines of the admin's Snippet panel, pasted by an administrator into an HTML block: one widget, project `river-voices`, recording `1`. Other pages on the test hosts are test fixtures, not demo pages:

- `?pagename=player` (WordPress) and `page/player` (Omeka S): the Phase 2 pages of `embed/tests/hosts.spec.ts`. They load the embed fixture server (port 4510, recording `rec-0042`), so they are empty when that test does not run.
- `?name=annoudio-block-by-author`, `page/annoudio-media` and the `annoudio-fallback` pages: the plugin tests (`plugins/tests`). They show the demo recording two times on one page, or with a stored copy of the audio.
- `127.0.0.1:4620/bare.html`: the embed fixture page. It points at the fixture stack, not at this one.

## The host pages (WordPress and Omeka S)

The test hosts are a second compose project, `annoudio-hosts` (`deploy/test-hosts/docker-compose.yml`). Make or repair them from the repository root. Both scripts are safe to run again:

```sh
deploy/test-hosts/setup.sh            # installs WordPress and Omeka S, makes the Phase 2 pages
deploy/test-hosts/install-plugins.sh  # needs the demo stack: plugins, test pages, demo pages, websites
```

`install-plugins.sh` also adds `http://localhost:8091`, `http://127.0.0.1:8091`, `http://localhost:8092` and `http://127.0.0.1:8092` to the websites of River Voices (REST, as the operator). Without them, the Annotate page does not send a member back to the host page. Run it again after a new demo stack or a recreated host container.

## Tell a story, as a member

1. Open http://localhost:8091/?pagename=demo. The widget shows the published stories.
2. Play or seek to a moment, for example 0:03. Select **Tell a story**. The Annotate page opens with Start = 0:03 and the link **← Back to the site**.
3. Sign in (next sections). An invite code needs no mail.
4. Type the End and the story. Select **Send for review**.
5. The browser goes back to the WordPress page. The widget is at 0:03 and shows "Your story is sent. It shows here after review." The story is not in the list yet: it waits for review.
6. As the operator, open the story in the admin (Today or Stories). "Told on" reads `localhost:8091`, with **Open on the site**. Select **Publish**. In one minute or less, the story shows in the widget on the WordPress page.

## Operator login

- Email: `operator@example.org`
- Password: `demo-operator-pass-1`

## Demo data

- Project **River Voices**: slug `river-voices`, websites `http://127.0.0.1:4620` (the embed fixture) and the four host origins above (from `install-plugins.sh`), sign-in **both** (login code or invite code; 5 invite codes, see below), rights statement **Other** with the text "Stories © their tellers, shared under CC BY 4.0" and the licence address `https://creativecommons.org/licenses/by/4.0/`, theme tokens `colorAccent` = `#0b6e4f` and `radius` = `12px`.
- Recording **Ferry crossing, 1962**: id `1`, URL `http://127.0.0.1:4610/media/tone.m4a`, duration 10 s.
- Concepts of River Voices: **Ferry**, **Horn**, **River** (IRIs `http://127.0.0.1:3500/vocab/river-voices/c/ferry`, `…/horn`, `…/river`).
- Stories: none when the stack is new. Run the seed (next section) to add them.

## Add demo stories (seed)

The seed adds three stories to recording 1, through the real Annotate page and the admin's **Publish** button:

| Member | Story | Range | Body | State |
|---|---|---|---|---|
| Leela (`leela@example.org`) | My grandmother sang this on the ferry. | 0:02–0:04 | text, topic Ferry | published |
| Leela | The ferry at the north landing. | 0:05–0:08 | text and a photo (640 × 400 JPEG) | published (the photo is ready in about 1 s) |
| Ravi (`ravi@example.org`) | The horn meant the last crossing. | 0:06–0:09 | text, topic Horn | waits for review |

Last run (2026-10-09, after Phase 5c): exit 0 in 6.5 s. Published IRIs: `…/stories/river-voices/1/01a12209-ae34-7eda-bdd8-8e0ef734be50` (Leela, text) and `…/01a12209-b431-70c6-b819-95b29a0e6070` (Leela, photo). The IRIs change at each new stack.

Run it from the repository root. It needs Playwright from `plugins/tests` one time (`cd plugins/tests && pnpm install`):

```sh
node deploy/test-hosts/seed-demo-stories.mjs
```

It is safe to run again: it skips a story whose text is already published or already saved by that member. It prints the IRIs of the published stories. Exit code 1 means a story is not published yet: usually the photo, which stays "Processing" until the app consumes the worker's result (`ANNOUDIO_MEDIA_CONSUMER=1` on the app; the app log then shows `[media] media.settled: <id> is ready.`). Run the seed again when the photo is ready.

## Sign in as a member

River Voices takes both ways to sign in (tab **Sign-in** of the project: "Both: a login code or an invite code"). Open the Annotate page (address above, or **Tell a story** on a host page). It shows the login code form first, with the link **Have an invite code?**.

### With an invite code (no mail needed)

1. Select **Have an invite code?**.
2. Type any email, for example `member@example.org`, and one of the codes below. Case, spaces and the hyphen do not matter.
3. On the first sign-in, type a name. Select **Continue**.

| Code | Label | Members per code | Last day |
|---|---|---|---|
| `D84N-Q2HW` | Demo | 50 | none |
| `EMNN-PQPD` | Demo | 50 | none |
| `88CB-V5QC` | Demo | 50 | none |
| `AF3S-ZXS5` | Demo | 50 | none |
| `YRNZ-PADE` | Demo | 50 | none |

Made on 2026-10-09 with **Make invite codes** on the project page (Chromium). The app keeps only a hash of each code: a new stack (after `down -v`) has none of these codes. Make new ones on the project page and write them here. `D84N-Q2HW` has 1 use already: the check member `invite-check@example.org` ("Invite check"). `EMNN-PQPD` has 1 use: the walk of `design/workflow-audit.md`, "After the fixes".

An invite code does not prove the email. So the app sends no mail (M2–M5) to a member who signed in only with an invite code; Your stories says so. After one sign-in with a login code, the email is verified and the mails go.

### With a login code (read it in Mailpit)

1. Type any email address, for example `member@example.org`. Click the button to send the code.
2. Open the mailbox, http://127.0.0.1:8025. You see the mail "Your login code: 123456". No mail leaves this computer: the stack sends all mail to Mailpit.
3. Type the code on the Annotate page.

An email that already signed in with a login code cannot sign in with an invite code ("This email signs in with a login code by email.").

## Operator mails

All operator mails also go to Mailpit:

- The daily review mail (the digest): at 08:00 in the time zone `TZ` of the stack. `deploy/demo.env` sets no `TZ`, so it is 08:00 UTC (13:30 in India). It comes only when a story or a reply waits for review (after the seed, Ravi's story waits). The operator gets it because its **Review mail** is "Once a day, at 08:00, when stories wait" (the default).
- The password-reset mail: click **Forgot password?** on the admin login screen.

To get the digest now, without waiting for 08:00, send one `mail.digest` job:

```sh
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.demo.yml \
  --env-file deploy/demo.env -p annoudio-demo exec -T -w /worker worker node --input-type=module -e "
import { PgBoss } from 'pg-boss';
const b = new PgBoss({ connectionString: process.env.DATABASE_URL, supervise: false, schedule: false });
await b.start(); await b.send('mail.digest', null); await b.stop();"
```

## Start, stop, delete

The stack is the compose project `annoudio-demo`. Always give the files with `-f`. Run these from the repository root.

Start it again (the data stays):

```sh
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.demo.yml \
  --env-file deploy/demo.env -p annoudio-demo up -d --wait
```

Stop it and keep the data:

```sh
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.demo.yml \
  --env-file deploy/demo.env -p annoudio-demo stop
```

Stop it and **delete all its data** (database and media). First run `docker compose ls` and make sure that you name `annoudio-demo`:

```sh
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.demo.yml \
  --env-file deploy/demo.env -p annoudio-demo down -v
```

## How it is made

- `deploy/docker-compose.demo.yml` adds to the production file: the prebuilt images `annoudio-app:demo` and `annoudio-worker:demo`, the app port `127.0.0.1:3500`, and Mailpit on `127.0.0.1:8025`.
- `deploy/demo.env` holds the settings. The values are for the demo only; never use them on a server.
- The images do not rebuild when the code changes. To use new code, build again: `docker build -f deploy/app.Dockerfile -t annoudio-app:demo .` and `docker build -t annoudio-worker:demo worker/`, then the start command above.
- The operator was made through the first-user screen (Chromium). The project and the recording were made through **Add a player** on Today (the REST API cannot make a recording since Phase 5c). The rights, the theme, the concepts and the sign-in mode were set through the REST API with that operator's login. The host websites come from `deploy/test-hosts/install-plugins.sh` (REST, same login). The invite codes were made on the project page (Chromium).

## Workflow recordings

`design/recordings/` holds 19 short videos (WebM, with a poster PNG and a caption each) of the workflows on this stack: the operator (01–09), the member on a phone (10–13), the visitor (14, 15), the operator who walks the member's steps from the preview page (16) and the site maintainer (17 WordPress block, 18 Omeka S block, 19 a hand-built page). `design/recordings/README.md` lists them and ends with an audit list of what did not work as a person would expect.

Record them again from the repository root, with the stack, the test hosts and the media fixture server running:

```sh
bash deploy/test-hosts/install-plugins.sh
node design/recordings/scripts/record-all.mjs          # add --gif for GIFs too
```

Each run adds data to this stack and deletes none: a member `asha.<run>@example.org` ("Asha") with text and voice-note stories, 3 invite codes labelled "Workshop 12 Oct", a WordPress post, an Omeka S page, and one website `http://127.0.0.1:<port>` on River Voices. The run of 2026-10-09 also added the question **Place** with the list **Places** (North landing, South landing), a member "Operator test" (`operator@example.org`, by invite code) and the websites `http://127.0.0.1:4791` and `http://127.0.0.1:4792`. The audit-fix round of the same day (13 recordings, on the audit-fix image) added the member `asha.fix1853@example.org` ("Asha"), the question **When it happened**, the items Old jetty and Ferry ghat in **Places**, and the website `http://127.0.0.1:4793`. The accent colour is put back to `#0b6e4f` after each run.
