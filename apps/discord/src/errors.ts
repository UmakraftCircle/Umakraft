import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('ErrorMessages');

/**
 * Classify a thrown error from `/ask` / `/agent` into a safe, human-readable
 * Discord reply. Never echo secrets, keys, or raw stack traces to the user.
 *
 * Voice: the bot speaks as an umamusume to her Trainer. Blocking/config errors
 * use a `⚠️` prefix (scannable, accurate); transient errors use emotive emoji
 * and reassurance.
 */
export function failureMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // Missing / invalid AI credentials (blocking/config)
  if (/no api key|api key configured|requires at least one api key|invalid.*(api key|token)/i.test(msg)) {
    return "⚠️ Trainer, I can't find my spark to run — I'm not connected to an AI provider yet!\n\nA server admin needs to set `GROQ_API_KEY` (or `OPENAI_API_KEY`) and restart me, so I can race again.";
  }

  // Missing / invalid Turso database config (blocking/config)
  if (/turso/i.test(msg)) {
    return "⚠️ Trainer, my memory's gone a bit foggy — I can't reach my notes (Turso database).\n\nPlease set `TURSO_URL` and `TURSO_AUTH_TOKEN`, then restart me so I can remember our sessions.";
  }

  // Tool-call configuration mismatch (blocking/config)
  if (/tool_use_failed|tool choice is none|json_validate_failed|model called a tool/i.test(msg)) {
    return "⚠️ Trainer, I reached for a tool in a way the track doesn't allow, and tripped.\n\nThis is a setup issue, so please have a server admin check my model/tool configuration.";
  }

  // 401 / 403 — invalid or expired key (blocking/config)
  if (/(401|403|unauthorized|invalid api)/i.test(msg)) {
    return "⚠️ Trainer, the race officials turned me away — my API key seems wrong or expired.\n\nPlease have a server admin verify `GROQ_API_KEY`.";
  }

  // model_not_found — deprecated / renamed model (blocking/config)
  if (/model_not_found|does not exist|unknown model|invalid model/i.test(msg)) {
    return "⚠️ Trainer, the model I'm set to run on has been retired or renamed, so I can't start.\n\nPlease have a server admin update `GROQ_MODEL` to a currently supported model and restart me.";
  }

  // 429 rate-limit (transient)
  if (/429|rate.?limit|too many requests/i.test(msg)) {
    return "💨 Trainer, phew — I'm sprinting flat-out and need to catch my breath right now!\n\nNothing's broken. Just give me a short moment and ask again. 🙏";
  }

  // Timeouts (transient)
  if (/timed out|timeout/gi.test(lower)) {
    return "🐎 Trainer, that question made me lose my stride and the lap got cut short.\n\nCould you try again, or ask it a little more simply? I'll get it next time!";
  }

  // Tool not found / not registered (blocking/config)
  if (/tool not found|no tool registered/i.test(msg)) {
    return "⚠️ Trainer, I reached for a tool that isn't in my kit.\n\nThat's a setup gap — please have a server admin check the tool registry.";
  }

  // Code bugs (ReferenceError / TypeError / etc.) — log LOUDLY with stack, but
  // keep the user-facing message generic so no internals leak.
  if (err instanceof ReferenceError || err instanceof TypeError) {
    logger.error(
      `Code bug in /ask: ${err.name}: ${err.message}\n${err.stack ?? 'no stack'}`
    );
    return "🐎 Trainer, I tripped over something unexpected on my end.\n\nGive me a moment and try again — I won't let a little stumble stop the race. 🏁";
  }

  // Fallback: keep it generic to avoid leaking internals, but log the real error.
  logger.error(`Unclassified error: ${msg}`);
  return "🐎 Trainer, something unexpected threw me off my pace.\n\nCould you try that again? If it keeps happening, let a server admin know so they can check on me.";
}
