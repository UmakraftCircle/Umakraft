# Repository Health Domain

This repository uses `@ai-agent-platform/health` as its shared, dependency-light
health layer. It is intentionally compatible with the existing TypeScript,
pnpm workspaces, Node HTTP API, Railway deployment, and in-memory/runtime
patterns already used by Umakraft.

## Phase 1 implementation

- `HealthEvent`, `HealthMetric`, `ServiceHealth`, and `HealthContext` contracts
- JSON structured health logger with service, version, environment, commit,
  trace ID, and request ID fields
- In-memory event and metric collector with bounded history
- Service registration and heartbeat tracking
- Health scoring with availability, errors, and latency penalties
- AI-ready context endpoint containing score, services, incidents, events, and metrics
- Small SDK for any app or package to publish heartbeats, events, and metrics

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Public liveness response plus current score and services |
| GET | `/health/status` | Full AI-ready repository health context |
| POST | `/health/events` | Ingest a structured health event |
| POST | `/health/heartbeat` | Register or refresh a service heartbeat |
| POST | `/health/metrics` | Ingest a service metric |

The existing API authentication middleware protects the ingestion and status
routes when `API_KEY` or `API_KEYS` is configured. `/health` remains public for
Railway probes.

## Service usage

```ts
import { createHealthClient } from '@ai-agent-platform/health';

const health = createHealthClient({
  baseUrl: process.env.HEALTH_API_URL || 'http://localhost:3000',
  token: process.env.API_KEY,
  service: 'discord-bot',
  version: process.env.APP_VERSION,
});

await health.heartbeat();
await health.event({ level: 'info', message: 'Gateway connected' });
await health.metric({ latencyMs: 120, requests: 42, errorRate: 0 });
```

## Deliberate follow-up phases

The first phase does not add Redis, Kafka, PostgreSQL, TimescaleDB, Grafana, or
OpenTelemetry yet. Those should be introduced behind adapters after the
contracts and API have real traffic. The next safe extension is a persistent
storage adapter, followed by SSE streaming and CI/dependency collectors.