# The local demo stack

A complete Annoudio stack on this computer, with demo data. Use it to look at the admin and the Annotate page. It is not a server setup: for that, read `GUIDE-dokploy.md`.

## Addresses

| What | Address |
|---|---|
| Admin | http://127.0.0.1:3500/admin |
| Annotate page for the demo recording | http://127.0.0.1:3500/annotate?project=river-voices&recording=1&return=http%3A%2F%2F127.0.0.1%3A4620%2Fbare.html |
| Stories of the recording (Web Annotation Protocol) | http://127.0.0.1:3500/stories/river-voices/1/ |
| Theme tokens of the project | http://127.0.0.1:3500/embed/v1/themes/river-voices.json |
| Player loader | http://127.0.0.1:3500/embed/v1.js |
| Mailbox (all mails of the stack) | http://127.0.0.1:8025 |

The return page (`127.0.0.1:4620/bare.html`) and the audio of the recording (`127.0.0.1:4610/media/tone.m4a`) are not part of this stack. They work only when the test host pages and the media fixture server run.

## Operator login

- Email: `operator@example.org`
- Password: `demo-operator-pass-1`

## Demo data

- Project **River Voices**: slug `river-voices`, site origin `http://127.0.0.1:4620`, rights statement **Other** with the text "Stories © their tellers, shared under CC BY 4.0" and the licence address `https://creativecommons.org/licenses/by/4.0/`, theme tokens `colorAccent` = `#0b6e4f` and `radius` = `12px`.
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

## Sign in as a member (read a login code)

1. Open the Annotate page (address above).
2. Type any email address, for example `member@example.org`. Click the button to send the code.
3. Open the mailbox, http://127.0.0.1:8025. You see the mail "Your login code: 123456". No mail leaves this computer: the stack sends all mail to Mailpit.
4. Type the code on the Annotate page.

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
- The operator was made through the first-user screen (Chromium). The project and the recording were made through **Add a player** on Today (the REST API cannot make a recording since Phase 5c). The rights, the theme and the concepts were set through the REST API with that operator's login.
