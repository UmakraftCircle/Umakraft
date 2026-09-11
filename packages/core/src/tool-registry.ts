import { ToolDefinition, ToolResult, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ToolRegistry');

// ══ Secret redaction ══

const SENSITIVE_KEY_PATTERNS = [
  /key/i, /secret/i, /token/i, /password/i, /auth/i, /credential/i,
  /api[_-]?key/i, /access[_-]?token/i,
];

function redactArgs(args: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(args)) {
    if (SENSITIVE_KEY_PATTERNS.some(p => p.test(k))) {
      safe[k] = '[REDACTED]';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

/**
 * Metadata describing a tool capability before it is instantiated.
 */
export interface ToolCapability {
  id: string;
  category: 'Filesystem' | 'Memory' | 'Discord' | 'Web' | 'Notification' | 'Club' | 'Umamusume' | 'Research' | 'Admin' | string;
  description: string;
  lazy: boolean;
  name?: string;
  parameters?: Record<string, any>;
  whenToUse?: string;
  whenNotToUse?: string;
  authority?: 'high' | 'medium' | 'low';
  authorityScore?: number;
  reliabilityScore?: number;
  tags?: string[];
}

/**
 * A disposable tool instance with an explicit lifecycle contract.
 */
export interface DisposableToolInstance extends ToolDefinition {
  capability?: ToolCapability;
  isDisposed?: boolean;
  dispose?: () => Promise<void> | void;
}

/**
 * Factory for creating fresh tool instances on-demand.
 */
export type ToolFactory = () => Promise<DisposableToolInstance> | DisposableToolInstance;

export interface ToolCapabilityRegistration {
  capability: ToolCapability;
  factory: ToolFactory;
}

/**
 * ToolRegistry acts as a pure capability resolver and lifecycle manager.
 * It registers capability metadata without constructing instances, resolves
 * tools lazily upon executor/context request, and manages instance disposal.
 */
export class ToolRegistry {
  private static instance: ToolRegistry;

  /** Capability metadata stored without constructing tool instances */
  public capabilities: Map<string, ToolCapability> = new Map();

  /** Lazy factories for on-demand tool construction */
  private factories: Map<string, ToolFactory> = new Map();

  /**
   * Tool definitions map maintained for backwards compatibility
   * with legacy callers (e.g. ContextLoader).
   */
  public tools: Map<string, ToolDefinition> = new Map();

  /** Active instantiated tools currently in flight, tracked for disposal */
  private activeInstances: Set<DisposableToolInstance> = new Set();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Registers a capability metadata and its factory.
   * Discovers capabilities without constructing them.
   */
  public registerCapability(
    capabilityOrReg: ToolCapability | ToolCapabilityRegistration,
    factoryParam?: ToolFactory
  ): void {
    let capability: ToolCapability;
    let factory: ToolFactory;

    if ('capability' in capabilityOrReg && 'factory' in capabilityOrReg) {
      capability = capabilityOrReg.capability;
      factory = capabilityOrReg.factory;
    } else {
      capability = capabilityOrReg as ToolCapability;
      factory = factoryParam!;
    }

    if (!capability || !capability.id) {
      logger.warn('Attempted to register invalid capability with missing id');
      return;
    }

    if (this.capabilities.has(capability.id)) {
      logger.debug(`Capability '${capability.id}' already registered; skipping.`);
      return;
    }

    this.capabilities.set(capability.id, capability);
    this.factories.set(capability.id, factory);

    // Provide lazy delegate in this.tools for backwards compatibility
    this.tools.set(capability.id, {
      slug: capability.id,
      name: capability.name || capability.id,
      description: capability.description,
      parameters: capability.parameters || {},
      handler: async (args: Record<string, any>) => this.execute(capability.id, args),
    });

    logger.info(`Registered capability [${capability.id}] (category: ${capability.category}, lazy: ${capability.lazy})`);
  }

  /**
   * Registers a brand new tool into the registry.
   * Idempotent: if a tool with the same slug is already registered, it is skipped.
   * Automatically derives capability metadata and registers a lazy factory.
   */
  public register(tool: ToolDefinition): void {
    if (this.tools.has(tool.slug) && this.capabilities.has(tool.slug)) {
      logger.info(`Tool '${tool.slug}' already registered; skipping.`);
      return;
    }

    const capability: ToolCapability = (tool as any).capability ?? {
      id: tool.slug,
      name: tool.name,
      category: (tool as any).category || 'General',
      description: tool.description,
      lazy: true,
      parameters: tool.parameters,
    };

    const factory: ToolFactory = () => {
      const instance = tool as DisposableToolInstance;
      instance.capability = capability;
      return instance;
    };

    this.capabilities.set(tool.slug, capability);
    this.factories.set(tool.slug, factory);
    this.tools.set(tool.slug, tool);

    logger.info(`Successfully registered tool: ${tool.slug}`);
  }

  /**
   * Returns registered tool capabilities metadata without instantiating any tools.
   */
  public getCapabilities(ids?: string[]): ToolCapability[] {
    if (ids && ids.length > 0) {
      return ids
        .map(id => this.capabilities.get(id))
        .filter((c): c is ToolCapability => Boolean(c));
    }
    return Array.from(this.capabilities.values());
  }

  /**
   * Checks whether a capability or tool slug is registered.
   */
  public hasCapability(id: string): boolean {
    return this.capabilities.has(id) || this.tools.has(id);
  }

  /**
   * Returns registered tools mapped to LLM tool call schemas without constructing tools.
   */
  public getDeclarativeSchemas(slugs?: string[]): Array<Omit<ToolDefinition, 'handler'>> {
    const targetSlugs = slugs ?? Array.from(new Set([...this.capabilities.keys(), ...this.tools.keys()]));
    const schemas: Array<Omit<ToolDefinition, 'handler'>> = [];

    for (const slug of targetSlugs) {
      const cap = this.capabilities.get(slug);
      if (cap) {
        schemas.push({
          slug: cap.id,
          name: cap.name || cap.id,
          description: cap.description,
          parameters: cap.parameters || {},
        });
        continue;
      }

      const tool = this.tools.get(slug);
      if (tool) {
        const { handler, ...schema } = tool;
        schemas.push(schema);
      }
    }

    return schemas;
  }

  /**
   * Lazily resolves and instantiates a tool instance by capability ID.
   * Returns a disposable instance that must be disposed after task completion.
   */
  public async resolve(id: string): Promise<DisposableToolInstance | null> {
    const factory = this.factories.get(id);
    let instance: DisposableToolInstance | null = null;

    if (factory) {
      instance = await factory();
    } else if (this.tools.has(id)) {
      instance = this.tools.get(id) as DisposableToolInstance;
    }

    if (!instance) {
      logger.warn(`Capability not found: "${id}"`);
      return null;
    }

    // Attach capability metadata if missing
    if (!instance.capability && this.capabilities.has(id)) {
      instance.capability = this.capabilities.get(id);
    }

    // Ensure dispose contract
    if (!instance.dispose) {
      let disposed = false;
      instance.dispose = () => {
        disposed = true;
      };
      Object.defineProperty(instance, 'isDisposed', {
        get: () => disposed,
        set: (val: boolean) => {
          disposed = val;
        },
        configurable: true,
      });
    } else if (instance.isDisposed === undefined) {
      instance.isDisposed = false;
    }

    this.activeInstances.add(instance);
    logger.debug(`Resolved capability [${id}] -> instantiated disposable tool instance`);
    return instance;
  }

  /**
   * Lazily resolves multiple capabilities by ID.
   */
  public async resolveCapabilities(ids: string[]): Promise<Map<string, DisposableToolInstance>> {
    const resolved = new Map<string, DisposableToolInstance>();
    for (const id of ids) {
      const tool = await this.resolve(id);
      if (tool) {
        resolved.set(id, tool);
      }
    }
    return resolved;
  }

  /**
   * Explicitly disposes a tool instance.
   */
  public disposeInstance(instance: DisposableToolInstance): void {
    if (!instance) return;
    try {
      if (typeof instance.dispose === 'function' && !instance.isDisposed) {
        instance.dispose();
      }
    } catch (err: any) {
      logger.warn(`Error disposing tool instance [${instance.slug}]: ${err.message}`);
    } finally {
      try {
        instance.isDisposed = true;
      } catch {
        // Ignore if read-only
      }
      this.activeInstances.delete(instance);
    }
  }

  /**
   * Disposes a collection of tool instances.
   */
  public disposeInstances(instances: Iterable<DisposableToolInstance>): void {
    for (const inst of instances) {
      this.disposeInstance(inst);
    }
  }

  /**
   * Disposes all active tool instances.
   */
  public disposeAll(): void {
    for (const inst of Array.from(this.activeInstances)) {
      this.disposeInstance(inst);
    }
    this.activeInstances.clear();
  }

  /**
   * Returns count of currently active (undisposed) tool instances.
   */
  public getActiveInstancesCount(): number {
    return this.activeInstances.size;
  }

  /**
   * Safely dispatches a tool execution request by its unique slug.
   * Instantiates on-demand, validates, executes, and disposes the instance immediately.
   */
  public async execute(slug: string, args: Record<string, any>): Promise<ToolResult> {
    const tool = await this.resolve(slug);
    if (!tool) {
      logger.error(`Execution failed: tool not found '${slug}'`);
      return {
        success: false,
        error: `Tool not found: no tool registered with slug '${slug}'`
      };
    }

    try {
      this.validateArguments(tool, args);
      logger.info(`Executing tool ${slug} with arguments`, redactArgs(args));
      const data = await tool.handler(args);
      return { success: true, data };
    } catch (error: any) {
      logger.error(`Execution failed for tool ${slug}: ${error?.message || error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.disposeInstance(tool);
    }
  }

  private validateArguments(tool: ToolDefinition, args: Record<string, any>): void {
    for (const [key, param] of Object.entries(tool.parameters)) {
      if (param.required && (args[key] === undefined || args[key] === null)) {
        throw new Error(`Validation Error: Parameter '${key}' is required for tool '${tool.slug}'`);
      }
      if (args[key] !== undefined) {
        if (param.type === 'array') {
          if (!Array.isArray(args[key])) {
            throw new Error(`Validation Error: Parameter '${key}' must be an array for tool '${tool.slug}'`);
          }
        } else if (param.type === 'object') {
          if (typeof args[key] !== 'object' || args[key] === null || Array.isArray(args[key])) {
            throw new Error(`Validation Error: Parameter '${key}' must be an object for tool '${tool.slug}'`);
          }
        } else if (typeof args[key] !== param.type) {
          throw new Error(`Validation Error: Parameter '${key}' must be of type '${param.type}'`);
        }
      }
    }
  }
}

export const toolRegistry = ToolRegistry.getInstance();

