export const PHASE5_FINDINGS_TEXT = `# Phase 5: Conversation Memory & Context Management

## 1. Goal & Architecture Overview

When a user interacts with the AI agent in Discord Direct Messages (DMs):

- **Turn 1**: User: "Hi" -> Bot: "Hello!"
- **Turn 2**: User: "My name is John" -> Bot: "Nice to meet you John."
- **Turn 3**: User: "What's my name?" -> Bot: "Your name is John."

The bot remembers previous messages within the conversation, maintains strict user session isolation, and enforces a sliding window history limit to prevent unbounded memory growth.

---

## 2. Conversation Store Design

### Store Key & Data Structure
- **Store Instance**: \`conversationMemoryStore\` (\`packages/integrations/src/conversation-memory.ts\`)
- **Keyed by Discord User ID**: \`Map<string, ChatMessage[]>\` where the key is normalized to the raw user ID (\`message.author.id\`).
- **Message Structure**:
  \`\`\`typescript
  export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }
  \`\`\`

### Sliding Window History Limits
- **Limit**: \`MAX_MESSAGES = 20\`
- **Eviction Strategy**: Whenever \`history.length > 20\`, the oldest entries are pruned (\`history.splice(0, history.length - MAX_MESSAGES)\`).
- **Isolation**: Messages from User A (e.g. \`1111\`) and User B (e.g. \`2222\`) reside in completely separate map buckets, guaranteeing zero cross-user memory leakage.

---

## 3. DM Lifecycle & Context Injection

### On Every Inbound DM:
1. When a user sends a DM, the user message is pushed to conversation history:
   \`\`\`typescript
   conversationMemoryStore.addMessage(userId, 'user', message.content);
   \`\`\`
2. The agent fetches recent multi-turn dialogue using \`conversationMemoryStore.getConversation(userId)\`.
3. The conversation history is formatted into contextual dialogue turns:
   \`\`\`text
   Trainer: Hi
   Assistant: Hello!
   Trainer: My name is John
   Assistant: Nice to meet you John.
   Trainer: What's my name?
   \`\`\`
4. The formatted context is injected into \`ToolCallingAgent\` and the LLM prompt.
5. Upon generating the response, the assistant reply is saved back to memory:
   \`\`\`typescript
   conversationMemoryStore.addMessage(userId, 'assistant', reply);
   \`\`\`

---

## 4. Affected Files & Diffs

1. **\`packages/integrations/src/conversation-memory.ts\`** (Modified):
   - Added \`ChatMessage\` interface with roles \`'user' | 'assistant' | 'system'\`.
   - Added in-memory \`conversations = new Map<string, ChatMessage[]>()\` keyed by user ID.
   - Exported \`MAX_MESSAGES = 20\`.
   - Added \`addMessage(userId, role, content)\` with automatic sliding window truncation.
   - Added \`getConversation(userId)\`, \`clear(userId?)\`, and \`formatContext(messages)\`.
   - Synced \`append()\` to update the isolated conversation map on every turn.

2. **\`apps/discord/src/chat.ts\`** (Modified):
   - Integrated \`conversationMemoryStore.getConversation(userId)\` to feed conversation context into \`ToolCallingAgent\`.
   - Formatted multi-turn chat history into prompt context turns.

3. **\`apps/discord/src/dm.ts\`** (Verified & Extended):
   - Ensured Direct Message events pass normalized Discord author IDs through router to \`chat.ts\` / \`ask.ts\` with conversation memory retention.

4. **\`tests/discord/phase5-conversation-context.test.ts\`** (New):
   - 8 unit and integration tests verifying user isolation, sliding window eviction, name retention across turns, and favorite color recall.

5. **\`apps/api/src/phase5-report.ts\`** & **\`apps/api/src/index.ts\`**:
   - Exposed \`GET /phase5-findings\` endpoint and added Phase 5 summary card to the web dashboard.

---

## 5. Verification & Testing Results

- **Test Suite**: \`tests/discord/phase5-conversation-context.test.ts\`
- **Result**: 8 / 8 tests passed (100% pass rate).
- **All Discord Tests**: 46 / 46 tests across Phases 1–5 passed.
`;
