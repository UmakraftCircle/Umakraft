import type { LogCategory, LogLevel, StructuredLogEntry } from './types.js';

export * from './types.js';

const LOG_LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

export interface LoggerOptions {
  minLevel?: string;
  transport?: (entry: StructuredLogEntry) => void;
  contextData?: Record<string, any>;
}

/**
 * Phase 10: Developer Structured Logger
 * Emits structured JSON logs categorized across the execution runtime:
 * Scheduler, Planner, Context, Tools, Models, Validator, Checkpoint, Telemetry.
 */
export class Logger {
  private minLevel?: number;
  private transport?: (entry: StructuredLogEntry) => void;
  private contextData: Record<string, any>;

  constructor(
    private context: string,
    options?: LoggerOptions
  ) {
    if (options?.minLevel) {
      this.minLevel = LOG_LEVELS[options.minLevel.toLowerCase()];
    }
    this.transport = options?.transport;
    this.contextData = options?.contextData ? { ...options.contextData } : {};
  }

  public get category(): string {
    return this.context;
  }

  private currentLevel(): number {
    if (this.minLevel !== undefined) return this.minLevel;
    return LOG_LEVELS[process.env['LOG_LEVEL'] || 'info'] ?? 2;
  }

  public withContext(extra: Record<string, any>): Logger {
    return new Logger(this.context, {
      minLevel: this.minLevel !== undefined ? Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.minLevel) : undefined,
      transport: this.transport,
      contextData: { ...this.contextData, ...extra },
    });
  }

  private emitLog(level: LogLevel, message: string, args: any[]): void {
    const normLevel = level.toLowerCase() as LogLevel;
    const levelNum = LOG_LEVELS[normLevel] ?? 2;
    if (this.currentLevel() < levelNum) return;

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: normLevel,
      category: this.context as LogCategory,
      message,
      ...this.contextData,
    };

    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Error) && !Array.isArray(args[0])) {
      entry.metadata = { ...args[0] };
      for (const [k, v] of Object.entries(args[0])) {
        if (entry[k] === undefined) {
          entry[k] = v;
        }
      }
    } else if (args.length === 1 && args[0] instanceof Error) {
      entry.metadata = { error: args[0].message, stack: args[0].stack };
      entry.error = args[0].message;
    } else if (args.length > 0) {
      entry.data = args.length === 1 ? args[0] : args;
    }

    if (this.transport) {
      this.transport(entry);
    } else {
      const json = JSON.stringify(entry);
      if (normLevel === 'error') {
        console.error(json);
      } else if (normLevel === 'warn') {
        console.warn(json);
      } else if (normLevel === 'debug') {
        console.debug(json);
      } else {
        console.log(json);
      }
    }
  }

  public info(message: string, ...args: any[]): void {
    this.emitLog('info', message, args);
  }

  public warn(message: string, ...args: any[]): void {
    this.emitLog('warn', message, args);
  }

  public error(message: string, ...args: any[]): void {
    this.emitLog('error', message, args);
  }

  public debug(message: string, ...args: any[]): void {
    this.emitLog('debug', message, args);
  }

  public logStructured(entry: Partial<StructuredLogEntry> & { level: LogLevel; message: string }): void {
    const normLevel = entry.level.toLowerCase() as LogLevel;
    const fullEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      category: (entry.category ?? this.context) as LogCategory,
      ...this.contextData,
      ...entry,
      level: normLevel,
    };
    const levelNum = LOG_LEVELS[normLevel] ?? 2;
    if (this.currentLevel() >= levelNum) {
      if (this.transport) {
        this.transport(fullEntry);
      } else {
        const json = JSON.stringify(fullEntry);
        if (normLevel === 'error') {
          console.error(json);
        } else if (normLevel === 'warn') {
          console.warn(json);
        } else if (normLevel === 'debug') {
          console.debug(json);
        } else {
          console.log(json);
        }
      }
    }
  }
}

export const createLogger = (context: string, options?: LoggerOptions) => new Logger(context, options);
export const createStructuredLogger = (category: LogCategory, options?: LoggerOptions) => new Logger(category, options);

