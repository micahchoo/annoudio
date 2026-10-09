# Run Annoudio with Coolify

The other choice to Dokploy. Coolify updates itself from its screens, but it has fewer backup and restore screens for a compose stack from git. Read `GUIDE-dokploy.md` first for the words, the settings and the first operator; this guide gives only the Coolify steps.

Checked against the Coolify v4 documentation (read on 2026-10-09). Not tested on a real Coolify server: every step is **Unverified** on a screen, and the words can be a little different.

## Install and deploy

1. Install Coolify on a server with 4 GB of memory (Coolify documentation, "Installation"). Point the A record of your domain to the server.
2. Open your project and environment. Click **+ New**. Choose **Public Repository** (or a Git App for a private repository). Paste the HTTPS address of the repository. Click **Check Repository**.
3. In **General > Build pipeline**, set **Build strategy** to **Compose**. Set:
   - **Branch**: the release, for example `release-1.0`
   - **Base Directory**: `/`
   - **Docker Compose Location**: `/deploy/docker-compose.yml`
4. Click **Save**. Look at **Docker Compose Content**: you see the services `app`, `worker`, `postgres`, `media-init`.
5. Open **Environment Variables**. Coolify made a line for each `${…}` in the compose file. The required ones (`POSTGRES_PASSWORD`, `PAYLOAD_SECRET`, `ANNOUDIO_ORIGIN`, `SMTP_URL`, `EMAIL_FROM`) are marked; Coolify does not deploy until they have values. Fill them in (see `GUIDE-dokploy.md`, step 1). Keep `TRUST_PROXY` at `1`. Set `TZ` to your time zone (for example `Asia/Kolkata`) if operators must get the daily review mail at 08:00 local time; without it, 08:00 UTC.
6. Open **Domains**. Click **Add domain**. Choose the service `app`. Type `https://stories.example.org:3000`. The `:3000` tells the Coolify proxy the port in the container; visitors still use the normal HTTPS port.
7. Click **Deploy**. Open **Deployment Logs** and wait. Then open the **Runtime Logs** of `app` and look for `[migrate] done` and `▲ Next.js`.
8. Immediately open `https://stories.example.org/admin` and make the first operator (`GUIDE-dokploy.md`, step 6).

## Back up

- **Media**: open the application, **Backups**, **Storage backups**, **Add**. Choose the volume that ends in `media` as **Backup target**. **Frequency**: `30 2 * * *`. Click **Create schedule**. Open the schedule, select **S3**, choose your S3 storage, **Enable S3**, **Save changes**. Keep **Archive behavior** at **Keep containers running** (why: `BACKUP.md`). Click **Back up now** and look at **Executions**.
- **Database**: **Gap.** Coolify's scheduled database backup is for Coolify databases and for a database inside a Service ("Docker Compose Empty" or one-click). The documentation does not say that it works for a database inside a git Compose application. Check the **Backups** page of the application for **Database backups**. If it is not there, use one of these:
  1. A person with a terminal runs the `pg_dump` command of `BACKUP.md` every day (or as a cron job on the server).
  2. Run Annoudio as Dokploy instead, which backs up a compose database from its screens.
- Never make a storage backup of the `pgdata` volume as your only database backup. A file copy of a running database can be broken.
- Keep the Environment Variables in the password manager.

## Restore

**Gap.** Coolify's storage backup page "does not provide a dashboard restore action" (Coolify documentation). Download the archive from **Executions** (**Download**), and restore with the commands of `BACKUP.md`. This needs a terminal on the server.

## Upgrade Annoudio

1. Make the backups of `UPGRADE.md`, "Before the upgrade".
2. In **General**, change **Branch** to the new release. Click **Save**, then **Deploy**.
3. The migrations run at the start of `app`. Look for `[migrate] done` in the **Runtime Logs**.
4. Do the five checks in `UPGRADE.md`.
5. To roll back: set the old branch, deploy, and restore the database backup if the upgrade ran a migration.

## Upgrade Coolify itself

**Settings → Updates**. Choose **Automatic updates** with an **Update frequency**, or check by hand. Make a Coolify instance backup first (Coolify documentation, "Instance backup").

## Unverified here

- How Coolify reads the optional limits in the compose file (`STORIES_PAGE_SIZE:` with no value). In plain Docker Compose, a name with no value is not set in the container, which is what the app needs. If Coolify makes an empty value from it, the app reads 0. Check the limits after the first deploy, or remove those lines from your copy.
- Whether Coolify keeps the project name `name: annoudio-prod` or uses its own. Coolify uses its own names for containers and volumes; the volume names in this guide can differ.
- That the one-time service `media-init` (it exits after a second) does not show as "failed" in Coolify.
