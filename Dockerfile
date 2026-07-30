# ── Build stage ──
FROM node:20-slim AS builder

RUN npm install -g pnpm@9.0.5

WORKDIR /app

# Copy workspace config first (layer caching)
COPY pnpm-workspace.yaml package.json tsconfig.json turbo.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/ai/package.json packages/ai/tsconfig.json packages/ai/
COPY packages/core/package.json packages/core/tsconfig.json packages/core/
COPY packages/tools/package.json packages/tools/tsconfig.json packages/tools/
COPY packages/integrations/package.json packages/integrations/tsconfig.json packages/integrations/
COPY packages/domains/fan-tracker/package.json packages/domains/fan-tracker/tsconfig.json packages/domains/fan-tracker/
COPY packages/domains/pr-monitor/package.json packages/domains/pr-monitor/tsconfig.json packages/domains/pr-monitor/
COPY apps/api/package.json apps/api/tsconfig.json apps/api/

# Install dependencies (uses committed lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/src packages/shared/src
COPY packages/ai/src packages/ai/src
COPY packages/ai/providers packages/ai/providers
COPY packages/ai/embeddings packages/ai/embeddings
COPY packages/ai/prompts packages/ai/prompts
COPY packages/ai/routing packages/ai/routing
COPY packages/ai/structured-output packages/ai/structured-output
COPY packages/core/src packages/core/src
COPY packages/tools/src packages/tools/src
COPY packages/tools/filesystem packages/tools/filesystem
COPY packages/tools/web packages/tools/web
COPY packages/tools/notifications packages/tools/notifications
COPY packages/integrations/src packages/integrations/src
COPY packages/domains/fan-tracker/src packages/domains/fan-tracker/src
COPY packages/domains/pr-monitor/src packages/domains/pr-monitor/src
COPY apps/api/src apps/api/src
COPY apps/api/package.json apps/api/

# Build all packages
RUN pnpm build

# ── Production stage ──
FROM node:20-slim

WORKDIR /app

# Copy built output and runtime deps
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/apps apps
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/tsconfig.json tsconfig.json

ENV NODE_ENV=production
ENV PORT=3000

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Run compiled output, not TypeScript source
CMD ["node", "--enable-source-maps", "apps/api/dist/index.js"]
