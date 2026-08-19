---
name: agentic-engineering
description: Operate as an agentic engineer using evaluation-first execution, task decomposition, capability-based model routing, cost awareness, and risk-focused review. Use when AI agents perform substantial implementation work while humans retain responsibility for quality, architecture, security, and risk control.
version: 1.0.0
tags: [agentic-engineering, agents, evaluation, model-routing, task-decomposition, cost-control, software-engineering]
metadata:
  scope: universal
  category: agent-workflow
  origin: ECC
---

# Agentic Engineering

## Overview

Use for engineering workflows where AI agents perform substantial implementation work while humans provide direction, quality control, architecture oversight, and risk management.

> **Platform note:** Fully agent- and vendor-agnostic. No Claude-specific mechanics. Applies to Zaro (and any coding agent). "Model routing" = choosing the lightest capable model/agent for a subtask; in Zaro this maps to choosing between direct tools, `explore_workspace` sub-agents, and `manage_task_topic` topics.

## Operating Principles

1. Define completion criteria before execution.
2. Decompose work into agent-sized units.
3. Route tasks by reasoning capability.
4. Measure behavior with evaluations.
5. Keep active context focused.
6. Escalate only on evidence.
7. Optimize for reliable outcomes, not raw speed.
8. Keep humans responsible for high-impact decisions.

## 1. Evaluation-First Execution

Define **capability evaluation** (does the new behavior work?) and **regression evaluation** (does existing behavior remain correct?): tests, type checks, contracts, benchmarks.

Loop: define eval → run baseline → implement → run eval → compare → investigate regressions → accept/revise/escalate.

## 2. Baseline Before Implementation

Run relevant evals before changing the system. Don't attribute pre-existing failures to the new implementation.

## 3. Completion Criteria

Observable, testable, specific, relevant, implementation-independent.

Weak: `Improve authentication.`
Strong: `Registration rejects malformed emails with the existing validation error; all auth tests remain passing.`

## 4. Task Decomposition

Use the **15-minute unit rule**. Each unit: independently verifiable, one primary risk, clear completion condition, concrete artifact, small enough to diagnose.

## 5. Unit Design

```text
UNIT
Goal / Primary risk / Inputs / Output / Verification
```

## 6. Capability-Based Model Routing

- **Tier 1 (fast/light):** classification, extraction, boilerplate, mechanical refactors.
- **Tier 2 (general):** feature implementation, multi-file changes, debugging known failures.
- **Tier 3 (advanced):** architecture, difficult root-cause, security-sensitive design.

## 7. Model Escalation

Escalate only on evidence of a reasoning gap (repeated failure, cross-file invariant violations, unresolvable ambiguity). Record: current tier, failure, attempts, evaluation result, reason, required capability.

## 8. Cost Discipline

Track meaningful work by task/unit when exposed (tier, tokens, retries, wall-clock, result). Use qualitative estimates if unavailable — don't invent numbers.

## 9. Retry Discipline

Retries should produce new information. Escalate on repeated failure rather than retrying endlessly.

## 10. Session Strategy

Continue when tightly coupled; start fresh at major phase boundaries.

## 11. Context Preservation

Before a fresh session, preserve a compact state summary (task/status/decisions/constraints/artifacts/next step), not the whole conversation. In Zaro: persist to `/.nexus/memory/` or `/.nexus/tasks/<task>/`.

## 12. AI-Generated Code Review

Prioritize: invariants, boundary conditions, error boundaries, security/identity, hidden coupling, production risk. Skip stylistic disagreements if automated tools enforce style.

## 13. Human-in-the-Loop Boundaries

Humans retain control over: security architecture, auth/authz policy, destructive migrations, production data, high-impact product decisions, compliance, major architectural commitments, irreversible operations.

## 14. Evaluation and Regression Gates

```text
IMPLEMENTATION → focused eval → pass → regression eval → pass → COMPLETE
                 fail → diagnose/fix/retry       fail → investigate
```

## 15. Regression Handling

Determine if new, whether caused by the change, whether it violates a requirement; fix or escalate; re-run both evals. Don't hide regressions by changing tests without justification.

## 16. Multi-Agent Coordination

Bounded responsibilities, necessary-only context, verification condition, no overlapping ownership, concise findings. In Zaro: `manage_task_topic` for coordinated shared-context work; `explore_workspace` for read-only synthesis.

## 17. Risk-Based Decomposition

- **Low:** mechanical, formatting, simple edits.
- **Medium:** standard features, multi-file changes.
- **High:** auth/authz, migrations, security-sensitive, concurrency, financial, core architecture.

Increase evaluation depth and human review with risk.

## 18. Failure Patterns

Context drift → refresh; repeated low-value retries → change strategy/escalate; premature escalation → return to lowest tier; underpowered routing → escalate on gap; evaluation blindness → restore evals; over/under-decomposition → adjust around verifiable outcomes.

## 19. Compact Operating Loop

1. Define success. 2. Establish evals. 3. Baseline. 4. Decompose. 5. Identify risk per unit. 6. Route to least capable sufficient model. 7. Implement. 8. Focused evals. 9. Regression checks. 10. Review. 11. Escalate on evidence. 12. Track cost. 13. Fresh-session at boundaries. 14. Repeat.

## Verification Checklist

- [ ] Completion criteria defined.
- [ ] Work decomposed into units.
- [ ] Each unit has primary risk + verification.
- [ ] Capability + regression evals defined.
- [ ] Baseline captured when practical.
- [ ] Model routing matches complexity.
- [ ] Escalation justified.
- [ ] Retries changed approach.
- [ ] Context focused; phase transitions deliberate.
- [ ] Code reviewed for invariants/boundaries.
- [ ] Security/identity reviewed.
- [ ] Hidden coupling + production risk considered.
- [ ] Human review applied to high-impact decisions.
- [ ] Evals passed; uncertainty documented.

## Core Principle

> **Agents should optimize for verified outcomes, not raw output.**
