import { createClient } from '@libsql/client';
import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('Turso');
// ── Singleton client ──────────────────────────────────────
let client = null;
/**
 * Returns the shared Turso client instance.
 * Initializes on first call using TURSO_URL and TURSO_AUTH_TOKEN env vars.
 */
export function getTursoClient() {
    if (client)
        return client;
    const url = process.env['TURSO_URL'];
    const authToken = process.env['TURSO_AUTH_TOKEN'];
    if (!url || !authToken) {
        throw new Error('TURSO_URL and TURSO_AUTH_TOKEN must be set in environment. ' +
            'Get these from the Turso dashboard → your database → Connect.');
    }
    client = createClient({ url, authToken });
    logger.info(`Turso client connected to ${url}`);
    return client;
}
/**
 * Close and reset the client. Useful for tests and clean shutdown.
 */
export function closeTursoClient() {
    if (client) {
        client.close();
        client = null;
        logger.info('Turso client closed');
    }
}
//# sourceMappingURL=turso.js.map