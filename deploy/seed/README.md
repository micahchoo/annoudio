# The seed: what a new stack has on its first start

A new stack starts with an empty database. On its first start, the app makes all the tables, and then the admin asks for the first operator. You do not run a seed script.

## What the stack makes by itself

| Item | Who makes it | When |
|---|---|---|
| The collections (`projects`, `recordings`, `concepts`, `stories`, `members`, `users` and the hidden ones) | The migrations in `app/src/migrations`. `deploy/app/entrypoint.sh` runs them before the server starts. | Each start. A migration that ran before does not run again. |
| The schema `pgboss` (the job queue) | The worker and the app, when they start. | Each start. |
| The folders `raw/`, `derived/`, `work/` in the `media` volume | The worker, at its first job. The service `media-init` gives the volume to the user `node`. | First job; each start. |

The collections come from code. An operator cannot add or remove a collection in the admin. This is intentional: CONTEXT.md, "the admin GUI is Payload's, preconfigured".

The stack makes no project, no recording and no concept. An operator makes them in the admin after the first sign-in (`design/phase0-operator-walkthrough.md`).

## The first operator: the first-user screen

Verified on 2026-10-09 with Payload 3.90.2 on the production image:

1. Open `https://<your address>/admin`.
2. The admin shows **Welcome** and the form **Create first user**: email, password, confirm password.
3. Type your email and a password with 12 or more characters. Click **Create**.
4. The admin signs you in. You are the first operator.

After the first operator exists, the screen does not show again. A second request to make a "first user" gets "You are not allowed to perform this action." (tested with the same API call that the form sends).

**Caution: do step 1 immediately after the first deploy.** Until the first operator exists, any person who finds the address can make the first operator. Payload has no setup token. If somebody else was first, delete the stack's volumes and deploy again.

Operators make more operators in the admin: **Users** → **Create New**.

## Optional: the CLI seed, for staging and tests

Use it when a script deploys the stack and nobody opens the first-user screen. It makes the first operator from two environment variables. It does nothing when an operator exists already.

The app image has the file at `deploy/first-operator.ts` (source: `deploy/seed/first-operator.ts`). Run it in the running app container:

```sh
docker compose -p <stack> exec \
  -e ANNOUDIO_FIRST_OPERATOR_EMAIL=ops@example.org \
  -e ANNOUDIO_FIRST_OPERATOR_PASSWORD='a long password' \
  app node node_modules/payload/bin.js run deploy/first-operator.ts
```

Output: `[seed] made the first operator: ops@example.org`, or `[seed] 1 operator(s) exist already. Nothing done.` Both were tested on 2026-10-09.

This needs a terminal, so it is not for operators. For a non-technical person, the first-user screen is easier and safer: no password goes into an environment variable or a shell history.

To add `pnpm seed` for developers later (owner of `app/`): add `"seed": "cross-env NODE_OPTIONS=--no-deprecation payload run ../deploy/seed/first-operator.ts"` to `app/package.json`. This file does not do it, because `app/` is outside the `deploy` module.
