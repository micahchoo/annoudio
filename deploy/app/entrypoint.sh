#!/bin/sh
# The start command of the app image: first the migrations, then the server.
# The server starts only when every migration is done, so the healthcheck
# (GET /api/users/init) stays red until then.
set -e
node node_modules/payload/bin.js run deploy/migrate.ts
exec node node_modules/next/dist/bin/next start
