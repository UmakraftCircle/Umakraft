---
name: umamusume-data-miner
description: Retrieves accurate Umamusume: Pretty Derby information from approved sources only. Covers characters, support cards, skills, tracks, game mechanics, scenarios, guides, tools, events, lore, and community info. Use when the user asks about any Umamusume topic that needs lookup against primary game data (uma.guide), planning/analysis tools, guides, lore (Umamusume Wiki), or community discussion (r/UmamusumeGame).
---

# Umamusume Data Miner Skill

## Purpose

Provide an AI agent with an efficient, controlled method for retrieving accurate *Umamusume: Pretty Derby* information from approved sources.

The skill prioritizes direct source matching, minimizes unnecessary web searches, and prevents unrestricted/random scraping of unrelated websites.

## Core Principle

> Use approved sources first. Do not randomly search or scrape unrelated websites when an approved source can provide the requested information.

## Scope

This skill covers:

- Character data
- Support Cards
- Skills
- Tracks and race information
- Game mechanics
- Training and deck-building tools
- Scenarios and guides
- Events and schedules
- Lore and character background
- Community information

## Accuracy Priority

When multiple sources contain the same information:

1. Prefer authoritative/primary Umamusume data sources.
2. Prefer `uma.guide` for gameplay data and mechanics.
3. Use specialized approved sources when they provide information unavailable or more detailed than the primary source.
4. Treat community sources as supporting evidence, **not** authoritative data.

---

## Source Registry

The agent MUST use this registry when searching for Umamusume information. Each source has an assigned priority and intended purpose.

### Priority 1 — Primary Game Data

**Characters**
- URL: https://uma.guide/characters
- Use for: Character profiles, stats, growth rates, aptitudes, unique skills, and character-related gameplay data.

**Support Cards**
- URL: https://uma.guide/support-cards
- Use for: Support card data, effects, stats, events, skills, and card details.

**Skills**
- URL: https://uma.guide/skills
- Use for: Skill names, effects, conditions, costs, types, and skill-related data.

**Tracks**
- URL: https://uma.guide/tracks
- Use for: Track, racecourse, distance, surface, conditions, and track-related data.

**Terms / Glossary**
- URL: https://uma.guide/guides/glossary
- Use for: Umamusume terminology, abbreviations, and game-specific definitions.

### Priority 2 — Planning, Analysis & Game Tools

**Agenda Planner**
- URL: https://uma.guide/agenda-planner
- Use for: Agenda planning and related planning information.

**Support Card Deck Builder**
- URL: https://uma.guide/support-cards/deck-builder
- Use for: Support deck construction and deck analysis.

**Training Simulator**
- URL: https://uma.guide/support-cards/training-simulator
- Use for: Training simulations and support-card interactions.

**Support Card Comparison**
- URL: https://uma.guide/support-cards/compare
- Use for: Comparing support cards and their effects.

**CM Canvas / Assets**
- URL: https://uma.guide/cm-canvas
- Use for: Champion Meeting assets and related visual/reference data.

**Champion Meeting Schedule**
- URL: https://uma.guide/cm-schedule
- Use for: Champion Meeting schedules and related timing information.

**GameTora Events**
- URL: https://gametora.com/umamusume/events
- Use for: Event choices, event outcomes, rewards, and event-related game information.
- Priority: Secondary to uma.guide when both sources contain equivalent information.

### Priority 3 — General Guides & Game Mechanics

**Guide Overview**
- URL: https://uma.guide/guides
- Use for: Finding relevant uma.guide guides when no more specific registry entry applies.

**Independent Training**
- URL: https://uma.guide/guides/independent-training
- Use for: Independent training mechanics and strategy.

**Beginner Guide**
- URL: https://uma.guide/guides/beginners
- Use for: Beginner explanations and fundamental gameplay guidance.

**Gacha / Banner Guide**
- URL: https://uma.guide/guides/banners
- Use for: Gacha banners, banner information, and pulling guidance.

**Career Mechanics**
- URL: https://uma.guide/guides/career-mechanics
- Use for: Career mode mechanics and systems.

**Deck Building**
- URL: https://uma.guide/guides/deckbuilding
- Use for: Support-card deck-building strategy and principles.

**Skill Explanation**
- URL: https://uma.guide/guides/skills
- Use for: General explanations of how skills work.

**Sparks & Inheritance**
- URL: https://uma.guide/guides/sparks
- Use for: Sparks, inheritance, factors, and inheritance mechanics.

**Stats Explained**
- URL: https://uma.guide/guides/stats
- Use for: Stat mechanics and explanations.

**Racecourse Analysis**
- URL: https://uma.guide/guides/racecourse-analysis
- Use for: Racecourse-specific analysis and strategy.

**Race Mechanics**
- URL: https://uma.guide/guides/race-mechanics
- Use for: Race mechanics and race behavior.

**Skill Conditions**
- URL: https://uma.guide/guides/skill-conditions
- Use for: Understanding skill activation conditions.

**Team Trials**
- URL: https://uma.guide/guides/team-trials
- Use for: Team Trials mechanics and strategy.

### Priority 4 — Skill-Type Mechanics

**Recovery Skills** — https://uma.guide/guides/skills-recovery — Recovery skill mechanics.

**Velocity Skills** — https://uma.guide/guides/skills-velocity — Velocity skill mechanics.

**Acceleration Skills** — https://uma.guide/guides/skills-acceleration — Acceleration skill mechanics.

**Vision Skills** — https://uma.guide/guides/skills-vision — Vision skill mechanics.

**Debuff Skills** — https://uma.guide/guides/skills-debuff — Debuff skill mechanics.

**Lane Movement** — https://uma.guide/guides/skills-lane-movement — Lane movement skill mechanics.

**Special Scaling Skills** — https://uma.guide/guides/skills-special-scaling — Special scaling skill mechanics.

**Unique Skills** — https://uma.guide/guides/skill-unique — Unique skill mechanics.

### Priority 5 — Scenario & Mode Guides

**Champion Meeting Guide**
- Base URL: https://uma.guide/guides/cm18-guide
- Use for: Champion Meeting-specific guidance.
- Special rule: Do NOT permanently assume "cm18-guide" is current. Search the approved guide directory for the latest Champion Meeting guide and use the newest available CM guide instead.

**Grand Concert** — https://uma.guide/guides/grand-concert — Grand Concert scenario mechanics and strategy.

**Trackblazer** — https://uma.guide/guides/trackblazer — Trackblazer scenario mechanics and strategy.

**Unity Cup Deckbuilding** — https://uma.guide/guides/unity-cup-deckbuilding-guide — Unity Cup deck-building strategy.

**Unity Cup Career** — https://uma.guide/guides/unity-cup-career-guide — Unity Cup career mechanics and strategy.

### Priority 6 — Lore & Community

**Umamusume Wiki**
- URL: https://umamusume.fandom.com/wiki/Umamusume_Wiki
- Use for: Character lore, background, relationships, story information, and other narrative details.
- Rule: Do not use as the primary authority for gameplay mechanics when uma.guide provides the relevant information.

**Reddit — r/UmamusumeGame**
- URL: https://www.reddit.com/r/UmamusumeGame
- Use for: Community discussion, player experiences, discoveries, strategy discussion, and current community knowledge.
- Rule: Reddit information MUST be treated as community-sourced information, not authoritative game data.
- Rule: Important gameplay claims should be verified against an approved primary or secondary data source whenever possible.

---

## Source Selection Rules

When processing a request:

1. Identify what type of information the user is requesting.
2. Select the most specific matching source from this registry.
3. Use the highest-priority applicable source first.
4. Do not search unrelated websites if an approved source is applicable.
5. Use specialized tools when the request is a calculation, comparison, simulation, or planning task.
6. Use lore sources for lore rather than gameplay-data sources.
7. Use Reddit only for community knowledge and player experience.
8. When sources conflict, prefer the higher-priority source and report meaningful uncertainty.
9. Direct URLs in this registry are authoritative navigation targets; the agent MUST NOT invent alternative URL paths.
10. If the requested information cannot be found in the applicable approved sources, report that it was not found rather than silently expanding to unrestricted scraping.

## Request Classification

Before searching, identify the request type: Character / Support Card / Skill / Track-Race / Game mechanic / Scenario / Guide-Strategy / Tool-Calculator / Event / Lore / Community discussion / Comparison / General search.

| Request type | Route to source |
|---|---|
| Character | uma.guide/characters |
| Support Card | uma.guide/support-cards |
| Skill | uma.guide/skills |
| Track / Race | uma.guide/tracks |
| Game mechanic | matching guide in uma.guide/guides |
| Scenario | matching scenario guide |
| Guide / Strategy | relevant guide in uma.guide/guides |
| Tool / Calculator / Comparison / Planning | matching uma.guide tool |
| Event | uma.guide (primary) or gametora.com/umamusume/events (secondary) |
| Lore | umamusume.fandom.com/wiki |
| Community discussion | reddit.com/r/UmamusumeGame |
| General search | start at uma.guide |

## Efficient Retrieval Process

The agent MUST follow this sequence:

1. **Understand the request** — extract the subject, requested information, and relevant context.
2. **Select the source** — match the request to the Source Registry.
3. **Navigate directly** — open the registered URL instead of performing unrestricted web searches.
4. **Search within the approved source** — locate the relevant page, entry, or data.
5. **Collect only relevant information** — do not extract unnecessary page content.
6. **Cross-check when appropriate** — if information is important, ambiguous, outdated, or conflicting, check another approved source.
7. **Compile** — convert gathered information into a clear response rather than reproducing scraped content.
8. **Cite the source** — include the relevant source reference/link when available.

## Search Optimization & Retrieval Strategy

### Search objective

> Find the correct approved source → retrieve only relevant data → verify → stop searching.

Minimize unnecessary web requests. Do not browse multiple websites when the requested information is already available from the correct approved source.

### Direct URL priority

- Use registered URLs exactly as provided.
- Do NOT guess URL paths, modify URL slugs unnecessarily, search unrelated websites first, or use search-engine results when the registered source is directly accessible.
- If a registered URL redirects to a newer/equivalent page, follow the redirect.

### Targeted search

When a source contains many entries:
1. Search for the exact requested name (e.g. `Special Week`).
2. If unavailable, try the official/common spelling.
3. If still unavailable, search a distinctive keyword.
4. Avoid broad searches that return unrelated information.

### Search attempts

Use no more than **3 targeted attempts** per source: exact name → alternate/common name → relevant keyword. If still not found, stop and evaluate another approved source. Do not repeatedly retry the same search.

### Multiple approved sources

Use additional sources only when: the primary source lacks the requested information; the information requires verification; the user specifically requests comparison between sources; the primary source appears incomplete or outdated; or the request concerns a category handled by another source.

### Cross-verification

Cross-check when: two sources provide conflicting values; a value appears unusual; the information is time-sensitive; a guide may have been superseded; or the user asks for highly accurate numerical information.

When sources conflict: prefer the higher-priority source; check whether one source is newer; do NOT silently merge contradictory values; mention the discrepancy when it affects the answer.

### Latest Champion Meeting guide

Champion Meeting guides are time-sensitive. `cm18-guide` is a reference pattern, NOT a permanent current guide. When the user asks for the current/latest CM:
1. Open the approved `uma.guide/guides` source.
2. Identify the newest Champion Meeting guide.
3. Use the newest available guide.
4. Ignore older CM guides unless historical information is requested.

Never assume CM18 remains the latest.

### Dynamic pages & tools

For interactive pages (Agenda Planner, Deck Builder, Training Simulator, Support Card Compare, CM Canvas, CM Schedule): first determine whether the requested information is available directly on the page. Do not treat unavailable interactive output as missing factual data until the page has been properly inspected.

### Source failure

1. Retry once if the failure appears temporary.
2. Try another relevant approved source.
3. If no approved source can provide the information, report that it could not be verified.

Do NOT automatically expand into unrestricted scraping.

### Stop condition

Stop searching when the requested information is found, sufficiently verified, or the response can be compiled confidently. More searching does not automatically mean better accuracy.

### Efficiency rule

Accuracy first, but avoid redundant retrieval. Prefer "Classify → Direct Source → Targeted Search → Verify → Compile → Respond" over "General Web Search → Many Websites → Random Pages → Scrape Everything → Compile".

## Information Compilation Rules

The agent MUST NOT simply copy raw scraped data. Instead:

- Remove irrelevant fields.
- Combine related information.
- Preserve important numerical values exactly.
- Preserve skill names and proper nouns accurately.
- Distinguish confirmed information from interpretation.
- Do not invent missing information.
- Do not present community speculation as confirmed data.
- Prefer concise explanations unless the user requests detail.

## Response Formats

Use these structures when applicable. Do not include empty sections.

### Character

```
[Character Name]
- Overview: Short identification of the character.
- Real-Life Inspiration: Original racehorse/background, if relevant.
- Profile: Relevant character information.
- Growth Rates: Relevant gameplay values.
- Aptitudes: Surface, distance, and running-style aptitudes.
- Unique Skill: Name and effect.
- Notable Skills: Important skills when relevant.
- Career / Gameplay: Important gameplay information when relevant.
- Lore: Include only when requested or useful.
- Source: Link to the approved source used.
```

### Support Card

```
[Support Card Name]
- Type: Speed / Stamina / Power / Guts / Wit / Friend / etc.
- Rarity: Relevant rarity.
- Effects: Important effects.
- Events: Important event information.
- Skills: Relevant skills.
- Best Uses: Only when supported by the source.
- Source: Approved source link.
```

### Skill

```
[Skill Name]
- Type: Skill category.
- Effect: Exact effect.
- Activation Condition: Explain clearly.
- Cost: If applicable.
- Distance / Track Restrictions: If applicable.
- Upgrade Versions: If applicable.
- Notes: Important mechanics or interactions.
- Source: Approved source link.
```

### Track

```
[Track Name]
- Location: Relevant racecourse.
- Distance: Distance.
- Surface: Turf / Dirt.
- Direction: Left / Right / Straight, when applicable.
- Conditions: Relevant track conditions.
- Race Mechanics: Important track-specific mechanics.
- Strategy Notes: Only when supported by an approved guide.
- Source: Approved source link.
```

### Lore

Provide a concise narrative explanation using the Umamusume Wiki as the primary lore source. Gameplay information should still be verified through `uma.guide` when relevant.

### Comparison

When comparing two or more subjects, organize into a compact table:

| Category | A | B |
|---|---|---|
| Type | | |
| Important Stats | | |
| Skills | | |
| Main Strength | | |
| Main Weakness | | |

Follow source priority rules for each compared item.

## Unknown or Missing Information

If the approved sources do not contain the requested information, respond:

> "I couldn't find confirmed information for that in the supported sources."

Never fabricate an answer. If community information exists but cannot be verified, clearly label it as community-sourced.

## Response Length

Default to concise responses containing only information relevant to the user's question. Expand only when the user requests detailed explanation, full data, comparison, guide, analysis, or step-by-step instructions.
