# Run Annoudio with Dokploy

This guide is for a person who is not a developer. It tells you how to put one Annoudio stack on a server, keep backups, restore them and upgrade. You use the Dokploy web screens only, except where a step says **Gap**.

Words: a **stack** is the three parts of Annoudio that run together: `app` (the admin and the public pages), `postgres` (the database) and `worker` (it converts uploaded sound, image and video). An **operator** is a person of your team who uses the admin.

Checked against Dokploy v0.30.8 (2026-09-29): the documentation and the source code of its screens. A step marked **Unverified** was not checked on a real Dokploy server. Its words can be a little different on your screen.

## What you need

- A server (VPS) with **4 GB of memory** and 40 GB of disk, with Ubuntu or Debian. Dokploy needs 2 GB for itself; Annoudio needs up to 2 GB (limits: app 768 MB, worker 768 MB, Postgres 512 MB). The first build of the app also needs memory (see "Known gaps").
- Dokploy on the server. Install: log in to the server once and run `curl -sSL https://dokploy.com/install.sh | sh`. Then open `http://<server IP>:3000` and make the Dokploy admin account. (This is the only terminal step, and it is Dokploy's own.)
- A domain name, for example `stories.example.org`, with an **A record** to the IP address of the server.
- A mail account that can send mail (SMTP). The app sends all its mail with it: the login codes and story mails for members, and the daily review mail (the digest) and the password-reset mail for operators.
- An S3 bucket for backups (Amazon S3, Backblaze B2, Cloudflare R2 or another), with an access key and a secret key.
- A password manager.

## 1. Make the settings

Make these five values before you start. Keep them in the password manager. You need them again for every restore.

| Name | Value |
|---|---|
| `POSTGRES_PASSWORD` | A new random value, letters and digits only, 32 characters. |
| `PAYLOAD_SECRET` | A new random value, letters and digits only, 64 characters. |
| `ANNOUDIO_ORIGIN` | `https://` and your domain, for example `https://stories.example.org`. No `/` at the end. |
| `SMTP_URL` | From your mail provider, in this form: `smtps://USER:PASSWORD@smtp.example.org:465` |
| `EMAIL_FROM` | The sender, for example `River Voices <stories@example.org>` |
| `TZ` | Optional. Your time zone, for example `Asia/Kolkata`. Operators get the daily review mail at 08:00 in this time zone. Without it: 08:00 UTC. |

Do not change `ANNOUDIO_ORIGIN` or `PAYLOAD_SECRET` after the first story. Every story address starts with `ANNOUDIO_ORIGIN`.

## 2. Make the Compose service

1. You see the Dokploy dashboard with **Projects**. Click **Create Project**. Type the name `Annoudio`. Click **Create**.
2. You see the empty project. Click **Create Service**, then **Compose**. (Unverified: the exact button names.)
3. You see a form. Type the name `annoudio`. For **Compose Type**, keep **Docker Compose** (not **Stack**: Stack cannot build images). Click **Create**.
4. You see the page of the new service, with tabs: General, Environment, Domains, Deployments, Backups, Schedules, Volume Backups, Logs, Monitoring, Advanced.
5. On **General**, in **Provider**, click **Git**. Fill in:
   - **Repository URL**: the HTTPS address of the Annoudio repository.
   - **Branch**: the release to run, for example `release-1.0`.
   - **Compose Path**: `./deploy/docker-compose.yml`
6. Click **Save**.

If your repository is private, use **GitHub** (or GitLab, Gitea, Bitbucket) instead of **Git**, and connect the account first in **Settings → Git**. (Unverified for this guide.)

## 3. Set the environment

1. Click the tab **Environment**. You see a text box.
2. Paste these lines, with your values from step 1:

   ```
   POSTGRES_PASSWORD=...
   PAYLOAD_SECRET=...
   ANNOUDIO_ORIGIN=https://stories.example.org
   SMTP_URL=smtps://USER:PASSWORD@smtp.example.org:465
   EMAIL_FROM=River Voices <stories@example.org>
   TRUST_PROXY=1
   TZ=Asia/Kolkata
   ```

   `TRUST_PROXY=1` tells the app that one proxy (the Traefik of Dokploy) is in front of it. If you also put Cloudflare in front, use `2`.

   `TZ` is your time zone (the names are in the "TZ identifier" column of the IANA list, for example `Europe/London`). Leave the line out for UTC.
3. Click **Save**.

Dokploy writes these lines to the file `deploy/.env` next to the compose file. The compose file reads them from there. The full list, with the optional limits, is in `deploy/.env.example`. Do not add a line with an empty value (for example `STORIES_PAGE_SIZE=`): the app reads an empty value as 0.

## 4. Set the domain and HTTPS

1. Click the tab **Domains**. Click **Add Domain**.
2. You see the form **Domain**. Fill in:
   - **Service Name**: `app`
   - **Host**: your domain, for example `stories.example.org`
   - **Path**: `/`
   - **Container Port**: `3000`
   - **HTTPS**: on
   - **Certificate Provider**: **Let's Encrypt**
3. Click **Create**.

Add a domain only for `app`. Never for `postgres` or `worker`.

## 5. Deploy

1. Click the tab **General**. Click **Deploy**. Click **Confirm** in the question "Are you sure you want to deploy this compose?".
2. Click the tab **Deployments**. You see a new line with a running status. Click it to see the log. The first build takes 5 to 15 minutes.
3. When the line shows done, click the tab **Logs**. Choose the service `app`. You see, in this order: `[migrate] waiting for the migration lock`, `Migrating: …`, `Migrated: …`, `[migrate] done`, then `▲ Next.js`. The app made the database tables.
4. Wait 10 seconds more, so Traefik can get the HTTPS certificate.

Never click **Deploy with Fresh Volumes** (in the menu next to **Deploy**). It deletes the database and all media, with no question about backups.

## 6. Make the first operator

Do this **immediately** after the first deploy. Until the first operator exists, any person who finds the address can make it.

1. Open `https://stories.example.org/admin`.
2. You see **Welcome** and the form **Create first user**.
3. Type your email and a password with 12 or more characters, two times. Click **Create**.
4. You see the admin. You are signed in.

To add more operators: in the admin, click **Users**, then **Create New**.

An operator who forgets the password clicks **Forgot password?** on the login screen. The app sends a reset link to that address through `SMTP_URL`.

If somebody else made the first operator before you: delete the service with its volumes, and start again at step 2.

## 7. Connect the S3 bucket

1. In the left menu, click **Settings**, then **S3 Destinations**.
2. Click **Add Destination**. Fill in **Name** (for example `backups`), **Access Key**, **Secret Key**, **Bucket**, **Region** and **Endpoint** (from your S3 provider).
3. Click **Test**. You see a success message. If not, correct the values.
4. Click **Create**.

## 8. Back up the database every day

1. Open the `annoudio` service. Click the tab **Backups**. The stack must run: the screen says "Make sure the compose is running before creating a backup."
2. Click **Create Backup**. Fill in:
   - **Database Type**: **PostgreSQL**
   - **Destination**: `backups`
   - **Service Name**: `postgres`
   - **Database**: `annoudio`
   - **Database User**: `annoudio`
   - **Schedule**: `0 2 * * *` (every day at 02:00, server time)
   - **Prefix Destination**: `db/`
   - **Keep the latest**: `14`
   - **Enabled**: on
3. Click **Create**.
4. You see the new backup in the list. Click **Run Manual Backup**. You see "Manual Backup Successful". Look in the S3 bucket: you see a file that ends in `.sql.gz`.

Dokploy makes the file with `pg_dump -Fc` and gzip. That is the same format as in `BACKUP.md`.

## 9. Back up the media every day

1. Click the tab **Volume Backups**. Click **Add Volume Backup**.
2. Fill in:
   - **Task Name**: `media`
   - **Destination**: `backups`
   - **Service Name**: `worker`
   - **Volumes**: choose the name that ends in `_media`. It is `<app name>_media`; the app name is the name that Dokploy gave the service, for example `annoudio-annoudio-a1b2c3_media`.
   - **Schedule**: `30 2 * * *` (30 minutes after the database backup)
   - **Backup Prefix**: `media/`
   - **Keep Latest Backups**: `14`
   - **Turn Off Container During Backup**: off
   - **Enabled**: on
3. Click **Create**. (Unverified: the exact names of the schedule field and the button.)
4. Run it one time by hand and look for a file `…_media-<date>.tar` in the bucket.

Why 30 minutes after the database, and why the container can stay on: read `BACKUP.md`, "How often, and in which order".

Never choose a volume that ends in `_pgdata` here. A file copy of a running database can be broken. Step 8 backs up the database correctly.

## 10. Keep the settings

Copy the text of the **Environment** tab into the password manager. Do it again after each change. A backup without these values cannot be restored correctly.

Also turn on Dokploy's own backup: **Settings → Web Server → Backups** (it saves the Dokploy settings, not Annoudio's data).

## 11. Restore

Choose the case.

### Case A: only the database is wrong (for example, a person deleted many stories)

1. Choose a quiet time. Stories written after the backup are lost.
2. Open the `annoudio` service, tab **Backups**. Click **Restore Backup**.
3. Fill in: **Destination** `backups`; **Search Backup Files**: choose the newest correct file in `db/`; **Database Name** `annoudio`; **Database Type** PostgreSQL; **Service Name** `postgres`; **Database User** `annoudio`.
4. Click **Restore**. Read the log.
5. The log can show three errors with `pgboss.queue_stats_…` or `pgboss.job_common` in them, and "errors ignored on restore: 3". This is expected: the job queue uses a table type that the Dokploy restore command cannot empty first. The data comes back. (Tested with the same command on 2026-10-09. Unverified: whether Dokploy then shows the restore as failed.) Any other error is a real error.
6. Click the tab **General**, then **Deploy**, so the app and the worker start again on the restored data.
7. Open `/admin` and look at **Stories**.

### Case B: the server is lost, or the media volume is damaged

You make a new service and restore into it. The old service (if it still exists) stays as it is until the new one works.

1. On the new server (or the same one), install Dokploy and connect the S3 bucket (step 7).
2. Make a new Compose service (step 2) and set the **same** environment (step 3, the values from the password manager). **Do not deploy yet.**
3. Find the app name of the new service (on its General tab). The media volume will be `<new app name>_media`.
4. Tab **Volume Backups**, click **Restore Volume Backup**. Fill in: **Destination** `backups`; the newest file in `media/`; **Volume Name** `<new app name>_media`. Click **Restore**.

   This works only before the first deploy. Dokploy refuses to restore into a volume that a container uses, also a stopped container ("Volume restore aborted - volume is in use").
5. Deploy (step 5). Wait until `app` is healthy.
6. Restore the database as in Case A, steps 2 to 6, on the new service.
7. Move the domain: remove it from the old service (if it exists), add it to the new service (step 4), and deploy the new service again.
8. Check: sign in to `/admin`; a player on your site shows its stories.

**Gap:** Dokploy cannot restore the media volume into the running stack in place. Case B is the screen-only way. With a terminal, `BACKUP.md` has the commands.

### Test the restore

Do Case B on a second service every three months, with a test domain. Read "The restore test" in `BACKUP.md`.

## 12. Upgrade Annoudio

Read `UPGRADE.md` first. In Dokploy:

1. Make a backup now: tab **Backups**, **Run Manual Backup**; tab **Volume Backups**, run the `media` backup by hand.
2. Write down the branch that runs now (tab **General**, **Branch**).
3. Tab **General**: change **Branch** to the new release, for example `release-1.1`. Click **Save**.
4. Click **Deploy**, then **Confirm**.
5. Tab **Deployments**: wait until the new line is done.
6. Tab **Logs**, service `app`: look for `[migrate] done` and then `▲ Next.js`. The migrations run by themselves at each start.
7. Do the five checks in `UPGRADE.md`, "After the upgrade".

### Roll back

1. Tab **General**: set **Branch** back to the release that you wrote down. Click **Save**, then **Deploy**.
2. If the upgrade log showed a `Migrated:` line: restore the backup of step 1 (section 11, Case A).

## 13. Upgrade Dokploy itself

Dokploy shows **Update Available** when there is a new version. Click it, or go to **Settings → Web Server**, and click **Check for updates**. Read the release notes first. (Unverified: the menu path. The source has the dialog "Web Server Update" with "Check for updates".) The Dokploy documentation also gives the terminal way: `curl -sSL https://dokploy.com/install.sh | sh -s update`.

Dokploy is not yet at version 1.0. Upgrade it on a test server first, then on the server of your stack.

## Known gaps

- **First build memory (Unverified).** Dokploy builds the app image on the server. A Next.js build can need more than 2 GB. On a 4 GB server it is close. If the build stops with "killed" or exit code 137, add 2 GB of swap to the server, or build the images elsewhere (see `design/phase6-notes.md`).
- **Media restore in place** is not possible from the screens (section 11, Case B).
- **Database restore log** shows three expected errors (section 11, Case A).
- **Mail delivery** (SPF, DKIM) is the setup of your mail provider. If the login codes do not arrive, the reset links and the daily review mail do not arrive either. The log of `app` shows each failed send.
