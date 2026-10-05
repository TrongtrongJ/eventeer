# syntax=docker/dockerfile:1
# Build context: the repository root. Produces a minimal Next.js standalone server.

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY .yarn ./.yarn
COPY apps/frontend/package.json apps/frontend/
COPY apps/backend/package.json apps/backend/
COPY packages/contract/package.json packages/contract/
COPY packages/shared-schemas/package.json packages/shared-schemas/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/prettier-config/package.json packages/prettier-config/
RUN yarn install --immutable

COPY packages ./packages
COPY apps/frontend ./apps/frontend

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they are build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WS_URL=http://localhost:4000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN yarn workspace @packages/shared-schemas build \
 && yarn workspace @packages/contract build \
 && yarn workspace @eventeer/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache curl && addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# `output: 'standalone'` (outputFileTracingRoot = repo root) nests the app under apps/frontend.
COPY --from=build --chown=nodejs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fs http://localhost:3000/ || exit 1

CMD ["node", "apps/frontend/server.js"]
