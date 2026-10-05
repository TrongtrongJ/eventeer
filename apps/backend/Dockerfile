# syntax=docker/dockerfile:1
# Build context: the repository root (see docker-compose.yml / k8s). Yarn 4 workspaces.

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Manifests first so the dependency layer is cached until package.json/yarn.lock change.
COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY .yarn ./.yarn
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/contract/package.json packages/contract/
COPY packages/shared-schemas/package.json packages/shared-schemas/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/prettier-config/package.json packages/prettier-config/
RUN yarn install --immutable

COPY packages ./packages
COPY apps/backend ./apps/backend
RUN yarn workspace @packages/shared-schemas build \
 && yarn workspace @packages/contract build \
 && yarn workspace @eventeer/api build
# Drop devDependencies from node_modules for the runtime image.
RUN yarn workspaces focus @eventeer/api --production

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/backend
RUN apk add --no-cache curl && addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/node_modules /app/node_modules
COPY --from=build --chown=nodejs:nodejs /app/packages/shared-schemas/package.json /app/packages/shared-schemas/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/shared-schemas/dist /app/packages/shared-schemas/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/contract/package.json /app/packages/contract/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/contract/dist /app/packages/contract/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/backend/package.json ./package.json
COPY --from=build --chown=nodejs:nodejs /app/apps/backend/dist ./dist

USER nodejs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fs http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
