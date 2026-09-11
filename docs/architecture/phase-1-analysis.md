# Phase 1 Analysis — Architecture Discovery

**Project:** Umakraft  
**Phase:** 1 — Analyze Existing Architecture (Read Only)  
**Status:** Complete  
**Date:** 2026-09-07  

---

## Executive Summary

This document maps the execution pipeline, module responsibilities, dependency relationships, and architectural bottlenecks across `packages/core`, `packages/ai`, `packages/tools`, and `packages/shared`. 

The system currently supports two distinct execution paradigms:
1. **Plan-and-Execute (DAG):** Governed by `AgentRunner` → `Planner` → `TaskManager` → `ToolRegistry`.
2. **Conversational ReAct Loop (Step-by-Step):** Governed by `ToolCallingAgent` → `AIService` → `ToolRegistry`.

Both pipelines operate independently, leading to duplicated control policies (timeouts, limits, error handling) and leaving certain components (such as `ModelRouter`) completely unintegrated into active execution.

---

## 1. Current Pipeline

### Pipeline A: Multi-Step Autonomous Plan-and-Execute (`/agent`)

```
User (Discord / CLI)
  │
  ▼
apps/discord/src/agent.ts: handleAgent()
  │
  ├─► Ensure Tools Registered (ToolRegistry.getInstance().register(...))
  ├─► buildAIService()
  │
  ▼
packages/core/src/agent-runner.ts: AgentRunner.run(userId, goal, context)
  │
  ├── 1. Generate Task ID & Persist Initial State (TaskStateStore)
  │
  ├── 2. packages/core/src/planner.ts: Planner.plan(goal)
  │     ├── ToolRegistry.getDeclarativeSchemas()
  │     ├── AIService.generateStructuredOutput(RawPlanSchema)
  │     ├── Zod Validation (RawPlanSchema)
  │     └── validator.ts: validateExecutionPlan() [Cycle detection via Kahn's algorithm]
  │
  ├── 3. Enforce Step Limit (maxPlanSteps)
  │
  ├── 4. packages/core/src/task-manager.ts: TaskManager.executePlan(plan)
  │     ├── Evaluate Dependency Graph (depsMet check in loop)
  │     ├── Parallel Execution Queue (activePromises / Promise.race)
  │     ├── Retry Loop & Backoff (runTaskWithRetry, exponential backoff + jitter)
  │     └── ToolRegistry.execute(slug, args)
  │           └── tool.handler(args)
  │
  ├── 5. Enforce Tool Limits & Redact Outputs (maxToolCalls, maxWebSearches)
  ├── 6. Synthesize Final Answer (AgentRunner.synthesize string formatting)
  └── 7. Persist Final State & Return AgentRunResult
```

### Pipeline B: Single-Turn / Conversational Tool Calling (`/ask`, `/chat`)

```
User (Discord / CLI)
  │
  ▼
apps/discord/src/ask.ts: handleAsk() or chat.ts: handleChat()
  │
  ▼
packages/core/src/tool-calling-agent.ts: ToolCallingAgent.runWithTrace()
  │
  ├── 1. ToolRegistry.getDeclarativeSchemas(toolSlugs)
  ├── 2. Calculate Token Budget (inputTokenBudget, reserve for system prompt + schemas)
  │
  ├── 3. Loop (step = 0 .. maxToolCalls):
  │     ├── Trim Context & Transcript if over budget (chars / 4 heuristic)
  │     ├── AIService.generateStructuredOutput({ schema: DecisionSchema, tools })
  │     │     └── Provider (e.g. OpenAIProvider / Groq) with native tool declarations
  │     ├── Validate Decision (action + parameters OR answer)
  │     │
  │     ├── IF decision.answer:
  │     │     └── Return final answer string
  │     │
  │     └── IF decision.action:
  │           ├── Check toolCallCount & webSearchCount limits
  │           ├── ToolRegistry.execute(action, parameters)
  │           ├── Truncate & compact result (compactToolResult)
  │           └── Append to transcript string; continue loop
  │
  └── 4. Return Final Answer or Limit Fallback Message
```

---

## 2. Responsibility Map

| File | Primary Responsibility | Key Interfaces / Methods | Dependencies |
| :--- | :--- | :--- | :--- |
| `packages/core/src/agent-runner.ts` | High-level orchestration of multi-step plans; manages execution limits, task state persistence, overall timeouts, and answer synthesis. | `AgentRunner.run()`, `synthesize()`, `withOverallTimeout()` | `Planner`, `TaskManager`, `ToolRegistry`, `AIService`, `TaskStateStoreLike` |
| `packages/core/src/planner.ts` | Translates natural language intent into a validated Directed Acyclic Graph (DAG) of tasks without executing tools. | `Planner.plan()` | `AIService`, `ToolRegistry`, `validateExecutionPlan`, `RawPlanSchema` |
| `packages/core/src/task-manager.ts` | Executes an `ExecutionPlan` by resolving dependencies, dispatching runnable tasks in parallel, and handling retries with exponential backoff. | `TaskManager.executePlan()`, `runTaskWithRetry()` | `ToolRegistry`, `@ai-agent-platform/shared` |
| `packages/core/src/tool-registry.ts` | Central in-memory registry for tool definitions; validates argument types against schemas; executes tool handlers; redacts sensitive keys from logs. | `ToolRegistry.getInstance()`, `register()`, `getDeclarativeSchemas()`, `execute()` | `@ai-agent-platform/shared` |
| `packages/core/src/validator.ts` | Schema validation and graph validation; detects dependency cycles using Kahn's algorithm; validates tool arguments against type definitions. | `validateExecutionPlan()`, `validateToolArguments()`, `detectCycles()` | `zod`, `@ai-agent-platform/shared` |
| `packages/core/src/model-router.ts` | Evaluates model candidates against capability, token limits, and cost constraints; selects the most cost-effective provider profile. | `ModelRouter.route()`, `getAvailableModels()` | `@ai-agent-platform/shared` |
| `packages/core/src/tool-calling-agent.ts` | Iterative reasoning and tool execution loop; token budget estimation; context trimming; native tool execution. | `ToolCallingAgent.run()`, `runWithTrace()` | `AIService`, `ToolRegistry`, `zod` |
| `packages/core/src/ToolCallingAgent.ts` | Reference deterministic tool-calling loop; features per-tool budget maps, call fingerprinting, repeat detection, and stop-short early finalization. | `ToolCallingAgent.run()`, `fingerprintCall()` | Self-contained (accepts `complete` callback) |
| `packages/core/src/repo-indexer.ts` | AST/regex symbol extraction and dependency analysis of workspace repository files. | `RepoIndexer.index()`, `query()` | `fs/promises`, `path` |
| `packages/core/src/memory-store.ts` | SQLite-backed persistent store for observational failure records and self-healing adaptation rules. | `MemoryStore.getInstance()`, `saveObservation()`, `saveRule()` | `@ai-agent-platform/integrations` |
| `packages/core/src/cache-store.ts` | In-memory TTL cache with LRU eviction, background sweep timer, and in-flight request deduplication. | `CacheStore.get()`, `set()`, `getOrSet()` | `@ai-agent-platform/shared` |
| `packages/core/src/knowledge-graph.ts` | In-memory directed graph of knowledge entities and relations. | `KnowledgeGraph.addEntity()`, `addRelation()`, `query()` | `@ai-agent-platform/shared` |
| `packages/core/src/learning.ts` | Observational learning engine; turns execution failures into persistent adaptation rules. | `LearningEngine.recordFailure()`, `suggestFix()` | `MemoryStore`, `@ai-agent-platform/shared` |
| `packages/ai/src/index.ts` | Abstract base class `AIService` and standard generation options interface. | `AIService.generate()`, `generateStructuredOutput()`, `getCurrentModel()` | `@ai-agent-platform/shared` |
| `packages/ai/src/providers.ts` | Provider implementations (`OpenAIProvider`, `AnthropicProvider`); native function tool calling; 429 backoff retry loops; Groq fallback models. | `OpenAIProvider`, `AnthropicProvider`, `sanitizeGroqModel()` | `fetch`, `@ai-agent-platform/shared` |
| `packages/ai/src/agent-system.ts` | Canonical agent personas, safety guidelines, and domain block composers. | `buildSystemPrompt()`, `AGENT_SYSTEM_PROMPT` | Standalone string templates |
| `packages/tools/src/index.ts` | Standard system tools (filesystem read/write with workspace sandbox; re-exports web and notification tools). | `filesystemWriteFile`, `filesystemReadFile`, `allTools` | `fs/promises`, `path`, `@ai-agent-platform/shared` |
| `packages/shared/src/types.ts` | Core domain types (`ExecutionPlan`, `AgentTask`, `ToolDefinition`, `ToolResult`, `TaskStatus`). | Type definitions | None |

---

## 3. Dependency Graph

### Core Execution Flow

```
                     ┌──────────────────┐
                     │   User Request   │
                     └────────┬─────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       [Multi-Step Goal]             [Conversational]
               │                             │
               ▼                             ▼
       ┌──────────────┐            ┌───────────────────┐
       │ AgentRunner  │            │ ToolCallingAgent  │
       └───┬──────┬───┘            └─────────┬─────────┘
           │      │                          │
           │      ▼                          │
           │  ┌─────────┐                    │
           │  │ Planner │                    │
           │  └───┬─────┘                    │
           │      │                          │
           │      ▼                          │
           │  ┌───────────┐                  │
           │  │ Validator │                  │
           │  └─────┬─────┘                  │
           ▼        │                        │
     ┌─────────────┐│                        │
     │ TaskManager ││                        │
     └──────┬──────┘│                        │
            │       │                        │
            ▼       ▼                        ▼
       ┌─────────────────┐           ┌──────────────┐
       │  ToolRegistry   │◄──────────┤  AIService   │
       └────────┬────────┘           └──────┬───────┘
                │                           │
                ▼                           ▼
       ┌─────────────────┐           ┌──────────────┐
       │   Tool Handlers │           │ Model Router │
       │  (Files/Web)    │           │ (Unconnected)│
       └─────────────────┘           └──────────────┘
```

### Module Dependency Matrix

```
@ai-agent-platform/core
├── imports @ai-agent-platform/shared (types, logger, errors)
├── imports @ai-agent-platform/ai (AIService, prompt builders)
└── optionally integrates @ai-agent-platform/integrations (taskStateStore, sqlite)

@ai-agent-platform/tools
└── imports @ai-agent-platform/shared (ToolDefinition, ToolResult)

@ai-agent-platform/ai
└── imports @ai-agent-platform/shared (logger, config)
```

---

## 4. Architecture Questions Answered

### 1. Entry Point
* **What file starts the execution?**
  * Multi-step autonomous execution: `packages/core/src/agent-runner.ts` (invoked via `apps/discord/src/agent.ts`).
  * Single-turn tool execution: `packages/core/src/tool-calling-agent.ts` (invoked via `apps/discord/src/ask.ts` and `apps/discord/src/chat.ts`).
* **What method receives the user request?**
  * `AgentRunner.run(userId: string, goal: string, context?: { guildId?: string | null; channelId?: string | null }): Promise<AgentRunResult>`
  * `ToolCallingAgent.run(userId: string, userMessage: string, context?: string, options?: ToolCallingAgentOptions): Promise<string>`
* **What object represents the request?**
  * In `AgentRunner`, the request starts as primitive arguments (`userId`, `goal`, `context`), which are mapped into an in-memory execution task:
    * `taskId`: string (`task-${Date.now()}-${random}`)
    * `ExecutionPlan`: `{ id: string, intent: string, tasks: Map<string, AgentTask>, metadata: { modelUsed, createdAt, estimatedSteps } }`
  * In `ToolCallingAgent`, the request is represented by primitive strings (`userId`, `userMessage`, `context`) and an options object (`ToolCallingAgentOptions`).

### 2. Planner
* **Is planning already separated?**
  * **Yes.** `Planner` (`packages/core/src/planner.ts`) is completely isolated in its own class.
* **Does planner execute tools?**
  * **No.** It only inspects tool schemas via `this.registry.getDeclarativeSchemas()` to provide the LLM with tool definitions. It does not invoke any tool handlers.
* **What should remain in planner?**
  * Translating user intent into a sequence of operations.
  * Zod schema parsing of AI outputs (`RawPlanSchema`).
  * Validating dependency graph integrity and cycle detection (`validateExecutionPlan`).
  * Returning the structured `ExecutionPlan`.

### 3. Executor
* **Which class currently performs orchestration?**
  * **`AgentRunner`** orchestrates the top-level Plan-and-Execute lifecycle (`Planner` → `TaskManager` → State Persistence → Answer Synthesis).
  * **`TaskManager`** orchestrates the internal parallel execution of the task DAG.
* **Is it mixing multiple responsibilities?**
  * **Yes.** 
    * `AgentRunner` mixes workflow control, timeout management, database persistence (`TaskStateStore`), tool limit audits, duplicate action detection, and Markdown formatting (`synthesize`).
    * `TaskManager` mixes task graph traversal (scheduling) with execution concerns: inline retry loops, exponential backoff, error string regex matching (`isRetryable`), and direct tool execution.
* **Which methods belong in a scheduler?**
  * `TaskManager.executePlan()` logic that:
    * Identifies executable tasks whose dependencies are met (`depsMet`).
    * Manages the active concurrency pool (`activePromises`, `Promise.race`).
    * Detects deadlocks (unmet dependencies with no running tasks).
    * Tracks task state transitions (`pending` → `running` → `completed` | `failed`).
  * *Note:* The actual task execution, retries, backoff sleep, and tool invocation (`runTaskWithRetry`) should be separated from the scheduler into an execution worker/strategy.

### 4. Context
* **Where are repository files loaded?**
  * In `packages/core/src/repo-indexer.ts`, `RepoIndexer` walks the repository directory, parses files for symbols and imports, and stores them in `Map<string, FileIndex>`.
  * In `packages/tools/src/index.ts`, `filesystemReadFile` reads workspace files directly on demand via tool calls.
* **Where are memories retrieved?**
  * `packages/core/src/memory-store.ts` retrieves persistent learning observations and rules from SQLite.
  * `packages/core/src/knowledge-graph.ts` maintains in-memory entity relations.
  * `apps/discord/src/ask.ts` pulls previous session context from `conversationMemoryStore`.
* **Is context reusable or global?**
  * **Inconsistent:**
    * Storage layers (`MemoryStore`, `ToolRegistry`) are global singletons.
    * Conversation context in `ToolCallingAgent` is per-request, transient, and modified in place with lossy string slicing.
    * There is no unified `ExecutionContext` object passed across Planner, Scheduler, and Tools.

### 5. Tool Registry
* **Is it stateless?**
  * The registry stores definitions (`Map<string, ToolDefinition>`) as a singleton. It is stateless with respect to execution: it does not retain call counts, execution histories, or per-user session states.
* **Does it contain business logic?**
  * Minimal: it performs secret redaction for logs (`redactArgs`) and basic parameter type validation (`validateArguments`).
* **Can it remain unchanged?**
  * **Yes.** Its interface (`register`, `getDeclarativeSchemas`, `execute`) is clean and well-established.

### 6. Model Router
* **Does it only select models?**
  * **Yes.** `ModelRouter` takes a `RoutingContext` (`promptLength`, `requiresStructuredOutput`, `requiresVision`, `maxBudget`, `preferLocal`), ranks pre-configured `ModelProfile` entries by cost and capability, and returns a `RoutingDecision`.
* **Is prompting mixed into routing?**
  * **No.** Prompting is not present in `ModelRouter`.
  * **Critical finding:** `ModelRouter` is currently **dormant / unlinked** from the rest of the application. `AgentRunner`, `Planner`, and `ToolCallingAgent` all receive a static `AIService` directly, bypassing `ModelRouter` entirely.

---

## 5. Problems Found

1. **File Duplication & Shadowing:**
   * `packages/core/src/ToolCallingAgent.ts` (PascalCase) and `packages/core/src/tool-calling-agent.ts` (kebab-case) exist concurrently.
   * `packages/core/src/index.ts` exports `tool-calling-agent.js` under the name `ToolCallingAgent`. The PascalCase file (which contains superior deterministic features like fingerprint caching and repeat-call detection) is orphaned and never imported by the platform.
2. **Dual Uncoordinated Execution Paradigms:**
   * `AgentRunner` performs static planning up front. If a step fails or produces unexpected results, there is no dynamic replanning or adaptation.
   * `ToolCallingAgent` performs purely reactive step-by-step reasoning without global planning or DAG dependency awareness.
3. **Overburdened Classes:**
   * `TaskManager` bundles graph dependency scheduling, promise concurrency, exponential backoff retries, error classification, and tool invocation into a single class.
   * `AgentRunner` bundles task state storage, timeout racing, step validation, and string synthesis.
4. **Disconnected Model Router:**
   * `ModelRouter` exists with pricing and capability profiles, but neither `Planner` nor `AIService` utilizes it dynamically.
5. **Lossy Context & Token Management:**
   * Token budget management in `tool-calling-agent.ts` relies on arbitrary string slicing (`.slice(-ctxBudget * 4)`) and `chars / 4` heuristics, risking truncated sentences or corrupted formatting.
6. **Primitive Answer Synthesis:**
   * `AgentRunner.synthesize()` uses raw string concatenation of truncated JSON payloads rather than invoking the AI model to summarize findings back to the user.

---

## 6. Phase 2 Target Files

The following files are designated for structural refinement and integration in Phase 2:

| File | Proposed Phase 2 Role |
| :--- | :--- |
| `packages/core/src/task-manager.ts` | Decompose into a pure **DAG Scheduler** (graph resolution, concurrency) and a separate **TaskExecutor** (worker execution, retries, tool calls). |
| `packages/core/src/agent-runner.ts` | Refactor to consume the decoupled scheduler, delegate result synthesis to `AIService`, and handle clean context propagation. |
| `packages/core/src/tool-calling-agent.ts` & `ToolCallingAgent.ts` | Reconcile the duplicate implementations into a single, unified agent engine combining token budgeting with fingerprint caching and per-tool limits. |
| `packages/core/src/model-router.ts` | Wire `ModelRouter` into `AIService` / `Planner` so model selection dynamically responds to request constraints. |
| `packages/core/src/index.ts` | Clean up exports to ensure uniform naming and expose the refactored scheduler and executor interfaces. |
