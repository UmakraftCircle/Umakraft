---
name: compression-strategy
description: Analyze accumulated agent context and recommend a safe compression strategy when sessions become bloated, sluggish, stale, or quota-heavy. Use before major task transitions, after large tool-output accumulation, or when context pressure threatens task quality.
version: 1.0.0
tags: [context, compression, optimization, agents, subagents, token-budget]
metadata:
  scope: universal
  category: context-management
  progressive_loading: true
---

# Compression Strategy

## Overview

Compression Strategy helps an AI agent recognize when its active context has become too large, stale, or expensive and choose the least disruptive way to reduce it.

The objective is not simply to reduce tokens. The objective is:

> **Remove low-value context while preserving the decisions, requirements, artifacts, and state necessary to continue the task correctly.**

## When to Use

Use this skill when:

- Context feels bloated or sluggish.
- A long task has accumulated many tool results.
- Token usage is increasing faster than expected.
- A major task phase has completed.
- Planning is complete and implementation is beginning.
- A feature has been implemented and verification is beginning.
- Many old errors, searches, or intermediate attempts remain in context.
- The agent is beginning to confuse historical and active information.
- Context pressure threatens reasoning quality.

## When Not to Use

Do not compress when:

- The context is small and focused.
- The conversation has just started.
- A context-management/compaction process is already handling the situation.
- Important active information would be lost and has not yet been preserved.
- Compression would interrupt a critical operation that must finish first.

Do not compress merely because compression is available.

## Core Principle

Context has different values:

```text
ACTIVE     — required for the current task.
REFERENCE  — useful for current reasoning but can be reloaded if necessary.
HISTORICAL — useful for understanding how the task evolved, not required now.
NOISE      — no longer useful.
```

Compression should primarily remove `NOISE → HISTORICAL → REFERENCE` while preserving `ACTIVE`.

## Context Analysis

Before recommending a strategy, analyze the current context:

1. Overall context pressure (if measurable)
2. Tool-output accumulation
3. Conversation history size
4. Age of important decisions
5. Active files and artifacts
6. Completed vs unfinished work
7. Current task phase
8. Unresolved requirements
9. Recent errors and verification results
10. Information that can be reconstructed or reloaded

Do not invent exact token percentages when the environment does not expose them. Use qualitative estimates (`Low / Moderate / High / Critical`) or state that usage cannot be measured.

> **In Zaro**, context pressure maps to the active conversation/tool-result
> volume, not a fixed window. Durable state can always be offloaded to
> workspace memory (`/.nexus/memory/`) or a task context directory
> (`/.nexus/tasks/<task>/`) before compressing.

## Step 1 — Analyze Context

```text
CONTEXT ANALYSIS
Pressure: Moderate
Tool output: High — several large search and test results accumulated.
Active context: ...
Historical context: ...
Stale content: Moderate
Task phase: Planning complete; implementation beginning.
Critical state:
- Use existing ValidationError
- Do not modify database schema
- Registration endpoint is src/auth/register.ts
```

## Tool Output Accumulation

Identify: large search results, repeated file contents, duplicate API responses, old test output, old logs, large generated documents, repeated command output, redundant browser state, intermediate failed attempts.

Prefer retaining `final result + relevant conclusion + small supporting excerpt` over every intermediate tool response. If a tool result can be regenerated cheaply, it is a strong compression candidate.

> **In Zaro**, large integration/MCP results may be held as `$zaroRawData[...]`
> references — keep the reference rather than expanding the full body into
> context.

## Stale Content Analysis

Ask: which decisions are still active? which were superseded? which files changed since inspection? which errors are resolved? which experiments were rejected? which searches are now irrelevant? which assumptions were invalidated?

## Active Artifact Analysis

Classify referenced files/resources as **Active / Supporting / Historical / Regenerable / Irrelevant**. Strongly favor retaining Active and important Supporting artifacts.

## Critical State Preservation

Before clearing/compacting, preserve critical state:

```text
TASK: [objective]
STATUS: [completed / in progress / blocked]
DECISIONS: - ...
CONSTRAINTS: - ...
ACTIVE ARTIFACTS: - [path] — [purpose]
CURRENT IMPLEMENTATION: [what exists]
RECENT VERIFICATION: [results]
KNOWN ISSUES: - ...
UNRESOLVED QUESTIONS: - ...
NEXT STEP: [immediate action]
```

## Step 2 — Recommend a Strategy

### Option A — Clear and Catch Up
Best when a task phase is complete, most old context is stale, pressure is high, and active state can be summarized/reloaded.

General process: preserve critical state → save → clear/reset conversation → reload persistent rules → reload active spec → reload active files → continue.

Do not assume a specific command like `/clear` or `/catchup` exists — use the equivalent capabilities of the environment.

Typical savings ~70–90%.

### Option B — Continuation Agent
Best when pressure is very high, work is in progress, and remaining work can be transferred via a compact state summary.

Process: preserve state → concise continuation brief → start a fresh agent/session/subagent → provide brief → reload only active context → continue.

Typical savings ~80–95%. Risk low when state transfer is complete and verified.

> **In Zaro**, this maps to launching a sub-agent (`explore_workspace`) or a new
> scheduled task whose `prompt` carries the continuation brief.

### Option C — Archive and Summarize
Best when pressure is moderate, some history is still useful, and the task is in the same phase.

Process: preserve decisions → summarize completed work → remove duplicate results and resolved errors → keep active files/requirements → continue.

Typical savings ~20–40%. Risk very low.

### Option D — Delegate
Best when independent subtasks can run separately. Give each subtask only the context it needs; merge concise results rather than full transcripts.

Typical savings ~30–50% parent-context pressure for suitable workloads.

> **In Zaro**, use `manage_task_topic` for multi-agent delegation, or
> `explore_workspace` for read-only synthesis.

### Option E — No Compression
When pressure is low, most information is active, the task is near completion, or compression costs more than it saves.

## Strategy Selection Matrix

| Situation | Recommended Strategy |
|---|---|
| Fresh session / low pressure | No compression |
| Moderate pressure + mixed active/history | Archive + Summarize |
| Completed phase + high stale content | Clear + Catch Up |
| Very high pressure + work must continue | Continuation Agent |
| Independent parallel work available | Delegate |
| Critical info cannot be preserved yet | Do not compress yet |

## Context Pressure Guidelines

| Context usage (if measurable) | Guidance |
|---:|---|
| 0–40% | Usually no compression |
| 40–60% | Consider archive/summarize |
| 60–80% | Prefer active-state compression or phase transition |
| 80%+ | Strongly consider reset/continuation |
| Critical | Compress immediately after preserving state |

Never fabricate a usage percentage.

## Savings Estimation

Use ranges rather than false precision, and say so when exact measurement is unavailable:

```text
Estimated savings = removable context / total current context × 100
```

Or qualitatively: `Expected savings: High; Confidence: Medium; Basis: ...`.

## Context Preservation (durable location)

Preserved context should have a durable location when the environment supports files.

> **In Zaro**, use workspace files — e.g. `/context-archive/` or a task
> directory under `/.nexus/tasks/<task>/`. Do not assume `.claude/` or any
> other vendor directory. A useful naming convention:
> `context-archive/pre-compression-YYYYMMDD-HHMMSS.md` or `session-state/current-task.md`.

## Archive Contents

Preserve useful history, not raw transcripts:

```markdown
# Context Archive
## Task
## Completed
## Decisions
## Rejected Approaches
## Important Errors
## Relevant Artifacts
## Verification
## Remaining Work
```

Avoid archiving duplicate tool output, entire reloadable files, resolved errors with no future value, repeated search results, or irrelevant conversation.

## Phase Transition Compression

Major transitions (Requirements → Planning → Implementation → Testing → Review → Completion) are natural compression points. Summarize completed work, preserve active decisions, remove obsolete exploration, and reload only what the next phase needs.

## Tool Output Compression

Summarize large tool output immediately when practical. Instead of 500 lines of test output, preserve: 2 failures, their causes, and the relevant files.

## Compression Safety Rules

Never discard: explicit user requirements, security constraints, important architecture decisions, current implementation state, unresolved blockers, critical test failures, active file locations, required acceptance criteria, or important environment limitations.

Before compressing, ask: *if everything else disappeared, could I reconstruct the current task from the preserved state?* If not, preserve more.

## Common Compression Errors

| Error | Fix |
|---|---|
| Compressing too early | Wait for meaningful redundancy |
| Compressing without state preservation | Save a state summary first |
| Treating all history equally | Classify active vs historical |
| Preserving raw transcripts | Preserve conclusions instead |
| Inventing usage percentages | State when measurement unavailable |
| Clearing during critical work | Finish or checkpoint first |
| Assuming vendor commands | Use capability-based instructions |
| Keeping resolved errors | Keep only errors with future value |
| Delegating inseparable work | Delegate only independent subtasks |

## Example Analysis

```text
CONTEXT ANALYSIS
Pressure: Moderate
Tool output: High — several large search/test results.
Stale content: Moderate — early exploration no longer needed.
Active files: src/auth/register.ts, src/lib/validation.ts, tests/auth/register.test.ts
Task phase: Planning complete; implementation starting.
Critical decisions: Reuse existing validation utilities; do not modify DB schema.

RECOMMENDATION: Option C — Archive + Summarize.
REASON: same phase, active context manageable, historical exploration creating pressure.
ESTIMATED SAVINGS: 25–35%.
NEXT STEPS: preserve decisions; summarize; remove duplicate output; continue.
```

## Required Internal Workflow

```text
1. compression-strategy:analyze-context
2. compression-strategy:recommend-strategy
3. compression-strategy:estimate-savings
```

(These are workflow stages, not mandatory tool names.)

## Compact Operating Procedure

```text
1. Measure/estimate context pressure.
2. Separate active/supporting/historical/regenerable/irrelevant context.
3. Identify tool output + stale material.
4. Preserve critical state.
5. Determine task phase.
6. Select least-disruptive strategy.
7. Estimate savings.
8. Compress/archive/delegate/reset as appropriate.
9. Reload only context needed for next phase.
10. Verify task continuity preserved.
```

## Verification

- [ ] Current task still clearly understood.
- [ ] User requirements remain available.
- [ ] Important decisions preserved.
- [ ] Active files/artifacts known.
- [ ] Current implementation state understood.
- [ ] Unresolved issues visible.
- [ ] Tests/verification state preserved.
- [ ] Stale/duplicate context removed.
- [ ] No unsupported usage percentage stated as fact.
- [ ] Agent can continue without reconstructing full history.

## Core Principle

> **Compress context, not knowledge.**

The best compression removes repetition, stale exploration, and regenerable output while preserving the decisions, constraints, current state, and evidence needed to continue correctly.
