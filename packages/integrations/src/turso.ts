import { createClient, type Client } from '@libsql/client';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Turso');

// ── Singleton client ──────────────────────────────────────

let client: Client | null = null;
let connectAttempts = 0;
const MAX_CONNECT_ATTEMPTS = 3;

/**
 * Returns the shared Turso client instance with retry logic.
 */
export function getTursoClient(): Client {
  if (client) return client;

  const url = process.env['TURSO_URL'];
  const authToken = process.env['TURSO_AUTH_TOKEN'];

  if (!url || !authToken) {
    throw new Error(
      'TURSO_URL and TURSO_AUTH_TOKEN must be set in environment. ' +
      'Get these from the Turso dashboard → your database → Connect.'
    );
  }

  try {
    client = createClient({ url, authToken });
    connectAttempts = 0;
    logger.info(`Turso client connected to ${url}`);
    return client;
  } catch (err: any) {
    connectAttempts++;
    if (connectAttempts < MAX_CONNECT_ATTEMPTS) {
      logger.warn(`Turso connection attempt ${connectAttempts}/${MAX_CONNECT_ATTEMPTS} failed: ${err.message}`);
    } else {
      logger.error(`Turso connection failed after ${MAX_CONNECT_ATTEMPTS} attempts: ${err.message}`);
      throw err;
    }
  }
  throw new Error('Turso connection failed');
}

/**
 * Close and reset the client. Useful for tests and clean shutdown.
 */
export function closeTursoClient(): void {
  if (client) {
    client.close();
    client = null;
    logger.info('Turso client closed');
  }
}
