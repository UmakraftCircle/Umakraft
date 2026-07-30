# AI Agent Platform

> An AI-first engineering platform for orchestrating intelligent workflows, executing structured tasks, and continuously improving through observation — not self-modification.

---

## Status

| | |
|---|---|
| **Stage** | Early Architecture & Scaffolding |
| **Runtime** | Node.js |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Deployment** | Railway |
| **Persistent Memory** | Turso (libSQL) |
| **Cache** | Redis |
| **Benchmark Domain** | Umamusume Fan Tracker |

---

## Table of Contents

- [Vision](#vision)
- [Why This Exists](#why-this-exists)
- [Repository Structure](#repository-structure)
- [Packages](#packages)
  - [Core](#core)
  - [AI](#ai)
  - [Domains](#domains)
  - [Tools](#tools)
  - [Integrations](#integrations)
  - [Shared](#shared)
- [Apps](#apps)
- [Architecture Overview](#architecture-overview)
- [Design Principles](#design-principles)
- [Getting Started](#getting-started)
- [Docs](#docs)

---

## Vision

Most AI projects tightly couple reasoning with application logic — a chatbot, a Discord bot, a coding assistant. They solve one problem but cannot be reused or extended without a full rewrite.

This platform takes a different approach.

Instead of building another AI-powered application, this repository provides a **reusable AI Agent Runtime** — a foundation capable of orchestrating intelligent workflows across completely independent domains.

> The AI is responsible for reasoning.  
> The platform is responsible for execution.

The first benchmark domain is **Umamusume Fan Tracker** — chosen because it provides a realistic, data-rich environment for validating planning, memory, repository intelligence, and long-running task execution. The domain exists to improve the platform, not the other way around.

---

## Why This Exists

Modern LLMs are excellent at reasoning. They are significantly less reliable at:

- Maintaining long-term state
- Coordinating complex multi-step workflows
- Enforcing architectural boundaries
- Managing persistent knowledge
- Executing deterministic business logic

Those responsibilities belong to software — not the model.

This platform bridges that gap by giving the AI one role inside a larger, disciplined architecture. The platform handles structure, execution, memory, validation, and learning. The model handles reasoning.

---

## Repository Structure

```
ai-agent-platform/
│
├── apps/
│   ├── api/              # HTTP API server
│   ├── discord/          # Discord bot interface
│   └── cli/              # Command-line interface
│
├── packages/
│   ├── core/             # Runtime engine
│   │   ├── planner/
│   │   ├── task-manager/
│   │   ├── validator/
│   │   ├── memory/
│   │   ├── cache/
│   │   ├── knowledge/
│   │   ├── learning/
│   │   ├── repository-intelligence/
│   │   ├── tool-registry/
│   │   └── model-router/
│   │
│   ├── ai/               # AI provider abstraction
│   │   ├── providers/
│   │   ├── prompts/
│   │   ├── embeddings/
│   │   ├── structured-output/
│   │   └── routing/
│   │
│   ├── domains/          # Domain implementations
│   │   └── fan-tracker/
│   │       ├── application/
│   │       ├── domain/
│   │       ├── infrastructure/
│   │       └── tools/
│   │
│   ├── tools/            # Tool implementations
│   │   ├── filesystem/
│   │   ├── repository/
│   │   ├── web/
│   │   ├── browser/
│   │   ├── scheduler/
│   │   └── notifications/
│   │
│   ├── integrations/     # External service integrations
│   │   ├── discord/
│   │   ├── turso/
│   │   ├── redis/
│   │   ├── railway/
│   │   ├── ollama/
│   │   ├── openai/
│   │   └── anthropic/
│   │
│   └── shared/           # Shared utilities
│       ├── config/
│       ├── logger/
│       ├── errors/
│       ├── utils/
│       ├── types/
│       └── constants/
│
├── docs/
│   ├── architecture/
│   ├── domains/
│   ├── development/
│   ├── decisions/
│   └── diagrams/
│
├── scripts/
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
│
├── package.json
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Packages

### Core

The runtime engine. Applications never call AI providers directly — they go through the core runtime.

| Package | Responsibility |
|---|---|
| `planner` | Transforms intent into a structured, ordered execution plan |
| `task-manager` | Schedules, tracks, retries, and reports on task lifecycle |
| `validator` | Validates plans before execution and results after |
| `memory` | Persistent, queryable agent memory across sessions |
| `cache` | TTL-based caching layer (Redis-backed) |
| `knowledge` | Domain knowledge retrieval and management |
| `learning` | Observation-based improvement without self-modification |
| `repository-intelligence` | Understands the codebase structure and history |
| `tool-registry` | Registers, discovers, and dispatches tools |
| `model-router` | Selects the right AI model based on task type, cost, and capability |

---

### AI

Provider-agnostic AI layer. The rest of the platform never imports vendor SDKs directly.

| Package | Responsibility |
|---|---|
| `providers` | Unified interface for OpenAI, Anthropic, Ollama, and future providers |
| `prompts` | Versioned, templated prompt management |
| `embeddings` | Semantic embedding infrastructure for retrieval |
| `structured-output` | Enforced structured responses (JSON schema, Zod) |
| `routing` | Task-to-model routing policies |

---

### Domains

Self-contained domain implementations. Adding a new domain should never require changes to the runtime.

| Package | Responsibility |
|---|---|
| `fan-tracker/application` | Use cases and application services |
| `fan-tracker/domain` | Core domain models, entities, and business rules |
| `fan-tracker/infrastructure` | Database access, external API clients |
| `fan-tracker/tools` | Domain-specific tools registered with the tool registry |

---

### Tools

Reusable tool implementations available to any domain.

| Package | Responsibility |
|---|---|
| `filesystem` | File read/write operations |
| `repository` | Git and source code operations |
| `web` | HTTP fetch and web scraping |
| `browser` | Headless browser automation |
| `scheduler` | Cron and delayed task scheduling |
| `notifications` | Push, webhook, and alert delivery |

---

### Integrations

Thin wrappers around external services. All connection details stay here — never scattered across packages.

| Package | Service |
|---|---|
| `discord` | Discord API (Gateway + REST) |
| `turso` | Turso / libSQL database |
| `redis` | Redis cache and pub/sub |
| `railway` | Railway deployment and environment management |
| `ollama` | Local LLM inference via Ollama |
| `openai` | OpenAI API |
| `anthropic` | Anthropic Claude API |

---

### Shared

Cross-cutting utilities used by every package.

| Package | Responsibility |
|---|---|
| `config` | Environment-aware configuration loading |
| `logger` | Structured logging |
| `errors` | Typed error classes and error handling utilities |
| `utils` | General-purpose helpers |
| `types` | Shared TypeScript types and interfaces |
| `constants` | Platform-wide constants |

---

## Apps

| App | Description |
|---|---|
| `api` | HTTP API server — exposes the runtime over REST |
| `discord` | Discord bot — conversational interface to the agent runtime |
| `cli` | Command-line tool — developer interface for running and inspecting the platform |

---

## Architecture Overview

```
User / External Trigger
        │
        ▼
    [ App Layer ]
   api / discord / cli
        │
        ▼
   [ Core Runtime ]
  Planner → Validator → Task Manager
        │
        ▼
  [ Tool Registry ]
   dispatches to tools, integrations, domain packages
        │
        ▼
  [ AI Layer ]
  Model Router → Provider
        │
        ▼
  [ Intelligence Layer ]
  Memory · Knowledge · Learning · Repository Intelligence
```

**Key separation:** The runtime executes. The AI layer reasons. Memory and knowledge persist. Tools act. No single layer owns more than its responsibility.

---

## Design Principles

**1. Execution is not reasoning.**  
The runtime drives workflow execution. The AI provides judgment. These must remain separate.

**2. Domains are isolated.**  
A domain package cannot import from another domain. All shared behavior lives in `packages/shared` or `packages/core`.

**3. Tools are declarative.**  
Tools are registered, not called directly. The tool registry owns discovery and dispatch.

**4. Memory is infrastructure.**  
Memory is not a prompt. It is a queryable store. The planner reads from it; the learning layer writes to it.

**5. Models are replaceable.**  
No application code imports an AI provider SDK. The model router and provider abstraction own that boundary.

**6. Learning is observational.**  
The system improves by observing outcomes — not by modifying its own source code.

**7. Fail loudly.**  
The platform is explicit on failure. No silent fallbacks. Every error has a type, a cause, and a boundary.

---

## Getting Started

> **Note:** The project is in early scaffolding. Installation and development guides will live in `docs/development/` as the implementation progresses.

**Prerequisites**

- Node.js 20+
- pnpm 9+
- Turso CLI (for local database)
- Redis (local or remote)

**Install dependencies**

```bash
pnpm install
```

**Build all packages**

```bash
pnpm turbo build
```

**Run an app**

```bash
pnpm --filter @ai-agent-platform/api dev
```

---

## Docs

Detailed documentation lives in `docs/`:

| Directory | Contents |
|---|---|
| `docs/architecture/` | System design, component diagrams, data flow |
| `docs/domains/` | Domain-specific documentation (Fan Tracker, future domains) |
| `docs/development/` | Setup guides, contribution conventions, local tooling |
| `docs/decisions/` | Architecture Decision Records (ADRs) |
| `docs/diagrams/` | Visual diagrams (Mermaid, draw.io exports) |

---

> The Runtime executes. The Intelligence Layer informs. Memory remembers. Knowledge teaches. The Model Router chooses. AI Providers reason.  
> Together they build agents that improve through experience without sacrificing architectural stability.
