import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Prompts');

export interface PromptTemplate {
  name: string;
  version: string;
  system: string;
  userTemplate: (variables: Record<string, string>) => string;
}

/**
 * Central prompt registry.
 * All system-level prompt templates live here so they can be versioned,
 * audited, and A/B tested without touching application code.
 *
 * ── TEMPLATE VARIABLE SYNTAX ────────────────────────────────
 *
 * Two valid patterns exist for injecting dynamic data:
 *
 * PATTERN A — vars.varname (standard for all templates)
 *   userTemplate: (vars) => `Hello ${vars.memberName}!`
 *   // Reads vars directly.  Clean, simple, no replaceAll needed.
 *   // Used by: ALL userTemplate functions
 *
 * PATTERN B — dollar-brace-varname placeholder + replaceAll (legacy, SYSTEM PROMPTS ONLY)
 *   // For the `system` string (which is a plain string, not a function),
 *   // placeholders like ${timeOfDay} are literal text injected via .replaceAll().
 *   // E.g. system: 'You are generating a ${timeOfDay} message...'
 *   // The service then calls .replaceAll('${timeOfDay}', timeSlot) on rendered.system.
 *   // Used by: daily-message system prompt
 *
 * BROKEN — DO NOT USE
 *   // Writing a bare-brace string like '{trainerName}' inside a
 *   // template literal ${...} expression silently drops the $ sign.
 *   // The JS expression evaluates the string '{trainerName}' which
 *   // produces {trainerName} (no leading $).
 *   // replaceAll('${trainerName}', ...) will NEVER match.
 *   // Guarded by: `pnpm lint` (scripts/lint-templates.sh)
 *   // Tested by:  tests/ai/prompts.test.ts
 */