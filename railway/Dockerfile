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

RUN npm install -g pnpm@9.0.5

WORKDIR /app

# Copy EVERYTHING first so a change to any file invalidates all subsequent
# layers — this guarantees `pnpm install` + the `sed` main-patch below always
# re-run, preventing stale-build bugs where source changes were silently ignored.
COPY . .

RUN pnpm install --no-frozen-lockfile

# Patch "main" to run TypeScript via tsx (replaces ./dist/*.js → ./src/*.ts).
RUN find packages apps -maxdepth 4 -name package.json \
    -exec sed -i 's|"main": "./dist/index.js"|"main": "./src/index.ts"|g' {} \;

# ── Runtime ──
ENV NODE_ENV=production

# health.cjs → dummy HTTP server on $PORT + spawns the bot
CMD ["node", "health.cjs"]
