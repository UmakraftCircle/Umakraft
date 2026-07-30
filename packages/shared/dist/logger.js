export class Logger {
    context;
    constructor(context) {
        this.context = context;
    }
    info(message, ...args) {
        console.log(`[INFO] [${this.context}] ${message}`, ...args);
    }
    warn(message, ...args) {
        console.warn(`[WARN] [${this.context}] ${message}`, ...args);
    }
    error(message, ...args) {
        console.error(`[ERROR] [${this.context}] ${message}`, ...args);
    }
    debug(message, ...args) {
        console.debug(`[DEBUG] [${this.context}] ${message}`, ...args);
    }
}
export const createLogger = (context) => new Logger(context);
//# sourceMappingURL=logger.js.map