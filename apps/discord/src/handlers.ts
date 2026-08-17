import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { fanTrackerAPI, TrainerStats } from '@ai-agent-platform/fan-tracker';
import { createLogger } from '@ai-agent-platform/shared';
import { trainerLinkStore, type TrainerLink } from '@ai-agent-platform/integrations';
import { renderGainReport, renderLeaderboardReport } from '@ai-agent-platform/image-report';
// Feature 1 — Context & Memory
import { conversationMemoryStore } from '@ai-agent-platform/integrations';
import { conversationContextBuilder } from '@ai-agent-platform/core';
import type { AIService } from '@ai-agent-platform/ai';

const logger = createLogger('Discord-Handlers');

// ── Input sanitization ──

const ALLOWED_PERIODS = new Set(['daily', 'weekly', 'monthly']);
const ALLOWED_LEADERBOARD_TOPS = new Set([10, 15, 20, 30, 60]);

function sanitizePeriod(input: string): 'daily' | 'weekly' | 'monthly' {
  return ALLOWED_PERIODS.has(input) ? (input as 'daily' | 'weekly' | 'monthly') : 'monthly';
}

function sanitizeTop(input: number): number {
  return ALLOWED_LEADERBOARD_TOPS.has(input) ? input : 10;
}

function sanitizeTrainerInput(input: string): string {
  return input.replace(/[^a-zA-Z0-9\s\-()]/g, '').slice(0, 100);
}

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const perms = interaction.memberPermissions;
  return !!(perms && perms.has(PermissionFlagsBits.Administrator));
}

const PERIOD_LABELS: Record<string, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
};

function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatGain(n: number): string {
  if (n <= 0) return '-';
  return `+${formatFans(n)}`;
}

function rankEmoji(rank: number | null): string {
  if (rank === null) return '⭐';
  if (rank <= 100) return '🥇';
  if (rank <= 500) return '🥈';
  if (rank <= 2000) return '🥉';
  if (rank <= 5000) return '🎖️';
  return '⭐';
}

function getDailyMilestoneTitle(dailyGain: number): string {
  if (dailyGain >= 20_000_000) return '🏆 Superstar';
  if (dailyGain >= 15_000_000) return '🌟 Star';
  if (dailyGain >= 10_000_000) return '🔥 Famous';
  if (dailyGain >= 7_500_000)  return '🌸 Well-known';
  if (dailyGain >= 5_000_000)  return '🚀 First leap';
  return '-';
}

function getMonthlyMilestoneTitle(monthlyFans: number, existingTier?: string): string {
  if (existingTier && existingTier !== '-') {
    const iconMap: Record<string, string> = {
      'Legend': '🥇 Legend',
      'Super-Competitive': '🥈 Super-Competitive',
      'Competitive': '🥉 Competitive',
      'Casual': '🌸 Casual',
      'Minimum': '🌻 Minimum',
    };
    if (iconMap[existingTier]) return iconMap[existingTier];
  }
  if (monthlyFans >= 200_000_000) return '🥇 Legend';
  if (monthlyFans >= 150_000_000) return '🥈 Super-Competitive';
  if (monthlyFans >= 100_000_000) return '🥉 Competitive';
  if (monthlyFans >= 75_000_000)  return '🌸 Casual';
  if (monthlyFans >= 60_000_000)  return '🌻 Minimum';
  return '-';
}

// ── /sync ─────────────────────────────────────────────────

export async function handleSync(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ This command is admin-only.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  fanTrackerAPI.clearCache();

  const members = await fanTrackerAPI.fetchAllMembers();
  const linkCount = await trainerLinkStore.count();

  logger.info(`Sync: cleared cache, fetched ${members.length} active members from UmaKraft.`);

  await interaction.editReply(
    `✅ **Sync complete!**\n` +
    `Fetched **${members.length} active members** from UmaKraft.\n` +
    `Linked Discord users: **${linkCount}**\n` +
    `Top fan: **${members[0]?.trainerName || 'N/A'}** — ${members[0] ? formatFans(members[0].totalFans) : 'N/A'} fans`
  );
}

// ── /fans gain ────────────────────────────────────────────

export async function handleFansGain(interaction: ChatInputCommandInteraction) {
  const period = sanitizePeriod(interaction.options.getString('period') || 'monthly');
  await interaction.deferReply();

  const link = await trainerLinkStore.getByDiscordUser(interaction.user.id);
  if (!link) {
    await interaction.editReply(
      '⚠️ You are not linked to a trainer yet. Ask an admin to use `/link add` to connect you.'
    );
    return;
  }

  const stats = await fanTrackerAPI.fetchTrainerStats(link.trainerId);

  const total = stats.totalFans > 0 ? `${formatFans(stats.totalFans)} (${stats.totalFans.toLocaleString()})` : '0';
  const monthly = stats.monthlyFans > 0 ? `+${formatFans(stats.monthlyFans)}` : '-';
  const weekly = formatGain(stats.weeklyGain);
  const daily = formatGain(stats.dailyGain);
  const dailyMilestone = getDailyMilestoneTitle(stats.dailyGain);
  const monthlyMilestone = getMonthlyMilestoneTitle(stats.monthlyFans, stats.clubRankTier);

  const description = [
    `👤 **Trainer Name:** ${stats.trainerName}`,
    `🆔 **Trainer ID:** ${stats.trainerId}`,
    ``,
    `🎖️ **Milestones:**`,
    `　**Daily Milestone:** ${dailyMilestone}`,
    `　**Monthly Title:** ${monthlyMilestone}`,
    ``,
    `📈 **Fan Gain:**`,
    `　**Daily:** ${daily}`,
    `　**Weekly:** ${weekly}`,
    `　**Monthly:** ${monthly}`,
    `　**Total Fans:** ${total}`,
  ].join('\n') + (stats.previousCircleName ? `\n\n🔄 Transferred from **${stats.previousCircleName}**` : '');

  const embed = new EmbedBuilder()
    .setTitle(`📈 Fan Gain Statistics`)
    .setColor(0x57F287)
    .setDescription(description)
    .setFooter({ text: `UmaKraft · ${new Date(stats.updatedAt).toLocaleDateString()}` });

  const replyPayload: { embeds: EmbedBuilder[]; files?: AttachmentBuilder[] } = { embeds: [embed] };

  // Attach rendered image report
  try {
    const pngBuffer = await renderGainReport({
      trainerName: stats.trainerName,
      trainerId: stats.trainerId,
      dailyGain: stats.dailyGain,
      weeklyGain: stats.weeklyGain,
      monthlyFans: stats.monthlyFans,
      totalFans: stats.totalFans,
      clubRankTier: stats.clubRankTier,
      updatedAt: stats.updatedAt,
    });
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'fan-gain.png' });
    replyPayload.files = [attachment];
  } catch (renderErr: any) {
    logger.warn(`Image render failed for /fan gain, falling back to text-only: ${renderErr.message}`);
  }

  await interaction.editReply(replyPayload);
}

// ── /fans leaderboard ─────────────────────────────────────

export async function handleFansLeaderboard(interaction: ChatInputCommandInteraction) {
  const top = sanitizeTop(interaction.options.getInteger('top') || 10);
  const period = sanitizePeriod(interaction.options.getString('period') || 'monthly');
  await interaction.deferReply();

  const members = await fanTrackerAPI.fetchAllMembers();

  if (members.length === 0) {
    await interaction.editReply(
      '⚠️ No active trainers found in the leaderboard right now.\n' +
      'The uma.moe API may have returned empty data. Try `/sync` to refresh, or wait a few minutes.'
    );
    return;
  }

  const sortFn = (a: TrainerStats, b: TrainerStats) => {
    switch (period) {
      case 'daily': return b.dailyGain - a.dailyGain;
      case 'weekly': return (b.gain7d ?? b.weeklyGain) - (a.gain7d ?? a.weeklyGain);
      case 'monthly': return b.monthlyFans - a.monthlyFans;
      default: return b.monthlyFans - a.monthlyFans;
    }
  };

  members.sort(sortFn);
  const topN = members.slice(0, Math.min(top, members.length));

  if (topN.length === 0) {
    await interaction.editReply('⚠️ Not enough data to build a leaderboard yet.');
    return;
  }

  const periodLabel = PERIOD_LABELS[period] || 'this month';

  const items = topN.map((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
    const dailyMilestone = getDailyMilestoneTitle(s.dailyGain);
    const monthlyMilestone = getMonthlyMilestoneTitle(s.monthlyFans, s.clubRankTier);

    const dailyGainStr = formatGain(s.dailyGain);
    const weeklyGainStr = formatGain(s.gain7d ?? s.weeklyGain);
    const monthlyGainStr = s.monthlyFans > 0 ? `+${formatFans(s.monthlyFans)}` : '-';
    const totalFansStr = s.totalFans > 0 ? `${formatFans(s.totalFans)}` : '0';

    let mainStat: string;
    switch (period) {
      case 'daily':
        mainStat = `　**Daily Gain:** ${dailyGainStr} | **Monthly:** ${monthlyGainStr}`;
        break;
      case 'weekly':
        mainStat = `　**Weekly Gain:** ${weeklyGainStr} | **Daily:** ${dailyGainStr}`;
        break;
      case 'monthly':
      default:
        mainStat = `　**Monthly Gain:** ${monthlyGainStr} | **Daily:** ${dailyGainStr}`;
        break;
    }

    return [
      `${medal} **${s.trainerName}** (\`${s.trainerId}\`)`,
      `　**Daily Milestone:** ${dailyMilestone}`,
      `　**Monthly Title:** ${monthlyMilestone}`,
      `${mainStat} | **Total:** ${totalFansStr}`,
    ].join('\n');
  });

  const description = items.join('\n\n') +
    `\n\n*${members.length} members · ${periodLabel}*`;

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Fan Leaderboard — Top ${topN.length} (${period.toUpperCase()})`)
    .setDescription(description)
    .setColor(0xF1C40F)
    .setFooter({ text: 'UmaKraft' });

  const replyPayload: { embeds: EmbedBuilder[]; files?: AttachmentBuilder[] } = { embeds: [embed] };

  // Attach rendered image report
  try {
    const periodLabel = PERIOD_LABELS[period] || 'this month';
    const pngBuffer = await renderLeaderboardReport({
      entries: topN.map((s, i) => ({
        rank: i + 1,
        trainerName: s.trainerName,
        dailyGain: s.dailyGain,
        weeklyGain: s.weeklyGain,
        monthlyFans: s.monthlyFans,
        totalFans: s.totalFans,
        clubRankTier: s.clubRankTier,
      })),
      period,
      periodLabel,
    });
    const attachment = new AttachmentBuilder(pngBuffer, { name: 'fan-leaderboard.png' });
    replyPayload.files = [attachment];
  } catch (renderErr: any) {
    logger.warn(`Image render failed for /fan leaderboard, falling back to text-only: ${renderErr.message}`);
  }

  await interaction.editReply(replyPayload);
}

// ── /link add ─────────────────────────────────────────────

export async function handleLinkAdd(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ This command is admin-only.', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user', true);
  const trainerInput = interaction.options.getString('trainer', true);

  const match = trainerInput.match(/^(.+?)\s*\((\d+)\)$/);
  const trainerId = match ? match[2] : trainerInput;
  const trainerName = match ? match[1] : trainerInput;

  if (!/^\d+$/.test(trainerId)) {
    await interaction.reply({ content: `⚠️ Invalid trainer. Use autocomplete to select a valid trainer. Got: \`${trainerInput}\``, ephemeral: true });
    return;
  }

  const existing = await trainerLinkStore.getByDiscordUser(user.id);
  await trainerLinkStore.upsert({
    discordUserId: user.id,
    trainerId,
    trainerName,
    linkedAt: new Date().toISOString(),
  });

  const verb = existing ? 'Updated' : 'Linked';
  logger.info(`${verb} Discord user ${user.tag} → trainer ${trainerName} (${trainerId})`);

  await interaction.reply(
    `✅ **${verb}!**\n` +
    `<@${user.id}> is now linked to **${trainerName}** (${trainerId}).`
  );
}

// ── /link remove ──────────────────────────────────────────

export async function handleLinkRemove(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ This command is admin-only.', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user', true);

  const removed = await trainerLinkStore.remove(user.id);
  if (!removed) {
    await interaction.reply({ content: `⚠️ <@${user.id}> is not linked to any trainer.`, ephemeral: true });
    return;
  }

  logger.info(`Unlinked Discord user ${user.tag} from trainer ${removed.trainerName}`);
  await interaction.reply(
    `🗑️ **Unlinked!**\n` +
    `<@${user.id}> is no longer linked to **${removed.trainerName}**.`
  );
}

// ── /link list ────────────────────────────────────────────

export async function handleLinkList(interaction: ChatInputCommandInteraction) {
  const links = await trainerLinkStore.getAll();

  if (links.length === 0) {
    await interaction.reply('🧭 No Discord ↔ trainer links configured yet. Admins can use `/link add`.');
    return;
  }

  const lines = links.map(l =>
    `　<@${l.discordUserId}> → **${l.trainerName}** (${l.trainerId}) — linked <t:${Math.floor(new Date(l.linkedAt).getTime() / 1000)}:R>`
  );

  const embed = new EmbedBuilder()
    .setTitle(`🔗 Trainer Links (${links.length})`)
    .setDescription(lines.join('\n'))
    .setColor(0x5865F2);

  await interaction.reply({ embeds: [embed] });
}

// ── /ask — AI chat (Feature 1: Context & Memory) ─────────────────────────

// How long the /ask answer stays visible in-channel before self-deleting (ms).
const ASK_REPLY_TTL_MS = 60_000;

/**
 * Handle the /ask command.
 *
 * Flow:
 *  1. deferReply (thinking state) — visible to the channel, not ephemeral.
 *  2. Build scoped context (short-term + long-term) via ConversationContextBuilder.
 *  3. Call the AI service (provider-agnostic; injected).
 *  4. Persist the user message + AI response via ConversationMemoryStore.
 *  5. editReply with the answer, then delete it after 60s.
 */
export async function handleAsk(
  interaction: ChatInputCommandInteraction,
  aiService: AIService,
) {
  const prompt = interaction.options.getString('prompt', true);
  await interaction.deferReply({ ephemeral: false });

  const scope = {
    userId: interaction.user.id,
    guildId: interaction.guildId ?? '',
    channelId: interaction.channelId ?? '',
  };

  try {
    // Build context (scoped, budgeted, relevance-filtered).
    const ctx = await conversationContextBuilder.build(scope, prompt);

    // Call the model.
    const answer = await aiService.generate({ system: ctx.system, prompt: ctx.prompt });

    // Persist the turn (user + assistant) against the session.
    const session = await conversationMemoryStore.getOrCreateSession(scope);
    await conversationMemoryStore.appendMessage({
      sessionId: session.sessionId,
      userId: scope.userId,
      guildId: scope.guildId,
      channelId: scope.channelId,
      messageId: interaction.id,
      role: 'user',
      content: prompt,
    });
    await conversationMemoryStore.appendMessage({
      sessionId: session.sessionId,
      userId: scope.userId,
      guildId: scope.guildId,
      channelId: scope.channelId,
      role: 'assistant',
      content: answer,
    });

    logger.info(
      `/ask answered for ${interaction.user.tag} ` +
      `(context: ${ctx.debug.recentCount} recent turns, ${ctx.debug.longTermCount} LTM, ` +
      `~${ctx.debug.estimatedTokens} tok, truncated=${ctx.debug.truncated})`
    );

    await interaction.editReply(answer);

    // Self-delete after 60s (visible to channel, then disappears).
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
        logger.info(`/ask reply for ${interaction.user.tag} auto-deleted (60s TTL)`);
      } catch (err: any) {
        logger.warn(`Failed to auto-delete /ask reply: ${err.message}`);
      }
    }, ASK_REPLY_TTL_MS);
  } catch (err: any) {
    logger.error(`/ask failed for ${interaction.user.tag}: ${err.message}`);
    await interaction.editReply('⚠️ Something went wrong while processing your question. Please try again.');
  }
}

// ── Autocomplete: /link add trainer ───────────────────────

export async function handleTrainerAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'trainer') return;

  const query = focused.value.toLowerCase().trim();

  try {
    const members = await fanTrackerAPI.fetchAllMembers();

    const filtered = members
      .filter(m =>
        m.trainerName.toLowerCase().includes(query) ||
        m.trainerId.includes(query)
      )
      .slice(0, 25)
      .map(m => ({
        name: `${m.trainerName} (${m.trainerId}) · ${formatFans(m.totalFans)} fans`,
        value: `${m.trainerName} (${m.trainerId})`,
      }));

    await interaction.respond(filtered);
  } catch {
    await interaction.respond([]);
  }
}

// ── Router ────────────────────────────────────────────────

export async function routeCommand(interaction: ChatInputCommandInteraction, aiService?: AIService) {
  const { commandName } = interaction;
  const subcommand = interaction.options.getSubcommand(false);

  try {
    if (commandName === 'sync') {
      await handleSync(interaction);
    } else if (commandName === 'fan') {
      if (subcommand === 'gain') await handleFansGain(interaction);
      else if (subcommand === 'leaderboard') await handleFansLeaderboard(interaction);
      else await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    } else if (commandName === 'ask') {
      if (!aiService) {
        await interaction.reply({ content: '⚠️ AI service is not configured.', ephemeral: true });
        return;
      }
      await handleAsk(interaction, aiService);
    } else if (commandName === 'link') {
      if (subcommand === 'add') await handleLinkAdd(interaction);
      else if (subcommand === 'remove') await handleLinkRemove(interaction);
      else if (subcommand === 'list') await handleLinkList(interaction);
      else await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error: any) {
    logger.error(`Handler error for /${commandName} ${subcommand || ''}: ${error.message}`);
    const fallback = { content: '❌ An error occurred while processing your command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ An error occurred while processing your command.');
    } else {
      await interaction.reply(fallback);
    }
  }
}
