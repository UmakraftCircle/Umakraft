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

## Topics covered in the README

- Agent pipeline stages (Intake → Context → Planning → Validation → Execution)
- Task scheduling, dependency tracking, retries, and lifecycle management
- Parallel execution patterns
- Tool invocation and the Tool Registry
- Intelligence Layer: memory, knowledge, repository intelligence, model routing, learning
- Architectural principles and boundaries

## Running

```bash
pnpm install
pnpm build
pnpm dev          # starts API server on localhost:3000
pnpm test         # runs the test suite
```

No API keys required for local development — MockAIService provides deterministic plans.
