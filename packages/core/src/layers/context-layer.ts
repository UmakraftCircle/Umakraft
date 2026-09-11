import { AgentTask, createLogger } from '@ai-agent-platform/shared';
import { ContextLoader, ContextLoaderOptions } from '../context-loader.js';
import { ExecutionContext, ExecutionState } from '../execution-state.js';
import { validateToolArguments, ValidationResult } from '../validator.js';
import { ToolRegistry, DisposableToolInstance } from '../tool-registry.js';

const logger = createLogger('ContextLayer');

export interface ContextLayerOptions extends ContextLoaderOptions {
  loader?: ContextLoader;
  toolRegistry?: ToolRegistry;
}

/**
 * ContextLayer manages the lifecycle of temporary task execution contexts.
 * It enforces lazy loading, capability resolution, and complete resource disposal
 * after each task execution.
 */
export class ContextLayer {
  private loader: ContextLoader;
  private toolRegistry: ToolRegistry;

  constructor(loaderOrOptions?: ContextLoader | ContextLayerOptions) {
    if (loaderOrOptions instanceof ContextLoader) {
      this.loader = loaderOrOptions;
      this.toolRegistry = ToolRegistry.getInstance();
    } else {
      this.loader = loaderOrOptions?.loader ?? new ContextLoader(loaderOrOptions);
      this.toolRegistry = loaderOrOptions?.toolRegistry ?? ToolRegistry.getInstance();
    }
  }

  /**
   * Allocates an isolated, temporary ExecutionContext for a single task.
   * Resolves required tool capabilities on-demand via ToolRegistry.
   * Initializes scoped Working Memory for the task.
   */
  public async createScopedContext(
    task: AgentTask,
    _state?: ExecutionState
  ): Promise<ExecutionContext> {
    logger.debug(`ContextLayer: Creating isolated execution context for task [${task.id}]`);
    const context = await this.loader.loadContext(task);

    // Working Memory lifecycle: Create
    if (!context.workingMemory) {
      context.workingMemory = this.createDefaultWorkingMemory(task.id);
    }

    // Identify required capabilities for this task
    const requiredSlugs = new Set<string>();
    if (task.toolSlug && task.toolSlug !== 'none') {
      requiredSlugs.add(task.toolSlug);
    }
    if (Array.isArray(task.arguments?.tools)) {
      for (const t of task.arguments.tools) {
        if (typeof t === 'string') requiredSlugs.add(t);
      }
    }
    if (Array.isArray(task.arguments?.requiredCapabilities)) {
      for (const t of task.arguments.requiredCapabilities) {
        if (typeof t === 'string') requiredSlugs.add(t);
      }
    }

    // Resolve requested tool capabilities on-demand
    for (const slug of requiredSlugs) {
      if (this.toolRegistry.hasCapability(slug)) {
        const instance = await this.toolRegistry.resolve(slug);
        if (instance) {
          context.tools.set(slug, instance);
        }
      }
    }

    return context;
  }

  /**
   * Validates task execution prerequisites against the isolated context tools.
   */
  public validateContextTask(context: ExecutionContext): ValidationResult {
    const task = context.task;
    const tool = context.tools.get(task.toolSlug);

    // If tool parameters are declared, validate arguments
    if (tool && tool.parameters && Object.keys(tool.parameters).length > 0) {
      return validateToolArguments(task.toolSlug, tool.parameters, task.arguments ?? {});
    }

    return { valid: true, errors: [] };
  }

  /**
   * Executes a unit of work inside an isolated ExecutionContext.
   * Enforces Working Memory lifecycle: Create -> Use -> Merge Output -> Destroy.
   * Guarantees context destruction immediately after execution and validation.
   */
  public async withContext<T>(
    task: AgentTask,
    state: ExecutionState,
    executor: (context: ExecutionContext) => Promise<T>
  ): Promise<T> {
    const context = await this.createScopedContext(task, state);
    try {
      // 1. Use: executor runs with context
      const result = await executor(context);

      // 2. Merge Output: Merge task-level working memory outputs into state (never memory contents)
      if (context.workingMemory && typeof context.workingMemory.getOutputs === 'function') {
        const workingOutputs = context.workingMemory.getOutputs();
        if (workingOutputs && typeof workingOutputs === 'object') {
          for (const [key, val] of Object.entries(workingOutputs)) {
            state.outputs.set(`${task.id}:${key}`, val);
          }
        }
      }

      return result;
    } finally {
      // 3. Destroy: completely destroy working memory and task context
      this.disposeContext(context);
    }
  }

  /**
   * Explicitly disposes all temporary resources in the context,
   * destroying working memory and active tool instances.
   */
  public disposeContext(context: ExecutionContext): void {
    if (!context) return;

    // Working memory lifecycle: Destroy (guaranteed to never persist between tasks)
    if (context.workingMemory) {
      if (typeof context.workingMemory.destroy === 'function') {
        try {
          context.workingMemory.destroy();
        } catch {
          // Ignore if already destroyed
        }
      }
      context.workingMemory = undefined;
    }

    if (context.tools && context.tools.size > 0) {
      for (const tool of Array.from(context.tools.values())) {
        this.toolRegistry.disposeInstance(tool as any);
      }
      context.tools.clear();
    }

    if (!context.isDisposed) {
      logger.debug(`ContextLayer: Disposing execution context for task [${context.task?.id}]`);
      context.dispose();
    }
  }

  private createDefaultWorkingMemory(taskId: string): any {
    const entries = new Map<string, any>();
    const outputs = new Map<string, any>();
    let isDestroyed = false;

    return {
      type: 'working',
      taskId,
      get isDestroyed() {
        return isDestroyed;
      },
      set(key: string, value: any) {
        if (isDestroyed) throw new Error('WorkingMemory destroyed');
        entries.set(key, value);
      },
      get(key: string) {
        if (isDestroyed) throw new Error('WorkingMemory destroyed');
        return entries.get(key);
      },
      has(key: string) {
        if (isDestroyed) throw new Error('WorkingMemory destroyed');
        return entries.has(key);
      },
      mergeOutput(key: string, value: any) {
        if (isDestroyed) throw new Error('WorkingMemory destroyed');
        outputs.set(key, value);
        entries.set(key, value);
      },
      getOutputs() {
        if (isDestroyed) return {};
        return Object.fromEntries(outputs.entries());
      },
      destroy() {
        entries.clear();
        outputs.clear();
        isDestroyed = true;
      },
    };
  }

  public getLoader(): ContextLoader {
    return this.loader;
  }

  public getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  public async resolveCapability(id: string): Promise<DisposableToolInstance | null> {
    return this.toolRegistry.resolve(id);
  }

  public async resolveCapabilities(ids: string[]): Promise<Map<string, DisposableToolInstance>> {
    return this.toolRegistry.resolveCapabilities(ids);
  }
}

