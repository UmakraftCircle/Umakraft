import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { fanTrackerAPI, TrainerStats } from '@ai-agent-platform/fan-tracker';
import { createLogger } from '@ai-agent-platform/shared';
import { trainerLinkStore, type TrainerLink } from '@ai-agent-platform/integrations';

const logger = createLogger('Discord-Handlers');

// ── Input sanitization ──

const ALLOWED_PERIODS = new Set(['daily', 'weekly', 'monthly']);
const ALLOWED_LEADERBOARD_TOPS = new Set([10, 15, 20, 30]);

function sanitizePeriod(input: string): 'daily' | 'weekly' | 'monthly' {
  return ALLOWED_PERIODS.has(input) ? (input as 'daily' | 'weekly' | 'monthly') : 'monthly';
}

function sanitizeTop(input: number): number {
  return ALLOWED_LEADERBOARD_TOPS.has(input) ? input : 10;
}

function sanitizeTrainerInput(input: string): string {
  // Strip any non-alphanumeric characters except spaces, hyphens, and parentheses
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
  if (rank === null) return '⚪';
  if (rank <= 100) return '👑';
  if (rank <= 500) return '🟢';
  if (rank <= 2000) return '🔵';
  if (rank <= 5000) return '🟡';
  return '⚪';
}

// ── /sync ─────────────────────────────────────────────────

export async function handleSync(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ This command is admin-only.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  fanTrackerAPI.clearCache();

  // Warm cache by fetching all members
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

  const total = formatFans(stats.totalFans);
  const monthly = stats.monthlyFans > 0 ? `+${formatFans(stats.monthlyFans)}` : '-';
  const weekly = formatGain(stats.weeklyGain);
  const daily = formatGain(stats.dailyGain);
  const avgDay = stats.avgDaily ? formatFans(stats.avgDaily) : '-';
  const active = `${stats.activeDays}d`;
  const rank3d = stats.rank3d ? `#${stats.rank3d}` : '-';
  const rank7d = stats.rank7d ? `#${stats.rank7d}` : '-';

  const table = [
    '```',
    `  Total        Monthly      7-Day        Daily        Avg/Day      Active`,
    `  ${total.padEnd(12)} ${monthly.padEnd(12)} ${weekly.padEnd(11)} ${daily.padEnd(11)} ${avgDay.padEnd(11)} ${active.padEnd(8)}`,
    '',
    `  3d Rank              7d Rank`,
    `  ${rank3d.padEnd(21)} ${rank7d}`,
    '```',
  ].join('\n');

  const description = table +
    (stats.previousCircleName ? `\n🔄 Transferred from **${stats.previousCircleName}**` : '');

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${stats.trainerName}  ·  ${stats.clubRankTier}  ·  ${stats.monthlyRank ? '#' + stats.monthlyRank : '-'}`)
    .setColor(0x57F287)
    .setDescription(description)
    .setFooter({ text: `UmaKraft · ${new Date(stats.updatedAt).toLocaleDateString()}` });

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
  const gainCol = period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month';

  const header = `  #   Trainer              Tier      ${gainCol.padEnd(11)}  Daily`;
  const lines = topN.map((s, i) => {
    const rank = String(i + 1).padStart(2);
    const name = s.trainerName.slice(0, 18).padEnd(18);
    const tier = s.clubRankTier.padEnd(7);

    let gainDisplay: string;
    switch (period) {
      case 'daily': gainDisplay = formatGain(s.dailyGain); break;
      case 'weekly': gainDisplay = formatGain(s.gain7d ?? s.weeklyGain); break;
      case 'monthly': gainDisplay = s.monthlyFans > 0 ? `+${formatFans(s.monthlyFans)}` : '-'; break;
      default: gainDisplay = '-';
    }
    gainDisplay = gainDisplay.padEnd(11);
    const daily = s.dailyGain > 0 ? `+${formatFans(s.dailyGain)}` : '-';
    const dailyPadded = daily.padEnd(12);

    return `  ${rank}  ${name} ${tier} ${gainDisplay} ${dailyPadded}`;
  });

  const table = [header, ...lines].join('\n');
  const description = '```\n' + table + '\n```' +
    `\n*${members.length} members · ${periodLabel}*`;

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Leaderboard — Top ${topN.length}`)
    .setDescription(description)
    .setColor(0xF1C40F)
    .setFooter({ text: 'UmaKraft' });

  await interaction.editReply({ embeds: [embed] });
}

// ── /link add ─────────────────────────────────────────────

export async function handleLinkAdd(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ This command is admin-only.', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user', true);
  const trainerInput = interaction.options.getString('trainer', true);

  // Parse "Name (trainer-XX)" format or "Name (viewer_id)" from autocomplete
  const match = trainerInput.match(/^(.+?)\s*\((\d+)\)$/);
  const trainerId = match ? match[2] : trainerInput;
  const trainerName = match ? match[1] : trainerInput;

  // Validate: trainerId must be numeric
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
    await interaction.reply('📭 No Discord ↔ trainer links configured yet. Admins can use `/link add`.');
    return;
  }

  const lines = links.map(l =>
    `• <@${l.discordUserId}> → **${l.trainerName}** (${l.trainerId}) — linked <t:${Math.floor(new Date(l.linkedAt).getTime() / 1000)}:R>`
  );

  const embed = new EmbedBuilder()
    .setTitle(`🔗 Trainer Links (${links.length})`)
    .setDescription(lines.join('\n'))
    .setColor(0x5865F2);

  await interaction.reply({ embeds: [embed] });
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
    // Fallback: return empty if API fails
    await interaction.respond([]);
  }
}

// ── Router ────────────────────────────────────────────────

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