FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

# Install all dependencies (workspaces resolve locally)
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
COPY tsconfig.json ./

# Build shared package, then server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=builder /app/apps/server/dist/ ./apps/server/dist/
COPY packages/shared/package.json ./packages/shared/

EXPOSE 4000

CMD ["node", "apps/server/dist/index.js"]
