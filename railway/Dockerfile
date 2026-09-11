# ── UmaKraft Discord Bot ─────────────────────────────────────────
# Railway deployment — single-stage, tsx runs TypeScript directly.
# A dummy HTTP server on $PORT keeps Railway's health probe happy.
# ─────────────────────────────────────────────────────────────────

FROM node:20-slim

# Native modules (better-sqlite3, sqlite3, node-llama-cpp) need build tools.
# (The image-report uses satori + @resvg/resvg-js — prebuilt binaries, no
# canvas/system libs needed.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make gcc g++ \
    && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_STRICT=0
RUN npm install -g pnpm@9.15.4 && pnpm config set package-manager-strict false

WORKDIR /app

# Copy the full workspace first so a change to ANY file invalidates the
# dependency-install layer and the main-patch below (prevents stale builds).
COPY . .

RUN pnpm install --no-frozen-lockfile

# Build all workspace packages to generate dist/ output for shared packages
RUN pnpm build

# Ensure the health server entrypoint is at /app/health.cjs
RUN if [ -f /app/railway/health.cjs ]; then cp /app/railway/health.cjs /app/health.cjs; fi

# ── Runtime ──
ENV NODE_ENV=production

# health.cjs → dummy HTTP server on $PORT + spawns the bot
CMD ["node", "health.cjs"]
