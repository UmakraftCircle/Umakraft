export declare class Logger {
    private context;
    constructor(context: string);
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
export declare const createLogger: (context: string) => Logger;
//# sourceMappingURL=logger.d.ts.map