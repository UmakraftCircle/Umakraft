# Umakraft Platform — Final Architecture Specification

**Project:** Umakraft Turborepo  
**Status:** Completed (Phases 1–10 Integrated)  
**Date:** 2026-09-09  

---

## Executive Summary

The Umakraft Turborepo has completed its end-to-end architectural transformation from loosely coupled, duplicated execution paths into a unified, high-performance, layer-by-layer asynchronous execution engine. 

The engine guarantees:
1. **Layer-by-Layer Scheduling**: Execution is structured into mathematically verified topological layers where parallel tasks execute concurrently and downstream dependencies run strictly after upstream layers complete.
2. **Context Isolation & Deterministic Disposal**: File buffers and contextual embeddings are loaded on-demand per task and deterministically purged via `IDisposable` lifecycle hooks to eliminate memory leaks.
3. **Stateless Tool Capability Registry**: Tools declare semantic capabilities with lazy dynamic loading, schema isolation, and security sanitization.
4. **Resilient Model Routing**: Dynamic model routing with automatic fallback cascades, cost budgets, and latency awareness.
5. **Contextual Memory Pipeline**: Relevant long-term and short-term memories retrieved using token-budget-aware vector cosine similarity.
6. **Real-time Event Streaming**: Fine-grained SSE and event emitter channels streaming execution lifecycle events (`layer.started`, `task.progress`, `tool.invoked`).
7. **Resumable Checkpoints & Recovery**: Immutable state snapshots persisted at layer boundaries enabling zero-loss recovery from task failures.
8. **Observability & Diagnostics**: Append-only telemetry engine operating under the Observational Invariance Principle to record spans, model tokens, tool latency, and layer performance without altering execution logic.

---

## 1. Final Execution Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Request                         │
│       (REST API / Web UI / CLI / Discord Integration)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Planner & Model Router                     │
│  • Intention parsing & tool capability match                │
│  • Kahn's algorithm cycle detection (DAG validation)        │
│  • Topological layer calculation (Layer 0, 1, ..., N)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            DagScheduler & ExecutionEngine (Phase 4 & 8)      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Checkpoint Engine (Phase 9)                           │  │
│  │ • Save layer snapshot before execution                │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ Layer N Concurrent Execution Pool                     │  │
│  │   Task A                   Task B                     │  │
│  │   ┌─────────────────────┐  ┌─────────────────────┐    │  │
│  │   │ Lazy Context (Ph.3) │  │ Lazy Context (Ph.3) │    │  │
│  │   │ Memory Vector (Ph.7)│  │ Memory Vector (Ph.7)│    │  │
│  │   │ Model Router (Ph.5) │  │ Model Router (Ph.5) │    │  │
│  │   │ Capability (Ph.6)   │  │ Capability (Ph.6)   │    │  │
│  │   │ Stream Event (Ph.8) │  │ Stream Event (Ph.8) │    │  │
│  │   └──────────┬──────────┘  └──────────┬──────────┘    │  │
│  │              │                        │               │  │
│  │              ▼                        ▼               │  │
│  │      Context Disposal         Context Disposal        │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ Telemetry Engine (Phase 10)                           │  │
│  │ • Record layer & tool metrics, token usage, failures  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Aggregated Result & Diagnostics                │
│   (ExecutionPlan results, Trace Spans, Telemetry Stats)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities

| Package / Module | Layer Responsibility | Key Interfaces & Classes |
| :--- | :--- | :--- |
| `packages/core/src/scheduler.ts` | Orchestrates topological execution layers, manages concurrency, drives telemetry, and triggers checkpoints | `DagScheduler`, `SchedulerOptions` |
| `packages/core/src/agent-runner.ts` | High-level orchestrator connecting plan creation, scheduler execution, synthesis, and recovery | `AgentRunner`, `AgentRunOptions`, `AgentRunResult` |
| `packages/core/src/context.ts` | Task-scoped lazy file loading, token estimation, and deterministic memory disposal | `ExecutionContext`, `ContextScope`, `IDisposable` |
| `packages/core/src/task-executor.ts` | Executes individual tasks with retry backoff, jitter, timeout controls, and tool capability resolution | `DefaultTaskExecutor`, `TaskExecutor` |
| `packages/core/src/checkpoint.ts` | Captures, serializes, restores, and resumes execution state at layer and task boundaries | `CheckpointManager`, `ExecutionCheckpoint` |
| `packages/core/src/telemetry.ts` | Independent observer collecting trace spans, latencies, tokens, and execution diagnostics | `TelemetryEngine`, `ExecutionDiagnostics` |
| `packages/core/src/streaming.ts` | Event stream protocol providing real-time lifecycle events to consumers | `ExecutionEventStream`, `AgentExecutionEvent` |
| `packages/tools/src/registry.ts` | Lazy-loading, capability-isolated, sandboxed tool provider and declarative schema generator | `ToolRegistry`, `ToolDefinition`, `ToolCapability` |
| `packages/ai/src/model-router.ts` | Intent-driven LLM selector managing token budgets, latency SLAs, and provider fallbacks | `ModelRouter`, `RouteStrategy`, `ModelSelection` |
| `packages/core/src/memory-retriever.ts` | Cosine similarity vector search pipeline over short-term and long-term memory embeddings | `MemoryRetriever`, `VectorStore`, `MemorySearchResult` |
| `packages/shared/src/logger/` | Standardized structured JSON logging with contextual trace propagation | `logger`, `createScopedLogger` |

---

## 3. Dependency Graph & Kahn's Algorithm Validation

The execution engine represents multi-step plans as a Directed Acyclic Graph (DAG) $G = (V, E)$.

1. **Cycle Detection**: Validated ahead-of-time in `packages/core/src/validator.ts` via Kahn's algorithm:
   - Calculate in-degrees for all task nodes.
   - Nodes with zero in-degree are placed in the initial queue.
   - Enqueued nodes remove their outgoing edges; newly zero in-degree nodes enter the queue.
   - If topological sort visited count $\ne |V|$, cycle detected and execution rejected with specific circular nodes identified.
2. **Topological Layer Partitioning**:
   - `Layer 0`: Tasks with in-degree 0 (no dependencies).
   - `Layer L+1`: Tasks whose dependencies are entirely satisfied within layers $0 \dots L$.
   - Ensures maximal parallelism within each layer while enforcing strict causal ordering across layers.

---

## 4. Context Lifecycle & Memory Safety

Each task in a layer executes within its own ephemeral `ExecutionContext`:

1. **Lazy Loading**: File contents and contextual buffers are only loaded from disk or remote cache when accessed by the task.
2. **Context Budgets**: Context window token usage is tracked. Excess tokens trigger prioritized compression.
3. **Deterministic Cleanup (`IDisposable`)**:
   ```typescript
   const context = contextScope.createTaskContext(task.id);
   try {
     await executor.execute(task, context);
   } finally {
     context.dispose(); // Clears memory buffers, closes file handles, resets caches
   }
   ```
4. **Garbage Collection Optimization**: Eliminates cross-task state leaks and prevents memory growth during long-running batch workflows.

---

## 5. Scheduler Lifecycle & Concurrency Engine

The `DagScheduler` lifecycle adheres to strict transactional stages:

1. **Plan Ingestion**: Validates tasks, ensures layer assignments, builds execution state.
2. **Checkpoint Initialization**: Persists plan metadata and creates baseline state snapshot.
3. **Layer Loop**:
   - `recordLayerStart`: Emits telemetry span and streaming event.
   - `Snapshot`: Captures current execution state.
   - `Concurrent Task Execution`: All tasks within current layer dispatched concurrently using `Promise.allSettled`.
   - `Failure Evaluation`: If any task fails after retries, execution aborts or triggers recovery policies.
   - `recordLayerEnd`: Measures total layer latency and registers status.
4. **Finalization**: Disposes resources, finalizes telemetry trace, and produces immutable `ExecutionPlanResult`.

---

## 6. Memory Pipeline

The memory retrieval pipeline in `packages/core/src/memory-retriever.ts`:

- **Hierarchical Storage**: Integrates working memory (current session), short-term task context, and persistent long-term SQLite/vector records.
- **Contextual Querying**: Combines user intent and task tool arguments to formulate embedding search queries.
- **Cosine Similarity & Thresholding**: Matches memories against top-$k$ relevant vectors above a configurable similarity threshold ($\ge 0.70$).
- **Token Budget Guardrail**: Enforces memory injection token budgets so memory never overflows LLM context windows.

---

## 7. Tool Capability Flow & Sandboxing

The tool subsystem in `packages/tools/`:

1. **Capability Isolation**: Tools declare granular scopes (`filesystem:read`, `filesystem:write`, `network:fetch`, `database:write`).
2. **Lazy Registration**: Tool modules are loaded dynamically on first execution, avoiding initialization penalties.
3. **Parameter Schema Sanitization**: Raw handlers are stripped when producing declarative schemas for LLM function calling (`getDeclarativeSchemas()`).
4. **Safe Invocation**: Handlers execute with timeout protection and structured error boxing so tool exceptions never crash the runtime loop.

---

## 8. Model Routing Strategy

The `ModelRouter` selects the optimal LLM dynamically:

- **Tier-Based Classification**:
  - `fast` / `lightweight`: For planning, routing, classification, or small summaries (e.g., Claude 3.5 Haiku, Gemini Flash).
  - `standard` / `reasoning`: For multi-step code generation and complex tool coordination (e.g., Claude 3.5 Sonnet, GPT-4o).
  - `heavy` / `deep`: For exhaustive research, verification, and multi-document synthesis.
- **Dynamic Fallbacks**: Transparent failover to backup providers if rate limits or network errors occur.
- **Cost & Latency Tracking**: Invocations log token usage and latency directly to the Telemetry Engine.

---

## 9. Checkpoint & Recovery Workflow

Implemented in `packages/core/src/checkpoint.ts`:

- **Layer-Boundary Snapshotting**: Saves the exact state of all tasks, outputs, layer index, and dependencies.
- **Serialization Safety**: Serializes runtime Maps and Sets cleanly into transportable JSON checkpoints.
- **Resume Without Re-execution**: Upon crash or planned pause, `CheckpointManager.resume(checkpoint)` marks completed tasks as settled, reinstates intermediate outputs, and resumes scheduling exactly from the uncompleted layer.

---

## 10. Telemetry & Observability Architecture

Operating under the **Observational Invariance Principle**:

- **Decoupled Observation**: Telemetry passively observes execution events. Telemetry errors are caught internally and will never alter plan execution flow.
- **Execution Spans**: Records hierarchical spans: `Execution` $\rightarrow$ `Layer` $\rightarrow$ `Task` $\rightarrow$ `Tool` / `Model`.
- **Diagnostic Answers**: Instantly extracts slowest layer, slowest tool, total token counts, peak context sizes, and exact failure coordinates.
- **Structured JSON Logging**: Centralized logging in `packages/shared/src/logger` outputs structured entries containing timestamp, level, category, and trace IDs.
