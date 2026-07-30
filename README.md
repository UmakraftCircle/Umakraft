# AI Agent Platform

> **An AI-first engineering platform designed to orchestrate intelligent workflows, execute structured tasks, and continuously improve through observation—not self-modification.**

---

# Project Vision

This project is **not** a Discord bot.

It is an **AI Agent Platform** capable of orchestrating intelligent workflows, coordinating tools, managing knowledge, and delegating heavy AI computation to external inference providers.

The first benchmark domain is **Umamusume Fan Tracker**, which validates the platform architecture.

---

# Project Status

This project is under active architectural development.

The architecture described in this document is considered the stable foundation. Implementation details may evolve.

---

# Design Principles

- AI performs reasoning—not business logic.
- Business logic belongs to Domain Packages.
- Railway hosts the Agent Runtime, not model inference.
- Heavy inference is delegated externally.
- Every component has one responsibility.
- Documentation is written for humans and AI.
- Self-learning is allowed.
- Self-improvement is allowed.
- Self-modification is **not** allowed.

---

# Architectural Rules

1. Every package owns one capability.
2. AI plans; domains implement.
3. Domain logic never depends directly on AI providers.
4. Memory is persistent; cache is disposable.
5. Infrastructure should remain replaceable.
6. Every feature integrates into the Agent Lifecycle.
7. Documentation evolves with architecture.

---

# Core Philosophy

> **Think → Plan → Execute → Validate → Learn**

The AI decides **what** to do.

The platform decides **how** to do it.

---

# High-Level Architecture

```text
Discord / API / CLI
        │
        ▼
Agent Runtime
        │
        ├── Planner
        ├── Task Manager
        ├── Memory
        ├── Cache
        ├── Knowledge
        ├── Repository Intelligence
        ├── Tool Registry
        ├── Validator
        ├── Learning
        └── Model Router
                │
        ┌───────┴────────┐
        ▼                ▼
External LLM      Local Inference
```

---

# Repository Structure

```text
ai-agent-platform/
├── apps/
│   ├── discord/
│   ├── api/
│   └── cli/
│
├── packages/
│   ├── ai/
│   ├── core/
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
│   ├── domains/
│   │   └── fan-tracker/
│   ├── tools/
│   ├── integrations/
│   │   ├── discord/
│   │   ├── turso/
│   │   ├── redis/
│   │   ├── railway/
│   │   └── ollama/
│   └── shared/
│
├── docs/
│   ├── architecture/
│   ├── domains/
│   ├── development/
│   └── decisions/
│
├── scripts/
├── .github/
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

## Package Responsibilities

| Directory | Responsibility |
|-----------|----------------|
| apps | Application entry points |
| packages/core | Runtime orchestration |
| packages/ai | LLM providers, routing, prompts |
| packages/domains | Independent business logic |
| packages/tools | Agent tools |
| packages/integrations | External services |
| packages/shared | Shared libraries |
| docs | Documentation |

---

# Agent Lifecycle

```text
Receive Task
      │
Analyze Intent
      │
Retrieve Knowledge
      │
Build Plan
      │
Validate Plan
      │
Execute
      │
Verify
      │
Learn
      │
Store Memory
      │
Report Result
```

---

# Memory Model

## Memory

Persistent knowledge stored in **Turso**.

- Previous tasks
- Learning history
- Observations
- Project decisions

## Cache

Disposable performance layer.

- Repository indexes
- Tool responses
- HTTP responses

---

# AI Responsibilities

## AI should

- Understand intent
- Plan
- Select tools
- Retrieve knowledge
- Produce structured outputs
- Learn from execution

## AI should not

- Own business logic
- Modify databases directly
- Change repository architecture
- Modify source code autonomously

---

# Heavy Computation

Heavy inference belongs on:

- External LLM providers
- Local inference servers
- Dedicated AI infrastructure

Railway orchestrates execution only.

---

# Self Learning

The platform records:

- Successes
- Failures
- Observations
- Metrics

Learning produces knowledge—not code changes.

---

# Self Improvement

Historical execution improves:

- Planning
- Tool selection
- Validation
- Execution order

Workflow improves while source code remains unchanged.

---

# Benchmark Domain

Current benchmark:

```
Umamusume Fan Tracker
```

Purpose:

- Validate architecture
- Evaluate planning
- Test repository intelligence
- Improve reliability

---

# Long-Term Goal

Build a modular AI Agent Platform where:

- Models are replaceable.
- Domains are independent.
- Tools are extensible.
- Memory is persistent.
- Intelligence improves through experience.
- Architecture remains stable.

---

# AI Agent Instructions

Before contributing:

- Read this README first.
- Respect package boundaries.
- Extend existing packages when possible.
- Keep documentation synchronized.
- Never place business logic inside prompts.
- Never introduce self-modifying behavior.

---

# Future Documentation

```text
docs/
├── architecture/
│   ├── runtime.md
│   ├── planner.md
│   ├── memory.md
│   ├── learning.md
│   ├── repository-intelligence.md
│   └── model-router.md
├── domains/
│   └── fan-tracker.md
├── development/
│   ├── setup.md
│   ├── contributing.md
│   └── coding-standards.md
└── decisions/
    ├── 0001-platform-philosophy.md
    └── 0002-memory-model.md
```

This README serves as the project's constitution. Setup guides, API documentation, deployment instructions, and contribution guides should live under `docs/` as the project matures.
