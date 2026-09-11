# LILY_HANDBOOK.md — The Official Umakraft Repository Handbook

> **Welcome, Trainers and Developers!** This handbook is Lily's primary knowledge base and the official memory center for the Umakraft repository. Lily acts as the Repository Intelligence Assistant, providing read-only, grounded answers regarding architecture, systems, code locations, commands, database schemas, and version history.

---

## 1. Repository Overview

- **Project Purpose**: Umakraft is an advanced Discord AI agent and management platform built for Umamusume trainers and clubs. It combines automated fan tracking, club health monitoring, milestone tracking, and conversational AI coaching powered by Lily.
- **System Architecture**: Full-stack TypeScript architecture using Node.js, Discord.js, Turbo monorepo workspaces, SQLite/Turso databases, and Gemini AI agent tooling (`@ai-agent-platform/core`, `@ai-agent-platform/ai`).
- **Folder Structure**:
  - `apps/discord/`: Discord bot entry points, gateway, message handlers, automation engine, DM processing, memory stores, and Lily persona layers.
  - `packages/core/`: Tool registry, agent execution engine (`ToolCallingAgent`), capability discovery.
  - `packages/ai/`: AI service bootstrap, system prompt injections, memory services.
  - `packages/domains/`: Domain packages for fan-tracker, umamusume database, health diagnostics, etc.

---

## 2. Core Systems

### Fan Tracking System
- **Purpose**: Tracks daily and monthly fan gains for club trainers.
- **Implementation**: `apps/discord/src/automation/fan-gain.ts`, `@ai-agent-platform/fan-tracker`.
- **Usage**: Automatically logs fan inputs and calculates monthly pacing.

### Leaderboard System
- **Purpose**: Ranks trainers by fan gain and milestone achievement.
- **Implementation**: `apps/discord/src/automation/fan-leaderboard.ts`.
- **Commands**: `fan leaderboard`, `/fan-leaderboard`.

### Milestone & Status System
- **Purpose**: Evaluates monthly thresholds (e.g. 150M Minimum, 200M Competitive, 300M Super Competitive).
- **Implementation**: `apps/discord/src/automation/milestones.ts`.

### Deficit & Surplus Systems
- **Purpose**: Calculates required daily fans to recover from deficit pacing or maintain surplus buffers.
- **Implementation**: `apps/discord/src/automation/fan-pace.ts`.

### DM & Conversation System
- **Purpose**: Handles direct messages and conversational chat with memory persistence.
- **Implementation**: `apps/discord/src/chat.ts`, `apps/discord/src/automation/dm-memory.ts`.

### Link Request System
- **Purpose**: Guides trainers through secure account linking steps in DMs.
- **Implementation**: `apps/discord/src/automation/link-request.ts`.

---

## 3. Commands

| Command | Purpose | Usage / Trigger | Permissions |
| :--- | :--- | :--- | :--- |
| `/chat speak` | Start a conversation with Lily | `/chat speak message:Hello` | All Trainers |
| `/chat reply` | Continue current chat session | `/chat reply message:How am I doing?` | All Trainers |
| `/fan-gain` | View fan gain statistics | `fan gain` or `/fan-gain` | All Trainers |
| `/fan-leaderboard` | View top trainer rankings | `fan leaderboard` or `/fan-leaderboard` | All Trainers |
| `/rank` | View personal ranking | `rank` or `/rank` | All Trainers |
| `/milestone` | Check monthly milestone status | `milestone` or `/milestone` | All Trainers |
| `link` | Submit trainer account linking request | `link` or `request link` (DM) | All Trainers |
| `!club-health` | View club health report | `!club-health` | Club Leaders / Admins |
| `!trainer-insights`| View trainer diagnostic insights | `!trainer-insights` | Club Leaders / Admins |

---

## 4. Database & Storage

- **Storage Engine**: SQLite / Turso database with Turso client drivers and local persistence stores (`dmMemoryStore`, `trainerMemoryStore`, `chatMemoryStore`).
- **Data Models**:
  - `TrainerProfile`: Stores user ID, preferred name, linked status, and game ID.
  - `TrainerPreferences`: Stores favorite Umamusume, preferred race distance, and favorite support cards.
  - `DMMessageRecord`: Rolling conversation buffer (up to 20–50 messages per user).

---

## 5. Changelog & Version History

### Version 2.5.0 (Current) — Lily Repository Intelligence & Character Solidification
- **Updates**:
  - Implemented Phase 4 Character Solidification (Lily as a true Umamusume character).
  - Implemented Phase 5 Repository Intelligence System (`LILY_HANDBOOK.md` and read-only repository awareness).
- **Fixes**: Cleaned up system jargon and enforced warm Umamusume persona across all automation and error outputs.

---

## 6. Change Tracking System

| Date | Version | Author | Affected System | Description | Files Changed | Impact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-10 | 2.5.0 | Lily AI | Repository / Personality | Created LILY_HANDBOOK.md and established Repository Intelligence | `LILY_HANDBOOK.md`, `global-personality.ts` | Complete read-only repository awareness |

---

## 7. Read-Only Protection
Lily is strictly a **repository observer**. She cannot edit files, rewrite code, change database records, execute deployments, or create commits. All knowledge is retrieved in a read-only manner from `LILY_HANDBOOK.md` and source files.
