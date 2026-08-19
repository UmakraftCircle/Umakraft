---
name: deep-research
description: Use when you need thorough, multi-phase investigation of a complex topic — spanning web sources, workspace/codebase patterns, and stored memory — synthesized into a cited, evidence-graded research report. Covers "research / deep dive / investigate / current state of" requests, competitive analysis, and due diligence.
version: 2.0.0
tags: [research, web-search, memory, synthesis, citations, reports, due-diligence, evidence-grading]
metadata:
  scope: universal
  category: research
  mcpmarket-version: 1.0.0
---

# Deep Research

Orchestrate multi-phase deep research campaigns that gather, cross-reference, and synthesize information from multiple sources into a structured, evidence-graded report.

> **Platform note:** This is a rework of the `claude-flow` "deep-research" skill,
> which used `mcp__claude-flow__memory_*`, `agentdb_*`, and `neural_predict` MCP
> tools, plus a `Bash`/`WebSearch`/`WebFetch` tool set. In Zaro the equivalents
> are: workspace memory (`/.nexus/memory/`) and `nexus_search` for stored/known
> knowledge, `web_search` + `web_fetch` / `parse_remote_file` for external info,
> `nexus_search` / `nexus_find` / `nexus_tree` for codebase analysis, and
> `explore_workspace` or `manage_task_topic` for parallel sub-agent threads. The
> research methodology below is unchanged.

## When to use

When you need to investigate a complex topic thoroughly — spanning web sources, codebase patterns, stored memory, and external documentation — and produce a structured synthesis.

## Steps

1. **Define research scope** — break the question into 3–7 sub-questions that together answer the main question.
2. **Search existing knowledge** — check what's already known: query workspace memory (`/.nexus/memory/`), `nexus_search` (hybrid/fulltext/regex), and any prior research files under `/research/`.
3. **Web research** — use `web_search` (2–3 keyword variations per sub-question) and `web_fetch` / `parse_remote_file` to gather external information.
4. **Codebase / workspace analysis** — use `nexus_search`, `nexus_find`, `nexus_tree` to examine relevant source files or docs.
5. **Cross-reference** — compare findings across sources, identify agreements and contradictions.
6. **Store findings** — persist each key finding to the workspace (e.g. `/research/<topic>/findings.md` or a `.table` file) rather than leaving results only in the conversation.
7. **Store patterns** — record reusable patterns discovered (repeated approaches, recurring structures) so future research can leverage them.
8. **Synthesize** — produce a structured research report with:
   - Executive summary (2–3 sentences)
   - Key findings (bulleted)
   - Evidence quality assessment (high/medium/low per finding)
   - Open questions remaining
   - Recommended next steps

## Research depth levels

- **Quick** — memory/known-knowledge search + 1–2 web queries; minutes.
- **Standard** — memory/known + web + codebase scan; a few more minutes.
- **Deep** — all sources + cross-referencing + pattern storage; longer.
- **Exhaustive** — deep + spawn sub-agents for parallel research threads (use `explore_workspace` for read-only synthesis, or `manage_task_topic` for coordinated multi-agent threads).

## Storage namespaces (workspace)

- `/research/<topic>/findings.md` — raw findings keyed by topic.
- `/research/<topic>/synthesis.md` — completed synthesis reports.
- `/research/<topic>/sources.md` — source URLs and references.

(These are plain workspace files; no external memory DB is required.)

## Quality Rules

1. **Every claim needs a source.** No unsourced assertions.
2. **Cross-reference.** If only one source says it, flag it as unverified.
3. **Recency matters.** Prefer sources from the last 12 months.
4. **Acknowledge gaps.** If you couldn't find good info on a sub-question, say so.
5. **No hallucination.** If you don't know, say "insufficient data found."
6. **Separate fact from inference.** Label estimates, projections, and opinions clearly.
7. **Trace every quote/figure to a prior tool result.** Never fabricate a source, URL, or number.

## Verification Checklist

- [ ] Scope decomposed into 3–7 sub-questions.
- [ ] Existing knowledge (memory + workspace) checked before web research.
- [ ] 2–3 keyword variations used per sub-question on the web.
- [ ] Codebase/workspace files examined where relevant.
- [ ] Cross-referencing done (agreements + contradictions surfaced).
- [ ] Findings persisted to workspace files (not just chat).
- [ ] Report includes summary, findings, per-finding evidence grades, open questions, next steps.
- [ ] Every claim sourced; no fabricated sources/URLs/numbers.

## Core Principle

> **Investigate broadly, cross-reference honestly, and deliver a synthesis where every claim is traceable to its evidence.**
