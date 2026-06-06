# syntax=docker/dockerfile:1
# ============================================================================
# zakuzaku-web — multi-stage build for the Next.js 15 "standalone" server.
#
# Layout: this Dockerfile lives in web/ and is built with `web/` as the context
# (the CI/CD does `docker build web/`). It uses pnpm via corepack.
#
#   deps    — restore node_modules from the frozen lockfile (best layer cache).
#   build   — compile the app. NEXT_PUBLIC_* are build-time only: they are baked
#             into the client bundle here, so they MUST be passed as --build-arg.
#   runner  — tiny non-root image running `node server.js` on port 8080.
#
# SERVER secrets (GITHUB_OAUTH_CLIENT_SECRET, etc.) are NEVER build args and are
# NOT in the image; they are injected at runtime by Cloud Run (secret-env). The
# server uses Application Default Credentials from the attached runtime service
# account — no JSON key is ever copied in.
# ============================================================================

FROM node:24-alpine AS base
# corepack ships the pinned pnpm version declared in package.json#packageManager.
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — install all dependencies from the immutable lockfile.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — produce .next/standalone with NEXT_PUBLIC_* baked in.
# ---------------------------------------------------------------------------
FROM base AS build
WORKDIR /app

# PUBLIC client config — baked into the browser bundle at build time.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID

# Promote build args to env so `next build` inlines them into the client bundle.
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID=$NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ---------------------------------------------------------------------------
# runner — minimal runtime image.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Run as the unprivileged "node" user that ships with the base image.
USER node

# The standalone output bundles a trimmed node_modules + server.js. Static assets
# and the public/ directory are not bundled, so copy them alongside.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 8080

CMD ["node", "server.js"]
