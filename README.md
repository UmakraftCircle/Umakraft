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
