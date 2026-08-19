---
name: agent-eval
description: Directly compare coding agents (Claude Code, Aider, Codex, Zaro, etc.) on custom tasks using pass rate, cost, time, and consistency metrics.
origin: ECC
tools: Read, Write, Edit, Bash, Grep, Glob
metadata:
  mcpmarket-version: 1.0.0
---

# Agent Eval Skill

A lightweight CLI tool for head-to-head comparisons of coding agents on reproducible tasks. Instead of relying on intuition for every "which coding agent is best?" comparison, this tool systematizes the evaluation.

## When to Use

- Compare coding agents (Claude Code, Aider, Codex, Zaro, etc.) on your own codebase
- Measure agent performance before adopting a new tool or model
- Run regression checks when agents update their models or tools
- Make data-driven agent selection decisions for your team

## Installation

```bash
# pinned to v0.1.0 — latest stable commit
pip install git+https://github.com/joaquinhuigomez/agent-eval.git@6d062a2f5cda6ea443bf5d458d361892c04e749b
```

> **Platform note:** This is a standalone Python CLI (not Claude-dependent).
> It works as-is. For Zaro specifically, the same methodology can be driven
> without the CLI by: (1) defining task YAML in the workspace, (2) using git
> worktrees for isolation, and (3) running each agent + judges via
> `execute_command` (sandbox) and recording pass/cost/time per run.

## Core Concepts

### YAML Task Definition

Define tasks declaratively. Each task specifies what should be done, which files may be modified, and how success should be judged:

```yaml
name: add-retry-logic
description: Add exponential backoff retry to the HTTP client
repo: ./my-project
files:
  - src/http_client.py
prompt: |
  Add retry logic with exponential backoff to all HTTP requests.
  Max 3 retries. Initial delay 1s, max delay 30s.
judge:
  - type: pytest
    command: pytest tests/test_http_client.py -v
  - type: grep
    pattern: "exponential_backoff|retry"
    files: src/http_client.py
commit: "abc1234"  # pin to specific commit for reproducibility
```

### Git Worktree Isolation

Each agent run gets its own git worktree — no Docker required. This provides reproducible isolation so agents cannot interfere with one another or damage the base repository.

### Collected Metrics

| Metric | What it measures |
|--------|-------------------|
| Pass Rate | Whether the generated code passes the judges |
| Cost | API spend per task, when available |
| Time | Wall-clock seconds required |
| Consistency | Pass rate across repeated runs (e.g. 3/3 = 100%) |

## Workflow

### 1. Define Tasks

Create a `tasks/` directory with one YAML file per task.

### 2. Run Agents

```bash
agent-eval run --task tasks/add-retry-logic.yaml --agent claude-code --agent aider --runs 3
```

Each run: (1) creates a git worktree from the pinned commit, (2) gives the prompt to the agent, (3) runs the judges, (4) records pass/fail, cost, and time.

### 3. Compare Results

```bash
agent-eval report --format table
```

```text
Task: add-retry-logic (3 runs each)
┌──────────────┬───────────┬────────┬────────┬─────────────┐
│ Agent        │ Pass Rate │ Cost   │ Time   │ Consistency │
├──────────────┼───────────┼────────┼────────┼─────────────┤
│ claude-code  │ 3/3       │ $0.12  │ 45s    │ 100%        │
│ aider        │ 2/3       │ $0.08  │ 38s    │  67%        │
└──────────────┴───────────┴────────┴────────┴─────────────┘
```

## Judge Types

### Code-Based (Deterministic)

```yaml
judge:
  - type: pytest
    command: pytest tests/ -v
  - type: command
    command: npm run build
```

### Pattern-Based

```yaml
judge:
  - type: grep
    pattern: "class.*Retry"
    files: src/**/*.py
```

### Model-Based (LLM as Judge)

```yaml
judge:
  - type: llm
    prompt: |
      Does this implementation correctly handle exponential backoff?
      Check for: max retries, increasing delays, jitter.
```

## Best Practices

- **Start with 3–5 tasks** that represent your real workload rather than toy examples.
- **Run at least 3 trials per agent** to capture variance — agents are nondeterministic.
- **Pin a commit in your task YAML** so results remain reproducible days or weeks later.
- **Include at least one deterministic judge per task** (tests, build, etc.) — LLM judges add noise.
- **Track cost alongside pass rate** — a 95% agent at 10× cost may not be the right choice.
- **Version-control your task definitions** — they are test fixtures, treated as code.

## Links

- Repository: [github.com/joaquinhuigomez/agent-eval](https://github.com/joaquinhuigomez/agent-eval)
