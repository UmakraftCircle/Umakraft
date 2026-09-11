import { AgentTask, createLogger } from '@ai-agent-platform/shared';
import { ModelRouter, ModelStrategy, TaskMetadata } from '../model-router.js';
import { AIProviderAdapter, NormalizedResponse, AdapterRequest } from '@ai-agent-platform/ai';
import { ExecutionContext } from '../execution-state.js';
import { ToolRegistry } from '../tool-registry.js';
import { TaskExecutionResult } from '../task-executor.js';
import { ContextLayer } from './context-layer.js';

const logger = createLogger('ExecutorLayer');

export interface ExecutorLayerOptions {
  modelRouter?: ModelRouter;
  aiAdapter?: AIProviderAdapter;
  registry?: ToolRegistry;
  contextLayer?: ContextLayer;
}

/**
 * Executor Layer
 *
 * Decouples model selection and tool capability resolution from execution.
 * The Executor does NOT import tools directly, know filesystem/Discord implementations,
 * or instantiate tool classes. It strictly receives tool capabilities via ExecutionContext.
 *
 * CRITICAL ARCHITECTURAL RULE (Phase 8):
 * The Executor remains completely streaming-agnostic and unaware of streaming/layers/events.
 * It executes tasks/tools independently without emitting runtime progress events.
 *
 * Flow:
 * Task -> Context Layer (Resolves Capabilities) -> ExecutionContext -> Executor -> Result
 */
export class ExecutorLayer {
  private modelRouter: ModelRouter;
  private aiAdapter: AIProviderAdapter;
  private registry: ToolRegistry;
  private contextLayer: ContextLayer;

  constructor(options: ExecutorLayerOptions = {}) {
    this.modelRouter = options.modelRouter ?? new ModelRouter();
    this.aiAdapter = options.aiAdapter ?? new AIProviderAdapter();
    this.registry = options.registry ?? ToolRegistry.getInstance();
    this.contextLayer = options.contextLayer ?? new ContextLayer({ toolRegistry: this.registry });
  }

  /**
   * Derives metadata from the task without inspecting repository files.
   */
  public extractTaskMetadata(task: AgentTask): TaskMetadata {
    const nameLower = (task.name || '').toLowerCase();
    const slugLower = (task.toolSlug || '').toLowerCase();

    let taskType: 'planning' | 'coding' | 'validation' | 'general' = 'general';
    if (nameLower.includes('plan') || slugLower.includes('plan')) {
      taskType = 'planning';
    } else if (
      nameLower.includes('valid') ||
      nameLower.includes('check') ||
      slugLower.includes('test') ||
      slugLower.includes('valid')
    ) {
      taskType = 'validation';
    } else if (
      nameLower.includes('code') ||
      nameLower.includes('write') ||
      nameLower.includes('impl') ||
      slugLower.includes('edit')
    ) {
      taskType = 'coding';
    }

    const argStr = JSON.stringify(task.arguments ?? {});
    const estimatedTokens = Math.ceil(argStr.length / 4) + 150;
    const complexity: 'low' | 'medium' | 'high' =
      estimatedTokens > 2000 ? 'high' : estimatedTokens > 500 ? 'medium' : 'low';

    const requiresTools = Boolean(task.toolSlug && task.toolSlug !== 'none');

    return {
      taskType,
      complexity,
      requiresTools,
      estimatedTokens,
    };
  }

  /**
   * Execution sequence:
   * 1. Receive task
   * 2. Request model strategy from ModelRouter
   * 3. Send prompt through AI adapter with scoped tool capabilities from context
   * 4. Receive normalized response
   * 5. Return result
   *
   * The Executor contains zero tool imports or provider-specific logic.
   */
  public async execute(
    task: AgentTask,
    context?: ExecutionContext,
    overridePrompt?: string
  ): Promise<NormalizedResponse> {
    logger.debug(`ExecutorLayer: Executing task [${task.id}] - "${task.name}"`);

    // 1. Receive task & build metadata only (never inspects files or memory)
    const metadata = this.extractTaskMetadata(task);

    // 2. Request model strategy from the Model Router
    const strategy: ModelStrategy = this.modelRouter.getStrategy(metadata);
    logger.info(`ExecutorLayer: Following strategy [${strategy.provider}/${strategy.model}] for task [${task.id}]`);

    // 3. Prepare prompt and forward to AI adapter
    const prompt =
      overridePrompt ??
      (task.arguments?.prompt ||
        task.arguments?.instruction ||
        `Task: ${task.name}\nTool: ${task.toolSlug}\nArguments: ${JSON.stringify(task.arguments ?? {})}`);

    const adapterRequest: AdapterRequest = {
      strategy,
      prompt,
      system: task.arguments?.system,
      tools: context && context.tools.size > 0
        ? Array.from(context.tools.values()).map((t) => ({
            slug: t.slug,
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          }))
        : undefined,
    };

    // 4. Receive normalized response from AI adapter
    const response = await this.aiAdapter.execute(adapterRequest);

    // 5. Return result
    return response;
  }

  /**
   * Executes a tool capability directly from the isolated ExecutionContext.
   * Executor has no knowledge of how the tool was created or imported.
   */
  public async executeWithContextTool(
    task: AgentTask,
    context: ExecutionContext
  ): Promise<TaskExecutionResult> {
    const tool = context.tools.get(task.toolSlug);
    if (!tool) {
      throw new Error(`Tool capability '${task.toolSlug}' not found in ExecutionContext`);
    }

    logger.debug(`ExecutorLayer: Executing capability '${task.toolSlug}' from context`);
    const data = await tool.handler(task.arguments ?? {});
    return {
      success: true,
      data,
      attempts: task.retryCount + 1,
    };
  }

  /**
   * Standard TaskExecutor compatibility wrapper.
   */
  public async executeTask(
    task: AgentTask,
    context?: ExecutionContext
  ): Promise<TaskExecutionResult & { response?: NormalizedResponse }> {
    try {
      // If task directly targets a resolved tool capability in context
      if (
        context &&
        task.toolSlug &&
        context.tools.has(task.toolSlug) &&
        (task.arguments?.directToolExecution ||
          (!task.arguments?.prompt && !task.arguments?.instruction && task.toolSlug !== 'planner'))
      ) {
        return await this.executeWithContextTool(task, context);
      }

      const response = await this.execute(task, context);
      return {
        success: true,
        data: response.structured ?? response.content,
        attempts: task.retryCount + 1,
        response,
      };
    } catch (err: any) {
      logger.error(`ExecutorLayer: Execution failed for [${task.id}]: ${err.message}`);
      return {
        success: false,
        error: err.message,
        attempts: task.retryCount + 1,
      };
    }
  }

  public getModelRouter(): ModelRouter {
    return this.modelRouter;
  }

  public getAIAdapter(): AIProviderAdapter {
    return this.aiAdapter;
  }

  public getContextLayer(): ContextLayer {
    return this.contextLayer;
  }
}

