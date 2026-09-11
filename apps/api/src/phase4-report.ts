export const PHASE4_FINDINGS_TEXT = `# Phase 4: Shared User Memory & Persistent DM Personalization

## 1. Memory Architecture Findings

In earlier phases, conversation memory was fragmented:
- \\\`chat.ts\\\` had isolated memory in \\\`chatMemoryStore\\\` (storing favorite Umamusume, team, and reply style).
- \\\`ask.ts\\\` recorded turn histories in \\\`conversationMemoryStore\\\` but had no concept of user profiles, ongoing projects, or preferences.
- When users moved between \\\`ask.ts\\\` and \\\`chat.ts\\\` in Direct Messages (DM), context felt disjointed — the bot did not remember user facts across interactions.

### Unified Shared User Memory Layer (\\\`SharedUserMemoryStore\\\`)
To deliver a persistent, cohesive assistant experience, Phase 4 introduces **Shared User Memory** (\\\`packages/integrations/src/shared-user-memory.ts\\\`), shared directly between \\\`ask.ts\\\` and \\\`chat.ts\\\`.

Flow: User -> DM Router -> ask.ts / chat.ts -> Shared User Memory -> Personalized Response

---

## 2. Profile Design

### Schema & Fields
Every user profile (\\\`UserProfile\\\`) contains:
- **\\\`userId\\\`**: Normalized platform ID (e.g. \\\`discord:123456\\\`).
- **\\\`rawUserId\\\`**: Original raw ID without prefix (e.g. \\\`123456\\\`).
- **\\\`preferredName\\\`**: Trainer's name (e.g., *"Morgan"*, *"Alex"*).
- **\\\`timezone\\\`**: Timezone string (e.g., *"Asia/Manila"*, *"UTC+8"*).
- **\\\`interests\\\`**: Topics of interest (e.g., *["Discord bots", "Uma Musume", "Machine Learning"]*).
- **\\\`projects\\\`**: Active projects (e.g., *["Discord AI assistant", "Umakraft Circle Tracker"]*).
- **\\\`preferences\\\`**: Interaction and technical preferences (e.g., *["TypeScript first", "Concise answers"]*).
- **\\\`goals\\\`**: User goals (e.g., *["Reach A+ rank in Champions Meeting", "Finish Discord bot"]*).
- **\\\`metadata\\\`**: Extensible key-value metadata.
- **\\\`createdAt\\\` / \\\`updatedAt\\\`**: ISO timestamps.

### Storage Architecture
- **Dual Layer**: In-memory caching for zero-latency retrieval, backed by Turso SQLite persistence (\\\`user_profiles\\\`, \\\`user_memories\\\`, \\\`conversation_summaries\\\`).
- **Graceful Fallback**: If Turso credentials are not configured, memory stores operate in in-memory mode seamlessly without throwing or failing.

---

## 3. Memory Importance Scoring Strategy

\\\`scoreAndExtractMemory(message)\\\` analyzes incoming user utterances and determines whether information is worth remembering:

### High Importance (Stored, 0.75 - 0.95)
1. **Identity (0.95)**:
   - Name declarations (e.g., *"My name is Alex"*, *"Call me Jordan"*).
   - Timezones (e.g., *"My timezone is Asia/Manila"*).
2. **Projects (0.90)**:
   - Ongoing work (e.g., *"I'm building a Discord AI assistant"*, *"Working on project Umakraft"*).
3. **Preferences (0.85 - 0.90)**:
   - Favorite items (e.g., *"My favorite language is TypeScript"*, *"My favorite Umamusume is Tokai Teio"*).
   - Interaction styles (e.g., *"I prefer concise explanations over long essays"*).
4. **Interests (0.85)**:
   - Areas of focus (e.g., *"I'm interested in Discord bots and AI"*).
5. **Goals (0.85)**:
   - Target milestones (e.g., *"My goal is to finish the Discord bot by Friday"*).

### Filtered & Ignored (Importance <= 0.20, Not Saved)
- **Casual Chatter**: *"hi"*, *"hello"*, *"thanks"*, *"thank you"*, *"lol"*, *"cool"*, *"nice"*, *"ok"*, *"bye"*.
- **Inquiry Queries**: *"What's my project?"*, *"Who am I?"*, *"Do you remember my favorite language?"*.

---

## 4. Conversation Summary Strategy

To maintain persistent context over extended multi-turn conversations without overflowing token budgets:
- \\\`updateConversationSummary(userId, channelId)\\\` builds a rolling summary after each user turn.
- The summary synthesizes:
  1. Core user profile facts (preferredName, projects, preferences, goals).
  2. Top high-importance long-term memories (importance >= 0.70).
  3. Recent conversation exchange snippets.
- Injected into system prompts under \\\`=== USER PROFILE & MEMORY CONTEXT ===\\\`.

---

## 5. Files Changed

1. **\\\`packages/integrations/src/shared-user-memory.ts\\\`** (New):
   - Core \\\`SharedUserMemoryStore\\\` implementation with profile management, importance scoring, composite memory extraction, conversation summary compaction, and Turso persistence.
2. **\\\`packages/integrations/src/index.ts\\\`**:
   - Exported \\\`sharedUserMemoryStore\\\` and types.
3. **\\\`apps/discord/src/chat.ts\\\`**:
   - Integrated \\\`extractAndSaveMemory\\\`, injected user profile & long-term memory into system prompt, and triggered \\\`updateConversationSummary\\\`.
4. **\\\`apps/discord/src/ask.ts\\\`**:
   - Integrated \\\`extractAndSaveMemory\\\`, injected user memory into \\\`ToolCallingAgent\\\` system prompt, and updated conversation summaries.
5. **\\\`apps/discord/src/dm.ts\\\`**:
   - Leverages shared memory through \\\`generateAskResponse\\\` and \\\`generateChatResponse\\\` seamlessly.
6. **\\\`tests/discord/phase4-memory.test.ts\\\`** (New):
   - 14 comprehensive tests covering profile persistence, scoring filters, multi-fact extraction, cross-command memory sharing, and DM compatibility.
7. **\\\`apps/api/src/phase4-report.ts\\\`** & **\\\`apps/api/src/index.ts\\\`**:
   - Findings report and API endpoint.

---

## 6. Verification & Stability

- **Slash Commands Unchanged**: \\\`/ask\\\`, \\\`/chat\\\`, and \\\`/agent\\\` remain 100% operational with identical command signatures and permission checks.
- **DM Intent Router Unchanged**: DM router continues automatic classification to \\\`ask.ts\\\` vs \\\`chat.ts\\\`, while both backends now share the same persistent memory.
- **Cross-Command Context Sharing**: Verified that memories established in \\\`/chat\\\` (e.g. name or active project) are immediately accessible to \\\`/ask\\\` in subsequent queries.
`;
