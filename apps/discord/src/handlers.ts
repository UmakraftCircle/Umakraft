import { ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { fanTrackerAPI } from '@ai-agent-platform/fan-tracker';
import { trainerLinkStore } from '../stores/trainer-link-store.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('DiscordHandlers');

// ── Helpers ───────────────────────────────────────────────

const ADMIN_ROLES = ['Admin', 'UmaMasters', 'Moderator'];

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.member || typeof interaction.member === 'string') return false;
  const roles = (interaction.member as any).roles;
  if (!roles?.cache) return false;
  return roles.cache.some((r: any) => ADMIN_ROLES.includes(r.name));
}

function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatGain(n: number): string {
  const sign = n >= 0 ? '+' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.round(abs)}`;
}

function sanitizePeriod(p: string): string {
  const valid = ['daily', 'weekly', 'monthly'];
  return valid.includes(p) ? p : 'monthly';
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

  const gainMap: Record<string, { label: string; value: number; rank: number | null }> = {
    daily: { label: 'today', value: stats.gain3d != null ? Math.round(stats.gain3d / 3) : stats.dailyGain, rank: stats.rank3d },
    weekly: { label: 'this week', value: stats.gain7d ?? stats.weeklyGain, rank: stats.rank7d },
    monthly: { label: 'this month', value: stats.monthlyFans, rank: stats.monthlyRank },
  };

  const gain = gainMap[period];
  const gainLabel = gain.label;
  const gainDisplay = gain.value > 0 ? formatGain(gain.value) : '-';
  const rankDisplay = gain.rank ? `#${gain.rank}` : '-';

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${stats.trainerName}  ·  ${stats.clubRankTier}  ·  ${stats.monthlyRank ? '#' + stats.monthlyRank : '-'}`)
    .setColor(0x57F287)
    .setDescription(
      `**${formatFans(stats.totalFans)}** total  ·  **${gainDisplay}** ${gainLabel}` +
      (stats.previousCircleName ? `\n🔄 Transferred from **${stats.previousCircleName}**` : '')
    )
    .addFields(
      { name: '7d', value: formatGain(stats.weeklyGain), inline: true },
      { name: 'Per Day', value: stats.avgDaily ? formatFans(stats.avgDaily) : '-', inline: true },
      { name: 'Active Days', value: `${stats.activeDays}`, inline: true },
      { name: '3d Rank', value: stats.rank3d ? `#${stats.rank3d}` : '-', inline: true },
      { name: '7d Rank', value: stats.rank7d ? `#${stats.rank7d}` : '-', inline: true },
    )
    .setFooter({ text: `UmaKraft · ${new Date(stats.updatedAt).toLocaleDateString()}` });

  await interaction.editReply({ embeds: [embed] });
}

// ── /fans leaderboard ─────────────────────────────────────

export async function handleFansLeaderboard(interaction: ChatInputCommandInteraction) {
  const page = interaction.options.getInteger('page') || 1;
  await interaction.deferReply();

  const members = await fanTrackerAPI.fetchAllMembers();
  if (members.length === 0) {
    await interaction.editReply('⚠️ No members found in the circle.');
    return;
  }

  const sorted = members.filter(m => m.isActive).sort((a, b) => b.monthlyFans - a.monthlyFans);
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const slice = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  const lines = slice.map((m, i) => {
    const rank = (currentPage - 1) * perPage + i + 1;
    const name = m.previousCircleName
      ? `${m.trainerName} \uD83D\uDD04 ${m.previousCircleName}`
      : m.trainerName;
    const gain = m.monthlyFans > 0 ? `+${formatFans(m.monthlyFans)}` : (m.monthlyFans < 0 ? formatGain(m.monthlyFans) : '-');
    const daily = m.dailyGain !== 0 ? (m.dailyGain > 0 ? `+${formatFans(m.dailyGain)}` : formatGain(m.dailyGain)) : '-';
    return `\`${String(rank).padStart(2)}\` \`${m.clubRankTier.padEnd(7)}\` \`${gain.padEnd(10)}\` \`${daily.padEnd(10)}\` **${name}**`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Fan Gain Leaderboard')
    .setColor(0x57F287)
    .setDescription(
      `\` #\` \`Tier   \` \`Monthly   \` \`Daily     \` **Trainer**\n` +
      lines.join('\n') +
      `\nPage **${currentPage}** of **${totalPages}** · ${sorted.length} members`
    );

  await interaction.editReply({ embeds: [embed] });
}

// ── /link ─────────────────────────────────────────────────

export async function handleLink(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: '⛔ This command is admin-only.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const discordUser = interaction.options.getUser('discord_user', true);
    const trainerId = interaction.options.getString('trainer_id', true);

    await trainerLinkStore.addLink(discordUser.id, trainerId);
    await interaction.reply(`✅ Linked <@${discordUser.id}> to trainer ID \`${trainerId}\`.`);
  } else if (subcommand === 'remove') {
    const discordUser = interaction.options.getUser('discord_user', true);
    await trainerLinkStore.removeLink(discordUser.id);
    await interaction.reply(`✅ Removed link for <@${discordUser.id}>.`);
  } else if (subcommand === 'list') {
    const links = await trainerLinkStore.getAllLinks();
    if (links.length === 0) {
      await interaction.reply('No trainer links configured yet.');
      return;
    }
    const lines = links.map(l => `- <@${l.discordUserId}> → \`${l.trainerId}\``).join('\n');
    await interaction.reply(`**Trainer Links:**\n${lines}`);
  }
}

// ── /trainer autocomplete ─────────────────────────────────

export async function handleTrainerAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'trainer_id') return;

  const query = (focused.value || '').toLowerCase();

  try {
    const trainers = await fanTrackerAPI.listAllTrainers();
    const filtered = trainers
      .filter(t =>
        t.trainerName.toLowerCase().includes(query) ||
        t.trainerId.includes(query)
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map(t => ({
        name: `${t.trainerName} (${t.trainerId}) [${t.tier}]`,
        value: t.trainerId,
      }))
    );
  } catch (error: any) {
    logger.error(`Autocomplete error: ${error.message}`);
    await interaction.respond([]);
  }
}

// ── Command router ────────────────────────────────────────

export async function routeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    const subcommand = interaction.options.getSubcommand(false) || '';

    if (commandName === 'sync') {
      await handleSync(interaction);
    } else if (commandName === 'fan' || commandName === 'fans') {
      if (subcommand === 'gain') await handleFansGain(interaction);
      else if (subcommand === 'leaderboard') await handleFansLeaderboard(interaction);
      else {
        await interaction.reply({ content: 'Unknown subcommand. Use `/fan gain` or `/fan leaderboard`.', ephemeral: true });
      }
    } else if (commandName === 'link') {
      await handleLink(interaction);
    } else {
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
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