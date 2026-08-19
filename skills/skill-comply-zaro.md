---
name: skill-comply-zaro
description: Measure whether the Zaro agent actually follows skills, rules, and agent definitions — auto-generates behavioral specs and 3 prompt-strictness scenarios, runs tasks, classifies tool-call sequences, and reports compliance rates with full timelines.
version: 1.0.0
metadata:
  scope: universal
  category: agent-evaluation
  mcpmarket-version: 1.0.0
---

# skill-comply (Zaro): Compliance Measurement

Measures whether the Zaro agent actually follows skills, rules, or agent definitions. This is a rework of the Claude-Code "skill-comply" tool. Instead of shelling out to `claude -p` and parsing `stream-json`, it drives the Zaro agent through scheduled/task runs and inspects the resulting file changes and memory artifacts as the behavioral trace.

## What Changed from the Claude-Code Version

| Concern | Claude Code (skill-comply) | Zaro (this skill) |
|---|---|---|
| Agent under test | `claude -p` subprocess | Zaro agent runs (`schedule_task`, immediate one-shot jobs) |
| Behavioral trace | `stream-json` tool-use events | Changed files (`nexus_file_history`) + `.table` audit rows |
| Spec/scenario generation | `claude -p` with prompt templates | Zaro agent run with the same prompt role |
| Classification | LLM `claude -p` classifier | Zaro agent run (classification passes) |
| Sandbox | `/tmp/skill-comply-sandbox` + `git init` | Workspace subfolder (isolated) or a dedicated workspace |
| Model selection | `--model haiku/sonnet/opus` | `AI_PROVIDER` / model config via `buildAIService()` |
| Output | `results/<skill>.md` | Workspace report file |

## What It Measures

The core value is unchanged — **prompt independence**: is a skill/rule followed even when the task prompt doesn't explicitly ask for it?

## Pipeline

```text
1. Spec generation   — extract an ordered list of required behavioral steps
                       from any .md skill/rule file.
2. Scenario generation — produce 3 prompts with decreasing strictness:
                       supportive → neutral → competing.
3. Execution          — run the Zaro agent once per scenario on the same
                       target workspace, capturing its behavioral trace.
4. Classification     — map trace events onto spec steps (LLM, not regex).
5. Grading            — deterministic temporal-order check + compliance rate.
6. Report             — self-contained markdown with spec, prompts, timelines.
```

## Step 1 — Generate the Compliance Spec

Feed the target file to the agent with the spec-generator role:

```text
prompt: >
  You are a compliance-spec generator. Given the following skill/rule
  document, produce an ordered list of observable behavioral steps the
  agent MUST take when applying it. For each step include an id, a short
  description, and whether it is required (true/false). Return valid YAML:

  steps:
    - id: step-1
      description: "..."
      required: true

  <skill content here>
```

Save the parsed spec to the workspace (e.g. `/compliance/<skill-name>/spec.yaml`).

### Spec shape (unchanged from original)

```yaml
steps:
  - id: search-before-edit
    description: "Search the codebase before writing new code"
    required: true
  - id: write-tests
    description: "Add or update tests for the change"
    required: true
  - id: run-tests
    description: "Run the test suite"
    required: true
```

## Step 2 — Generate Scenarios (3 strictness levels)

```text
supportive  — prompt explicitly asks the agent to follow the skill.
neutral     — prompt describes the task without mentioning the skill.
competing   — prompt adds a constraint that tempts the agent to skip steps
              (e.g. a tight deadline or "minimal changes only").
```

Generate each scenario by asking the agent (scenario-generator role) to produce,
for each level: an `id`, `level` (1/2/3), `level_name`, `description`, and the
`prompt` to issue to the agent under test.

## Step 3 — Execute (Zaro agent runs)

For each scenario, run the Zaro agent once via `schedule_task` (immediate,
one-shot — omit `cron`/`run_at`/`watch_paths`):

```text
schedule_task create
  name: skill-comply-<skill>-<level>
  prompt: <scenario.prompt + explicit "follow the skill/rule under test">
```

### Capturing the behavioral trace (instead of stream-json)

Zaro has no `claude -p --output-format stream-json`. The equivalent observable
trace is:

1. **File history** — `nexus_file_history` on each touched path records
   read/write/patch events in order (a chronological tool-call timeline).
2. **Audit table** — optionally have the agent append one row per action to a
   `.table` file (`/compliance/<skill-name>/trace.table`) with columns
   `{ order, tool, path, action, note }`, so the trace is SQL-queryable.
3. **Run logs** — if the run is a workflow, `manage_workflow run_logs` exposes
   per-node input/output.

Prefer the audit `.table` for a deterministic, ordered trace. Treat it as the
Zaro equivalent of `ObservationEvent(timestamp, tool, input, output)`.

## Step 4 — Classify (LLM, not regex)

Run a classification pass with the spec steps + the ordered trace:

```text
prompt: >
  Map each trace event to the spec step(s) it satisfies. Return JSON:
  { "<step-id>": [<event indices>] }.

  Steps:
  <steps>
  Trace:
  <ordered events>
```

## Step 5 — Grade

- **Detection** — a step is "detected" if at least one event maps to it.
- **Temporal order** — verify `after_step` / `before_step` constraints
  deterministically from event order (same logic as the original grader).
- **Compliance rate** = detected required steps / total required steps.
- **Hook promotion flag** — raised when compliance < threshold (suggests the
  behavior is too easy to skip and should be enforced more strictly — for Zaro,
  via a rule in `/.nexus/memory/.../rules/` rather than a Claude hook).

## Step 6 — Report

Write a self-contained markdown report to `/compliance/<skill-name>/report.md`
containing: the spec, the 3 scenario prompts, per-scenario compliance scores,
step-level detected/evidence/failure reasoning, and the full ordered timeline.

## Usage (Zaro task form)

```text
schedule_task create
  name: skill-comply-run
  prompt: >
    Run the skill-comply-zaro pipeline for the file at <path>.
    (1) generate the spec, (2) generate 3 scenarios, (3) execute each via a
    one-shot schedule_task, (4) classify + grade, (5) write the report to
    /compliance/<skill-name>/report.md. Do not modify project code.
```

Use `--dry-run` equivalent: stop after spec + scenario generation (no execution)
when the caller only wants the spec.

## Safety & Scope

- Execution runs the agent **on a copy / isolated workspace folder**, never on
  production code, unless explicitly approved.
- The agent-under-test must be pointed at a sandbox; its writes are the
  *subject* of observation, not live project edits.
- Classification and grading are read-only aside from report/trace files.
- Respect the coding-agent scope rules: measure and report; do not fix or
  "improve" the skill under test unless the user approves.

## Verification Checklist

- [ ] Spec is an ordered list of required/optional behavioral steps.
- [ ] Three scenarios exist at supportive/neutral/competing strictness.
- [ ] Each scenario ran in an isolated workspace folder.
- [ ] Trace is captured as an ordered audit `.table` (or file history).
- [ ] Classification maps events to steps via LLM, not regex.
- [ ] Temporal ordering was checked deterministically.
- [ ] Compliance rate = detected required / total required.
- [ ] Report is self-contained (spec + prompts + timelines).

## Core Principle

> **A skill that only works when the prompt begs for it is not a real skill.**

skill-comply-zaro measures whether the Zaro agent follows your rules under
pressure, so low-compliance steps can be hardened (promoted into memory rules
or stricter agent instructions) instead of silently ignored.
