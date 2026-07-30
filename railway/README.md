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
| `PORT` | Leave empty (Railway sets this automatically) |

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
health.js → dummy HTTP server (200 OK)
    ↓
spawns → node_modules/.bin/tsx apps/discord/src/index.ts
    ↓
Discord Gateway (WebSocket)
```

The bot doesn't expose an HTTP port itself — it connects OUT to Discord's Gateway.
Railway needs *something* listening on `$PORT` to consider the deployment healthy,
so `health.js` provides that while forwarding logs from the bot child process.
