FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace package.json files
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared-schemas/package.json ./packages/shared-schemas/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/frontend ./apps/frontend
COPY packages/shared-schemas ./packages/shared-schemas
COPY turbo.json ./

# Build shared schemas
RUN cd packages/shared-schemas && pnpm build

# Expose Vite port
EXPOSE 5173

# Start Vite dev server
CMD ["pnpm", "--filter", "event-management-frontend", "dev", "--host", "0.0.0.0"]