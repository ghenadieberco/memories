# syntax=docker/dockerfile:1
#
# Memories — production image (implementation plan §11.4).
#
# Node 24 to match local development. The plan wrote node:20; pinning both ends
# to the same major removes "works on my machine" drift in the image pipeline,
# which is the one place a version gap is expensive to debug.

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Version shown in the footer (FR-VER-1, D28). Derived from git history by CI
# and passed in here, because `.git` is dockerignored — the build stage has no
# repository to read. Left unset (a local `fly deploy`, say) the app reports
# `0.0.0-dev`, which is the honest answer for an image CI never saw.
ARG APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
# Next builds without secrets present: lib/env.ts validates lazily, at first use.
RUN npm run build && npm run db:bundle-migrate

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user rather than root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migration bundle + SQL, used by fly.toml's release_command. Bundled at build
# time because the standalone output traces only what the app itself imports —
# the migrator and tsx are not in it.
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=build --chown=nextjs:nodejs /app/db/migrations ./db/migrations

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
