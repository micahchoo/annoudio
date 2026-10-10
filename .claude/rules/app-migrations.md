---
scope: app/src/**
tags: [schema, migrations, deploy]
priority: high
source: hand-written
---
A change to the database schema needs a migration file. The schema changes when you
add, remove or rename a collection, a stored field, an index, a select option or a
`versions` setting (a `virtual: true` field stores nothing).

After the change, run `cd app && pnpm migrate:create <name>` with `DATABASE_URL` set,
and keep the new `.ts` and `.json` files in `app/src/migrations/` (with `index.ts`).
Check the SQL in the new file before you keep it. Never edit an applied migration;
make a new one.

Development pushes the schema (`push` is on when NODE_ENV is not production), so the
tests pass without a migration. Production never pushes: the app image runs
`payload migrate` before `next start` (deploy/app/entrypoint.sh). A missing migration
gives a broken production stack and green tests. Do not set `prodMigrations` in the
db adapter: the image runs the migrations once, under a lock.

Check a new migration on an empty database: create `annoudio_fresh_test` on the dev
Postgres, run `NODE_ENV=production pnpm migrate`, then `pnpm migrate:status`.

Hazards found in Phase 5:
- `migrate:create` asks "created or renamed?" in an interactive prompt for each new
  table or column. It needs a terminal; without one it waits for ever. Workaround (used
  for `vocab_profile`): give it a pseudo terminal and press Enter (the first choice,
  "create") a few times:
  `(for i in $(seq 1 40); do sleep 1.5; printf '\r'; done) | script -qec "DATABASE_URL=… pnpm migrate:create <name>" /dev/null`.
  Read the SQL after: a rename needs the second choice, which this gives never.
- The generated `down` drops a table with `CASCADE` and then drops the foreign keys of
  other tables to it, which fail. Use `DROP CONSTRAINT IF EXISTS` (as `vocab_profile`).
- The generated SQL never moves data. A changed field shape (for example an array
  that became a field) drops the old table before anything copies it. Add the data
  copy by hand, before the DROP, and test up and down with rows in the old shape.
- `pnpm migrate` with the `.env` database (the dev database, which `push` made) stops
  at a "dev mode" question. Use a new, empty database for the check.
