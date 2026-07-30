export class Logger {
  constructor(private context: string) {}

  public info(message: string, ...args: any[]): void {
    console.log(`[INFO] [${this.context}] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] [${this.context}] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(`[ERROR] [${this.context}] ${message}`, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] [${this.context}] ${message}`, ...args);
  }
}

export const createLogger = (context: string) => new Logger(context);
