# Annoudio

Annoudio is an audio annotation player that a site embeds. An organisation hosts audio recordings. Members of its community tell **stories** about time ranges of a recording: text, a voice note, an image or a short video. Members can also reply to a story. Visitors see the stories in the player on the organisation's own site. The team of the organisation (the **operators**) reviews and publishes the stories in one admin, with no code.

One organisation runs one copy (one **stack**: app, Postgres, worker). [CONTEXT.md](CONTEXT.md) defines the words in this file.

## Why use it

- The stories are open data. Each story is a W3C Web Annotation, and the read API is the Web Annotation Protocol.
- A site needs only two lines (the **snippet**). The promise to those sites is [CONTRACT.md](CONTRACT.md).
- WordPress and Omeka S have a plugin that writes the snippet from a recording ID.
- Members sign in with a code by email. There is no password and no external account.
- The operators work only in the admin (Payload CMS).

## What is built

All phases that one developer can do alone are built and tested (2026-10-09). The status of each phase is in [ROADMAP.md](ROADMAP.md).

| Part | Folder | What it does |
|---|---|---|
| App | `app/` | The admin, the read API, the Annotate page (sign in, write, record, reply), the upload of media bodies, the mails |
| Player | `embed/` | `<annoudio-player>`: the stories on a waveform, in a shadow DOM. It builds to `app/public/embed/` |
| Worker | `worker/` | Checks and transcodes media bodies with ffmpeg; schedules the daily review mail |
| Plugins | `plugins/` | The WordPress block and the Omeka S module |
| Deploy | `deploy/` | The production compose file, the app image, the guides, the demo stack |

Not built yet, because they need people: the team trial and the pilot on a real site (ROADMAP Phase 7). The items that no test has checked yet are in [design/UNVERIFIED.md](design/UNVERIFIED.md).

## How to run it

### Try the production stack on your computer

You need Docker with compose. Always give the compose files with `-f`.

```sh
cp deploy/.env.example deploy/.env        # then set the values
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.override.example.yml up -d --build --wait
```

Then open http://localhost:3000/admin and make the first operator.

A ready demo with data and a mailbox for login codes: [deploy/DEMO.md](deploy/DEMO.md).

### Run it on a server

| Way | For | Read |
|---|---|---|
| Dokploy (recommended) | An organisation, on its own server, with screens for backup and restore | [deploy/GUIDE-dokploy.md](deploy/GUIDE-dokploy.md) |
| Coolify | An organisation that already uses Coolify | [deploy/GUIDE-coolify.md](deploy/GUIDE-coolify.md) |

For both, also read [deploy/BACKUP.md](deploy/BACKUP.md), [deploy/UPGRADE.md](deploy/UPGRADE.md), [deploy/seed/README.md](deploy/seed/README.md) and [deploy/.env.example](deploy/.env.example) (every setting, with one line each).

### Change the code

1. Start the development Postgres: `docker compose -f deploy/docker-compose.dev.yml up -d --wait`.
2. Start the app: `cd app && cp .env.example .env && pnpm install && pnpm dev` (set the values in `.env` first; [app/README.md](app/README.md) tells each one). Then open http://localhost:3000/admin.
3. Run the tests of each part. The exact commands and the last counts are in [design/closing-notes.md](design/closing-notes.md). In `app/`, run `pnpm test:int` before `pnpm test:e2e`: the first one makes the test schema again.

Each part has its own README: [app/README.md](app/README.md), [embed/README.md](embed/README.md), [worker/README.md](worker/README.md), [plugins/README.md](plugins/README.md).

## Where the docs are

| File | Read it for |
|---|---|
| [CONTEXT.md](CONTEXT.md) | The words, the fixed decisions and the module map. Read it first |
| [CONTRACT.md](CONTRACT.md) | The snippet, the player attributes and tokens, the public routes |
| [ROADMAP.md](ROADMAP.md) | The phases and the status of each |
| [HANDOFF.md](HANDOFF.md) | The state of the build, the rules that bite, what is open |
| `design/` | One notes file for each phase (`phaseN-notes.md`), the interface designs, the IA (`ia.md`), [design/UNVERIFIED.md](design/UNVERIFIED.md) |
| `research/` | The research notes behind the decisions |
| `.claude/rules/` | Rules for one folder each, for example "a schema change needs a migration" |
