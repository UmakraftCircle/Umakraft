import { createClient, type Client } from '@libsql/client';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Turso');

// ── Singleton client ──────────────────────────────────────

let client: Client | null = null;

/**
 * Returns the shared Turso client instance (lazily constructed singleton).
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

  // createClient() is lazy — it does not open a socket, so wrapping it in a
  // retry loop cannot actually retry a connection failure. Construct once and
  // let the first real query surface any connectivity error.
  client = createClient({ url, authToken });
  logger.info(`Turso client configured for ${url}`);
  return client;
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
