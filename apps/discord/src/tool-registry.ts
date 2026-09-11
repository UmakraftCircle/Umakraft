import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ToolRegistry-F2');

export interface AgentToolDefinition {
  name: string;
  description: string;
  capabilities: string[];
  cost: 'low' | 'medium' | 'high';
  priority: number;
}

export class AgentToolRegistry {
  private static instance: AgentToolRegistry;
  private tools: Map<string, AgentToolDefinition> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  public static getInstance(): AgentToolRegistry {
    if (!AgentToolRegistry.instance) {
      AgentToolRegistry.instance = new AgentToolRegistry();
    }
    return AgentToolRegistry.instance;
  }

  private registerDefaultTools(): void {
    const defaultTools: AgentToolDefinition[] = [
      {
        name: 'CHAT_ENGINE',
        description: 'Internal conversational persona, memory, and general character discussion.',
        capabilities: ['chat', 'lore', 'personality', 'memory'],
        cost: 'low',
        priority: 1,
      },
      {
        name: 'HANDBOOK_SEARCH',
        description: 'Handbook RAG store for game mechanics, training guidelines, and support card specs.',
        capabilities: ['handbook', 'game_mechanics', 'training_guide', 'stats'],
        cost: 'medium',
        priority: 2,
      },
      {
        name: 'FAN_SYSTEM',
        description: 'User fan gain tracking and progression stats.',
        capabilities: ['fans', 'fan_gain', 'progress'],
        cost: 'low',
        priority: 1,
      },
      {
        name: 'LEADERBOARD_SYSTEM',
        description: 'Club or trainer rankings and competitive leaderboards.',
        capabilities: ['leaderboard', 'rankings', 'top_trainers'],
        cost: 'low',
        priority: 1,
      },
      {
        name: 'LINK_REQUEST_SYSTEM',
        description: 'Account linking and discord identity verification.',
        capabilities: ['link', 'account', 'auth'],
        cost: 'low',
        priority: 1,
      },
      {
        name: 'WEB_SEARCH',
        description: 'External real-time Tavily search for live global updates, patches, and current events.',
        capabilities: ['web_search', 'news', 'patches', 'live_updates'],
        cost: 'high',
        priority: 3,
      },
      {
        name: 'CLUB_DATA',
        description: 'Club roster, team policies, and collective fan totals.',
        capabilities: ['club', 'roster', 'team'],
        cost: 'low',
        priority: 1,
      },
    ];

    for (const tool of defaultTools) {
      this.tools.set(tool.name, tool);
      logger.info(`[ToolRegistry] Registered tool: ${tool.name} (Priority ${tool.priority})`);
    }
  }

  public getTool(name: string): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export const agentToolRegistry = AgentToolRegistry.getInstance();
