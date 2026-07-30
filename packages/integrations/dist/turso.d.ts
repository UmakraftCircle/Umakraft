import { type Client } from '@libsql/client';
/**
 * Returns the shared Turso client instance.
 * Initializes on first call using TURSO_URL and TURSO_AUTH_TOKEN env vars.
 */
export declare function getTursoClient(): Client;
/**
 * Close and reset the client. Useful for tests and clean shutdown.
 */
export declare function closeTursoClient(): void;
//# sourceMappingURL=turso.d.ts.map