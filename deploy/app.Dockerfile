# syntax=docker/dockerfile:1
# The Annoudio app image: Payload CMS 3 (Next.js) with the player bundle.
#
# The build context is the repository root, because the image also builds embed/ and
# worker/ (the app imports the package `annoudio-worker` from ../worker).
# Build: docker build -f deploy/app.Dockerfile -t annoudio-app .
# The ignore file is deploy/app.Dockerfile.dockerignore (BuildKit reads it next to this file).
#
# Why not app/Dockerfile: it is the Payload template. It needs `output: 'standalone'`,
# which next.config.ts does not set; it uses Node 22, not 24; and `COPY . .` without a
# .dockerignore copies app/.env (the secret) and the host node_modules into the image.

ARG NODE_IMAGE=node:24.21.0-alpine3.24
ARG PNPM_VERSION=11.25.0

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# 1. The player: embed/ builds v1.js and v1/<hash>/player.js (CONTRACT 5).
# The committed app/public/embed goes in first, so the build keeps the two bundles
# before this one. A host page that has an old v1.js in its cache still loads.
FROM base AS embed
WORKDIR /src/embed
COPY embed/package.json embed/pnpm-lock.yaml embed/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY embed/ ./
COPY app/public/embed /out
RUN ANNOUDIO_EMBED_OUT=/out node scripts/build.mjs

# 2. The worker package, for the app's dependency `annoudio-worker: file:../worker`.
# The path /src/worker keeps ../worker correct from /src/app.
FROM base AS worker
WORKDIR /src/worker
COPY worker/package.json worker/pnpm-lock.yaml worker/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY worker/tsconfig.json worker/tsconfig.build.json ./
COPY worker/src src
RUN pnpm build && pnpm prune --prod

# 3. The app: install, build, then remove the development packages.
FROM base AS build
COPY --from=worker /src/worker /src/worker
WORKDIR /src/app
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml app/.npmrc ./
RUN pnpm install --frozen-lockfile
COPY app/ ./
COPY --from=embed /out public/embed
ENV NODE_ENV=production
# The build reads payload.config.ts, which checks these two values. They are placeholders
# for this one command only; the image never keeps them. The real values come at run time.
# The grep stops the build if a placeholder is in the build output (exit 1 = no match).
RUN ANNOUDIO_ORIGIN=https://build.invalid PAYLOAD_SECRET=build-placeholder pnpm build \
 && rm -rf .next/cache \
 && { grep -rlF -e build.invalid -e build-placeholder .next; test $? -eq 1; } \
 && pnpm prune --prod

# 4. The runtime: Node, the production packages and the build. No compiler, no pnpm.
# pnpm copies `annoudio-worker` into node_modules/.pnpm, so /src/worker is not needed here.
FROM ${NODE_IMAGE}
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    NODE_OPTIONS=--no-deprecation
WORKDIR /app
COPY --from=build --chown=node:node /src/app/package.json /src/app/next.config.ts ./
COPY --from=build --chown=node:node /src/app/node_modules node_modules
COPY --from=build --chown=node:node /src/app/.next .next
COPY --from=build --chown=node:node /src/app/public public
COPY --from=build --chown=node:node /src/app/src src
COPY --from=build --chown=node:node /src/app/tsconfig.json ./
# src/ and tsconfig.json are here for `payload run` and `payload migrate`: the CLI reads
# src/payload.config.ts and the migration files in src/migrations.
COPY --chown=node:node deploy/app/migrate.ts deploy/app/entrypoint.sh deploy/seed/first-operator.ts deploy/
USER node
EXPOSE 3000
CMD ["sh", "deploy/entrypoint.sh"]
