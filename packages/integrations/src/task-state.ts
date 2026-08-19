import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('TaskStateStore');

/** Persistent state for an active agent task (Feature 4). */
export interface AgentTaskState {
  taskId: string;
  userId: string;
  guildId: string | null;
  channelId: string | null;
  goal: string;
  currentStep: number;
  planJson: string | null;
  completedStepsLoc: string | null;
  toolResultsJson: string | null;
  errorsLoc: string | null;
  status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

/**
 * Feature 4: persists agent task state in Turso so multi-step tasks can be
 * resumed or safely inspected after a restart. Stores only task metadata and
 * tool results; never credentials or sensitive user data.
 */
export class TaskStateStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        task_id            TEXT PRIMARY KEY,
        user_id            TEXT NOT NULL,
        guild_id           TEXT,
        channel_id         TEXT,
        goal               TEXT NOT NULL,
        current_step       INTEGER NOT NULL DEFAULT 0,
        plan_json          TEXT,
        completed_steps_json TEXT,
        tool_results_json  TEXT,
        errors_json        TEXT,
        status             TEXT NOT NULL DEFAULT 'created',
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      )
    `);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (status, updated_at)'
    );
    this.tableReady = true;
    logger.info('agent_tasks table ready');
  }

  async create(state: AgentTaskState): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({
      sql: `INSERT INTO agent_tasks (task_id, user_id, guild_id, channel_id, goal, current_step, plan_json, completed_steps_json, tool_results_json, errors_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        state.taskId, state.userId, state.guildId, state.channelId, state.goal,
        state.currentStep, state.planJson, state.completedStepsLoc, state.toolResultsJson,
        state.errorsLoc, state.status, state.createdAt, state.updatedAt,
      ],
    });
  }

  async update(
    taskId: string,
    patch: Partial<Omit<AgentTaskState, 'taskId' | 'createdAt'>>,
  ): Promise<void> {
    await this.init();
    const db = getTursoClient();
    const existing = await this.get(taskId);
    if (!existing) return;
    const merged: AgentTaskState = { ...existing, ...patch, taskId, updatedAt: new Date().toISOString() };
    await db.execute({
      sql: `UPDATE agent_tasks SET
              user_id = ?, guild_id = ?, channel_id = ?, goal = ?, current_step = ?,
              plan_json = ?, completed_steps_json = ?, tool_results_json = ?, errors_json = ?,
              status = ?, updated_at = ?
            WHERE task_id = ?`,
      args: [
        merged.userId, merged.guildId, merged.channelId, merged.goal, merged.currentStep,
        merged.planJson, merged.completedStepsLoc, merged.toolResultsJson, merged.errorsLoc,
        merged.status, merged.updatedAt, taskId,
      ],
    });
  }

  async get(taskId: string): Promise<AgentTaskState | null> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT * FROM agent_tasks WHERE task_id = ?',
      args: [taskId],
    });
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async listByStatus(status: AgentTaskState['status'], limit = 20): Promise<AgentTaskState[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT * FROM agent_tasks WHERE status = ? ORDER BY updated_at DESC LIMIT ?',
      args: [status, limit],
    });
    return res.rows.map((r: any) => this.mapRow(r));
  }

  private mapRow(row: any): AgentTaskState {
    return {
      taskId: row['task_id'] as string,
      userId: row['user_id'] as string,
      guildId: (row['guild_id'] as string) || null,
      channelId: (row['channel_id'] as string) || null,
      goal: row['goal'] as string,
      currentStep: Number(row['current_step']) || 0,
      planJson: (row['plan_json'] as string) || null,
      completedStepsLoc: (row['completed_steps_json'] as string) || null,
      toolResultsJson: (row['tool_results_json'] as string) || null,
      errorsLoc: (row['errors_json'] as string) || null,
      status: row['status'] as AgentTaskState['status'],
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }
}

export const taskStateStore = new TaskStateStore();
