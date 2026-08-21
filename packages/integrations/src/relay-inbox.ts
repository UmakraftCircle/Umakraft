import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('RelayInbox');

/**
 * A single inbound message pushed into the phone-relay inbox.
 *
 * `seq` is the monotonic cursor the phone polls with (`after_seq`). It is
 * backend-agnostic and maps to a plain `WHERE seq > ?` query.
 * `discord_id` (the Discord snowflake) is retained as a UNIQUE column purely
 * for idempotency — the phone's RelayClient also keeps it for local dedupe.
 */
export interface RelayMessage {
  seq: number;
  discord_id: string;
  author_id: string;
  author_name: string;
  channel_id: string;
  guild_id: string | null;
  content: string;
  mentions_bot: boolean;
  created_at: number;
}

/**
 * Durable inbox for messages destined for the phone agent (the "brain").
 *
 * The Discord gateway (apps/discord) pushes inbound DMs and bot mentions here;
 * the relay HTTP routes (apps/api) drain them on poll and remove them once
 * acknowledged. Backed by Turso so messages survive process restarts.
 *
 * This mirrors the existing `TaskStateStore` pattern (lazy `init()`, typed rows,
 * `CREATE TABLE IF NOT EXISTS`).
 */
export class RelayInboxStore {
  private tableReady = false;

  private async init(): Promise<void> {
    if (this.tableReady) return;
    const db = getTursoClient();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS relay_inbox (
        seq          INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id   TEXT NOT NULL UNIQUE,
        author_id    TEXT NOT NULL,
        author_name  TEXT NOT NULL,
        channel_id   TEXT NOT NULL,
        guild_id     TEXT,
        content      TEXT NOT NULL,
        mentions_bot INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL
      )
    `);
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_relay_inbox_seq ON relay_inbox (seq)'
    );
    this.tableReady = true;
    logger.info('relay_inbox table ready');
  }

  /**
   * Append a message to the inbox. Idempotent on `discord_id`: replays and
   * gateway redeliveries of the same message are ignored.
   */
  async push(msg: Omit<RelayMessage, 'seq'>): Promise<void> {
    await this.init();
    const db = getTursoClient();
    await db.execute({
      sql: `INSERT INTO relay_inbox
              (discord_id, author_id, author_name, channel_id, guild_id, content, mentions_bot, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(discord_id) DO NOTHING`,
      args: [
        msg.discord_id,
        msg.author_id,
        msg.author_name,
        msg.channel_id,
        msg.guild_id,
        msg.content,
        msg.mentions_bot ? 1 : 0,
        msg.created_at,
      ],
    });
  }

  /**
   * Return messages newer than `afterSeq` in ascending `seq` order, optionally
   * capped by `limit`. This is the poll cursor for GET /relay/inbox.
   */
  async drain(afterSeq = 0, limit = 100): Promise<RelayMessage[]> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: `SELECT * FROM relay_inbox WHERE seq > ? ORDER BY seq ASC LIMIT ?`,
      args: [afterSeq, limit],
    });
    return res.rows.map((r: any) => this.mapRow(r));
  }

  /** The highest `seq` currently in the inbox (0 when empty). */
  async lastSeq(): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT MAX(seq) AS m FROM relay_inbox',
      args: [],
    });
    const m = res.rows[0]?.['m'];
    return m == null ? 0 : Number(m);
  }

  /** Current number of buffered messages. */
  async size(): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM relay_inbox',
      args: [],
    });
    return Number(res.rows[0]?.['c'] ?? 0);
  }

  /** Delete messages older than `beforeSeq` (inclusive). Used to bound growth. */
  async prune(beforeSeq: number): Promise<number> {
    await this.init();
    const db = getTursoClient();
    const res = await db.execute({
      sql: 'DELETE FROM relay_inbox WHERE seq <= ?',
      args: [beforeSeq],
    });
    return Number(res.rowsAffected ?? 0);
  }

  /** Delete messages acknowledged by the phone, up to `throughSeq` inclusive. */
  async ack(throughSeq: number): Promise<number> {
    return this.prune(throughSeq);
  }

  private mapRow(row: any): RelayMessage {
    return {
      seq: Number(row['seq']),
      discord_id: row['discord_id'] as string,
      author_id: row['author_id'] as string,
      author_name: row['author_name'] as string,
      channel_id: row['channel_id'] as string,
      guild_id: (row['guild_id'] as string) || null,
      content: row['content'] as string,
      mentions_bot: Number(row['mentions_bot']) === 1,
      created_at: Number(row['created_at']),
    };
  }
}

export const relayInboxStore = new RelayInboxStore();
