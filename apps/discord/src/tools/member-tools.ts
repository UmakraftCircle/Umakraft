import { createLogger } from '@ai-agent-platform/shared';
import { Tool, ToolContext, ToolResult } from './tool.interface.js';
import { linkService } from '../domain/link-service.js';

const logger = createLogger('MemberTools');

export class LinkRequestTool implements Tool {
  public getName(): string {
    return 'LinkRequestTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      const linked = linkService.getTrainerId(context.trainerId);
      return {
        toolName: this.getName(),
        success: true,
        data: { linkedTrainerId: linked ?? 'Not Linked' },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}

export class TrainerProfileTool implements Tool {
  public getName(): string {
    return 'TrainerProfileTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      return {
        toolName: this.getName(),
        success: true,
        data: { trainerId: context.trainerId, clubRole: 'Member' },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}
