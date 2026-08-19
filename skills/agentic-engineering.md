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

Use this skill for engineering workflows where AI agents perform substantial implementation work while humans provide direction, quality control, architecture oversight, and risk management.

The objective is not merely to make agents write code faster. It is to create a workflow where agents understand success before execution, work in small verifiable units, use the least expensive capable model, escalate only when evidence justifies it, measure changes with evaluations, preserve context deliberately, and focus human review on correctness, security, invariants, and production risk.

> **Platform note:** This skill is fully agent- and vendor-agnostic. It has no
> Claude-specific mechanics. It applies to Zaro (and any coding agent) as-is.
> "Model routing" here refers to choosing the lightest capable model/agent for
> a subtask, which in Zaro corresponds to choosing between direct tools,
> `explore_workspace` sub-agents, and `manage_task_topic` multi-agent topics.

## Operating Principles

1. Define completion criteria before execution.
2. Decompose work into agent-sized units.
3. Route tasks according to required reasoning capability.
4. Measure behavior with evaluations and regression checks.
5. Keep active context focused.
6. Escalate complexity only when evidence justifies it.
7. Optimize for reliable outcomes, not raw generation speed.
8. Keep humans responsible for high-impact decisions and risk acceptance.

---

# 1. Evaluation-First Execution

Do not begin substantial implementation without knowing how success will be evaluated.

### Capability Evaluation
Measures whether the new behavior works — unit tests, integration tests, API contract tests, type checks, static analysis, UI checks, benchmarks, domain eval suites.

### Regression Evaluation
Measures whether existing behavior remains correct — existing test suite, critical workflow tests, backward-compat checks, security checks, snapshot/contract tests, production smoke tests.

Loop:

```text
Define evaluation → Run baseline → Capture failures/behavior → Implement
→ Run evaluation again → Compare to baseline → Investigate regressions
→ Accept, revise, or escalate
```

Do not rely only on the agent's statement that the implementation is correct.

---

# 2. Baseline Before Implementation

When practical, run relevant evaluations before changing the system.

```text
BASELINE
Capability: [what is measured]
Current result: [pass/fail/score]
Known failures: - ...
Relevant behavior: - ...
Expected target: [definition of success]
```

Do not attribute pre-existing failures to the new implementation.

---

# 3. Completion Criteria

Every meaningful task should expose an observable, testable, specific, relevant completion condition, preferably independent of implementation details.

Weak: `Improve authentication.`
Strong: `Registration rejects malformed email addresses with the existing validation error and all existing authentication tests remain passing.`

---

# 4. Task Decomposition

Use the **15-minute unit rule** as a practical default. Each unit should be independently verifiable, have one primary risk, expose a clear completion condition, produce a concrete artifact, and be small enough to diagnose without reconstructing a huge reasoning chain.

For large work, prefer units like: inspect architecture → define behavior → implement one bounded change → add focused tests → run regression checks → review high-risk boundaries.

---

# 5. Unit Design

```text
UNIT
Goal: [what changes]
Primary risk: [what could go wrong]
Inputs: [required context]
Output: [expected artifact/result]
Verification: [how completion is checked]
```

Avoid units with multiple unrelated risks.

---

# 6. Capability-Based Model Routing

Route by **capability requirements**, not vendor/model names. Choose the least expensive model/agent that reliably performs the task.

### Tier 1 — Fast / Lightweight
Classification, extraction, simple transformations, boilerplate, narrow edits, mechanical refactors, formatting-aware changes, straightforward docs, simple test generation. Requirements: low ambiguity, limited cross-file reasoning, clear completion criteria.

### Tier 2 — General Implementation
Feature implementation, standard refactoring, multi-file changes, test updates, API integration, debugging known failure modes, moderate architectural changes. Default for ordinary engineering.

### Tier 3 — Advanced Reasoning
Architecture decisions, difficult root-cause, complex multi-file invariants, security-sensitive design, deep debugging, conflicting requirements, difficult migrations, high-impact changes with substantial uncertainty.

---

# 7. Model Escalation

Start low; escalate only on evidence of a reasoning gap.

Good signals: repeated failure after reasonable correction; contradictory approaches; cross-file invariant violations; unclear root cause; unresolvable ambiguity; security/architectural reasoning exceeds capability; evaluation reveals unexplained failures.

Bad reasons: "this looks important", "use the strongest model just in case", "the first attempt was slow", "the task has many files" without evidence.

Preserve evidence on escalation:

```text
ESCALATION
Current tier: [tier]
Failure: [observed]
Attempts: [tried]
Evaluation: [result]
Reason: [specific gap]
Required capability: [what next tier must resolve]
```

---

# 8. Cost Discipline

Track meaningful work by task/unit when the environment exposes it: tier, input/output tokens, retries, wall-clock, tool usage, evaluation result, success/failure, escalations. If unavailable, record qualitative estimates rather than inventing numbers.

---

# 9. Retry Discipline

Retries should produce new information. Ask: why did the previous attempt fail? what changed? what evidence supports the new approach? Escalate when repeated failures indicate a capability gap rather than retrying endlessly.

---

# 10. Session Strategy

Continue the same session when tasks are tightly coupled and active context remains useful. Start fresh when a major phase changes, context becomes noisy, work moves to an independent subsystem, or assumptions accumulate.

Natural compression points: planning complete → implementation begins; implementation complete → verification begins; verification complete → review/release.

---

# 11. Context Preservation

Before a fresh session, preserve:

```text
CURRENT TASK / STATUS / DECISIONS / CONSTRAINTS / ACTIVE ARTIFACTS /
IMPLEMENTATION STATE / VERIFICATION / KNOWN ISSUES / NEXT STEP
```

Transfer the state needed to continue correctly, not the entire conversation.

> **In Zaro**, persist this to workspace memory (`/.nexus/memory/`) or a task
> directory (`/.nexus/tasks/<task>/`) so it survives session boundaries.

---

# 12. AI-Generated Code Review

Prioritize review of:

- **Invariants** — data consistency, state transitions, authorization relationships, referential integrity, API compatibility.
- **Boundary conditions** — empty input, null/missing, limits, duplicates, concurrency, partial failures, unexpected external responses.
- **Error boundaries** — correct error types, propagation, retry, partial-failure handling, user-visible behavior, logging/observability.
- **Security & identity** — auth assumptions, authorization boundaries, privilege escalation, secret handling, input validation, injection risks, sensitive data exposure, trust boundaries.
- **Hidden coupling** — shared state, implicit dependencies, global config, side effects, API contracts, DB assumptions, build/runtime assumptions.
- **Production risk** — *what could fail after deployment that current tests do not cover?*

Skip purely stylistic disagreements if automated format/lint already enforces style.

---

# 13. Human-in-the-Loop Boundaries

Humans retain control over: security architecture, auth/authorization policy, destructive migrations, production data changes, high-impact product decisions, regulatory/compliance decisions, major architectural commitments, risk acceptance, irreversible operations. The agent should surface these rather than silently deciding.

---

# 14. Evaluation and Regression Gates

```text
IMPLEMENTATION → Focused evaluation → Pass?
  NO → Diagnose → Fix → Retry
  YES → Regression evaluation → Pass?
    NO → Investigate
    YES → COMPLETE
```

Do not mark work complete solely because it compiles.

---

# 15. Baseline Comparison

For behavior-affecting changes, record before/after/difference/interpretation. A better result in one evaluation does not automatically justify a regression elsewhere.

---

# 16. Regression Handling

When a regression appears: determine whether it is new; determine whether the change caused it; check whether it violates a requirement; fix or explicitly escalate; re-run capability + regression evaluations. Do not hide regressions by changing tests unless expected behavior legitimately changed (and document why).

---

# 17. Multi-Agent Coordination

Give each agent a clearly bounded responsibility, only necessary context, a verification condition, no overlapping ownership, and concise findings (not raw transcripts). Keep the parent responsible for integration.

> **In Zaro**, use `manage_task_topic` for coordinated multi-agent work whose
> subtasks share durable context; use `explore_workspace` for read-only
> synthesis.

---

# 18. Risk-Based Decomposition

- **Low** — mechanical transformations, formatting, simple local edits, well-tested boilerplate.
- **Medium** — standard feature implementation, multi-file changes, API behavior changes, moderate refactoring.
- **High** — auth/authz, data migrations, security-sensitive logic, concurrency, financial/irreversible operations, core architecture, cross-system invariants.

Increase evaluation depth and human review as risk increases.

---

# 19. Performance Optimization

Optimize the workflow, not merely model latency. High value: smaller units, better retrieval, reusable context, early evaluations, focused tool calls, fewer redundant retries, capability routing, parallel independent work, compression at milestones, reusing verified patterns.

Avoid `fast generation + repeated failures`; prefer `fast path to verified success`.

---

# 20. Failure Patterns

- **Context drift** → refresh context, restate constraints.
- **Repeated low-value retries** → identify mechanism, change strategy or escalate.
- **Premature escalation** → return to lowest capable tier.
- **Underpowered routing** → escalate on observed gap.
- **Evaluation blindness** → define/restore capability + regression evals.
- **Over-decomposition** → combine genuinely coupled work.
- **Under-decomposition** → split around verifiable risks/outcomes.

---

# 21. Compact Operating Loop

```text
1. Define success.
2. Establish capability + regression evaluations.
3. Run a baseline when practical.
4. Decompose into independently verifiable units.
5. Identify primary risk per unit.
6. Route each unit to least capable reliable model.
7. Implement.
8. Run focused evaluations.
9. Run regression checks.
10. Review correctness, security, invariants, production risk.
11. Escalate only on evidence of a capability gap.
12. Record meaningful cost/performance metrics.
13. Compress or fresh-session at major phase boundaries.
14. Repeat until completion criteria satisfied.
```

---

# Verification Checklist

- [ ] Completion criteria defined.
- [ ] Work decomposed into meaningful units.
- [ ] Each unit had a primary risk and a verification condition.
- [ ] Capability + regression evaluations defined/considered.
- [ ] Baseline captured when practical.
- [ ] Model routing matched task complexity.
- [ ] Escalation occurred only when justified.
- [ ] Retries changed approach or added information.
- [ ] Costs tracked when available.
- [ ] Context remained focused; phase transitions handled deliberately.
- [ ] AI code reviewed for invariants/boundaries.
- [ ] Security/identity assumptions reviewed.
- [ ] Hidden coupling + production risk considered.
- [ ] Style checks relied on for stylistic issues only.
- [ ] Human review applied to high-impact decisions.
- [ ] Capability + regression evaluations passed.
- [ ] Remaining uncertainty documented.

# Core Principle

> **Agents should optimize for verified outcomes, not raw output.**

The strongest agentic workflow defines success → decomposes intelligently → retrieves focused context → uses the least capable sufficient model → evaluates early → escalates only on evidence → reviews high-risk behavior → compresses deliberately → ships verified results.
