---
name: agent-eval
description: Directly compare coding agents (Claude Code, Aider, Codex, Zaro, etc.) on custom tasks using pass rate, cost, time, and consistency metrics.
origin: ECC
tools: Read, Write, Edit, Bash, Grep, Glob
metadata:
  mcpmarket-version: 1.0.0
---

# Agent Eval Skill

A lightweight CLI tool for head-to-head comparisons of coding agents on reproducible tasks.

## When to Use

- Compare coding agents on your own codebase
- Measure agent performance before adopting a tool/model
- Run regression checks when agents update
- Make data-driven agent selection decisions

## Installation

```bash
pip install git+https://github.com/joaquinhuigomez/agent-eval.git@6d062a2f5cda6ea443bf5d458d361892c04e749b
```

> **Platform note:** Standalone Python CLI (not Claude-dependent). For Zaro, the same methodology works without the CLI: define task YAML in the workspace, use git worktrees for isolation, run each agent via `execute_command` (sandbox), record pass/cost/time.

## YAML Task Definition

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
commit: "abc1234"
```

## Git Worktree Isolation

Each agent run gets its own git worktree — no Docker required.

## Collected Metrics

| Metric | What it measures |
|---|---|
| Pass Rate | Whether code passes judges |
| Cost | API spend per task |
| Time | Wall-clock seconds |
| Consistency | Pass rate across repeated runs |

## Workflow

1. Define tasks in `tasks/*.yaml`.
2. Run agents: `agent-eval run --task tasks/...yaml --agent claude-code --agent aider --runs 3`.
3. Compare: `agent-eval report --format table`.

## Judge Types

- **Code-based**: `pytest`, `command` (deterministic).
- **Pattern-based**: `grep`.
- **Model-based**: `llm` (LLM as judge).

## Best Practices

- 3–5 real-workload tasks, 3+ trials per agent.
- Pin a commit for reproducibility.
- Include a deterministic judge per task (tests/build) — LLM judges add noise.
- Track cost alongside pass rate.
- Version-control task definitions.
