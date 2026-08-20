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

export const ALL_COMMANDS = [syncCommand, fanCommand, linkCommand, compareCommand, askCommand, chatCommand, agentCommand, scheduleCommand, myTasksCommand, unscheduleCommand];
