// ── Log level control ──

const LOG_LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env['LOG_LEVEL'] || 'info'] ?? 2;

export class Logger {
  constructor(private context: string) {}

  public info(message: string, ...args: any[]): void {
    if (CURRENT_LEVEL >= 2) console.log(`[INFO] [${this.context}] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    if (CURRENT_LEVEL >= 1) console.warn(`[WARN] [${this.context}] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    if (CURRENT_LEVEL >= 0) console.error(`[ERROR] [${this.context}] ${message}`, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    if (CURRENT_LEVEL >= 3) console.debug(`[DEBUG] [${this.context}] ${message}`, ...args);
  }
}

export const createLogger = (context: string) => new Logger(context);
