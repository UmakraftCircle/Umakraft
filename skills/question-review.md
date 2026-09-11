---
name: question-review
description: Use when the user provides a set of review questions about a file, folder, or document set and wants direct, evidence-backed answers with confidence levels and follow-up actions.
version: 1.0.0
tags: [review, questions, evidence, confidence, audit]
metadata:
  scope: universal
  category: review
  mcpmarket-version: 1.0.0
---

# Question Review

Run a structured review driven by explicit user questions, and provide direct answers with evidence and follow-up actions.

## When to use

Use this skill when the user provides a set of review questions and wants direct, evidence-backed answers.

## Input Expectations

- Review target location (file, folder, or document set).
- One or more review questions.
- Optional response format preferences.

## Workflow

1. **Confirm the complete list of questions** to answer (list them back before reviewing so nothing is missed).
2. **Inspect the target artifacts** relevant to each question (read the files/sections that bear on each question).
3. **Answer each question** with:
   - Direct answer
   - Supporting evidence from the reviewed artifact (with citation/position)
   - Confidence level (high, medium, or low)
4. **Identify gaps** where the artifact cannot fully answer a question — mark these explicitly as unresolved rather than guessing.
5. **Add follow-up recommendations** for unresolved or low-confidence areas.

## Output Expectations and Quality Checks

- Every input question is answered or explicitly marked unresolved.
- Evidence is cited from the reviewed artifact (not asserted from memory).
- Confidence levels are provided for each answer.
- Follow-up actions are clear and scoped.

## Verification Checklist

- [ ] Full question list confirmed before review.
- [ ] Relevant artifacts actually inspected (not assumed).
- [ ] Each answer has a direct statement + cited evidence + confidence level.
- [ ] Unanswered/unanswerable parts marked unresolved (no fabricated answers).
- [ ] Follow-up recommendations are concrete and scoped.

## Core Principle

> **Answer what was asked, prove it from the artifact, and say plainly when the evidence is missing.**
