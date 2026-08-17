import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
} from 'discord.js';
import { createLogger } from '@ai-agent-platform/shared';
import { scheduleStore, confirmationStore, notificationStore, ActionController, isHighRisk, contentFingerprint, type ScheduledTask, type TaskType } from '@ai-agent-platform/integrations';
import cron from 'node-cron';

const logger = createLogger('Autonomous');

const RELEVANT_EVENT_TYPES = new Set(['messageCreate', 'interactionCreate', 'guildMemberAdd']);

export function isRelevantEvent(eventType: string): boolean {
  return RELEVANT_EVENT_TYPES.has(eventType);
}

const DEFAULT_TZ = process.env['TZ'] || 'Asia/Manila';

function parseDuration(input: string): number {
  const m = input.trim().toLowerCase().match(/^(\d+)\s*(m|h|d)?$/);
  if (!m) return NaN;
  const n = Number(m[1]);
  const unit = m[2] ?? 'h';
  switch (unit) {
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return NaN;
  }
}

function defaultCronFor(type: TaskType, interval?: string): string {
  switch (type) {
    case 'watch_uma':
    case 'watch_event': {
      const ms = interval ? parseDuration(interval) : 60 * 60 * 1000;
      const hours = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
      return `0 */${hours} * * *`;
    }
    case 'digest':
      return '0 9 * * *';
    case 'remind':
      return '';
    default:
      return '0 * * * *';
  }
}

let tickerStarted = false;

export function startScheduler(client: Client, runTask: (task: ScheduledTask) => Promise<void>): void {
  if (tickerStarted) return;
  tickerStarted = true;
  cron.schedule('* * * * *', async () => {
    try {
      const due = await scheduleStore.listDue();
      for (const task of due) {
        const claimed = await scheduleStore.claim(task.id, new Date(Date.now() + 60 * 60 * 1000).toISOString());
        if (!claimed) continue;
        if (task.taskType === 'remind') {
          await scheduleStore.setEnabled(task.id, false);
        }
        runTask(task).catch((err: any) => logger.error(`scheduled task ${task.id} failed: ${err?.message}`));
      }
    } catch (err: any) {
      logger.error(`scheduler tick error: ${err?.message}`);
    }
  }, { timezone: DEFAULT_TZ });
  logger.info(`Autonomous scheduler started (${DEFAULT_TZ})`);
}

export function confirmationRow(confirmationId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`cfm:approve:${confirmationId}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cfm:cancel:${confirmationId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );
}

export async function handleConfirmationButton(interaction: ButtonInteraction, onApproved: (confirmationId: string) => Promise<void>): Promise<void> {
  const match = interaction.customId.match(/^cfm:(approve|cancel):(.+)$/);
  if (!match) return;
  const verb = match[1];
  const confirmationId = match[2];
  const userId = interaction.user.id;

  const conf = await confirmationStore.get(confirmationId);
  if (!conf) { await interaction.reply({ content: 'This confirmation no longer exists.', ephemeral: true }); return; }
  if (conf.userId !== userId) { await interaction.reply({ content: 'Only the original requester can approve this.', ephemeral: true }); return; }
  if (conf.consumed !== 0) { await interaction.reply({ content: 'This confirmation was already used.', ephemeral: true }); return; }
  if (new Date(conf.expiresAt).getTime() <= Date.now()) { await interaction.reply({ content: 'This confirmation expired.', ephemeral: true }); return; }

  if (verb === 'cancel') {
    await confirmationStore.consume(confirmationId, userId);
    await interaction.reply({ content: 'Action cancelled.', ephemeral: true });
    return;
  }

  const cons = await confirmationStore.consume(confirmationId, userId);
  if (!cons.ok) { await interaction.reply({ content: `Could not approve: ${cons.reason}.`, ephemeral: true }); return; }
  await interaction.reply({ content: '✅ Approved! Running action…', ephemeral: true });
  await onApproved(confirmationId);
}

export function makeAutonomousNotifier(controller: ActionController, send: (userId: string, channelId: string | null, message: string) => Promise<void>) {
  return async function notifyIfNeeded(userId: string, channelId: string | null, findings: { source?: string; title?: string; snippet?: string; content?: string }[], summary: (f: typeof findings) => string): Promise<boolean> {
    if (findings.length === 0) return false;
    let anyNew = false;
    for (const f of findings) {
      const fp = contentFingerprint(f);
      const isNew = await notificationStore.recordIfNew(fp, userId, channelId, summary(f.length ? [f] : []));
      if (isNew) anyNew = true;
    }
    if (anyNew) {
      const out = await controller.execute({
        slug: 'send_notification',
        userId,
        action: async () => { await send(userId, channelId, summary(findings)); },
      });
      if (!out.ok) logger.warn(`notification rejected: ${out.reason}`);
      return out.ok;
    }
    return false;
  };
}

export const scheduleCommand = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Configure autonomous agent tasks')
  .addSubcommand((s) =>
    s.setName('watch').setDescription('Watch a trainer or event for updates')
      .addStringOption((o) => o.setName('target').setDescription('Trainer name/id or event keyword').setRequired(true))
      .addStringOption((o) => o.setName('interval').setDescription('e.g. 30m, 2h (default 1h)').setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName('digest').setDescription('Send a periodic Uma Musume news digest')
      .addStringOption((o) => o.setName('time').setDescription('Daily at HH:MM (default 09:00)').setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName('remind').setDescription('Remind you about something later')
      .addStringOption((o) => o.setName('about').setDescription('What to remind you about').setRequired(true))
      .addStringOption((o) => o.setName('in').setDescription('e.g. 30m, 2h, 1d').setRequired(true))
  )
  .setDMPermission(false)
  .toJSON();

export const myTasksCommand = new SlashCommandBuilder()
  .setName('mytasks')
  .setDescription('List your scheduled autonomous tasks')
  .setDMPermission(false)
  .toJSON();

export const unscheduleCommand = new SlashCommandBuilder()
  .setName('unschedule')
  .setDescription('Cancel a scheduled autonomous task')
  .addStringOption((o) => o.setName('id').setDescription('Task id (from /mytasks)').setRequired(true))
  .setDMPermission(false)
  .toJSON();

export async function handleScheduleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand(true);
  const userId = interaction.user.id;
  const guildId = interaction.guildId ?? null;

  const [userCount, guildCount, total] = await Promise.all([
    scheduleStore.countByUser(userId),
    guildId ? scheduleStore.countByGuild(guildId) : Promise.resolve(0),
    scheduleStore.totalCount(),
  ]);
  if (userCount >= 10) { await interaction.reply({ content: 'You have reached the max scheduled tasks (10).', ephemeral: true }); return; }
  if (guildId && guildCount >= 50) { await interaction.reply({ content: 'This server has reached the max scheduled tasks.', ephemeral: true }); return; }
  if (total >= 500) { await interaction.reply({ content: 'Global scheduled task limit reached.', ephemeral: true }); return; }

  const tz = DEFAULT_TZ;
  let task: ScheduledTask;
  const initialNext = new Date(Date.now() + 60 * 1000).toISOString();

  if (sub === 'watch') {
    const target = interaction.options.getString('target', true);
    const interval = interaction.options.getString('interval') ?? undefined;
    const isEvent = /event|banner|news|release/i.test(target);
    task = await scheduleStore.create({
      userId, guildId,
      taskType: isEvent ? 'watch_event' : 'watch_uma',
      taskConfig: { target },
      schedule: defaultCronFor(isEvent ? 'watch_event' : 'watch_uma', interval),
      timezone: tz, enabled: 1, nextRunAt: initialNext,
    });
  } else if (sub === 'digest') {
    task = await scheduleStore.create({
      userId, guildId,
      taskType: 'digest', taskConfig: { topic: 'Uma Musume news' },
      schedule: defaultCronFor('digest'), timezone: tz, enabled: 1, nextRunAt: initialNext,
    });
  } else if (sub === 'remind') {
    const about = interaction.options.getString('about', true);
    const inStr = interaction.options.getString('in', true);
    const ms = parseDuration(inStr);
    if (Number.isNaN(ms) || ms <= 0) { await interaction.reply({ content: 'Invalid duration. Use e.g. 30m, 2h, 1d.', ephemeral: true }); return; }
    task = await scheduleStore.create({
      userId, guildId, taskType: 'remind', taskConfig: { about },
      schedule: '', timezone: tz, enabled: 1, nextRunAt: new Date(Date.now() + ms).toISOString(),
    });
  } else {
    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    return;
  }

  await interaction.reply(`✅ Scheduled. Task id: \`${task.id}\` (type: ${task.taskType}).`);
}

export async function handleMyTasks(interaction: ChatInputCommandInteraction): Promise<void> {
  const tasks = await scheduleStore.listByUser(interaction.user.id);
  if (tasks.length === 0) { await interaction.reply('You have no scheduled tasks.'); return; }
  const lines = tasks.map((t) => `\`${t.id}\` [${t.taskType}] ${t.enabled ? 'on' : 'off'} — next ${t.nextRunAt}`);
  await interaction.reply(lines.join('\n'));
}

export async function handleUnschedule(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getString('id', true);
  const task = await scheduleStore.get(id);
  if (!task || task.userId !== interaction.user.id) { await interaction.reply({ content: 'Task not found or you do not own it.', ephemeral: true }); return; }
  await scheduleStore.remove(id);
  await interaction.reply('🗑️ Task cancelled.');
}

/**
 * Wire autonomous behavior into a Discord Client: handle confirmation buttons
 * and start the scheduler. `runTask` is supplied by the caller (index.ts) and
 * executes a due scheduled task via AgentRunner.
 */
export function wireAutonomy(
  client: Client,
  runTask: (task: ScheduledTask) => Promise<void>,
  onApproved: (confirmationId: string) => Promise<void>,
): void {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      await handleConfirmationButton(interaction, onApproved).catch((err: any) => logger.error(`button handler error: ${err?.message}`));
    }
  });
  startScheduler(client, runTask);
  logger.info('Autonomous behavior wired (event filter + scheduler + confirmation buttons)');
}
