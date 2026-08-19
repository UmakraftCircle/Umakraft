---
name: continuous-learning-instincts-zaro
description: Learning system for the Zaro agent that captures session activity, creates confidence-scored atomic "instincts", scopes them to projects or globally, and evolves validated instincts into reusable skills, scheduled tasks, and multi-agent topics.
version: 3.0.0
metadata:
  scope: universal
  category: agent-learning
  mcpmarket-version: 1.0.0
---

# Continuous Learning Instincts (Zaro)

An advanced learning system that turns Zaro sessions into reusable knowledge through atomic **instincts** — small learned behaviors with confidence scores, persisted in the workspace.

This is a rework of the Claude-Code "continuous-learning-instincts-v2" concept for the Zaro agent platform. Instead of Claude Code hooks and `~/.claude/` files, it uses Zaro-native primitives: scheduled tasks with file-watch triggers, workspace memory, `.table` files, and task topics.

## What Changed from the Claude-Code Version

| Concern | Claude Code (v2.1) | Zaro (this skill) |
|---|---|---|
| Observation trigger | `PreToolUse`/`PostToolUse` hooks + `observe.sh` | `schedule_task` with `watch_paths` + `cron` |
| Storage | `~/.claude/homunculus/` (localhost) | Workspace memory (`/.nexus/memory/`) + workspace files |
| Project detection | git remote URL / repo path | Workspace folder / `MEMORY.md` project entries |
| Commands | `/instinct-status`, `/evolve`, … | Agent `prompt` instructions + scheduled runs |
| Evolution target | Claude skills/commands/agents | Zaro skills, `schedule_task` jobs, `manage_task_topic` |
| Structured data | JSONL files + YAML | `.table` files (SQL-queried) |
| CLI | `instinct-cli.py` | Zaro agent tools (no CLI) |

## When to Activate

Activate this skill when:

- Configuring automatic learning / behavior extraction in the Zaro workspace
- Reviewing, exporting, or promoting learned instincts
- Evolving instincts into reusable skills, scheduled tasks, or task topics
- Distinguishing project-scoped vs global instincts
- Setting up self-improving agent workflows

## Core Concepts

### 1. Instincts (atomic learned behaviors)

An instinct is a single, confidence-scored behavior:

```yaml
---
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7
domain: "code-style"
scope: project
project_id: "umakraft"
---

# Prefer Functional Style

## Action
Use functional patterns over classes when appropriate.

## Evidence
- Observed 5 instances of functional pattern preference
- User corrected class-based approach to functional on 2025-01-15
```

Properties:

- **Atomic** — one trigger, one action
- **Confidence-weighted** — 0.3 (tentative) → 0.9 (nearly certain)
- **Domain-tagged** — code-style, testing, git, debugging, workflow, etc.
- **Evidence-based** — tracks the observations that produced it
- **Scope-aware** — `project` by default, or `global`

### 2. Where instincts live (Zaro storage model)

Zaro has no local filesystem for the user. Everything is in the workspace:

**Personal memory (manual, read-only system entries):**
```text
/.nexus/memory/personal/<user-id>/MEMORY.md
```

**Instinct registry (structured, queryable):**
```text
/.nexus/memory/instincts/instincts.table
```

A `.table` file with `fields` + `data`. Recommended schema:

```json
{
  "fields": [
    { "field": "id",          "type": "string", "required": true },
    { "field": "trigger",     "type": "string" },
    { "field": "action",      "type": "string" },
    { "field": "confidence",  "type": "number" },
    { "field": "domain",      "type": "string" },
    { "field": "scope",       "type": "enum", "enums": ["project", "global"] },
    { "field": "project_id",  "type": "string" },
    { "field": "evidence_count", "type": "number" },
    { "field": "status",      "type": "enum", "enums": ["active", "suggested", "evolved", "rejected"] }
  ],
  "data": []
}
```

### 3. Confidence scoring

| Score | Meaning | Behavior |
|---:|---|---|
| 0.3 | Tentative | Suggested, not enforced |
| 0.5 | Moderate | Applied when relevant |
| 0.7 | Strong | Automatically approved |
| 0.9 | Nearly certain | Core behavior |

Confidence **increases** with repeated observations and non-corrections; **decreases** on explicit correction, long absence, or contradictory evidence.

## Architecture (Zaro-flavored)

```text
Workspace activity (file edits, code changes, conversation)
      |
      | schedule_task watch_paths + cron fires
      | agent reads changed files + conversation context
      v
Observation pass (an agent reads the instinct registry + recent changes)
      |
      | pattern detection: corrections, error fixes, repeated workflows
      | scope decision: project vs global?
      v
+.table update (insert/update rows in instincts.table)
      |
      | a separate "evolve" agent clusters high-confidence instincts
      v
Evolved artifacts: workspace skills / scheduled tasks / task topics
```

## Setting It Up

### Step 1 — Create the instinct registry

Create `/.nexus/memory/instincts/instincts.table` (empty schema above). Zaro reads rows with SQL; nothing else is required.

### Step 2 — Schedule the observation agent

Use `schedule_task` to create an observation job. Combine `cron` and `watch_paths` in a single task so it fires both on a schedule and on file changes:

```text
name: instinct-observe
cron: 0 */6 * * *            # every 6 hours
watch_paths:
  - path: /apps/               # your project code lives here
  - path: /docs/
prompt: >
  Read /.nexus/memory/instincts/instincts.table and the recently changed
  files listed in your execution context. Identify repeated patterns,
  user corrections, and non-obvious conventions. For each candidate,
  INSERT or UPDATE a row in instincts.table with a confidence 0.3-0.9,
  scope (project|global), and project_id. Do NOT evolve or delete rows —
  that is the evolve agent's job. Report only new/updated instincts.
```

### Step 3 — Schedule the evolve agent

A second job that promotes validated instincts into durable artifacts:

```text
name: instinct-evolve
cron: 0 9 * * 1              # weekly, Monday 9am
prompt: >
  Read instincts.table. Cluster rows with confidence >= 0.8 that share a
  domain. For each cluster, propose one of: a workspace skill, a reusable
  scheduled task, or a task topic. Mark evolved rows status='evolved'.
  Do not mutate project code. Output a short promotion plan and wait —
  do not auto-create artifacts without a clear, safe mapping.
```

### Step 4 — Enroll instincts into memory

Promote `global` instincts (security practices, general best practices) into personal memory (`MEMORY.md`) or rules so they load on every session by default.

## Project vs Global Scope Decision

| Pattern type | Scope |
|---|---|
| Language/framework rules | project |
| File structure preferences | project |
| Code style | project |
| Error-handling strategy for a codebase | project |
| Security practices | global |
| General best practices | global |
| Tool workflow preferences | global |
| Git practices | global |

## Promotion: project → global

An instinct is promoted to `global` when it appears with high confidence (>= 0.8) across two or more projects. The evolve agent flags these; promotion is applied by updating the `scope` field.

## Evolving into Zaro artifacts

| Instinct cluster | Best Zaro target |
|---|---|
| Repeated workflow steps | `schedule_task` (a recurring job) |
| Multi-agent pipeline pattern | `manage_task_topic` |
| Reusable domain expertise | workspace skill / memory topic |
| Coding conventions | rules file under `/.nexus/memory/.../rules/` |

## Why file-watch + schedule instead of hooks

Zaro has no deterministic per-tool "hooks." The equivalent is a `schedule_task` with `watch_paths`, which reliably fires on file changes (debounced) and on a cron schedule. This gives deterministic observation without leaking every intermediate tool call.

## Safety & Scope Rules

- Instincts are **suggestions curated by the agent**, not auto-applied code changes.
- Raw code/conversation content is never copied into the registry — only summarized patterns.
- Observation and evolve are read-mostly agents; the only writes are to `instincts.table` (and, on approval, promoted artifacts).
- Promotions and skill/task creation must respect the coding-agent scope rules: **inspect and report freely, modify only what is approved.**

## Verification Checklist

- [ ] Instinct registry `.table` exists with the schema above.
- [ ] Observation job uses `watch_paths` (+ optional `cron`) in a single task.
- [ ] Evolve job runs on a separate, lower-frequency schedule.
- [ ] Confidence values are 0.3–0.9 and evidence-based.
- [ ] Scope is set correctly (project vs global).
- [ ] No raw user content leaked into the registry.
- [ ] Evolved artifacts are proposed and approved before creation.

## Core Principle

> **Learn once, scope correctly, promote only what is proven.**

Zaro learns from workspace activity, stores decisions as queryable instincts, and evolves only high-confidence clusters into durable skills and automations — without auto-modifying project code.
