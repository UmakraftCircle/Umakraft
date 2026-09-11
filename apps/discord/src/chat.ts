import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry, ToolCallingAgent } from '@ai-agent-platform/core';
import {
  chatMemoryStore,
  sharedUserMemoryStore,
  chatSessionStore,
  conversationMemoryStore,
  memoryService,
  ChatCacheStore,
  searchWebTool,
  allMemoryTools,
  getConversationHistoryTool,
  summarizeConversationTool,
  getUserProfileTool,
  saveUserFactTool,
  allKnowledgeTools,
  searchKnowledgeTool,
  retrieveDocumentTool,
  summarizeDocumentTool,
  listKnowledgeSourcesTool,
  detectFavoriteUmamusume,
  summarizeQuestions,
  buildContextTurns,
} from '@ai-agent-platform/integrations';
import { LocalEmbeddingGenerator } from '@ai-agent-platform/ai';
import { allSkillTools } from '@ai-agent-platform/skills';
import { askTools } from './ask-tools.js';
import { allDomainTools as allUmamusumeTools } from '@ai-agent-platform/umamusume';
import { allDomainTools as allFanTrackerTools } from '@ai-agent-platform/fan-tracker';
import { buildAIService } from './bootstrap.js';
import { failureMessage } from './errors.js';
import { safetyGuard } from './guard.js';
import { replyWithEmbed } from './embed-reply.js';

const logger = createLogger('ChatHandler');

/**
 * `/chat` — a personalized, memory-aware, GENERAL conversation entry point.
 *
 * Lifecycle:
 *    - `Speak` opens (or resets) a session. A new `Speak` OVERWRITES the previous
 *      conversation.
 *    - `Reply` continues the current session and is REJECTED if no session exists.
 *
 * The agent keeps durable long-term memory of the Trainer (favourites, progress,
 * reply style), reuses cached answers for similar questions (semantic similarity),
 * and optionally reaches for Tavily web search when a question needs current info.
 *
 * Scope: general conversation. Unlike `/ask` (which is Uma Musume-only), `/chat`
 * is safety-only: it applies `safetyGuard` (the deterministic blocklist) and does
 * NOT enable the domain guard, so it may discuss any ordinary topic. Uma Musume
 * remains the persona/voice, not a topic restriction.
 *
 * `chat.ts` is the orchestration layer only — it calls the memory/cache/session
 * services and never touches Turso or embeddings directly.
 */

const REDIRECT_REPLY_BEFORE_SPEAK =
  'Trainer, we haven\'t started chatting yet — use `/chat speak` to begin! 🐎';

const MAX_CONTEXT_TURNS = 20;

// ══ Persona (layered ON TOP of the shared safety core) ══
//    This defines the `/chat` voice; general behavior lives in the shared
//    core prompt. It does NOT restrict the conversation to Uma Musume.
//    NOTE: this is a static string literal — do not interpolate command names.
const CHAT_PERSONA_PREFIX = `
You are Umakraft — a dedicated horse girl assistant talking one-on-one with your Trainer in Discord. Address the user naturally as "Trainer."
Persona: Calm, polite, composed, and helpful. No technical jargon or mentioning AI.

Tool Priority & Rules:
1. Club Data (Fan gain, leaderboards, stats, profiles, milestones): Use Priority 1 Club tools (never estimate or use web search).
2. Game Knowledge (Skills, support cards, characters, tracks, races, training): Use Priority 2 Umamusume tools first.
3. Real-time News/Banners: Use Priority 3 Research tools (search_web) only when needed.
4. Casual/Small Talk: No tools.

Always base facts strictly on tool outputs. If unverified, state "I couldn't verify that using the available database."
`.trim();

/**
 * `/chat` and DM autonomous tool execution:
 * Dynamically aggregates all domain tools, club tools, memory tools, and knowledge RAG tools.
 */
const CHAT_TOOL_SLUGS = Array.from(
  new Set([
    ...askTools.map((t) => t.slug),
    ...allUmamusumeTools.map((t) => t.slug),
    ...allFanTrackerTools.map((t) => t.slug),
    ...allMemoryTools.map((t) => t.slug),
    ...allKnowledgeTools.map((t) => t.slug),
    searchWebTool.slug,
  ])
);

/**
 * Shared semantic answer cache. Built lazily on first use so the local embedding
 * model (MiniLM) only loads when `/chat` actually runs.
 */
let cacheStore: ChatCacheStore | null = null;
function getChatCache(): ChatCacheStore {
  if (!cacheStore) {
    cacheStore = new ChatCacheStore(new LocalEmbeddingGenerator());
  }
  return cacheStore;
}

export interface GenerateChatResponseOptions {
  userId: string;
  channelId: string;
  message: string;
  subcommand?: 'speak' | 'reply' | 'auto';
}

/**
 * Shared core chat response generation used by both `/chat` and Direct Messages.
 * Unifies persona, safety guard, session lifecycle, durable memory, semantic cache,
 * conversation history, and AI ToolCallingAgent execution into one implementation.
 */
export async function generateChatResponse(options: GenerateChatResponseOptions): Promise<string> {
  const { userId, channelId } = options;
  const message = (options.message || '').trim();
  const subcommand = (options.subcommand || 'auto').toLowerCase();

  if (!message) {
    return 'Trainer, please provide a message to chat! 🐎';
  }

  // ══ Safety guard (deterministic blocklist — no domain restriction) ══
  if (safetyGuard(message)) {
    return "🐎 I can't help with that, Trainer. Let's keep our chat friendly and safe.";
  }

  // ══ Lifecycle ══
  let session = await chatSessionStore.getSession(userId);
  if (subcommand === 'speak') {
    session = await chatSessionStore.openSession(userId, channelId);
  } else if (subcommand === 'reply') {
    if (!session) {
      return REDIRECT_REPLY_BEFORE_SPEAK;
    }
    await chatSessionStore.bumpTurn(userId);
  } else {
    // 'auto' (e.g., for DMs): open session if none exists, or continue/bump active session
    if (!session) {
      session = await chatSessionStore.openSession(userId, channelId);
    } else {
      await chatSessionStore.bumpTurn(userId);
    }
  }

  // ══ Shared User Profile & Memory (Phase 4) ══
  try {
    await sharedUserMemoryStore.extractAndSaveMemory(userId, message);
  } catch (memErr: any) {
    logger.warn(`/chat memory extraction skipped: ${memErr?.message ?? memErr}`);
  }
  const memoryContext = await sharedUserMemoryStore.retrieveMemoryContext(userId, channelId);

  // ══ Durable memory + explicit favourite detection ══
  const memory = await chatMemoryStore.getMemory(userId);
  const favouritesKnown = (memory?.favoriteUmamusume.length ?? 0) > 0;

  const detectedFavourites = detectFavoriteUmamusume(message);
  if (detectedFavourites.length > 0) {
    await chatMemoryStore.setFavorite(userId, 'favorite_umamusume', detectedFavourites);
    logger.info(`Stored favourites for ${userId}: ${detectedFavourites.join(', ')}`);
  }

  // ══ Record the question in the rolling buffer (may trigger lazy digest) ══
  try {
    await getChatCache().recordQuestion(userId, message, session.conversationId, summarizeQuestions);
  } catch (cacheErr: any) {
    logger.warn(`/chat question recording skipped: ${cacheErr?.message ?? cacheErr}`);
  }

  // ══ Semantic answer cache: reuse a similar past answer if present ══
  let cachedAnswer: string | null = null;
  const isActionOrMemoryQuery = /\b(summarize|summary|memory|memories|history|profile|remember|recall|fact|facts|docs?|documents?|documentation|architecture|deployment|auth|knowledge|specs?)\b/i.test(message);
  if (!isActionOrMemoryQuery) {
    try {
      const similar = await getChatCache().findSimilarAnswers(userId, message);
      if (similar.length > 0) {
        cachedAnswer = similar[0].answer;
        logger.info(`/chat similar-answer cache hit for ${userId} (score ${similar[0].score.toFixed(3)})`);
      }
    } catch (cacheErr: any) {
      logger.warn(`/chat cache lookup skipped: ${cacheErr?.message ?? cacheErr}`);
    }
  }

  // ══ Conversation context (per user+channel, like /ask) ══
  const history = await conversationMemoryStore.recent(userId, channelId, MAX_CONTEXT_TURNS);
  const context = buildContextTurns(history);

  // ══ Build the personalized system prompt (persona + known Trainer facts) ══
  const personalNotes: string[] = [];
  if (memoryContext.profile.preferredName) {
    personalNotes.push(`Trainer's Name: ${memoryContext.profile.preferredName}`);
  }
  if (memory) {
    if (memory.favoriteUmamusume.length) personalNotes.push(`Favourite Umamusume: ${memory.favoriteUmamusume.join(', ')}`);
    if (memory.favoriteTeam.length) personalNotes.push(`Favourite team: ${memory.favoriteTeam.join(', ')}`);
    if (memory.favoriteSupportCards.length) personalNotes.push(`Favourite support cards: ${memory.favoriteSupportCards.join(', ')}`);
    if (memory.replyStylePreference) personalNotes.push(`Preferred reply style: ${memory.replyStylePreference}`);
  }
  const systemPromptPrefix = [
    CHAT_PERSONA_PREFIX,
    memoryContext.systemPromptInjection,
    personalNotes.length ? `KNOWN ABOUT THIS TRAINER\n- ${personalNotes.join('\n- ')}` : undefined,
    favouritesKnown
      ? undefined
      : "ONBOARDING: You do not yet know this Trainer's favourite Umamusume. Briefly introduce yourself and ask them.",
  ]
    .filter(Boolean)
    .join('\n\n');

  let reply: string;

  if (cachedAnswer) {
    reply = cachedAnswer;
  } else {
    // ══ Generate the reply (domainGuard is OFF — general conversation) ══
    const aiService = buildAIService();
    const registry = ToolRegistry.getInstance();
    // Ensure all tools (Club, Umamusume domain, Fan tracker, Memory, Knowledge, Web) are registered for /chat & DM autonomous actions.
    registry.register(searchWebTool);
    for (const tool of askTools) {
      registry.register(tool);
    }
    for (const tool of allUmamusumeTools) {
      registry.register(tool);
    }
    for (const tool of allFanTrackerTools) {
      registry.register(tool);
    }
    for (const tool of allMemoryTools) {
      registry.register(tool);
    }
    for (const tool of allKnowledgeTools) {
      registry.register(tool);
    }
    const agent = new ToolCallingAgent(aiService, registry);
    reply = await agent.run(userId, message, context, {
      maxToolCalls: 10,
      maxWebSearches: 2,
      toolTimeoutMs: 8_000,
      generateTimeoutMs: 20_000,
      overallTimeoutMs: 90_000,
      systemPromptPrefix,
      domainGuard: false,
      toolSlugs: CHAT_TOOL_SLUGS,
    });

    // Keep it as a pure-chat answer.
    reply = reply.trim();

    // ══ Cache the fresh answer per-user ══
    try {
      await getChatCache().cacheAnswer(userId, message, reply);
    } catch (cacheErr: any) {
      logger.warn(`/chat answer cache write skipped: ${cacheErr?.message ?? cacheErr}`);
    }
  }

  // ══ Persist the exchange (per user+channel) for future context ══
  await memoryService.saveUserMessage(userId, message, channelId);
  await memoryService.saveAssistantMessage(userId, reply, channelId);

  return reply;
}

export async function handleChat(interaction: ChatInputCommandInteraction): Promise<void> {
  const rawSubcommand = interaction.options.getSubcommand(false);
  const subcommand = ((rawSubcommand || 'speak').toLowerCase()) as 'speak' | 'reply';
  const rawMessage = interaction.options.getString('message', false);
  const message = (rawMessage || '').trim();
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  if (!message) {
    await interaction.editReply('Trainer, please provide a message to chat! 🐎');
    return;
  }

  try {
    const reply = await generateChatResponse({
      userId,
      channelId,
      message,
      subcommand,
    });

    await replyWithEmbed(interaction, reply);
  } catch (err: any) {
    logger.error(`/chat error: ${err?.message ?? err}`);
    await interaction.editReply(failureMessage(err));
  }
}

export const chatCommand = new SlashCommandBuilder()
  .setName('chat')
  .setDescription('Talk one-on-one with your Umamusume agent')
  .addSubcommand((sub) =>
    sub
      .setName('speak')
      .setDescription('Start (or restart) a conversation with the agent')
      .addStringOption((opt) =>
        opt.setName('message').setDescription('What you want to say').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reply')
      .setDescription('Continue your current conversation')
      .addStringOption((opt) =>
        opt.setName('message').setDescription('Your reply').setRequired(true),
      ),
  )
  .setDMPermission(false)
  .toJSON();
