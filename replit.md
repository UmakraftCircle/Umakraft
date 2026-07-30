# AI Agent Runtime — Reference Documentation

## Overview

This project is an **AI agent runtime platform** — a monorepo containing a working parallel task execution engine, domain-agnostic planning system, and persistence layer.

## Status (as of July 2026)

The platform is **runnable end-to-end** using the MockAIService (no API keys required). The core runtime includes:

- **TaskManager** — DAG-aware parallel scheduler with retry logic
- **Planner** — Natural language → structured ExecutionPlan
- **Validator** — Zod schemas + Kahn's algorithm for cycle detection
- **ModelRouter** — Cost/capability-based model selection (GPT-4o, Claude, Llama)
- **LearningEngine** — Failure observation → adaptation rule pipeline (now persisted via MemoryStore)
- **Repository Intelligence** — File tree indexing, symbol search, dependency graph
- **Knowledge Graph** — SQLite-backed entity/concept/document graph with BFS traversal
- **Memory Store** — Persistent failure observations and adaptation rules
- **Cache Store** — TTL cache with LRU eviction (shared platform service)
- **Auth Middleware** — API key validation + token-bucket rate limiting
- **Two benchmark domains**: Umamusume Fan Tracker + GitHub PR Monitor

## Running on Replit

```bash
pnpm install          # install all workspace dependencies
pnpm build            # compile all packages via Turborepo
PORT=5000 node apps/api/dist/index.js   # start the API server
```

The **"Start application"** workflow handles the last step automatically. The server listens on port 5000 and is visible in the Replit preview pane.

## Replit-specific notes

- `sqlite3` was replaced by `better-sqlite3` throughout (sqlite3's native build is blocked by the Replit package firewall). Affected files: `packages/integrations/src/database.ts`, `packages/integrations/src/index.ts`, `packages/core/src/knowledge-graph.ts`, `packages/core/src/memory-store.ts`.
- `.npmrc` contains `allow-build=better-sqlite3,esbuild` so native builds are permitted.
- `packageManager` in `package.json` is pinned to pnpm 10.26.1 (the version Replit provides).
- No API keys are required for local development — MockAIService provides deterministic plans.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (public) |
| GET | `/tools` | List registered tools |
| POST | `/plans` | Submit a plan intent |
| GET | `/plans` | List all plans |
| GET | `/plans/:id` | Get plan details |
| POST | `/plans/:id/execute` | Execute a plan |
| GET | `/models` | Available AI models |

## Topics covered in the README

- Agent pipeline stages (Intake → Context → Planning → Validation → Execution)
- Task scheduling, dependency tracking, retries, and lifecycle management
- Parallel execution patterns
- Tool invocation and the Tool Registry
- Intelligence Layer: memory, knowledge, repository intelligence, model routing, learning
- Architectural principles and boundaries
