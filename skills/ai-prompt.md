---
name: ai-prompt
description: Use when optimizing prompts, skill descriptions, or agent instructions for clarity, specificity, and behavioral effectiveness — including auditing skill descriptions so their activation triggers actually match what the skill does.
version: 1.0.0
tags: [prompt-engineering, skill-design, description-optimization, agent-instructions, clarity]
metadata:
  scope: universal
  category: prompt-engineering
  mcpmarket-version: 1.0.0
---

# AI Prompt Optimization

Improves prompts, skill descriptions, and agent instructions using one core principle — **specificity** — expressed through four tactics, plus a specialized technique for optimizing the `description` field that controls when a skill is activated.

> **Platform note:** This is a platform-agnostic skill. The original "ai-prompt"
> concept referenced Claude Code slash-commands, `argument-hint` frontmatter, and
> `~/.claude/skills/{name}/SKILL.md` paths, and used the shorthand "CSO". In Zaro
> the equivalents are: no slash-command registry (invoke by describing the task to
> the agent), a flat `/.nexus/skills/*.md` directory, and "description-match
> optimization" (below) instead of "CSO". The techniques themselves are unchanged.

## When to Use

- Writing or refining a skill's `description` field (description-match optimization)
- Crafting system prompts for AI integrations
- Improving agent instruction clarity and specificity
- Auditing existing skills to confirm their descriptions actually match their content
- Before publishing any prompt-based artifact (skill, task prompt, app instruction)

## The Core Principle

> **Specificity drives compliance.** A prompt that is explicit, demonstrated, and
> motivated will be followed more reliably than one that is vague, abstract, or
> hedging. Optimize for specificity, not length.

Every tactic below is an expression of this single principle.

## Four Tactics (in order of impact)

### 1. Be Explicit Over Implicit

Replace vague directives with concrete, observable behavior.

| Before | After |
|--------|-------|
| "Handle errors properly" | "Wrap database calls in try/except, log the exception with its stack trace, and return a structured error response with HTTP 500" |
| "Follow best practices" | "Apply guard clauses for early return, extract methods over 20 lines, and name variables by intent rather than type" |

### 2. Show, Do Not Tell

One concrete example is worth several abstract rules. Replace rules with named instances.

```
Weak:  "Use descriptive names"
Strong: "Name variables by what they represent:
         - `user_count` not `n`
         - `is_valid` not `flag`
         - `retry_delay_seconds` not `delay`"
```

### 3. Explain the WHY for Every Rule

A rule without a rationale is ignored or misapplied. Attach motivation to every constraint.

```
Weak:  "Max 3 retries"
Strong: "Max 3 retries — beyond 3, the underlying issue is systemic rather than
         transient, so escalate instead of retrying"
```

### 4. Use Positive Framing

State what TO do rather than what NOT to do. Positive instructions are processed faster and applied more directly.

```
Weak:  "Don't use generic error messages"
Strong: "Include the specific operation, input value, and expected format in every error message"
```

> **Note on "authority" and "consistency":** Some prompt-writing guidance suggests
> citing standards for authority and past decisions for consistency. Those are
> legitimate strategies — cite a *real* standard (e.g. a project's rules file) or a
> *real* past decision. Do **not** embed invented statistics (e.g. "teams skip this
> step spend 3x longer debugging") — unverifiable numbers erode the trust that a
> prompt depends on.

## Description-Match Optimization (skill `description` fields)

A skill's `description` field is its **activation trigger**: the agent matches a user's
request against it to decide which skill to load. Optimize it for triggering
conditions, not capability summaries.

Pattern: `"Use when [specific situation + observable trigger]"`

```
Weak:  "Database migration planning tool"
Strong: "Use when planning database schema changes, assessing migration locking
         impact, or designing rollback procedures"
```

Structure a strong description with:
- **When** — the concrete situation or observable trigger ("when planning a schema change")
- **What** — the specific action, not a vague capability ("assessing migration locking impact")
- **Outcome** — optionally, the result ("...so migrations can be reviewed for risk")

### Auditing existing skills

Because the `description` is a trigger, a mismatch between it and the skill body is a
routing failure: the agent either loads the wrong skill or never loads the right one.

To audit a set of skills (e.g. `/.nexus/skills/`):

1. For each `.md` file, read the `description` field and skim the body.
2. Classify the description against the body:
   - **Matched** — the description's triggers correctly reflect what the body instructs.
   - **Under-specified** — the body does more than the description advertises; real triggers are missing.
   - **Over-specified / misleading** — the description promises triggers the body does not deliver.
3. For each mismatch, propose a rewritten description (before/after).
4. Report findings; do not silently rewrite. Present the rewrite for approval (respect scope rules).

This audit step pairs naturally with `skill-comply-zaro`, which measures whether a skill is
actually followed once loaded — together they cover "loaded correctly" (this skill) and
"followed correctly" (skill-comply).

## Procedure

### Optimizing a prompt or instruction

1. **Analyze** — identify which tactics are missing from the input (implicit? no examples? no rationale? negative framing? hedging?).
2. **Rewrite** — apply all relevant tactics.
3. **Compare** — present before/after with an annotation for each change.
4. **Trim** — confirm the optimized version is not longer than necessary (concise and specific beats long and vague).

### Optimizing a skill description

1. **Read the skill** — load the `.md` file from `/.nexus/skills/`.
2. **Extract** the current `description` from frontmatter.
3. **Description-match optimize** — rewrite using the triggering-condition pattern.
4. **Present** — show before/after for approval.
5. **Apply** — update the frontmatter only after approval.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Optimizing for length (longer = better) | Concise and specific beats long and vague |
| Adding hedging language ("try to", "if possible") | Be direct: state the expected behavior |
| Removing context while shortening | Keep the WHY, remove the fluff |
| Embedding invented statistics or authority | Cite real standards/decisions only |
| Describing a skill by capability, not trigger | Use "Use when [situation]" |

## Verification Checklist

- [ ] Every vague directive replaced with concrete, observable behavior.
- [ ] Each rule has a rationale (the WHY) where non-obvious.
- [ ] At least one concrete example where rules are abstract.
- [ ] Instructions stated positively (what to do).
- [ ] No invented statistics or fabricated authority.
- [ ] Skill `description` written in triggering-condition form.
- [ ] Description actually matches the skill body (audited).
- [ ] Final version is no longer than necessary.

## Core Principle

> **Make it specific, demonstrated, and motivated — and, for skills, make the trigger match the reality.**
