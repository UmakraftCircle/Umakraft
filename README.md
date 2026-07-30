# AI Agent Platform

> **An AI-first engineering platform for orchestrating intelligent workflows, executing structured tasks, and continuously improving through observation—not self-modification.**

---

> **Status:** Early Architecture Design
> **Primary Runtime:** Node.js
> **Monorepo:** Turborepo
> **Deployment:** Railway (Runtime)
> **Persistent Memory:** Turso
> **Benchmark Domain:** Umamusume Fan Tracker

---

# Table of Contents

* Project Vision
* Why This Exists
* Project Goals
* Core Philosophy
* Design Principles
* Architectural Rules
* Guiding Constraints
* High-Level Overview
* Repository Philosophy

> **Note**
>
> This README intentionally focuses on architecture rather than implementation.
>
> Installation guides, API documentation, deployment instructions, and contributor guides will live under the `docs/` directory as the project evolves.

---

# Project Vision

Most AI projects today are built around a single application.

A chatbot.

A Discord bot.

A coding assistant.

A workflow automation tool.

While each solves a specific problem, they often tightly couple AI reasoning with application logic, making them difficult to extend, test, or reuse.

This project takes a different approach.

Rather than building another application powered by AI, this repository aims to build an **AI Agent Platform**—a reusable foundation capable of orchestrating intelligent workflows across many independent domains.

The AI is responsible for reasoning.

The platform is responsible for execution.

This distinction allows intelligence to evolve without sacrificing architectural stability.

The first implementation domain is **Umamusume Fan Tracker**, chosen because it provides a realistic environment for validating planning, memory, repository intelligence, and long-running task execution.

The benchmark exists to improve the platform—not the other way around.

---

# Why This Exists

Modern LLMs are excellent at reasoning.

They are significantly less reliable at:

* Maintaining long-term state
* Coordinating complex workflows
* Enforcing architectural boundaries
* Managing persistent knowledge
* Executing deterministic business logic

Those responsibilities belong to software—not the model.

This platform exists to bridge that gap.

Instead of asking a language model to "do everything," the system provides an execution environment where the AI becomes one component of a larger architecture.

The platform supplies:

* Structured execution
* Persistent memory
* Knowledge retrieval
* Tool orchestration
* Validation
* Learning
* Repository understanding
* Infrastructure integration

Together these components enable AI systems that become more capable through experience while remaining predictable, maintainable, and modular.

---

# Project Goals

The platform is designed around several long-term objectives.

## 1. Build Once, Reuse Everywhere

The runtime should be reusable across completely different domains.

Today's benchmark:

* Umamusume Fan Tracker

Future domains might include:

* Personal assistants
* Knowledge management
* Software engineering
* Research automation
* Customer support
* Content generation

Adding a new domain should require creating a new Domain Package—not redesigning the runtime.

---

## 2. Separate Intelligence from Business Logic

Business rules should never live inside prompts.

Instead:

* AI determines intent.
* Domain packages define rules.
* The runtime coordinates execution.

This separation improves reliability, testing, and maintainability.

---

## 3. Keep Infrastructure Replaceable

No component should permanently depend on a specific vendor.

Examples:

* OpenAI → Anthropic
* Anthropic → Ollama
* Turso → PostgreSQL
* Railway → Render

Changing infrastructure should require replacing an integration—not redesigning the platform.

---

## 4. Learn Without Modifying Source Code

The platform should improve through execution history.

Learning should influence:

* Planning
* Tool selection
* Validation
* Knowledge retrieval
* Execution ordering

Learning must never rewrite application source code.

---

## 5. Design for Humans and AI

Documentation should be understandable by both human developers and AI coding agents.

Every package should communicate:

* Purpose
* Responsibilities
* Boundaries
* Dependencies
* Extension points

The repository itself becomes part of the agent's knowledge base.

---

# Core Philosophy

The platform follows one fundamental workflow.

> **Think → Plan → Execute → Validate → Learn**

Each step has a distinct responsibility.

## Think

Understand intent.

Identify goals.

Determine missing information.

## Plan

Transform reasoning into structured tasks.

Plans should be deterministic and reviewable.

## Execute

Delegate work to tools, domains, integrations, or external systems.

Execution should remain independent from reasoning.

## Validate

Verify results.

Detect failures.

Determine whether additional work is required.

## Learn

Record observations.

Store useful knowledge.

Improve future decisions.

Learning changes future behavior—not source code.

---

# Design Principles

Every architectural decision should support these principles.

### AI Reasons

AI is responsible for understanding intent and producing plans.

It should never own application logic.

---

### Domains Own Business Logic

Business rules belong exclusively inside Domain Packages.

Domains should remain independent from AI providers.

---

### Runtime Owns Execution

The runtime coordinates every capability.

It orchestrates workflows.

It does not perform inference itself.

---

### Components Have One Responsibility

Each package should solve one problem well.

Small components are easier to understand, replace, and test.

---

### Infrastructure Is Replaceable

Every external dependency should exist behind an abstraction layer.

No package should depend directly on vendor-specific implementations.

---

### Documentation Is Architecture

Documentation is not an afterthought.

It defines the system's intended behavior and acts as a contract for both humans and AI agents.

---

### Intelligence Evolves

The platform should improve through execution history.

Experience produces knowledge.

Knowledge improves future execution.

---

# Architectural Rules

Every package in this repository follows these rules.

1. One package owns one capability.
2. AI generates plans—not business rules.
3. Domain packages never depend directly on AI providers.
4. Infrastructure belongs behind integrations.
5. Memory is persistent.
6. Cache is disposable.
7. Knowledge is searchable.
8. Every capability participates in the Agent Lifecycle.
9. Every public component should be documented.
10. Self-modifying behavior is prohibited.

Violating these rules increases coupling and reduces maintainability.

---

# Guiding Constraints

The following constraints intentionally limit the platform's behavior.

## Self-Learning Is Allowed

The platform may:

* Record observations
* Learn from failures
* Improve planning
* Improve validation
* Improve tool selection

---

## Self-Improvement Is Allowed

The platform may optimize workflows using historical execution data.

Examples include:

* Better execution order
* Better task decomposition
* Better knowledge retrieval

---

## Self-Modification Is Not Allowed

The platform must never:

* Rewrite source code
* Change repository architecture
* Alter package responsibilities
* Modify deployment configuration
* Commit code automatically

Architectural decisions always remain under human control.

---

# High-Level Overview

The platform consists of several independent layers.

```text
Applications
      │
      ▼
Agent Runtime
      │
      ▼
Core Components
      │
      ▼
Domain Packages
      │
      ▼
Tools & Integrations
      │
      ▼
External Infrastructure
```

Each layer depends only on the layer below it.

This minimizes coupling and maximizes replaceability.

---

# Repository Philosophy

The repository should mirror the architecture.

Directories represent capabilities—not technologies.

Every package should answer one question:

> "What responsibility does this own?"

If that answer becomes unclear, the package is likely responsible for too much.

The goal is not simply to organize files.

The goal is to create a repository that humans and AI agents can navigate, understand, and extend with confidence.

# Runtime & Repository Architecture

The platform is organized as a modular monorepo.

Rather than grouping code by technology, packages are grouped by **responsibility**.

This keeps the architecture understandable as the project grows while allowing individual components to evolve independently.

The repository itself is part of the platform's documentation.

Every directory should clearly communicate:

* What it owns
* What it depends on
* What it must never do

---

# Monorepo Philosophy

This project uses a monorepo because the runtime, domains, tools, integrations, and applications all evolve together.

A monorepo enables:

* Shared types and utilities
* Consistent architecture
* Independent package ownership
* Easier refactoring
* Unified documentation
* Better AI repository understanding

Each package should remain independently understandable.

The repository should feel like a collection of small systems—not one enormous application.

---

# Complete Repository Structure

```text
ai-agent-platform/
│
├── apps/
│   ├── discord/
│   ├── api/
│   └── cli/
│
├── packages/
│   │
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
│   │
│   ├── ai/
│   │   ├── providers/
│   │   ├── prompts/
│   │   ├── embeddings/
│   │   ├── structured-output/
│   │   └── routing/
│   │
│   ├── domains/
│   │   └── fan-tracker/
│   │       ├── application/
│   │       ├── domain/
│   │       ├── infrastructure/
│   │       └── tools/
│   │
│   ├── tools/
│   │   ├── filesystem/
│   │   ├── repository/
│   │   ├── web/
│   │   ├── browser/
│   │   ├── scheduler/
│   │   └── notifications/
│   │
│   ├── integrations/
│   │   ├── discord/
│   │   ├── turso/
│   │   ├── redis/
│   │   ├── railway/
│   │   ├── ollama/
│   │   ├── openai/
│   │   └── anthropic/
│   │
│   └── shared/
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
├── pnpm-workspace.yaml
└── README.md
```

---

# Architectural Layers

The repository is divided into six major layers.

```text
Applications
      │
      ▼
Runtime
      │
      ▼
AI Services
      │
      ▼
Domain Packages
      │
      ▼
Tools
      │
      ▼
Integrations
```

Each layer exposes services to the layer above it.

Higher layers should avoid depending directly on infrastructure.

---

# Applications

```text
apps/
```

Applications are entry points into the platform.

They contain very little business logic.

Their responsibility is simply to receive requests and hand them to the Agent Runtime.

Current applications include:

* Discord
* REST API
* Command Line Interface

Future applications might include:

* Web Dashboard
* Desktop Client
* Telegram
* Slack
* Email Gateway

Applications should remain thin.

If business logic begins appearing here, it likely belongs inside a Domain Package or the Core Runtime.

---

# Core Runtime

```text
packages/core/
```

The Core Runtime is the heart of the platform.

Everything eventually flows through this package.

The runtime orchestrates execution.

It never performs model inference directly.

It never contains business rules.

Instead, it coordinates every capability required for an intelligent workflow.

Responsibilities include:

* Planning
* Task orchestration
* Validation
* Memory access
* Learning
* Knowledge retrieval
* Repository intelligence
* Tool execution
* Model routing

The runtime should remain independent from:

* Discord
* OpenAI
* Anthropic
* Turso
* Fan Tracker

This independence makes the platform reusable across domains.

---

# Planner

```text
packages/core/planner/
```

The Planner converts reasoning into structured execution plans.

Responsibilities:

* Analyze intent
* Build execution plans
* Estimate dependencies
* Break work into tasks
* Prioritize execution

The Planner never executes tasks.

Its output is only a plan.

---

# Task Manager

```text
packages/core/task-manager/
```

The Task Manager executes plans produced by the Planner.

Responsibilities:

* Queue tasks
* Track execution state
* Retry failed tasks
* Schedule parallel work
* Report progress

The Task Manager should never decide what work needs to happen.

That belongs to the Planner.

---

# Validator

```text
packages/core/validator/
```

Validation determines whether execution satisfied the requested objective.

Responsibilities:

* Validate outputs
* Detect failures
* Request retries
* Evaluate confidence
* Produce execution reports

Validation is independent from execution.

---

# Memory

```text
packages/core/memory/
```

Memory stores long-term information.

Examples:

* Previous conversations
* Successful executions
* Historical context
* User preferences
* Project decisions

Memory is persistent.

Current storage:

* Turso

Memory should never be treated as cache.

---

# Cache

```text
packages/core/cache/
```

Cache exists only for performance.

Examples:

* Repository indexes
* Temporary API responses
* Recently executed tools
* Search results

Cache should be rebuildable at any time.

---

# Knowledge

```text
packages/core/knowledge/
```

Knowledge is curated information used by the Planner.

Knowledge may originate from:

* Memory
* Documentation
* Repository analysis
* External data

Unlike Memory, Knowledge is optimized for reasoning rather than historical storage.

---

# Repository Intelligence

```text
packages/core/repository-intelligence/
```

One of the platform's defining features.

Repository Intelligence allows the agent to understand the codebase before making decisions.

Responsibilities include:

* Index source files
* Analyze dependencies
* Understand package ownership
* Detect architecture violations
* Retrieve relevant code
* Recommend implementation locations

The goal is to allow AI agents to reason about the repository as a structured system rather than raw text.

---

# Tool Registry

```text
packages/core/tool-registry/
```

Every executable capability is registered here.

Examples:

* Search files
* Read documentation
* Query memory
* Call APIs
* Send Discord messages
* Execute workflows

The runtime interacts with tools through this registry rather than directly.

This makes tools discoverable, replaceable, and easy to extend.

---

# Learning

```text
packages/core/learning/
```

Learning records observations from execution.

Examples:

* Successful strategies
* Common failures
* Execution metrics
* Tool effectiveness

Learning improves future execution.

Learning never changes source code.

---

# Model Router

```text
packages/core/model-router/
```

The Model Router decides which AI model should perform a task.

Selection criteria may include:

* Cost
* Latency
* Context size
* Structured output support
* Availability
* Local vs cloud execution

Routing policies can evolve without changing applications or domains.

---

# AI Package

```text
packages/ai/
```

This package encapsulates every interaction with language models.

Responsibilities include:

* Prompt construction
* Structured output parsing
* Embeddings
* Provider abstraction
* Token accounting
* Response normalization

The rest of the platform should never communicate directly with provider SDKs.

---

# Domain Packages

```text
packages/domains/
```

Domains contain business logic.

Current benchmark:

```text
fan-tracker/
```

A domain should define:

* Entities
* Use cases
* Rules
* Workflows
* Domain-specific tools

Domains should remain reusable.

Replacing one domain should never require changing the runtime.

---

# Tools

```text
packages/tools/
```

Tools perform work.

Unlike AI models, tools are deterministic.

Examples include:

* File operations
* Repository search
* HTTP requests
* Browser automation
* Notifications
* Scheduling

The AI decides when to use a tool.

The tool performs the action.

---

# Integrations

```text
packages/integrations/
```

Integrations connect the platform to external infrastructure.

Examples include:

* Discord
* Turso
* Redis
* Railway
* Ollama
* OpenAI
* Anthropic

Every integration should expose a clean abstraction.

Replacing providers should affect only this package.

---

# Shared Package

```text
packages/shared/
```

Shared contains reusable components that do not belong to a single package.

Examples:

* Logging
* Configuration
* Utilities
* Errors
* Constants
* Shared types

Shared should remain lightweight.

If functionality becomes domain-specific, move it elsewhere.

---

# Dependency Rules

The repository intentionally restricts dependencies.

```text
Applications
      │
      ▼
Core Runtime
      │
      ▼
AI + Domains
      │
      ▼
Tools
      │
      ▼
Integrations
```

Allowed dependencies:

* Applications → Core
* Core → AI
* Core → Tools
* Core → Domains
* Core → Shared
* Tools → Integrations
* Domains → Shared
* AI → Integrations

Forbidden examples:

* Domains → Discord
* Domains → OpenAI SDK
* Planner → Redis
* Applications → Turso
* AI Providers → Domain Logic

Keeping these boundaries clean ensures the architecture remains modular and replaceable.

---

# Architectural Summary

The repository should communicate its architecture without requiring readers to inspect implementation details.

Every directory, package, and module exists because it owns a specific responsibility.

The runtime orchestrates.

The AI reasons.

Domains define business rules.

Tools perform work.

Integrations connect infrastructure.

Together, these components form a platform capable of supporting many intelligent applications while remaining stable, modular, and maintainable.

# Agent Runtime

The Agent Runtime is the execution engine of the platform.

It is responsible for transforming an idea into a completed result.

Unlike traditional applications where business logic is scattered throughout the codebase, this platform centralizes orchestration inside the runtime while delegating specialized work to dedicated components.

The runtime should remain:

* Deterministic
* Observable
* Extensible
* Provider-independent
* Domain-independent

Its responsibility is orchestration—not intelligence.

---

# Runtime Philosophy

The runtime exists to answer one question:

> **How should this task be completed?**

The AI determines **what** should happen.

The runtime determines **how** it happens.

Every capability inside the runtime contributes to a predictable execution pipeline.

---

# Runtime Lifecycle

Every request follows the same lifecycle.

```text
Receive Request
       │
       ▼
Analyze Intent
       │
       ▼
Retrieve Context
       │
       ▼
Build Execution Plan
       │
       ▼
Validate Plan
       │
       ▼
Execute Tasks
       │
       ▼
Validate Results
       │
       ▼
Learn
       │
       ▼
Store Memory
       │
       ▼
Return Response
```

Every component in the platform integrates somewhere into this pipeline.

No package should bypass it.

---

# Runtime Components

The runtime consists of several independent systems.

```text
Agent Runtime
│
├── Planner
├── Task Manager
├── Validator
├── Memory
├── Cache
├── Knowledge
├── Learning
├── Repository Intelligence
├── Tool Registry
└── Model Router
```

Each component owns exactly one capability.

---

# Request Lifecycle

## Stage 1 — Receive Request

Applications communicate with the runtime.

Examples:

Discord

REST API

CLI

Future interfaces:

* Slack
* Telegram
* Web UI
* Email

Applications never execute business logic.

Their only responsibility is forwarding requests.

---

## Stage 2 — Intent Analysis

Before creating a plan, the runtime must understand the user's objective.

Questions include:

* What is the goal?
* Which domain owns this request?
* Which knowledge is required?
* Which tools may be needed?
* Is clarification required?

The result is an internal representation of the task.

---

## Stage 3 — Context Retrieval

Before reasoning begins, the runtime gathers context.

Possible sources:

* Memory
* Knowledge Base
* Repository Intelligence
* Domain Data
* External APIs

Good planning depends on complete context.

---

## Stage 4 — Planning

The Planner transforms intent into structured execution.

Example:

User:

> Update the Fan Tracker database.

Execution plan:

```text
1. Retrieve latest repository state
2. Read cached metadata
3. Compare differences
4. Build update tasks
5. Validate changes
6. Execute
7. Verify
```

Planning is descriptive.

Execution has not begun yet.

---

## Stage 5 — Plan Validation

Before work begins the runtime validates the execution plan.

Checks include:

* Missing dependencies
* Missing permissions
* Missing knowledge
* Invalid task order
* Circular dependencies

Bad plans should fail before execution.

---

# Task Execution

Once validated, the Task Manager executes work.

Responsibilities include:

* Scheduling
* Dependency tracking
* Retries
* Timeouts
* Progress reporting
* Failure recovery

Execution should be observable.

Every task has a lifecycle.

```text
Pending
   │
Running
   │
Completed
```

or

```text
Pending
   │
Running
   │
Failed
   │
Retry
```

The runtime should always know the state of every task.

---

# Parallel Execution

Not every task depends on another.

The runtime should identify independent work.

Example:

```text
Download Data
        │
        ├──────┐
        ▼      ▼
Analyze  Validate
        │
        └──┬───┘
           ▼
Store
```

Parallel execution improves throughput while preserving correctness.

---

# Tool Invocation

The runtime never performs work directly.

Instead it delegates.

Example:

Planner

↓

Task Manager

↓

Tool Registry

↓

Repository Tool

↓

Filesystem

This separation keeps orchestration independent from implementation.

---

# Validation Pipeline

Every completed task passes through validation.

Validation determines:

* Success
* Partial success
* Failure
* Retry required
* Human review required

Validation protects downstream components from bad outputs.

---

# Failure Recovery

Failure is expected.

The runtime should recover whenever possible.

Recovery strategies include:

* Retry
* Alternative tool
* Alternative AI provider
* Re-plan
* Human escalation

Failures are opportunities for learning.

---

# Observability

Every execution should produce telemetry.

Metrics include:

* Runtime duration
* Planning duration
* Model latency
* Tool latency
* Success rate
* Retry count
* Validation failures
* Token usage
* Estimated cost

Observability enables optimization.

Without measurement there is no improvement.

---

# Event-Driven Architecture

Components should communicate through events whenever practical.

Examples:

```text
Task Planned

↓

Task Started

↓

Tool Executed

↓

Validation Completed

↓

Memory Updated

↓

Task Finished
```

Benefits include:

* Loose coupling
* Easier debugging
* Better monitoring
* Future distributed execution

---

# Runtime State

Every request owns an execution context.

The context contains:

* Request ID
* User ID
* Active Domain
* Selected Model
* Active Memory
* Current Plan
* Task Status
* Validation Results

The execution context exists only for the lifetime of the request.

Long-term information belongs in Memory.

---

# Cancellation

Execution should always be cancellable.

Possible reasons:

* User request
* Timeout
* Resource limits
* Invalid plan
* Infrastructure failure

Cancellation should leave the system in a consistent state.

---

# Timeouts

Every operation should have limits.

Examples:

* AI response timeout
* Tool timeout
* Database timeout
* Repository indexing timeout

The runtime should fail gracefully rather than hanging indefinitely.

---

# Runtime Guarantees

The runtime guarantees:

✓ Every request follows the same lifecycle.

✓ Plans are validated before execution.

✓ Every task has observable state.

✓ Failures are recorded.

✓ Learning occurs after execution.

✓ Memory updates happen only after successful validation.

---

# Runtime Boundaries

The runtime intentionally does **not**:

* Know business rules
* Call provider SDKs directly
* Depend on Discord
* Depend on OpenAI
* Depend on Turso
* Know Fan Tracker logic

Those responsibilities belong elsewhere.

Keeping the runtime independent allows the platform to support any future domain.

---

# Execution Example

User:

> Find every new Umamusume character and update the tracker.

The runtime might execute:

```text
Receive Request
        │
        ▼
Identify Fan Tracker Domain
        │
        ▼
Retrieve Memory
        │
        ▼
Read Repository Knowledge
        │
        ▼
Generate Plan
        │
        ▼
Validate Plan
        │
        ▼
Execute Web Search
        │
        ▼
Compare Existing Data
        │
        ▼
Generate Update Tasks
        │
        ▼
Validate Changes
        │
        ▼
Store Memory
        │
        ▼
Return Summary
```

Notice that the runtime never needs to understand what an Umamusume character is.

It simply coordinates execution.

The domain package owns the business rules.

---

# Runtime Design Goals

The runtime should become increasingly capable without becoming increasingly complicated.

New features should integrate into existing workflows rather than introducing new execution paths.

A predictable runtime is easier to debug, easier to monitor, easier for AI agents to reason about, and significantly easier to maintain over the lifetime of the platform.

# Intelligence Layer

The Intelligence Layer is what transforms the platform from a workflow engine into an AI Agent Platform.

Unlike the Runtime, which is responsible for orchestration, the Intelligence Layer is responsible for providing context, reasoning support, historical knowledge, and model capabilities.

It answers questions such as:

* What does the agent already know?
* What information should be retrieved?
* Which model should solve this task?
* Has this problem been solved before?
* What can be learned from previous executions?

The Intelligence Layer never executes business logic.

Instead, it supplies the Runtime with the information required to make intelligent decisions.

---

# Intelligence Architecture

```text
                    Intelligence Layer
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
     Memory            Knowledge           Repository
                                             Intelligence
        │                   │                   │
        └──────────────┬────┴──────────────┬────┘
                       ▼                   ▼
                  Model Router      Learning Engine
                            │
                            ▼
                     AI Providers
```

Each component has a distinct responsibility.

None of them should duplicate another.

---

# Memory

```text
packages/core/memory/
```

Memory represents everything the platform remembers over time.

Memory is persistent.

It survives restarts.

It survives deployments.

It grows through experience.

Current storage:

* Turso

---

## Purpose

Memory answers:

> **"What has happened before?"**

Examples include:

* Previous conversations
* Execution history
* User preferences
* Observations
* Learned facts
* Project decisions
* Historical context

Memory should become richer as the platform is used.

---

## Memory Characteristics

Memory should be:

* Persistent
* Searchable
* Versioned
* Observable
* Provider-independent

Memory should never exist only inside the AI model.

The model forgets.

Memory does not.

---

## Memory Categories

The platform may store multiple categories of memory.

```text
Memory
│
├── User Memory
├── Task Memory
├── Project Memory
├── Learning Memory
├── Execution History
├── Domain Memory
└── System Memory
```

Each category serves a different purpose.

---

## User Memory

Stores long-term user information.

Examples:

* Preferences
* Frequently used commands
* Favorite workflows

---

## Task Memory

Stores historical execution.

Examples:

* Previous plans
* Previous failures
* Successful workflows
* Retry history

---

## Project Memory

Stores architectural knowledge.

Examples:

* Decisions
* Standards
* Repository conventions

---

# Knowledge System

```text
packages/core/knowledge/
```

Knowledge is different from Memory.

Memory stores experiences.

Knowledge stores information useful for reasoning.

Knowledge answers:

> **"What should the AI know?"**

Sources may include:

* Documentation
* Memory
* Repository analysis
* External APIs
* Domain information

---

## Knowledge Pipeline

```text
External Sources
        │
        ▼
Knowledge Collection
        │
        ▼
Knowledge Processing
        │
        ▼
Knowledge Store
        │
        ▼
Planner
```

Knowledge should be curated.

Not everything belongs in Knowledge.

---

## Knowledge Retrieval

Before planning begins the runtime should retrieve relevant knowledge.

Possible retrieval strategies:

* Semantic search
* Keyword search
* Repository lookup
* Memory lookup
* Domain lookup

The planner should receive only the most relevant information.

---

# Cache

```text
packages/core/cache/
```

Cache exists for performance.

Nothing inside cache should be considered permanent.

Examples:

* Repository index
* Embeddings
* API responses
* Tool outputs
* AI responses
* Search results

If cache disappears, the system should continue functioning.

It may become slower.

It should never become incorrect.

---

## Cache Principles

Cache should be:

* Fast
* Disposable
* Rebuildable
* Time-sensitive

Never store permanent knowledge in cache.

---

# Repository Intelligence

```text
packages/core/repository-intelligence/
```

Repository Intelligence is one of the defining capabilities of the platform.

Traditional AI systems treat source code as plain text.

Repository Intelligence treats the repository as an interconnected system.

The agent should understand:

* Packages
* Dependencies
* Responsibilities
* Ownership
* Architecture

Rather than individual files.

---

## Responsibilities

Repository Intelligence should:

* Index source code
* Parse project structure
* Understand package ownership
* Analyze dependencies
* Detect architecture violations
* Locate implementation points
* Discover documentation
* Recommend extension points

---

## Repository Index

The repository should be indexed into a searchable representation.

```text
Repository
      │
      ▼
Indexer
      │
      ▼
Repository Database
      │
      ▼
Semantic Search
```

This enables fast retrieval without repeatedly scanning the repository.

---

## Architectural Awareness

The platform should understand:

```text
Planner
        │
depends on
        ▼
Task Manager

Task Manager
        │
uses
        ▼
Tool Registry
```

Rather than simply:

```text
planner.js imports task-manager.js
```

Understanding architecture enables higher quality planning.

---

# Learning Engine

```text
packages/core/learning/
```

Learning records observations after execution.

It exists to answer:

> **"How can the platform improve next time?"**

Learning produces knowledge.

It does not modify code.

---

## Learning Inputs

The Learning Engine observes:

* Successes
* Failures
* Execution time
* Validation reports
* Tool performance
* Model performance
* Retry counts
* User feedback

---

## Learning Outputs

Learning may produce:

* Better planning hints
* Better routing policies
* Better validation rules
* Better tool recommendations

These outputs become future knowledge.

---

## Learning Pipeline

```text
Execution
      │
      ▼
Observation
      │
      ▼
Analysis
      │
      ▼
Knowledge
      │
      ▼
Future Planning
```

Experience should compound over time.

---

# Model Router

```text
packages/core/model-router/
```

Different tasks require different models.

The Model Router selects the most appropriate provider.

---

## Example Routing

```text
Short Question
        │
        ▼
Small Model

Large Planning Task
        │
        ▼
Large Context Model

Repository Analysis
        │
        ▼
Coding Model

Embedding Request
        │
        ▼
Embedding Provider
```

Applications should never choose models directly.

The runtime delegates that decision.

---

## Routing Factors

Selection may consider:

* Cost
* Latency
* Context window
* Structured output support
* Reasoning capability
* Availability
* Local vs Cloud

Routing policies should evolve through learning.

---

# AI Provider Abstraction

```text
packages/ai/providers/
```

Every AI provider implements the same interface.

Example providers:

* OpenAI
* Anthropic
* Ollama
* OpenRouter
* Gemini
* Future providers

The rest of the platform should never depend on vendor SDKs.

---

## Provider Interface

Every provider should support:

* Chat
* Structured Outputs
* Streaming
* Embeddings (where available)
* Token accounting
* Error normalization

This keeps providers interchangeable.

---

# Prompt Management

```text
packages/ai/prompts/
```

Prompts are treated as application assets.

Responsibilities include:

* Versioning
* Templates
* Variables
* Reusable system prompts
* Domain prompts
* Validation prompts

Prompts should remain organized and testable.

---

# Structured Outputs

The platform should strongly prefer structured responses over free-form text.

Example:

```json
{
  "tasks": [],
  "confidence": 0.93,
  "reasoning": "...",
  "tools": []
}
```

Structured outputs improve:

* Validation
* Reliability
* Tool execution
* Debugging

---

# Embeddings

Embeddings support semantic retrieval.

Possible uses:

* Repository search
* Documentation search
* Memory retrieval
* Knowledge retrieval

Embeddings are infrastructure.

They are not memory.

---

# Intelligence Principles

The Intelligence Layer follows several guiding principles.

* Knowledge should grow.
* Memory should persist.
* Cache should expire.
* Models should be replaceable.
* Learning should compound.
* Planning should improve.
* Architecture should remain stable.

---

# Intelligence Boundaries

The Intelligence Layer intentionally does **not**:

* Execute workflows
* Own business logic
* Modify source code
* Control applications
* Replace the runtime

Instead, it empowers the runtime with context and reasoning support.

---

# Intelligence Summary

The Runtime executes.

The Intelligence Layer informs.

Memory remembers.

Knowledge teaches.

Repository Intelligence understands.

Learning improves.

The Model Router chooses.

AI Providers reason.

Together they provide the capabilities required to build intelligent, reusable, and continuously improving AI agents without sacrificing architectural stability.


