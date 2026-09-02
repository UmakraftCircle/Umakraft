import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { askCommand } from './ask.js';
import { agentCommand } from './agent.js';
import { chatCommand } from './chat.js';
import { scheduleCommand, myTasksCommand, unscheduleCommand } from './autonomous.js';

export const syncCommand = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Fetch fresh data from the Umamusume API and clear the cache (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .toJSON();

export const fanCommand = new SlashCommandBuilder()
  .setName('fan')
  .setDescription('View fan statistics for linked trainers')
  .addSubcommand((sub) =>
    sub
      .setName('gain')
      .setDescription('Show fan count change over a period')
      .addStringOption((opt) =>
        opt.setName('period').setDescription('Time period for gain calculation').setRequired(false)
          .addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' }, { name: 'Monthly', value: 'monthly' })
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('leaderboard')
      .setDescription('Show ranked fan leaderboard')
      .addIntegerOption((opt) =>
        opt.setName('top').setDescription('Number of top trainers to show').setRequired(false)
          .addChoices({ name: 'Top 10', value: 10 }, { name: 'Top 15', value: 15 }, { name: 'Top 20', value: 20 }, { name: 'Top 30', value: 30 }, { name: 'Top 60', value: 60 })
      )
      .addStringOption(opt =>
        opt.setName('period').setDescription('Time period for ranking').setRequired(false)
          .addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' }, { name: 'Monthly', value: 'monthly' })
      )
      .addStringOption(opt =>
        opt.setName('circle').setDescription('Which circle to rank').setRequired(false)
          .addChoices({ name: 'Umakraft', value: 'umakraft' }, { name: 'UmaKraft 2', value: 'umakraft2' }, { name: 'Unified', value: 'unified' })
      )
  )
  .setDMPermission(false)
  .toJSON();

export const linkCommand = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Manage Discord ↔ Umamusume trainer links')
  .addSubcommand((sub) =>
    sub.setName('add').setDescription('Link a Discord user to an Umamusume trainer (admin only)')
      .addUserOption(opt => opt.setName('user').setDescription('Discord member to link').setRequired(true))
      .addStringOption((opt) => opt.setName('trainer').setDescription('Umamusume trainer name (autocomplete)').setRequired(true).setAutocomplete(true))
  )
  .addSubcommand((sub) =>
    sub.setName('remove').setDescription('Unlink a Discord user from their trainer (admin only)')
      .addUserOption(opt => opt.setName('user').setDescription('Discord member to unlink').setRequired(true))
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Show all linked Discord ↔ trainer pairs'))
  .setDMPermission(false)
  .toJSON();

export const compareCommand = new SlashCommandBuilder()
  .setName('compare')
  .setDescription('Compare fan gain between two trainers')
  .addStringOption(opt =>
    opt.setName('period').setDescription('Time period for comparison').setRequired(true)
      .addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' }, { name: 'Monthly', value: 'monthly' })
  )
  .addStringOption(opt =>
    opt.setName('trainer1').setDescription('First trainer to compare (defaults to you)').setRequired(false).setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt.setName('trainer2').setDescription('Second trainer to compare (defaults to you)').setRequired(false).setAutocomplete(true)
  )
  .setDMPermission(false)
  .toJSON();

export const searchCommand = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search Umamusume inheritance, parents, and factors via Pure-DB')
  .addSubcommand((sub) =>
    sub
      .setName('parent')
      .setDescription('Search for Umamusume parents and inheritance factors on uma.pure-db.com')
      .addStringOption((opt) =>
        opt
          .setName('character')
          .setDescription('Parent Uma Musume character (autocomplete)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('blue')
          .setDescription('Primary blue factor stat')
          .setRequired(false)
          .addChoices(
            { name: '⚡ Speed', value: 'speed' },
            { name: '❤️ Stamina', value: 'stamina' },
            { name: '💪 Power', value: 'power' },
            { name: '🔥 Guts', value: 'guts' },
            { name: '🧠 Wisdom', value: 'wisdom' },
            { name: '✨ Any Blue Factor', value: 'any' }
          )
      )
      .addIntegerOption((opt) =>
        opt
          .setName('blue_stars')
          .setDescription('Minimum blue factor stars/count (default 3)')
          .setRequired(false)
          .addChoices(
            { name: '3★ (or 3+ count)', value: 3 },
            { name: '2★', value: 2 },
            { name: '1★', value: 1 }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('red')
          .setDescription('Red factor aptitude (Turf, Dirt, Sprint, Mile, Middle, Long, Front, Pace, Late, End)')
          .setRequired(false)
          .addChoices(
            { name: '🌱 Turf Track', value: 'turf' },
            { name: '🏜️ Dirt Track', value: 'dirt' },
            { name: '⚡ Sprint (Short)', value: 'short' },
            { name: '🏃 Mile', value: 'mile' },
            { name: '🏆 Middle', value: 'middle' },
            { name: '🏔️ Long', value: 'long' },
            { name: '🥇 Front (Runner)', value: 'runner' },
            { name: '🥈 Pace (Leading)', value: 'leading' },
            { name: '🥉 Late (Betweener)', value: 'betweener' },
            { name: '⚡ End (Chaser)', value: 'chaser' }
          )
      )
      .addIntegerOption((opt) =>
        opt
          .setName('red_stars')
          .setDescription('Minimum red factor stars/count (default 3)')
          .setRequired(false)
          .addChoices(
            { name: '3★', value: 3 },
            { name: '2★', value: 2 },
            { name: '1★', value: 1 }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('green')
          .setDescription('Unique skill / Green factor (autocomplete)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('scenario')
          .setDescription('Scenario factor (URA, Unity Cup, TS Climax, Grand Concert)')
          .setRequired(false)
          .addChoices(
            { name: '🏆 URA Finale', value: 'ura' },
            { name: '⚡ Unity Cup (Aoharu)', value: 'unity' },
            { name: '👑 TS Climax Scenario', value: 'climax' },
            { name: '🎵 Our Grand Concert', value: 'grand_concert' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('race')
          .setDescription('G1 race factor (e.g. Japanese Derby, Arima Kinen, Tenno Sho)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('skill')
          .setDescription('White / common skill factor (autocomplete)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('support_card')
          .setDescription('Equipped support card (autocomplete)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('support_limit_break')
          .setDescription('Support card limit break level (default 4★ MLB)')
          .setRequired(false)
          .addChoices(
            { name: 'MLB (4★ Limit Break)', value: 4 },
            { name: '3★ Limit Break', value: 3 },
            { name: '2★ Limit Break', value: 2 },
            { name: '1★ Limit Break', value: 1 },
            { name: '0★ (Base SSR)', value: 0 }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('server')
          .setDescription('Game server code (default: Global)')
          .setRequired(false)
          .addChoices(
            { name: '🌐 Global', value: 'global' },
            { name: '🇯🇵 Japan', value: 'japan' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('target')
          .setDescription('Factor target scope (All, Representative Parent 1, or Grandparents)')
          .setRequired(false)
          .addChoices(
            { name: '🌐 All (Representative + Inheritance)', value: 'all' },
            { name: '👤 Representative Only (Parent 1)', value: 'representative' },
            { name: '🧬 Inheritance Only (Grandparents)', value: 'inheritance' }
          )
      )
  )
  .setDMPermission(false)
  .toJSON();

export const ALL_COMMANDS = [
  syncCommand,
  fanCommand,
  linkCommand,
  compareCommand,
  searchCommand,
  askCommand,
  chatCommand,
  agentCommand,
  scheduleCommand,
  myTasksCommand,
  unscheduleCommand,
];
