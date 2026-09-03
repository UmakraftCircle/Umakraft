import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { ToolRegistry } from '@ai-agent-platform/core';
import { buildAIService } from './bootstrap.js';
import { ToolCallingAgent } from '@ai-agent-platform/core';
import {
  conversationMemoryStore,
  askResponseCache,
  moderationLogStore,
  askQuestionStore,
} from '@ai-agent-platform/integrations';
import { askTools } from './ask-tools.js';
import { allSkillTools } from '@ai-agent-platform/skills';
import { failureMessage } from './errors.js';
import { safetyGuard, isOffTopicAnswer } from './guard.js';
import { replyWithEmbed, buildAnswerEmbeds, AI_EMBED_COLOR } from './embed-reply.js';
import { classifyTopic, toTaxonomyTerms, buildSearchEscalator } from './off-topic-detector/index.js';
import { validateBeforeSearch, ASK_5W1H_FORMAT_PROMPT } from '@ai-agent-platform/ai';

const logger = createLogger('AskHandler');

let registered = false;

const REDIRECT_MESSAGE =
  'I can only help with Uma Musume / Umakraft topics (trainer stats, leaderboards, banners, gacha, support cards, races, and horse-girl characters). Could you rephrase your question around those?';
const REJECT_MESSAGE =
  "I can't help with that. Please keep questions on Uma Musume / Umakraft topics.";

/** Normalize a question for use as a cache key (lowercase + collapse whitespace). */
function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * `/ask` scopes to the small, relevant toolset instead of the whole registry.
 * This keeps the tool-schema token overhead tiny so a multi-turn `/ask` stays
 * under Groq's 8000 TPM free-tier limit.
 */
const ASK_TOOL_SLUGS = [
  ...askTools.map((t) => t.slug),
  'umamusume-data-miner',
  'umamusume-search',
  'umamusume-compile',
  'umamusume-list-sources',
];

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

/**
 * Subcommand: `/ask question <question>`
 * Stores the user's question, creates a unique Question ID, and does NOT generate an answer.
 */
export async function handleAskQuestion(interaction: ChatInputCommandInteraction): Promise<void> {
  const rawQuestion = interaction.options.getString('question', false) ?? '';
  const question = rawQuestion.trim();
  const userId = interaction.user.id;
  const channelId = interaction.channelId;
  const guildId = interaction.guildId;

  // Validate input
  if (!question) {
    await interaction.reply({
      content: `<@${userId}> Please provide a valid, non-empty question.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    // Layer 1 safety guard check before submitting
    if (safetyGuard(question)) {
      await interaction.editReply({
        content: `<@${userId}> ${REJECT_MESSAGE}`,
      });
      return;
    }

    const record = await askQuestionStore.create({
      question,
      userId,
      channelId,
      guildId,
    });

    logger.info(`Question submitted by ${userId} with ID ${record.id}: "${question.slice(0, 60)}"`);

    await interaction.editReply({
      content: `<@${userId}> Your question has been submitted.\n**Question ID:** \`${record.id}\`\nUse \`/ask answer question_id:${record.id}\` to retrieve your answer.`,
    });
  } catch (err: any) {
    logger.error(`/ask question error: ${err?.message ?? err}`);
    await interaction.editReply({
      content: `<@${userId}> Failed to submit your question: ${failureMessage(err)}`,
    });
  }
}

/**
 * Subcommand: `/ask answer <question_id>`
 * Generates the answer once, stores it permanently, tracks usage up to 3 times,
 * and expires after 3 successful retrievals.
 */
export async function handleAskAnswer(interaction: ChatInputCommandInteraction): Promise<void> {
  const rawQuestionId = interaction.options.getString('question_id', false) ?? '';
  const questionId = rawQuestionId.trim();
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  // Validate input
  if (!questionId) {
    await interaction.reply({
      content: `<@${userId}> Please provide a valid Question ID.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const record = await askQuestionStore.get(questionId);

    if (!record) {
      await interaction.editReply({
        content: `<@${userId}> Question not found with ID \`${questionId}\`. Please check the Question ID or submit a new question with \`/ask question\`.`,
      });
      return;
    }

    // 1. Expired check: after 3 uses, the answer is expired
    if (record.usageCount >= record.maxUses || record.status === 'expired') {
      await interaction.editReply({
        content: `<@${userId}> This answer has expired and can no longer be used.`,
      });
      return;
    }

    // 2. In-flight check: answer is currently being generated
    if (record.status === 'generating') {
      await interaction.editReply({
        content: `<@${userId}> Your answer is not yet ready.`,
      });
      return;
    }

    // 3. Answer already generated: retrieve existing answer and increment usage
    if (record.status === 'completed' && record.answer) {
      const usageResult = await askQuestionStore.incrementUsage(record.id);

      if (usageResult.expired) {
        await interaction.editReply({
          content: `<@${userId}> This answer has expired and can no longer be used.`,
        });
        return;
      }

      logger.info(
        `/ask answer retrieved existing answer for ${record.id} (Usage: ${usageResult.usageCount}/${record.maxUses})`
      );

      const embeds = buildAnswerEmbeds(record.answer, AI_EMBED_COLOR);
      await interaction.editReply({
        content: `<@${userId}> **Answer for Question ID \`${record.id}\`** (Use ${usageResult.usageCount}/${record.maxUses})`,
        embeds: embeds.length > 0 ? embeds : undefined,
      });
      return;
    }

    // 4. Answer does not exist yet (pending/failed): generate for the first time
    const acquired = await askQuestionStore.markGenerating(record.id);
    if (!acquired) {
      // Another worker or request claimed generation
      await interaction.editReply({
        content: `<@${userId}> Your answer is not yet ready.`,
      });
      return;
    }

    // Begin AI generation
    ensureAskToolsRegistered();
    const question = record.question;
    const normalized = normalizeQuestion(question);

    // Layer 1: safety guard
    if (safetyGuard(question)) {
      const rejectAnswer = REJECT_MESSAGE;
      await askQuestionStore.saveGeneratedAnswer(record.id, rejectAnswer);
      await interaction.editReply({
        content: `<@${userId}> ${rejectAnswer}`,
      });
      return;
    }

    // Layer 3: taxonomy classification
    const taxonomy = toTaxonomyTerms();
    const search = buildSearchEscalator();
    const verdict = await classifyTopic(question, { taxonomy, search });

    if (verdict.verdict === 'OFF_TOPIC') {
      logger.info(`/ask off-topic (${verdict.method}/${verdict.confidence}): "${question.slice(0, 60)}"`);
      try {
        await moderationLogStore.append(userId, channelId, question);
      } catch (logErr: any) {
        logger.warn(`moderation log write skipped: ${logErr?.message ?? logErr}`);
      }
      await askQuestionStore.saveGeneratedAnswer(record.id, REDIRECT_MESSAGE);
      await interaction.editReply({
        content: `<@${userId}> ${REDIRECT_MESSAGE}`,
      });
      return;
    }

    // Cache check: reuse web search cached answer if exists
    let generatedAnswer: string | null = null;
    try {
      const cached = await askResponseCache.get(normalized);
      if (cached) {
        logger.info(`/ask cache hit for question ${record.id}`);
        generatedAnswer = cached;
      }
    } catch (cacheErr: any) {
      logger.warn(`/ask cache read skipped: ${cacheErr?.message ?? cacheErr}`);
    }

    if (!generatedAnswer) {
      // Validate targeting of known Umamusume entity & obtain anti-dump format rules
      const entityValidation = validateBeforeSearch(question, { strictUmamusumeOnly: false });

      // Retrieve short-term conversation context
      const history = await conversationMemoryStore.recent(userId, channelId, 10);
      const context = history.length
        ? history.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n')
        : undefined;

      const aiService = buildAIService();
      const agent = new ToolCallingAgent(aiService, ToolRegistry.getInstance());
      const systemPromptPrefix = [
        ASK_5W1H_FORMAT_PROMPT,
        entityValidation.formattedGuidelines ? `Entity Reference Guidance:\n${entityValidation.formattedGuidelines}` : undefined,
      ]
        .filter(Boolean)
        .join('\n\n');

      const trace = await agent.runWithTrace(userId, question, context, {
        maxToolCalls: 10,
        toolTimeoutMs: 8_000,
        generateTimeoutMs: 20_000,
        overallTimeoutMs: 90_000,
        domainGuard: true,
        toolSlugs: ASK_TOOL_SLUGS,
        systemPromptPrefix,
      });

      generatedAnswer = trace.answer;

      // Model off-topic check
      if (isOffTopicAnswer(generatedAnswer)) {
        logger.info(`/ask off-topic (model marker): "${question.slice(0, 60)}"`);
        try {
          await moderationLogStore.append(userId, channelId, question);
        } catch (logErr: any) {
          logger.warn(`moderation log write skipped: ${logErr?.message ?? logErr}`);
        }
        generatedAnswer = REDIRECT_MESSAGE;
      }

      // Persist to web search cache if web search was used
      if (trace.usedWebSearch && generatedAnswer !== REDIRECT_MESSAGE) {
        try {
          await askResponseCache.set(normalized, generatedAnswer);
          logger.info(`/ask cached web-research answer for "${question.slice(0, 60)}"`);
        } catch (cacheErr: any) {
          logger.warn(`/ask cache write skipped: ${cacheErr?.message ?? cacheErr}`);
        }
      }
    }

    // Save generated answer permanently (sets usageCount = 1)
    await askQuestionStore.saveGeneratedAnswer(record.id, generatedAnswer);

    // Save exchange to conversation memory
    try {
      await conversationMemoryStore.append({ userId, channelId, role: 'user', content: question });
      await conversationMemoryStore.append({ userId, channelId, role: 'assistant', content: generatedAnswer });
    } catch (memErr: any) {
      logger.warn(`Memory append skipped: ${memErr?.message ?? memErr}`);
    }

    const embeds = buildAnswerEmbeds(generatedAnswer, AI_EMBED_COLOR);
    await interaction.editReply({
      content: `<@${userId}> **Answer for Question ID \`${record.id}\`** (Use 1/3)`,
      embeds: embeds.length > 0 ? embeds : undefined,
    });
  } catch (err: any) {
    logger.error(`/ask answer generation error for ${questionId}: ${err?.message ?? err}`);
    await askQuestionStore.resetPending(questionId);
    await interaction.editReply({
      content: `<@${userId}> An error occurred while generating your answer: ${failureMessage(err)}`,
    });
  }
}

function isUserAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.guild) return true; // Direct messages/sandbox test mode
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Subcommand: `/ask correction <question_id> <answer> [reset_uses]`
 * Admin-only command to force-remove incorrect/hallucinated answers and replace
 * with a high-accuracy, verified answer.
 */
export async function handleAskCorrection(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  if (!isUserAdmin(interaction)) {
    await interaction.reply({
      content: `<@${userId}> 🔒 **Admin Only**: You need Administrator or Manage Server permissions to use \`/ask correction\`.`,
      ephemeral: true,
    });
    return;
  }

  const rawQuestionId = interaction.options.getString('question_id', false) ?? '';
  const questionId = rawQuestionId.trim();
  const rawAnswer = interaction.options.getString('answer', false) ?? '';
  const newAnswer = rawAnswer.trim();
  const resetUses = interaction.options.getBoolean('reset_uses') ?? true;

  if (!questionId) {
    await interaction.reply({
      content: `<@${userId}> Please provide a valid Question ID to correct.`,
      ephemeral: true,
    });
    return;
  }

  if (!newAnswer) {
    await interaction.reply({
      content: `<@${userId}> Please provide the verified, accurate answer for this correction.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const { previousAnswer, record } = await askQuestionStore.correctAnswer(
      questionId,
      newAnswer,
      resetUses
    );

    if (!record) {
      await interaction.editReply({
        content: `<@${userId}> Question not found with ID \`${questionId}\`. Please check the Question ID.`,
      });
      return;
    }

    // Update the answer cache so identical future queries reuse this accurate response
    const normalized = normalizeQuestion(record.question);
    try {
      await askResponseCache.set(normalized, newAnswer);
      logger.info(`Updated askResponseCache with admin correction for "${record.question.slice(0, 60)}"`);
    } catch (cacheErr: any) {
      logger.warn(`Failed to update cache on correction: ${cacheErr?.message ?? cacheErr}`);
    }

    logger.info(
      `Admin <@${userId}> corrected answer for Question ${record.id}: "${newAnswer.slice(0, 60)}"`
    );

    const embed = new EmbedBuilder()
      .setTitle('✏️ Ask Answer Corrected (Admin Override)')
      .setColor(0x38bdf8)
      .setDescription(
        `The answer for Question ID **\`${record.id}\`** has been updated with a verified, accurate answer.\n` +
        `Any previous inaccurate terms or out-of-taxonomy hallucinated answers have been removed and replaced.`
      )
      .addFields(
        {
          name: '❓ Question',
          value: record.question.length > 500 ? record.question.slice(0, 497) + '...' : record.question,
          inline: false,
        },
        {
          name: '🗑️ Previous Replaced Answer',
          value: previousAnswer
            ? (previousAnswer.length > 300 ? previousAnswer.slice(0, 297) + '...' : previousAnswer)
            : '*None (was pending)*',
          inline: false,
        },
        {
          name: '✅ New Accurate Answer',
          value: newAnswer.length > 1024 ? newAnswer.slice(0, 1020) + '...' : newAnswer,
          inline: false,
        },
        {
          name: '📊 Status & Usage',
          value: resetUses
            ? `**Active** • Usage reset to **0/${record.maxUses}** (Trainers can now retrieve this answer)`
            : `**Active** • Usage: **${record.usageCount}/${record.maxUses}**`,
          inline: true,
        },
        {
          name: '👤 Corrected By',
          value: `<@${userId}>`,
          inline: true,
        }
      )
      .setFooter({
        text: `Trainers can use /ask answer question_id:${record.id} to retrieve this answer.`,
      });

    await interaction.editReply({
      content: `<@${userId}> ✅ Answer successfully updated and corrected.`,
      embeds: [embed],
    });
  } catch (err: any) {
    logger.error(`/ask correction error for ${questionId}: ${err?.message ?? err}`);
    await interaction.editReply({
      content: `<@${userId}> Failed to correct answer: ${failureMessage(err)}`,
    });
  }
}

/**
 * Autocomplete handler for `question_id` options in /ask answer and /ask correction.
 */
export async function handleAskQuestionAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = focused.value.toLowerCase().trim();

  try {
    const recent = await askQuestionStore.listRecent(25, query);
    const suggestions = recent.map((r) => {
      const qSnippet = r.question.length > 45 ? r.question.slice(0, 42) + '...' : r.question;
      const statusIcon = r.status === 'completed' ? '✅' : r.status === 'pending' ? '⏳' : r.status === 'expired' ? '⌛' : '⚠️';
      const label = `${statusIcon} [${r.id}] ${qSnippet}`.slice(0, 100);
      return {
        name: label,
        value: r.id,
      };
    });
    await interaction.respond(suggestions);
  } catch {
    await interaction.respond([]);
  }
}

/** Feature 1+2: handle the /ask slash command and route to appropriate subcommand. */
export async function handleAsk(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === 'question') {
    await handleAskQuestion(interaction);
  } else if (subcommand === 'answer') {
    await handleAskAnswer(interaction);
  } else if (subcommand === 'correction') {
    await handleAskCorrection(interaction);
  } else {
    // Fallback if subcommand was omitted: check for direct options
    const directQuestion = interaction.options.getString('question', false);
    const directQuestionId = interaction.options.getString('question_id', false);

    if (directQuestion) {
      await handleAskQuestion(interaction);
    } else if (directQuestionId) {
      await handleAskAnswer(interaction);
    } else {
      const userId = interaction.user.id;
      await interaction.reply({
        content: `<@${userId}> Please specify a valid subcommand: \`/ask question <question>\`, \`/ask answer <question_id>\`, or \`/ask correction <question_id> <answer>\`.`,
        ephemeral: true,
      });
    }
  }
}

export const askCommand = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask the AI agent a question (submit question, retrieve answer, or correct answer)')
  .addSubcommand((sub) =>
    sub
      .setName('question')
      .setDescription('Submit a question to the AI agent')
      .addStringOption((opt) =>
        opt.setName('question').setDescription('Your question').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('answer')
      .setDescription('Retrieve or generate the answer for a question ID')
      .addStringOption((opt) =>
        opt
          .setName('question_id')
          .setDescription('The unique Question ID')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('correction')
      .setDescription('Admin: Force remove and replace an answer with a verified accurate answer')
      .addStringOption((opt) =>
        opt
          .setName('question_id')
          .setDescription('The unique Question ID to correct')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('answer')
          .setDescription('The verified, accurate answer to replace the old answer')
          .setRequired(true)
      )
      .addBooleanOption((opt) =>
        opt
          .setName('reset_uses')
          .setDescription('Reset usage count to 0 so trainers can retrieve it (default: true)')
          .setRequired(false)
      )
  )
  .setDMPermission(false)
  .toJSON();
