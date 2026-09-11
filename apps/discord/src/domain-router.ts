import { createLogger } from '@ai-agent-platform/shared';
import { FanLeaderboardResolver } from '@ai-agent-platform/core';

const logger = createLogger('DomainRouter');

export type DomainType =
  | 'GENERAL_CHAT'
  | 'CHARACTER_CHAT'
  | 'HANDBOOK_LOOKUP'
  | 'FAN_GAIN'
  | 'FAN_LEADERBOARD'
  | 'FAN_DEFICIT'
  | 'FAN_SURPLUS'
  | 'MILESTONE'
  | 'LINK_REQUEST'
  | 'WEB_SEARCH'
  | 'ADMIN';

export type ResponseStrategy =
  | 'INFORMATIONAL'
  | 'CONVERSATIONAL'
  | 'ADVISORY'
  | 'COMPARISON'
  | 'CELEBRATION'
  | 'ALERT'
  | 'SYSTEM_RESPONSE';

export interface DomainRouteDecision {
  domain: DomainType;
  strategy: ResponseStrategy;
  confidence: number;
  reason: string;
  handler: string;
}

export interface RouteMessageOptions {
  userId: string;
  message: string;
  activeTopic?: string;
  recentHistory?: Array<{ role: string; content: string }>;
}

const KNOWN_CHARACTERS = [
  'smart falcon',
  'tokai teio',
  'oguri cap',
  'copano rickey',
  'silence suzuka',
  'gold ship',
  'special week',
  'vodka',
  'scarlet',
];

/**
 * Detects the active character topic from recent conversation history.
 */
export function detectActiveTopic(history?: Array<{ role: string; content: string }>): string | undefined {
  if (!history || history.length === 0) return undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    const text = (history[i].content || '').toLowerCase();
    for (const char of KNOWN_CHARACTERS) {
      if (text.includes(char)) {
        return char
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }
  }
  return undefined;
}

/**
 * Centralized Intelligent Domain & Strategy Router (Phase E2)
 * Chooses both domain and adaptive response strategy for every message.
 */
export async function routeMessage(options: RouteMessageOptions): Promise<DomainRouteDecision> {
  const { userId, message, recentHistory } = options;
  const trimmed = (message || '').trim();
  const lower = trimmed.toLowerCase();
  const activeTopic = options.activeTopic ?? detectActiveTopic(recentHistory);

  // 1. Link Request Domain Check
  if (/\b(link\s+my\s+account|link\s+account|link\s+discord|connect\s+account|i\s+want\s+to\s+link\s+my\s+account)\b/i.test(lower)) {
    const decision: DomainRouteDecision = {
      domain: 'LINK_REQUEST',
      strategy: 'SYSTEM_RESPONSE',
      confidence: 0.98,
      reason: 'Explicit account linking request detected',
      handler: 'AccountLinkHandler',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 2. Fan Gain Domain Check
  if (
    /\b(show\s+my\s+fan\s+gain|fan\s+gain\s+today|my\s+fans?\s+today|my\s+fan\s+gain|how\s+many\s+fans?\s+did\s+i\s+gain|fans?\s+today|today'?s?\s+fans?|fan\s+progress|fan\s+count\s+today|current\s+fan\s+gain|how\s+many\s+fans?|fan\s+gain)\b/i.test(
      lower
    )
  ) {
    const decision: DomainRouteDecision = {
      domain: 'FAN_GAIN',
      strategy: 'SYSTEM_RESPONSE',
      confidence: 0.98,
      reason: 'Fan gain query matched via robust intent rules',
      handler: 'FanLeaderboardResolver',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 3. Leaderboard Domain Check
  if (
    /\b(fan\s+leaderboard|leaderboard|top\s+trainers?|top\s+(?:5|10|20|25|50|100)|my\s+rank|show\s+ranking|ranking|rankings|fan\s+ranking)\b/i.test(
      lower
    )
  ) {
    const decision: DomainRouteDecision = {
      domain: 'FAN_LEADERBOARD',
      strategy: 'SYSTEM_RESPONSE',
      confidence: 0.98,
      reason: 'Leaderboard or ranking query matched',
      handler: 'FanLeaderboardResolver',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 4. Comparison Strategy Check (e.g., "Smart Falcon or Oguri Cap?")
  if (/\b(or|versus|vs\.?|compare)\b/i.test(lower) && KNOWN_CHARACTERS.filter((c) => lower.includes(c)).length >= 1) {
    const decision: DomainRouteDecision = {
      domain: 'CHARACTER_CHAT',
      strategy: 'COMPARISON',
      confidence: 0.96,
      reason: 'Character comparison query detected',
      handler: 'LilyChatService',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 5. Advisory Strategy Check (e.g., "Should I train/build...")
  if (/\b(should\s+i\s+(?:train|build|use|invest)|is\s+\w+\s+good|recommend|worth\s+it)\b/i.test(lower)) {
    const decision: DomainRouteDecision = {
      domain: 'CHARACTER_CHAT',
      strategy: 'ADVISORY',
      confidence: 0.95,
      reason: 'Advisory or recommendation query detected',
      handler: 'LilyChatService',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 6. Informational Strategy Check (e.g., "Tell me about...", "Who is...")
  if (/\b(tell\s+me\s+about|who\s+is|what\s+is|explain|details?\s+on)\b/i.test(lower)) {
    const decision: DomainRouteDecision = {
      domain: 'CHARACTER_CHAT',
      strategy: 'INFORMATIONAL',
      confidence: 0.95,
      reason: 'Informational character or topic lookup query detected',
      handler: 'LilyChatService',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 7. Handbook / Guide / Stats Domain Check
  if (/\b(handbook|guide|stats?|training\s+guide|support\s+cards?|skills?\s+list)\b/i.test(lower)) {
    const decision: DomainRouteDecision = {
      domain: 'HANDBOOK_LOOKUP',
      strategy: 'INFORMATIONAL',
      confidence: 0.90,
      reason: 'Handbook or game mechanics inquiry detected',
      handler: 'AskGenerator',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 8. Character Chat / Conversational Strategy Check
  const mentionsCharacter = KNOWN_CHARACTERS.some((c) => lower.includes(c));
  const hasPronounReference = /\b(she|her|hers|he|him|his|they|them|their|it|its|that\s+character|that\s+girl)\b/i.test(
    lower
  );

  if (mentionsCharacter || (activeTopic && hasPronounReference)) {
    // Determine if it's conversational (e.g., "I love Smart Falcon") vs informational
    const isConversational = /\b(love|like|favorite|amazing|great|cool|best)\b/i.test(lower);
    const strategy: ResponseStrategy = isConversational ? 'CONVERSATIONAL' : 'INFORMATIONAL';
    const reason = mentionsCharacter
      ? `Specific character mention detected (${strategy.toLowerCase()})`
      : `Pronoun reference resolved via active topic "${activeTopic}"`;

    const decision: DomainRouteDecision = {
      domain: 'CHARACTER_CHAT',
      strategy,
      confidence: 0.95,
      reason,
      handler: 'LilyChatService',
    };
    logTelemetry(userId, trimmed, decision);
    return decision;
  }

  // 9. Default Fallback: General Chat / Conversational Strategy
  const fallbackDecision: DomainRouteDecision = {
    domain: 'GENERAL_CHAT',
    strategy: 'CONVERSATIONAL',
    confidence: 0.85,
    reason: 'Standard conversational input falling back to conversational strategy',
    handler: 'LilyChatService',
  };
  logTelemetry(userId, trimmed, fallbackDecision);
  return fallbackDecision;
}

function logTelemetry(userId: string, message: string, decision: DomainRouteDecision): void {
  logger.info(
    `[Domain & Strategy Telemetry]\n` +
      `  Message: "${message}"\n` +
      `  User ID: ${userId}\n` +
      `  Detected Domain: ${decision.domain}\n` +
      `  Strategy: ${decision.strategy}\n` +
      `  Confidence: ${decision.confidence}\n` +
      `  Winning Handler: ${decision.handler}\n` +
      `  Reason: ${decision.reason}`
  );
}
