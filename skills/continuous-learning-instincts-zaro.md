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

An advanced learning system that turns Zaro sessions into reusable knowledge through atomic **instincts** — small learned behaviors with confidence scores, persisted in the workspace [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:12].

This is a rework of the Claude-Code "continuous-learning-instincts-v2" concept for the Zaro agent platform. Instead of Claude Code hooks and `~/.claude/` files, it uses Zaro-native primitives: scheduled tasks with file-watch triggers, workspace memory, `.table` files, and task topics [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:14].

## What Changed from the Claude-Code Version

| Concern | Claude Code (v2.1) | Zaro (this skill) |
|---|---|---|
| Observation trigger | `PreToolUse`/`PostToolUse` hooks + `observe.sh` | `schedule_task` with `watch_paths` + `cron` [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:19] |
| Storage | `~/.claude/homunculus/` (localhost) | Workspace memory (`/.nexus/memory/`) + workspace files [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:20] |
| Project detection | git remote URL / repo path | Workspace folder / `MEMORY.md` project entries [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:21] |
| Commands | `/instinct-status`, `/evolve`, … | Agent `prompt` instructions + scheduled runs [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:22] |
| Evolution target | Claude skills/commands/agents | Zaro skills, `schedule_task` jobs, `manage_task_topic` [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:23] |
| Structured data | JSONL files + YAML | `.table` files (SQL-queried) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:24] |
| CLI | `instinct-cli.py` | Zaro agent tools (no CLI) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:25] |

## When to Activate

Activate this skill when:
- Configuring automatic learning / behavior extraction in the Zaro workspace [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:29]
- Reviewing, exporting, or promoting learned instincts [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:30]
- Evolving instincts into reusable skills, scheduled tasks, or task topics [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:31]
- Distinguishing project-scoped vs global instincts [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:32]
- Setting up self-improving agent workflows [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:33]

## Core Concepts

### 1. Instincts (atomic learned behaviors)

An instinct is a single, confidence-scored behavior [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:37]:

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
- **Atomic** — one trigger, one action [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:59]
- **Confidence-weighted** — 0.3 (tentative) → 0.9 (nearly certain) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:60]
- **Domain-tagged** — code-style, testing, git, debugging, workflow, etc. [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:61]
- **Evidence-based** — tracks the observations that produced it [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:62]
- **Scope-aware** — `project` by default, or `global` [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:63]

### 2. Where instincts live (Zaro storage model)

Zaro has no local filesystem for the user. Everything is in the workspace [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:67]:

**Personal memory (manual, read-only system entries):**
```text
/.nexus/memory/personal/<user-id>/MEMORY.md
```

**Instinct registry (structured, queryable):**
```text
/.nexus/memory/instincts/instincts.table
```

A `.table` file with `fields` + `data` [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:81]. Recommended schema:

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
| 0.3 | Tentative | Suggested, not enforced [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:104] |
| 0.5 | Moderate | Applied when relevant [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:105] |
| 0.7 | Strong | Automatically approved [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:106] |
| 0.9 | Nearly certain | Core behavior [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:107] |

Confidence **increases** with repeated observations and non-corrections; **decreases** on explicit correction, long absence, or contradictory evidence [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:109].

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

Create `/.nexus/memory/instincts/instincts.table` (empty schema above) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:129]. Zaro reads rows with SQL; nothing else is required [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:129].

### Step 2 — Schedule the observation agent

Use `schedule_task` to create an observation job [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:133]. Combine `cron` and `watch_paths` in a single task so it fires both on a schedule and on file changes [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:133]:

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

A second job that promotes validated instincts into durable artifacts [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:151]:

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

Promote `global` instincts (security practices, general best practices) into personal memory (`MEMORY.md`) or rules so they load on every session by default [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:165].

## Project vs Global Scope Decision

| Pattern type | Scope |
|---|---|
| Language/framework rules | project [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:171] |
| File structure preferences | project [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:172] |
| Code style | project [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:173] |
| Error-handling strategy for a codebase | project [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:174] |
| Security practices | global [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:175] |
| General best practices | global [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:176] |
| Tool workflow preferences | global [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:177] |
| Git practices | global [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:178] |

## Promotion: project → global

An instinct is promoted to `global` when it appears with high confidence (>= 0.8) across two or more projects [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:182]. The evolve agent flags these; promotion is applied by updating the `scope` field [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:182].

## Evolving into Zaro artifacts

| Instinct cluster | Best Zaro target |
|---|---|
| Repeated workflow steps | `schedule_task` (a recurring job) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:188] |
| Multi-agent pipeline pattern | `manage_task_topic` [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:189] |
| Reusable domain expertise | workspace skill / memory topic [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:190] |
| Coding conventions | rules file under `/.nexus/memory/.../rules/` [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:191] |

## Why file-watch + schedule instead of hooks

Zaro has no deterministic per-tool "hooks." The equivalent is a `schedule_task` with `watch_paths`, which reliably fires on file changes (debounced) and on a cron schedule [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:195]. This gives deterministic observation without leaking every intermediate tool call [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:195].

## Safety & Scope Rules

- Instincts are **suggestions curated by the agent**, not auto-applied code changes [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:199].
- Raw code/conversation content is never copied into the registry — only summarized patterns [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:200].
- Observation and evolve are read-mostly agents; the only writes are to `instincts.table` (and, on approval, promoted artifacts) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:201].
- Promotions and skill/task creation must respect the coding-agent scope rules: **inspect and report freely, modify only what is approved** [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:202].

## Verification Checklist

- [ ] Instinct registry `.table` exists with the schema above [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:206].
- [ ] Observation job uses `watch_paths` (+ optional `cron`) in a single task [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:207].
- [ ] Evolve job runs on a separate, lower-frequency schedule [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:208].
- [ ] Confidence values are 0.3–0.9 and evidence-based [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:209].
- [ ] Scope is set correctly (project vs global) [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:210].
- [ ] No raw user content leaked into the registry [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:211].
- [ ] Evolved artifacts are proposed and approved before creation [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:212].

## Core Principle

> **Learn once, scope correctly, promote only what is proven.** [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:216]

Zaro learns from workspace activity, stores decisions as queryable instincts, and evolves only high-confidence clusters into durable skills and automations — without auto-modifying project code [citation:/.nexus/skills/continuous-learning-instincts-zaro.md:218].
