# Upgrade an Annoudio stack

This file does not depend on the tool that runs the stack. For the buttons, read `GUIDE-dokploy.md` or `GUIDE-coolify.md`.

## What an upgrade is

An upgrade = get the new release from git, then redeploy. The tool builds the two images again and starts new containers. The data stays in the volumes.

At each start, the app runs the database migrations before the server starts (`deploy/app/entrypoint.sh`). A migration changes the tables to agree with the new release. A migration that ran before does not run again. While the migrations run, the healthcheck is red and the old containers are already stopped, so the site is down for that time (usually seconds).

You do not run a command for the migrations. You do not change the volumes.

## Before the upgrade

1. Read the release notes of the new release. Look for the words "manual step" and "breaking".
2. Make a Postgres backup and a `media` backup now, by hand (`BACKUP.md`). Write down the file names. This is your way back.
3. Write down the release that runs now (the git branch or commit). This is the release for a rollback.
4. Choose a quiet time. Members who write a story during the upgrade can lose it.

## The upgrade

1. In the tool, change the git branch to the new release, or pull the newest commit of the branch.
2. Click Deploy (Redeploy).
3. Watch the deployment log. The build takes some minutes.
4. Open the log of the `app` service. Look for these lines, in this order:
   - `[migrate] waiting for the migration lock`
   - `Migrating: <name>` and `Migrated: <name>`, one pair for each new migration (or no pair, if the release has no new migration)
   - `[migrate] done`
   - `▲ Next.js` and then `Ready`

## After the upgrade: check

Do all five checks. Each takes less than a minute.

1. The tool shows `app` as healthy, and `worker` and `postgres` as running.
2. `https://<your address>/admin` opens, and you can sign in.
3. `https://<your address>/embed/v1.js` opens and shows JavaScript.
4. A page on your site with a player shows its stories.
5. The log of `worker` shows `[media worker] started`, then `[media worker] the review mail is on the schedule: 08:00 <time zone>`, and no error after it. The time zone is the `TZ` of your settings (UTC if you did not set it).

## Roll back

Do this when a check fails and you cannot fix it in 15 minutes.

**The rule: a migration does not run backward.** The old release cannot always read the tables of the new release. So a rollback is two steps: the old code and the old database.

1. In the tool, change the git branch back to the release that you wrote down. Click Deploy.
2. If the upgrade ran a migration (look for `Migrated:` in the upgrade log): restore the Postgres backup that you made before the upgrade (`BACKUP.md`, or the Restore button of the tool). Then restart `app`.
3. Do the five checks again.

Stories that members wrote between the backup and the rollback are lost. That is why you upgrade at a quiet time.

You do not need to restore `media` for a rollback: an upgrade does not change the files in it.

## Release notes: the lifecycle release (migration `20261009_163307_phase5c_lifecycle`)

No manual step. It is not breaking: the migration only adds columns and fills one of them.

- The app now sends mail to operators through the same `SMTP_URL`: a daily review mail at 08:00, and a password-reset mail from **Forgot password?** on the login screen. Before this release, a reset link went only to the log.
- New optional setting `TZ` (for example `Asia/Kolkata`): the time zone of the 08:00 review mail and of the dates that the app writes. Without it: UTC. Add it on the Environment screen before you deploy, or later and then redeploy.
- `ANNOUDIO_MEDIA_CONSUMER` stays as it is. It now also starts the consumer of the review mail. The compose file sets it; you do not.
- A rollback to the release before this one needs the database restore (the migration added columns).

## Rules for the people who make releases

- Every change to a collection ships with its migration in `app/src/migrations` (`pnpm payload migrate:create <name>`). Without it, the new release starts on the old tables and fails.
- Do not set `prodMigrations` in `payload.config.ts`. The entrypoint runs the migrations under a lock. `prodMigrations` would run them again in each app process, without the lock.
- A migration that deletes or renames a column is a breaking change. Say so in the release notes.
- Name each release as a git branch or tag that never moves, for example `release-1.2`. A rollback needs the old name.
