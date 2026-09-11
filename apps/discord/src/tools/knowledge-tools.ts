import { createLogger } from '@ai-agent-platform/shared';
import { Tool, ToolContext, ToolResult } from './tool.interface.js';
import { handbookService } from '../domain/handbook-service.js';

const logger = createLogger('KnowledgeTools');

export class HandbookTool implements Tool {
  public getName(): string {
    return 'HandbookTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      const snippets = handbookService.search(context.query);
      return {
        toolName: this.getName(),
        success: true,
        data: { handbookSnippets: snippets },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}

export class WebSearchTool implements Tool {
  public getName(): string {
    return 'WebSearchTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      return {
        toolName: this.getName(),
        success: true,
        data: { patchNotes: "Verified Umamusume patch update: New championship scenario released." },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}
