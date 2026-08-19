import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry, ToolCallingAgent } from '@ai-agent-platform/core';
import {
  chatMemoryStore,
  chatSessionStore,
  conversationMemoryStore,
  ChatCacheStore,
  searchWebTool,
  detectFavoriteUmamusume,
  summarizeQuestions,
  buildContextTurns,
} from '@ai-agent-platform/integrations';
import { LocalEmbeddingGenerator } from '@ai-agent-platform/ai';
import { allSkillTools } from '@ai-agent-platform/skills';
import { buildAIService } from './bootstrap.js';
import { failureMessage } from './errors.js';
import { safetyGuard } from './guard.js';
import { replyWithEmbed } from './embed-reply.js';

const logger = createLogger('ChatHandler');

/**
 * `/chat` — a personalized, memory-aware, GENERAL conversation entry point.
 *
 * Lifecycle:
 *   - `Speak` opens (or resets) a session. A new `Speak` OVERWRITES the previous
 *     conversation.
 *   - `Reply` continues the current session and is REJECTED if no session exists.
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
  'Trainer, we haven\'t started chatting yet — use `/chat Speak` to begin! 🐎';

const MAX_CONTEXT_TURNS = 20;

// ── Persona (layered ON TOP of the shared safety core) ──
//    This only defines the `/chat` voice; general behavior lives in the shared
//    core prompt. It does NOT restrict the conversation to Uma Musume.
//    NOTE: this is a static string literal — do not interpolate command names.
const CHAT_PERSONA_PREFIX = `
You are an Umamusume — a friendly horse-girl — talking one-on-one with your Trainer
in the Umakraft Discord server. Address the user as "Trainer". Be warm, playful, and
a little energetic, with light horse-girl/racing flavour. Keep replies human-like and
natural — no technical jargon. Match the Trainer's preferred reply style when known.

You may talk about any ordinary topic. Do not restrict the conversation to Uma
Musume; that is the `/ask` command's job. Follow the safety policy for harmful or
unsafe content, but otherwise chat freely about whatever the Trainer wants.
`.trim();

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

export async function handleChat(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand(true); // 'speak' | 'reply'
  const message = interaction.options.getString('message', true).trim();
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    // ── Safety guard (deterministic blocklist — no domain restriction) ──
    if (safetyGuard(message)) {
      await interaction.editReply(
        "🐎 I can't help with that, Trainer. Let's keep our chat friendly and safe.",
      );
      return;
    }

    // ── Lifecycle ──
    let session = await chatSessionStore.getSession(userId);
    if (subcommand === 'speak') {
      session = await chatSessionStore.openSession(userId, channelId);
    } else {
      if (!session) {
        await interaction.editReply(REDIRECT_REPLY_BEFORE_SPEAK);
        return;
      }
      await chatSessionStore.bumpTurn(userId);
    }

    // ── Durable memory + explicit favourite detection ──
    const memory = await chatMemoryStore.getMemory(userId);
    const favoritesKnown = (memory?.favoriteUmamusume.length ?? 0) > 0;

    const detectedFavorites = detectFavoriteUmamusume(message);
    if (detectedFavorites.length > 0) {
      await chatMemoryStore.setFavorite(userId, 'favorite_umamusume', detectedFavorites);
      logger.info(`Stored favourites for ${userId}: ${detectedFavorites.join(', ')}`);
    }

    // ── Record the question in the rolling buffer (may trigger lazy digest) ──
    try {
      await getChatCache().recordQuestion(userId, message, session.conversationId, summarizeQuestions);
    } catch (cacheErr: any) {
      logger.warn(`/chat question recording skipped: ${cacheErr?.message ?? cacheErr}`);
    }

    // ── Semantic answer cache: reuse a similar past answer if present ──
    let cachedAnswer: string | null = null;
    try {
      const similar = await getChatCache().findSimilarAnswers(userId, message);
      if (similar.length > 0) {
        cachedAnswer = similar[0].answer;
        logger.info(`/chat similar-answer cache hit for ${userId} (score ${similar[0].score.toFixed(3)})`);
      }
    } catch (cacheErr: any) {
      logger.warn(`/chat cache lookup skipped: ${cacheErr?.message ?? cacheErr}`);
    }

    // ── Conversation context (per user+channel, like /ask) ──
    const history = await conversationMemoryStore.recent(userId, channelId, MAX_CONTEXT_TURNS);
    const context = buildContextTurns(history);

    // ── Build the personalized system prompt (persona + known Trainer facts) ──
    const personalNotes: string[] = [];
    if (memory) {
      if (memory.favoriteUmamusume.length) personalNotes.push(`Favourite Umamusume: ${memory.favoriteUmamusume.join(', ')}`);
      if (memory.favoriteTeam.length) personalNotes.push(`Favourite team: ${memory.favoriteTeam.join(', ')}`);
      if (memory.favoriteSupportCards.length) personalNotes.push(`Favourite support cards: ${memory.favoriteSupportCards.join(', ')}`);
      if (memory.replyStylePreference) personalNotes.push(`Preferred reply style: ${memory.replyStylePreference}`);
    }
    const systemPromptPrefix =
      CHAT_PERSONA_PREFIX +
      (personalNotes.length ? `\n\nKNOWN ABOUT THIS TRAINER\n- ${personalNotes.join('\n- ')}` : '') +
      (favoritesKnown
        ? ''
        : '\n\nONBOARDING: You do not yet know this Trainer\'s favourite Umamusume. Briefly introduce yourself and ask them.');

    let reply: string;

    if (cachedAnswer) {
      reply = cachedAnswer;
    } else {
      // ── Generate the reply (domainGuard is OFF — general conversation) ──
      const aiService = buildAIService();
      const registry = ToolRegistry.getInstance();
      registry.register(searchWebTool);
      for (const tool of allSkillTools) {
        registry.register(tool);
      }
      const agent = new ToolCallingAgent(aiService, registry);
      reply = await agent.run(userId, message, context, {
        maxToolCalls: 3,
        maxWebSearches: 2,
        toolTimeoutMs: 8_000,
        generateTimeoutMs: 20_000,
        overallTimeoutMs: 90_000,
        systemPromptPrefix,
        domainGuard: false,
      });

      // Keep it as a pure-chat answer.
      reply = reply.trim();

      // ── Cache the fresh answer per-user ──
      try {
        await getChatCache().cacheAnswer(userId, message, reply);
      } catch (cacheErr: any) {
        logger.warn(`/chat answer cache write skipped: ${cacheErr?.message ?? cacheErr}`);
      }
    }

    // ── Persist the exchange (per user+channel) for future context ──
    await conversationMemoryStore.append({ userId, channelId, role: 'user', content: message });
    await conversationMemoryStore.append({ userId, channelId, role: 'assistant', content: reply });

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
