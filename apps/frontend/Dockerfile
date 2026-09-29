FROM node:22-alpine

WORKDIR /app

RUN corepack enable

# Copy root workspace files
COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY .yarn ./.yarn

# Copy workspace package.json files (for install caching)
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-schemas/package.json ./packages/shared-schemas/
COPY packages/contract/package.json ./packages/contract/

RUN yarn install --immutable

# Copy source code
COPY apps/frontend ./apps/frontend
COPY packages/shared-schemas ./packages/shared-schemas
COPY packages/contract ./packages/contract

# Build workspace dependencies (@packages/contract ships compiled dist/)
RUN yarn turbo run build --filter=@packages/contract

EXPOSE 3000

CMD ["yarn", "workspace", "@eventeer/web", "dev"]
