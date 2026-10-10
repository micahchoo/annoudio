# HANDOFF

Date: 2026-10-09. Read STATUS.md first (first 5 lines = where we are), then this file.

## What Annoudio is

An embeddable audio annotation widget. One Docker stack per organisation (app + Postgres + worker).
Operators run everything from the Payload admin. Members tell stories about audio in a player
embedded on any site. See CONTEXT.md for the words, ROADMAP.md for the phases, design/ for the
decisions, research/architecture-concerns.md for the evidence.

## State of the build

All roadmap phases that an agent can do are built and verified by rerunning their suites:
0 scaffold, 1 `stories` + CONTRACT, 2 player, 3 membership + Annotate, 3b integration,
4a worker, 4b media, 5 admin tools, 5b replies, 5c lifecycle UX (per design/ia.md),
6 packaging, 6b re-package after 5c, 7a CMS plugins, 7b plugins use the recordings route,
and the closing pass (design/closing-notes.md). Nothing is in flight: every agent round is finished and its suites were rerun by the main session.

Suites (closing pass, 2026-10-09; commands and counts in design/closing-notes.md): app
`pnpm test:int` 279, `pnpm test:e2e` 58 (Chromium, muted), embed 293 + 4 skipped (Chromium,
Firefox, WebKit), worker 85; plugins 13 (rerun by the main session after 7b). `pnpm build` green in app, embed, worker.

## Git

Repo: https://github.com/micahchoo/annoudio (public, MIT). Commits e1b9be8, faf1f29, 388e464 (round 2), then the docs/ site. GitHub Pages serves docs/ on main at https://micahchoo.github.io/annoudio/ (rebuild with `node scripts/build-docs.mjs`). The owner commits; agents never do.

## How to run

- Dev: `docker compose -f deploy/docker-compose.dev.yml up -d --wait`; `cd app && pnpm dev`.
  Run `pnpm test:int` before `pnpm test:e2e` (the first rebuilds the test schema).
- Demo: deploy/DEMO.md (admin http://127.0.0.1:3500/admin, operator@example.org /
  demo-operator-pass-1, Mailpit http://127.0.0.1:8025).
- Player fixture: `cd embed && STACK_PORT=4610 HOST_PORT=4620 node tests/fixture/server.mjs`,
  then http://127.0.0.1:4620/bare.html.
- Test hosts (WordPress :8091, Omeka S :8092): deploy/test-hosts/.
- Production: deploy/GUIDE-dokploy.md or GUIDE-coolify.md.

## Rules that bite

- `.claude/rules/`: compose files MUST set `name:`; never run compose without `-f`; schema
  changes need a migration file (`migrate:create` has an interactive prompt — see the rule);
  app/public/embed is a build output of embed/ (keep two previous hash dirs); raw SQL in
  stories names Payload columns; only the plugins' `Stack` class knows stack routes.
- A project or a recording with stories or replies cannot be deleted (the admin says
  "Remove its N stories first"). A clean delete also removes its served representations and,
  for a project, its concepts.
- `ANNOUDIO_MEDIA_CONSUMER=1` must be set in production: it starts the media.settled and
  mail.digest consumers (deploy/tests/compose-check.sh checks it).

## Open after the agents finish

- Owner: commit; team trial on a staging copy; pilot site (ROADMAP Phase 7).
- Unverified: design/UNVERIFIED.md has every open item, by surface, with the cheapest check.
  The big ones: real Safari/iOS recording (the Phase 4 done-when test), the guides on a real
  Dokploy/Coolify server (the Phase 6 done-when test), Firefox on Linux without codecs.
- Deferred by design: cross-project sharing (storage keeps it open), Rauthy SSO, transcription,
  waveform precompute, ClamAV, member self-delete, standalone Next output (-600 MB image).

## Incident log

- 2026-10-09 00:0x: the Phase 0 agent's compose run (no `name:`) replaced papadam's
  `deploy-postgres-1`; restored; rule added.
- 2026-10-09 00:39–00:45: penpot, opencloud, omnitools and papadam containers were removed by
  something outside this session (no subagent transcript contains such a command). Volumes
  intact. Reported to the owner; not restored.
- The embed agent's Playwright 1.64 install removed cached chromium-1243 / firefox-1543.
