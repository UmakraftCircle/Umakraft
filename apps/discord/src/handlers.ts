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

// ── Helpers ──

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
  const sign = n >= 0 ? '+' : '';
  return `${sign}${formatFans(Math.abs(n))}`;
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
  const period = (interaction.options.getString('period') || 'daily') as 'daily' | 'weekly' | 'monthly';
  await interaction.deferReply();

  // Find linked trainer
  const link = await trainerLinkStore.getByDiscordUser(interaction.user.id);
  if (!link) {
    await interaction.editReply(
      '⚠️ You are not linked to a trainer yet. Ask an admin to use `/link add` to connect you.'
    );
    return;
  }

  const stats = await fanTrackerAPI.fetchTrainerStats(link.trainerId);

  // Pick gain based on period
  const gainMap: Record<string, { label: string; value: number; rank: number | null }> = {
    daily: { label: 'Daily gain (3d avg ÷ 3)', value: stats.gain3d != null ? Math.round(stats.gain3d / 3) : stats.dailyGain, rank: stats.rank3d },
    weekly: { label: 'Weekly gain (7d)', value: stats.gain7d ?? stats.weeklyGain, rank: stats.rank7d },
    monthly: { label: 'Monthly gain', value: stats.monthlyFans, rank: stats.monthlyRank },
  };

  const gain = gainMap[period];
  const periodLabel = PERIOD_LABELS[period] || period;
  const gainSign = gain.value >= 0 ? '+' : '';

  const embed = new EmbedBuilder()
    .setTitle(`📊 Fan Stats — ${stats.trainerName}`)
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
  const top = interaction.options.getInteger('top') || 10;
  const period = (interaction.options.getString('period') || 'daily') as 'daily' | 'weekly' | 'monthly';
  await interaction.deferReply();

  const members = await fanTrackerAPI.fetchAllMembers();

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

  const embed = new EmbedBuilder()
    .setTitle(`🏆 UmaKraft Leaderboard — Top ${topN.length} (${periodLabel})`)
    .setDescription(lines.join('\n\n'))
    .setColor(0xF1C40F)
    .setFooter({ text: `UmaKraft · ${members.length} active members` });

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
