# Backup and restore of an Annoudio stack

This file does not depend on the tool that runs the stack. For the buttons, read `GUIDE-dokploy.md` or `GUIDE-coolify.md`. This file tells you what to keep, how often, and how to prove that a backup works.

## What you must back up

A stack keeps its data in three places. Lose one, and the restore is incomplete.

| Item | Holds | How to back up | If you lose it |
|---|---|---|---|
| Postgres (volume `pgdata`) | Operators, members, projects, recordings, concepts, stories, the job queue (`pgboss`) | `pg_dump` (a logical dump). **Never copy the volume files of a running database.** | All stories and accounts are gone. |
| The `media` volume | The raw uploads (`raw/`) and the served files (`derived/`) | A file archive (tar) of the volume | Stories stay, but their sound, image and video bodies do not play. |
| The settings (`.env`, or the Environment screen of the tool) | `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`, `ANNOUDIO_ORIGIN`, `SMTP_URL`, `EMAIL_FROM`, `TZ` (if set) | Copy the text into a password manager. Do it again after each change. | With a different `PAYLOAD_SECRET`, all sessions stop. With a different `ANNOUDIO_ORIGIN`, every story IRI is wrong. Without `TZ`, the review mail comes at 08:00 UTC. |

The code is in git. You do not back it up, but write down the release (git branch or commit) that runs.

## How often, and in which order

- Postgres: every day. Keep 14 days.
- `media`: every day, **after** the Postgres backup (for example Postgres at 02:00, `media` at 02:30).
- `.env`: after each change.
- Both, by hand, before each upgrade (`UPGRADE.md`).

Why this order: the app and the worker never change or delete a file in `media` (`raw/` stays for ever, a derived file never changes). So a `media` backup that is newer than the Postgres backup holds every file that the database names. The other order can lose the files of the last 30 minutes.

Why the containers can stay on during the `media` backup: the worker writes each derived file in `work/` and then renames it into `derived/`. The archive can contain a half-written file only in `work/` or `uploads/`, and the stack does not need those after a restore.

Keep the backups outside the server (S3 or another computer). A backup on the same disk is lost with the disk.

## The commands (for a person with a terminal)

Do these on the server, in the folder of the repository. `<stack>` is the project name of the stack (`docker compose ls` shows it; Dokploy and Coolify give their own name).

Back up Postgres. The format is the same as the Dokploy backup, so the two can restore each other:

```sh
docker compose -p <stack> exec -T postgres \
  pg_dump -Fc --no-acl --no-owner -U annoudio annoudio | gzip > annoudio-db-$(date +%F).dump.gz
```

Back up `media`:

```sh
docker run --rm -v <stack>_media:/volume_data:ro -v "$PWD":/backup alpine:3.24 \
  tar cf /backup/annoudio-media-$(date +%F).tar -C /volume_data .
```

Restore Postgres. Stop the app and the worker first, so nothing writes during the restore. Then empty the two schemas, and restore into the empty database:

```sh
docker compose -p <stack> stop app worker
docker compose -p <stack> exec -T postgres psql -v ON_ERROR_STOP=1 -U annoudio -d annoudio \
  -c 'DROP SCHEMA IF EXISTS pgboss CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c annoudio-db-2026-10-09.dump.gz | docker compose -p <stack> exec -T postgres \
  pg_restore -U annoudio -d annoudio -O --exit-on-error
docker compose -p <stack> start app worker
```

Do not use `pg_restore --clean` on a database that the stack has used. It fails on three tables of `pgboss` (the job queue uses partitioned tables) and exits with code 1. The data comes back, but the exit code hides real errors. (Tested on 2026-10-09; see `design/phase6-notes.md`.)

Restore `media` into a stopped stack. The volume must not be in use:

```sh
docker compose -p <stack> stop app worker
docker run --rm -v <stack>_media:/volume_data -v "$PWD":/backup alpine:3.24 \
  tar xf /backup/annoudio-media-2026-10-09.tar -C /volume_data
docker compose -p <stack> start app worker
```

The archive keeps the owner (uid 1000). If you restore with a tool that does not, the service `media-init` corrects the owner at the next start.

## The restore test

A backup that you did not restore is a hope, not a backup. Do this test once after the first setup, and then every three months. Do it on a second stack, never on the live stack.

1. Make a second stack from the same release, with the **same** `.env` values (also the same `ANNOUDIO_ORIGIN`). Give it a different domain in the tool, for example `restore-test.stories.example.org`. Do not deploy it yet.
2. Restore the newest `media` backup into the volume of the second stack.
3. Deploy the second stack. Wait until the app is healthy.
4. Restore the newest Postgres backup into the second stack (the commands above, or the Restore button of the tool).
5. Restart the app of the second stack.
6. Check these four things:
   - You can sign in to `/admin` with your operator account.
   - The number of stories in the admin (**Stories**) is the same as on the live stack, or a little lower (stories after the backup time are missing).
   - A sound body of a story plays: open `https://<second address>/media/<id>.m4a` for one body. (Phase 4b serves these files.)
   - `https://<second address>/stories/<project>/<recording>/` shows the published stories of one recording.
7. Write the date and the result in your operations log.
8. Delete the second stack and its volumes.

Note: the story IRIs and the Annotate links of the second stack still start with the live `ANNOUDIO_ORIGIN`. This is correct for a restore. Do not publish stories or sign in members on the test stack.

The second stack has the same `SMTP_URL`, so it can send real mail: the daily review mail at 08:00 goes to every operator who chose it. Delete the second stack before 08:00, or give it an `SMTP_URL` that goes nowhere useful (for example a test mailbox) for the test.
