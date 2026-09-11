# Skills

Reusable agent skills, reworked to be platform-agnostic (works for Zaro and any coding agent).

| Skill | Purpose |
|---|---|
| `continuous-learning-instincts-zaro.md` | Zaro-native learning system: confidence-scored instincts, project/global scoping, evolution into skills/tasks/topics |
| `skill-comply-zaro.md` | Measure whether the agent actually follows skills/rules (spec + 3 prompt-strictness scenarios + compliance report) |
| `error-handling-patterns.md` | Exception/Result/error-codes patterns, retry/backoff, circuit breaker, graceful degradation |
| `context-engineering.md` | Curate the right agent context (persistent rules, specs, artifacts, feedback, state) |
| `context-manager.md` | Context engineering specialist role/persona |
| `compression-strategy.md` | Safely reduce bloated/stale agent context |
| `agentic-engineering.md` | Evaluation-first execution, task decomposition, capability-based model routing, risk-focused review |
| `benchmark.md` | Performance baselines & regression detection |
| `iterative-retrieval.md` | Progressive context discovery without dumping the whole tree |
| `agent-eval.md` | Compare coding agents on pass rate / cost / time / consistency |

## Source

These were reworked from Claude-Code / ECC originals into platform-agnostic,
Zaro-compatible versions. See each file's header for details.
