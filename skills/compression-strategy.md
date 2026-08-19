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

Compression Strategy helps an AI agent recognize when its active context has become too large, stale, or expensive, and choose the least disruptive way to reduce it.

> **Compress context, not knowledge.**

## When to Use

When context feels bloated, a long task accumulated many results, token usage is increasing, a phase completed, or the agent confuses historical vs active information.

## When Not to Use

When context is small/focused, conversation just started, a compaction process already handles it, or important active information would be lost.

## Core Principle

```text
ACTIVE     — required for the current task.
REFERENCE  — useful but reloadable.
HISTORICAL — useful for understanding evolution, not required now.
NOISE      — no longer useful.
```
Compression should remove NOISE → HISTORICAL → REFERENCE while preserving ACTIVE.

## Step 1 — Analyze Context

Consider: overall pressure (qualitative Low/Moderate/High/Critical — do not invent percentages), tool-output accumulation, history size, age of decisions, active files, completed vs unfinished work, task phase, unresolved requirements, recent errors.

> In Zaro, pressure maps to conversation/tool-result volume. Durable state can be offloaded to `/.nexus/memory/` or `/.nexus/tasks/<task>/`.

### Tool Output Accumulation

Identify large search results, repeated file contents, duplicate responses, old test output. Retain `final result + conclusion + small excerpt`. If a result is cheaply regenerable, it's a strong compression candidate. (In Zaro, large MCP results may be `$zaroRawData[...]` references — keep the reference, not the body.)

### Critical State Preservation

Before clearing, preserve:
```text
TASK / STATUS / DECISIONS / CONSTRAINTS / ACTIVE ARTIFACTS /
CURRENT IMPLEMENTATION / RECENT VERIFICATION / KNOWN ISSUES / NEXT STEP
```

## Step 2 — Recommend a Strategy

- **A — Clear and Catch Up**: preserve state → clear → reload rules/spec/files → continue. Savings ~70-90%.
- **B — Continuation Agent**: preserve state → launch a fresh agent with a compact brief. Savings ~80-95%. (In Zaro: `explore_workspace` or a new task whose `prompt` carries the brief.)
- **C — Archive and Summarize**: preserve decisions, remove duplicates. Savings ~20-40%.
- **D — Delegate**: independent subtasks get only needed context. (In Zaro: `manage_task_topic` or `explore_workspace`.)
- **E — No Compression**: when pressure is low or near completion.

## Selection Matrix

| Situation | Strategy |
|---|---|
| Fresh session / low pressure | No compression |
| Moderate + mixed active/history | Archive + Summarize |
| Completed phase + stale content | Clear + Catch Up |
| Very high pressure + must continue | Continuation Agent |
| Independent parallel work | Delegate |
| Critical info can't be preserved yet | Do not compress |

## Context Preservation (durable location)

Preserve to workspace files (e.g. `/context-archive/` or `/.nexus/tasks/<task>/`). Do not assume `.claude/` or other vendor directories.

## Compression Safety Rules

Never discard: explicit requirements, security constraints, architecture decisions, current implementation state, unresolved blockers, critical failures, active file locations, acceptance criteria.

Before compressing, ask: *if everything else disappeared, could I reconstruct the current task from preserved state?*

## Common Compression Errors

Compressing too early, compressing without state preservation, treating all history equally, preserving raw transcripts, inventing usage percentages, clearing during critical work, assuming vendor commands, keeping resolved errors, delegating inseparable work.

## Key Reminders

- Preserve conclusions, not raw transcripts.
- Classify active vs historical.
- Use capability-based instructions, not vendor-specific commands.
- Preserve state before any reset.

## Core Principle

> **Compress context, not knowledge.** The best compression removes repetition, stale exploration, and regenerable output while preserving the decisions, constraints, state, and evidence needed to continue correctly.
