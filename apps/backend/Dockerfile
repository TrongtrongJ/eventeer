# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-schemas/package.json ./packages/shared-schemas/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/shared-schemas/node_modules ./packages/shared-schemas/node_modules

# Copy source code
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend
COPY packages/shared-schemas ./packages/shared-schemas
COPY turbo.json ./

# Build shared schemas first
WORKDIR /app/packages/shared-schemas
RUN pnpm build

# Build backend
WORKDIR /app/apps/backend
RUN pnpm build

# Stage 3: Development
FROM node:20-alpine AS development
WORKDIR /app

# Install pnpm and development tools
RUN npm install -g pnpm && \
    apk add --no-cache curl

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/shared-schemas/node_modules ./packages/shared-schemas/node_modules

# Copy source and built shared schemas
COPY --from=builder /app/packages/shared-schemas/dist ./packages/shared-schemas/dist
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend
COPY packages/shared-schemas ./packages/shared-schemas

WORKDIR /app/apps/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start in development mode
CMD ["pnpm", "dev"]

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared-schemas/dist ./packages/shared-schemas/dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/apps/backend/package.json ./package.json

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start application
CMD ["node", "dist/main.js"]