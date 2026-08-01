// ── Log level control ──

const LOG_LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

/** Returns the current log level, checked at each call so runtime changes take effect. */
function currentLevel(): number {
  return LOG_LEVELS[process.env['LOG_LEVEL'] || 'info'] ?? 2;
}

export class Logger {
  constructor(private context: string) {}

  public info(message: string, ...args: any[]): void {
    if (currentLevel() >= 2) console.log(`${now()} [INFO] [${this.context}] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    if (currentLevel() >= 1) console.warn(`${now()} [WARN] [${this.context}] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    if (currentLevel() >= 0) console.error(`${now()} [ERROR] [${this.context}] ${message}`, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    if (currentLevel() >= 3) console.debug(`${now()} [DEBUG] [${this.context}] ${message}`, ...args);
  }
}

export const createLogger = (context: string) => new Logger(context);

function now(): string {
  return new Date().toISOString();
}
