export const PHASE3_FINDINGS_TEXT = `# Phase 3: Discord DM Intent Router (Automatic Routing to ask.ts vs chat.ts)

## 1. Investigation Phase: ask.ts vs chat.ts Architecture

Before modifying code, the complete execution paths, prompts, memory systems, and session structures of both systems were mapped:

### A. ask.ts System Architecture
- **Files Involved**:
  - \`apps/discord/src/ask.ts\`: Slash command registration, question lifecycle (\`question\`, \`answer\`, \`correction\`), tool registration, and response rendering.
  - \`apps/discord/src/ask-tools.ts\`: Dedicated /ask tools (\`get_trainer_stats\`, \`search_trainers\`, \`get_leaderboard\`, etc.).
  - \`packages/core/src/tool-calling-agent.ts\`: Multi-turn ReAct agent loop (\`runWithTrace\`).
  - \`packages/integrations/src/ask-question-store.ts\`: Lifecycle record store (\`pending\` → \`generating\` → \`completed\` / \`expired\`).
  - \`packages/integrations/src/ask-response-cache.ts\`: Persistent normalized question-to-answer cache.
  - \`packages/integrations/src/conversation-memory.ts\`: Short-term context memory store.
  - \`apps/discord/src/guard.ts\`: Layer 1 prompt injection safety guard and off-topic markers.
- **Memory Systems Used**:
  - \`askQuestionStore\`: Tracks question records, lifecycle states, usage limits (max 3 retrievals per question), and admin corrections.
  - \`askResponseCache\`: Normalized query cache for fast replay of identical questions.
  - \`conversationMemoryStore\`: Stores recent turn history per \`(userId, channelId)\`.
- **Prompts Used**:
  - \`buildSystemPrompt(domainGuard)\`: Core safety guidelines + optional domain block.
  - \`ASK_5W1H_FORMAT_PROMPT\`: 5W1H structured response formatting.
  - \`entityValidation.formattedGuidelines\`: Anti-dump and entity reference rules.
- **Session Handling**:
  - Tracked via Question ID in \`askQuestionStore\` and \`(userId, channelId)\` context history.

### B. chat.ts System Architecture
- **Files Involved**:
  - \`apps/discord/src/chat.ts\`: Slash command registration (\`speak\`, \`reply\`) and core \`generateChatResponse()\` engine.
  - \`packages/integrations/src/chat-session.ts\`: Active conversational session tracking.
  - \`packages/integrations/src/chat-memory.ts\`: Durable long-term memory (user profile, preferences).
  - \`packages/integrations/src/chat-cache.ts\`: Vector similarity semantic cache.
- **Memory Systems Used**:
  - \`chatSessionStore\`: Tracks active session ID, channel ID, and turn counts.
  - \`chatMemoryStore\`: Persists long-term knowledge about the user.
  - \`conversationMemoryStore\`: Stores multi-turn history.
- **Prompts Used**:
  - \`CHAT_PERSONA_PREFIX\`: Friendly Umamusume companion persona.
  - \`AGENT_SYSTEM_PROMPT\`: Core system safety and conversational rules.
- **Session Handling**:
  - Open session tracked in \`chatSessionStore\` with \`discord-dm:\${userId}\` scope for DMs.

### C. Reusable Entry Points Identified
- **chat.ts**: Reuses \`generateChatResponse({ userId, channelId, message, subcommand })\`.
- **ask.ts**: Extracted \`generateAskResponse({ userId, channelId, question, domainGuard, bypassTopicCheck })\`.
  - Reused by \`handleAskAnswer\` (slash command) and \`handleDirectMessage\` (DM router).
  - Zero code duplication.

---

## 2. Phase 3 Intent Router Implementation

### A. Dedicated Routing Layer (\`apps/discord/src/router.ts\`)
- Created \`classifyIntent({ userId, message, aiService })\`.
- **No Keyword Heuristics**: Strictly does NOT use keyword checks (\`if (message.includes("?"))\` or \`if (message.startsWith("how"))\`) or regex patterns.
- **LLM Classifier Prompt**:
  \`\`\`
  You are a routing classifier.

  Determine whether the user message is:
  ask
  chat

  Rules:

  ask:
  - factual questions
  - explanations
  - information requests
  - troubleshooting
  - research

  chat:
  - casual conversation
  - greetings
  - social interaction
  - emotional discussion
  - roleplay

  Return only:
  ask
  or
  chat
  \`\`\`
- **Confidence & Fallback Policy**:
  - If uncertain or ambiguous: defaults to \`'chat'\` with confidence \`0.5\`.
  - If LLM throws (rate limit, timeout, offline): catches safely and defaults to \`'chat'\` with confidence \`0.5\`.
  - On empty or whitespace messages: defaults to \`'chat'\`.
  - Parses both plain text tokens (\`ask\`, \`chat\`) and JSON payloads (\`{"route": "ask"}\`, \`{"route": "chat"}\`).
- **Logging**:
  - Logs: \`[Router] User ID: \${userId} | Route: \${route} | Decision: \${decision} | Confidence: \${confidence}\`.

### B. Updated Direct Message Handler (\`apps/discord/src/dm.ts\`)
- Inspects incoming DM (ignores bot messages, ignores guild messages).
- Triggers Discord typing indicator.
- Calls \`classifyIntent()\` to determine routing decision.
- Execution branch:
  - When \`route === 'ask'\`: Calls \`generateAskResponse({ userId, channelId: sessionId, question: content, domainGuard: false, bypassTopicCheck: true })\`.
  - When \`route === 'chat'\`: Calls \`generateChatResponse({ userId, channelId: sessionId, message: content, subcommand: 'auto' })\`.
- **Fault-Tolerant Fallback**:
  - If the \`ask\` backend throws an error during generation, the handler immediately logs the warning and falls back to \`generateChatResponse()\`, ensuring the user is never blocked.
  - If both fail, returns the safe user-facing message: \`"Sorry, I couldn't process your message right now."\`
- Splits and sends response via \`sendDirectMessageResponse()\`.

### C. Refactored \`apps/discord/src/ask.ts\`
- Extracted and exported \`generateAskResponse()\`.
- Preserved 100% of existing \`/ask\` slash commands:
  - \`/ask question\` continues to register questions and issue Question IDs.
  - \`/ask answer\` continues to enforce Question ID validation, 3-use rate limits, and embed formatting.
  - \`/ask correction\` continues to allow admin updates.

---

## 3. Files Modified and Added

1. \`apps/discord/src/router.ts\` (New File): Pure LLM classifier implementing intent routing between ask and chat.
2. \`apps/discord/src/ask.ts\` (Modified): Extracted \`generateAskResponse()\` for reuse without code duplication.
3. \`apps/discord/src/dm.ts\` (Modified): Integrated intent classification and automatic dispatch to ask vs chat with fallback resilience.
4. \`tests/discord/router.test.ts\` (New File): 13 unit and integration tests covering intent routing, classification prompts, JSON parsing, fallbacks, and slash command stability.
5. \`tests/discord/dm.test.ts\` (Existing File): 11 tests verifying DM foundations, conversation continuity, and session management.
6. \`apps/api/src/phase3-report.ts\` (New File): Complete Phase 3 findings report.
7. \`apps/api/src/index.ts\` (Modified): Exposed \`/phase3-findings\` endpoint and added Phase 3 copy button to the web dashboard.

---

## 4. Key Code Diffs

### apps/discord/src/router.ts
\`\`\`typescript
export async function classifyIntent(options: ClassifyIntentOptions): Promise<RouteDecision> {
  const { userId = 'unknown', message, aiService } = options;
  const trimmed = (message || '').trim();

  if (!trimmed) {
    logger.info(\`[Router] User ID: \${userId} | Decision: chat | Confidence: 1.0 (empty message)\`);
    return { route: 'chat', confidence: 1.0, rawOutput: 'empty' };
  }

  try {
    const service = aiService ?? buildAIService();
    const prompt = \`\${ROUTER_CLASSIFIER_PROMPT}\\n\\nUser:\\n\${trimmed}\`;

    const raw = await service.generate({ prompt, maxTokens: 12 });
    const normalized = (raw || '').trim().toLowerCase();

    let decidedRoute: IntentRoute = 'chat';
    let confidence = 0.95;

    if (normalized === 'ask' || (normalized.startsWith('ask') && !normalized.includes('chat'))) {
      decidedRoute = 'ask';
    } else if (normalized === 'chat' || (normalized.startsWith('chat') && !normalized.includes('ask'))) {
      decidedRoute = 'chat';
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.route === 'ask' || parsed.route === 'chat') {
          decidedRoute = parsed.route;
        } else {
          decidedRoute = 'chat';
          confidence = 0.5;
        }
      } catch {
        decidedRoute = 'chat';
        confidence = 0.5;
      }
    }

    logger.info(\`[Router] User ID: \${userId} | Route: \${decidedRoute} | Decision: \${decidedRoute} | Confidence: \${confidence}\`);
    return { route: decidedRoute, confidence, rawOutput: raw };
  } catch (err: any) {
    logger.warn(\`[Router] User ID: \${userId} | Classification failed: \${err?.message ?? err}; falling back to chat\`);
    return { route: 'chat', confidence: 0.5, rawOutput: err?.message };
  }
}
\`\`\`

### apps/discord/src/dm.ts
\`\`\`typescript
  // Intent classification via dedicated routing layer
  let decision: RouteDecision = { route: 'chat', confidence: 0.5 };
  try {
    decision = await classifyIntent({
      userId,
      message: content,
      aiService: options?.routerService,
    });
  } catch (routerErr: any) {
    logger.warn(\`[Router] Intent classification error for user \${userId}: \${routerErr?.message ?? routerErr}; falling back to chat\`);
    decision = { route: 'chat', confidence: 0.5 };
  }

  logger.info(\`[Router] User ID: \${userId} | Route: \${decision.route} | Confidence: \${decision.confidence ?? 0.5}\`);

  let response: string;
  try {
    if (decision.route === 'ask') {
      const askFn = options?.askGenerator ?? generateAskResponse;
      try {
        response = await askFn({
          userId,
          channelId: sessionId,
          question: content,
          domainGuard: false,
          bypassTopicCheck: true,
        });
      } catch (askErr: any) {
        logger.warn(\`Ask execution failed for DM from user \${userId}: \${askErr?.message ?? askErr}; falling back to chat backend\`);
        const chatFn = options?.chatGenerator ?? generateChatResponse;
        response = await chatFn({ userId, channelId: sessionId, message: content, subcommand: 'auto' });
      }
    } else {
      const chatFn = options?.chatGenerator ?? generateChatResponse;
      response = await chatFn({ userId, channelId: sessionId, message: content, subcommand: 'auto' });
    }

    await sendDirectMessageResponse(message, response);
    logger.info(\`[DM Replied] Sent \${decision.route} response to user \${userId}\`);
  } catch (err: any) { ... }
\`\`\`

---

## 5. Test Suite Verification

Both test suites execute successfully via \`node --import tsx --test\`:
- \`tests/discord/router.test.ts\`: 13 passed tests
- \`tests/discord/dm.test.ts\`: 11 passed tests
- Total: 24 passing automated tests

All routing criteria satisfied:
- "How do I install Docker?" → ask backend ✅
- "What is TypeScript?" → ask backend ✅
- "How do I deploy Node.js?" → ask backend ✅
- "Hello there" → chat backend ✅
- "Tell me a joke" → chat backend ✅
- "I'm feeling stressed" → chat backend ✅
- Uncertain output / error fallback → chat backend ✅
- Slash commands /ask and /chat completely unchanged ✅
`;
