# ── UmaKraft Discord Bot ──────────────────────────────────
# Railway deployment — single-stage, tsx runs TypeScript directly.
# A dummy HTTP server on $PORT keeps Railway's health probe happy.
# ───────────────────────────────────────────────────────────

FROM node:20-slim

# Native modules (sqlite3) need build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make gcc g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9.0.5

WORKDIR /app

# ── Layer 1: workspace config (install dependencies) ──────
COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json turbo.json package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json     packages/shared/
COPY packages/ai/package.json packages/ai/tsconfig.json             packages/ai/
COPY packages/core/package.json packages/core/tsconfig.json         packages/core/
COPY packages/tools/package.json packages/tools/tsconfig.json       packages/tools/
COPY packages/integrations/package.json packages/integrations/tsconfig.json  packages/integrations/
COPY packages/domains/fan-tracker/package.json                      packages/domains/fan-tracker/
COPY packages/domains/pr-monitor/package.json                       packages/domains/pr-monitor/
COPY apps/discord/package.json apps/discord/tsconfig.json           apps/discord/

RUN pnpm install --no-frozen-lockfile

# ── Layer 2: source code (copy only directories with content) ─
COPY packages/shared/src/         packages/shared/src/
COPY packages/ai/src/             packages/ai/src/
COPY packages/core/src/           packages/core/src/
COPY packages/tools/src/          packages/tools/src/
COPY packages/integrations/src/   packages/integrations/src/
COPY packages/domains/fan-tracker/src/ packages/domains/fan-tracker/src/
COPY packages/domains/pr-monitor/src/  packages/domains/pr-monitor/src/
COPY apps/discord/src/            apps/discord/src/
COPY railway/health.js            ./

# ── Layer 3: patch "main" for tsx ─────────────────────────
# All workspace packages export "./dist/index.js" (compiled JS).
# We run TypeScript directly via tsx, so point "main" at src.
RUN find packages apps -maxdepth 4 -name package.json \
    -exec sed -i 's|"main": "./dist/index.js"|"main": "./src/index.ts"|g' {} \;

# ── Runtime ────────────────────────────────────────────────
ENV NODE_ENV=production

# health.js → dummy HTTP server on $PORT + spawns the bot
CMD ["node", "health.js"]
