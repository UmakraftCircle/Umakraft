export class BaseError extends Error {
  constructor(public override message: string, public code: string, public details?: any) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ToolExecutionError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'TOOL_EXECUTION_ERROR', details);
  }
}

export class PlanValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'PLAN_VALIDATION_ERROR', details);
  }
}

export class ModelTimeoutError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'MODEL_TIMEOUT_ERROR', details);
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}
