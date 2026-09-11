import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('MultiAgentOrchestrator');

export type SpecialistAgentType =
  | 'CHARACTER_SPECIALIST'
  | 'HANDBOOK_SPECIALIST'
  | 'FAN_ANALYST'
  | 'LEADERBOARD_ANALYST'
  | 'CLUB_STRATEGIST'
  | 'RESEARCH_AGENT'
  | 'WORKFLOW_MANAGER'
  | 'PERSONALITY_COMPOSER';

export interface AgentDefinition {
  name: SpecialistAgentType;
  capabilities: string[];
  priority: number;
}

export interface SharedWorkingMemory {
  trainerId: string;
  fanTotal?: number;
  rank?: number;
  clubFans?: number;
  activeWorkflows?: number;
  extractedContext?: Record<string, any>;
}

export class MultiAgentOrchestrator {
  private static instance: MultiAgentOrchestrator;
  private agents: Map<SpecialistAgentType, AgentDefinition> = new Map();

  public static getInstance(): MultiAgentOrchestrator {
    if (!MultiAgentOrchestrator.instance) {
      MultiAgentOrchestrator.instance = new MultiAgentOrchestrator();
    }
    return MultiAgentOrchestrator.instance;
  }

  constructor() {
    this.registerAgents();
  }

  private registerAgents(): void {
    const definitions: AgentDefinition[] = [
      { name: 'CHARACTER_SPECIALIST', capabilities: ['lore', 'characters', 'support cards', 'training advice'], priority: 1 },
      { name: 'HANDBOOK_SPECIALIST', capabilities: ['club rules', 'linking process', 'guides', 'handbooks'], priority: 1 },
      { name: 'FAN_ANALYST', capabilities: ['fan gain', 'fan deficit', 'milestones', 'projections'], priority: 2 },
      { name: 'LEADERBOARD_ANALYST', capabilities: ['ranking', 'position changes', 'gap analysis'], priority: 2 },
      { name: 'CLUB_STRATEGIST', capabilities: ['club health', 'forecasts', 'risks', 'performance'], priority: 3 },
      { name: 'RESEARCH_AGENT', capabilities: ['web search', 'patch notes', 'news', 'updates'], priority: 4 },
      { name: 'WORKFLOW_MANAGER', capabilities: ['goals', 'tracking', 'reminders', 'monitoring'], priority: 2 },
      { name: 'PERSONALITY_COMPOSER', capabilities: ['tone adjustment', 'formatting', 'composition'], priority: 5 },
    ];

    for (const def of definitions) {
      this.agents.set(def.name, def);
    }
  }

  /**
  * Router Agent: Inspects the message and determines which specialist agents should collaborate.
  */
  public routeQuery(message: string): SpecialistAgentType[] {
    const lower = (message || '').toLowerCase();
    const required: SpecialistAgentType[] = [];

    if (/\b(smart falcon|tokai teio|oguri cap|lore|character|support card)\b/i.test(lower)) {
      required.push('CHARACTER_SPECIALIST');
    }
    if (/\b(link|handbook|guide|rules)\b/i.test(lower)) {
      required.push('HANDBOOK_SPECIALIST');
    }
    if (/\b(fan|deficit|surplus|reach|pace|projection|150m|200m)\b/i.test(lower)) {
      required.push('FAN_ANALYST');
    }
    if (/\b(rank|leaderboard|gap|top\s+\d+|position)\b/i.test(lower)) {
      required.push('LEADERBOARD_ANALYST');
    }
    if (/\b(club|health|momentum|forecast|operations)\b/i.test(lower)) {
      required.push('CLUB_STRATEGIST');
    }
    if (/\b(patch|update|news|global|search)\b/i.test(lower)) {
      required.push('RESEARCH_AGENT');
    }
    if (/\b(track|remind|monitor|goal)\b/i.test(lower)) {
      required.push('WORKFLOW_MANAGER');
    }

    // Always include Personality Composer for final presentation
    required.push('PERSONALITY_COMPOSER');

    // Deduplicate while preserving order
    const unique = Array.from(new Set(required));
    logger.info(`[Router Agent] Routed query to: ${unique.join(', ')}`);
    return unique;
  }
}

export const multiAgentOrchestrator = MultiAgentOrchestrator.getInstance();
