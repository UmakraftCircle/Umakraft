export class BaseError extends Error {
    message;
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.message = message;
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ToolExecutionError extends BaseError {
    constructor(message, details) {
        super(message, 'TOOL_EXECUTION_ERROR', details);
    }
}
export class PlanValidationError extends BaseError {
    constructor(message, details) {
        super(message, 'PLAN_VALIDATION_ERROR', details);
    }
}
export class ModelTimeoutError extends BaseError {
    constructor(message, details) {
        super(message, 'MODEL_TIMEOUT_ERROR', details);
    }
}
export class ConfigurationError extends BaseError {
    constructor(message, details) {
        super(message, 'CONFIGURATION_ERROR', details);
    }
}
//# sourceMappingURL=errors.js.map