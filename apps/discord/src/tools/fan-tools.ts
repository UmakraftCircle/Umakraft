import { createLogger } from '@ai-agent-platform/shared';
import { Tool, ToolContext, ToolResult } from './tool.interface.js';
import { fanService } from '../domain/fan-service.js';

const logger = createLogger('FanTools');

export class FanGainTool implements Tool {
  public getName(): string {
    return 'FanGainTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      const stats = fanService.getFanStats(context.trainerId);
      return {
        toolName: this.getName(),
        success: true,
        data: { dailyGain: stats.dailyGain, currentFans: stats.currentFans },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}

export class FanDeficitTool implements Tool {
  public getName(): string {
    return 'FanDeficitTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      const stats = fanService.getFanStats(context.trainerId);
      return {
        toolName: this.getName(),
        success: true,
        data: { deficit: stats.deficit, targetFans: stats.targetFans, currentFans: stats.currentFans },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}

export class MilestoneTool implements Tool {
  public getName(): string {
    return 'MilestoneTool';
  }

  public execute(context: ToolContext): ToolResult {
    const start = Date.now();
    try {
      const milestone = fanService.calculateMilestone(context.trainerId);
      return {
        toolName: this.getName(),
        success: true,
        data: { milestoneText: milestone },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { toolName: this.getName(), success: false, data: null, durationMs: Date.now() - start, error: err.message };
    }
  }
}
