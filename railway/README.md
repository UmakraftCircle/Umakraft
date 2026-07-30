# UmaKraft Discord Bot — Railway Deployment

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Single-stage build, tsx runs TS directly, no compile step |
| `.dockerignore` | Excludes node_modules, dist, .git, tests, artifacts |
| `health.js` | Dummy HTTP server on `$PORT` so Railway's TCP probe passes |

## Secrets (set in Railway Dashboard → Variables)

| Variable | Value |
|---|---|
| `DISCORD_BOT_TOKEN` | Your Discord bot token |
| `DISCORD_CLIENT_ID` | Your Discord application ID |
| `DISCORD_GUILD_ID` | Your Discord server (guild) ID |
| `UMAMOE_API_KEY` | Your uma.moe API key |
| `UMAMOE_CIRCLE_ID` | Your uma.moe circle ID |
| `TURSO_URL` | Turso database URL (e.g. `libsql://db-name.turso.io`) |
| `TURSO_AUTH_TOKEN` | Turso auth token (from dashboard → Connect) |
| `AI_PROVIDER` | `groq` (or `openai` / `anthropic`) |
| `GROQ_API_KEY` | Comma-separated Groq keys: `key1,key2,key3` |
| `LOCAL_MODEL_DIR` | Path to cache the local Qwen 0.5B GGUF model (default: `/data/models`) |
| `ENABLE_LOCAL_BRAIN` | Set to `true` to load Qwen 0.5B locally for lightweight tasks |
| `PORT` | Leave empty (Railway sets this automatically) |

## How to Deploy

1. Push this repo to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub repo
3. Set Root Directory to `/` (or point to `railway/Dockerfile` in settings)
4. Add the secrets above in Variables tab
5. Deploy

## Volume Setup (required for local AI model)

The local Qwen 0.5B model (~280 MB) needs a Railway volume to persist across deploys:
1. In Railway Dashboard → your service → Volumes
2. Add a volume with mount path: `/data`
3. Without this, the model re-downloads on every deployment

## How It Works

```
Railway probes $PORT (TCP)
    ↓
health.js → dummy HTTP server (200 OK)
    ↓
spawns → node_modules/.bin/tsx apps/discord/src/index.ts
    ↓
Discord Gateway (WebSocket)
    ↓
Turso (trainer_links table) — persistent, survives redeploys
    ↓
LocalBrain (Qwen 0.5B) — loaded into RAM, downloads once to /data/models
```

The bot doesn't expose an HTTP port itself — it connects OUT to Discord's Gateway.
Railway needs *something* listening on `$PORT` to consider the deployment healthy,
so `health.js` provides that while forwarding logs from the bot child process.

### AI Architecture

```
Groq (llama-3.3-70B, external)    → Complex planning, structured JSON, !agent
Qwen 0.5B Q3_K_M (local, ~400MB)  → Cache-based messages, simple decisions, cron tasks
```

Set `ENABLE_LOCAL_BRAIN=true` to load the local model at startup.
Leave unset to use Groq only (no local model, lower RAM).
