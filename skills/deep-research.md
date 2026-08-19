---
name: deep-research
description: Use when the user wants thorough research on any topic with evidence, citations, and multi-source synthesis — competitive analysis, technology evaluation, market sizing, due diligence, or any "research / deep dive / investigate / current state of" request.
version: 1.0.0
tags: [research, web-search, synthesis, citations, reports, due-diligence]
metadata:
  scope: universal
  category: research
  mcpmarket-version: 1.0.0
---

# Deep Research

Produce thorough, cited research reports from multiple web sources, synthesizing findings into a structured deliverable with full source attribution.

> **Platform note:** This is a rework of the ECC "deep-research" skill, which
> was written for Claude Code / Codex and depended on `firecrawl` and `exa` MCP
> servers configured in `~/.claude.json` / `~/.codex/config.toml`. In Zaro those
> external MCPs — and their config files — are unnecessary: use the built-in
> `web_search` for querying and `web_fetch` / `parse_remote_file` for reading
> full pages. The research methodology and quality rules are unchanged.

## When to Activate

- User asks to research any topic in depth
- Competitive analysis, technology evaluation, or market sizing
- Due diligence on companies, investors, or technologies
- Any question requiring synthesis from multiple sources
- User says "research", "deep dive", "investigate", or "what's the current state of"

## Tools (Zaro-native)

| Need | Zaro tool |
|---|---|
| Search the web | `web_search` (provides keyword queries + objective) |
| Read a page | `web_fetch` (markdown/plain text) |
| Read a file/doc/PDF | `parse_remote_file` (text, docs, spreadsheets, presentations, images) |
| Parallel source synthesis | `explore_workspace` (read-only multi-doc sub-agent) |
| Multi-agent parallel research | `manage_task_topic` (coordinated sub-agents) |

No external MCP servers, no config files, no API keys are required.

## Workflow

### Step 1: Understand the Goal

Ask 1–2 quick clarifying questions:
- "What's your goal — learning, making a decision, or writing something?"
- "Any specific angle or depth you want?"

If the user says "just research it" — skip ahead with reasonable defaults.

### Step 2: Plan the Research

Break the topic into 3–5 research sub-questions. Example:
- Topic: "Impact of AI on healthcare"
  - What are the main AI applications in healthcare today?
  - What clinical outcomes have been measured?
  - What are the regulatory challenges?
  - What companies are leading this space?
  - What's the market size and growth trajectory?

### Step 3: Execute Multi-Source Search

For EACH sub-question, search using `web_search` with 2–3 keyword variations each:

```
web_search(objective: "<sub-question>", search_queries: ["<variation 1>", "<variation 2>", "<variation 3>"])
```

Search strategy:
- Use 2–3 different keyword variations per sub-question
- Mix general and news-focused queries
- Aim for 15–30 unique sources total
- Prioritize: academic, official, reputable news > blogs > forums

### Step 4: Deep-Read Key Sources

For the most promising URLs, fetch full content with `web_fetch` (or
`parse_remote_file` for PDFs/documents). Read 3–5 key sources in full for
depth. Do not rely only on search snippets.

### Step 5: Synthesize and Write Report

Structure the report:

```markdown
# [Topic]: Research Report
*Generated: [date] | Sources: [N] | Confidence: [High/Medium/Low]*

## Executive Summary
[3-5 sentence overview of key findings]

## 1. [First Major Theme]
[Findings with inline citations]
- Key point ([Source Name](url))
- Supporting data ([Source Name](url))

## 2. [Second Major Theme]
...

## 3. [Third Major Theme]
...

## Key Takeaways
- [Actionable insight 1]
- [Actionable insight 2]
- [Actionable insight 3]

## Sources
1. [Title](url) — [one-line summary]
2. ...

## Methodology
Searched [N] queries across web and news. Analyzed [M] sources.
Sub-questions investigated: [list]
```

> **Citation convention:** where the platform supports traceable citations,
> attach a citation marker immediately after each sourced claim (e.g. a URL or
> file reference) rather than only listing sources at the end. The `([Source
> Name](url))` inline form above is the minimum; prefer a per-claim citation
> when available so each assertion can be traced to its origin.

### Step 6: Deliver

- **Short topics**: Post the full report in chat.
- **Long reports**: Post the executive summary + key takeaways, and save the full report to a workspace file (e.g. `/research/<topic-slug>.md`).

## Parallel Research with Subagents

For broad topics, parallelize:
- **Read-only synthesis** — use `explore_workspace` to consolidate findings across many sources.
- **Coordinated multi-agent** — use `manage_task_topic` to launch agents that each own 1–2 sub-questions, share a context directory, and write findings back for the main session to synthesize.

Each research agent searches, reads sources, and returns findings. The main session synthesizes into the final report.

## Quality Rules

1. **Every claim needs a source.** No unsourced assertions.
2. **Cross-reference.** If only one source says it, flag it as unverified.
3. **Recency matters.** Prefer sources from the last 12 months.
4. **Acknowledge gaps.** If you couldn't find good info on a sub-question, say so.
5. **No hallucination.** If you don't know, say "insufficient data found."
6. **Separate fact from inference.** Label estimates, projections, and opinions clearly.
7. **Trace every quote/figure to a prior tool result.** Never fabricate a source, URL, or number — if a result was truncated or unavailable, record it as unknown rather than inventing it.

## Examples

```
"Research the current state of nuclear fusion energy"
"Deep dive into Rust vs Go for backend services in 2026"
"Research the best strategies for bootstrapping a SaaS business"
"What's happening with the US housing market right now?"
"Investigate the competitive landscape for AI code editors"
```

## Verification Checklist

- [ ] Goal clarified (or reasonable defaults applied).
- [ ] Topic decomposed into 3–5 sub-questions.
- [ ] 2–3 keyword variations used per sub-question.
- [ ] 15–30 unique sources gathered across queries.
- [ ] 3–5 key sources read in full (not just snippets).
- [ ] Report follows the required structure (summary, themes, takeaways, sources, methodology).
- [ ] Every claim carries a source; single-source facts flagged.
- [ ] No fabricated sources, URLs, or numbers.
- [ ] Confidence level and fact-vs-inference labeling present.

## Core Principle

> **Thorough, cited, honest — synthesize from real sources and let the reader trace every claim back to its origin.**
