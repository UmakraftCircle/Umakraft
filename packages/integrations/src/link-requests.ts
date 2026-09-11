import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('LinkRequests');

export interface LinkRequestRecord {
  id: string;
  discordUserId: string;
  discordUsername: string;
  trainerId: string;
  trainerName: string;
  requestedAt: string;
  forwardedAt: string;
  status: 'PENDING' | 'FORWARDED';
}

export class LinkRequestStore {
  private tableReady = false;

  /** Ensure the link_requests table exists. */
  async init(): Promise<void> {
    if (this.tableReady) return;

    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS link_requests (
        id                TEXT PRIMARY KEY,
        discord_user_id   TEXT NOT NULL,
        discord_username  TEXT NOT NULL,
        trainer_id        TEXT NOT NULL,
        trainer_name      TEXT NOT NULL,
        requested_at      TEXT NOT NULL,
        forwarded_at      TEXT NOT NULL,
        status            TEXT NOT NULL
      )
    `);

    this.tableReady = true;
    logger.info('link_requests table ready');
  }

  /** Gets existing pending or forwarded link request for a Discord user ID. */
  async getPendingOrForwarded(discordUserId: string): Promise<LinkRequestRecord | null> {
    await this.init();
    const db = getTursoClient();
    const result = await db.execute({
      sql: `SELECT * FROM link_requests WHERE discord_user_id = ? AND status IN ('PENDING', 'FORWARDED') ORDER BY requested_at DESC LIMIT 1`,
      args: [discordUserId],
    });

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row['id'] as string,
      discordUserId: row['discord_user_id'] as string,
      discordUsername: row['discord_username'] as string,
      trainerId: row['trainer_id'] as string,
      trainerName: row['trainer_name'] as string,
      requestedAt: row['requested_at'] as string,
      forwardedAt: row['forwarded_at'] as string,
      status: row['status'] as ('PENDING' | 'FORWARDED'),
    };
  }

  /** Creates a new link request record. */
  async create(data: Omit<LinkRequestRecord, 'id' | 'requestedAt' | 'forwardedAt' | 'status'>): Promise<LinkRequestRecord> {
    await this.init();
    const db = getTursoClient();
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: LinkRequestRecord = {
      id,
      ...data,
      requestedAt: now,
      forwardedAt: now,
      status: 'FORWARDED',
    };

    await db.execute({
      sql: `INSERT INTO link_requests (id, discord_user_id, discord_username, trainer_id, trainer_name, requested_at, forwarded_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        record.id,
        record.discordUserId,
        record.discordUsername,
        record.trainerId,
        record.trainerName,
        record.requestedAt,
        record.forwardedAt,
        record.status,
      ],
    });

    logger.info(`Link request logged and created: ID=${record.id} | User=${record.discordUsername} (${record.discordUserId}) | TrainerName=${record.trainerName} | TrainerID=${record.trainerId}`);
    return record;
  }

  /** Gets all pending or forwarded link request records. */
  async getAllPending(): Promise<LinkRequestRecord[]> {
    await this.init();
    const db = getTursoClient();
    const result = await db.execute(`SELECT * FROM link_requests WHERE status IN ('PENDING', 'FORWARDED') ORDER BY requested_at DESC`);

    return result.rows.map((row) => ({
      id: row['id'] as string,
      discordUserId: row['discord_user_id'] as string,
      discordUsername: row['discord_username'] as string,
      trainerId: row['trainer_id'] as string,
      trainerName: row['trainer_name'] as string,
      requestedAt: row['requested_at'] as string,
      forwardedAt: row['forwarded_at'] as string,
      status: row['status'] as ('PENDING' | 'FORWARDED'),
    }));
  }

  /** Gets all link request records for audit. */
  async getAll(): Promise<LinkRequestRecord[]> {
    await this.init();
    const db = getTursoClient();
    const result = await db.execute(`SELECT * FROM link_requests ORDER BY requested_at DESC`);

    return result.rows.map((row) => ({
      id: row['id'] as string,
      discordUserId: row['discord_user_id'] as string,
      discordUsername: row['discord_username'] as string,
      trainerId: row['trainer_id'] as string,
      trainerName: row['trainer_name'] as string,
      requestedAt: row['requested_at'] as string,
      forwardedAt: row['forwarded_at'] as string,
      status: row['status'] as ('PENDING' | 'FORWARDED'),
    }));
  }
}

export const linkRequestStore = new LinkRequestStore();
