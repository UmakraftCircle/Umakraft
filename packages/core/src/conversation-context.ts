import { createLogger } from '@ai-agent-platform/shared';
import {
  conversationMemoryStore,
  type ConversationMessage,
  type ScopeFilter,
} from '@ai-agent-platform/integrations';

const logger = createLogger('ConversationContext');

/**
 * ConversationContextBuilder — assembles the context the model receives for a
 * `/ask` turn, without ever sending the full history.
 *
 * Responsibilities:
 *  - Retrieve only RELEVANT short-term context (recency-capped, scoped).
 *  - Retrieve relevant long-term memory separately.
 *  - Enforce a token/context-window budget.
 *  - Produce a `system` prompt (context) + a `prompt` (the user's latest message),
 *    matching the AIService.generate({ system, prompt }) contract so this remains
 *    provider-agnostic.
 */

interface BuiltContext {
  system: string;
  prompt: string;
  debug: {
    recentCount: number;
    longTermCount: number;
    estimatedTokens: number;
    truncated: boolean;
  };
}

// Configurable defaults via env, with safe fallbacks.
const DEFAULT_MAX_TOKENS = 2000; // total budget for injected context
const DEFAULT_RECENT_LIMIT = 20; // max recent turns considered
const CHARS_PER_TOKEN = 4; // rough heuristic; refine with a real tokenizer later

/** Very rough token estimate — no external dependency. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Trim a list of messages to fit a token budget, keeping the newest turns. */
function fitToBudget(messages: ConversationMessage[], maxTokens: number): { kept: ConversationMessage[]; truncated: boolean } {
  const kept: ConversationMessage[] = [];
  let used = 0;
  let truncated = false;

  // Iterate newest-first so we prioritize recent turns.
  const newestFirst = [...messages].reverse();
  for (const m of newestFirst) {
    const cost = estimateTokens(`${m.role}: ${m.content}`);
    if (used + cost > maxTokens && kept.length > 0) {
      truncated = true;
      break;
    }
    kept.unshift(m); // restore oldest → newest order
    used += cost;
  }

  return { kept, truncated };
}

export class ConversationContextBuilder {
  constructor(
    private readonly opts: {
      maxTokens?: number;
      recentLimit?: number;
      systemPersona?: string;
    } = {},
  ) {}

  /**
   * Build the context for a single `/ask` turn.
   *
   * @param scope   user/guild/channel isolation keys
   * @param userMessage  the latest user prompt
   * @param sessionId    optional; falls back to resume/create via the store
   */
  async build(scope: ScopeFilter, userMessage: string, sessionId?: string): Promise<BuiltContext> {
    const maxTokens = this.opts.maxTokens ?? this.#envInt('CONTEXT_MAX_TOKENS', DEFAULT_MAX_TOKENS);
    const recentLimit = this.opts.recentLimit ?? this.#envInt('CONTEXT_RECENT_LIMIT', DEFAULT_RECENT_LIMIT);

    // 1. Short-term context (scoped, recency-capped).
    const recent = await conversationMemoryStore.getRecentMessages(scope, recentLimit);

    // 2. Long-term memory (separate store, relevance-filtered by the user message).
    const longTerm = await conversationMemoryStore.getLongTermMemory(scope, userMessage);

    // 3. Fit short-term turns into the remaining budget.
    const { kept, truncated } = fitToBudget(recent, Math.floor(maxTokens * 0.6));
    const recentBlock = kept
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // 4. Long-term memory block.
    const ltmBlock = longTerm.length
      ? longTerm.map((m) => `- [${m.type}] ${m.content}`).join('\n')
      : '';

    // 5. Assemble the system prompt (context) — the MODEL sees this, never raw DB rows.
    const system = [
      this.opts.systemPersona ?? 'You are Umakraft, a helpful AI assistant in a Discord server.',
      '---',
      'Relevant long-term memory:',
      ltmBlock || '(none)',
      '---',
      'Recent conversation context (most recent last):',
      recentBlock || '(none)',
    ].join('\n');

    const estimatedTokens = estimateTokens(system) + estimateTokens(userMessage);

    return {
      system,
      prompt: userMessage,
      debug: {
        recentCount: kept.length,
        longTermCount: longTerm.length,
        estimatedTokens,
        truncated,
      },
    };
  }

  #envInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
}

export const conversationContextBuilder = new ConversationContextBuilder();
