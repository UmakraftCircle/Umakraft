import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ErrorMessages');

/**
 * Classify a thrown error from `/ask` / `/agent` into a safe, human-readable
 * Discord reply. Never echo secrets, keys, or raw stack traces to the user.
 */
export function failureMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // Missing / invalid AI credentials
  if (/no api key|api key configured|requires at least one api key|invalid.*(api key|token)/i.test(msg)) {
    return '⚠️ This bot is not configured with an AI provider yet. A server admin needs to set the `GROQ_API_KEY` (or `OPENAI_API_KEY`) environment variable and restart the bot.';
  }

  // Missing / invalid Turso database config (conversation memory)
  if (/turso/i.test(msg)) {
    return '⚠️ The bot cannot connect to its database (Turso). A server admin needs to set the `TURSO_URL` and `TURSO_AUTH_TOKEN` environment variables and restart the bot.';
  }

  // Provider-level failures
  if (/(401|403|unauthorized|invalid api)/i.test(msg)) {
    return '⚠️ The AI provider rejected the request (invalid or expired API key). A server admin should verify the `GROQ_API_KEY`.';
  }
  if (/429|rate.?limit|too many requests/i.test(msg)) {
    return '⏳ The AI provider is rate-limited right now. Please try again in a moment.';
  }

  // Timeouts
  if (/timed out|timeout/gi.test(lower)) {
    return '⏳ The request took too long and was stopped. Please try again (or simplify the question).';
  }

  // Tool-call / registry issues
  if (/tool not found|no tool registered/i.test(msg)) {
    return '⚠️ The agent tried to use a tool that is not available. This is likely a configuration issue — a server admin should check the tool registry.';
  }

  // Fallback: keep it generic to avoid leaking internals, but log the real error.
  logger.error(`Unclassified error: ${msg}`);
  return '⚠️ Sorry, something went wrong while answering. Please try again.';
}
