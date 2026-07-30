import { z } from 'zod';
export declare const TaskStatusSchema: z.ZodEnum<["pending", "running", "completed", "failed"]>;
export declare const AgentTaskSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    toolSlug: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
    dependencies: z.ZodArray<z.ZodString, "many">;
    status: z.ZodEnum<["pending", "running", "completed", "failed"]>;
    result: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodString>;
    retryCount: z.ZodNumber;
    maxRetries: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    toolSlug: string;
    arguments: Record<string, any>;
    status: "pending" | "running" | "completed" | "failed";
    dependencies: string[];
    retryCount: number;
    maxRetries: number;
    error?: string | undefined;
    result?: any;
}, {
    name: string;
    id: string;
    toolSlug: string;
    arguments: Record<string, any>;
    status: "pending" | "running" | "completed" | "failed";
    dependencies: string[];
    retryCount: number;
    maxRetries: number;
    error?: string | undefined;
    result?: any;
}>;
export declare const ExecutionPlanSchema: z.ZodObject<{
    id: z.ZodString;
    intent: z.ZodString;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        toolSlug: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
        dependencies: z.ZodArray<z.ZodString, "many">;
        status: z.ZodEnum<["pending", "running", "completed", "failed"]>;
        result: z.ZodOptional<z.ZodAny>;
        error: z.ZodOptional<z.ZodString>;
        retryCount: z.ZodNumber;
        maxRetries: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        toolSlug: string;
        arguments: Record<string, any>;
        status: "pending" | "running" | "completed" | "failed";
        dependencies: string[];
        retryCount: number;
        maxRetries: number;
        error?: string | undefined;
        result?: any;
    }, {
        name: string;
        id: string;
        toolSlug: string;
        arguments: Record<string, any>;
        status: "pending" | "running" | "completed" | "failed";
        dependencies: string[];
        retryCount: number;
        maxRetries: number;
        error?: string | undefined;
        result?: any;
    }>, "many">;
    metadata: z.ZodObject<{
        modelUsed: z.ZodString;
        createdAt: z.ZodString;
        estimatedSteps: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        modelUsed: string;
        createdAt: string;
        estimatedSteps: number;
    }, {
        modelUsed: string;
        createdAt: string;
        estimatedSteps: number;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    intent: string;
    tasks: {
        name: string;
        id: string;
        toolSlug: string;
        arguments: Record<string, any>;
        status: "pending" | "running" | "completed" | "failed";
        dependencies: string[];
        retryCount: number;
        maxRetries: number;
        error?: string | undefined;
        result?: any;
    }[];
    metadata: {
        modelUsed: string;
        createdAt: string;
        estimatedSteps: number;
    };
}, {
    id: string;
    intent: string;
    tasks: {
        name: string;
        id: string;
        toolSlug: string;
        arguments: Record<string, any>;
        status: "pending" | "running" | "completed" | "failed";
        dependencies: string[];
        retryCount: number;
        maxRetries: number;
        error?: string | undefined;
        result?: any;
    }[];
    metadata: {
        modelUsed: string;
        createdAt: string;
        estimatedSteps: number;
    };
}>;
export declare const ToolParameterSchema: z.ZodObject<{
    type: z.ZodEnum<["string", "number", "boolean", "object", "array"]>;
    description: z.ZodString;
    required: z.ZodBoolean;
    enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    required: boolean;
    enum?: string[] | undefined;
}, {
    description: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    required: boolean;
    enum?: string[] | undefined;
}>;
export declare const ToolDefinitionSchema: z.ZodObject<{
    slug: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["string", "number", "boolean", "object", "array"]>;
        description: z.ZodString;
        required: z.ZodBoolean;
        enum: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        type: "string" | "number" | "boolean" | "object" | "array";
        required: boolean;
        enum?: string[] | undefined;
    }, {
        description: string;
        type: "string" | "number" | "boolean" | "object" | "array";
        required: boolean;
        enum?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    slug: string;
    name: string;
    description: string;
    parameters: Record<string, {
        description: string;
        type: "string" | "number" | "boolean" | "object" | "array";
        required: boolean;
        enum?: string[] | undefined;
    }>;
}, {
    slug: string;
    name: string;
    description: string;
    parameters: Record<string, {
        description: string;
        type: "string" | "number" | "boolean" | "object" | "array";
        required: boolean;
        enum?: string[] | undefined;
    }>;
}>;
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/**
 * Validates a raw execution plan payload before it enters the scheduler.
 */
export declare function validateExecutionPlan(plan: unknown): ValidationResult;
/**
 * Validates tool arguments against its declared parameter schema.
 */
export declare function validateToolArguments(toolSlug: string, params: Record<string, {
    type: string;
    required: boolean;
}>, args: Record<string, any>): ValidationResult;
/**
 * Checks a task dependency graph for cycles using Kahn's algorithm.
 */
export declare function detectCycles(tasks: Array<{
    id: string;
    dependencies: string[];
}>): string[] | null;
//# sourceMappingURL=validator.d.ts.map