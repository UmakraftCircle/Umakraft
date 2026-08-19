import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from '@ai-agent-platform/core';
import { buildAIService } from './bootstrap.js';
import { ToolCallingAgent } from '@ai-agent-platform/core';
import { conversationMemoryStore, askResponseCache, moderationLogStore } from '@ai-agent-platform/integrations';
import { askTools } from './ask-tools.js';
import { allSkillTools } from '@ai-agent-platform/skills';
import { failureMessage } from './errors.js';
import { safetyGuard, buildRelevanceAllowlist, hasRelevance, isOffTopicAnswer } from './guard.js';

const logger = createLogger('AskHandler');

let registered = false;

const REDIRECT_MESSAGE =
  'I can only help with Uma Musume / Umakraft topics (trainer stats, leaderboards, banners, gacha, support cards, races, and horse-girl characters). Could you rephrase your question around those?';
const REJECT_MESSAGE =
  'I can\'t help with that. Please keep questions on Uma Musume / Umakraft topics.';

/** Normalize a question for use as a cache key (lowercase + collapse whitespace). */
function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Register /ask tools + skill tools into the shared registry exactly once. */
export function ensureAskToolsRegistered(): void {
  if (registered) return;
  const registry = ToolRegistry.getInstance();
  for (const tool of askTools) {
    registry.register(tool);
  }
  for (const tool of allSkillTools) {
    registry.register(tool);
  }
  registered = true;
  logger.info(`Registered ${askTools.length} /ask tools + ${allSkillTools.length} skill tools`);
}

/** Feature 1+2: handle the /ask slash command with a model-driven tool loop. */
export async function handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
  const question = interaction.options.getString('question', true).trim();
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  await interaction.deferReply();

  try {
    ensureAskToolsRegistered();

    const normalized = normalizeQuestion(question);

    // ── Layer 1: safety guard (blocklist — improper content / injection) — hard reject. ──
    if (safetyGuard(question)) {
      await interaction.editReply(REJECT_MESSAGE);
      return;
    }

    // ── Layer 3: keyword allowlist (soft pre-filter) — zero matches → redirect. ──
    const registry = ToolRegistry.getInstance();
    const allowlist = buildRelevanceAllowlist(registry.getDeclarativeSchemas());
    if (!hasRelevance(normalized, allowlist)) {
      logger.info(`/ask off-topic (no keyword match): "${question.slice(0, 60)}"`);
      try {
        await moderationLogStore.append(userId, channelId, question);
      } catch (logErr: any) {
        logger.warn(`moderation log write skipped: ${logErr?.message ?? logErr}`);
      }
      await interaction.editReply(REDIRECT_MESSAGE);
      return;
    }

    // Cache read: reuse a previously cached web-research answer for the same question.
    try {
      const cached = await askResponseCache.get(normalized);
      if (cached) {
        logger.info(`/ask cache hit for "${question.slice(0, 60)}"`);
        await conversationMemoryStore.append({ userId, channelId, role: 'user', content: question });
        await conversationMemoryStore.append({ userId, channelId, role: 'assistant', content: cached });
        await interaction.editReply(cached);
        return;
      }
    } catch (cacheErr: any) {
      logger.warn(`/ask cache read skipped: ${cacheErr?.message ?? cacheErr}`);
    }

    // Feature 1: retrieve short-term conversation context.
    const history = await conversationMemoryStore.recent(userId, channelId, 10);
    const context = history.length
      ? history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n')
      : undefined;

    // Build an AI service from env (honours AI_PROVIDER=local|groq|openai|anthropic).
    const aiService = buildAIService();

    const agent = new ToolCallingAgent(aiService, registry);
    const trace = await agent.runWithTrace(userId, question, context, {
      maxToolCalls: 4,
      toolTimeoutMs: 8_000,
      generateTimeoutMs: 20_000,
      overallTimeoutMs: 90_000,
      domainGuard: true,
    });
    const answer = trace.answer;

    // ── Layer 2: model topic gate — [[OFFTOPIC]] marker → redirect + log. ──
    if (isOffTopicAnswer(answer)) {
      logger.info(`/ask off-topic (model marker): "${question.slice(0, 60)}"`);
      try {
        await moderationLogStore.append(userId, channelId, question);
      } catch (logErr: any) {
        logger.warn(`moderation log write skipped: ${logErr?.message ?? logErr}`);
      }
      await interaction.editReply(REDIRECT_MESSAGE);
      return;
    }

    // Persist to cache only if the answer required a web search.
    if (trace.usedWebSearch) {
      try {
        await askResponseCache.set(normalized, answer);
        logger.info(`/ask cached web-research answer for "${question.slice(0, 60)}"`);
      } catch (cacheErr: any) {
        logger.warn(`/ask cache write skipped: ${cacheErr?.message ?? cacheErr}`);
      }
    }

    // Feature 1: persist the exchange for future context.
    await conversationMemoryStore.append({ userId, channelId, role: 'user', content: question });
    await conversationMemoryStore.append({ userId, channelId, role: 'assistant', content: answer });

    await interaction.editReply(answer);
  } catch (err: any) {
    logger.error(`/ask error: ${err?.message ?? err}`);
    await interaction.editReply(failureMessage(err));
  }
}

export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the AI agent a question (uses tools + context)')
  .addStringOption((opt) =>
    opt.setName('question').setDescription('Your question').setRequired(true)
  )
  .setDMPermission(false)
  .toJSON();
