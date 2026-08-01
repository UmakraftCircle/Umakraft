import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '@ai-agent-platform/integrations';

const logger = createLogger('Discord-Handlers');

// ── Constants ────────────────────────────────────────────

const ALLOWED_LEADERBOARD_TOPS = new Set([10, 15, 20, 30]);
const LEADERBOARD_DEFAULT_TOP = 10;

const ALLOWED_PERIODS = new Set(['daily', 'weekly', 'monthly']);
const PERIOD_LABELS: Record<string, string> = {
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
};

// ── Shared types ─────────────────────────────────────────

interface TrainerStats {
  trainerId: string;
  trainerName: string;
  clubRankTier: string;
  monthlyRank: number | null;
  totalFans: number;
  dailyGain: number;
  weeklyGain: number;
  gain7d?: number;
  monthlyFans: number;
  gain30d?: number;
  activeDays: number;
  avgDaily: number | null;
  isActive: boolean;
  previousCircleName?: string;
  updatedAt: number;
}

// ── Helpers ──────────────────────────────────────────────

function sanitizeTop(input: number): number {
  return ALLOWED_LEADERBOARD_TOPS.has(input) ? input : LEADERBOARD_DEFAULT_TOP;
}

function sanitizePeriod(input: string): string {
  return ALLOWED_PERIODS.has(input) ? input : 'monthly';
}

function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatGain(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs}`;
}

// ── /fan gain ────────────────────────────────────────────

export async function handleFanGain(interaction: ChatInputCommandInteraction) {
  const period = sanitizePeriod(interaction.options.getString('period') || 'monthly');
  await interaction.deferReply();

  const link = await trainerLinkStore.getByDiscordUser(interaction.user.id);
  if (!link) {
    await interaction.editReply(
      '⚠️ You haven\'t linked your uma.moe profile yet.\n' +
      'Use `/link add <trainer-id>` to link your account.'
    );
    return;
  }

  const stats = await fanTrackerAPI.fetchTrainerStats(link.trainerId, period);
  if (!stats) {
    await interaction.editReply(
      '⚠️ Could not fetch your stats right now. The uma.moe API may be slow. Try again in a moment.'
    );
    return;
  }

  let gain: { value: number; label: string };
  switch (period) {
    case 'daily': gain = { value: stats.dailyGain, label: 'Daily Gain' }; break;
    case 'weekly': gain = { value: stats.gain7d ?? stats.weeklyGain, label: '7-Day Gain' }; break;
    case 'monthly': gain = { value: stats.monthlyFans, label: 'Monthly Gain' }; break;
    default: gain = { value: stats.monthlyFans, label: 'Monthly Gain' };
  }

  const gainSign = gain.value >= 0 ? '+' : '';
  const periodLabel = PERIOD_LABELS[period] || period;

  const embed = new (require('discord.js').EmbedBuilder)()
    .setTitle(`📊 ${stats.trainerName}`)
    .setColor(gain.value >= 0 ? 0x57F287 : 0xED4245)
    .addFields(
      { name: 'Trainer', value: stats.trainerName, inline: true },
      { name: 'Club Tier', value: stats.clubRankTier, inline: true },
      { name: 'Monthly Rank', value: stats.monthlyRank ? `#${stats.monthlyRank}` : 'N/A', inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: 'Total Fans', value: formatFans(stats.totalFans), inline: true },
      { name: `Gain (${periodLabel})`, value: `${gainSign}${formatFans(gain.value)}`, inline: true },
      { name: 'Avg/Day', value: stats.avgDaily ? formatFans(stats.avgDaily) : 'N/A', inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: 'Active Days', value: `${stats.activeDays}`, inline: true },
      { name: '7d Gain', value: formatGain(stats.gain7d ?? stats.weeklyGain), inline: true },
      { name: '30d Gain', value: stats.gain30d ? formatGain(stats.gain30d) : 'N/A', inline: true },
    )
    .setFooter({ text: `UmaKraft · Updated ${new Date(stats.updatedAt).toLocaleDateString()}` });

  if (stats.previousCircleName) {
    embed.addFields({
      name: '⚠️ Transferred from',
      value: stats.previousCircleName,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
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

  // Sort by the appropriate metric
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

  const periodLabel = PERIOD_LABELS[period] || period;

  const lines = topN.map((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

    let gainDisplay = '';
    switch (period) {
      case 'daily': gainDisplay = formatGain(s.dailyGain); break;
      case 'weekly': gainDisplay = formatGain(s.gain7d ?? s.weeklyGain); break;
      case 'monthly': gainDisplay = formatFans(s.monthlyFans); break;
    }

    const transfer = s.previousCircleName ? ' 🔄' : '';

    return `${medal} **${s.trainerName}**${transfer} — ${gainDisplay}\n` +
      `　└ ${formatFans(s.totalFans)} total · ${s.activeDays}d active · Day +${formatFans(s.avgDaily || 0)} avg`;
  });

  const description = lines.join('\n\n') || null;

  const embed = new (require('discord.js').EmbedBuilder)()
    .setTitle(`🏆 UmaKraft Leaderboard — Top ${topN.length} (${periodLabel})`)
    .setDescription(description)
    .setColor(0xF1C40F)
    .setFooter({ text: `UmaKraft · ${members.length} active members` });

  await interaction.editReply({ embeds: [embed] });
}

// ── Handler dispatcher ───────────────────────────────────

export async function handleSubCommand(
  interaction: ChatInputCommandInteraction,
  commandName: string,
  subcommand: string,
) {
  try {
    if (commandName === 'fan') {
      switch (subcommand) {
        case 'gain': await handleFanGain(interaction); break;
        case 'leaderboard': await handleFansLeaderboard(interaction); break;
        default: await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
      }
      return;
    }

    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
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