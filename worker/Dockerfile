# The Annoudio media worker: Node 24 and ffmpeg 8 on Alpine 3.24.
# Build: docker build -t annoudio-worker worker/
# Run:   docker run -e DATABASE_URL=... -e MEDIA_DIR=/media -v media:/media annoudio-worker

FROM node:24.21.0-alpine3.24 AS build
WORKDIR /worker
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN pnpm build && pnpm prune --prod

FROM node:24.21.0-alpine3.24
# Alpine 3.24 gives ffmpeg 8.1 with libx264, libwebp and the native AAC encoder.
RUN apk add --no-cache ffmpeg
WORKDIR /worker
ENV NODE_ENV=production
COPY --from=build /worker/package.json ./
COPY --from=build /worker/node_modules node_modules
COPY --from=build /worker/dist dist
USER node
CMD ["node", "dist/main.js"]
