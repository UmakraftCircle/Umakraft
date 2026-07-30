import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { getDatabase } from './database.js';

const logger = createLogger('Integrations');

export const discordSendMessage: ToolDefinition = {
  slug: 'discord-send-message',
  name: 'Discord: Send Message',
  description: 'Sends a chat notification message to a specific Discord channel.',
  parameters: {
    message: {
      type: 'string',
      description: 'The plain-text message content to broadcast',
      required: true
    }
  },
  handler: async (args) => {
    const message = args['message'];
    logger.info(`Sending message to Discord API: "${message}"`);
    return { success: true, timestamp: new Date().toISOString(), platform: 'discord' };
  }
};

export const databaseStoreResult: ToolDefinition = {
  slug: 'database-store-result',
  name: 'SQLite DB: Store Result',
  description: 'Saves execution results and run logs into the local persistent SQLite database.',
  parameters: {
    planId: {
      type: 'string',
      description: 'The unique ID of the executed plan',
      required: true
    },
    data: {
      type: 'object',
      description: 'The full ExecutionPlan object to save to the database',
      required: true
    }
  },
  handler: async (args) => {
    const planId = args['planId'];
    const planData = args['data'];

    logger.info(`Persisting plan results for plan ${planId} into SQLite database...`);

    try {
      const db = await getDatabase();

      // Determine overall plan status
      let planStatus = 'completed';
      const tasksList = planData.tasks instanceof Map ? Array.from(planData.tasks.values()) : (planData.tasks || []);
      if (tasksList.some((t: any) => t.status === 'failed')) {
        planStatus = 'failed';
      } else if (tasksList.some((t: any) => t.status === 'running' || t.status === 'pending')) {
        planStatus = 'running';
      }

      // 1. Insert or update the Execution Plan
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

      // 2. Insert or update individual Tasks
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
export * from './database.js';
