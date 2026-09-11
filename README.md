# Umakraft — AI Agent Platform

> An AI-first engineering platform for orchestrating intelligent agents, executing structured tasks, and continuously improving through observation — shipped as a **Umamusume fan-tracking Discord bot** (`/ask`, `/chat`, `/agent`) backed by a reusable agent runtime.

This project runs **two things at once**:

1. **A live Discord product** — a personalized, memory-aware Umamusume assistant (the "horse-girl" agent) that answers questions, holds conversations, and executes tasks for members of the Umakraft server.
2. **A reusable AI agent runtime** — a monorepo of `@ai-agent-platform/*` packages (core loop, tool registry, memory, model routing, skills, domains) designed to be reused across unrelated domains, not just Umamusume.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Status](#status)
- [Repository Structure](#repository-structure)
- [Apps](#apps)
  - [Discord Bot (Flagship)](#discord-bot-flagship)
  - [API Server](#api-server)
  - [CLI](#cli)
  - [image-report](#image-report)
- [Packages](#packages)
  - [core](#core)
  - [ai](#ai)
  - [integrations](#integrations)
  - [skills](#skills)
  - [tools](#tools)
  - [domains (fan-tracker, pr-monitor)](#domains)
  - [shared](#shared)
- [Architecture Overview](#architecture-overview)
- [Design Principles](#design-principles)
- [Getting Started](#getting-started)
- [Commands & Scripts](#commands--scripts)
- [Deployment (Railway)](#deployment-railway)
- [Docs & Skills](#docs--skills)

---

## What It Does

The Discord bot is the first-party consumer of the platform. It exposes three slash commands, each backed by a different mode of the same agent runtime:

| Command | Subcommands | Scope | Guarding |
|---|---|---|---|
| `/ask` | *(question)* | Uma Musume–only Q&A. Read-only. Uses the domain guard (keyword allowlist + `[[OFFTOPIC]]` gate). | `domainGuard: true` |
| `/chat` | `speak`, `reply` | General one-on-one conversation. The Umamusume persona chats about any ordinary topic. Session-based (`speak` opens, `reply` continues). | `safetyGuard` only (`domainGuard: false`) |
| `/agent` | *(goal)* | Goal execution. The agent plans, calls tools, and runs tasks within safety boundaries. | `safetyGuard`; `domainGuard: false` |

All three reply via **embeds** (auto-split into multiple embeds for long answers, up to Discord's 10-embed limit), never silently dropping content.

### Notable capabilities baked into the bot

- **Long-term memory** — remembers each Trainer's favourite Umamusume, teams, support cards, and reply-style preference, persisted to Turso (libSQL) and woven into future prompts.
- **Semantic answer cache** — reuses past answers to similar questions via local embedding (MiniLM) similarity, avoiding redundant LLM calls.
- **Conversation context** — per user+channel rolling history (up to 20 turns) fed back into the prompt.
- **Favourites auto-detection** — scans user messages for horse-girl names and stores them automatically.
- **On-the-fly web search** — `/ask` and `/ask`-style questions can reach Tavily for current info (`searchWebTool`).
- **Skill tools** — the agent registers the full skill suite (`packages/skills`) as callable tools (browser extraction, deep research, question review, error handling, guidance, etc.).
- **Scheduled / reactive jobs** — `reminder-jobs.ts`, `milestone-jobs.ts`, and the supervisor run scheduled tasks (daily messages, milestone announcements, reminders).
- **Safety guards** — a deterministic blocklist (`guard.ts`) hard-rejects improper content & prompt injection *before* any LLM call; `/ask` additionally enforces a domain allowlist.
- **Daily message services** — `packages/ai` ships greeting, daily-message, daily-achievement, milestone, monthly-achievement, reminder, and compare-summary services that generate personalized community content.

---

## Status

| | |
|---|---|
| **Stage** | Active development — Discord bot is live on Railway |
| **Runtime** | Node.js (ESM, `tsx`) |
| **Language** | TypeScript |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Deployment** | Railway (Docker, `railway/Dockerfile`) |
| **Persistent Memory / DB** | Turso (libSQL) |
| **Cache** | Redis |
| **Model** | Groq `qwen/qwen3.6-27b` (configurable) |
| **Embeddings** | Local MiniLM (`@ai-agent-platform/ai`) |
| **Benchmark Domain** | Umamusume Fan Tracker |

---

## Repository Structure

```
Umakraft/
├── apps/
│   ├── discord/          # Discord bot (flagship product) — main run target
│   │   └── src/          # ask.ts, chat.ts, agent.ts, gateway.ts, handlers.ts,
│   │                     # commands.ts, guard.ts, embed-reply.ts, errors.ts,
│   │                     # supervisor.ts, milestone-jobs.ts, reminder-jobs.ts,
│   │                     # autonomous.ts, bootstrap.ts, simulator.ts
│   ├── api/              # HTTP API server (auth.ts, index.ts)
│   ├── cli/              # Command-line interface
│   └── image-report/     # React image-renderer for reports (leaderboard, gain, compare)
├── packages/
│   ├── core/             # agent-runner, tool-calling-agent, tool-registry, planner,
│   │                     # task-manager, validator, model-router, memory-store,
│   │                     # cache-store, knowledge-graph, learning, repo-indexer
│   ├── ai/               # providers, prompts, embeddings, local-provider, local-brain,
│   │                     # agent-system, + *-service.ts (greeting, daily-message, milestone, …)
│   ├── integrations/     # turso, database, chat-memory, chat-session, chat-cache,
│   │                     # conversation-memory, web-search, schedule-store, task-state,
│   │                     # automation, action-controller, notification-store, …
│   ├── skills/           # browser-extract, error-handling, research, guidance (index)
│   ├── tools/            # web, notifications (index)
│   ├── domains/
│   │   ├── fan-tracker/  # Umamusume domain: infrastructure, index
│   │   └── pr-monitor/   # PR monitor domain: index
│   └── shared/           # config, constants, errors, logger, types
├── skills/               # Human/agent-readable skill docs (README + 14+ .md)
├── docs/                 # ask-web-research-policy.md
├── tests/                # core/, ai/, integrations/ test suites
├── scripts/              # lint-templates.sh
├── railway/              # Dockerfile, health.cjs, README
├── Dockerfile / railway.toml / turbo.json / pnpm-workspace.yaml
└── README.md, OVERVIEW.md
```

---

## Apps

### Discord Bot (Flagship)

`apps/discord` is the primary application and the reason the platform exists. It connects to Discord via `discord.js`, registers slash commands, and routes each command through the core agent runtime.

**Key modules:**

- `gateway.ts` — Discord Gateway connection & event wiring (10 KB).
- `handlers.ts` — interaction/command handlers (16.7 KB), the request→agent bridge.
- `ask.ts` — `/ask` (Uma Musume–only Q&A, domain-guarded, read-only).
- `chat.ts` — `/chat Speak|Reply` (general conversation, session + memory + cache). *Orchestration only — it calls the memory/cache/session services.*
- `agent.ts` — `/agent` (goal execution, domainGuard disabled, safety-guarded).
- `commands.ts` — slash-command definitions & registration.
- `guard.ts` — `safetyGuard` (deterministic blocklist), `hasRelevance` allowlist, `[[OFFTOPIC]]` handling.
- `embed-reply.ts` — `replyWithEmbed`, `buildAnswerEmbeds`, `splitForEmbeds` (multi-embed replies).
- `errors.ts` — `failureMessage` and error typing.
- `bootstrap.ts` — `buildAIService` wiring (model + provider).
- `supervisor.ts`, `milestone-jobs.ts`, `reminder-jobs.ts` — scheduled & reactive job scheduling.
- `autonomous.ts`, `simulator.ts` — autonomous task execution & simulation stubs.

### API Server

`apps/api` — an HTTP API (`index.ts`, 20 KB) with auth (`auth.ts`, 11 KB). Exposes platform endpoints over REST.

### CLI

`apps/cli` — a command-line interface (`index.ts`) for driving the platform from a terminal.

### image-report

`apps/image-report` — a React/TSX renderer that produces shareable **image reports** (Leaderboard, Gain, Compare) using the Inter font assets; `renderer.ts`, `charts.tsx`, `theme.ts`.

---

## Packages

### core

The runtime brain. Owns the agent loop and all execution primitives:

- `agent-runner.ts`, `tool-calling-agent.ts` — the ReAct-style loop that plans → calls tools → validates.
- `tool-registry.ts` — the declarative registry; tools are registered, not imported directly.
- `planner.ts`, `task-manager.ts`, `validator.ts` — planning, task scheduling, output validation.
- `model-router.ts` — provider-agnostic model selection.
- `memory-store.ts`, `cache-store.ts` — persistent memory & cache abstractions.
- `knowledge-graph.ts`, `learning.ts` — knowledge representation & observational learning.
- `repo-indexer.ts` — indexes a codebase for repository intelligence.

### ai

Model & prompting layer, plus the community content services that power the bot's personalities:

- `providers.ts`, `local-provider.ts`, `model-router` integration — Groq / local provider wiring.
- `prompts.ts` — persona & system prompts (21 KB).
- `embeddings.ts` — local MiniLM embedding generator.
- `local-brain.ts` — local reasoning/knowledge cache.
- `agent-system.ts` — system-level agent orchestration.
- **Content services** (the bot's "personality"): `greeting-service.ts`, `daily-message-service.ts`, `daily-achievement-service.ts`, `milestone-message-service.ts`, `monthly-achievement-service.ts`, `reminder-message-service.ts`, `compare-summary-service.ts`.

### integrations

External systems & persistence adapters:

- `turso.ts`, `database.ts` — Turso (libSQL) connectivity.
- `chat-memory.ts`, `chat-session.ts`, `chat-cache.ts`, `conversation-memory.ts` — the `/chat` state machine.
- `web-search.ts` — Tavily web search tool.
- `schedule-store.ts`, `task-state.ts`, `automation.ts`, `action-controller.ts` — scheduling & task orchestration.
- `notification-store.ts`, `moderation-log.ts`, `confirmation-store.ts` — notifications, moderation, confirmations.
- `ask-response-cache.ts`, `trainer-links.ts`, `chat-helpers.ts` — `/ask` & Trainer utilities.

### skills

Reusable, registered skill tools the agent can call: `browser-extract`, `error-handling`, `research`, and `guidance` (exposed via `index.ts`).

### tools

Declarative tooling: `web.ts` (web fetch/search) and `notifications.ts` (notification dispatch).

### domains

- **fan-tracker** — the Umamusume benchmark domain (`infrastructure.ts`, `index.ts`).
- **pr-monitor** — a PR-monitoring domain (`index.ts`, 10.5 KB).

### shared

Cross-cutting utilities: `config.ts`, `constants.ts`, `errors.ts`, `logger.ts`, `types.ts`.

---

## Architecture Overview

```
        User / External Trigger
                 │
                 ▼
           [ App Layer ]
        discord / api / cli
                 │
                 ▼
         [ Core Runtime ]
   ToolCallingAgent → Planner → Validator → Task Manager
                 │
                 ▼
       [ Tool Registry ]  ← skills, tools, integrations, domains
                 │
                 ▼
           [ AI Layer ]
      Model Router → Provider (Groq / local)
                 │
                 ▼
      [ Intelligence Layer ]
   Memory · Knowledge · Learning · Repository Intelligence
```

**Key separation:** the runtime executes; the AI reasons; memory/knowledge persist; tools act. No layer owns more than its responsibility.

---

## Design Principles

1. **Execution ≠ reasoning** — the runtime drives workflow execution; the AI provides judgment.
2. **Domains are isolated** — a domain package cannot import another domain; shared behavior lives in `packages/shared` or `packages/core`.
3. **Tools are declarative** — registered, not called directly; the registry owns discovery & dispatch.
4. **Memory is infrastructure** — a queryable store, not a prompt.
5. **Models are replaceable** — no app code imports a provider SDK; the model router owns that boundary.
6. **Learning is observational** — the system improves by observing outcomes, not by self-modification.
7. **Fail loudly** — explicit failures; no silent fallbacks; typed errors with cause & boundary.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm
- A Turso (libSQL) database
- A Discord bot token
- (Optional) Redis, Groq API key, Tavily API key

### Install & run

```bash
pnpm install
pnpm dev            # runs the API via tsx
pnpm -w --filter @ai-agent-platform/discord dev   # run the Discord bot
```

### Build, test, lint

```bash
pnpm build          # tsc -b (type-check & build all workspaces)
pnpm test           # node --import tsx --test tests/**/*.test.ts
pnpm test:core      # core-only tests
pnpm test:watch     # watch mode
pnpm lint           # bash scripts/lint-templates.sh
```

### Configuration

Sensitive values are read from environment variables (Discord token, Turso URL/auth, Groq key, Tavily key). See `apps/discord/src/config` / `packages/shared/src/config.ts` for the full list.

---

## Commands & Scripts

From the root `package.json`:

| Script | Purpose |
|---|---|
| `build` | `tsc -b` — build all workspaces |
| `start` / `dev` | run the API via `tsx apps/api/src/index.ts` |
| `test` | run all tests |
| `test:core` | run `tests/core/*` |
| `test:watch` | watch-mode tests |
| `lint` | `scripts/lint-templates.sh` |

The Discord app (`apps/discord/package.json`) additionally defines `build` (`tsc`), `dev` (`tsc -w`), and `start` (`node ./dist/index.js`).

---

## Deployment (Railway)

The repository deploys to [Railway](https://railway.app) via `railway/Dockerfile` and `railway.toml`.

- **Health check**: `railway/health.cjs` — the process is monitored and restarted on crash (exit code 1).
- **Auto-deploy**: Railway rebuilds on every push to `main`.
- **Note on stale builds**: the Discord app runs compiled `dist/` output. If a crash trace points at source that looks clean, clear the Railway build cache and redeploy to force a fresh `tsc` run.

---

## Docs & Skills

- [`OVERVIEW.md`](./OVERVIEW.md) — high-level project overview.
- [`docs/ask-web-research-policy.md`](./docs/ask-web-research-policy.md) — `/ask` web-research policy.
- [`skills/`](./skills/) — human/agent skill playbooks (`browser-extract.md`, `deep-research.md`, `context-engineering.md`, `question-review.md`, `agentic-engineering.md`, `ai-prompt.md`, `error-handling-patterns.md`, `skill-comply-zaro.md`, and more).
- [`railway/README.md`](./railway/README.md) — deployment specifics.
- [`replit.md`](./replit.md) — Replit usage notes.

---

## Vision

Most AI projects tightly couple reasoning with application logic — a chatbot, a Discord bot, a coding assistant. They solve one problem but can't be reused or extended without a rewrite.

This platform inverts that: the **AI is responsible for reasoning, the platform is responsible for execution.** The Discord bot is a *consumer* of the runtime; the runtime itself is domain-agnostic and reusable (the `fan-tracker` and `pr-monitor` domains prove the point).

The first benchmark domain is **Umamusume Fan Tracker** — a realistic, data-rich environment for validating planning, memory, repository intelligence, and long-running task execution. The domain exists to improve the platform, not the other way around.
