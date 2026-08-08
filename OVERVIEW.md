# Umakraft — AI Agent Platform

> An AI-first engineering platform for orchestrating intelligent workflows, executing structured tasks, and continuously improving through observation — not self-modification.

## Project Summary

**Umakraft** (repo name: `ai-agent-platform`) is a reusable **AI Agent Runtime** — a monorepo built with Turborepo + pnpm workspaces, written in TypeScript, deployed on Railway.

### Tech Stack
- **Runtime**: Node.js (TypeScript, ES2022)
- **Monorepo**: Turborepo + pnpm workspaces
- **Deployment**: Railway (Docker-based)
- **Database**: Turso (libSQL) / SQLite (better-sqlite3)
- **Cache**: Redis
- **AI Providers**: OpenAI, Anthropic (Claude), Ollama (local), Groq
- **Charting**: Chart.js + Satori (image rendering)

### Architecture Layers

| Layer | Package | Role |
|---|---|---|
| **Apps** | `api`, `discord`, `cli` | Entry points — HTTP API, Discord bot, CLI tool |
| **Core Runtime** | `packages/core` | Planner, Task Manager, Validator, Tool Registry, Model Router |
| **AI** | `packages/ai` | Provider-agnostic AI abstraction (OpenAI, Anthropic, Ollama, Groq) |
| **Domains** | `packages/domains` | Isolated domain logic — Fan Tracker, PR Monitor |
| **Tools** | `packages/tools` | Reusable tools — filesystem, browser, web, scheduler, notifications |
| **Integrations** | `packages/integrations` | External services — Discord, Turso, Redis, Railway |
| **Shared** | `packages/shared` | Types, logging, config, errors, constants |

### Core Pipeline
```
Intent → Planner → Validator → Task Manager (DAG execution) → Tool Registry → Model Router → AI Provider
```

**Key design principle**: Execution and reasoning are separated. The runtime handles execution; the AI handles reasoning. Memory is infrastructure (queryable store), not a prompt.

### Benchmark Domain: Umamusume Fan Tracker
The first domain implementation — tracks fan statistics for the game Umamusume, providing daily/weekly reports via Discord with chart generation.

### Source Files Uploaded
- `README.md` — Full project documentation
- `package.json` — Root workspace config
- `packages/core/src/task-manager.ts` — DAG-aware parallel task scheduler with retries
- `packages/ai/src/index.ts` — AI service abstraction with MockAIService for local dev
- `apps/discord/src/supervisor.ts` — Agent lifecycle orchestrator
- `src.tar.gz` — Complete source code archive (all packages, apps, tests, docs)
