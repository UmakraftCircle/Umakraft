export declare class BaseError extends Error {
    message: string;
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class ToolExecutionError extends BaseError {
    constructor(message: string, details?: any);
}
export declare class PlanValidationError extends BaseError {
    constructor(message: string, details?: any);
}
export declare class ModelTimeoutError extends BaseError {
    constructor(message: string, details?: any);
}
export declare class ConfigurationError extends BaseError {
    constructor(message: string, details?: any);
}
//# sourceMappingURL=errors.d.ts.map