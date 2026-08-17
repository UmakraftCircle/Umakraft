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
import { renderGainReport, renderLeaderboardReport, renderCompareReport } from '@ai-agent-platform/image-report';
import { CreateCompareSummaryService } from '@ai-agent-platform/ai';
import { handleAsk } from './ask.js';
import { handleAgent } from './agent.js';
import { handleScheduleCreate, handleMyTasks, handleUnschedule } from './autonomous.js';

const logger = createLogger('Discord-Handlers');

const ALLOWED_PERIODS = new Set(['daily', 'weekly', 'monthly']);
const ALLOWED_LEADERBOARD_TOPS = new Set([10, 15, 20, 30, 60]);

// Server owner restriction: this trainer's stats are classified.
const SERVER_OWNER_TRAINER_ID = '612856830731';

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
  if (rank === null) return '⬐';
  if (rank <= 100) return '🏅';
  if (rank <= 500) return '🥈';
  if (rank <= 2000) return '🥉';
  if (rank <= 5000) return '🎖';
  return '⬐';
}

function getDailyMilestoneTitle(dailyGain: number): string {
  if (dailyGain >= 20_000_000) return '🏟 Superstar';
  if (dailyGain >= 15_000_000) return '🏌 Star';
  if (dailyGain >= 10_000_000) return '🏆️ Famous';
  if (dailyGain >= 7_500_000)  return '🏸 Well-known';
  if (dailyGain >= 5_000_000)  return '🚀 First leap';
  return '-';
}

function getMonthlyMilestoneTitle(monthlyFans: number, existingTier?: string): string {
  if (existingTier && existingTier !== '-') {
    const iconMap: Record<string, string> = {
      'Legend': '🏅 Legend',
      'Super-Competitive': '⬐ Super-Competitive',
      'Competitive': '🎖 Competitive',
      'Casual': '🏁 Casual',
      'Minimum': '🏆️ Minimum',
    };
    if (iconMap[existingTier]) return iconMap[existingTier];
  }
  if (monthlyFans >= 200_000_000) return '🏅 Legend';
  if (monthlyFans >= 150_000_000) return '⬐ Super-Competitive';
  if (monthlyFans >= 100_000_000) return '🎖 Competitive';
  if (monthlyFans >= 75_000_000)  return '🏁 Casual';
  if (monthlyFans >= 60_000_000)  return '🏆️ Minimum';
  return '-';
}

export async function handleSync(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🔒 This command is admin-only.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  fanTrackerAPI.clearCache();

  const members = await fanTrackerAPI.fetchAllMembers();
  const linkCount = await trainerLinkStore.count();

  logger.info(`Sync: cleared cache, fetched ${members.length} active members from Umakraft.`);

  await interaction.editReply(
    `✅ **Sync complete!**\n` +
    `Fetched **${members.length} active members** from Umakraft.\n` +
    `Linked Discord users: **${linkCount}**\n` +
    `Top fan: **${members[0]?.trainerName || 'N/A'}** — ${members[0] ? formatFans(members[0].totalFans) : 'N/A'} fans`
  );
}

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

  const fileName = 'fan-gain.png';
  const attachment = new AttachmentBuilder(await renderGainReport({
    trainerName: stats.trainerName,
    trainerId: stats.trainerId,
    dailyGain: stats.dailyGain,
    weeklyGain: stats.weeklyGain,
    monthlyFans: stats.monthlyFans,
    totalFans: stats.totalFans,
    clubRankTier: stats.clubRankTier,
    updatedAt: stats.updatedAt,
  }), { name: fileName });

  const embed = new EmbedBuilder()
    .setTitle('🏈 Fan Gain Report')
    .setColor(0x57F287)
    .setImage(`attachment://${fileName}`);

  await interaction.editReply({ embeds: [embed], files: [attachment] });
}

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

  const fileName = 'fan-leaderboard.png';
  const attachment = new AttachmentBuilder(await renderLeaderboardReport({
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
    periodLabel: PERIOD_LABELS[period] || 'this month',
  }), { name: fileName });

  const embed = new EmbedBuilder()
    .setTitle(`🎺 Fan Leaderboard — Top ${topN.length} (${period.toUpperCase()})`)
    .setColor(0xF1C40F)
    .setImage(`attachment://${fileName}`);

  await interaction.editReply({ embeds: [embed], files: [attachment] });
}

export async function handleLinkAdd(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🔒 This command is admin-only.', ephemeral: true });
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
  logger.info(`${verb} Discord user ${user.tag} ↔ trainer ${trainerName} (${trainerId})`);

  await interaction.reply(
    `✅ **${verb}!**\n` +
    `<@${user.id}> is now linked to **${trainerName}** (${trainerId}).`
  );
}

export async function handleLinkRemove(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '🔒 This command is admin-only.', ephemeral: true });
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

export async function handleLinkList(interaction: ChatInputCommandInteraction) {
  const links = await trainerLinkStore.getAll();

  if (links.length === 0) {
    await interaction.reply('📋 No Discord ↔ trainer links configured yet. Admins can use `/link add`.');
    return;
  }

  const lines = links.map((l) =>
    `• <@${l.discordUserId}> ↔ **${l.trainerName}** (${l.trainerId}) — linked <t:${Math.floor(new Date(l.linkedAt).getTime() / 1000)}:R>`
  );

  const embed = new EmbedBuilder()
    .setTitle(`📋 Trainer Links (${links.length})`)
    .setDescription(lines.join('\n'))
    .setColor(0x5865F2);

  await interaction.reply({ embeds: [embed] });
}

async function resolveTrainerByInput(input: string): Promise<TrainerStats | null> {
  const members = await fanTrackerAPI.fetchAllMembers();
  const clean = input.trim();
  const byId = members.find((m) => m.trainerId === clean);
  if (byId) return byId;
  const m = clean.match(/^(.+?)\s*\((\d+)\)$/);
  if (m) {
    const byParenId = members.find((x) => x.trainerId === m[2]);
    if (byParenId) return byParenId;
  }
  const byName = members.find((x) => x.trainerName.toLowerCase() === clean.toLowerCase());
  return byName ?? null;
}

function gainForPeriod(stats: TrainerStats, period: 'daily' | 'weekly' | 'monthly'): number {
  switch (period) {
    case 'daily': return stats.dailyGain;
    case 'weekly': return stats.weeklyGain;
    case 'monthly': return stats.monthlyFans;
    default: return stats.monthlyFans;
  }
}

export async function handleCompare(interaction: ChatInputCommandInteraction) {
  const periodRaw = interaction.options.getString('period');
  if (!periodRaw || !ALLOWED_PERIODS.has(periodRaw)) {
    await interaction.reply({ content: '⚠️ Invalid period. Must be `daily`, `weekly`, or `monthly`.', ephemeral: true });
    return;
  }
  const period = periodRaw as 'daily' | 'weekly' | 'monthly';

  await interaction.deferReply();

  const t1Input = interaction.options.getString('trainer1');
  const t2Input = interaction.options.getString('trainer2');

  let trainer1: TrainerStats | null = null;
  let trainer2: TrainerStats | null = null;

  const ownLink = await trainerLinkStore.getByDiscordUser(interaction.user.id);

  if (t1Input) {
    trainer1 = await resolveTrainerByInput(t1Input);
  } else if (ownLink) {
    trainer1 = await fanTrackerAPI.fetchTrainerStats(ownLink.trainerId);
  }

  if (t2Input) {
    trainer2 = await resolveTrainerByInput(t2Input);
  } else if (ownLink) {
    trainer2 = await fanTrackerAPI.fetchTrainerStats(ownLink.trainerId);
  }

  if (!trainer1 || !trainer2) {
    await interaction.editReply('⚠️ Could not resolve one or both trainers. Use autocomplete to select valid trainers.');
    return;
  }

  // Server owner restriction — check BEFORE any stat retrieval/render.
  if (trainer1.trainerId === SERVER_OWNER_TRAINER_ID || trainer2.trainerId === SERVER_OWNER_TRAINER_ID) {
    await interaction.editReply('classified information');
    return;
  }

  const g1 = gainForPeriod(trainer1, period);
  const g2 = gainForPeriod(trainer2, period);

  const summaryService = CreateCompareSummaryService();
  const { summary } = await summaryService.generate({
    trainer1Id: trainer1.trainerId,
    trainer1Name: trainer1.trainerName,
    trainer1Gain: g1,
    trainer2Id: trainer2.trainerId,
    trainer2Name: trainer2.trainerName,
    trainer2Gain: g2,
    period,
  });

  const fileName = 'fan-compare.png';
  const attachment = new AttachmentBuilder(await renderCompareReport({
    period,
    periodLabel: PERIOD_LABELS[period] || 'this month',
    trainer1: {
      trainerId: trainer1.trainerId,
      trainerName: trainer1.trainerName,
      gain: g1,
      totalFans: trainer1.totalFans,
      clubRankTier: trainer1.clubRankTier,
    },
    trainer2: {
      trainerId: trainer2.trainerId,
      trainerName: trainer2.trainerName,
      gain: g2,
      totalFans: trainer2.totalFans,
      clubRankTier: trainer2.clubRankTier,
    },
    summary,
    updatedAt: new Date().toISOString(),
  }), { name: fileName });

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Fan Comparison (${period.toUpperCase()})`)
    .setColor(0x4CAF72)
    .setImage(`attachment://${fileName}`);

  await interaction.editReply({ embeds: [embed], files: [attachment] });
}

async function resolveAutocompleteChoices(query: string) {
  const members = await fanTrackerAPI.fetchAllMembers();
  const q = query.toLowerCase().trim();
  return members
    .filter((m) => m.trainerName.toLowerCase().includes(q) || m.trainerId.includes(q))
    .slice(0, 25)
    .map((m) => ({
      name: `${m.trainerName} (${m.trainerId}) · ${formatFans(m.totalFans)} fans`,
      value: `${m.trainerName} (${m.trainerId})`,
    }));
}

export async function handleTrainerAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'trainer') return;

  const query = focused.value.toLowerCase().trim();

  try {
    const filtered = await resolveAutocompleteChoices(query);
    await interaction.respond(filtered);
  } catch {
    await interaction.respond([]);
  }
}

export async function handleCompareAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'trainer1' && focused.name !== 'trainer2') return;

  const query = focused.value.toLowerCase().trim();

  try {
    const filtered = await resolveAutocompleteChoices(query);
    await interaction.respond(filtered);
  } catch {
    await interaction.respond([]);
  }
}

export async function routeCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;
  const subcommand = interaction.options.getSubcommand(false);

  try {
    if (commandName === 'sync') {
      await handleSync(interaction);
    } else if (commandName === 'fan') {
      if (subcommand === 'gain') await handleFansGain(interaction);
      else if (subcommand === 'leaderboard') await handleFansLeaderboard(interaction);
      else await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    } else if (commandName === 'link') {
      if (subcommand === 'add') await handleLinkAdd(interaction);
      else if (subcommand === 'remove') await handleLinkRemove(interaction);
      else if (subcommand === 'list') await handleLinkList(interaction);
      else await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    } else if (commandName === 'compare') {
      await handleCompare(interaction);
    } else if (commandName === 'ask') {
      await handleAsk(interaction);
    } else if (commandName === 'agent') {
      await handleAgent(interaction);
    } else if (commandName === 'schedule') {
      await handleScheduleCreate(interaction);
    } else if (commandName === 'mytasks') {
      await handleMyTasks(interaction);
    } else if (commandName === 'unschedule') {
      await handleUnschedule(interaction);
    }
  } catch (error: any) {
    logger.error(`Handler error for /${commandName} ${subcommand || ''}: ${error.message}`);
    const fallback = { content: '⚠️ An error occurred while processing your command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('⚠️ An error occurred while processing your command.');
    } else {
      await interaction.reply(fallback);
    }
  }
}
