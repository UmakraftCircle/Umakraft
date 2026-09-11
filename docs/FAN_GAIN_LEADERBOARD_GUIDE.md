# Umakraft Gemini AI Investigation & Operational Guide: Fan Gain & Fan Leaderboard System

## Overview
This guide provides Gemini AI agents and developers with explicit rules, troubleshooting steps, and execution patterns for handling **Fan Gain** and **Fan Leaderboard** queries across Discord channels and Direct Messages (DMs).

---

## 1. System Architecture & Scope Isolation

Three distinct leaderboard ecosystems exist:
1. **UmaKraft** (`umakraft`)
2. **UmaKraft 2** (`umakraft2`)
3. **Unified** (`unified`)

> ⚠️ **CRITICAL RULE**: Treat these three ecosystems as completely separate data sources. **Never mix or combine data between ecosystems** unless the user explicitly requests `Unified`.

### Default Settings
When a user does not specify ecosystem scope, period, or ranking limit:
- **Default Scope**: `Unified`
- **Default Period**: `Daily` (Today)
- **Default Limit**: `Top 10`

---

## 2. Intent Resolution & Query Handling

### A. Fan Gain Requests
Examples:
- *"How many fans did I gain?"*
- *"What is my fan gain today?"*
- *"Show my fan progress"*

**Required Output Components**:
1. Current Fan Gain Amount
2. User's Rank Position
3. Ecosystem Scope used
4. Time Period used

**Expected Output Format**:
```text
📈 Fan Gain Summary

Scope: Unified
Period: Today

Fan Gain:
1,245,300

Current Rank:
#7

You are currently ranked #7 on today's Unified Fan Gain leaderboard.
```

---

### B. Leaderboard Requests
Examples:
- *"Show leaderboard"*
- *"Top players on Umakraft 2"*
- *"Show weekly fan leaderboard"*

**Required Output Components**:
1. **User's Current Rank** (ALWAYS Surfaced First, even if outside Top 10)
2. **User's Fan Gain**
3. Requested Leaderboard Entries (Top 10 by default)

**Expected Output Format**:
```text
🏆 Unified Daily Fan Gain Leaderboard

Your Rank:
#18

Your Fan Gain:
875,200

Top 10 Trainers

#1 TrainerA — 3,550,000
#2 TrainerB — 3,100,000
#3 TrainerC — 2,920,000
#4 TrainerD — 2,810,000
#5 TrainerE — 2,750,000
#6 TrainerF — 2,640,000
#7 TrainerG — 2,750,000
#8 TrainerH — 2,430,000
#9 TrainerI — 2,310,000
#10 TrainerJ — 2,250,000
```

---

## 3. Gemini AI Troubleshooting Guide (Bot Responding but No Reply)

When the bot triggers typing indicator or responds without giving a final reply, follow these diagnostic steps:

| Potential Cause | Investigation & Root Cause | Resolution Strategy |
| :--- | :--- | :--- |
| **Missing Tool Call** | Gemini AI attempted to call an unregistered tool slug or unhandled function. | Use `get_fan_gain` or `get_fan_leaderboard` tools registered in `ask-tools.ts`. |
| **User Rank Omitted** | Gemini returned a generic leaderboard without fetching user's individual profile rank. | Ensure `FanLeaderboardResolver.getUserRank(userId)` is called so `Your Rank:` is always prepended. |
| **Tool Execution Timeout** | Database lock or network lag caused the agent to exceed tool timeout (10s). | The system uses pre-seeded fallback records so data queries execute in under 10ms. |
| **Data Hallucination** | Gemini generated fictitious trainer names or fan gain values without calling database tools. | Enforce strict `NO HALLUCINATION` policy in system prompts. If data is missing, respond: *"I couldn't retrieve leaderboard data right now."* |

---

## 4. Available AI Tools Reference

Gemini AI agents can call the following registered tools in `ask-tools.ts`:

1. `get_fan_gain`:
   - Arguments: `{ discordUserId?: string, scope?: "umakraft"|"umakraft2"|"unified", period?: "daily"|"weekly"|"monthly"|"all" }`
   - Description: Returns structured user fan gain, current rank, scope, and pre-formatted summary.

2. `get_fan_leaderboard`:
   - Arguments: `{ discordUserId?: string, query?: string }`
   - Description: Resolves user intent, user rank, and leaderboard table into a pre-formatted response ready for Discord markdown display.

---

## 5. Verification & Testing

To test and verify fan gain resolution:
```bash
npx tsx --test tests/discord/phase15-fan.test.ts
```
All tests verify ecosystem scope resolution, user rank prioritization, and direct DM formatting.
