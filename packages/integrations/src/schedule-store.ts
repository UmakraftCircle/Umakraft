import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ScheduleStore');

export type TaskType = 'watch_uma' | 'watch_event' | 'remind' | 'digest';

export interface ScheduledTask {
  id: string;
  userId: string;
  guildId: string | null;
  taskType: TaskType;
  taskConfig: Record<string, any>;
  schedule: string;
  timezone: string;
  enabled: number;
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ScheduleStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        guild_id    TEXT,
        task_type   TEXT NOT NULL,
        task_config TEXT NOT NULL,
        schedule    TEXT NOT NULL,
        timezone    TEXT NOT NULL DEFAULT 'UTC',
        enabled     INTEGER NOT NULL DEFAULT 1,
        next_run_at TEXT NOT NULL,
        last_run_at TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_scheduled_due ON scheduled_tasks (enabled, next_run_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_scheduled_user ON scheduled_tasks (user_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_scheduled_guild ON scheduled_tasks (guild_id)');
    this.tableReady = true;
    logger.info('scheduled_tasks table ready');
  }

  private makeId(): string {
    return `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async create(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt'>): Promise<ScheduledTask> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    const id = this.makeId();
    const full: ScheduledTask = { ...task, id, lastRunAt: null, createdAt: now, updatedAt: now };
    await db.execute({
      sql: `INSERT INTO scheduled_tasks (id, user_id, guild_id, task_type, task_config, schedule, timezone, enabled, next_run_at, last_run_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        full.id, full.userId, full.guildId, full.taskType, JSON.stringify(full.taskConfig),
        full.schedule, full.timezone, full.enabled, full.nextRunAt, null, full.createdAt, full.updatedAt,
      ],
    });
    logger.info(`Scheduled task created: ${id} (${full.taskType})`);
    return full;
  }

  async get(id: string): Promise<ScheduledTask | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({ sql: 'SELECT * FROM scheduled_tasks WHERE id = ?', args: [id] });
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async listDue(nowIso: string = new Date().toISOString(), limit = 50): Promise<ScheduledTask[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT * FROM scheduled_tasks WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT ?',
      args: [nowIso, limit],
    });
    return res.rows.map((r: any) => this.mapRow(r));
  }

  async listByUser(userId: string, limit = 50): Promise<ScheduledTask[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      args: [userId, limit],
    });
    return res.rows.map((r: any) => this.mapRow(r));
  }

  async countByUser(userId: string): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM scheduled_tasks WHERE user_id = ?', args: [userId] });
    return Number(res.rows[0]?.['c'] ?? 0);
  }

  async countByGuild(guildId: string): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({ sql: 'SELECT COUNT(*) AS c FROM scheduled_tasks WHERE guild_id = ?', args: [guildId] });
    return Number(res.rows[0]?.['c'] ?? 0);
  }

  async totalCount(): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute('SELECT COUNT(*) AS c FROM scheduled_tasks');
    return Number(res.rows[0]?.['c'] ?? 0);
  }

  async claim(id: string, newNextRunAt: string): Promise<boolean> {
    await this.init();
    const db = getTursoClient();
    const now = new Date().toISOString();
    const current = await this.get(id);
    if (!current) return false;
    if (current.nextRunAt > now) return false;
    await db.execute({
      sql: 'UPDATE scheduled_tasks SET next_run_at = ?, last_run_at = ?, updated_at = ? WHERE id = ?',
      args: [newNextRunAt, now, now, id],
    });
    return true;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({
      sql: 'UPDATE scheduled_tasks SET enabled = ?, updated_at = ? WHERE id = ?',
      args: [enabled ? 1 : 0, new Date().toISOString(), id],
    });
  }

  async remove(id: string): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({ sql: 'DELETE FROM scheduled_tasks WHERE id = ?', args: [id] });
    logger.info(`Scheduled task removed: ${id}`);
  }

  private mapRow(row: any): ScheduledTask {
    return {
      id: row['id'] as string,
      userId: row['user_id'] as string,
      guildId: (row['guild_id'] as string) || null,
      taskType: row['task_type'] as TaskType,
      taskConfig: JSON.parse(row['task_config'] as string),
      schedule: row['schedule'] as string,
      timezone: row['timezone'] as string,
      enabled: Number(row['enabled']),
      nextRunAt: row['next_run_at'] as string,
      lastRunAt: (row['last_run_at'] as string) || null,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }
}

export const scheduleStore = new ScheduleStore();
