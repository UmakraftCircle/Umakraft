import { createLogger } from '@ai-agent-platform/shared';
import { Tool } from './tool.interface.js';
import { FanGainTool, FanDeficitTool, MilestoneTool } from './fan-tools.js';
import { LeaderboardTool } from './ranking-tools.js';
import { HandbookTool, WebSearchTool } from './knowledge-tools.js';
import { LinkRequestTool, TrainerProfileTool } from './member-tools.js';
import { IntentType } from '../intent-router.js';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool> = new Map();

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  constructor() {
    this.register(new FanGainTool());
    this.register(new FanDeficitTool());
    this.register(new MilestoneTool());
    this.register(new LeaderboardTool());
    this.register(new HandbookTool());
    this.register(new WebSearchTool());
    this.register(new LinkRequestTool());
    this.register(new TrainerProfileTool());
  }

  public register(tool: Tool): void {
    this.tools.set(tool.getName(), tool);
    logger.info(`[ToolRegistry] Registered tool: ${tool.getName()}`);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getToolForIntent(intent: IntentType): string {
    switch (intent) {
      case IntentType.FAN_SYSTEM:
        return 'FanGainTool';
      case IntentType.LEADERBOARD:
        return 'LeaderboardTool';
      case IntentType.HANDBOOK:
        return 'HandbookTool';
      case IntentType.LINK_REQUEST:
        return 'LinkRequestTool';
      case IntentType.WEB_SEARCH:
        return 'WebSearchTool';
      case IntentType.CHAT:
      default:
        return 'CHAT';
    }
  }
}

export const toolRegistry = ToolRegistry.getInstance();
