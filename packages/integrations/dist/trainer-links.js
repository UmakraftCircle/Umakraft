import { getTursoClient } from './turso.js';
import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('TrainerLinks');
// ── Store ─────────────────────────────────────────────────
export class TrainerLinkStore {
    tableReady = false;
    /** Ensure the trainer_links table exists (idempotent). */
    async init() {
        if (this.tableReady)
            return;
        const db = getTursoClient();
        await db.execute(`
      CREATE TABLE IF NOT EXISTS trainer_links (
        discord_user_id TEXT PRIMARY KEY,
        trainer_id      TEXT NOT NULL,
        trainer_name    TEXT NOT NULL,
        linked_at       TEXT NOT NULL
      )
    `);
        this.tableReady = true;
        logger.info('trainer_links table ready');
    }
    /** Return all linked trainer records. */
    async getAll() {
        await this.init();
        const db = getTursoClient();
        const result = await db.execute('SELECT * FROM trainer_links ORDER BY linked_at DESC');
        return result.rows.map(row => ({
            discordUserId: row['discord_user_id'],
            trainerId: row['trainer_id'],
            trainerName: row['trainer_name'],
            linkedAt: row['linked_at'],
        }));
    }
    /** Look up a single link by Discord user ID. */
    async getByDiscordUser(discordUserId) {
        await this.init();
        const db = getTursoClient();
        const result = await db.execute({
            sql: 'SELECT * FROM trainer_links WHERE discord_user_id = ?',
            args: [discordUserId],
        });
        if (result.rows.length === 0)
            return null;
        const row = result.rows[0];
        return {
            discordUserId: row['discord_user_id'],
            trainerId: row['trainer_id'],
            trainerName: row['trainer_name'],
            linkedAt: row['linked_at'],
        };
    }
    /** Insert or update a trainer link (upsert). */
    async upsert(link) {
        await this.init();
        const db = getTursoClient();
        await db.execute({
            sql: `INSERT INTO trainer_links (discord_user_id, trainer_id, trainer_name, linked_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(discord_user_id) DO UPDATE SET
              trainer_id   = excluded.trainer_id,
              trainer_name = excluded.trainer_name,
              linked_at    = excluded.linked_at`,
            args: [link.discordUserId, link.trainerId, link.trainerName, link.linkedAt],
        });
        logger.info(`Link upserted: ${link.discordUserId} → ${link.trainerName}`);
    }
    /** Remove a link. Returns the removed record or null. */
    async remove(discordUserId) {
        const link = await this.getByDiscordUser(discordUserId);
        if (!link)
            return null;
        const db = getTursoClient();
        await db.execute({
            sql: 'DELETE FROM trainer_links WHERE discord_user_id = ?',
            args: [discordUserId],
        });
        logger.info(`Link removed: ${discordUserId}`);
        return link;
    }
    /** Count of linked users. */
    async count() {
        await this.init();
        const db = getTursoClient();
        const result = await db.execute('SELECT COUNT(*) as cnt FROM trainer_links');
        return result.rows[0]?.['cnt'] || 0;
    }
}
// ── Singleton export ──────────────────────────────────────
export const trainerLinkStore = new TrainerLinkStore();
//# sourceMappingURL=trainer-links.js.map