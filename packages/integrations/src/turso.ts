import { createClient, type Client } from '@libsql/client';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Turso');

// ── Singleton client ──────────────────────────────────────

let client: Client | null = null;
const MAX_CONNECT_ATTEMPTS = 3;

/**
 * Returns the shared Turso client instance with retry logic.
 * Retries are per-invocation, not global — each call to this function
 * can attempt up to MAX_CONNECT_ATTEMPTS if previous ones fail. (audit #20)
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

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      client = createClient({ url, authToken });
      logger.info(`Turso client connected to ${url}`);
      return client;
    } catch (err: any) {
      lastError = err;
      logger.warn(`Turso connection attempt ${attempt + 1}/${MAX_CONNECT_ATTEMPTS} failed: ${err.message}`);
    }
  }

  logger.error(`Turso connection failed after ${MAX_CONNECT_ATTEMPTS} attempts: ${lastError?.message}`);
  throw lastError ?? new Error('Turso connection failed');
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
