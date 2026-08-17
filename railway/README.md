# UmaKraft Discord Bot — Railway Deployment

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Single-stage build, tsx runs TS directly, no compile step |
| `.dockerignore` | Excludes node_modules, dist, .git, tests, artifacts |
| `health.cjs` | Dummy HTTP server on `$PORT` so Railway's TCP probe passes |

## Secrets (set in Railway Dashboard → Variables)

### Required

| Variable | Value |
|---|---|
| `DISCORD_BOT_TOKEN` | Your Discord bot token |
| `DISCORD_CLIENT_ID` | Your Discord application ID |
| `DISCORD_GUILD_ID` | Your Discord server (guild) ID |

### AI provider (pick one)

| Variable | Value |
|---|---|
| `AI_PROVIDER` | `groq` (or `openai` / `anthropic`) |
| `GROQ_API_KEY` | Comma-separated Groq keys: `key1,key2,key3` |
| `OPENAI_API_KEY` | OpenAI key — used as fallback when `AI_PROVIDER` is not `groq` |

### Web research (Feature 3 — `/ask` and `/agent` `search_web` tool)

| Variable | Value |
|---|---|
| `ANYSEARCH_API_KEY` | AnySearch API key (https://api.anysearch.com) |

### Fan tracker / uma.moe

| Variable | Value |
|---|---|
| `UMAMOE_API_KEY` | Your uma.moe API key |
| `UMAMOE_CIRCLE_ID` | Your uma.moe circle ID |

### Persistence (Features 1–5 — Turso)

| Variable | Value |
|---|---|
| `TURSO_URL` | Turso database URL (e.g. `libsql://db-name.turso.io`) |
| `TURSO_AUTH_TOKEN` | Turso auth token (from dashboard → Connect) |

### Optional

| Variable | Value |
|---|---|
| `PORT` | Leave empty (Railway sets this automatically) |
| `TZ` | Timezone for cron schedules (default `Asia/Manila`) |
| `MILESTONE_STATE_FILE` | Override milestone state file path (default `.cache/milestone-state.json`) |

## How to Deploy

1. Push this repo to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub repo
3. Set Root Directory to `/` (or point to `railway/Dockerfile` in settings)
4. Add the secrets above in Variables tab
5. Deploy

## How It Works

```
Railway probes $PORT (TCP)
    ↓
health.cjs → dummy HTTP server (200 OK)
    ↓
spawns → node_modules/.bin/tsx apps/discord/src/index.ts
    ↓
Discord Gateway (WebSocket)
    ↓
Turso (agent_tasks, scheduled_tasks, confirmations, notifications, conversation_memory) — persistent
anysearch.com (web research) — on demand
```

The bot doesn't expose an HTTP port itself — it connects OUT to Discord's Gateway.
Railway needs *something* listening on `$PORT` to consider the deployment healthy,
so `health.cjs` provides that while forwarding logs from the bot child process.

## Feature notes

The app splits the Discord entrypoint into focused modules (`bootstrap.ts`,
`gateway.ts`, `milestone-jobs.ts`, `reminder-jobs.ts`, `simulator.ts`) — all under
`apps/discord/src/`, which the Dockerfile copies wholesale. No Dockerfile change
is needed for the refactor; tsx runs `apps/discord/src/index.ts` directly.
