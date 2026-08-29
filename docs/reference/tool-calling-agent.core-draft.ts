import type { AIService, GenerateStructuredOutputOptions } from '@ai-agent-platform/ai';
import type { ToolRegistry, ToolDefinition } from '../packages/core/src/tool-registry.js';

export interface ToolCallingAgentDraftConfig {
  maxToolCalls?: number;
  maxWebSearches?: number;
  systemPromptPrefix?: string;
  domainGuard?: boolean;
}

export class CoreToolCallingAgentDraft {
  constructor(
    private readonly ai: AIService,
    private readonly registry: ToolRegistry
  ) {}

  async run(
    userId: string,
    prompt: string,
    history?: Array<{ role: string; content: string }>,
    config?: ToolCallingAgentDraftConfig
  ): Promise<string> {
    const maxCalls = config?.maxToolCalls ?? 4;
    let callCount = 0;

    while (callCount < maxCalls) {
      callCount++;
      const res = await this.ai.generateStructuredOutput<any>({
        prompt,
        system: config?.systemPromptPrefix ?? 'You are an agent.',
        temperature: 0.2,
      });

      if (res?.answer) {
        return res.answer;
      }
      if (res?.action) {
        const tool = this.registry.get(res.action);
        if (!tool) break;
        await tool.handler(res.parameters ?? {});
      }
    }

    return 'Agent reached execution budget limit.';
  }
}
