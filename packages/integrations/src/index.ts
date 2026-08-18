import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { getDatabase } from './database.js';

export * from './database.js';
export * from './turso.js';
export * from './trainer-links.js';
export * from './conversation-memory.js';
export * from './web-search.js';
export * from './ask-response-cache.js';
export * from './task-state.js';
export * from './schedule-store.js';
export * from './automation.js';
export * from './confirmation-store.js';
export * from './notification-store.js';
export * from './action-controller.js';

const logger = createLogger('Integrations');

export const discordSendMessage: ToolDefinition = {
  slug: 'discord-send-message',
  name: 'Discord: Send Message',
  description: 'Sends a chat notification message to a specific Discord channel.',
  parameters: {
    message: { type: 'string', description: 'The plain-text message content to broadcast', required: true }
  },
  handler: async (args) => {
    const message = args['message'];
    // This integration is intentionally a no-op stub: the platform's Discord
    // integration lives in the bot gateway (apps/discord), not in this tool. We
    // do NOT report success, so callers never believe a message was delivered.
    logger.warn(
      'discord-send-message is a stub \u2014 message was NOT sent to Discord. ' +
      'Use the Discord bot gateway (apps/discord) for real Discord integration.'
    );
    return {
      success: false,
      timestamp: new Date().toISOString(),
      platform: 'discord',
      reason: 'discord-send-message is not implemented; use the Discord bot gateway instead.',
    };
  }
};

export const databaseStoreResult: ToolDefinition = {
  slug: 'database-store-result',
  name: 'SQLite DB: Store Result',
  description: 'Saves execution results and run logs into the local persistent SQLite database.',
  parameters: {
    planId: { type: 'string', description: 'The unique ID of the executed plan', required: true },
    data: { type: 'object', description: 'The full ExecutionPlan object to save to the database', required: true }
  },
  handler: async (args) => {
    const planId = args['planId'];
    const planData = args['data'];
    const tasksList = planData.tasks instanceof Map ? Array.from(planData.tasks.values()) : (planData.tasks || []);

    logger.info(`Persisting plan results for plan ${planId} into SQLite database..`);

    try {
      const db = await getDatabase();

      let planStatus = 'completed';
      if (tasksList.some((t: any) => t.status === 'failed')) {
        planStatus = 'failed';
      } else if (tasksList.some((t: any) => t.status === 'running' || t.status === 'pending')) {
        planStatus = 'running';
      }

      const persist = db.transaction(() => {
        db.prepare(`
        INSERT INTO execution_plans (id, intent, model_used, created_at, estimated_steps, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status
      `).run(
        planId,
        planData.intent || 'Unknown intent',
        planData.metadata?.modelUsed || 'unknown-model',
        planData.metadata?.createdAt || new Date().toISOString(),
        tasksList.length,
        planStatus
      );

        const taskStmt = db.prepare(`
        INSERT INTO tasks (id, plan_id, name, tool_slug, arguments, dependencies, status, result, error, retry_count, max_retries)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, plan_id) DO UPDATE SET
          status = excluded.status,
          result = excluded.result,
          error = excluded.error,
          retry_count = excluded.retry_count
      `);
        for (const task of tasksList) {
          taskStmt.run(
            task.id,
            planId,
            task.name,
            task.toolSlug,
            JSON.stringify(task.arguments || {}),
            JSON.stringify(task.dependencies || []),
            task.status,
            task.result ? JSON.stringify(task.result) : null,
            task.error || null,
            task.retryCount || 0,
            task.maxRetries || 3
          );
        }
      });

      persist();

      logger.info(`Successfully stored plan ${planId} and ${tasksList.length} tasks in SQLite platform.db!`);
      return {
        success: true,
        planId,
        dbPath: 'platform.db',
        dbRowsInserted: 1 + tasksList.length,
        savedAt: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error(`Failed to store result in SQLite database! Error: ${error.message}`);
      throw new Error(`Database persistence failure: ${error.message}`);
    }
  }
};

export const allIntegrations = [discordSendMessage, databaseStoreResult];
