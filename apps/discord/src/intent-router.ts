import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('IntentRouterService');

export enum IntentType {
  CHAT = 'CHAT',
  HANDBOOK = 'HANDBOOK',
  FAN_SYSTEM = 'FAN_SYSTEM',
  LEADERBOARD = 'LEADERBOARD',
  LINK_REQUEST = 'LINK_REQUEST',
  WEB_SEARCH = 'WEB_SEARCH',
  ADMIN = 'ADMIN',
  UNKNOWN = 'UNKNOWN',
}

export interface IntentRouterResult {
  intent: IntentType;
  confidence: number;
  source: 'RULE_DETECTION' | 'AI_CLASSIFICATION' | 'FALLBACK';
}

export class IntentRouterService {
  private static instance: IntentRouterService;

  public static getInstance(): IntentRouterService {
    if (!IntentRouterService.instance) {
      IntentRouterService.instance = new IntentRouterService();
    }
    return IntentRouterService.instance;
  }

  /**
  * Layer 1: Fast Rule Detection (cheap keyword routing covering 60-80% of traffic).
  * Layer 2 & 3: Fallback and Confidence assurance.
  */
  public route(message: string): IntentRouterResult {
    const lower = (message || '').toLowerCase().trim();

    // Layer 1: Fast Rule Detection
    // 1. Leaderboard & Rankings
    if (/\b(leaderboard|rank|ranking|top\s+players?|gap|standing)\b/i.test(lower)) {
      return { intent: IntentType.LEADERBOARD, confidence: 0.95, source: 'RULE_DETECTION' };
    }

    // 2. Fan System (fan gain, fan deficit, milestone, fans)
    if (/\b(fan\s+gain|fans?|deficit|surplus|milestone|pace|goal|projection)\b/i.test(lower)) {
      return { intent: IntentType.FAN_SYSTEM, confidence: 0.92, source: 'RULE_DETECTION' };
    }

    // 3. Link Request (link account, trainer ID, connect)
    if (/\b(link\s+account|trainer\s+id|connect\s+account|verify\s+link)\b/i.test(lower)) {
      return { intent: IntentType.LINK_REQUEST, confidence: 0.95, source: 'RULE_DETECTION' };
    }

    // 4. Handbook / Club Rules
    if (/\b(rule|handbook|club\s+requirement|club\s+policy|guidelines)\b/i.test(lower)) {
      return { intent: IntentType.HANDBOOK, confidence: 0.90, source: 'RULE_DETECTION' };
    }

    // 5. Admin Commands
    if (/\b(admin\s+command|club\s+management|kick\s+member|approve\s+member)\b/i.test(lower)) {
      return { intent: IntentType.ADMIN, confidence: 0.95, source: 'RULE_DETECTION' };
    }

    // 6. Web Search
    if (/\b(latest\s+update|patch\s+notes|news|global\s+version|search\s+web)\b/i.test(lower)) {
      return { intent: IntentType.WEB_SEARCH, confidence: 0.88, source: 'RULE_DETECTION' };
    }

    // 7. General Chat (e.g. "How are you", character discussions like Yamanin Zephyr bust size)
    if (/\b(hello|hi|how\s+are\s+you|yamanin\s+zephyr|smart\s+falcon|tokai\s+teio|bust\s+size)\b/i.test(lower)) {
      return { intent: IntentType.CHAT, confidence: 0.90, source: 'RULE_DETECTION' };
    }

    // Layer 3: Confidence Check / Fallback to CHAT (never fail, always route somewhere)
    return { intent: IntentType.CHAT, confidence: 0.70, source: 'FALLBACK' };
  }
}

export const intentRouterService = IntentRouterService.getInstance();
